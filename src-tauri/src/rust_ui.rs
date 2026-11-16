use crate::audio::AudioPlayerManager;
use crate::db::DatabaseManager;
use crate::models::{PlaybackStatus, SearchResult, Track, TrackSource};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RustUiSnapshot {
    pub active_tab: String,
    pub search_query: String,
    pub tracks: Vec<Track>,
    pub playback: PlaybackStatus,
    pub recommend_mode: String,
    pub ram_saved_mode: bool,
    pub sort_by: String,
    pub sort_asc: bool,
    pub favorite_ids: Vec<String>,
    pub rendered_blitz_html: String,
}

#[derive(Clone)]
pub struct RustUiEngine {
    inner: Arc<Mutex<RustUiState>>,
}

struct RustUiState {
    pub active_tab: String,
    pub search_query: String,
    pub tracks: Vec<Track>,
    pub local_tracks: Vec<Track>,
    pub favorite_tracks: Vec<Track>,
    pub search_tracks: Vec<Track>,
    pub recommend_mode: String,
    pub ram_saved_mode: bool,
    pub sort_by: String,
    pub sort_asc: bool,
}

impl RustUiEngine {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(RustUiState {
                active_tab: "favorites".to_string(),
                search_query: String::new(),
                tracks: Vec::new(),
                local_tracks: Vec::new(),
                favorite_tracks: Vec::new(),
                search_tracks: Vec::new(),
                recommend_mode: "mix".to_string(),
                ram_saved_mode: false,
                sort_by: "default".to_string(),
                sort_asc: true,
            })),
        }
    }

    pub fn sync_from_db(&self, db: &DatabaseManager, user_id: &str) {
        if let Ok(favs) = db.get_favorites(user_id) {
            if let Ok(mut st) = self.inner.lock() {
                st.favorite_tracks = favs.clone();
                if st.active_tab == "favorites" {
                    let filtered = Self::filter_tracks(&st.favorite_tracks, &st.search_query);
                    st.tracks = Self::apply_sort(filtered, &st.sort_by, st.sort_asc);
                }
            }
        }
    }

    pub fn set_local_tracks(&self, tracks: Vec<Track>) {
        if let Ok(mut st) = self.inner.lock() {
            st.local_tracks = tracks;
            if st.active_tab == "local" {
                let filtered = Self::filter_tracks(&st.local_tracks, &st.search_query);
                st.tracks = Self::apply_sort(filtered, &st.sort_by, st.sort_asc);
            }
        }
    }

    pub fn switch_tab(&self, tab: &str) {
        if let Ok(mut st) = self.inner.lock() {
            st.active_tab = tab.to_string();
            let base = match tab {
                "local" => Self::filter_tracks(&st.local_tracks, &st.search_query),
                "favorites" => Self::filter_tracks(&st.favorite_tracks, &st.search_query),
                _ => st.search_tracks.clone(),
            };
            st.tracks = Self::apply_sort(base, &st.sort_by, st.sort_asc);
        }
    }

    pub fn set_search_query(&self, query: &str) {
        if let Ok(mut st) = self.inner.lock() {
            st.search_query = query.to_string();
            let base = match st.active_tab.as_str() {
                "local" => Self::filter_tracks(&st.local_tracks, &st.search_query),
                "favorites" => Self::filter_tracks(&st.favorite_tracks, &st.search_query),
                _ => Self::filter_tracks(&st.search_tracks, &st.search_query),
            };
            st.tracks = Self::apply_sort(base, &st.sort_by, st.sort_asc);
        }
    }

    pub fn set_search_results(&self, results: Vec<SearchResult>) {
        let converted: Vec<Track> = results
            .into_iter()
            .map(|r| Track {
                id: format!("rust_{}", r.url_or_id),
                title: r.title,
                artist: r.artist,
                album: r.album,
                duration_secs: r.duration_secs,
                path_or_url: r.url_or_id,
                cover_art: r.thumbnail,
                source: r.source,
                file_size_bytes: None,
            })
            .collect();

        if let Ok(mut st) = self.inner.lock() {
            st.search_tracks = converted.clone();
            st.active_tab = "search".to_string();
            st.tracks = Self::apply_sort(converted, &st.sort_by, st.sort_asc);
        }
    }

    pub fn sort_tracks(&self, sort_by: &str, ascending: bool) {
        if let Ok(mut st) = self.inner.lock() {
            st.sort_by = sort_by.to_string();
            st.sort_asc = ascending;
            let current = st.tracks.clone();
            st.tracks = Self::apply_sort(current, &st.sort_by, st.sort_asc);
        }
    }

    pub fn toggle_favorite(&self, db: &DatabaseManager, user_id: &str, track: Track) -> bool {
        let is_fav = db.toggle_favorite(user_id, &track).unwrap_or(false);
        if let Ok(mut st) = self.inner.lock() {
            if is_fav {
                if !st.favorite_tracks.iter().any(|t| t.id == track.id) {
                    st.favorite_tracks.insert(0, track);
                }
            } else {
                st.favorite_tracks.retain(|t| t.id != track.id);
            }
            if st.active_tab == "favorites" {
                let filtered = Self::filter_tracks(&st.favorite_tracks, &st.search_query);
                st.tracks = Self::apply_sort(filtered, &st.sort_by, st.sort_asc);
            }
        }
        is_fav
    }

    pub fn toggle_play(&self, audio: &AudioPlayerManager) -> PlaybackStatus {
        let status = audio.get_status();
        if status.is_playing {
            let _ = audio.pause();
        } else if status.current_track.is_some() {
            let _ = audio.resume();
        } else if let Some(first_track) = self.get_track_by_index(0) {
            let _ = audio.play(first_track);
        }
        audio.get_status()
    }

    pub fn play_next(&self, audio: &AudioPlayerManager) -> Option<Track> {
        let status = audio.get_status();
        let cur_id = status.current_track.as_ref().map(|t| t.id.as_str());
        if let Some(next_track) = self.get_adjacent_track(cur_id, true) {
            let _ = audio.play(next_track.clone());
            return Some(next_track);
        }
        None
    }

    pub fn play_prev(&self, audio: &AudioPlayerManager) -> Option<Track> {
        let status = audio.get_status();
        let cur_id = status.current_track.as_ref().map(|t| t.id.as_str());
        if let Some(prev_track) = self.get_adjacent_track(cur_id, false) {
            let _ = audio.play(prev_track.clone());
            return Some(prev_track);
        }
        None
    }

    pub fn set_volume(&self, audio: &AudioPlayerManager, volume: f32) -> PlaybackStatus {
        let _ = audio.set_volume(volume);
        audio.get_status()
    }

    pub fn seek(&self, audio: &AudioPlayerManager, seconds: u64) -> PlaybackStatus {
        let _ = audio.seek(seconds);
        audio.get_status()
    }

    pub fn cycle_recommend_mode(&self) -> String {
        if let Ok(mut st) = self.inner.lock() {
            st.recommend_mode = match st.recommend_mode.as_str() {
                "fresh" => "mix".to_string(),
                "mix" => "off".to_string(),
                _ => "fresh".to_string(),
            };
            return st.recommend_mode.clone();
        }
        "mix".to_string()
    }

    pub fn get_track_by_index(&self, index: usize) -> Option<Track> {
        self.inner
            .lock()
            .ok()
            .and_then(|st| st.tracks.get(index).cloned())
    }

    pub fn get_adjacent_track(&self, current_id: Option<&str>, forward: bool) -> Option<Track> {
        let st = self.inner.lock().ok()?;
        if st.tracks.is_empty() {
            return None;
        }
        let cur_idx = current_id
            .and_then(|cid| st.tracks.iter().position(|t| t.id == cid))
            .unwrap_or(0);

        let next_idx = if forward {
            (cur_idx + 1) % st.tracks.len()
        } else if cur_idx == 0 {
            st.tracks.len() - 1
        } else {
            cur_idx - 1
        };

        st.tracks.get(next_idx).cloned()
    }

    fn filter_tracks(source: &[Track], query: &str) -> Vec<Track> {
        let q = query.trim().to_lowercase();
        if q.is_empty() {
            return source.to_vec();
        }
        source
            .iter()
            .filter(|t| {
                t.title.to_lowercase().contains(&q)
                    || t.artist.to_lowercase().contains(&q)
                    || t.album.to_lowercase().contains(&q)
            })
            .cloned()
            .collect()
    }

    fn apply_sort(mut tracks: Vec<Track>, sort_by: &str, ascending: bool) -> Vec<Track> {
        match sort_by {
            "title" => {
                tracks.sort_by(|a, b| {
                    if ascending {
                        a.title.to_lowercase().cmp(&b.title.to_lowercase())
                    } else {
                        b.title.to_lowercase().cmp(&a.title.to_lowercase())
                    }
                });
            }
            "artist" => {
                tracks.sort_by(|a, b| {
                    if ascending {
                        a.artist.to_lowercase().cmp(&b.artist.to_lowercase())
                    } else {
                        b.artist.to_lowercase().cmp(&a.artist.to_lowercase())
                    }
                });
            }
            "duration" => {
                tracks.sort_by(|a, b| {
                    if ascending {
                        a.duration_secs.cmp(&b.duration_secs)
                    } else {
                        b.duration_secs.cmp(&a.duration_secs)
                    }
                });
            }
            _ => {}
        }
        tracks
    }

    /// Generates Blitz/Stylo-compatible pure Flexbox layout HTML in Rust (0 JS Virtual DOM overhead)
    pub fn snapshot(&self, audio: &AudioPlayerManager) -> RustUiSnapshot {
        let playback = audio.get_status();
        let st = self.inner.lock().unwrap();

        let cur_id = playback
            .current_track
            .as_ref()
            .map(|t| t.id.as_str())
            .unwrap_or("");

        let favorite_ids: Vec<String> = st.favorite_tracks.iter().map(|t| t.id.clone()).collect();
        let fav_set: std::collections::HashSet<&str> =
            favorite_ids.iter().map(|s| s.as_str()).collect();

        let mut rows_html = String::with_capacity(st.tracks.len() * 300);
        for (idx, t) in st.tracks.iter().enumerate() {
            let is_active = t.id == cur_id;
            let is_fav = fav_set.contains(t.id.as_str());
            let row_bg = if is_active {
                "background:rgba(255,42,85,0.18);border-left:3px solid #ff2a55;"
            } else {
                "border-bottom:1px solid rgba(255,255,255,0.04);"
            };
            let mins = t.duration_secs / 60;
            let secs = t.duration_secs % 60;
            let src_badge = match t.source {
                TrackSource::Local => "LOCAL",
                TrackSource::YouTube => "YT MUSIC",
                TrackSource::Audius => "AUDIUS 320K",
                TrackSource::SoundCloud => "SOUNDCLOUD",
            };
            let fav_color = if is_fav { "#ff2a55" } else { "#555566" };
            let fav_icon = if is_fav { "♥" } else { "♡" };

            rows_html.push_str(&format!(
                r#"<div class="blitz-row" data-idx="{idx}" style="display:flex;align-items:center;padding:8px 12px;cursor:pointer;font-size:13px;{row_bg}">
                    <span style="width:32px;color:#888;font-family:monospace;">{num}</span>
                    <button class="blitz-fav-btn" data-idx="{idx}" style="background:none;border:none;cursor:pointer;color:{fav_color};font-size:16px;padding:0 8px 0 0;line-height:1;">{fav_icon}</button>
                    <div style="flex:1;min-width:0;padding-right:12px;">
                        <div style="font-weight:600;color:{title_col};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{title}</div>
                        <div style="font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{artist}</div>
                    </div>
                    <span style="width:100px;font-size:10px;font-weight:700;color:#10b981;text-align:center;">{src_badge}</span>
                    <span style="width:52px;text-align:right;font-family:monospace;color:#999;">{mins}:{secs:02}</span>
                </div>"#,
                idx = idx,
                num = idx + 1,
                row_bg = row_bg,
                fav_color = fav_color,
                fav_icon = fav_icon,
                title_col = if is_active { "#ff2a55" } else { "#e5e7eb" },
                title = html_escape(&t.title),
                artist = html_escape(&t.artist),
                src_badge = src_badge,
                mins = mins,
                secs = secs
            ));
        }

        RustUiSnapshot {
            active_tab: st.active_tab.clone(),
            search_query: st.search_query.clone(),
            tracks: st.tracks.clone(),
            playback,
            recommend_mode: st.recommend_mode.clone(),
            ram_saved_mode: st.ram_saved_mode,
            sort_by: st.sort_by.clone(),
            sort_asc: st.sort_asc,
            favorite_ids,
            rendered_blitz_html: rows_html,
        }
    }
}

fn html_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
