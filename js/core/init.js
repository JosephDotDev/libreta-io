
/* ── INIT (async: load media, migrate legacy inline images, then render) ── */
(async()=>{
  applyCfg();        // apply the cached theme up front so the boot cover isn't the default theme
  await DB.load();   // hydrate the in-memory docs/tables cache (+ one-time legacy migration)
  try{ if(typeof migrateDecoupleDefaultDb==='function') migrateDecoupleDefaultDb(); }catch(e){ console.warn('[migrate] decouple default DB failed',e); }
  try{ if(typeof purgeExpiredTrash==='function') purgeExpiredTrash(); }catch(e){}   // drop anything past its 30-day window
  try{ await preloadBlobs(); await migrateInlineImages(); await preloadBlobs(); gcBlobs(); }catch(e){}
  applyCfg();        // re-apply after migrations in case they touched theme/colors
  restoreSidebar();
  // Boot to the page in the URL (Notion-style): refresh and deep links land on
  // the page you were on; an empty/unknown hash falls back to home.
  applyRoute(parseRoute());
  // First-run welcome (once, empty workspaces only) — after the home view is visible.
  try{ if(typeof maybeStartOnboarding==='function') setTimeout(maybeStartOnboarding,500); }catch(e){}
  // Idle: gzip-compress documents that have been cold for >30 days (shrinks on-disk
  // size; they inflate transparently on next load and decompress when reopened).
  try{ if(typeof compactColdDocs==='function') setTimeout(()=>compactColdDocs(30),5000); }catch(e){}
  // Idle: ask GitHub once a day whether a newer release exists (desktop only, and
  // only while Settings → About has automatic checks switched on).
  try{ if(typeof maybeCheckForUpdates==='function') setTimeout(maybeCheckForUpdates,4000); }catch(e){}
})();
