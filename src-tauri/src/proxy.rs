use base64::Engine;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio::net::TcpListener;

static PROXY_RUNNING: AtomicBool = AtomicBool::new(false);
pub const PROXY_PORT: u16 = 45455;

/// Returns the machine's primary local LAN IP address (e.g. 192.168.1.15).
pub fn get_local_ip() -> Option<String> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip().to_string())
}

/// Starts the lightweight LAN & Local Audio Streaming Server on `0.0.0.0:45455`.
/// Allows both WebView2 on Desktop and mobile devices (iPhone/Safari) on the same Wi-Fi
/// to stream audio directly over standard HTTP with full CORS and Range support.
pub fn start_audio_proxy() {
    if PROXY_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }

    tauri::async_runtime::spawn(async move {
        let addr = format!("0.0.0.0:{}", PROXY_PORT);
        let listener = match TcpListener::bind(&addr).await {
            Ok(l) => {
                let local_ip = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
                println!("[Spytify Server] HTTP Audio Stream Server ready at http://{}:{}", local_ip, PROXY_PORT);
                l
            }
            Err(e) => {
                eprintln!("[Spytify Server] Failed to bind 0.0.0.0:{}: {}", PROXY_PORT, e);
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
                    eprintln!("[Spytify Server] Accept error: {}", e);
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

/// Formats a stream URL suitable for LAN streaming to iPhone.
pub fn get_lan_stream_url(direct_url: &str) -> String {
    let ip = get_local_ip().unwrap_or_else(|| "127.0.0.1".to_string());
    let b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(direct_url.as_bytes());
    format!("http://{}:{}/stream?b64={}", ip, PROXY_PORT, b64)
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

    // Route 1: Serve local files from disk (/local?path=... or /local?b64=...)
    if uri.starts_with("/local") {
        return handle_local_file(socket, uri, range_header, method == "HEAD").await;
    }

    // Route 2: Upstream proxy for YouTube / external audio streams (/stream?b64=...)
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

    while let Ok(Some(chunk)) = resp.chunk().await {
        if socket.write_all(&chunk).await.is_err() {
            break;
        }
    }

    let _ = socket.flush().await;
    Ok(())
}

async fn handle_local_file(
    socket: &mut tokio::net::TcpStream,
    uri: &str,
    range_header: Option<String>,
    is_head: bool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let file_path = if let Some(q_idx) = uri.find('?') {
        let query = &uri[q_idx + 1..];
        let mut path_opt: Option<String> = None;
        for param in query.split('&') {
            if let Some(eq_idx) = param.find('=') {
                let key = &param[..eq_idx];
                let val = &param[eq_idx + 1..];
                if key == "b64" {
                    if let Ok(bytes) = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(val) {
                        if let Ok(s) = String::from_utf8(bytes) {
                            path_opt = Some(s);
                            break;
                        }
                    }
                } else if key == "path" {
                    path_opt = Some(val.to_string());
                    break;
                }
            }
        }
        path_opt
    } else {
        None
    };

    let file_path = match file_path {
        Some(p) => p,
        None => {
            let res = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\nMissing file path";
            socket.write_all(res.as_bytes()).await?;
            return Ok(());
        }
    };

    let mut file = match tokio::fs::File::open(&file_path).await {
        Ok(f) => f,
        Err(_) => {
            let res = "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\nFile not found";
            socket.write_all(res.as_bytes()).await?;
            return Ok(());
        }
    };

    let metadata = file.metadata().await?;
    let total_size = metadata.len();

    let mime = if file_path.ends_with(".flac") {
        "audio/flac"
    } else if file_path.ends_with(".ogg") {
        "audio/ogg"
    } else if file_path.ends_with(".m4a") || file_path.ends_with(".mp4") {
        "audio/mp4"
    } else if file_path.ends_with(".wav") {
        "audio/wav"
    } else {
        "audio/mpeg"
    };

    // Range support: bytes=start-end
    let (start, end) = if let Some(ref r) = range_header {
        if let Some(range_val) = r.strip_prefix("bytes=") {
            let mut parts = range_val.split('-');
            let start = parts.next().and_then(|s| s.parse::<u64>().ok()).unwrap_or(0);
            let end = parts.next().and_then(|s| s.parse::<u64>().ok()).unwrap_or(total_size.saturating_sub(1));
            (start, std::cmp::min(end, total_size.saturating_sub(1)))
        } else {
            (0, total_size.saturating_sub(1))
        }
    } else {
        (0, total_size.saturating_sub(1))
    };

    let content_len = if total_size > 0 && end >= start {
        end - start + 1
    } else {
        0
    };

    let is_partial = range_header.is_some();
    let status_code = if is_partial { "206 Partial Content" } else { "200 OK" };

    let mut header = format!(
        "HTTP/1.1 {}\r\n\
        Access-Control-Allow-Origin: *\r\n\
        Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n\
        Access-Control-Allow-Headers: *\r\n\
        Accept-Ranges: bytes\r\n\
        Content-Type: {}\r\n\
        Content-Length: {}\r\n",
        status_code, mime, content_len
    );

    if is_partial {
        header.push_str(&format!("Content-Range: bytes {}-{}/{}\r\n", start, end, total_size));
    }
    header.push_str("Connection: close\r\n\r\n");
    socket.write_all(header.as_bytes()).await?;

    if is_head {
        return Ok(());
    }

    file.seek(std::io::SeekFrom::Start(start)).await?;
    let mut remaining = content_len;
    let mut chunk_buf = [0u8; 16384];

    while remaining > 0 {
        let to_read = std::cmp::min(remaining as usize, chunk_buf.len());
        let read_bytes = file.read(&mut chunk_buf[..to_read]).await?;
        if read_bytes == 0 {
            break;
        }
        if socket.write_all(&chunk_buf[..read_bytes]).await.is_err() {
            break;
        }
        remaining -= read_bytes as u64;
    }

    let _ = socket.flush().await;
    Ok(())
}
