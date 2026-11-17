# 🌐 Hướng dẫn chạy & Deploy Landing Page Spytify

Trang web giới thiệu ứng dụng Spytify được đặt trong thư mục `website/`.

## 1. Xem trước trên máy tính (Local Preview)
- Bạn có thể **click đúp trực tiếp** vào file [`website/index.html`](file:///e:/Spytify%20Dev%20App/website/index.html) để mở trên trình duyệt (Chrome, Edge, Cốc Cốc...).
- Hoặc dùng extension Live Server trong VS Code, hoặc lệnh:
  ```powershell
  npx serve website
  ```

## 2. Cách thêm ảnh chụp màn hình thực tế (Screenshots)
Trong file `website/index.html`, bạn có thể thay thế các ảnh minh họa bằng các ảnh chụp màn hình thật của app:
1. Chụp màn hình Spytify khi đang phát nhạc, màn hình Spy Jam voice room, màn hình chia sẻ 90 FPS...
2. Lưu các file ảnh vào thư mục `website/assets/` (ví dụ: `screenshot-player.png`, `screenshot-jam.png`).
3. Trong `website/index.html`, thay đường dẫn ảnh trong thẻ `<img>` của từng Tab.

## 3. Cơ chế tải tự động (Direct Download)
Trang web được tích hợp mã JavaScript tự động kết nối với GitHub API:
- Tự động lấy phiên bản mới nhất từ `https://github.com/anhdangtutien/Spytify/releases/latest`.
- Khi người dùng bấm **"Cài đặt cho Windows"**, trình duyệt sẽ **tải thẳng file `.exe` về máy**, người dùng không cần phải vào trang GitHub Releases.
- Tự động hiển thị dung lượng file thực tế (`~15 MB`).

## 4. Cách Deploy lên Vercel miễn phí trong 1 phút
1. Đăng nhập [Vercel.com](https://vercel.com).
2. Chọn **"Add New Project"** ➔ Chọn repository GitHub của bạn (`Spytify`).
3. Ở phần **Root Directory**, bấm `Edit` và chọn thư mục `website`.
4. Bấm **Deploy**. Vercel sẽ cung cấp tên miền miễn phí dạng `spytify.vercel.app` với chứng chỉ SSL HTTPS tự động!
