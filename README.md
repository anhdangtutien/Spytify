# 🕵️‍♂️ Spytify — Spy Music (v1.0.8 alpha)

<div align="center">

![Spytify Badge](https://img.shields.io/badge/SPYTIFY-v1.0.7_alpha-FF2A55?style=for-the-badge&logo=shield&logoColor=white)
![Tauri v2](https://img.shields.io/badge/TAURI-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=black)
![React 19](https://img.shields.io/badge/REACT_19-CYBER_HUD-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Rust Engine](https://img.shields.io/badge/RUST_ENGINE-NATIVE_SORT_FILTER-DEA584?style=for-the-badge&logo=rust&logoColor=black)
![Multiplatform](https://img.shields.io/badge/PLATFORMS-WINDOWS%20%7C%20MACOS-00E5FF?style=for-the-badge)

**Ultra-lightweight Hi-Fi Music Player & Real-time Community Voice Hub.**

[Download Releases](https://github.com/anhdangtutien/Spytify/releases) • [English](#-english) • [Tiếng Việt](#-tiếng-việt)

</div>

---

## 🇬🇧 English — What's New in v1.0.8 alpha

Spytify 1.0.8 fixes cloud database credentials injection in CI builds and optimizes community servers:
- **☁️ Automated Supabase CI Injection**: Automatically injects credentials from GitHub Secrets into client build bundle.
- **🛡️ Dedicated Community Tables**: Direct message, community server, and invite storage optimizations.

---

## 🇻🇳 Tiếng Việt — Điểm mới trong v1.0.8 alpha

Spytify 1.0.8 sửa cơ chế inject thông tin Supabase từ CI khi build và tối ưu hóa hệ thống máy chủ cộng đồng:
- **☁️ Tự động nạp cấu hình Supabase**: Tự động inject credentials từ GitHub Secrets vào bộ cài ứng dụng.
- **🛡️ Tối ưu hóa bảng cộng đồng**: Cải thiện đồng bộ máy chủ Spy Jam, tin nhắn và lời mời tham gia server.

---

## 🇬🇧 English — What's New in v1.0.7 alpha

Spytify 1.0.7 improves cross-device profile synchronization, alongside the personalized Spy Jam features introduced in 1.0.6:

- **☁️ Cloud profile synchronization**:
  - Avatar, bio, and thought/status updates are synchronized across signed-in devices.
- **💬 Server chat and unread navigation**:
  - Server icons show unread message counts; chat displays an unread summary, a new-message divider, and a one-click jump to the present.
  - Mentions support `@user` and `@everyone`, with message highlighting, in-app notifications, and improved keyboard navigation.
  - Servers remember each user's last text channel and reopen there instead of selecting a voice room.
- **🎙️ Voice and screen-sharing controls**:
  - Choose 30, 60, or 90 FPS for screen sharing from Voice & Video settings or call settings.
  - Camera, screen-sharing, and call controls are available in the room, with a collapsible floating control dock.
- **👤 Account-specific data and localization**:
  - Albums are stored and synced per account.
  - Settings and authentication screens are localized across the supported languages.
- **⚡ Native Rust track tools**:
  - Rust-powered sorting and filtering are integrated into the main track tables.

---

## 🇻🇳 Tiếng Việt — Điểm mới trong v1.0.7 alpha

Spytify 1.0.7 sửa đồng bộ hồ sơ giữa các thiết bị, bên cạnh các tính năng Spy Jam cá nhân hóa được giới thiệu ở bản 1.0.6:

- **☁️ Đồng bộ hồ sơ đám mây**:
  - Avatar, tiểu sử và suy nghĩ/trạng thái được đồng bộ giữa các thiết bị đã đăng nhập.
- **💬 Chat server và điều hướng tin chưa đọc**:
  - Icon server hiển thị số tin chưa đọc; khung chat có thanh tóm tắt, vạch phân cách tin mới và nút nhảy tới hiện tại.
  - Hỗ trợ nhắc `@user`, `@everyone`, highlight tin nhắn, thông báo trong ứng dụng và cải thiện điều hướng gợi ý bằng bàn phím.
  - Ghi nhớ kênh chat văn bản gần nhất của từng user trong mỗi server, không tự mở phòng thoại.
- **🎙️ Điều khiển thoại và chia sẻ màn hình**:
  - Chọn 30, 60 hoặc 90 FPS trong mục Giọng nói & video hoặc cài đặt cuộc gọi.
  - Bật camera, chia sẻ màn hình và điều khiển cuộc gọi ngay trong phòng; thanh điều khiển có thể thu gọn.
- **👤 Dữ liệu riêng theo tài khoản và đa ngôn ngữ**:
  - Album được lưu và đồng bộ riêng theo từng tài khoản.
  - Mục cài đặt và màn hình đăng nhập được bản địa hóa theo các ngôn ngữ được hỗ trợ.
- **⚡ Công cụ nhạc Rust Native**:
  - Tích hợp chức năng sắp xếp và lọc bằng Rust trực tiếp vào các bảng danh sách bài hát.

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
