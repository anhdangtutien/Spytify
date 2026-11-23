import "./services/tauriWebShim";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Catch any unhandled error so we never get a silent black screen
window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error || event.message);
  const root = document.getElementById('root');
  if (root && root.children.length === 0) {
    root.innerHTML = `
      <div style="background:#09090d;color:#ff4d4f;padding:28px;font-family:system-ui,-apple-system,sans-serif;height:100vh;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
        <h2 style="font-size:20px;font-weight:bold;margin-bottom:8px;color:#fff;">⚠️ Lỗi Khởi Động Spytify</h2>
        <p style="color:#aaa;font-size:13px;max-width:500px;margin-bottom:16px;">Ứng dụng gặp sự cố khi tải trang:</p>
        <pre style="white-space:pre-wrap;background:#14141e;border:1px solid #2a2a3e;padding:12px;border-radius:8px;color:#ff7875;font-size:12px;max-width:600px;text-align:left;">${event.error?.stack || event.message}</pre>
        <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;background:#ff2a55;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">Tải lại trang</button>
      </div>
    `;
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
