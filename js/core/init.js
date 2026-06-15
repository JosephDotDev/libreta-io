
/* ── INIT (async: load media, migrate legacy inline images, then render) ── */
(async()=>{
  applyCfg();        // apply the cached theme up front so the boot cover isn't the default theme
  try{ if(typeof Cloud!=='undefined') await Cloud.boot(); }catch(e){ console.warn('[cloud] boot failed — running local-only',e); }
  await DB.load();   // hydrate the in-memory docs/tables cache from the persistence adapter
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
})();
