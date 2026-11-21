# 🕵️‍♂️ Spytify — Spy Music (v1.1.4)

<div align="center">

![Spytify Badge](https://img.shields.io/badge/SPYTIFY-v1.1.4-FF2A55?style=for-the-badge&logo=shield&logoColor=white)
![Tauri v2](https://img.shields.io/badge/TAURI-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=black)
![React 19](https://img.shields.io/badge/REACT_19-CYBER_HUD-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Rust Engine](https://img.shields.io/badge/RUST_ENGINE-NATIVE_AUDIO_&_OTA-DEA584?style=for-the-badge&logo=rust&logoColor=black)
![Multiplatform](https://img.shields.io/badge/PLATFORMS-WINDOWS%20%7C%20MACOS-00E5FF?style=for-the-badge)

**Ultra-lightweight Hi-Fi Music Player & Real-time Community Voice Hub.**

[Download Releases](https://github.com/anhdangtutien/Spytify/releases) • [English](#-english) • [Tiếng Việt](#-tiếng-việt)

</div>

---

## 🇻🇳 Tiếng Việt — Điểm mới trong v1.1.4 (Bản phát hành & Vá lỗi OTA)

Spytify **v1.1.4** nâng cấp toàn diện hệ thống cập nhật trực tuyến (OTA Hotfix), quản lý tải xuống Album và giao diện khám phá nghệ sĩ trên Trang chủ:

- **⚡ Cập nhật tự động & Vá lỗi nóng (Realtime OTA & Hotfix)**:
  - Hỗ trợ nhận bản cập nhật mới và **bản vá lỗi nóng (Hotfix)** ngay trên cùng phiên bản hiện tại theo thời gian thực từ **Spytify Admin Dashboard** mà không cần tải thủ công qua trình duyệt.
  - Đồng bộ 3 lớp (**Supabase Realtime Broadcast** + **Postgres Changes** + **Background Poll**) giúp nhận thông báo hệ thống và bản vá tức thì đối với mọi phiên bản từ `v1.0.0` trở lên.
- **💿 Quản lý Album & Trạng thái tải xuống thông minh**:
  - **Kí hiệu Đã tải (`✓ Đã tải`)**: Tự động hiển thị huy hiệu `✓ Đã tải` và `ĐÃ TẢI • LOSSLESS` trên từng bài hát đã tải trong Album, trên Banner chi tiết Album (`✓ ĐÃ TẢI XUỐNG X/X`) và trên thẻ Album ngoài danh sách.
  - **Dừng tải Album tức thì**: Bổ sung nút **"Dừng tải album"** cho phép hủy hàng đợi tải bất kỳ lúc nào khi album có nhiều bài hát.
  - **Pop-up xác nhận xóa Album**: Hộp thoại xác nhận xóa Album đồng bộ giao diện Spytify (kèm thông tin ảnh bìa, số lượng bài hát và giữ nguyên các file nhạc đã tải về máy).
- **🎤 Trang chủ & Chân dung Nghệ sĩ chính chủ**:
  - **Màn hình lớn giới thiệu Nghệ sĩ (Hero Showcase Billboard)**: Tự động chuyển cảnh cross-fade mượt mà giữa các nghệ sĩ hay nghe.
  - **Auto-Slideshow Nghệ sĩ đề xuất & Bảng xếp hạng Top 10**: Tự động trượt ngang danh sách nghệ sĩ (tạm dừng khi di chuột) và thiết kế lại bảng xếp hạng Trending Top 10 hiện đại.
  - **Chân dung Nghệ sĩ độ phân giải cao**: Đồng bộ ảnh chân dung chính chủ từ CDN âm nhạc với thuật toán ưu tiên lượng người hâm mộ (`max(nb_fan)`), loại bỏ hoàn toàn ảnh stock và viền đen.

---

## 🇬🇧 English — What's New in v1.1.4 (OTA Hotfix & Album Enhancements)

Spytify **v1.1.4** upgrades the real-time OTA Hotfix system, Album download tracking, and Home artist discovery:

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
