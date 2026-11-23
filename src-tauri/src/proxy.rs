use base64::Engine;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

static PROXY_RUNNING: AtomicBool = AtomicBool::new(false);
pub const PROXY_PORT: u16 = 45455;

/// Starts a lightweight local streaming proxy server on `127.0.0.1:45455`.
/// Injects `Access-Control-Allow-Origin: *` headers and supports `Range` requests,
/// allowing Web Audio API (`createMediaElementSource`) in WebView2 to capture
/// Google Video / YouTube audio streams without CORS browser muting.
pub fn start_audio_proxy() {
    if PROXY_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }

    tauri::async_runtime::spawn(async move {
        let addr = format!("127.0.0.1:{}", PROXY_PORT);
        let listener = match TcpListener::bind(&addr).await {
            Ok(l) => {
                println!("[Spytify Proxy] Audio CORS Proxy listening on http://{}", addr);
                l
            }
            Err(e) => {
                eprintln!("[Spytify Proxy] Failed to bind proxy on {}: {}", addr, e);
                PROXY_RUNNING.store(false, Ordering::SeqCst);
                return;
            }
        };

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .unwrap_or_default();

        loop {
            match listener.accept().await {
                Ok((mut socket, _)) => {
                    let client = client.clone();
                    tokio::spawn(async move {
                        let _ = handle_socket(&mut socket, client).await;
                    });
                }
                Err(e) => {
                    eprintln!("[Spytify Proxy] Accept error: {}", e);
                }
            }
        }
    });
}

/// Formats a direct stream URL into a CORS-safe local proxy URL.
pub fn get_cors_proxy_url(direct_url: &str) -> String {
    let b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(direct_url.as_bytes());
    format!("http://127.0.0.1:{}/stream?b64={}", PROXY_PORT, b64)
}

async fn handle_socket(
    socket: &mut tokio::net::TcpStream,
    client: reqwest::Client,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut buf = [0u8; 4096];
    let n = socket.read(&mut buf).await?;
    if n == 0 {
        return Ok(());
    }

    let request_str = String::from_utf8_lossy(&buf[..n]);
    let mut lines = request_str.lines();
    let first_line = match lines.next() {
        Some(l) => l,
        None => return Ok(()),
    };

    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 {
        return Ok(());
    }

    let method = parts[0];
    let uri = parts[1];

    // Handle CORS preflight
    if method == "OPTIONS" {
        let response = "HTTP/1.1 204 No Content\r\n\
            Access-Control-Allow-Origin: *\r\n\
            Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n\
            Access-Control-Allow-Headers: *\r\n\
            Access-Control-Max-Age: 86400\r\n\
            Connection: close\r\n\r\n";
        socket.write_all(response.as_bytes()).await?;
        return Ok(());
    }

    if method != "GET" && method != "HEAD" {
        let response = "HTTP/1.1 405 Method Not Allowed\r\n\
            Access-Control-Allow-Origin: *\r\n\
            Connection: close\r\n\r\n";
        socket.write_all(response.as_bytes()).await?;
        return Ok(());
    }

    // Extract Range header if present
    let mut range_header: Option<String> = None;
    for line in lines {
        if line.to_lowercase().starts_with("range:") {
            if let Some(idx) = line.find(':') {
                range_header = Some(line[idx + 1..].trim().to_string());
            }
        }
    }

    // Extract target URL from query parameter `b64` or `url`
    let target_url = if let Some(q_idx) = uri.find('?') {
        let query = &uri[q_idx + 1..];
        let mut resolved: Option<String> = None;
        for param in query.split('&') {
            if let Some(eq_idx) = param.find('=') {
                let key = &param[..eq_idx];
                let val = &param[eq_idx + 1..];
                if key == "b64" {
                    if let Ok(bytes) = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(val) {
                        if let Ok(s) = String::from_utf8(bytes) {
                            resolved = Some(s);
                            break;
                        }
                    }
                    // Fallback to standard base64 decoding
                    if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(val) {
                        if let Ok(s) = String::from_utf8(bytes) {
                            resolved = Some(s);
                            break;
                        }
                    }
                } else if key == "url" {
                    resolved = Some(val.to_string());
                    break;
                }
            }
        }
        resolved
    } else {
        None
    };

    let target_url = match target_url {
        Some(u) => u,
        None => {
            let response = "HTTP/1.1 400 Bad Request\r\n\
                Access-Control-Allow-Origin: *\r\n\
                Content-Type: text/plain\r\n\
                Connection: close\r\n\r\n\
                Missing target audio stream URL (b64 parameter)";
            socket.write_all(response.as_bytes()).await?;
            return Ok(());
        }
    };

    let mut req = client.get(&target_url)
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15")
        .header("Referer", "https://music.youtube.com/");

    if let Some(range) = range_header {
        req = req.header("Range", range);
    }

    let mut resp = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            let err_body = format!("Upstream stream error: {}", e);
            let response = format!(
                "HTTP/1.1 502 Bad Gateway\r\n\
                Access-Control-Allow-Origin: *\r\n\
                Content-Type: text/plain\r\n\
                Content-Length: {}\r\n\
                Connection: close\r\n\r\n{}",
                err_body.len(),
                err_body
            );
            socket.write_all(response.as_bytes()).await?;
            return Ok(());
        }
    };

    let status = resp.status();
    let mut header = format!(
        "HTTP/1.1 {} {}\r\n\
        Access-Control-Allow-Origin: *\r\n\
        Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n\
        Access-Control-Allow-Headers: *\r\n\
        Accept-Ranges: bytes\r\n",
        status.as_u16(),
        status.canonical_reason().unwrap_or("OK")
    );

    if let Some(ct) = resp.headers().get("content-type") {
        if let Ok(s) = ct.to_str() {
            header.push_str(&format!("Content-Type: {}\r\n", s));
        }
    } else {
        header.push_str("Content-Type: audio/webm\r\n");
    }

    if let Some(cl) = resp.headers().get("content-length") {
        if let Ok(s) = cl.to_str() {
            header.push_str(&format!("Content-Length: {}\r\n", s));
        }
    }

    if let Some(cr) = resp.headers().get("content-range") {
        if let Ok(s) = cr.to_str() {
            header.push_str(&format!("Content-Range: {}\r\n", s));
        }
    }

    header.push_str("Connection: close\r\n\r\n");
    socket.write_all(header.as_bytes()).await?;

    if method == "HEAD" {
        return Ok(());
    }

    // Stream audio payload bytes to socket
    while let Ok(Some(chunk)) = resp.chunk().await {
        if socket.write_all(&chunk).await.is_err() {
            break;
        }
    }

    let _ = socket.flush().await;
    Ok(())
}
