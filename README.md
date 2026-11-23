# 🕵️‍♂️ Spytify — Spy Music (v1.1.5)

<div align="center">

![Spytify Badge](https://img.shields.io/badge/SPYTIFY-v1.1.5-FF2A55?style=for-the-badge&logo=shield&logoColor=white)
![Tauri v2](https://img.shields.io/badge/TAURI-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=black)
![React 19](https://img.shields.io/badge/REACT_19-CYBER_HUD-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Rust Engine](https://img.shields.io/badge/RUST_ENGINE-NATIVE_AUDIO_&_OTA-DEA584?style=for-the-badge&logo=rust&logoColor=black)
![Multiplatform](https://img.shields.io/badge/PLATFORMS-WINDOWS%20%7C%20MACOS-00E5FF?style=for-the-badge)

**Ultra-lightweight Hi-Fi Music Player & Real-time Community Voice Hub.**

[Download Releases](https://github.com/anhdangtutien/Spytify/releases) • [English](#-english) • [Tiếng Việt](#-tiếng-việt)

</div>

---

## 🇻🇳 Tiếng Việt — Điểm mới trong v1.1.5 (Bản phát hành chính thức)

Spytify **v1.1.5** mang đến trải nghiệm cập nhật hoàn toàn tự động, rạp chiếu MV trên Desktop, và hệ thống kết nối phòng nghe Spytify Connect:

- **⚡ Tự động cập nhật không cần gỡ cài đặt (Silent In-Place Updater)**:
  - Tự động tải file cài đặt `.exe` trực tiếp và chạy cập nhật ngầm (`/S /UPDATE`), tự khởi động lại app mượt mà mà không bắt người dùng phải gỡ cài đặt trước.
  - Khắc phục triệt để lỗi tương thích hệ điều hành Windows `os error 216` bằng cơ chế kiểm tra Header thực thi PE (MZ) và giải mã URL nhị phân trực tiếp từ GitHub Releases.
- **🎙️ Spytify Connect & LiveKit WebRTC Audio Streaming**:
  - Tích hợp Spytify Connect phát nhạc đồng bộ và truyền âm thanh chất lượng cao theo thời gian thực qua LiveKit WebRTC.
- **🎬 Desktop MV Theater & Dynamic Search**:
  - Bố cục xem Music Video (MV) rạp hát thu gọn và cửa sổ nổi mượt mà trên Desktop.
  - Gợi ý tìm kiếm động thông minh dựa trên lịch sử nghe và nghệ sĩ yêu thích.
- **💿 Quản lý Album & Kí hiệu Đã tải**:
  - Hiển thị kí hiệu `✓ Đã tải` và `ĐÃ TẢI • LOSSLESS` trên bài hát, thẻ album và banner chi tiết album.
  - Bổ sung nút Dừng tải Album tức thì và Hộp thoại xác nhận xóa Album an toàn.

---

## 🇬🇧 English — What's New in v1.1.5

Spytify **v1.1.5** delivers seamless in-place silent updates, Desktop theater MV mode, and Spytify Connect streaming:

- **⚡ Silent In-Place Auto Updater**:
  - Automatically downloads direct `.exe` binaries and executes silent in-place installation (`/S /UPDATE`), relaunching Spytify smoothly without requiring manual uninstallation.
  - Fully resolves Windows `os error 216` via PE (MZ) binary header validation and direct installer URL resolution.
- **🎙️ Spytify Connect & LiveKit Streaming**:
  - Real-time room audio synchronization and high-fidelity WebRTC streaming powered by LiveKit SFU.
- **🎬 Desktop MV Cinema Player & Dynamic Search Suggestions**:
  - Seamless desktop MV theater mode and contextual search suggestions based on recently searched tracks and artists.
- **💿 Album Download Badges & Queue Cancellation**:
  - Downloaded status badges (`✓ Đã tải • LOSSLESS`) and prompt confirmation modal when removing saved albums.

- **⚡ Real-time OTA Updates & Same-Version Hotfixes**:
  - Receive new releases and **same-version Hotfix patches** in real time from **Spytify Admin Dashboard** with 1-click auto-install—no manual browser downloads required.
  - Triple-layer sync (**Supabase Realtime Broadcast** + **Postgres Changes** + **Background Polling**) delivers instant system announcements and patches across clients (`v1.0.0+`).
- **💿 Smart Album Download Indicators & Controls**:
  - **Downloaded Badges (`✓ Downloaded`)**: Automatically displays downloaded badges on individual album tracks, the album detail banner, and album grid cards.
  - **Cancel Album Download**: Stop batch album downloads at any time with a single click.
  - **Delete Album Confirmation Pop-up**: Custom confirmation modal displaying album artwork and track counts while preserving local audio files on disk.
- **🎤 Hero Artist Showcase & Verified Artist Portraits**:
  - **Hero Billboard & Auto-Slideshow**: Cross-fading hero banner and auto-scrolling artist recommendations on the Home screen, plus a redesigned Trending Top 10 chart.
  - **Verified High-Res Artist Portraits**: Fan-count prioritized portrait lookup (`max(nb_fan)`) eliminates stock placeholder images and letterboxed video thumbnails.

---

## 🇻🇳 Tiếng Việt — Điểm mới trong v1.1.2 – v1.1.3

- **🎧 Âm thanh vòm 3D Studio Spatializer**: Xử lý âm thanh Binaural Haas Crossfeed kết hợp Diffuse Room Acoustics và EQ tùy chỉnh trực tiếp.
- **🖱️ Kéo thả sắp xếp bài hát 3 vùng (Pointer Events)**: Hỗ trợ chèn liền trước, chèn liền sau hoặc đổi chỗ trực tiếp (`Swap`) siêu mượt trong danh sách bài hát và Album.
- **☁️ Tối ưu hóa băng thông Supabase & Đồng bộ Avatar**: Giảm dung lượng gói tin Realtime và đồng bộ tức thì ảnh đại diện giữa các tài khoản.

---

## 📥 Tải về & Cài đặt (Download)

| Hệ điều hành | Định dạng | Tải bản mới nhất |
| :--- | :--- | :--- |
| **Windows 10 / 11** | `.exe` (NSIS Setup) / `.msi` | [📥 GitHub Releases (v1.1.4)](https://github.com/anhdangtutien/Spytify/releases/latest) |
| **macOS (Apple Silicon & Intel)** | `.dmg` (Universal) | [🍏 GitHub Releases (v1.1.4)](https://github.com/anhdangtutien/Spytify/releases/latest) |

## 🛠️ Build từ mã nguồn (Development)

```bash
npm install
npm run tauri dev      # Chạy môi trường phát triển
npm run tauri build    # Đóng gói bản cài đặt tại src-tauri/target/release/bundle/
```

Phát hành theo giấy phép [MIT](LICENSE).
