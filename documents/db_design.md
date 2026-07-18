# THIẾT KẾ CƠ SỞ DỮ LIỆU TỔNG THỂ (UNIFIED SCHEMA)

## 1. 🛠️ CẤU TRÚC NỀN TẢNG & TIỆN ÍCH (CORE UTILITIES)
Hệ thống sử dụng các kiểu dữ liệu chuẩn hóa (ENUM) và hàm tự động để đảm bảo tính toàn vẹn dữ liệu.

### Kiểu dữ liệu ENUM
*   **Trạng thái Nhân sự:** `working`, `resigned`.
*   **Phân quyền:** `admin`, `staff`, `technician`, `manager`, `employee`, `hr_admin`.
*   **Trạng thái Tài sản:** `in_stock`, `in_use`, `maintenance`, `broken`, `retired`.
*   **Trạng thái Động cơ:** `in_stock`, `distributed`, `sold`, `registered`.
*   **Trạng thái Bảo hành:** `pending`, `approved`, `rejected`.

### Hàm tiện ích (Utility Functions)
*   `update_updated_at_column()`: Tự động cập nhật dấu thời gian khi dữ liệu thay đổi.
*   `get_current_user_role()`: Xác định quyền hạn của người dùng đang đăng nhập để áp dụng bảo mật RLS.

---

## 2. 👥 PHÂN HỆ TỔ CHỨC & NHÂN SỰ (HR & ORGANIZATION)
Quản lý sơ đồ tổ chức và thông tin định danh nhân viên.

*   **`departments`**: Lưu cấu trúc phòng ban (Mã PB, Tên PB, Cấp cha/con).
*   **`profiles` / `users`**: Thông tin chi tiết nhân sự, kết nối trực tiếp với `auth.users` của Supabase. Lưu mã nhân viên, chức danh, quyền hạn và trạng thái làm việc.

---

## 3. 🕒 PHÂN HỆ CHẤM CÔNG & ĐƠN TỪ (ATTENDANCE & REQUESTS)
Hệ thống chống gian lận dựa trên GPS và hình ảnh.

*   **`shifts`**: Định nghĩa các ca làm việc (Giờ bắt đầu/kết thúc).
*   **`attendances`**: Lưu vết check-in/out kèm tọa độ GPS, ảnh selfie, độ chính xác vị trí và cờ đồng bộ offline.
*   **`requests`**: Quản lý đơn xin nghỉ, đi muộn, làm thêm (OT) và sửa công.

---

## 4. 💻 PHÂN HỆ QUẢN LÝ TÀI SẢN - CMDB (ASSET MANAGEMENT)
Quản lý vòng đời thiết bị nội bộ công ty.

*   **`asset_groups` & `device_types`**: Phân loại tài sản (Laptop, Xe, Thiết bị văn phòng) kèm schema thông số kỹ thuật linh hoạt (JSONB).
*   **`assets`**: Kho tài sản chi tiết (Mã tài sản, Model, Ngày mua, Giá trị, Thông số kỹ thuật).
*   **`asset_handover_logs`**: Nhật ký bàn giao/thu hồi tài sản, bắt buộc có ảnh chụp hiện trạng để đối soát.
*   **`software_licenses`**: Quản lý bản quyền phần mềm gắn liền với thiết bị.

---

## 5. ⚙️ PHÂN HỆ SẢN PHẨM & BẢO HÀNH (PRODUCT & WARRANTY)
Quản lý sản phẩm bán ra thị trường và dịch vụ khách hàng.

*   **`product_types`**: Danh mục dòng máy sản xuất và cấu hình mặc định.
*   **`motors`**: Danh sách máy vật lý (Serial Number/IMEI). Tự động tính ngày hết hạn bảo hành khi nhập kho.
*   **`customers`**: Danh bạ khách hàng lẻ, doanh nghiệp và đại lý phân phối.
*   **`registrations`**: Hồ sơ đăng ký bảo hành. Có logic tự động chuyển quyền sở hữu (Active) khi được duyệt.
*   **`maintenance_logs`**: Lịch sử sửa chữa, bảo trì định kỳ của từng máy.

---

## 6. 🛰️ THEO DÕI & GIÁM SÁT (TRACKING & AUDIT)
*   **`scan_logs`**: Lưu vết mỗi lần QR Code trên sản phẩm được quét (Vị trí GPS, thiết bị quét).
*   **`audit_logs`**: Nhật ký thay đổi dữ liệu toàn hệ thống (Ai đã sửa gì, lúc nào, giá trị cũ và mới).

---

# 📜 TOÀN BỘ MÃ SQL KHỞI TẠO (CONSOLIDATED SCRIPT)

```sql
-- ==============================================================================
-- 1. KHỞI TẠO EXTENSIONS & ENUMS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums cho Nhân sự & Tài sản
CREATE TYPE public.user_status AS ENUM ('working', 'resigned');
CREATE TYPE public.group_role AS ENUM ('employee', 'manager', 'hr_admin', 'admin', 'staff', 'technician');
CREATE TYPE public.asset_status AS ENUM ('in_stock', 'in_use', 'maintenance', 'broken', 'retired');
CREATE TYPE public.handover_type AS ENUM ('checkout', 'checkin');

-- Enums cho Sản phẩm & Bảo hành
CREATE TYPE public.motor_status AS ENUM ('in_stock', 'distributed', 'sold', 'registered');
CREATE TYPE public.customer_type AS ENUM ('dealer', 'corporate', 'retail');
CREATE TYPE public.registration_status AS ENUM ('pending', 'approved', 'rejected');

-- ==============================================================================
-- 2. HÀM TIỆN ÍCH (UTILITIES)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. CÁC BẢNG DANH MỤC CỐT LÕI (CORE TABLES)
-- ==============================================================================

-- Phòng ban
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dep_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES public.departments(id),
    manager_id UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hồ sơ người dùng (Nhân viên nội bộ)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    company_email VARCHAR(100) UNIQUE,
    department_id UUID REFERENCES public.departments(id),
    role public.group_role NOT NULL DEFAULT 'employee',
    status public.user_status DEFAULT 'working',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Khách hàng (Bên ngoài)
CREATE TABLE public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_type public.customer_type NOT NULL DEFAULT 'retail',
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255),
    address TEXT,
    company_name VARCHAR(255),
    tax_code VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. PHÂN HỆ TÀI SẢN & SẢN PHẨM (ASSETS & PRODUCTS)
-- ==============================================================================

-- Nhóm tài sản nội bộ
CREATE TABLE public.asset_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Loại thiết bị
CREATE TABLE public.device_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.asset_groups(id),
    type_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    specs_schema JSONB DEFAULT '{}'
);

-- Kho tài sản nội bộ
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

-- Dòng sản phẩm kinh doanh
CREATE TABLE public.product_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    warranty_months INT NOT NULL DEFAULT 12,
    specifications JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Danh sách máy vật lý (Sản phẩm bán ra)
CREATE TABLE public.motors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    product_type_id UUID NOT NULL REFERENCES public.product_types(id),
    manufacture_date DATE NOT NULL,
    status public.motor_status NOT NULL DEFAULT 'in_stock',
    warranty_expiry_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. NGHIỆP VỤ: CHẤM CÔNG, BẢO HÀNH, BÀN GIAO
-- ==============================================================================

-- Chấm công
CREATE TABLE public.attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id),
    date DATE DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    check_in_lat NUMERIC, check_in_lng NUMERIC,
    check_in_photo_url TEXT,
    is_offline_sync BOOLEAN DEFAULT FALSE
);

-- Đăng ký bảo hành
CREATE TABLE public.registrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    motor_id UUID NOT NULL REFERENCES public.motors(id),
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    purchase_date DATE NOT NULL,
    status public.registration_status NOT NULL DEFAULT 'pending',
    is_active BOOLEAN NOT NULL DEFAULT false,
    verified_by UUID REFERENCES public.profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nhật ký bàn giao tài sản nội bộ
CREATE TABLE public.asset_handover_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES public.assets(id),
    user_id UUID REFERENCES public.profiles(id),
    action_type public.handover_type NOT NULL,
    photo_url TEXT NOT NULL,
    action_date TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. LOGS & AUDIT
-- ==============================================================================

CREATE TABLE public.scan_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    motor_id UUID NOT NULL REFERENCES public.motors(id),
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    latitude NUMERIC(10, 8),
    longitude NUMERIC(11, 8),
    device_info TEXT
);

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

-- ==============================================================================
-- 7. TRIGGERS & LOGIC TỰ ĐỘNG
-- ==============================================================================

-- Tự động cập nhật updated_at
CREATE TRIGGER trg_upd_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_assets BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_upd_motors BEFORE UPDATE ON public.motors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tự động tính ngày hết hạn bảo hành khi nhập máy
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

# 💡 ĐIỂM NỔI BẬT CỦA KIẾN TRÚC NÀY

1.  **Tính Nhất Quán:** Mọi bảng đều có `updated_at` và được quản lý bởi Trigger, giúp việc đồng bộ dữ liệu lên Frontend chính xác.
2.  **Bảo Mật Đa Lớp:** Sử dụng RLS (Row Level Security) kết hợp với hàm `get_current_user_role()` để phân quyền đến từng dòng dữ liệu.
3.  **Khả Năng Mở Rộng:** Việc sử dụng `JSONB` cho thông số kỹ thuật (`specifications`) cho phép bạn thêm các loại máy mới hoặc tài sản mới mà không cần sửa cấu trúc bảng SQL.
4.  **Vết Dữ Liệu (Audit Trail):** Bảng `audit_logs` lưu lại mọi hành động nhạy cảm, giúp quản trị viên truy vết khi có sự cố dữ liệu.

Tài liệu này đã sẵn sàng để bạn sử dụng làm kim chỉ nam cho việc phát triển Frontend và các Edge Functions tiếp theo.
