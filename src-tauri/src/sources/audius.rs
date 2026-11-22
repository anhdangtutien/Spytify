use crate::models::{SearchResult, TrackSource};
use serde_json::Value;

const AUDIUS_HOSTS: &[&str] = &[
    "https://api.audius.co",
    "https://discoveryprovider.audius.co",
    "https://discoveryprovider2.audius.co",
];

pub async fn search_audius(query: &str) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Spytify/1.0")
        .redirect(reqwest::redirect::Policy::limited(5))
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let encoded = urlencoding_simple(query);
    let mut last_err = String::from("No Audius hosts available");

    for host in AUDIUS_HOSTS {
        let url = format!("{}/v1/tracks/search?query={}&app_name=Spytify", host, encoded);
        if let Ok(res) = client.get(&url).header("Accept", "application/json").send().await {
            if res.status().is_success() {
                if let Ok(val) = res.json::<Value>().await {
                    let items = parse_audius_items(&val);
                    if !items.is_empty() {
                        return Ok(items);
                    }
                }
            } else {
                last_err = format!("Audius host {} status: {}", host, res.status());
            }
        }
    }

    Err(last_err)
}

pub async fn get_trending_audius(limit: usize) -> Result<Vec<SearchResult>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Spytify/1.0")
        .redirect(reqwest::redirect::Policy::limited(5))
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let mut last_err = String::from("No Audius hosts available");

    for host in AUDIUS_HOSTS {
        let url = format!("{}/v1/tracks/trending?app_name=Spytify&limit={}", host, limit);
        if let Ok(res) = client.get(&url).header("Accept", "application/json").send().await {
            if res.status().is_success() {
                if let Ok(val) = res.json::<Value>().await {
                    let items = parse_audius_items(&val);
                    if !items.is_empty() {
                        return Ok(items);
                    }
                }
            } else {
                last_err = format!("Audius trending host {} status: {}", host, res.status());
            }
        }
    }

    Err(last_err)
}

fn parse_audius_items(val: &Value) -> Vec<SearchResult> {
    let mut results = Vec::new();
    if let Some(items) = val.get("data").and_then(|v| v.as_array()) {
        for item in items {
            let track_id = item.get("id").and_then(|v| v.as_str());
            let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("Audius Track");
            let artist = item.pointer("/user/name").and_then(|v| v.as_str()).unwrap_or("Audius Artist");
            let duration_secs = item.get("duration").and_then(|v| v.as_u64()).unwrap_or(180);
            
            let artwork = item.pointer("/artwork/480x480")
                .and_then(|v| v.as_str())
                .or_else(|| item.pointer("/artwork/150x150").and_then(|v| v.as_str()))
                .map(|s| s.to_string());

            let stream_url = if let Some(tid) = track_id {
                format!("https://api.audius.co/v1/tracks/{}/stream?app_name=Spytify", tid)
            } else if let Some(d) = item.pointer("/stream/url").and_then(|v| v.as_str()) {
                d.to_string()
            } else {
                continue;
            };

            results.push(SearchResult {
                title: title.to_string(),
                artist: artist.to_string(),
                album: "Audius Open Music".to_string(),
                duration_secs,
                source: TrackSource::Audius,
                url_or_id: stream_url,
                thumbnail: artwork,
            });
        }
    }
    results
}

fn urlencoding_simple(s: &str) -> String {
    let mut encoded = String::new();
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            b' ' => encoded.push('+'),
            _ => encoded.push_str(&format!("%{:02X}", b)),
        }
    }
    encoded
}
