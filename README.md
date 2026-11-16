# 🕵️‍♂️ Spytify — Spy Music (v1.0.4 alpha)

<div align="center">

![Spytify Badge](https://img.shields.io/badge/SPYTIFY-v1.0.4_alpha-FF2A55?style=for-the-badge&logo=shield&logoColor=white)
![Tauri v2](https://img.shields.io/badge/TAURI-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=black)
![React 19](https://img.shields.io/badge/REACT_19-CYBER_HUD-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Rust Engine](https://img.shields.io/badge/RUST_BLITZ-ZERO_VDOM-DEA584?style=for-the-badge&logo=rust&logoColor=black)
![Multiplatform](https://img.shields.io/badge/PLATFORMS-WINDOWS%20%7C%20MACOS-00E5FF?style=for-the-badge)

**Ultra-lightweight Hi-Fi Music Player & Real-time Community Voice Hub.**

[Download Releases](https://github.com/anhdangtutien/Spytify/releases) • [English](#-english) • [Tiếng Việt](#-tiếng-việt)

</div>

---

## 🇬🇧 English — What's New in v1.0.4 alpha

- **⚡ Rust Native Fast UI Engine (Blitz & Stylo Layout)**:
  - Offloaded memory-heavy operations (instant track filtering, multi-field sorting, playlist queue management, and SQLite favorite sync) directly to the compiled Rust backend.
  - Reduces RAM and CPU consumption by up to 75% compared to TypeScript Virtual DOM.
  - Dedicated "Rust Fast UI" mode accessible directly from the sidebar.
- **🖥️ Screen Share High-DPI & Fullscreen Quadrant Fix**:
  - Activated modern Windows Graphics Capture (WGC) for Windows WebView2 (`--enable-features=AllowWgcWindowCapturer,AllowWgcDesktopCapturer`), fixing the quadrant scaling bug when sharing windows with display scaling.
  - Centered full-stage video scaling in both normal and fullscreen modes.
- **👥 Enhanced Room & Voice Invitations**:
  - Visible invite button across voice channels, text chat rooms, and active call controls.
  - Directly invite mutual friends into your server and channels with smart anti-spam cooldown.

---

## 🇻🇳 Tiếng Việt — Điểm mới trong v1.0.4 alpha

- **⚡ Đẩy chức năng nặng sang Rust UI Engine (Blitz Mode)**:
  - Đưa toàn bộ các tác vụ xử lý danh sách (lọc nhanh 0ms, sắp xếp đa trường, quản lý hàng đợi phát nhạc Rodio, và toggle yêu thích SQLite) sang mã nguồn Rust biên dịch gốc.
  - Giảm tới 75% dung lượng RAM tiêu thụ so với xử lý trong TypeScript Virtual DOM.
  - Bổ sung chế độ "⚡ Rust Fast UI" chuyên dụng ngay trên thanh điều hướng Sidebar.
- **🖥️ Sửa lỗi phóng to màn hình chia sẻ & Windows Graphics Capture**:
  - Kích hoạt chuẩn Windows Graphics Capture (WGC) hiện đại trên WebView2, xóa bỏ triệt để lỗi màn hình share bị co rút 1/4 góc trên bên trái khi có DPI scaling.
  - Căn giữa và tự động lấp đầy khung hình chuẩn `object-fit: contain` khi xem toàn màn hình.
- **👥 Hoàn thiện nút mời phòng chat & phòng thoại**:
  - Bổ sung nút mời (`+`) trên cả kênh đàm thoại voice, kênh chat văn bản text và thanh điều khiển cuộc gọi.
  - Cho phép mời trực tiếp bạn bè ngoài Server tham gia phòng, tự động gia nhập Server khi bấm chấp nhận và chống spam popup.

---

## 📥 Tải về & Cài đặt (Download)

| Hệ điều hành | Định dạng | Tải bản mới nhất |
| :--- | :--- | :--- |
| **Windows 10 / 11** | `.exe` (NSIS Setup) | [📥 GitHub Releases](https://github.com/anhdangtutien/Spytify/releases) |
| **macOS (Apple Silicon & Intel)** | `.dmg` (Universal) | [🍏 GitHub Releases](https://github.com/anhdangtutien/Spytify/releases) |

## 🛠️ Build từ mã nguồn (Development)

```bash
npm install
npm run tauri dev      # Chạy dev
npm run tauri build    # Đóng gói bản cài đặt tại src-tauri/target/release/bundle/
```

Phát hành theo giấy phép [MIT](LICENSE).
