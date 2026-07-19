
# 📋 ĐẶC TẢ HỆ THỐNG: HỆ SINH THÁI QUẢN TRỊ HEM EMM

## 1. 🚀 TỔNG QUAN DỰ ÁN
*   **Tên hệ thống:** HEM EMM Ecosystem.
*   **Loại hình:** Ứng dụng Trang Đơn (SPA) đa phân hệ, kiến trúc Micro-frontend đơn giản.
*   **Phương thức phát triển:** No-Build (Không dùng Vite/NPM, chỉnh sửa trực tiếp trên GitHub, nhúng thư viện qua CDN).
*   **Môi trường triển khai:** 
    *   **Frontend:** GitHub Pages (Static Hosting).
    *   **Backend & Database:** Supabase (PostgreSQL, Auth, Storage).
    *   **Trung gian lưu trữ:** Google Apps Script (Kết nối Google Drive Admin).
*   **Mục tiêu cốt lõi:** Quản trị tập trung toàn bộ hoạt động nhân sự, tài sản, sản xuất và dịch vụ khách hàng của HEM trên một nền tảng duy nhất.

## 2. 🛠️ STACK CÔNG NGHỆ (CDN-BASED)
Hệ thống sử dụng các thư viện hiện đại thông qua liên kết CDN để đảm bảo tốc độ triển khai và tính linh hoạt:
*   **Giao diện (UI):** Vue.js 3 (Global Build) kết hợp Tailwind CSS (Play CDN) theo phong cách Glassmorphism (Kính mờ).
*   **Biểu tượng (Icons):** Lucide Icons.
*   **Kết nối Backend:** Supabase JS SDK (ESM).
*   **Lưu trữ Offline:** Dexie.js (IndexedDB) cho các nghiệp vụ cần hoạt động khi mất mạng (Chấm công).
*   **Bản đồ & Định vị:** Leaflet.js (Dùng cho chấm công GPS).
*   **Xử lý ảnh:** Google Apps Script API (Dùng để Admin upload ảnh lên Google Drive công ty).

## 3. 🌐 KIẾN TRÚC ĐA PHÂN HỆ (MULTI-REPOSITORY)
Hệ thống được chia thành các Repository độc lập trên GitHub, dùng chung một dự án Supabase:

1.  **`ungdung.hem.com.vn` (Repo: `emm.sso`):** 
    *   Trung tâm xác thực (SSO).
    *   Dashboard điều hướng ứng dụng.
    *   Quản trị nhân sự, phân quyền app và sơ đồ tổ chức.
2.  **`tracuu.hem.com.vn` (Repo: `hem.tracuu`):** 
    *   Cổng thông tin công cộng.
    *   Tra cứu thông tin sản phẩm (Động cơ) qua QR Code.
3.  **`chamcong.hem.com.vn` (Repo: `hem.chamcong`):** 
    *   Chấm công GPS & Selfie.
    *   Quản lý đơn từ (Nghỉ phép, OT, đi muộn).
4.  **`taisan.hem.com.vn` (Repo: `hem.taisan`):** 
    *   Quản lý tài sản (CMDB).
    *   Bàn giao, thu hồi thiết bị có đối soát hình ảnh.
5.  **`lichhop.hem.com.vn` (Repo: `hem.lichhop`):** 
    *   Đăng ký và quản lý lịch họp nội bộ.
6.  **`sanxuat.hem.com.vn` (Repo: `hem.sanxuat`):** 
    *   Hệ thống điều hành sản xuất (MES) cơ bản.

## 4. 🧠 LOGIC NGHIỆP VỤ CỐT LÕI

### 4.1. Cơ chế Xác thực tập trung (SSO Flow)
Để đồng bộ phiên đăng nhập giữa các subdomain khác nhau trên GitHub Pages:
*   **Bước 1:** App con kiểm tra Session. Nếu chưa có, redirect về `ungdung.hem.com.vn?redirect=app-con.hem.com.vn`.
*   **Bước 2:** Người dùng đăng nhập tại SSO. SSO lấy Token từ Supabase.
*   **Bước 3:** SSO redirect ngược lại app con kèm Token trên URL Hash (`#access_token=...`).
*   **Bước 4:** App con đọc Token, dùng hàm `supabase.auth.setSession()` để nạp quyền và lưu vào LocalStorage của domain đó.

### 4.2. Quản lý Quyền linh hoạt (JSONB Permissions)
Hệ thống không sử dụng Role cứng cho từng app. Mọi quyền hạn được lưu trong cột `app_permissions` (JSONB) của bảng `profiles`:
*   **Cấu trúc:** `{"app_name": "permission_level"}`.
*   **Cấp độ:** `admin` (Toàn quyền), `manager` (Quản lý), `employee` (Người dùng), `viewer` (Chỉ xem), `none` (Chặn).
*   **Ứng dụng:** Trang SSO sẽ dựa vào đây để ẩn/hiện icon app. Các app con dựa vào đây để cho phép hoặc chặn các tính năng (Sửa/Xóa).

### 4.3. Quản lý Sơ đồ tổ chức (Tree Structure)
*   Sử dụng quan hệ `parent_id` trong bảng `departments` để tạo cấu trúc cây không giới hạn cấp độ.
*   Mỗi phòng ban có một `manager_id` (Trưởng phòng) để phục vụ logic duyệt đơn từ tự động.

### 4.4. Lưu trữ Hình ảnh (Hybrid Storage)
*   **Avatar:** Tải lên Google Drive của Admin công ty thông qua Google Apps Script để đảm bảo tính sở hữu vĩnh viễn và xem được công khai (Anyone with link).
*   **Ảnh nghiệp vụ (Chấm công, Tài sản):** Tải lên Supabase Storage để tận dụng bảo mật RLS (Chỉ người có quyền mới xem được ảnh).

## 5. 🛡️ BẢO MẬT & ROW LEVEL SECURITY (RLS)
*   **Xác thực:** 100% qua Supabase Auth (JWT).
*   **Phân quyền tầng DB:** 
    *   Bật RLS trên tất cả các bảng.
    *   Sử dụng hàm `get_current_user_role()` và kiểm tra trực tiếp vào cột `app_permissions` trong JWT để cho phép truy xuất dữ liệu.
*   **Chống gian lận:** Chấm công bắt buộc lấy tọa độ từ trình duyệt và ảnh chụp thực tế, không cho phép upload ảnh từ thư viện.

## 6. 📱 TỐI ƯU HÓA TRẢI NGHIỆM (UX/UI)
*   **Mobile-First:** Giao diện được thiết kế dạng thẻ (Cards) và danh sách (List) tối ưu cho màn hình dọc của điện thoại.
*   **PWA:** Tích hợp Service Worker để ứng dụng có thể "Cài đặt" vào màn hình chính điện thoại và hoạt động offline khi cần thiết.
*   **Tốc độ:** Tận dụng tối đa bộ nhớ đệm (Cache) của trình duyệt cho các file thư viện CDN.
