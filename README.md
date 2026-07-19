---

# 📅 KẾ HOẠCH TRIỂN KHAI CHI TIẾT (REVISED)

## GIAI ĐOẠN 1: THIẾT LẬP NỀN TẢNG & CẦU NỐI GOOGLE DRIVE
**Mục tiêu:** Chuẩn bị DB và giải pháp lưu trữ file không tốn phí.

1.  **Triển khai Database:** Chạy bản Master SQL Script trên Supabase.
2.  **Thiết lập Google Drive API (Cầu nối lưu trữ):**
    *   Vì Supabase không trực tiếp lưu file vào Drive, chúng ta sẽ sử dụng **Google Apps Script (GAS)** làm trung gian (miễn phí).
    *   **Bước làm:** Tạo một script GAS nhận file (base64) từ Web App -> Lưu vào thư mục Drive chỉ định -> Trả về URL/ID file cho Supabase.
3.  **Khởi tạo dự án Frontend:** Tạo project Vite (React/TypeScript) và cài đặt các thư viện UI.

---

## GIAI ĐOẠN 2: PHÂN HỆ TRA CỨU SẢN PHẨM & BẢO HÀNH (ƯU TIÊN 1)
**Mục tiêu:** Hoàn thiện tính năng tra cứu QR Code/Serial cho khách hàng.

1.  **Trang Tra cứu Công khai (Public Route):**
    *   Xây dựng giao diện tìm kiếm theo `Serial Number`.
    *   Kết nối bảng `motors` và `product_types` để hiển thị: Tên máy, Ngày sản xuất, Trạng thái bảo hành.
2.  **Trang Kích hoạt Bảo hành:**
    *   Form cho khách hàng nhập thông tin (Tên, SĐT, Ảnh hóa đơn).
    *   **Xử lý ảnh:** Gửi ảnh hóa đơn qua GAS để lưu vào Google Drive, lấy link lưu vào bảng `registrations`.
3.  **Giao diện Quản lý cho Staff (Internal):**
    *   Trang duyệt yêu cầu bảo hành (`pending` -> `approved`).
    *   Khi duyệt, Trigger tự động kích hoạt `is_active = true` cho sản phẩm.

---

## GIAI ĐOẠN 3: XÁC THỰC & QUẢN TRỊ NHÂN SỰ (CORE HR)
**Mục tiêu:** Thiết lập hệ thống đăng nhập và hồ sơ nhân viên.

1.  **Tích hợp Supabase Auth:** Đăng nhập bằng Email/Password công ty.
2.  **Quản lý Profile:** Trang cập nhật thông tin nhân viên, ảnh đại diện (lưu Drive).
3.  **Phân quyền (RBAC):** Kiểm tra `role` từ bảng `profiles` để mở khóa các menu: Quản lý Tài sản, Chấm công, Quản lý Bảo hành.

---

## GIAI ĐOẠN 4: QUẢN LÝ TÀI SẢN (ASSETS & CMDB)
**Mục tiêu:** Quản lý thiết bị nội bộ và bàn giao.

1.  **Kho tài sản:** Giao diện CRUD danh mục thiết bị.
2.  **Module Bàn giao/Thu hồi:**
    *   Chụp ảnh hiện trạng máy khi giao/nhận.
    *   Ảnh được đẩy lên Google Drive thông qua cầu nối GAS.
    *   Lưu link ảnh vào bảng `asset_handover_logs`.
3.  **Tài sản cá nhân:** Nhân viên xem danh sách máy mình đang cầm và tình trạng bảo hành của máy đó.

---

## GIAI ĐOẠN 5: CHẤM CÔNG CHỐNG GIAN LẬN (ATTENDANCE)
**Mục tiêu:** Hệ thống ghi nhận công dựa trên vị trí và hình ảnh.

1.  **UI Chấm công:** Lấy tọa độ GPS và chụp ảnh selfie.
2.  **Edge Function:** Gọi hàm trung gian để:
    *   Xác thực vị trí (không cho phép fake GPS).
    *   Đẩy ảnh selfie lên Google Drive.
    *   Ghi giờ thực tế vào bảng `attendances`.

---

## GIAI ĐOẠN 6: PWA, OFFLINE & TRIỂN KHAI (DEPLOY)
**Mục tiêu:** Hoàn thiện trải nghiệm người dùng và đưa lên GitHub Pages.

1.  **Offline Sync:** Cài đặt `Dexie.js` để lưu tạm dữ liệu tra cứu hoặc chấm công khi mất mạng.
2.  **GitHub Actions:** Thiết lập CI/CD để tự động build và deploy lên GitHub Pages mỗi khi push code.

---

# 🛠️ GIẢI PHÁP LƯU FILE LÊN GOOGLE DRIVE (MIỄN PHÍ)

Vì bạn muốn lưu lên Drive, đây là đoạn mã **Google Apps Script** bạn cần triển khai để làm API:

```javascript
// Triển khai dưới dạng Web App trong Google Apps Script
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var folder = DriveApp.getFolderById("ID_THU_MUC_CUA_BAN");
  
  // Giải mã base64 từ frontend gửi lên
  var contentType = data.contentType;
  var byteCharacters = Utilities.base64Decode(data.base64Data);
  var blob = Utilities.newBlob(byteCharacters, contentType, data.fileName);
  
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return ContentService.createTextOutput(JSON.stringify({
    "url": file.getUrl(),
    "fileId": file.getId()
  })).setMimeType(ContentService.MimeType.JSON);
}
```

---

# 🚀 BƯỚC TIẾP THEO BẠN CẦN LÀM:

1.  **Bước 1:** Tạo một thư mục trên Google Drive và lấy ID của nó.
2.  **Bước 2:** Truy cập [script.google.com](https://script.google.com), dán đoạn mã trên, thay ID thư mục và nhấn **Deploy -> Web App** (Chọn quyền truy cập cho "Anyone").
3.  **Bước 3:** Chạy Script Master SQL trên Supabase.
4.  **Bước 4:** Bắt đầu code Frontend cho trang **Tra cứu sản phẩm**.

**Bạn có muốn tôi cung cấp đoạn code mẫu (React + Vite) để kết nối với Supabase và thực hiện tính năng Tra cứu sản phẩm ngay không?**
