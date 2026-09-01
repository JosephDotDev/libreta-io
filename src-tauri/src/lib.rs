//! Libreta desktop shell.
//!
//! The whole app is the plain HTML/CSS/JS in `dist/` (assembled by
//! `scripts/build-dist.js`). This crate only wraps it in a native window and
//! grants the page three narrowly-scoped capabilities (see
//! `capabilities/default.json`): a native Save dialog, writing the file picked in
//! that dialog, and opening links in the system browser. The JavaScript side of
//! that bridge is `js/core/platform.js`.

use tauri::{
    plugin::{Builder as PluginBuilder, TauriPlugin},
    Runtime, Url,
};

/// URLs the main webview itself is allowed to navigate to.
///
/// The page is served from Tauri's custom protocol: `tauri://localhost` on
/// macOS and Linux, `https://tauri.localhost` on Windows (`useHttpsScheme`).
/// Anything else — a link typed into a page, a dropped URL — must never replace
/// the app; `platform.js` routes those to the system browser first, and this is
/// the backstop in case something slips past it.
fn is_app_url(url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "about" => true,
        "http" | "https" => matches!(url.host_str(), Some("tauri.localhost")),
        _ => false,
    }
}

/// Embedded frames the page legitimately loads (YouTube players). Kept in sync
/// with `frame-src` in `tauri.conf.json`; listed here because some webviews
/// consult the navigation handler for sub-frames too.
fn is_embed_url(url: &Url) -> bool {
    url.scheme() == "https"
        && matches!(
            url.host_str(),
            Some("www.youtube.com") | Some("www.youtube-nocookie.com")
        )
}

fn navigation_guard<R: Runtime>() -> TauriPlugin<R> {
    PluginBuilder::new("navigation-guard")
        .on_navigation(|_webview, url| {
            let allowed = is_app_url(url) || is_embed_url(url);
            if !allowed {
                eprintln!("[libreta] blocked navigation to {url}");
            }
            allowed
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(navigation_guard())
        .run(tauri::generate_context!())
        .expect("error while running Libreta");
}
