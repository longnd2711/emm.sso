
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
-- STREAMING_CHUNK: Khởi tạo tiện ích và dọn dẹp cấu trúc cũ...
-- ==============================================================================
-- 1. DỌN DẸP & KHỞI TẠO TIỆN ÍCH
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Xóa cấu trúc cũ (nếu chạy lại script)
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.scan_logs CASCADE;
DROP TABLE IF EXISTS public.registrations CASCADE;
DROP TABLE IF EXISTS public.motors CASCADE;
DROP TABLE IF EXISTS public.product_types CASCADE;
DROP TABLE IF EXISTS public.asset_handover_logs CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.requests CASCADE;
DROP TABLE IF EXISTS public.attendances CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;

-- STREAMING_CHUNK: Định nghĩa các kiểu dữ liệu ENUM...
-- Xóa và tạo lại ENUMs
DROP TYPE IF EXISTS public.user_status CASCADE;
DROP TYPE IF EXISTS public.group_role CASCADE;
DROP TYPE IF EXISTS public.asset_status CASCADE;
DROP TYPE IF EXISTS public.handover_type CASCADE;
DROP TYPE IF EXISTS public.motor_status CASCADE;
DROP TYPE IF EXISTS public.registration_status CASCADE;

CREATE TYPE public.user_status AS ENUM ('working', 'resigned');
CREATE TYPE public.group_role AS ENUM ('employee', 'manager', 'hr_admin', 'admin', 'staff', 'technician');
CREATE TYPE public.asset_status AS ENUM ('in_stock', 'in_use', 'maintenance', 'broken', 'retired');
CREATE TYPE public.handover_type AS ENUM ('checkout', 'checkin');
CREATE TYPE public.motor_status AS ENUM ('in_stock', 'distributed', 'sold', 'registered');
CREATE TYPE public.registration_status AS ENUM ('pending', 'approved', 'rejected');

-- STREAMING_CHUNK: Tạo bảng phòng ban và hồ sơ người dùng...
-- ==============================================================================
-- 2. TẠO CÁC BẢNG CỐT LÕI
-- ==============================================================================

-- Bảng Phòng ban
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dep_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    manager_id UUID, -- Sẽ liên kết tới profiles sau
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng Hồ sơ người dùng
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    company_email VARCHAR(100) UNIQUE,
    department_id UUID CONSTRAINT profiles_department_id_fkey REFERENCES public.departments(id) ON DELETE SET NULL,
    title VARCHAR(100),
    manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    role public.group_role NOT NULL DEFAULT 'employee',
    app_permissions JSONB DEFAULT '{}'::jsonb,
    status public.user_status DEFAULT 'working',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cập nhật ràng buộc manager cho departments
ALTER TABLE public.departments ADD CONSTRAINT departments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- STREAMING_CHUNK: Tạo các bảng nghiệp vụ (Chấm công, Tài sản)...
-- Các bảng nghiệp vụ khác (Attendances, Assets...)
CREATE TABLE public.attendances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    check_in_lat NUMERIC, check_in_lng NUMERIC,
    check_in_photo_url TEXT,
    is_offline_sync BOOLEAN DEFAULT FALSE
);

CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    status public.asset_status DEFAULT 'in_stock',
    current_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    specifications JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.asset_handover_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type public.handover_type NOT NULL,
    photo_url TEXT NOT NULL,
    action_date TIMESTAMPTZ DEFAULT NOW()
);

-- STREAMING_CHUNK: Thiết lập tự động cập nhật trường updated_at...
-- ==============================================================================
-- 3. XỬ LÝ TỰ ĐỘNG CẬP NHẬT CỘT UPDATED_AT
-- ==============================================================================

-- Tạo một hàm Trigger dùng chung cho toàn bộ hệ thống
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gắn Trigger vào các bảng có cột updated_at
CREATE TRIGGER set_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER set_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TRIGGER set_assets_updated_at
BEFORE UPDATE ON public.assets
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- STREAMING_CHUNK: Định nghĩa các hàm bảo mật và bật RLS...
-- ==============================================================================
-- 4. HÀM BẢO MẬT & RLS (CHỐNG VÒNG LẶP VÔ HẠN)
-- ==============================================================================

-- Hàm đặc quyền kiểm tra Admin (SECURITY DEFINER lách qua RLS)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (SELECT (role = 'admin') FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bật RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Policies cho Profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_admin" ON public.profiles FOR ALL TO authenticated USING (public.check_is_admin());

-- Policies cho Departments
CREATE POLICY "depts_select" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "depts_admin" ON public.departments FOR ALL TO authenticated USING (public.check_is_admin());

-- STREAMING_CHUNK: Chèn dữ liệu ban đầu và hàm tạo user...
-- ==============================================================================
-- 5. DỮ LIỆU BAN ĐẦU (ROOT DEPARTMENT)
-- ==============================================================================
INSERT INTO public.departments (dep_code, name)
VALUES ('HEMEMM', 'CÔNG TY CỔ PHẦN CHẾ TẠO ĐIỆN CƠ HEM');

-- ==============================================================================
-- 6. HÀM ĐẶC QUYỀN: TẠO USER TỪ TRANG ADMIN (RPC)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_create_user(
    email TEXT, password TEXT, full_name TEXT, emp_code TEXT, dept_id UUID, user_role public.group_role
) RETURNS UUID AS $$
DECLARE new_user_id UUID;
BEGIN
  IF NOT public.check_is_admin() THEN RAISE EXCEPTION 'Permission Denied'; END IF;

  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', email, crypt(password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', full_name), now(), now())
  RETURNING id INTO new_user_id;

  INSERT INTO public.profiles (id, employee_code, full_name, company_email, department_id, role, app_permissions)
  VALUES (new_user_id, emp_code, full_name, email, dept_id, user_role, '{"taisan":"admin","chamcong":"admin","lichhop":"admin","tracuu":"admin"}'::jsonb);

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---
**tiếp theo: tạo admin trong authentication của supabase và chạy thêm admin.**
```sql
-- STREAMING_CHUNK: Tạo hồ sơ cho tài khoản Admin Auth...
-- ==============================================================================
-- BƯỚC 3: CẤP QUYỀN ADMIN TỐI CAO CHO TÀI KHOẢN (Chạy sau Bước 2)
-- ==============================================================================

-- CHÚ Ý: Hãy thay 'ID_CUA_BAN_TAI_DAY' bằng mã UUID bạn vừa copy ở Authentication (Bước 2)
-- LƯU Ý: Phải thay ở CẢ 2 NƠI (trong lệnh INSERT và lệnh UPDATE bên dưới)

INSERT INTO public.profiles (
    id, 
    employee_code, 
    full_name, 
    role, 
    status, 
    department_id,
    app_permissions
)
VALUES (
    'ID_CUA_BAN_TAI_DAY', 
    'EMM-ADMIN', 
    'Quản trị viên hệ thống', 
    'admin', 
    'working',
    (SELECT id FROM public.departments WHERE dep_code = 'HEMEMM' LIMIT 1),
    '{"ungdung": "admin", "taisan": "admin", "chamcong": "admin", "lichhop": "admin", "tracuu": "admin", "sanxuat": "admin"}'::jsonb
)
ON CONFLICT (id) DO UPDATE 
SET 
    role = EXCLUDED.role,
    app_permissions = EXCLUDED.app_permissions;

-- STREAMING_CHUNK: Gắn Admin làm trưởng phòng ban gốc...
-- Cập nhật bạn làm trưởng phòng ban gốc (HEMEMM)
UPDATE public.departments 
SET manager_id = 'ID_CUA_BAN_TAI_DAY' 
WHERE dep_code = 'HEMEMM';
```
**done**
