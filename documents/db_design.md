# 🏗️ THIẾT KẾ CƠ SỞ DỮ LIỆU TỔNG THỂ (MASTER DATABASE DESIGN)

## 1. NGUYÊN TẮC THIẾT KẾ CỐT LÕI
*   **Surrogate Key:** Sử dụng `UUID` (v4) làm Khóa chính (PK) cho tất cả các bảng để đảm bảo tính duy nhất và bảo mật.
*   **Single Source of Truth:** Bảng `profiles` là nguồn dữ liệu duy nhất cho mọi đối tượng người dùng (Nhân viên, Quản lý, Kỹ thuật viên).
*   **Flexibility (JSONB):** Sử dụng kiểu dữ liệu `JSONB` cho các thông số kỹ thuật và thông tin mua sắm để hệ thống có thể mở rộng mà không cần thay đổi cấu trúc bảng.
*   **Performance First:** Đánh chỉ mục (Index) cho tất cả Khóa ngoại (FK) và các trường tìm kiếm thường xuyên.
*   **Automation:** Sử dụng Database Triggers để xử lý logic nghiệp vụ ngay tại tầng dữ liệu (tính ngày bảo hành, cập nhật trạng thái tài sản).

---

## 2. CẤU TRÚC CÁC PHÂN HỆ (MODULES)

### 2.1. Phân hệ Tổ chức & Nhân sự (Core HR)
*   **`departments`**: Lưu sơ đồ tổ chức. Hỗ trợ phân cấp cha-con (parent-child).
*   **`profiles`**: Mở rộng từ `auth.users`. Lưu mã nhân viên, chức danh, quyền hạn (`role`) và trạng thái làm việc.

### 2.2. Phân hệ Chấm công & Đơn từ (Attendance & Requests)
*   **`shifts`**: Định nghĩa các ca làm việc.
*   **`attendances`**: Lưu dữ liệu check-in/out kèm tọa độ GPS, ảnh selfie và độ chính xác vị trí.
*   **`requests`**: Quản lý các loại đơn từ (nghỉ phép, OT, sửa công) và luồng phê duyệt.

### 2.3. Phân hệ Quản lý Tài sản - CMDB (Asset Management)
*   **`asset_groups` & `device_types`**: Phân loại tài sản theo nhóm và loại thiết bị.
*   **`suppliers`**: Danh mục nhà cung cấp tài sản/phần mềm.
*   **`assets`**: Kho tài sản chi tiết. Lưu thông số kỹ thuật linh hoạt qua JSONB.
*   **`asset_handover_logs`**: Nhật ký bàn giao/thu hồi tài sản kèm bằng chứng hình ảnh.
*   **`software_licenses`**: Quản lý bản quyền phần mềm gắn với thiết bị.

### 2.4. Phân hệ Sản phẩm & Bảo hành (Product & Warranty)
*   **`product_types`**: Danh mục các dòng sản phẩm kinh doanh.
*   **`motors`**: Danh sách máy vật lý (Serial Number).
*   **`customers`**: Thông tin khách hàng, đại lý, đối tác.
*   **`registrations`**: Hồ sơ kích hoạt bảo hành và chuyển quyền sở hữu sản phẩm.
*   **`maintenance_logs`**: Lịch sử bảo trì, sửa chữa sản phẩm.

### 2.5. Phân hệ Giám sát & Nhật ký (Monitoring & Logs)
*   **`scan_logs`**: Ghi lại vết quét QR Code (GPS, thiết bị).
*   **`audit_logs`**: Nhật ký thay đổi dữ liệu (Audit Trail) để phục vụ bảo mật và truy vết.

---

## 3. SQL MASTER SCRIPT (KHỞI TẠO TOÀN BỘ HỆ THỐNG)

```sql
-- ==============================================================================
-- 1. KHỞI TẠO EXTENSIONS VÀ KIỂU DỮ LIỆU (ENUMS)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE public.user_status AS ENUM ('working', 'resigned');
CREATE TYPE public.group_role AS ENUM ('employee', 'manager', 'hr_admin', 'admin', 'staff', 'technician');
CREATE TYPE public.asset_status AS ENUM ('in_stock', 'in_use', 'maintenance', 'broken', 'retired');
CREATE TYPE public.handover_type AS ENUM ('checkout', 'checkin');
CREATE TYPE public.motor_status AS ENUM ('in_stock', 'distributed', 'sold', 'registered');
CREATE TYPE public.customer_type AS ENUM ('dealer', 'corporate', 'retail');
CREATE TYPE public.registration_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.request_type AS ENUM ('leave', 'late_early', 'ot', 'correction');
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');

-- ==============================================================================
-- 2. CÁC BẢNG DANH MỤC GỐC (CORE TABLES)
-- ==============================================================================

-- Phòng ban
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dep_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES public.departments(id),
    manager_id UUID, -- Sẽ liên kết tới profiles sau
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_departments_parent_id ON public.departments(parent_id);

-- Hồ sơ người dùng (Hợp nhất)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    company_email VARCHAR(100) UNIQUE,
    department_id UUID REFERENCES public.departments(id),
    manager_id UUID REFERENCES public.profiles(id),
    role public.group_role NOT NULL DEFAULT 'employee',
    status public.user_status DEFAULT 'working',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_profiles_department_id ON public.profiles(department_id);
CREATE INDEX idx_profiles_manager_id ON public.profiles(manager_id);

-- Cập nhật khóa ngoại manager_id cho bảng departments
ALTER TABLE public.departments ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_id) REFERENCES public.profiles(id);

-- Khách hàng
CREATE TABLE public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_type public.customer_type NOT NULL DEFAULT 'retail',
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. PHÂN HỆ CHẤM CÔNG & ĐƠN TỪ
-- ==============================================================================

CREATE TABLE public.attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    check_in_lat NUMERIC, check_in_lng NUMERIC,
    check_out_lat NUMERIC, check_out_lng NUMERIC,
    check_in_photo_url TEXT,
    check_out_photo_url TEXT,
    accuracy NUMERIC,
    is_offline_sync BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) -- on_time, late, early_leave, missing
);
CREATE INDEX idx_attendances_user_id ON public.attendances(user_id);
CREATE INDEX idx_attendances_date ON public.attendances(date);

CREATE TABLE public.requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES public.profiles(id),
    type public.request_type NOT NULL,
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ NOT NULL,
    reason TEXT,
    status public.request_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_requests_user_id ON public.requests(user_id);
CREATE INDEX idx_requests_reviewer_id ON public.requests(reviewer_id);

-- ==============================================================================
-- 4. PHÂN HỆ QUẢN LÝ TÀI SẢN (CMDB)
-- ==============================================================================

CREATE TABLE public.asset_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE public.device_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.asset_groups(id),
    type_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    specs_schema JSONB DEFAULT '{}'
);
CREATE INDEX idx_device_types_group_id ON public.device_types(group_id);

CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    device_type_id UUID REFERENCES public.device_types(id),
    current_user_id UUID REFERENCES public.profiles(id),
    status public.asset_status DEFAULT 'in_stock',
    purchase_info JSONB DEFAULT '{}',
    specifications JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_assets_device_type_id ON public.assets(device_type_id);
CREATE INDEX idx_assets_current_user_id ON public.assets(current_user_id);

CREATE TABLE public.asset_handover_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES public.assets(id) NOT NULL,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    action_type public.handover_type NOT NULL,
    photo_url TEXT NOT NULL,
    condition_notes TEXT,
    action_date TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_asset_handover_logs_asset_id ON public.asset_handover_logs(asset_id);
CREATE INDEX idx_asset_handover_logs_user_id ON public.asset_handover_logs(user_id);

-- ==============================================================================
-- 5. PHÂN HỆ SẢN PHẨM & BẢO HÀNH
-- ==============================================================================

CREATE TABLE public.product_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    warranty_months INT NOT NULL DEFAULT 12,
    specifications JSONB DEFAULT '{}'
);

CREATE TABLE public.motors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    product_type_id UUID NOT NULL REFERENCES public.product_types(id),
    manufacture_date DATE NOT NULL,
    status public.motor_status NOT NULL DEFAULT 'in_stock',
    warranty_expiry_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_motors_product_type_id ON public.motors(product_type_id);

CREATE TABLE public.registrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    motor_id UUID NOT NULL REFERENCES public.motors(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    status public.registration_status NOT NULL DEFAULT 'pending',
    is_active BOOLEAN NOT NULL DEFAULT false,
    verified_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_registrations_motor_id ON public.registrations(motor_id);
CREATE INDEX idx_registrations_customer_id ON public.registrations(customer_id);
CREATE UNIQUE INDEX unique_active_registration ON public.registrations(motor_id) WHERE is_active = true;

-- ==============================================================================
-- 6. LOGS & GIÁM SÁT
-- ==============================================================================

CREATE TABLE public.scan_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    motor_id UUID NOT NULL REFERENCES public.motors(id) ON DELETE CASCADE,
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    latitude NUMERIC(10, 8), longitude NUMERIC(11, 8),
    device_info TEXT
);
CREATE INDEX idx_scan_logs_motor_id ON public.scan_logs(motor_id);

CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    action VARCHAR(20) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);

-- ==============================================================================
-- 7. TRIGGERS & LOGIC TỰ ĐỘNG
-- ==============================================================================

-- Hàm cập nhật updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upd_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_upd_assets BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Tự động tính ngày hết hạn bảo hành
CREATE OR REPLACE FUNCTION public.calculate_warranty_expiry()
RETURNS TRIGGER AS $$
DECLARE w_months INT;
BEGIN
    IF NEW.warranty_expiry_date IS NULL THEN
        SELECT warranty_months INTO w_months FROM public.product_types WHERE id = NEW.product_type_id;
        IF FOUND THEN NEW.warranty_expiry_date := NEW.manufacture_date + (w_months || ' months')::INTERVAL; END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_warranty BEFORE INSERT OR UPDATE ON public.motors FOR EACH ROW EXECUTE FUNCTION public.calculate_warranty_expiry();

-- Tự động cập nhật trạng thái tài sản khi bàn giao
CREATE OR REPLACE FUNCTION public.update_asset_status_on_handover()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.action_type = 'checkout' THEN
        UPDATE public.assets SET status = 'in_use', current_user_id = NEW.user_id WHERE id = NEW.asset_id;
    ELSIF NEW.action_type = 'checkin' THEN
        UPDATE public.assets SET status = 'in_stock', current_user_id = NULL WHERE id = NEW.asset_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handover_status AFTER INSERT ON public.asset_handover_logs FOR EACH ROW EXECUTE FUNCTION public.update_asset_status_on_handover();
```

---

## 4. BẢO MẬT & PHÂN QUYỀN (RLS POLICIES)

Hệ thống sử dụng hàm `get_current_user_role()` để kiểm tra quyền hạn của người dùng đang đăng nhập.

```sql
-- Bật RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;

-- Hàm lấy Role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$ SELECT role::text FROM public.profiles WHERE id = auth.uid(); $$ LANGUAGE sql SECURITY DEFINER;

-- Ví dụ Policy cho Assets
CREATE POLICY "Users view own assets" ON public.assets FOR SELECT USING (auth.uid() = current_user_id);
CREATE POLICY "Admins manage all assets" ON public.assets FOR ALL USING (public.get_current_user_role() IN ('admin', 'hr_admin'));
```

---

## 5. TỔNG KẾT ƯU ĐIỂM
1.  **Hiệu năng cao:** Nhờ hệ thống Index được thiết kế sẵn cho tất cả các Khóa ngoại.
2.  **Toàn vẹn dữ liệu:** Các ràng buộc `REFERENCES` và `ON DELETE CASCADE/RESTRICT` đảm bảo không có dữ liệu mồ côi.
3.  **Tự động hóa:** Giảm thiểu sai sót của con người thông qua Triggers (tự động đổi trạng thái máy, tự tính ngày bảo hành).
4.  **Khả năng mở rộng:** Cấu trúc JSONB cho phép bạn thêm bất kỳ thông số kỹ thuật nào cho Laptop, Máy in hay Động cơ mà không cần chạy lệnh `ALTER TABLE`.
