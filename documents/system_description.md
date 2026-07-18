Chào bạn, với tư cách là Kiến trúc sư Phần mềm, tôi đã tổng hợp và viết lại bản **Đặc tả Hệ thống Toàn diện**. Bản đặc tả này hợp nhất tất cả các yêu cầu về Nhân sự, Chấm công, Quản lý Tài sản (CMDB) và Tra cứu Sản phẩm/Bảo hành vào một tài liệu duy nhất, chuẩn hóa theo kiến trúc Supabase.

---

# 📋 ĐẶC TẢ HỆ THỐNG: UNIFIED HR, ASSET & WARRANTY MANAGEMENT SYSTEM

## 1. 🚀 TỔNG QUAN DỰ ÁN
*   **Loại hình:** Ứng dụng Trang Đơn (SPA) có khả năng PWA (Offline-first).
*   **Môi trường triển khai:** 
    *   **Frontend:** GitHub Pages (Static Hosting).
    *   **Backend & Database:** Supabase (PostgreSQL, Auth, Storage, Edge Functions).
*   **Mục tiêu cốt lõi:** 
    1.  Quản lý nhân sự và chấm công chống gian lận (GPS, Hình ảnh).
    2.  Quản lý vòng đời tài sản nội bộ (CMDB) với đối soát hình ảnh.
    3.  Quản lý sản phẩm bán ra, kích hoạt bảo hành và tra cứu QR Code.
    4.  Hoạt động ổn định ngay cả khi mất kết nối mạng (Offline Sync).

## 2. 🛠️ STACK CÔNG NGHỆ KHUYẾN NGHỊ
*   **Frontend:** React.js hoặc Vue.js (Vite) + TailwindCSS + shadcn/ui.
*   **State Management:** TanStack Query (Caching) & Zustand (Global State).
*   **Maps & Location:** Leaflet.js (Open-source, không tốn phí API).
*   **Offline Storage:** Dexie.js (IndexedDB wrapper) để quản lý hàng đợi đồng bộ.
*   **PWA:** `vite-plugin-pwa` để cài đặt ứng dụng và Service Worker.

## 3. 🗄️ KIẾN TRÚC CƠ SỞ DỮ LIỆU (POSTGRESQL)
Hệ thống sử dụng **Surrogate Key (UUID)** cho tất cả các bảng để đảm bảo tính độc lập và an toàn dữ liệu.

### 3.1. Phân hệ Nhân sự & Tổ chức
*   **`departments`**: Quản lý sơ đồ tổ chức đa cấp.
*   **`profiles`**: Bảng trung tâm hợp nhất thông tin nhân viên, quyền hạn (Role) và trạng thái làm việc. Kết nối 1:1 với `auth.users`.

### 3.2. Phân hệ Chấm công & Đơn từ
*   **`attendances`**: Lưu vết check-in/out. **Chống gian lận:** Lưu tọa độ GPS, ảnh selfie và độ chính xác của thiết bị.
*   **`requests`**: Quy trình duyệt đơn nghỉ phép, OT, sửa công.

### 3.3. Phân hệ Quản lý Tài sản (CMDB)
*   **`assets`**: Quản lý chi tiết thiết bị. Sử dụng **JSONB** cho `specifications` để tùy biến thông số theo từng loại tài sản (Laptop, Xe, v.v.).
*   **`asset_handover_logs`**: Nhật ký bàn giao/thu hồi. **Bắt buộc chụp ảnh hiện trạng** lúc giao nhận để làm bằng chứng đối soát.

### 3.4. Phân hệ Sản phẩm & Bảo hành
*   **`motors`**: Danh sách sản phẩm vật lý theo số Serial/IMEI.
*   **`registrations`**: Quản lý kích hoạt bảo hành cho khách hàng/đại lý.
*   **`scan_logs`**: Theo dõi vị trí địa lý mỗi khi QR Code trên sản phẩm được quét.

### 3.5. Tối ưu hóa Hiệu năng
*   **Indexes:** Tất cả các Khóa ngoại (Foreign Keys) và các cột thường xuyên tìm kiếm (`date`, `created_at`, `serial_number`) đều được đánh Index để đảm bảo tốc độ truy vấn khi dữ liệu lớn.

## 4. 🛡️ CHÍNH SÁCH BẢO MẬT & PHÂN QUYỀN (RLS)
Hệ thống áp dụng **Row Level Security (RLS)** nghiêm ngặt:
*   **Nhân viên (Employee):** Chỉ xem được hồ sơ cá nhân, lịch sử chấm công cá nhân và tài sản mình đang giữ.
*   **Quản lý (Manager):** Xem được dữ liệu của nhân viên thuộc phòng ban mình quản lý.
*   **Nhân sự/Quản trị (HR/Admin):** Toàn quyền CRUD trên các phân hệ tương ứng.
*   **Công khai (Public):** Chỉ được phép xem thông tin sản phẩm cơ bản khi quét QR Code và gửi form đăng ký bảo hành (trạng thái `pending`).

## 5. 🧠 LOGIC NGHIỆP VỤ CỐT LÕI

### 5.1. Chấm công Chống gian lận
1.  **Frontend:** Lấy vị trí GPS -> Chụp ảnh selfie -> Gửi Payload về Server.
2.  **Edge Function:** Xác thực Token -> Kiểm tra khoảng cách GPS so với văn phòng -> Upload ảnh lên Storage -> Ghi dữ liệu vào DB với mốc thời gian thực của Server (không dùng giờ máy điện thoại).

### 5.2. Dự phòng Offline (PWA)
*   Khi mất mạng, dữ liệu chấm công/bàn giao tài sản được lưu vào **IndexedDB**.
*   Service Worker theo dõi trạng thái mạng. Khi có kết nối lại, hệ thống tự động đẩy hàng đợi lên Supabase kèm cờ `is_offline_sync = true` để HR hậu kiểm.

### 5.3. Vòng đời Tài sản & Sản phẩm
*   **Tự động hóa:** Sử dụng **Postgres Triggers** để tự động chuyển trạng thái tài sản (`in_stock` ↔ `in_use`) khi có log bàn giao.
*   **Bảo hành:** Tự động tính toán ngày hết hạn bảo hành dựa trên ngày sản xuất và cấu hình dòng máy.

## 6. 🎯 KẾ HOẠCH TRIỂN KHAI (ROADMAP)

*   **Giai đoạn 1: Database & Security:** Triển khai SQL Master Script, thiết lập RLS và Storage Buckets (avatars, attendance_photos, asset_photos).
*   **Giai đoạn 2: Core Auth & HR:** Xây dựng luồng đăng nhập, quản lý hồ sơ nhân viên và sơ đồ phòng ban.
*   **Giai đoạn 3: Attendance & PWA:** Phát triển tính năng chấm công GPS, tích hợp Camera và xử lý lưu trữ Offline.
*   **Giai đoạn 4: Asset & Warranty:** Xây dựng module quản lý kho tài sản, bàn giao bằng ảnh chụp và hệ thống tra cứu bảo hành QR Code.
*   **Giai đoạn 5: Analytics & Deploy:** Xây dựng Dashboard báo cáo, tối ưu hóa Index và triển khai lên GitHub Pages qua GitHub Actions.

---
*Tài liệu này đóng vai trò là kim chỉ nam cho toàn bộ quá trình phát triển. Mọi thay đổi về cấu trúc dữ liệu sau này phải được cập nhật vào file Master SQL đi kèm.*
