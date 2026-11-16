# 🕵️‍♂️ Spytify — Spy Music (v1.0.5 alpha)

<div align="center">

![Spytify Badge](https://img.shields.io/badge/SPYTIFY-v1.0.5_alpha-FF2A55?style=for-the-badge&logo=shield&logoColor=white)
![Tauri v2](https://img.shields.io/badge/TAURI-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=black)
![React 19](https://img.shields.io/badge/REACT_19-CYBER_HUD-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Rust Engine](https://img.shields.io/badge/RUST_ENGINE-NATIVE_SORT_FILTER-DEA584?style=for-the-badge&logo=rust&logoColor=black)
![Multiplatform](https://img.shields.io/badge/PLATFORMS-WINDOWS%20%7C%20MACOS-00E5FF?style=for-the-badge)

**Ultra-lightweight Hi-Fi Music Player & Real-time Community Voice Hub.**

[Download Releases](https://github.com/anhdangtutien/Spytify/releases) • [English](#-english) • [Tiếng Việt](#-tiếng-việt)

</div>

---

## 🇬🇧 English — What's New in v1.0.5 alpha

- **⚡ Direct Rust Native Engine on Main UI**:
  - Integrated high-speed native Rust sorting (`rust_sort_tracks`) and filtering (`rust_filter_tracks`) directly into the main track tables (Local Music, Favorites, YouTube, SoundCloud, Audius, Albums).
  - One-click column sorting (Title, Artist, Duration, Source) with ascending/descending indicators and instant fast filtering.
  - Seamless unified user interface with zero unnecessary separate screens.
- **🎧 Smart DJ Search Recommendations Fix**:
  - Fixed Smart DJ discovery pipeline when playing songs from search results.
  - Instantly populates upcoming track recommendations and alternatives from search results with 0ms latency.
  - Fixed white-on-white play button contrast in the floating Next Track widget.
- **🖥️ Screen Share High-DPI & Fullscreen Quadrant Fix**:
  - Modern Windows Graphics Capture (WGC) for Windows WebView2 (`--enable-features=AllowWgcWindowCapturer,AllowWgcDesktopCapturer`), fixing quadrant scaling bug on high-DPI displays.
- **👥 Enhanced Room & Voice Invitations**:
  - Convenient user invite buttons across voice channels, chat rooms, and active call controls with anti-spam cooldown.

---

## 🇻🇳 Tiếng Việt — Điểm mới trong v1.0.5 alpha

- **⚡ Tích hợp trực tiếp Rust Native vào giao diện chính của App**:
  - Đưa thuật toán sắp xếp (`rust_sort_tracks`) và lọc bài hát (`rust_filter_tracks`) trực tiếp vào bảng danh sách bài hát chính (Nhạc trên máy, Yêu thích, Thư viện, YouTube, SoundCloud, Audius, Album).
  - Sắp xếp trực tiếp bằng cách click vào tiêu đề cột (Tên bài hát, Nghệ sĩ, Thời lượng, Nguồn) với tốc độ tức thì của mã máy Rust native.
  - Tích hợp thanh lọc nhanh bằng Rust ngay đầu bảng, xóa bỏ màn hình Rust UI riêng để giao diện đồng nhất, mượt mà.
- **🎧 Khắc phục hoàn toàn đề xuất Smart DJ khi tìm kiếm bài hát**:
  - Tự động nạp trước bài hát tiếp theo và danh sách bài tương tự (alternatives) ngay khi click nghe bài hát từ kết quả tìm kiếm với độ trễ 0ms.
  - Sửa lỗi nút Play bị màu trắng trên nền trắng trong popup "Bài tiếp theo".
- **🖥️ Sửa lỗi phóng to màn hình chia sẻ & Windows Graphics Capture**:
  - Kích hoạt chuẩn WGC hiện đại trên WebView2, xóa bỏ triệt để lỗi màn hình share bị co rút 1/4 góc trên bên trái khi có DPI scaling.
- **👥 Hoàn thiện nút mời phòng chat & phòng thoại**:
  - Bổ sung nút mời (`+`) trên cả kênh đàm thoại voice, kênh chat văn bản text và thanh điều khiển cuộc gọi với cơ chế chống spam popup.

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
