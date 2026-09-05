/* ═══════════════════════════════════════════════
   PLATFORM BRIDGE — browser vs. desktop (Tauri) differences, in ONE place.

   Libreta is plain HTML/CSS/JS and runs identically in a browser tab and inside
   the Tauri desktop shell. Two things a webview cannot do the browser way:
     • "download" a Blob via <a download> — the shell has no download manager, so
       we open a native Save dialog and write the bytes ourselves;
     • open a link in a new tab — target="_blank" / window.open would try to
       navigate the app's own window, so external URLs go to the system browser.
   Every call site uses saveFileToDisk() / openExternal() and never needs to know
   which environment it is in. Loads first (before state.js): no dependencies.

   Desktop detection is `window.__TAURI__`, injected by the shell
   (tauri.conf.json → app.withGlobalTauri). The plugin namespaces used here are
   dialog, fs, opener, path and app; each is granted in src-tauri/capabilities/.
═══════════════════════════════════════════════ */
/* Three different questions, three answers:
     IS_NATIVE  — running inside the Tauri shell at all (desktop or Android).
     IS_MOBILE  — that shell is a phone/tablet build.
     IS_DESKTOP — a real computer, i.e. native and not mobile.
   The distinction matters: Android has the same __TAURI__ bridge but no folder
   picker (tauri-plugin-dialog returns FolderPickerNotImplemented on mobile), so
   anything folder-shaped must check IS_DESKTOP, not IS_NATIVE. */
const IS_NATIVE  = typeof window !== 'undefined' && !!window.__TAURI__;
const IS_MOBILE  = IS_NATIVE && /Android|iPhone|iPad|iPod/i.test((typeof navigator!=='undefined'&&navigator.userAgent)||'');
const IS_DESKTOP = IS_NATIVE && !IS_MOBILE;

/* The running app version, read from the bundle itself (tauri.conf.json and
   Cargo.toml keep it in step). Memoised as a promise so concurrent callers share
   one IPC round-trip. Resolves to '' in a browser, where there is no install. */
let _appVer;
function appVersion(){
  if(_appVer) return _appVer;
  try{ _appVer = IS_NATIVE ? window.__TAURI__.app.getVersion().catch(()=>'') : Promise.resolve(''); }
  catch(e){ _appVer = Promise.resolve(''); }
  return _appVer;
}

/* Save a Blob under `filename`.
   Desktop: native Save dialog (defaulting to the Downloads folder) → write bytes.
   Browser: the classic <a download> click.
   Resolves true when a file was written / the download was started, false when
   the user cancelled the dialog. Rejects only on a real write error. */
async function saveFileToDisk(blob, filename){
  filename = String(filename || 'download').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'download';
  if(!IS_NATIVE){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
    return true;
  }
  const T = window.__TAURI__;
  let defaultPath = filename;
  try{ defaultPath = await T.path.join(await T.path.downloadDir(), filename); }catch(e){ /* fall back to a bare name */ }
  const ext = (filename.match(/\.([a-z0-9]{1,8})$/i) || [])[1];
  const filters = ext ? [{ name: ext.toUpperCase() + ' file', extensions: [ext] }] : [];
  const path = await T.dialog.save({ defaultPath, filters, title: 'Save ' + filename });
  if(!path) return false;   // user cancelled
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await T.fs.writeFile(path, bytes);   // path was just chosen in the dialog, so it is in the fs scope
  return true;
}

/* Open a URL outside the app: system browser on desktop, new tab in a browser.
   Only web/mail/tel schemes leave the app — anything else is dropped. */
function openExternal(url){
  url = String(url || '');
  if(!/^(https?:|mailto:|tel:)/i.test(url)) return;
  if(IS_NATIVE){ window.__TAURI__.opener.openUrl(url).catch(e=>console.warn('[platform] openUrl failed', e)); return; }
  window.open(url, '_blank', 'noopener');
}

if(IS_NATIVE){
  /* Any anchor that points off the app — a mention, a bookmark, a link typed into a
     page, a property URL — must not navigate the app window. Capture phase so it
     runs before per-element onclick handlers (which themselves call openExternal)
     and stopPropagation keeps those from double-opening. Same-document (#hash)
     and app-relative links are left alone. */
  document.addEventListener('click', e=>{
    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if(!a) return;
    const href = a.getAttribute('href') || '';
    if(!/^(https?:|mailto:|tel:)/i.test(href)) return;   // internal link → normal handling
    e.preventDefault(); e.stopPropagation();
    openExternal(a.href);
  }, true);
  /* A file or URL dropped outside one of the app's own drop zones would otherwise
     navigate the webview to it (the shell has native drag-drop turned off so the
     app's HTML5 drop handlers work). Swallow anything nobody handled. */
  window.addEventListener('dragover', e=>{ if(!e.defaultPrevented) e.preventDefault(); });
  window.addEventListener('drop', e=>{ if(!e.defaultPrevented) e.preventDefault(); });
}
