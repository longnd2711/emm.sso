
# 🏗️ THIẾT KẾ CƠ SỞ DỮ LIỆU TỔNG THỂ: HEM EMM

## 1. NGUYÊN TẮC CẤU TRÚC
*   **Định danh:** Sử dụng `UUID v4` làm Khóa chính (PK) cho tất cả các bảng.
*   **Quan hệ:** Sử dụng Khóa ngoại (FK) chặt chẽ với các ràng buộc `ON DELETE RESTRICT` hoặc `CASCADE` tùy theo nghiệp vụ.
*   **Linh hoạt:** Tận dụng kiểu dữ liệu `JSONB` để quản lý quyền hạn ứng dụng, thông số kỹ thuật tài sản và thông tin mua sắm.
*   **Hiệu năng:** Đánh chỉ mục (Index) cho 100% Khóa ngoại và các trường tìm kiếm trọng yếu.

## 2. CHI TIẾT CÁC PHÂN HỆ DỮ LIỆU

### 2.1. Phân hệ Nhân sự & Tổ chức (Core HR)
*   **`profiles`**: Hợp nhất thông tin định danh và quyền hạn.
    *   `app_permissions`: Lưu trữ quyền chi tiết cho từng phân hệ (Ví dụ: `{"taisan": "admin", "chamcong": "employee"}`).
*   **`departments`**: Cấu trúc cây (Tree) cho sơ đồ tổ chức công ty.
    *   `parent_id`: Tham chiếu ngược lại chính bảng `departments`.
    *   `manager_id`: Tham chiếu đến `profiles` (Trưởng phòng).

### 2.2. Phân hệ Nghiệp vụ Nội bộ (Internal Operations)
*   **`attendances`**: Chấm công GPS & Hình ảnh.
*   **`requests`**: Đơn từ nghỉ phép, OT, sửa công.
*   **`assets`**: Quản lý tài sản (CMDB) với thông số linh hoạt qua JSONB.
*   **`asset_handover_logs`**: Nhật ký giao nhận thiết bị kèm bằng chứng ảnh.

### 2.3. Phân hệ Sản phẩm & Khách hàng (Product & CRM)
*   **`product_types`**: Danh mục dòng máy.
*   **`motors`**: Danh sách máy vật lý (Serial Number).
*   **`customers`**: Danh sách khách hàng và đại lý.
*   **`registrations`**: Kích hoạt bảo hành và xác nhận sở hữu.
*   **`scan_logs`**: Vết quét QR Code trên sản phẩm.

---

## 3. KHỐI LỆNH SQL KHỞI TẠO DUY NHẤT (MASTER SQL SCRIPT)

```sql
-- ==============================================================================
-- 1. DỌN DẸP & KHỞI TẠO EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Xóa các bảng cũ để tránh xung đột ràng buộc (Thứ tự xóa từ bảng con đến bảng cha)
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.scan_logs CASCADE;
DROP TABLE IF EXISTS public.maintenance_logs CASCADE;
DROP TABLE IF EXISTS public.registrations CASCADE;
DROP TABLE IF EXISTS public.motors CASCADE;
DROP TABLE IF EXISTS public.product_types CASCADE;
DROP TABLE IF EXISTS public.asset_handover_logs CASCADE;
DROP TABLE IF EXISTS public.software_licenses CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.device_types CASCADE;
DROP TABLE IF EXISTS public.asset_groups CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.requests CASCADE;
DROP TABLE IF EXISTS public.attendances CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- Xóa và tạo lại các kiểu dữ liệu ENUM
DROP TYPE IF EXISTS public.user_status CASCADE;
DROP TYPE IF EXISTS public.group_role CASCADE;
DROP TYPE IF EXISTS public.asset_status CASCADE;
DROP TYPE IF EXISTS public.handover_type CASCADE;
DROP TYPE IF EXISTS public.motor_status CASCADE;
DROP TYPE IF EXISTS public.customer_type CASCADE;
DROP TYPE IF EXISTS public.registration_status CASCADE;
DROP TYPE IF EXISTS public.request_type CASCADE;
DROP TYPE IF EXISTS public.request_status CASCADE;

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

-- Phòng ban (Sơ đồ đa cấp)
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dep_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    manager_id UUID, -- Sẽ liên kết tới profiles sau
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hồ sơ người dùng (Hợp nhất quyền JSONB)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    company_email VARCHAR(100) UNIQUE,
    personal_email VARCHAR(100),
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    title VARCHAR(100),
    manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    role public.group_role NOT NULL DEFAULT 'employee',
    app_permissions JSONB DEFAULT '{
        "lichhop": "employee",
        "taisan": "none",
        "chamcong": "employee",
        "tracuu": "viewer",
        "sanxuat": "none"
    }'::jsonb,
    status public.user_status DEFAULT 'working',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ràng buộc Trưởng phòng cho bảng departments
ALTER TABLE public.departments ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Khách hàng & Đại lý
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
-- 3. PHÂN HỆ NGHIỆP VỤ (OPERATIONS)
-- ==============================================================================

-- Chấm công
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
    status VARCHAR(50)
);

-- Đơn từ
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

-- Tài sản (CMDB)
CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    status public.asset_status DEFAULT 'in_stock',
    current_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    purchase_info JSONB DEFAULT '{}',
    specifications JSONB DEFAULT '{}',
    usage_location VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nhật ký bàn giao
CREATE TABLE public.asset_handover_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type public.handover_type NOT NULL,
    photo_url TEXT NOT NULL,
    condition_notes TEXT,
    action_date TIMESTAMPTZ DEFAULT NOW(),
    performed_by UUID REFERENCES public.profiles(id)
);

-- ==============================================================================
-- 4. PHÂN HỆ SẢN PHẨM & BẢO HÀNH (WARRANTY)
-- ==============================================================================

CREATE TABLE public.product_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    warranty_months INT NOT NULL DEFAULT 12,
    specifications JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.motors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    serial_number VARCHAR(100) NOT NULL UNIQUE,
    product_type_id UUID NOT NULL REFERENCES public.product_types(id),
    manufacture_date DATE NOT NULL,
    status public.motor_status NOT NULL DEFAULT 'in_stock',
    warranty_expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.registrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    motor_id UUID NOT NULL REFERENCES public.motors(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    purchase_date DATE NOT NULL,
    status public.registration_status NOT NULL DEFAULT 'pending',
    is_active BOOLEAN NOT NULL DEFAULT false,
    verified_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX unique_active_registration ON public.registrations(motor_id) WHERE is_active = true;

-- Nhật ký Audit
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
-- 5. TỐI ƯU HÓA CHỈ MỤC (INDEXES)
-- ==============================================================================

CREATE INDEX idx_profiles_dept ON public.profiles(department_id);
CREATE INDEX idx_profiles_mgr ON public.profiles(manager_id);
CREATE INDEX idx_profiles_permissions ON public.profiles USING GIN (app_permissions);
CREATE INDEX idx_dept_parent ON public.departments(parent_id);
CREATE INDEX idx_att_user_date ON public.attendances(user_id, date);
CREATE INDEX idx_assets_user ON public.assets(current_user_id);
CREATE INDEX idx_handover_asset ON public.asset_handover_logs(asset_id);
CREATE INDEX idx_motors_type ON public.motors(product_type_id);
CREATE INDEX idx_reg_motor ON public.registrations(motor_id);
CREATE INDEX idx_audit_time ON public.audit_logs(created_at);

-- ==============================================================================
-- 6. HÀM VÀ TRIGGERS TỰ ĐỘNG (AUTOMATION)
-- ==============================================================================

-- 1. Cập nhật updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upd_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_upd_depts BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_upd_assets BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Tự động tính ngày bảo hành
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

-- 3. Tự động cập nhật trạng thái tài sản
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

-- ==============================================================================
-- 7. BẢO MẬT CẤP DÒNG (RLS POLICIES) - SỬA LỖI ADMIN VIOLATION
-- ==============================================================================

-- Bật RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Hàm lấy Role an toàn
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- --- POLICIES CHO DEPARTMENTS ---
CREATE POLICY "Allow authenticated select depts" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin manage depts" ON public.departments FOR ALL TO authenticated 
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- --- POLICIES CHO PROFILES ---
CREATE POLICY "Allow authenticated select profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Allow admin manage all profiles" ON public.profiles FOR ALL TO authenticated 
USING (public.get_current_user_role() = 'admin')
WITH CHECK (public.get_current_user_role() = 'admin');

-- --- POLICIES CHO ATTENDANCES ---
CREATE POLICY "Users view own attendance" ON public.attendances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin/HR view all attendance" ON public.attendances FOR SELECT TO authenticated 
USING (public.get_current_user_role() IN ('admin', 'hr_admin'));

-- --- POLICIES CHO ASSETS ---
CREATE POLICY "Users view assigned assets" ON public.assets FOR SELECT TO authenticated USING (auth.uid() = current_user_id);
CREATE POLICY "Admin/HR manage assets" ON public.assets FOR ALL TO authenticated 
USING (public.get_current_user_role() IN ('admin', 'hr_admin'));
```

---
**Hết bản Thiết kế Cơ sở dữ liệu.**
