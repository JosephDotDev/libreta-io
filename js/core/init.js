
/* ── INIT (async: load media, migrate legacy inline images, then render) ── */
(async()=>{
  applyCfg();        // apply the cached theme up front so the boot cover isn't the default theme
  await DB.load();   // hydrate the in-memory docs/tables cache (+ one-time legacy migration)
                     // BEFORE sync, so the keep-local-vs-adopt-cloud decision sees real
                     // local data. Cloud.boot's pull refreshes the cache when it adopts.
  try{ if(typeof Cloud!=='undefined') await Cloud.boot(); }catch(e){ console.warn('[cloud] boot failed — running local-only',e); }
  try{ if(typeof migrateDecoupleDefaultDb==='function') migrateDecoupleDefaultDb(); }catch(e){ console.warn('[migrate] decouple default DB failed',e); }
  try{ if(typeof purgeExpiredTrash==='function') purgeExpiredTrash(); }catch(e){}   // drop anything past its 30-day window
  try{ await preloadBlobs(); await migrateInlineImages(); await preloadBlobs(); gcBlobs(); }catch(e){}
  applyCfg();        // re-apply in case the pulled snapshot changed theme/colors
  restoreSidebar();
  // Boot to the page in the URL (Notion-style): refresh and deep links land on
  // the page you were on; an empty/unknown hash falls back to home.
  applyRoute(parseRoute());
  // The themed app is now on screen — fade out the auth/loading cover (item 2).
  const gate=document.getElementById('auth-gate');
  if(gate){ gate.classList.add('ag-dismiss'); setTimeout(()=>gate.remove(),320); }
  // First-run welcome (once, empty workspaces only) — after the home view is visible.
  try{ if(typeof maybeStartOnboarding==='function') setTimeout(maybeStartOnboarding,500); }catch(e){}
  // Idle: gzip-compress documents that have been cold for >30 days (shrinks on-disk
  // size; they inflate transparently on next load and decompress when reopened).
  try{ if(typeof compactColdDocs==='function') setTimeout(()=>compactColdDocs(30),5000); }catch(e){}
})();
