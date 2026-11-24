pub mod ai;
pub mod audio;
pub mod db;
pub mod downloader;
pub mod models;
pub mod oauth;
pub mod proxy;
pub mod rust_ui;
pub mod scanner;
pub mod sources;

use ai::MusicAiEngine;
use audio::AudioPlayerManager;
use db::DatabaseManager;
use rust_ui::{RustUiEngine, RustUiSnapshot};
use models::{
    ArtistMix, HistoryItem, PlaybackStatus, RecommendationResult, SearchResult, Track, TrainingReport, User,
    UserStats,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State, WindowEvent,
};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

static RELATED_CACHE: Mutex<Option<HashMap<String, Vec<SearchResult>>>> = Mutex::new(None);
static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(true);
static IS_EXITING: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn open_mini_player_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(mini) = app.get_webview_window("mini") {
        let _ = mini.show();
        let _ = mini.set_always_on_top(true);
        let _ = mini.set_focus();
        return Ok(());
    }

    let _ = tauri::WebviewWindowBuilder::new(
        &app,
        "mini",
        tauri::WebviewUrl::default()
    )
    .title("Spytify Mini")
    .inner_size(360.0, 130.0)
    .decorations(false)
    .always_on_top(true)
    .resizable(false)
    .initialization_script("window.__IS_MINI_PLAYER__ = true; window.location.hash = '#mini';")
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn close_mini_player_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(mini) = app.get_webview_window("mini") {
        let _ = mini.hide();
    }
    Ok(())
}

#[tauri::command]
fn set_mini_player_mode(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        open_mini_player_window(app)
    } else {
        close_mini_player_window(app)
    }
}

#[tauri::command]
fn set_close_to_tray(enabled: bool) {
    CLOSE_TO_TRAY.store(enabled, Ordering::SeqCst);
}

#[tauri::command]
fn get_close_to_tray() -> bool {
    CLOSE_TO_TRAY.load(Ordering::SeqCst)
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    if !IS_EXITING.swap(true, Ordering::SeqCst) {
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
            app_handle.exit(0);
        });
    }
}

#[cfg(target_os = "windows")]
mod win_mem {
    #[repr(C)]
    pub struct ProcessEntry32W {
        pub dw_size: u32,
        pub cnt_usage: u32,
        pub th32_process_id: u32,
        pub th32_default_heap_id: usize,
        pub th32_module_id: u32,
        pub cnt_threads: u32,
        pub th32_parent_process_id: u32,
        pub pc_pri_class_base: i32,
        pub dw_flags: u32,
        pub sz_exe_file: [u16; 260],
    }

    #[repr(C)]
    pub struct ProcessMemoryCounters {
        pub cb: u32,
        pub page_fault_count: u32,
        pub peak_working_set_size: usize,
        pub working_set_size: usize,
        pub quota_peak_paged_pool_usage: usize,
        pub quota_paged_pool_usage: usize,
        pub quota_peak_non_paged_pool_usage: usize,
        pub quota_non_paged_pool_usage: usize,
        pub pagefile_usage: usize,
        pub peak_pagefile_usage: usize,
    }

    #[link(name = "kernel32")]
    extern "system" {
        pub fn GetCurrentProcess() -> isize;
        pub fn GetCurrentProcessId() -> u32;
        pub fn OpenProcess(desired_access: u32, inherit_handle: i32, process_id: u32) -> isize;
        pub fn CloseHandle(object: isize) -> i32;
        pub fn K32EmptyWorkingSet(process: isize) -> i32;
        pub fn K32GetProcessMemoryInfo(process: isize, counters: *mut ProcessMemoryCounters, cb: u32) -> i32;
        pub fn CreateToolhelp32Snapshot(flags: u32, process_id: u32) -> isize;
        pub fn Process32FirstW(snapshot: isize, lppe: *mut ProcessEntry32W) -> i32;
        pub fn Process32NextW(snapshot: isize, lppe: *mut ProcessEntry32W) -> i32;
    }
}

#[cfg(target_os = "windows")]
fn get_tree_pids(root_pid: u32) -> std::collections::HashSet<u32> {
    use win_mem::*;
    let mut tree_pids = std::collections::HashSet::new();
    tree_pids.insert(root_pid);

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(0x00000002, 0); // TH32CS_SNAPPROCESS
        if snapshot != -1 && snapshot != 0 {
            let mut entries: Vec<(u32, u32)> = Vec::new();
            let mut entry: ProcessEntry32W = std::mem::zeroed();
            entry.dw_size = std::mem::size_of::<ProcessEntry32W>() as u32;

            if Process32FirstW(snapshot, &mut entry) != 0 {
                loop {
                    entries.push((entry.th32_process_id, entry.th32_parent_process_id));
                    if Process32NextW(snapshot, &mut entry) == 0 {
                        break;
                    }
                }
            }
            CloseHandle(snapshot);

            let mut added = true;
            while added {
                added = false;
                for &(pid, ppid) in &entries {
                    if tree_pids.contains(&ppid) && !tree_pids.contains(&pid) {
                        tree_pids.insert(pid);
                        added = true;
                    }
                }
            }
        }
    }
    tree_pids
}

#[cfg(target_os = "windows")]
pub fn get_tree_working_set() -> usize {
    use win_mem::*;
    let mut total_bytes = 0usize;
    unsafe {
        let root_pid = GetCurrentProcessId();
        let tree_pids = get_tree_pids(root_pid);

        for pid in tree_pids {
            let h_proc = if pid == root_pid {
                GetCurrentProcess()
            } else {
                OpenProcess(0x0400 | 0x1000, 0, pid) // PROCESS_QUERY_INFORMATION | PROCESS_QUERY_LIMITED_INFORMATION
            };
            if h_proc != 0 {
                let mut counters: ProcessMemoryCounters = std::mem::zeroed();
                counters.cb = std::mem::size_of::<ProcessMemoryCounters>() as u32;
                if K32GetProcessMemoryInfo(h_proc, &mut counters, counters.cb) != 0 {
                    total_bytes += counters.working_set_size;
                }
                if pid != root_pid {
                    CloseHandle(h_proc);
                }
            }
        }
    }
    total_bytes
}

#[cfg(target_os = "windows")]
pub fn trim_single_process_tree() {
    use win_mem::*;
    unsafe {
        let root_pid = GetCurrentProcessId();
        let tree_pids = get_tree_pids(root_pid);

        for pid in tree_pids {
            let h_proc = if pid == root_pid {
                GetCurrentProcess()
            } else {
                OpenProcess(0x0400 | 0x0100, 0, pid) // PROCESS_QUERY_INFORMATION | PROCESS_SET_QUOTA
            };
            if h_proc != 0 {
                K32EmptyWorkingSet(h_proc);
                if pid != root_pid {
                    CloseHandle(h_proc);
                }
            }
        }
    }
}

#[cfg(target_os = "windows")]
pub fn trim_process_memory() {
    trim_single_process_tree();
    std::thread::spawn(|| {
        std::thread::sleep(std::time::Duration::from_millis(450));
        trim_single_process_tree();
    });
}

#[cfg(not(target_os = "windows"))]
pub fn trim_process_memory() {}

#[tauri::command]
fn trim_memory() -> Result<(), String> {
    trim_process_memory();
    Ok(())
}

#[tauri::command]
async fn resolve_youtube_music_stream(
    video_id: String,
    title: String,
    artist: String,
) -> Result<sources::youtube::YoutubeAudioStream, String> {
    sources::youtube::resolve_youtube_music_stream(&video_id, &title, &artist).await
}

#[tauri::command]
fn get_lan_stream_info() -> Option<String> {
    proxy::get_local_ip().map(|ip| format!("http://{}:{}", ip, proxy::PROXY_PORT))
}

#[tauri::command]
async fn resolve_audius_stream(url_or_id: String) -> Result<String, String> {
    if url_or_id.contains("/tracks/cidstream/") && url_or_id.contains("signature=") {
        return Ok(url_or_id);
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .redirect(reqwest::redirect::Policy::limited(10))
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let stream_url = if url_or_id.starts_with("http") {
        url_or_id
    } else {
        format!("https://api.audius.co/v1/tracks/{}/stream?app_name=Spytify", url_or_id)
    };

    let res = client.get(&stream_url).send().await.map_err(|e| e.to_string())?;
    Ok(res.url().to_string())
}

#[tauri::command]
fn scan_music_folder(folder_path: String) -> Result<Vec<Track>, String> {
    Ok(scanner::scan_folder(folder_path))
}

#[tauri::command]
fn play_track(track: Track, state: State<'_, AudioPlayerManager>) -> Result<(), String> {
    state.play(track)
}

#[tauri::command]
fn pause_track(state: State<'_, AudioPlayerManager>) -> Result<(), String> {
    state.pause()
}

#[tauri::command]
fn resume_track(state: State<'_, AudioPlayerManager>) -> Result<(), String> {
    state.resume()
}

#[tauri::command]
fn stop_track(state: State<'_, AudioPlayerManager>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
fn set_volume(volume: f32, state: State<'_, AudioPlayerManager>) -> Result<(), String> {
    state.set_volume(volume)
}

#[tauri::command]
fn seek_track(position_secs: u64, state: State<'_, AudioPlayerManager>) -> Result<(), String> {
    state.seek(position_secs)
}

#[tauri::command]
fn get_playback_status(state: State<'_, AudioPlayerManager>) -> Result<PlaybackStatus, String> {
    Ok(state.get_status())
}

#[tauri::command]
async fn get_search_suggestions(query: String) -> Result<Vec<String>, String> {
    let clean = query.trim();
    if clean.is_empty() {
        return Ok(Vec::new());
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://suggestqueries.google.com/complete/search")
        .query(&[("client", "firefox"), ("ds", "yt"), ("q", clean)])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let val = res.json::<serde_json::Value>().await.map_err(|e| e.to_string())?;
    let mut suggestions = Vec::new();

    if let Some(arr) = val.get(1).and_then(|v| v.as_array()) {
        for item in arr {
            if let Some(s) = item.as_str() {
                suggestions.push(s.to_string());
            }
        }
    }

    Ok(suggestions)
}

/// Sinh danh sách "thể loại động" từ các từ khóa đang thịnh hành trên YouTube (autocomplete).
#[tauri::command]
async fn get_trending_keywords(language: Option<String>) -> Result<Vec<String>, String> {
    let lang = language.unwrap_or_else(|| "vi".to_string()).to_lowercase();
    let (hl, seeds): (&str, Vec<&str>) = match lang.as_str() {
        "vi" => ("vi", vec!["nhạc trending", "nhạc hot tiktok", "top hits", "remix", "nhạc chill"]),
        "ja" => ("ja", vec!["人気曲", "jpop", "ボカロ", "anime song", "top hits"]),
        "ko" => ("ko", vec!["인기 노래", "kpop", "top hits", "playlist", "remix"]),
        "zh-cn" => ("zh-CN", vec!["热门歌曲", "抖音 热歌", "top hits", "playlist", "remix"]),
        _ => ("en", vec!["trending songs", "viral tiktok songs", "top hits", "playlist", "remix"]),
    };

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| e.to_string())?;

    let futures = seeds.iter().map(|seed| {
        let client = client.clone();
        let seed = seed.to_string();
        let hl = hl.to_string();
        async move {
            let res = client
                .get("https://suggestqueries.google.com/complete/search")
                .query(&[("client", "firefox"), ("ds", "yt"), ("hl", hl.as_str()), ("q", seed.as_str())])
                .send()
                .await
                .ok()?;
            let val = res.json::<serde_json::Value>().await.ok()?;
            let arr = val.get(1)?.as_array()?.clone();
            Some(
                arr.into_iter()
                    .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
                    .filter(|s| !s.eq_ignore_ascii_case(&seed))
                    .collect::<Vec<String>>(),
            )
        }
    });

    let all = futures_util_join(futures).await;
    let banned = ["karaoke", "lyrics", "lyric", "reaction", "review", "hour", "giờ", "beat", "download", "mp3", "loi bai hat", "lời bài hát"];

    // Xen kẽ kết quả từ từng seed để chip đa dạng hơn
    let lists: Vec<Vec<String>> = all.into_iter().flatten().collect();
    let max_len = lists.iter().map(|l| l.len()).max().unwrap_or(0);
    let mut keywords: Vec<String> = Vec::new();
    for i in 0..max_len {
        for list in &lists {
            if let Some(k) = list.get(i) {
                let low = k.to_lowercase();
                if k.chars().count() < 3 || k.chars().count() > 32 { continue; }
                if banned.iter().any(|b| low.contains(b)) { continue; }
                if keywords.iter().any(|e| e.to_lowercase() == low) { continue; }
                keywords.push(k.clone());
            }
        }
    }
    keywords.truncate(10);
    Ok(keywords)
}

async fn futures_util_join<F, T>(futs: impl Iterator<Item = F>) -> Vec<T>
where
    F: std::future::Future<Output = T> + Send + 'static,
    T: Send + 'static,
{
    let handles: Vec<_> = futs.map(tokio::spawn).collect();
    let mut out = Vec::with_capacity(handles.len());
    for h in handles {
        if let Ok(v) = h.await {
            out.push(v);
        }
    }
    out
}

#[tauri::command]
async fn get_artist_album_mix(
    artist: String,
    user_id: Option<String>,
    db: State<'_, DatabaseManager>,
) -> Result<ArtistMix, String> {
    let clean_artist = artist
        .split(',')
        .next()
        .unwrap_or(&artist)
        .split('&')
        .next()
        .unwrap_or(&artist)
        .split(" x ")
        .next()
        .unwrap_or(&artist)
        .split(" ft.")
        .next()
        .unwrap_or(&artist)
        .split(" feat.")
        .next()
        .unwrap_or(&artist)
        .trim()
        .to_string();

    let clean_lower = clean_artist.to_lowercase();
    let mut combined_tracks: Vec<SearchResult> = Vec::new();
    let mut seen_titles = std::collections::HashSet::new();
    let mut found_cover: Option<String> = None;

    // 1. Quét bài hát từ SQLite History và Favorites của tài khoản
    if let Some(uid) = user_id.as_deref().filter(|s| !s.is_empty()) {
        if let Ok(history) = db.get_history(uid, 120) {
            for item in history {
                if item.artist.to_lowercase().contains(&clean_lower) || item.track_title.to_lowercase().contains(&clean_lower) {
                    let norm_title = item.track_title.to_lowercase().trim().to_string();
                    if seen_titles.insert(norm_title) {
                        let parsed_cover = item.track_json.as_deref()
                            .and_then(|j| serde_json::from_str::<Track>(j).ok())
                            .and_then(|t| t.cover_art);
                        if found_cover.is_none() && parsed_cover.is_some() {
                            found_cover = parsed_cover.clone();
                        }
                        combined_tracks.push(SearchResult {
                            title: item.track_title,
                            artist: item.artist,
                            album: format!("{} Mix", clean_artist),
                            duration_secs: item.duration_secs,
                            source: match item.source.to_lowercase().as_str() {
                                "soundcloud" => models::TrackSource::SoundCloud,
                                "audius" => models::TrackSource::Audius,
                                _ => models::TrackSource::YouTube,
                            },
                            url_or_id: item.path_or_url.unwrap_or(item.track_id),
                            thumbnail: parsed_cover,
                        });
                    }
                }
            }
        }

        if let Ok(favs) = db.get_favorites(uid) {
            for t in favs {
                if t.artist.to_lowercase().contains(&clean_lower) || t.title.to_lowercase().contains(&clean_lower) {
                    let norm_title = t.title.to_lowercase().trim().to_string();
                    if seen_titles.insert(norm_title) {
                        if found_cover.is_none() && t.cover_art.is_some() {
                            found_cover = t.cover_art.clone();
                        }
                        combined_tracks.push(SearchResult {
                            title: t.title,
                            artist: t.artist,
                            album: format!("{} Mix", clean_artist),
                            duration_secs: t.duration_secs,
                            source: match t.source {
                                models::TrackSource::SoundCloud => models::TrackSource::SoundCloud,
                                models::TrackSource::Audius => models::TrackSource::Audius,
                                _ => models::TrackSource::YouTube,
                            },
                            url_or_id: t.path_or_url,
                            thumbnail: t.cover_art,
                        });
                    }
                }
            }
        }
    }

    // 2. Tìm kiếm các bài hát top hits của nghệ sĩ trên YouTube (Rust async task)
    let yt_query = format!("{} top songs official audio", clean_artist);
    let yt_res = tokio::time::timeout(
        tokio::time::Duration::from_millis(4000),
        sources::youtube::search_youtube(&yt_query)
    ).await;

    if let Ok(Ok(yt_tracks)) = yt_res {
        for t in yt_tracks {
            let norm_title = t.title.to_lowercase().trim().to_string();
            if t.duration_secs > 0 && t.duration_secs < 900 {
                if seen_titles.insert(norm_title) {
                    if found_cover.is_none() && t.thumbnail.is_some() {
                        found_cover = t.thumbnail.clone();
                    }
                    combined_tracks.push(t);
                }
            }
            if combined_tracks.len() >= 25 {
                break;
            }
        }
    }

    // 3. Fallback thêm từ Audius nếu danh sách còn ít
    if combined_tracks.len() < 5 {
        if let Ok(audius_tracks) = sources::audius::search_audius(&clean_artist).await {
            for t in audius_tracks {
                let norm_title = t.title.to_lowercase().trim().to_string();
                if seen_titles.insert(norm_title) {
                    if found_cover.is_none() && t.thumbnail.is_some() {
                        found_cover = t.thumbnail.clone();
                    }
                    combined_tracks.push(t);
                }
                if combined_tracks.len() >= 25 {
                    break;
                }
            }
        }
    }

    let track_count = combined_tracks.len();
    Ok(ArtistMix {
        artist: clean_artist.clone(),
        title: format!("{} Mix", clean_artist),
        description: format!("Tuyển tập những bài hát được nghe nhiều nhất của {}", clean_artist),
        cover_art: found_cover,
        track_count,
        tracks: combined_tracks,
    })
}

#[tauri::command]
async fn search_online(query: String, source: String) -> Result<Vec<SearchResult>, String> {
    match source.to_lowercase().as_str() {
        "youtube" => sources::youtube::search_youtube(&query).await,
        "audius" => sources::audius::search_audius(&query).await,
        "soundcloud" => sources::soundcloud::search_soundcloud(&query).await,
        _ => {
            let (yt_res, audius_res, sc_res) = tokio::join!(
                sources::youtube::search_youtube(&query),
                sources::audius::search_audius(&query),
                sources::soundcloud::search_soundcloud(&query),
            );
            let mut results = Vec::new();
            if let Ok(r) = yt_res { results.extend(r); }
            if let Ok(r) = audius_res { results.extend(r); }
            if let Ok(r) = sc_res { results.extend(r); }
            Ok(results)
        }
    }
}

fn filter_actual_songs(results: Vec<SearchResult>) -> Vec<SearchResult> {
    let banned_keywords = [
        "bảng xếp hạng", "bxh", "ranking", "xếp hạng", "top 10 ", "top 10:", "top 10 -",
        "top 20", "top 50", "top 100", "top 100:", "top 50:", "countdown", "leaderboard",
        "compilation", "tổng hợp", "những bài hát", "full album", "mixtape", "nonstop",
        "liên khúc", "review", "reaction", "mashup", "hay nhất mọi thời đại", "tuyển tập",
        "ca khúc hay nhất", "bài hát hay nhất", "best songs of", "top songs of", "top hits of",
        "billboard hot 100 top", "billboard 2024", "billboard 2025", "10 hour", "1 hour",
        "2 hour", "3 hour", "podcast", "livestream", "24/7", "trực tiếp", "karaoke", "beat chuẩn"
    ];

    let mut unique: Vec<SearchResult> = Vec::new();
    for r in results {
        let t = r.title.to_lowercase();
        if banned_keywords.iter().any(|&k| t.contains(k)) {
            continue;
        }
        if r.duration_secs < 60 || r.duration_secs > 480 {
            continue;
        }
        let t_norm = r.title.trim().to_lowercase();
        if !unique.iter().any(|u| u.url_or_id == r.url_or_id || u.title.trim().to_lowercase() == t_norm) {
            unique.push(r);
        }
    }
    unique
}

#[tauri::command]
async fn get_trending_hits(category: String) -> Result<Vec<SearchResult>, String> {
    let raw = match category.to_lowercase().as_str() {
        "cortisol" | "low_cortisol" => {
            return sources::youtube::search_youtube("low cortisol playlist peaceful chill study relax aesthetic").await;
        }
        "working" | "deep_focus" => {
            return sources::youtube::search_youtube("deep focus music for working study coding lofi ambient chill").await;
        }
        "lockin" | "grind" => {
            return sources::youtube::search_youtube("lock in playlist study grind phonk focus aesthetic beats").await;
        }
        "gym" | "workout" => {
            return sources::youtube::search_youtube("gym workout motivation aggressive phonk edm beast mode bass").await;
        }
        "nightdrive" => {
            return sources::youtube::search_youtube("late night drive synthwave phonk chill playlist aesthetic").await;
        }
        "usuk" | "global" => {
            sources::youtube::search_youtube("global top hits official music video audio").await
        }
        "kpop" => {
            sources::youtube::search_youtube("kpop viral hits music video audio official").await
        }
        "jpop" => {
            sources::youtube::search_youtube("jpop viral hits official mv audio").await
        }
        "anime" => {
            sources::youtube::search_youtube("anime opening ost viral hits official").await
        }
        "kpop_jpop" => {
            sources::youtube::search_youtube("kpop jpop viral hits official mv audio").await
        }
        "vpop" | "vietnam" => {
            sources::youtube::search_youtube("vpop thinh hanh official music video").await
        }
        "soundcloud" => {
            return sources::soundcloud::search_soundcloud("trending hits remix electronic chill").await;
        }
        "audius" => return sources::audius::get_trending_audius(20).await,
        "lofi" => {
            return sources::youtube::search_youtube("lofi hip hop radio beats to relax study to live chill").await;
        }
        "edm" | "electronic" => {
            sources::youtube::search_youtube("festival edm electronic dance banger official audio").await
        }
        "hiphop" | "rap" => {
            sources::youtube::search_youtube("hip hop rap top billboard hits official audio").await
        }
        "rock" | "metal" => {
            sources::youtube::search_youtube("rock alternative viral hits official music video").await
        }
        "acoustic" | "indie" => {
            sources::youtube::search_youtube("acoustic indie pop viral songs guitar chill").await
        }
        _ => {
            // Priority: US/UK -> K-Pop/J-Pop -> V-Pop
            let (usuk_res, asian_res, vpop_res) = tokio::join!(
                sources::youtube::search_youtube("global top hits official music video audio"),
                sources::youtube::search_youtube("kpop jpop viral hits official mv audio"),
                sources::youtube::search_youtube("vpop thinh hanh official music video")
            );
            let mut list = Vec::new();
            if let Ok(usuk) = usuk_res {
                list.extend(usuk);
            }
            if let Ok(asian) = asian_res {
                list.extend(asian);
            }
            if let Ok(vpop) = vpop_res {
                list.extend(vpop);
            }
            Ok(list)
        }
    };

    match raw {
        Ok(list) => Ok(filter_actual_songs(list)),
        Err(e) => Err(e),
    }
}

fn extract_core_song_title(raw_title: &str, artist: &str) -> String {
    let mut t = raw_title.trim().to_string();
    
    // If title is "Artist - Song Title", strip the artist part
    if let Some((_, song)) = t.split_once(" - ") {
        t = song.to_string();
    } else if let Some((_, song)) = t.split_once(" – ") {
        t = song.to_string();
    } else if let Some((_, song)) = t.split_once(" : ") {
        t = song.to_string();
    }

    // Strip out common clutter: (Official Video), [MV], (Lyric Video), feat., ft., etc.
    let patterns = [
        "(official", "[official", "(video", "[video", "(audio", "[audio",
        "(lyric", "[lyric", "(mv", "[mv", "(visualizer", "[visualizer",
        "(feat", "[feat", "(ft.", "[ft.", "(prod.", "[prod.", "official music video",
        "official audio", "official video", "lyrics", "full audio", "hd", "4k",
        "(edit", "[edit", "(remix", "[remix", "(cover", "[cover",
        "(slowed", "[slowed", "(sped up", "[sped up", "(tiktok", "[tiktok",
        "(live", "[live", "(acoustic", "[acoustic"
    ];

    let mut lower = t.to_lowercase();
    for p in patterns {
        if let Some(idx) = lower.find(p) {
            t.truncate(idx);
            lower.truncate(idx);
        }
    }

    // Remove artist name if it still lingers in title
    let art_lower = artist.to_lowercase();
    if !art_lower.is_empty() && lower.contains(&art_lower) {
        t = t.replace(artist, "");
    }

    let core = t.trim().trim_matches(|c: char| !c.is_alphanumeric()).trim().to_string();
    if core.is_empty() {
        raw_title.trim().to_string()
    } else {
        core
    }
}

#[tauri::command]
async fn get_related_tracks(title: String, artist: String) -> Result<Vec<SearchResult>, String> {
    let clean_artist = artist.trim();
    let clean_title = title.trim();
    let core_title = extract_core_song_title(clean_title, clean_artist);
    let core_lower = core_title.to_lowercase();

    // 0. Instant in-memory cache check (0ms response)
    let cache_key = format!("{}::{}", clean_artist.to_lowercase(), core_lower);
    if let Ok(guard) = RELATED_CACHE.lock() {
        if let Some(map) = guard.as_ref() {
            if let Some(cached) = map.get(&cache_key) {
                if !cached.is_empty() {
                    return Ok(cached.clone());
                }
            }
        }
    }

    // 1. Fetch diverse related music:
    // Focus strongly on the actual song's genre and artist, avoiding obscure cover channel names
    let has_valid_artist = !clean_artist.is_empty() 
        && clean_artist.to_lowercase() != "unknown" 
        && !clean_artist.to_lowercase().contains("topic")
        && !clean_artist.to_lowercase().contains("vevo")
        && !clean_artist.to_lowercase().contains("records");

    let yt_query1 = if has_valid_artist {
        format!("music like {} {} top hits official audio", clean_artist, core_title)
    } else {
        format!("songs like {} hits official audio", core_title)
    };

    let yt_query2 = if has_valid_artist {
        format!("{} top tracks official music video audio", clean_artist)
    } else {
        format!("{} similar music hits playlist", core_title)
    };

    let sc_query = if has_valid_artist {
        format!("{} {} remix hits", clean_artist, core_title)
    } else {
        format!("{} remix hits", core_title)
    };

    let audius_query = if has_valid_artist {
        clean_artist.to_string()
    } else {
        core_title.clone()
    };

    // Fast-path: YouTube is our primary provider (~200ms). Secondary sources get a 1500ms timeout.
    let yt_fut1 = tokio::time::timeout(tokio::time::Duration::from_millis(3000), sources::youtube::search_youtube(&yt_query1));
    let yt_fut2 = tokio::time::timeout(tokio::time::Duration::from_millis(3000), sources::youtube::search_youtube(&yt_query2));
    let sc_fut = tokio::time::timeout(tokio::time::Duration::from_millis(1500), sources::soundcloud::search_soundcloud(&sc_query));
    let audius_fut = tokio::time::timeout(tokio::time::Duration::from_millis(1500), sources::audius::search_audius(&audius_query));

    let (yt_res1, yt_res2, sc_res, audius_res) = tokio::join!(yt_fut1, yt_fut2, sc_fut, audius_fut);

    let mut yt_list: Vec<SearchResult> = Vec::new();
    if let Ok(Ok(yt1)) = yt_res1 { yt_list.extend(yt1); }
    if let Ok(Ok(yt2)) = yt_res2 { yt_list.extend(yt2); }

    let sc_list: Vec<SearchResult> = match sc_res {
        Ok(Ok(sc)) => sc,
        _ => Vec::new(),
    };

    let audius_list: Vec<SearchResult> = match audius_res {
        Ok(Ok(audius)) => audius,
        _ => Vec::new(),
    };

    // 2. Strict Duration and Same-Song Filter:
    // - Eliminate tracks that are just other versions/remixes of the SAME song (e.g. "Closer")
    // - Eliminate audio longer than 10 minutes (600s)
    // - Eliminate compilations / 1-hour / livestream tracks
    let long_indicators = [
        "1 hour", "1hour", "1 hr", "2 hour", "2hour", "3 hour", "10 hour",
        "full album", "compilation", "mixtape", "nonstop", "continuous mix",
        "podcast", "livestream", "24/7", "trực tiếp"
    ];

    let filter_track = |r: &SearchResult| -> bool {
        let t = r.title.to_lowercase();
        if core_lower.len() >= 3 && t.contains(&core_lower) {
            return false;
        }
        if r.duration_secs > 600 {
            return false;
        }
        if long_indicators.iter().any(|&k| t.contains(k)) {
            return false;
        }
        true
    };

    yt_list.retain(filter_track);
    let mut sc_filtered = sc_list;
    sc_filtered.retain(filter_track);
    let mut audius_filtered = audius_list;
    audius_filtered.retain(filter_track);

    // Multi-source round-robin interleaving:
    // Guarantees rich variety across YouTube, SoundCloud, and Audius 320K
    let mut combined: Vec<SearchResult> = Vec::new();
    let max_len = yt_list.len().max(sc_filtered.len()).max(audius_filtered.len());

    for i in 0..max_len {
        if i < yt_list.len() {
            combined.push(yt_list[i].clone());
        }
        if i < sc_filtered.len() {
            combined.push(sc_filtered[i].clone());
        }
        if i < audius_filtered.len() {
            combined.push(audius_filtered[i].clone());
        }
    }

    // Deduplicate by title similarity
    let mut unique: Vec<SearchResult> = Vec::new();
    for item in combined {
        let item_title_norm = item.title.trim().to_lowercase();
        if !unique.iter().any(|u| {
            let u_title_norm = u.title.trim().to_lowercase();
            u_title_norm == item_title_norm || u.url_or_id == item.url_or_id
        }) {
            unique.push(item);
        }
    }

    // 3. Keep highest-relevance hits first, gently shuffle remaining alternatives
    let mut prioritized: Vec<SearchResult> = Vec::new();
    if !unique.is_empty() {
        prioritized.push(unique.remove(0));
    }
    if !unique.is_empty() {
        prioritized.push(unique.remove(0));
    }

    use std::time::{SystemTime, UNIX_EPOCH};
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(42) as usize;

    if unique.len() > 1 {
        for i in (1..unique.len()).rev() {
            let j = (seed.wrapping_add(i * 7919)) % (i + 1);
            unique.swap(i, j);
        }
    }
    prioritized.extend(unique);

    if let Ok(mut guard) = RELATED_CACHE.lock() {
        let map = guard.get_or_insert_with(HashMap::new);
        if map.len() > 100 {
            map.clear();
        }
        map.insert(cache_key, prioritized.clone());
    }

    Ok(prioritized)
}

// ─── DATABASE & AUTH COMMANDS ────────────────────────────────────────────────

#[tauri::command]
fn auth_register(
    username: String,
    email: Option<String>,
    password: String,
    display_name: String,
    db: State<'_, DatabaseManager>,
) -> Result<User, String> {
    db.register(&username, email.as_deref(), &password, &display_name)
}

#[tauri::command]
fn auth_login(
    username: String,
    password: String,
    db: State<'_, DatabaseManager>,
) -> Result<User, String> {
    db.login(&username, &password)
}

#[tauri::command]
fn auth_google_login(
    google_id: String,
    email: String,
    display_name: String,
    avatar: Option<String>,
    db: State<'_, DatabaseManager>,
) -> Result<User, String> {
    db.google_login(&google_id, &email, &display_name, avatar.as_deref())
}

#[tauri::command]
async fn auth_start_google_oauth(
    custom_client_id: Option<String>,
    client_secret: Option<String>,
    db: State<'_, DatabaseManager>,
) -> Result<User, String> {
    oauth::perform_google_oauth(custom_client_id, client_secret, &db).await
}

#[tauri::command]
fn auth_import_user(
    id: String,
    username: String,
    email: Option<String>,
    password_hash: String,
    salt: String,
    display_name: String,
    avatar: Option<String>,
    db: State<'_, DatabaseManager>,
) -> Result<User, String> {
    db.import_user(&id, &username, email.as_deref(), &password_hash, &salt, &display_name, avatar.as_deref())
}

#[tauri::command]
fn auth_hash_password(password: String, salt: String) -> String {
    DatabaseManager::hash_password(&password, &salt)
}

#[tauri::command]
fn auth_get_credentials(user_id: String, db: State<'_, DatabaseManager>) -> Option<(String, String)> {
    db.get_user_credentials(&user_id)
}

#[tauri::command]
fn auth_set_two_factor(
    user_id: String,
    secret: String,
    enabled: bool,
    scope: Option<String>,
    db: State<'_, DatabaseManager>,
) -> Result<(), String> {
    db.set_two_factor(&user_id, &secret, enabled, scope.as_deref())
}

#[tauri::command]
fn auth_set_two_factor_scope(
    user_id: String,
    scope: String,
    db: State<'_, DatabaseManager>,
) -> Result<(), String> {
    db.set_two_factor_scope(&user_id, &scope)
}

#[tauri::command]
fn auth_get_user_2fa(
    user_id: String,
    db: State<'_, DatabaseManager>,
) -> Result<(bool, Option<String>, Option<String>), String> {
    db.get_user_2fa(&user_id)
}

#[tauri::command]
fn auth_check_2fa_by_identifier(
    identifier: String,
    db: State<'_, DatabaseManager>,
) -> Result<Option<(String, String, bool, Option<String>)>, String> {
    db.get_user_2fa_by_identifier(&identifier)
}

#[tauri::command]
fn save_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn auth_update_avatar(
    user_id: String,
    avatar: String,
    db: State<'_, DatabaseManager>,
) -> Result<(), String> {
    db.update_avatar(&user_id, &avatar)
}

#[tauri::command]
fn auth_update_password(
    user_id: String,
    new_password: String,
    db: State<'_, DatabaseManager>,
) -> Result<(String, String), String> {
    db.update_password(&user_id, &new_password)
}

#[tauri::command]
fn auth_get_current_user(
    user_id: String,
    db: State<'_, DatabaseManager>,
) -> Result<Option<User>, String> {
    db.get_user_by_id(&user_id)
}

#[tauri::command]
fn auth_get_saved_accounts(db: State<'_, DatabaseManager>) -> Result<Vec<User>, String> {
    db.get_all_local_users()
}

#[tauri::command]
fn db_get_favorites(
    user_id: String,
    db: State<'_, DatabaseManager>,
) -> Result<Vec<Track>, String> {
    db.get_favorites(&user_id)
}

#[tauri::command]
fn db_toggle_favorite(
    user_id: String,
    track: Track,
    db: State<'_, DatabaseManager>,
) -> Result<bool, String> {
    db.toggle_favorite(&user_id, &track)
}

#[tauri::command]
fn db_add_favorite(
    user_id: String,
    track: Track,
    db: State<'_, DatabaseManager>,
) -> Result<(), String> {
    db.add_favorite_if_missing(&user_id, &track)
}

#[tauri::command]
fn db_add_history(
    user_id: String,
    track: Track,
    db: State<'_, DatabaseManager>,
) -> Result<(), String> {
    db.add_history(&user_id, &track)
}

#[tauri::command]
fn db_get_history(
    user_id: String,
    limit: Option<u32>,
    db: State<'_, DatabaseManager>,
) -> Result<Vec<HistoryItem>, String> {
    db.get_history(&user_id, limit.unwrap_or(30))
}

#[tauri::command]
fn db_get_stats(
    user_id: String,
    db: State<'_, DatabaseManager>,
) -> Result<UserStats, String> {
    db.get_stats(&user_id)
}

#[tauri::command]
fn db_save_chat_image(
    id: String,
    url_or_key: String,
    base64_data: String,
    db: State<'_, DatabaseManager>,
) -> Result<(), String> {
    db.save_chat_image(&id, &url_or_key, &base64_data)
}

#[tauri::command]
fn db_get_chat_image(
    id_or_url: String,
    db: State<'_, DatabaseManager>,
) -> Result<Option<String>, String> {
    db.get_chat_image(&id_or_url)
}

#[tauri::command]
fn db_save_server_chat_message(
    id: String,
    server_id: String,
    channel_id: String,
    created_order: i64,
    message_json: String,
    max_messages: usize,
    db: State<'_, DatabaseManager>,
) -> Result<(), String> {
    db.save_server_chat_message(
        &id,
        &server_id,
        &channel_id,
        created_order,
        &message_json,
        max_messages,
    )
}

#[tauri::command]
fn db_get_server_chat_messages(
    server_id: String,
    max_messages: usize,
    db: State<'_, DatabaseManager>,
) -> Result<Vec<String>, String> {
    db.get_server_chat_messages(&server_id, max_messages)
}

#[tauri::command]
fn db_delete_server_chat_message(
    id: String,
    db: State<'_, DatabaseManager>,
) -> Result<(), String> {
    db.delete_server_chat_message(&id)
}

#[tauri::command]
fn db_delete_channel_messages(
    server_id: String,
    channel_id: String,
    db: State<'_, DatabaseManager>,
) -> Result<(), String> {
    db.delete_channel_chat_messages(&server_id, &channel_id)
}

#[tauri::command]
fn db_delete_server_messages(
    server_id: String,
    db: State<'_, DatabaseManager>,
) -> Result<(), String> {
    db.delete_all_server_chat_messages(&server_id)
}

#[tauri::command]
fn db_purge_expired_server_messages(
    server_id: String,
    hours: u32,
    db: State<'_, DatabaseManager>,
) -> Result<usize, String> {
    db.purge_expired_server_messages(&server_id, hours)
}

#[cfg(target_os = "windows")]
fn hide_screen_capture_bar() {
    use std::ffi::c_void;
    type BOOL = i32;
    type HWND = *mut c_void;
    type LPARAM = isize;
    type WNDENUMPROC = unsafe extern "system" fn(HWND, LPARAM) -> BOOL;

    extern "system" {
        fn EnumWindows(lpEnumFunc: WNDENUMPROC, lParam: LPARAM) -> BOOL;
        fn EnumChildWindows(hWndParent: HWND, lpEnumFunc: WNDENUMPROC, lParam: LPARAM) -> BOOL;
        fn GetWindowTextW(hWnd: HWND, lpString: *mut u16, nMaxCount: i32) -> i32;
        fn GetClassNameW(hWnd: HWND, lpClassName: *mut u16, nMaxCount: i32) -> i32;
        fn ShowWindow(hWnd: HWND, nCmdShow: i32) -> BOOL;
        fn SetWindowPos(
            hWnd: HWND,
            hWndInsertAfter: HWND,
            X: i32,
            Y: i32,
            cx: i32,
            cy: i32,
            uFlags: u32,
        ) -> BOOL;
    }

    const SW_HIDE: i32 = 0;
    const SWP_NOSIZE: u32 = 0x0001;
    const SWP_NOZORDER: u32 = 0x0004;
    const SWP_HIDEWINDOW: u32 = 0x0080;

    unsafe extern "system" fn enum_windows_callback(hwnd: HWND, _: LPARAM) -> BOOL {
        let mut class_buf = [0u16; 256];
        let class_len = GetClassNameW(hwnd, class_buf.as_mut_ptr(), 256);
        let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);

        let mut title_buf = [0u16; 512];
        let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), 512);
        let title = String::from_utf16_lossy(&title_buf[..title_len as usize]).to_lowercase();

        let is_target = class_name.contains("ScreenCaptureNotificationUI")
            || ((title.contains("tauri.localhost") || title.contains("localhost:1420"))
                && title.contains("sharing"));

        if is_target {
            ShowWindow(hwnd, SW_HIDE);
            SetWindowPos(hwnd, std::ptr::null_mut(), -9999, -9999, 0, 0, SWP_HIDEWINDOW | SWP_NOSIZE | SWP_NOZORDER);
        }

        unsafe extern "system" fn enum_child_callback(child: HWND, _: LPARAM) -> BOOL {
            let mut title_buf = [0u16; 512];
            let title_len = GetWindowTextW(child, title_buf.as_mut_ptr(), 512);
            let title = String::from_utf16_lossy(&title_buf[..title_len as usize]).to_lowercase();
            let is_target = title.contains("sharing")
                && (title.contains("tauri.localhost") || title.contains("localhost:1420"));
            if is_target {
                ShowWindow(child, SW_HIDE);
                SetWindowPos(child, std::ptr::null_mut(), -9999, -9999, 0, 0, SWP_HIDEWINDOW | SWP_NOSIZE | SWP_NOZORDER);
            }
            1
        }
        EnumChildWindows(hwnd, enum_child_callback, 0);

        1
    }

    unsafe {
        EnumWindows(enum_windows_callback, 0);
    }
}

#[cfg(not(target_os = "windows"))]
fn hide_screen_capture_bar() {}

#[tauri::command]
async fn hide_screen_share_notification() -> Result<(), String> {
    tokio::spawn(async {
        for _ in 0..40 {
            hide_screen_capture_bar();
            tokio::time::sleep(tokio::time::Duration::from_millis(250)).await;
        }
    });
    Ok(())
}

// ─── ON-DEVICE AI COMMANDS ───────────────────────────────────────────────────

#[tauri::command]
fn ai_train_model(
    user_id: String,
    db: State<'_, DatabaseManager>,
) -> Result<TrainingReport, String> {
    Ok(MusicAiEngine::train_model(&user_id, &db))
}

#[tauri::command]
fn ai_recommend_tracks(
    user_id: String,
    candidates: Vec<Track>,
    db: State<'_, DatabaseManager>,
) -> Result<Vec<RecommendationResult>, String> {
    Ok(MusicAiEngine::recommend(&user_id, &candidates, &db))
}

#[tauri::command]
fn ai_smart_dj_next(
    current_track: Track,
    candidates: Vec<Track>,
) -> Result<Option<Track>, String> {
    Ok(MusicAiEngine::smart_dj_next(&current_track, &candidates))
}

#[tauri::command]
fn get_default_download_directory() -> Result<String, String> {
    Ok(downloader::Downloader::get_default_download_dir().to_string_lossy().to_string())
}

#[tauri::command]
async fn download_track(track: Track, target_dir: Option<String>) -> Result<Track, String> {
    downloader::Downloader::download(&track, target_dir).await
}

#[tauri::command]
fn rust_ui_get_snapshot(
    user_id: Option<String>,
    local_tracks: Option<Vec<Track>>,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
    db: State<'_, DatabaseManager>,
) -> Result<RustUiSnapshot, String> {
    if let Some(uid) = user_id {
        rust_ui.sync_from_db(&db, &uid);
    }
    if let Some(locals) = local_tracks {
        rust_ui.set_local_tracks(locals);
    }
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_ui_switch_tab(
    tab: String,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    rust_ui.switch_tab(&tab);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_ui_filter(
    query: String,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    rust_ui.set_search_query(&query);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
async fn rust_ui_search_online(
    query: String,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    let (yt_res, audius_res) = tokio::join!(
        sources::youtube::search_youtube(&query),
        sources::audius::search_audius(&query)
    );
    let mut combined = Vec::new();
    if let Ok(yt) = yt_res {
        combined.extend(yt);
    }
    if let Ok(au) = audius_res {
        combined.extend(au);
    }
    rust_ui.set_search_results(combined);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_ui_play_index(
    index: usize,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<Option<Track>, String> {
    if let Some(track) = rust_ui.get_track_by_index(index) {
        audio.play(track.clone())?;
        return Ok(Some(track));
    }
    Ok(None)
}

#[tauri::command]
fn rust_ui_toggle_play(
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    rust_ui.toggle_play(&audio);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_ui_next(
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    rust_ui.play_next(&audio);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_ui_prev(
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    rust_ui.play_prev(&audio);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_ui_set_volume(
    volume: f32,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    rust_ui.set_volume(&audio, volume);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_ui_seek(
    seconds: u64,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    rust_ui.seek(&audio, seconds);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_ui_toggle_favorite(
    user_id: String,
    track: Track,
    rust_ui: State<'_, RustUiEngine>,
    db: State<'_, DatabaseManager>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    rust_ui.toggle_favorite(&db, &user_id, track);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_ui_sort(
    sort_by: String,
    ascending: bool,
    rust_ui: State<'_, RustUiEngine>,
    audio: State<'_, AudioPlayerManager>,
) -> Result<RustUiSnapshot, String> {
    rust_ui.sort_tracks(&sort_by, ascending);
    Ok(rust_ui.snapshot(&audio))
}

#[tauri::command]
fn rust_sort_tracks(mut tracks: Vec<Track>, sort_by: String, ascending: bool) -> Vec<Track> {
    match sort_by.as_str() {
        "title" => {
            tracks.sort_by(|a, b| {
                let ord = a.title.to_lowercase().cmp(&b.title.to_lowercase());
                if ascending { ord } else { ord.reverse() }
            });
        }
        "artist" => {
            tracks.sort_by(|a, b| {
                let ord = a.artist.to_lowercase().cmp(&b.artist.to_lowercase());
                if ascending { ord } else { ord.reverse() }
            });
        }
        "duration" => {
            tracks.sort_by(|a, b| {
                let ord = a.duration_secs.cmp(&b.duration_secs);
                if ascending { ord } else { ord.reverse() }
            });
        }
        "source" => {
            tracks.sort_by(|a, b| {
                let ord = format!("{:?}", a.source).cmp(&format!("{:?}", b.source));
                if ascending { ord } else { ord.reverse() }
            });
        }
        _ => {}
    }
    tracks
}

#[tauri::command]
fn rust_filter_tracks(tracks: Vec<Track>, query: String) -> Vec<Track> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return tracks;
    }
    tracks
        .into_iter()
        .filter(|t| {
            t.title.to_lowercase().contains(&q)
                || t.artist.to_lowercase().contains(&q)
                || t.album.to_lowercase().contains(&q)
        })
        .collect()
}

#[tauri::command]
fn rust_dedup_tracks(tracks: Vec<Track>) -> Vec<Track> {
    let mut seen = std::collections::HashSet::new();
    let mut res = Vec::with_capacity(tracks.len());
    for t in tracks {
        let key = if !t.path_or_url.is_empty() {
            t.path_or_url.clone()
        } else {
            t.id.clone()
        };
        if seen.insert(key) {
            res.push(t);
        }
    }
    res
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AppUpdateInfo {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_name: String,
    pub published_at: String,
    pub release_notes: String,
    pub download_url: String,
    pub release_url: String,
}

fn compare_semver(v1: &str, v2: &str) -> std::cmp::Ordering {
    let parse = |v: &str| -> Vec<u64> {
        v.trim_start_matches('v')
            .split(&['-', '+'][..])
            .next()
            .unwrap_or("")
            .split('.')
            .map(|s| s.parse::<u64>().unwrap_or(0))
            .collect()
    };

    let p1 = parse(v1);
    let p2 = parse(v2);
    let max_len = p1.len().max(p2.len());

    for i in 0..max_len {
        let n1 = p1.get(i).copied().unwrap_or(0);
        let n2 = p2.get(i).copied().unwrap_or(0);
        match n1.cmp(&n2) {
            std::cmp::Ordering::Equal => continue,
            other => return other,
        }
    }
    std::cmp::Ordering::Equal
}

#[tauri::command]
async fn check_for_updates(_current_build_date: Option<String>) -> Result<AppUpdateInfo, String> {
    let client = reqwest::Client::builder()
        .user_agent("Spytify-Desktop-App/0.1.1")
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get("https://api.github.com/repos/anhdangtutien/Spytify/releases/latest")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Không thể kết nối đến GitHub: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("GitHub API trả về mã lỗi: {}", res.status()));
    }

    let data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Lỗi phân tích JSON từ GitHub: {}", e))?;

    let tag_name = data["tag_name"].as_str().unwrap_or("").to_string();
    let published_at = data["published_at"].as_str().unwrap_or("").to_string();
    let name = data["name"].as_str().unwrap_or("").to_string();
    let body = data["body"].as_str().unwrap_or("").to_string();
    let html_url = data["html_url"]
        .as_str()
        .unwrap_or("https://github.com/anhdangtutien/Spytify/releases")
        .to_string();

    let exe_asset = data["assets"].as_array().and_then(|arr| {
        arr.iter().find(|a| {
            a["name"]
                .as_str()
                .map(|n| n.ends_with(".exe"))
                .unwrap_or(false)
        })
    });

    let exe_updated_at = exe_asset
        .and_then(|a| a["updated_at"].as_str().or_else(|| a["created_at"].as_str()))
        .unwrap_or("")
        .to_string();

    let download_url = exe_asset
        .and_then(|a| a["browser_download_url"].as_str())
        .unwrap_or(&html_url)
        .to_string();

    let current_version = env!("CARGO_PKG_VERSION");
    let clean_tag = tag_name.trim_start_matches('v').to_string();

    // Prioritize the actual .exe binary asset update timestamp (for patch builds without version bump)
    let effective_remote_date = if !exe_updated_at.is_empty() {
        exe_updated_at
    } else {
        published_at
    };

    let cmp = compare_semver(&clean_tag, current_version);
    let is_newer_version = cmp == std::cmp::Ordering::Greater;

    // Chỉ thông báo có cập nhật khi phiên bản trên GitHub thực sự lớn hơn phiên bản hiện tại
    let has_update = is_newer_version;

    Ok(AppUpdateInfo {
        has_update,
        current_version: format!("v{}", current_version),
        latest_version: tag_name,
        release_name: if name.is_empty() {
            format!("Spytify v{}", clean_tag)
        } else {
            name
        },
        published_at: effective_remote_date,
        release_notes: body,
        download_url,
        release_url: html_url,
    })
}

#[derive(serde::Serialize, Clone)]
struct UpdateProgressPayload {
    percentage: u32,
    downloaded_bytes: u64,
    total_bytes: u64,
    downloaded_mb: String,
    total_mb: String,
}

#[tauri::command]
async fn download_and_install_update(
    app: tauri::AppHandle,
    download_url: String,
) -> Result<(), String> {
    use std::io::Write;
    use tauri::Emitter;

    if download_url.is_empty() {
        return Err("Đường dẫn tải bản cập nhật không hợp lệ.".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("Spytify-Desktop-App/1.1.4")
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    // If download_url is a GitHub releases webpage instead of a direct .exe/.msi binary,
    // automatically resolve the direct .exe asset browser_download_url via GitHub API
    let mut resolved_url = download_url.trim().to_string();
    let lower_url = resolved_url.to_lowercase();
    if !lower_url.ends_with(".exe") && !lower_url.ends_with(".msi") {
        if let Ok(api_res) = client
            .get("https://api.github.com/repos/anhdangtutien/Spytify/releases/latest")
            .header("Accept", "application/vnd.github.v3+json")
            .send()
            .await
        {
            if let Ok(data) = api_res.json::<serde_json::Value>().await {
                if let Some(assets) = data["assets"].as_array() {
                    if let Some(exe) = assets
                        .iter()
                        .find(|a| {
                            a["name"]
                                .as_str()
                                .map(|n| n.ends_with("-setup.exe") || n.ends_with(".exe"))
                                .unwrap_or(false)
                        })
                        .and_then(|a| a["browser_download_url"].as_str())
                    {
                        resolved_url = exe.to_string();
                    }
                }
            }
        }
    }

    let mut res = client
        .get(&resolved_url)
        .header("Accept", "application/octet-stream")
        .send()
        .await
        .map_err(|e| format!("Không thể kết nối tải bản cập nhật: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Lỗi máy chủ tải file (HTTP {})", res.status()));
    }

    let total_bytes = res.content_length().unwrap_or(0);
    let temp_dir = std::env::temp_dir();
    let dest_path = temp_dir.join("Spytify_Update_Setup.exe");

    let mut file = std::fs::File::create(&dest_path)
        .map_err(|e| format!("Không thể tạo file tạm trong ổ đĩa: {}", e))?;

    let mut downloaded: u64 = 0;
    let mut last_percent: u32 = 0;
    let mut magic_header: Vec<u8> = Vec::with_capacity(2);

    while let Some(chunk) = res.chunk().await.map_err(|e| format!("Lỗi khi đang tải file: {}", e))? {
        if magic_header.len() < 2 {
            for &b in chunk.iter() {
                if magic_header.len() < 2 {
                    magic_header.push(b);
                }
            }
        }
        file.write_all(&chunk)
            .map_err(|e| format!("Lỗi ghi file vào ổ đĩa: {}", e))?;
        downloaded += chunk.len() as u64;

        if total_bytes > 0 {
            let percentage = ((downloaded as f64 / total_bytes as f64) * 100.0) as u32;
            if percentage != last_percent {
                last_percent = percentage;
                let payload = UpdateProgressPayload {
                    percentage,
                    downloaded_bytes: downloaded,
                    total_bytes,
                    downloaded_mb: format!("{:.1}", downloaded as f64 / 1_048_576.0),
                    total_mb: format!("{:.1}", total_bytes as f64 / 1_048_576.0),
                };
                let _ = app.emit("update-download-progress", payload);
            }
        }
    }

    file.flush()
        .map_err(|e| format!("Lỗi hoàn tất file cập nhật: {}", e))?;
    drop(file);

    // Verify downloaded file is a valid Windows PE executable ("MZ" header)
    if magic_header.len() < 2 || magic_header[0] != 0x4D || magic_header[1] != 0x5A {
        let _ = std::fs::remove_file(&dest_path);
        return Err("Bản cập nhật đang được hệ thống đóng gói trên máy chủ. Vui lòng thử lại sau ít phút!".to_string());
    }

    let _ = app.emit("update-download-progress", UpdateProgressPayload {
        percentage: 100,
        downloaded_bytes: downloaded,
        total_bytes: downloaded,
        downloaded_mb: format!("{:.1}", downloaded as f64 / 1_048_576.0),
        total_mb: format!("{:.1}", downloaded as f64 / 1_048_576.0),
    });

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let current_exe = std::env::current_exe()
            .unwrap_or_else(|_| std::path::PathBuf::from("Spytify.exe"));
        let current_pid = std::process::id();
        let dest_str = dest_path.to_string_lossy().replace('\'', "''");
        let exe_str = current_exe.to_string_lossy().replace('\'', "''");

        // Silent in-place update (/S /UPDATE): waits for current app to exit, silently updates in-place without uninstall prompts, then relaunches app
        let ps_script = format!(
            "for ($i = 0; $i -lt 40; $i++) {{ if (-not (Get-Process -Id {pid} -ErrorAction SilentlyContinue)) {{ break }}; Start-Sleep -Milliseconds 250 }}; \
             Start-Sleep -Milliseconds 300; \
             Start-Process -FilePath '{installer}' -ArgumentList '/S', '/UPDATE' -Wait; \
             Start-Sleep -Milliseconds 300; \
             Start-Process -FilePath '{exe}'",
            pid = current_pid,
            installer = dest_str,
            exe = exe_str
        );

        std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &ps_script])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Không thể khởi chạy bộ cài đặt tự động: {}", e))?;

        let app_handle = app.clone();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(400)).await;
            app_handle.exit(0);
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("open").arg(&dest_path).spawn();
    }

    Ok(())
}

#[tauri::command]
fn get_launch_on_startup() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let output = std::process::Command::new("reg")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "Spytify",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("Không thể kiểm tra Registry Windows: {}", e))?;
        return Ok(output.status.success());
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[tauri::command]
fn set_launch_on_startup(enabled: bool) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
        if enabled {
            let exe_path = std::env::current_exe()
                .map_err(|e| format!("Không thể xác định đường dẫn ứng dụng: {}", e))?;
            let quoted = format!("\"{}\"", exe_path.to_string_lossy());
            let output = std::process::Command::new("reg")
                .args(["add", RUN_KEY, "/v", "Spytify", "/t", "REG_SZ", "/d", &quoted, "/f"])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .map_err(|e| format!("Không thể ghi Registry Windows: {}", e))?;
            if !output.status.success() {
                let err_msg = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Không thể bật khởi động cùng Windows: {}", err_msg.trim()));
            }
            return Ok(true);
        } else {
            let _ = std::process::Command::new("reg")
                .args(["delete", RUN_KEY, "/v", "Spytify", "/f"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            return Ok(false);
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = enabled;
        Err("Tính năng khởi động cùng Windows chỉ khả dụng trên hệ điều hành Windows.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    {
        // Fix Windows WebView2 screen/window capture quadrant clipping & high-DPI scaling bug (capturing top-left 1/4 with rest black)
        let current_args = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
        let wgc_flags = "--enable-features=AllowWgcWindowCapturer,AllowWgcDesktopCapturer";
        let combined = if current_args.is_empty() {
            wgc_flags.to_string()
        } else if !current_args.contains("AllowWgcWindowCapturer") {
            format!("{} {}", current_args, wgc_flags)
        } else {
            current_args
        };
        std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", combined);
    }

    let audio_manager = AudioPlayerManager::new();
    let db_manager = DatabaseManager::new().expect("Failed to initialize SQLite database");
    let rust_ui_engine = RustUiEngine::new();

    tauri::Builder::default()
        .manage(audio_manager)
        .manage(db_manager)
        .manage(rust_ui_engine)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
                let _ = window.emit("app-window-state", "normal");
            }
        }))
        .setup(|app| {
            // Start local audio CORS streaming proxy for Web Audio & WebRTC broadcast
            proxy::start_audio_proxy();

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
                #[cfg(debug_assertions)]
                let _ = window.open_devtools();
            }

            // Setup System Tray
            let show_i = MenuItem::with_id(app, "show", "Hiện Spytify", true, None::<&str>)?;
            let toggle_play_i = MenuItem::with_id(app, "toggle_play", "Tạm dừng / Phát tiếp", true, None::<&str>)?;
            let prev_i = MenuItem::with_id(app, "prev", "Bài trước đó", true, None::<&str>)?;
            let next_i = MenuItem::with_id(app, "next", "Bài tiếp theo", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Thoát ứng dụng", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &toggle_play_i, &prev_i, &next_i, &quit_i])?;

            let mut builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Spytify - Spy Music")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                                let _ = window.emit("app-window-state", "normal");
                            }
                        }
                        "toggle_play" => {
                            let _ = app.emit("tray-toggle-play", ());
                        }
                        "prev" => {
                            let _ = app.emit("tray-prev-track", ());
                        }
                        "next" => {
                            let _ = app.emit("tray-next-track", ());
                        }
                        "quit" => {
                            let _ = app.emit("app-close-requested", ());
                            if !IS_EXITING.swap(true, Ordering::SeqCst) {
                                let app_handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
                                    app_handle.exit(0);
                                });
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                            let _ = window.emit("app-window-state", "normal");
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone());
            }

            builder.build(app)?;

            // Background dynamic RAM watchdog (Keeps foreground RAM around ~200MB, tray ~30-60MB)
            #[cfg(target_os = "windows")]
            {
                std::thread::spawn(|| {
                    loop {
                        std::thread::sleep(std::time::Duration::from_secs(15));
                        // If total process tree exceeds ~210MB, gently trim back down to maintain ~200MB range
                        if get_tree_working_set() > 210 * 1024 * 1024 {
                            trim_single_process_tree();
                        }
                    }
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    if CLOSE_TO_TRAY.load(Ordering::SeqCst) {
                        api.prevent_close();
                        let _ = window.hide();
                        let _ = window.emit("app-window-state", "hidden");
                        trim_process_memory();
                    } else {
                        let _ = window.emit("app-close-requested", ());
                        api.prevent_close();
                        if !IS_EXITING.swap(true, Ordering::SeqCst) {
                            tauri::async_runtime::spawn(async move {
                                tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
                                std::process::exit(0);
                            });
                        }
                    }
                }
                WindowEvent::Resized(_) => {
                    if let Ok(true) = window.is_minimized() {
                        let _ = window.emit("app-window-state", "minimized");
                        trim_process_memory();
                    } else {
                        let _ = window.emit("app-window-state", "normal");
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            set_close_to_tray,
            get_close_to_tray,
            set_mini_player_mode,
            open_mini_player_window,
            close_mini_player_window,
            exit_app,
            scan_music_folder,
            play_track,
            pause_track,
            resume_track,
            stop_track,
            set_volume,
            seek_track,
            get_playback_status,
            search_online,
            get_search_suggestions,
            get_related_tracks,
            get_trending_hits,
            get_trending_keywords,
            get_artist_album_mix,
            auth_register,
            auth_login,
            auth_google_login,
            auth_start_google_oauth,
            auth_get_current_user,
            auth_get_saved_accounts,
            auth_update_avatar,
            auth_update_password,
            auth_import_user,
            auth_hash_password,
            auth_get_credentials,
            auth_set_two_factor,
            auth_set_two_factor_scope,
            auth_get_user_2fa,
            auth_check_2fa_by_identifier,
            save_text_file,
            read_text_file,
            db_get_favorites,
            db_toggle_favorite,
            db_add_favorite,
            db_add_history,
            db_get_history,
            db_get_stats,
            ai_train_model,
            ai_recommend_tracks,
            ai_smart_dj_next,
            get_default_download_directory,
            download_track,
            trim_memory,
            get_lan_stream_info,
            resolve_youtube_music_stream,
            resolve_audius_stream,
            rust_ui_get_snapshot,
            rust_ui_switch_tab,
            rust_ui_filter,
            rust_ui_search_online,
            rust_ui_play_index,
            rust_ui_toggle_play,
            rust_ui_next,
            rust_ui_prev,
            rust_ui_set_volume,
            rust_ui_seek,
            rust_ui_toggle_favorite,
            rust_ui_sort,
            rust_sort_tracks,
            rust_filter_tracks,
            rust_dedup_tracks,
            check_for_updates,
            download_and_install_update,
            get_launch_on_startup,
            set_launch_on_startup,
            db_save_chat_image,
            db_get_chat_image,
            db_save_server_chat_message,
            db_get_server_chat_messages,
            db_delete_server_chat_message,
            db_delete_channel_messages,
            db_delete_server_messages,
            db_purge_expired_server_messages,
            hide_screen_share_notification
        ])
        .run(tauri::generate_context!())
        .expect("error while running soundify application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_resolve_stream() {
        let res = sources::youtube::resolve_youtube_music_stream("5qm8PH4xAss", "Midsummer Madness", "88rising").await;
        println!("Resolve stream result: {:?}", res);
    }
}
