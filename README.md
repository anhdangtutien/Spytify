# 🕵️‍♂️ Spytify — Spy Music (v1.0.3 alpha)

<div align="center">

![Spytify Badge](https://img.shields.io/badge/SPYTIFY-v1.0.3_alpha-FF2A55?style=for-the-badge&logo=shield&logoColor=white)
![Tauri v2](https://img.shields.io/badge/TAURI-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=black)
![React 19](https://img.shields.io/badge/REACT_19-CYBER_HUD-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Multiplatform](https://img.shields.io/badge/PLATFORMS-WINDOWS%20%7C%20MACOS-00E5FF?style=for-the-badge)

**Ultra-lightweight Hi-Fi Music Player & Real-time Community Voice Hub.**

[Download Releases](https://github.com/anhdangtutien/Spytify/releases) • [English](#-english) • [Tiếng Việt](#-tiếng-việt)

</div>

---

## 🇬🇧 English — What's New in v1.0.3 alpha

- **🤖 Multi-Bot Music & Continuous Queue Streaming**:
  - Support multiple On-Demand music bots targeted via `/play @id_bot [song / YouTube URL]`, streaming continuously until the entire queue finishes before automatically leaving the room.
  - Real-time bot creation & customization sync across all server members.
- **🖥️ Multi-Screen Share & Private 1-1 Calls**:
  - Watch multiple simultaneous screen shares with per-user tabs, monitor/LIVE indicators next to speakers, and proper centered fullscreen display.
  - Synchronized 1-1 DM private calls and instant server/channel kick eviction.
  - Any server member can invite others into voice rooms (`+` button or member menu), with non-intrusive bottom-right notifications and a 60s anti-spam cooldown after 2 consecutive declines.
- **🛡️ Role Sync, UI & Desktop Controls**:
  - Authoritative Owner/Mod permission sync across clients (regular members cannot change server themes).
  - Drag-and-drop reordering for server icons on the left rail, interest tag selection moved into Server Settings, speech-bubble thought notes, and **Launch on Windows Startup** toggle in Account Settings.

---

## 🇻🇳 Tiếng Việt — Điểm mới trong v1.0.3 alpha

- **🤖 Đa Bot Yêu Cầu & Stream Xuyên Suốt**:
  - Hỗ trợ nhiều bot phát nhạc theo yêu cầu qua `/play @id_bot [tên bài / link YouTube]`, phát liên tục tới khi hết hàng đợi rồi tự rời phòng.
  - Tự động đồng bộ bot mới tạo/tùy biến tới toàn bộ thành viên trong server.
- **🖥️ Chia Tab Share Màn Hình & Đàm Thoại**:
  - Chia tab chọn xem khi nhiều người share màn hình cùng lúc, hiển thị biểu tượng share cạnh tên, và sửa lỗi phóng to toàn màn hình.
  - Sửa gọi riêng 1-1, đồng bộ kick khỏi server theo thời gian thực.
  - **Mời vào phòng thoại** (ai trong server cũng mời được từ nút `+` hoặc menu thành viên), thông báo gọn ở góc dưới phải và chặn spam 60 giây nếu đối phương từ chối 2 lần liên tiếp.
- **🛡️ Đồng Bộ Phân Quyền, Giao Diện & Hệ Thống**:
  - Đồng bộ chính xác quyền Chủ Server / Mod (khóa đổi theme server với thành viên thường).
  - Kéo thả sắp xếp vị trí icon server, đưa chọn tag sở thích vào Cài đặt Máy chủ, ô suy nghĩ dạng hộp thoại có đuôi lệch phải, và thêm tùy chọn **Khởi động cùng Windows** trong phần Tài khoản.

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
