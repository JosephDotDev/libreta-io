//! Libreta desktop shell.
//!
//! The whole app is the plain HTML/CSS/JS in `dist/` (assembled by
//! `scripts/build-dist.js`). This crate only wraps it in a native window and
//! grants the page a few narrowly-scoped capabilities (see
//! `capabilities/default.json`): native Save/Open dialogs, file access limited to
//! what the user picked in those dialogs (a save target, or the workspace folder),
//! opening links in the system browser, and receiving the `libreta://` callback
//! Google redirects to after sign-in. The JavaScript side of that bridge is
//! `js/core/platform.js`; the folder workspace lives in `js/core/workspace.js`.

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

/// `libreta://…` is how Google hands the user back after signing in through their
/// browser. Sign-in opens the system browser, the provider redirects to this
/// scheme, the OS wakes Libreta, and `platform.js` passes the URL to the sync
/// layer, which turns it into a session.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // Windows and Linux deliver a deep link by launching the binary again with the
    // URL as an argument. single-instance forwards it to the window already open
    // instead — and must be registered before anything else.
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _argv, _cwd| {}));

    builder
        .plugin(tauri_plugin_deep_link::init())
        .setup(|_app| {
            // Installers register the scheme system-wide; a dev build has never been
            // installed, so claim it at runtime to make sign-in testable with
            // `npm run desktop:dev`.
            #[cfg(all(desktop, debug_assertions))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = _app.deep_link().register_all();
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        // The user picks a workspace folder in a native dialog; that grants the page
        // access to it for this session. persisted-scope saves that grant so the folder
        // is readable again on the next launch without asking twice.
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(navigation_guard())
        .run(tauri::generate_context!())
        .expect("error while running Libreta");
}
