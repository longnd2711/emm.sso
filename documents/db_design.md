
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
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Xóa toàn bộ cấu trúc cũ để làm mới (Thứ tự xóa từ bảng con đến bảng cha)
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

-- Bảng Phòng ban (Sơ đồ đa cấp)
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dep_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    manager_id UUID, -- Sẽ liên kết tới profiles sau
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng Hồ sơ người dùng (Hợp nhất quyền JSONB)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    company_email VARCHAR(100) UNIQUE,
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
-- 4. TỐI ƯU HÓA CHỈ MỤC & TỰ ĐỘNG HÓA
-- ==============================================================================

CREATE INDEX idx_profiles_dept ON public.profiles(department_id);
CREATE INDEX idx_profiles_permissions ON public.profiles USING GIN (app_permissions);
CREATE INDEX idx_dept_parent ON public.departments(parent_id);
CREATE INDEX idx_att_user_date ON public.attendances(user_id, date);

-- Hàm cập nhật updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upd_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_upd_depts BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Tự động cập nhật trạng thái tài sản
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
-- 5. BẢO MẬT RLS (SỬA LỖI VÒNG LẶP)
-- ==============================================================================

-- Bật RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Hàm lấy Role an toàn (Dùng SECURITY DEFINER để lách RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Policies cho Departments
CREATE POLICY "Select_Depts" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin_Depts" ON public.departments FOR ALL TO authenticated USING (public.get_my_role() = 'admin');

-- Policies cho Profiles
CREATE POLICY "Select_Profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Update_Own_Profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admin_Profiles" ON public.profiles FOR ALL TO authenticated USING (public.get_my_role() = 'admin');

-- ==============================================================================
-- 6. HÀM ĐẶC QUYỀN: TẠO USER TỪ TRANG ADMIN (RPC)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_create_user(
    email TEXT,
    password TEXT,
    full_name TEXT,
    emp_code TEXT,
    dept_id UUID,
    user_role public.group_role
) RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Kiểm tra quyền Admin
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Chỉ Admin mới có quyền tạo nhân viên!';
  END IF;

  -- 1. Tạo tài khoản Auth
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    email,
    crypt(password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', full_name),
    now(), now(), '', ''
  ) RETURNING id INTO new_user_id;

  -- 2. Tạo hồ sơ Profile
  INSERT INTO public.profiles (id, employee_code, full_name, company_email, department_id, role)
  VALUES (new_user_id, emp_code, full_name, email, dept_id, user_role);

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---
**tiếp theo: tạo admin trong authentication của supabase và chạy thêm admin.**
```sql
-- 1. Tạo phòng ban Admin
INSERT INTO public.departments (dep_code, name)
VALUES ('ADMIN_DEPT', 'BAN QUẢN TRỊ HỆ THỐNG')
ON CONFLICT DO NOTHING;

-- 2. Cấp quyền Admin tối cao cho bạn
-- THAY 'ID_CỦA_BẠN' bằng mã UUID copy từ bước trên
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
    'ID_CỦA_BẠN', 
    'HEM-ADMIN-01', 
    'Super Admin HEM', 
    'admin', 
    'working',
    (SELECT id FROM public.departments WHERE dep_code = 'ADMIN_DEPT' LIMIT 1),
    '{"taisan": "admin", "chamcong": "admin", "lichhop": "admin", "tracuu": "admin", "sanxuat": "admin"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```
**done**
