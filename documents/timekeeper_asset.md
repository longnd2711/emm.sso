Chào bạn, với tư cách là Kiến trúc sư Phần mềm, tôi đã tiến hành hợp nhất **Đặc tả Hệ thống ban đầu** và **Từ điển dữ liệu CMDB** để tạo ra một thiết kế cơ sở dữ liệu (Database Schema) tối ưu, chuẩn hóa và có khả năng mở rộng cao trên Supabase.

Dưới đây là bản thiết kế chi tiết cuối cùng cho toàn bộ hệ thống.

---

# 🏗️ THIẾT KẾ CƠ SỞ DỮ LIỆU TỔNG THỂ (REVISED SCHEMA)

## 1. Phân hệ Tổ chức & Nhân sự (Core & HR)
Phân hệ này kết hợp thông tin định danh của Supabase Auth với dữ liệu nhân sự chi tiết.

### Bảng `departments` (Phòng ban)
*   `id`: UUID (PK)
*   `dep_code`: Varchar(20) (Unique) - Mã phòng ban (IT_DEPT, HR_DEPT).
*   `name`: Varchar(100) - Tên phòng ban.
*   `parent_id`: UUID (FK) - Tham chiếu `departments.id` (Cấu trúc cây).
*   `manager_id`: UUID (FK) - Người đứng đầu (Tham chiếu `profiles.id`).

### Bảng `profiles` (Hồ sơ nhân viên)
*   `id`: UUID (PK) - Map 1:1 với `auth.users.id`.
*   `employee_code`: Varchar(20) (Unique) - Mã nhân viên (HR cấp).
*   `full_name`: Varchar(100).
*   `phone_number`: Varchar(15) - Regex kiểm tra định dạng VN.
*   `company_email`: Varchar(100) (Unique).
*   `personal_email`: Varchar(100).
*   `department_id`: UUID (FK) - Tham chiếu `departments.id`.
*   `title`: Varchar(100) - Chức danh.
*   `manager_id`: UUID (FK) - Người quản lý trực tiếp (Tham chiếu `profiles.id`).
*   `group_role`: Enum ('employee', 'manager', 'hr_admin', 'admin').
*   `status`: Enum ('working', 'resigned').
*   `avatar_url`: Text.

---

## 2. Phân hệ Chấm công & Đơn từ (Attendance & Requests)

### Bảng `shifts` (Ca làm việc)
*   `id`: UUID (PK).
*   `name`: Varchar(100).
*   `start_time`: Time.
*   `end_time`: Time.

### Bảng `attendances` (Dữ liệu chấm công)
*   `id`: UUID (PK).
*   `user_id`: UUID (FK) -> `profiles.id`.
*   `date`: Date.
*   `check_in_time`: Timestamptz.
*   `check_out_time`: Timestamptz.
*   `check_in_lat`, `check_in_lng`, `check_out_lat`, `check_out_lng`: Numeric.
*   `check_in_photo_url`, `check_out_photo_url`: Text.
*   `accuracy`: Numeric (Độ chính xác GPS).
*   `is_offline_sync`: Boolean (Mặc định: false).
*   `status`: Enum ('on_time', 'late', 'early_leave', 'missing').

### Bảng `requests` (Quản lý đơn từ)
*   `id`: UUID (PK).
*   `user_id`: UUID (FK).
*   `reviewer_id`: UUID (FK).
*   `type`: Enum ('leave', 'late_early', 'ot', 'correction').
*   `start_datetime`, `end_datetime`: Timestamptz.
*   `reason`: Text.
*   `status`: Enum ('pending', 'approved', 'rejected').

---

## 3. Phân hệ Quản lý Tài sản & CMDB (Asset Management)
Đây là phần nâng cấp mạnh mẽ dựa trên file CMDB bạn cung cấp.

### Bảng `asset_groups` (Nhóm tài sản)
*   `id`: UUID (PK).
*   `group_code`: Varchar(20) (Unique) - VD: TSCD_HH.
*   `name`: Varchar(100).
*   `description`: Text.
*   `is_active`: Boolean.

### Bảng `device_types` (Loại thiết bị)
*   `id`: UUID (PK).
*   `group_id`: UUID (FK) -> `asset_groups.id`.
*   `type_code`: Varchar(20) (Unique) - VD: LPT (Laptop).
*   `name`: Varchar(100).
*   `specs_schema`: JSONB - Định nghĩa các trường bắt buộc cho loại này (VD: {"ram": "required"}).

### Bảng `suppliers` (Nhà cung cấp)
*   `id`: UUID (PK).
*   `company_name`: Varchar(255).
*   `tax_id`: Varchar(50).
*   `bank_info`: JSONB - Lưu {bank_name, account_number}.
*   `is_active`: Boolean.

### Bảng `assets` (Kho tài sản chi tiết)
*   `id`: UUID (PK).
*   `asset_code`: Varchar(50) (Unique) - Mã dán trên thiết bị.
*   `device_type_id`: UUID (FK) -> `device_types.id`.
*   `current_user_id`: UUID (FK, Nullable) -> `profiles.id`.
*   `usage_location`: Varchar(255).
*   `status`: Enum ('in_stock', 'in_use', 'maintenance', 'broken', 'retired').
*   `purchase_info`: JSONB - Lưu {brand_model, purchase_date, supplier_id, original_cost, sn_st, warranty_expiry}.
*   `specifications`: JSONB - Lưu thông số kỹ thuật thực tế (RAM, CPU, MAC address...).

### Bảng `software_licenses` (Bản quyền phần mềm)
*   `id`: UUID (PK).
*   `software_name`: Varchar(150).
*   `software_type`: Varchar(50).
*   `attached_device_id`: UUID (FK, Nullable) -> `assets.id`.
*   `license_key`: Varchar(255) (Unique).
*   `expiration_date`: Date.
*   `purchase_info`: JSONB.

### Bảng `asset_handover_logs` (Nhật ký bàn giao & Đối soát ảnh)
*   `id`: UUID (PK).
*   `asset_id`: UUID (FK) -> `assets.id`.
*   `user_id`: UUID (FK) -> `profiles.id` (Người nhận/trả).
*   `action_type`: Enum ('checkout', 'checkin').
*   `action_date`: Timestamptz (Default: now()).
*   `condition_notes`: Text.
*   `photo_url`: Text (Bắt buộc - Ảnh chụp hiện trạng lúc bàn giao/thu hồi).
*   `performed_by`: UUID (FK) -> `profiles.id` (Người thực hiện thao tác - HR/Admin).

---

# 🛠️ SQL SCRIPT KHỞI TẠO (SUPABASE)

Bạn có thể copy đoạn mã này vào SQL Editor của Supabase để khởi tạo cấu trúc:

```sql
-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Enums
CREATE TYPE user_status AS ENUM ('working', 'resigned');
CREATE TYPE group_role AS ENUM ('employee', 'manager', 'hr_admin', 'admin');
CREATE TYPE asset_status AS ENUM ('in_stock', 'in_use', 'maintenance', 'broken', 'retired');
CREATE TYPE handover_type AS ENUM ('checkout', 'checkin');

-- 3. Tables
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dep_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES departments(id),
    manager_id UUID
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code VARCHAR(20) UNIQUE,
    full_name VARCHAR(100),
    phone_number VARCHAR(15),
    company_email VARCHAR(100) UNIQUE,
    department_id UUID REFERENCES departments(id),
    title VARCHAR(100),
    manager_id UUID REFERENCES profiles(id),
    group_role group_role DEFAULT 'employee',
    status user_status DEFAULT 'working',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE asset_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE device_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES asset_groups(id),
    type_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    specs_schema JSONB DEFAULT '{}'
);

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_code VARCHAR(50) UNIQUE NOT NULL,
    device_type_id UUID REFERENCES device_types(id),
    current_user_id UUID REFERENCES profiles(id),
    status asset_status DEFAULT 'in_stock',
    purchase_info JSONB DEFAULT '{}',
    specifications JSONB DEFAULT '{}',
    usage_location VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE asset_handover_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    action_type handover_type NOT NULL,
    action_date TIMESTAMPTZ DEFAULT NOW(),
    condition_notes TEXT,
    photo_url TEXT NOT NULL,
    performed_by UUID REFERENCES profiles(id)
);

-- 4. Triggers to auto-update asset status
CREATE OR REPLACE FUNCTION update_asset_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.action_type = 'checkout' THEN
        UPDATE assets SET status = 'in_use', current_user_id = NEW.user_id WHERE id = NEW.asset_id;
    ELSIF NEW.action_type = 'checkin' THEN
        UPDATE assets SET status = 'in_stock', current_user_id = NULL WHERE id = NEW.asset_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_after_handover
AFTER INSERT ON asset_handover_logs
FOR EACH ROW EXECUTE FUNCTION update_asset_status();
```

---

# 💡 CÁC ĐIỂM CẢI TIẾN QUAN TRỌNG

1.  **Tính linh hoạt (JSONB):** Bảng `assets` sử dụng JSONB cho `specifications`. Điều này cho phép Laptop có trường "RAM, CPU" trong khi Ghế văn phòng có trường "Chất liệu, Màu sắc" mà không cần thay đổi cấu trúc bảng.
2.  **Tự động hóa (Triggers):** Khi bạn tạo một bản ghi trong `asset_handover_logs` (ví dụ: Giao máy cho nhân viên), trạng thái của máy trong bảng `assets` sẽ tự động chuyển sang `in_use` và cập nhật người sở hữu.
3.  **Bảo mật & Đối soát:** Trường `photo_url` trong nhật ký bàn giao là bắt buộc. Điều này đảm bảo tính minh bạch (có bằng chứng hình ảnh khi máy bị hỏng hóc lúc trả).
4.  **Phân quyền (RLS):**
    *   Nhân viên chỉ thấy tài sản mình đang giữ (`current_user_id = auth.uid()`).
    *   HR/Admin có quyền CRUD toàn bộ kho tài sản.
    *   Manager có quyền xem tài sản của nhân viên thuộc phòng ban mình quản lý.

Bước tiếp theo, tôi sẽ hướng dẫn bạn thiết lập **Supabase Edge Functions** để xử lý logic Chấm công chống gian lận nếu bạn đã sẵn sàng!
