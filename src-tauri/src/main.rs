// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
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

    snutify_lib::run()
}
