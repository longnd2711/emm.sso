

# 🌐 HEMEMM System - Trung tâm Điều hướng & Xác thực Tập trung (SSO)

## 1. 🚀 Tổng quan Hệ thống
Hệ thống quản trị HEMEMM là một hệ sinh thái các ứng dụng Web chuyên biệt, được thiết kế theo kiến trúc **Multi-Repository** và **Single Backend**. 

Mục tiêu của Repository này (`emm.sso`) là đóng vai trò **Cổng đăng nhập tập trung (Single Sign-On - SSO)**, cho phép nhân viên đăng nhập một lần và truy cập liền mạch vào tất cả các phân hệ khác trong hệ thống của Công ty HEM.

## 2. 🗺️ Bản đồ Sub-domain & Phân hệ
Hệ thống được chia nhỏ thành các Repository độc lập để tối ưu hóa việc bảo trì và nâng cấp:

| Sub-domain | Repository | Trạng thái | Chức năng chính |
| :--- | :--- | :--- | :--- |
| **ungdung.hem.com.vn** | `emm.sso` | **Trung tâm** | Xác thực tập trung, Dashboard điều hướng ứng dụng. |
| **tracuu.hem.com.vn** | `emm.tracuu` | Đang phát triển | Tra cứu sản phẩm, thông tin công cộng (Không cần login). |
| **lichhop.hem.com.vn** | `emm.lichhop` | Đã vận hành | Đăng ký và quản lý lịch họp nội bộ. |
| **taisan.hem.com.vn** | `emm.taisan` | Kế hoạch | Quản lý tài sản (CMDB), bàn giao thiết bị, đối soát ảnh. |
| **sanxuat.hem.com.vn** | `emm.sanxuat` | Kế hoạch | Hệ thống điều hành sản xuất (MES), kho vận, tiến độ. |

## 3. 🛠️ Stack Công nghệ (No-Build Architecture)
Hệ thống ưu tiên sự đơn giản trong triển khai và sửa đổi trực tiếp trên GitHub:
*   **Hosting:** GitHub Pages.
*   **Backend & Database:** Supabase (PostgreSQL).
*   **Frontend Thư viện (CDN):**
    *   `Vue.js (Global)` hoặc `React (UMD)`: Xử lý logic giao diện.
    *   `Tailwind CSS (Play CDN)`: Thiết kế giao diện nhanh.
    *   `Supabase-js (ESM)`: Kết nối Database & Auth.
    *   `Lucide Icons`: Hệ thống biểu tượng.

## 4. 🔑 Cơ chế Đăng nhập Tập trung (SSO Flow)
Để vượt qua rào cản chia sẻ Session giữa các Sub-domain trên GitHub Pages, hệ thống sử dụng cơ chế **URL Fragment Token Passing**:

1.  **Kiểm tra:** Khi người dùng vào một app con (ví dụ: `taisan.hem.com.vn`) mà chưa có Session, app sẽ redirect về:
    `ungdung.hem.com.vn/login.html?redirect=taisan.hem.com.vn`
2.  **Xác thực:** Người dùng đăng nhập tại `ungdung.hem.com.vn`.
3.  **Điều hướng:** Sau khi thành công, SSO redirect ngược lại app con kèm Token:
    `taisan.hem.com.vn/#access_token=...&refresh_token=...`
4.  **Thiết lập:** App con đọc Token từ URL, nạp vào Supabase Client bằng hàm `setSession()` và lưu vào LocalStorage của domain đó.

## 5. 🗄️ Cấu trúc Cơ sở dữ liệu (Database Schema)
Toàn bộ các ứng dụng dùng chung **01 Project Supabase**. Bảng dữ liệu quan trọng nhất là `public.profiles`:

*   **`profiles`**: Hợp nhất thông tin nhân sự.
    *   `id`: UUID (FK từ auth.users).
    *   `employee_code`: Mã nhân viên HEM.
    *   `role`: Phân quyền (`admin`, `manager`, `staff`, `technician`).
    *   `department_id`: Liên kết phòng ban.
*   **Các bảng nghiệp vụ khác:** `attendances`, `assets`, `meetings`, `production_orders`... được phân quyền qua RLS dựa trên `auth.uid()`.

## 6. 🛡️ Quy định Bảo mật & RLS
*   **Row Level Security (RLS):** Bắt buộc bật trên tất cả các bảng.
*   **Chính sách:**
    *   Nhân viên chỉ thấy dữ liệu liên quan đến mình.
    *   Quản lý thấy dữ liệu của phòng ban.
    *   Admin có quyền điều hành toàn hệ thống.
*   **Storage:** Các ảnh chụp chấm công, ảnh tài sản được lưu tại Buckets riêng tư, chỉ truy cập qua URL có thời hạn (Signed URLs).

## 7. 📖 Hướng dẫn Tích hợp Phân hệ mới
Để một Repository mới tham gia vào hệ sinh thái HEM, cần thực hiện:
1.  Nhúng Supabase SDK qua CDN.
2.  Thêm đoạn mã kiểm tra Session ở đầu file `app.js`.
3.  Nếu chưa có Session, thực hiện Redirect về `ungdung.hem.com.vn`.
4.  Cấu hình **Redirect URL** trong Supabase Dashboard (Authentication > URL Configuration).

---
**HEM IT Team**
*Cập nhật lần cuối: 24/05/2024*
