-- ==============================================================================
-- 1. KHỞI TẠO EXTENSIONS VÀ KIỂU DỮ LIỆU (ENUMS)
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Xóa các Type cũ nếu tồn tại để đảm bảo tính nhất quán
DROP TYPE IF EXISTS public.user_status CASCADE;
DROP TYPE IF EXISTS public.group_role CASCADE;
DROP TYPE IF EXISTS public.asset_status CASCADE;
DROP TYPE IF EXISTS public.handover_type CASCADE;
DROP TYPE IF EXISTS public.motor_status CASCADE;
DROP TYPE IF EXISTS public.customer_type CASCADE;
DROP TYPE IF EXISTS public.registration_status CASCADE;
DROP TYPE IF EXISTS public.request_type CASCADE;
DROP TYPE IF EXISTS public.request_status CASCADE;

-- Khởi tạo các ENUM
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

-- Hồ sơ người dùng (Hợp nhất Nhân sự & Tài khoản)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    company_email VARCHAR(100) UNIQUE,
    personal_email VARCHAR(100),
    department_id UUID REFERENCES public.departments(id),
    title VARCHAR(100),
    manager_id UUID REFERENCES public.profiles(id),
    role public.group_role NOT NULL DEFAULT 'employee',
    status public.user_status DEFAULT 'working',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cập nhật ràng buộc cho bảng departments
ALTER TABLE public.departments ADD CONSTRAINT fk_dept_manager FOREIGN KEY (manager_id) REFERENCES public.profiles(id);

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
-- 3. PHÂN HỆ CHẤM CÔNG & ĐƠN TỪ (ATTENDANCE)
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

-- ==============================================================================
-- 4. PHÂN HỆ QUẢN LÝ TÀI SẢN - CMDB (ASSETS)
-- ==============================================================================

CREATE TABLE public.asset_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE public.device_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES public.asset_groups(id),
    type_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    specs_schema JSONB DEFAULT '{}'
);

CREATE TABLE public.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    device_type_id UUID REFERENCES public.device_types(id),
    current_user_id UUID REFERENCES public.profiles(id),
    status public.asset_status DEFAULT 'in_stock',
    purchase_info JSONB DEFAULT '{}',
    specifications JSONB DEFAULT '{}',
    usage_location VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.asset_handover_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES public.assets(id) NOT NULL,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    action_type public.handover_type NOT NULL,
    photo_url TEXT NOT NULL,
    condition_notes TEXT,
    action_date TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. PHÂN HỆ SẢN PHẨM & BẢO HÀNH (WARRANTY)
-- ==============================================================================

CREATE TABLE public.product_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    warranty_months INT NOT NULL DEFAULT 12,
    specifications JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
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

CREATE TABLE public.registrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    motor_id UUID NOT NULL REFERENCES public.motors(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    status public.registration_status NOT NULL DEFAULT 'pending',
    is_active BOOLEAN NOT NULL DEFAULT false,
    verified_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX unique_active_registration ON public.registrations(motor_id) WHERE is_active = true;

CREATE TABLE public.maintenance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    motor_id UUID NOT NULL REFERENCES public.motors(id) ON DELETE CASCADE,
    service_type VARCHAR(100) NOT NULL,
    service_date DATE NOT NULL DEFAULT CURRENT_DATE,
    technician_name VARCHAR(255),
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. LOGS & GIÁM SÁT (MONITORING)
-- ==============================================================================

CREATE TABLE public.scan_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    motor_id UUID NOT NULL REFERENCES public.motors(id) ON DELETE CASCADE,
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    latitude NUMERIC(10, 8), longitude NUMERIC(11, 8),
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
-- 7. TỐI ƯU HÓA CHỈ MỤC (INDEXES FOR PERFORMANCE)
-- ==============================================================================

-- Core & HR
CREATE INDEX idx_profiles_dept ON public.profiles(department_id);
CREATE INDEX idx_profiles_mgr ON public.profiles(manager_id);
CREATE INDEX idx_dept_parent ON public.departments(parent_id);

-- Attendance & Requests
CREATE INDEX idx_att_user_date ON public.attendances(user_id, date);
CREATE INDEX idx_req_user ON public.requests(user_id);

-- Assets
CREATE INDEX idx_assets_type ON public.assets(device_type_id);
CREATE INDEX idx_assets_user ON public.assets(current_user_id);
CREATE INDEX idx_handover_asset ON public.asset_handover_logs(asset_id);
CREATE INDEX idx_handover_user ON public.asset_handover_logs(user_id);

-- Warranty
CREATE INDEX idx_motors_type ON public.motors(product_type_id);
CREATE INDEX idx_reg_motor ON public.registrations(motor_id);
CREATE INDEX idx_reg_customer ON public.registrations(customer_id);
CREATE INDEX idx_scan_motor ON public.scan_logs(motor_id);

-- Audit
CREATE INDEX idx_audit_time ON public.audit_logs(created_at);

-- ==============================================================================
-- 8. HÀM VÀ TRIGGERS TỰ ĐỘNG (AUTOMATION)
-- ==============================================================================

-- Hàm cập nhật updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upd_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_upd_assets BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_upd_motors BEFORE UPDATE ON public.motors FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

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

-- ==============================================================================
-- 9. BẢO MẬT CẤP DÒNG (ROW LEVEL SECURITY - RLS)
-- ==============================================================================

-- Bật RLS cho các bảng quan trọng
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Hàm hỗ trợ lấy Role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$ SELECT role::text FROM public.profiles WHERE id = auth.uid(); $$ LANGUAGE sql SECURITY DEFINER;

-- Policies cho Profiles
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL USING (public.get_current_user_role() IN ('admin', 'hr_admin'));

-- Policies cho Attendances
CREATE POLICY "Users view own attendance" ON public.attendances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "HR view all attendance" ON public.attendances FOR SELECT USING (public.get_current_user_role() IN ('admin', 'hr_admin'));

-- Policies cho Assets
CREATE POLICY "Users view assigned assets" ON public.assets FOR SELECT USING (auth.uid() = current_user_id);
CREATE POLICY "HR manage assets" ON public.assets FOR ALL USING (public.get_current_user_role() IN ('admin', 'hr_admin'));

-- Policies cho Registrations (Bảo hành)
CREATE POLICY "Public view active registrations" ON public.registrations FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage registrations" ON public.registrations FOR ALL USING (public.get_current_user_role() IN ('admin', 'staff'));

-- HOÀN TẤT
