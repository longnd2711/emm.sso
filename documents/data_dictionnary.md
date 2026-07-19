
# 📖 TỪ ĐIỂN DỮ LIỆU: HỆ THỐNG HEM EMM (v4.0)

## 1. PHÂN HỆ TỔ CHỨC & NHÂN SỰ (CORE HR)

### BẢNG: `departments` (Sơ đồ tổ chức)
Mục đích: Lưu trữ cơ cấu phòng ban theo dạng cây (Hierarchy).

| Tên Cột | Kiểu Dữ Liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, Default: uuid_v4 | ID duy nhất của phòng ban. |
| `dep_code` | Varchar(20) | Unique, Not Null | Mã viết tắt (VD: SX1, HCNS, IT). |
| `name` | Varchar(100) | Not Null | Tên đầy đủ của phòng ban. |
| `parent_id` | UUID | FK -> `departments.id` | ID của phòng ban cấp trên (NULL nếu là cấp cao nhất). |
| `manager_id` | UUID | FK -> `profiles.id` | ID nhân viên giữ chức vụ Trưởng phòng. |

### BẢNG: `profiles` (Hồ sơ & Phân quyền)
Mục đích: Hợp nhất thông tin nhân sự và quản lý quyền truy cập ứng dụng.

| Tên Cột | Kiểu Dữ Liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, FK -> `auth.users` | Map 1:1 với tài khoản đăng nhập. |
| `employee_code` | Varchar(50) | Unique, Not Null | Mã nhân viên do công ty cấp. |
| `full_name` | Varchar(255) | Not Null | Họ và tên đầy đủ. |
| `company_email` | Varchar(100) | Unique | Email công ty cấp (@hem.com.vn). |
| `department_id` | UUID | FK -> `departments.id` | Thuộc phòng ban nào. |
| `role` | Enum | Default: 'employee' | Quyền hệ thống: `admin`, `manager`, `employee`, `technician`. |
| `app_permissions`| **JSONB** | Default: `{}` | **Quyền chi tiết từng App (Xem cấu trúc bên dưới).** |
| `status` | Enum | Default: 'working' | Trạng thái: `working` (Đang làm), `resigned` (Đã nghỉ). |
| `avatar_url` | Text | Nullable | Link ảnh đại diện (Lưu trên Google Drive Admin). |

**💡 Cấu trúc JSONB `app_permissions`:**
```json
{
  "lichhop": "admin",    // Quyền tại app Lịch họp
  "taisan": "manager",   // Quyền tại app Tài sản
  "chamcong": "employee",// Quyền tại app Chấm công
  "tracuu": "viewer",    // Quyền tại app Tra cứu
  "sanxuat": "none"      // Không có quyền truy cập
}
```

---

## 2. PHÂN HỆ QUẢN LÝ TÀI SẢN (CMDB)

### BẢNG: `assets` (Kho tài sản)
Mục đích: Quản lý chi tiết từng thiết bị, công cụ dụng cụ.

| Tên Cột | Kiểu Dữ Liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK, Default: uuid_v4 | ID hệ thống của tài sản. |
| `asset_code` | Varchar(50) | Unique, Not Null | Mã định danh dán trên tài sản. |
| `name` | Varchar(255) | Not Null | Tên tài sản (VD: Laptop Dell Precision). |
| `status` | Enum | Default: 'in_stock' | `in_stock`, `in_use`, `maintenance`, `broken`, `retired`. |
| `current_user_id`| UUID | FK -> `profiles.id` | Người đang chịu trách nhiệm sử dụng. |
| `purchase_info` | **JSONB** | Default: `{}` | **Thông tin mua sắm (Xem cấu trúc bên dưới).** |
| `specifications` | **JSONB** | Default: `{}` | **Thông số kỹ thuật (Xem cấu trúc bên dưới).** |

**💡 Cấu trúc JSONB `purchase_info`:**
```json
{
  "supplier": "Công ty ABC",
  "purchase_date": "2024-01-01",
  "warranty_expiry": "2025-01-01",
  "original_cost": 25000000,
  "invoice_no": "INV-001"
}
```

**💡 Cấu trúc JSONB `specifications` (Linh hoạt theo loại tài sản):**
*   *Nếu là Laptop:* `{"cpu": "i7", "ram": "16GB", "ssd": "512GB"}`
*   *Nếu là Xe:* `{"license_plate": "29A-12345", "engine_no": "XYZ..."}`

### BẢNG: `asset_handover_logs` (Nhật ký giao nhận)
Mục đích: Lưu vết lịch sử bàn giao và thu hồi tài sản.

| Tên Cột | Kiểu Dữ Liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | ID bản ghi nhật ký. |
| `asset_id` | UUID | FK -> `assets.id` | Tài sản được giao/nhận. |
| `user_id` | UUID | FK -> `profiles.id` | Nhân viên nhận hoặc trả tài sản. |
| `action_type` | Enum | Not Null | `checkout` (Giao đi), `checkin` (Thu hồi). |
| `photo_url` | Text | **Bắt buộc** | Link ảnh chụp hiện trạng lúc giao nhận (Lưu trên Supabase). |
| `condition_notes`| Text | Nullable | Ghi chú tình trạng (VD: Máy trầy xước nhẹ). |
| `performed_by` | UUID | FK -> `profiles.id` | Người thực hiện (HR/Admin kho). |

---

## 3. PHÂN HỆ SẢN PHẨM & BẢO HÀNH (WARRANTY)

### BẢNG: `motors` (Sản phẩm vật lý)
Mục đích: Quản lý từng sản phẩm cụ thể bán ra thị trường.

| Tên Cột | Kiểu Dữ Liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | ID sản phẩm. |
| `serial_number` | Varchar(100) | Unique, Not Null | Số Serial/Số máy duy nhất. |
| `product_type_id`| UUID | FK -> `product_types.id`| Thuộc dòng máy nào. |
| `status` | Enum | Default: 'in_stock' | `in_stock`, `distributed`, `sold`, `registered`. |
| `warranty_expiry_date` | Date | Nullable | Ngày hết hạn bảo hành (Tự động tính). |

---

## 4. PHÂN HỆ CHẤM CÔNG (ATTENDANCE)

### BẢNG: `attendances` (Dữ liệu chấm công)
Mục đích: Lưu vết thời gian và vị trí làm việc của nhân viên.

| Tên Cột | Kiểu Dữ Liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | ID bản ghi chấm công. |
| `user_id` | UUID | FK -> `profiles.id` | Nhân viên chấm công. |
| `date` | Date | Default: Today | Ngày ghi nhận. |
| `check_in_time` | Timestamptz | Nullable | Giờ vào. |
| `check_in_lat` | Numeric | Nullable | Vĩ độ GPS lúc vào. |
| `check_in_lng` | Numeric | Nullable | Kinh độ GPS lúc vào. |
| `check_in_photo_url`| Text | Nullable | Link ảnh selfie lúc vào. |
| `is_offline_sync`| Boolean | Default: false | Đánh dấu nếu dữ liệu được đẩy lên từ hàng đợi Offline. |

---
**Hết bản Từ điển dữ liệu.**
