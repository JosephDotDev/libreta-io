/* ═══════════════════════════════════════════════════════════════════════════
   CLOUD SYNC  (Supabase Auth + Storage)
   ---------------------------------------------------------------------------
   MVP "whole-workspace" sync. Folio keeps working exactly as before against
   localStorage + IndexedDB (synchronous, fast). This layer simply:
     • gates the app behind a login (Supabase email+password Auth),
     • on boot, PULLS the user's snapshot from Storage into local storage,
     • on any change, debounced, PUSHES a fresh snapshot back up.
   A snapshot = every `folio_*` localStorage key + every IndexedDB media blob
   (as data URLs), stored as one JSON file at `<bucket>/<userId>/state.json`.
   Last-write-wins. Good enough for a single user across their own devices;
   per-record sync can come later without touching the rest of the app.
═══════════════════════════════════════════════════════════════════════════ */
const Cloud = (()=>{
  let sb=null, user=null, _uploadTimer=null, _statusEl=null, _busy=false, _dirtyWhileBusy=false;
  let _pulling=false, _realtimeChannel=null;
  // Storage-level `updated_at` of state.json as of the last snapshot we pulled or
  // pushed. Lets us cheaply detect "the cloud moved ahead of us" (another device
  // wrote) without downloading the whole (possibly multi-MB) snapshot every poll.
  let _remoteStamp=null;
  const STATE_PATH = ()=> `${user.id}/state.json`;
  // Tiny sidecar pointer written alongside every push. It holds just the snapshot's
  // own `updatedAt`, so polling it is cheap AND reliable: unlike storage `list()`
  // metadata (whose `updated_at` does NOT reliably change on an upsert-overwrite),
  // we control this file's contents, so it always reflects the latest push. This is
  // the change-detection signal for the poll + stale-push guard.
  const META_PATH = ()=> `${user.id}/meta.json`;
  // Only writes to these keys are *real content edits* that should mark the device
  // dirty and trigger an upload. Everything else under folio_* is device-local view
  // state (sidebar collapse, sort order, tree expansion, calendar month, …) — it
  // still rides along in the snapshot, but must NEVER on its own schedule a push or
  // mark the device dirty. Otherwise just *browsing* on a stale device (which writes
  // those view keys) would upload its out-of-date snapshot and clobber newer work
  // done elsewhere. This is the core fix for cross-device overwrites.
  const CONTENT_RE = /^folio_(docs|tables|versions|trash|cfg|home_cfg|home_doc|doc_cols|tasks)$/;
  // Non-folio_ key (so it never rides the snapshot or triggers autosync): set when
  // there are local content changes not yet confirmed pushed, cleared on a
  // successful push. Lets a quick reload keep local edits instead of losing them
  // to an older remote.
  const DIRTY_KEY = 'libreta_unpushed';
  function markDirty(){ try{ localStorage.setItem(DIRTY_KEY, String(Date.now())); }catch(e){} }
  function clearDirty(){ try{ localStorage.removeItem(DIRTY_KEY); }catch(e){} }
  function isDirty(){ try{ return !!localStorage.getItem(DIRTY_KEY); }catch(e){ return false; } }
  // Timestamp of the cloud snapshot we most recently synced. Stored outside
  // folio_* so it never rides the snapshot or triggers autosync.
  const CLOUD_TS_KEY = 'libreta_cloudTs';
  function getCloudTs(){ try{ return localStorage.getItem(CLOUD_TS_KEY); }catch(e){ return null; } }
  function setCloudTs(ts){ try{ if(ts) localStorage.setItem(CLOUD_TS_KEY, ts); }catch(e){} }

  /* Signature of the *meaningful* content (documents + tables + settings) with
     volatile fields (updatedAt / createdAt / meta.lastSaved) stripped. This is the
     crux of conflict-safe sync: a passive re-save (e.g. opening a page bumps a
     version baseline, or flushSave rewrites a doc with only a new timestamp) sets
     the dirty flag WITHOUT changing real content. If we trusted the dirty flag
     alone, an idle device that merely re-persisted identical data would be treated
     as "has unpushed edits" and allowed to upload its STALE snapshot over newer
     work from another device. Comparing signatures tells a genuine edit apart from
     a timestamp-only churn, so a device only ever overwrites the cloud when its
     content actually differs. */
  let _syncedSig = null;   // signature of the content as of our last successful sync
  function _parseArr(s){ try{ return JSON.parse(s||'[]'); }catch(e){ return []; } }
  function _sigFrom(docs, tbls, cfg){
    const nd=(docs||[]).map(d=>{ const {updatedAt,createdAt,...r}=d; if(r.meta){ const {lastSaved,...m}=r.meta; r.meta=m; } return r; })
      .sort((a,b)=> a.id<b.id?-1:a.id>b.id?1:0);
    const nt=(tbls||[]).map(t=>{ const {updatedAt,createdAt,...r}=t; return r; })
      .sort((a,b)=> a.id<b.id?-1:a.id>b.id?1:0);
    return JSON.stringify({ d:nd, t:nt, c:cfg||'' });
  }
  function contentSig(){
    // Docs/tables live in IndexedDB now → read them from the in-memory cache (hydrated
    // at boot before any sync decision) rather than from localStorage.
    let docs=[],tbls=[]; try{ docs=DB.getDocs(); tbls=DB.getTbls(); }catch(e){}
    return _sigFrom(docs, tbls, localStorage.getItem('folio_cfg')||'');
  }
  function contentSigFromKeys(keys){
    if(!keys) return '';
    return _sigFrom(_parseArr(keys['folio_docs']), _parseArr(keys['folio_tables']), keys['folio_cfg']||'');
  }
  /* True when local content genuinely differs from what we last synced (volatile
     timestamps ignored). Used only to decide whether there's anything worth
     uploading — NOT to block pulls. */
  function localChanged(){ try{ return contentSig() !== _syncedSig; }catch(e){ return true; } }

  /* "Is the user actively editing on THIS device right now?" — driven by real DOM
     `input`/`beforeinput` events, which only fire on genuine user typing. This is
     the reliable signal (passive re-saves, version baselines, programmatic
     innerHTML re-renders never fire input events) that earlier attempts using the
     dirty flag / content diff got wrong, making an idle device wrongly think it had
     edits and refuse to pull. A device only declines an incoming cloud update, or
     overwrites the cloud, while the user is genuinely typing here. */
  let _lastEditAt = 0;
  function markEditActivity(){ _lastEditAt = Date.now(); }
  function activelyEditing(){ return (Date.now() - _lastEditAt) < 4000; }

  /* Fetch a storage object as text, DEFEATING the HTTP/CDN cache. This is critical:
     Supabase serves storage objects with a long default `Cache-Control` (max-age
     3600), so a plain `download()` can return a STALE copy of state.json for up to
     an hour after another device overwrote it — which makes two devices look like
     "different sites" that never sync. A freshly-signed URL is unique each call
     (its token differs), so it bypasses any cached response; we also add a cache
     buster and `cache:'no-store'`. Falls back to a direct download if signing fails.
     Returns the text, or null if the object is missing/unreadable. */
  async function dlText(path){
    try{
      const { data, error } = await sb.storage.from(SUPABASE_BUCKET).createSignedUrl(path, 120);
      if(!error && data && data.signedUrl){
        const u = data.signedUrl + (data.signedUrl.includes('?')?'&':'?') + 'cb=' + Date.now();
        const r = await fetch(u, { cache:'no-store' });
        if(r.status===404) return null;
        if(r.ok) return await r.text();
      }
    }catch(e){}
    try{
      const { data, error } = await sb.storage.from(SUPABASE_BUCKET).download(path);
      if(error || !data) return null;
      return await data.text();
    }catch(e){ return null; }
  }

  /* Cheap "has the cloud changed?" probe: fetch the tiny meta.json pointer and
     return the latest snapshot's `updatedAt`, so we don't pull the whole (possibly
     multi-MB) snapshot just to check whether anything moved. Null if no pointer. */
  async function remoteInfo(){
    try{
      const txt = await dlText(META_PATH());
      if(!txt) return null;
      const m = JSON.parse(txt);
      return m && m.updatedAt || null;
    }catch(e){ return null; }
  }
  /* Write the sidecar pointer. `cacheControl:'0'` so other devices never get a
     stale cached read of it. Best-effort: failure just delays cross-device notice. */
  async function writeMeta(updatedAt){
    try{
      const blob = new Blob([JSON.stringify({ updatedAt })], { type:'application/json' });
      await sb.storage.from(SUPABASE_BUCKET).upload(META_PATH(), blob, { upsert:true, contentType:'application/json', cacheControl:'0' });
    }catch(e){ console.warn('[cloud] meta write failed', e); }
  }

  /* ── boot: called once by init.js BEFORE DB.load(). Resolves only when we
        have a session AND have pulled the latest snapshot into localStorage. */
  async function boot(){
    if(!window.supabase || !window.supabase.createClient){
      console.warn('[cloud] supabase-js failed to load — running local-only');
      return; // fail open: app still works offline/local-only
    }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // getSession() awaits the client's URL processing, so a recovery link's
    // temporary session is fully established by the time we read it below.
    const recovery = isRecoveryLink();
    const { data:{ session } } = await sb.auth.getSession();
    // getSession() has loaded the recovery session into the client by now, so we
    // can strip the token from the address bar (a refresh shouldn't replay it)
    // without losing the session we need for updateUser().
    if(recovery) cleanRecoveryUrl();
    // Explicit auth intent (?signin/?signup/?auth) always wins over a saved
    // "use without account" choice, so a local-only user can still sign in later.
    let _wantAuth=false; try{ const _p=new URLSearchParams(location.search); _wantAuth=_p.has('signin')||_p.has('signup')||_p.has('auth'); }catch(e){}
    if(recovery && session){
      // Password-recovery deep link: Supabase signed us in with a short-lived
      // recovery session. Don't treat it as a normal login — make the user set
      // a new password first, then continue into the app with the same session.
      user = await showRecoveryGate();
    }else if(session){
      // Already signed in: cover the screen while we pull + render so the user
      // never sees the un-themed default shell flash before their data loads.
      user = session.user; showLoadingGate();
    }else if(localStorage.getItem('libreta_local') && !_wantAuth){
      // User chose "Start writing — no account": run fully local, no gate, no sync.
      user = null;
    }else{
      if(_wantAuth){ try{ localStorage.removeItem('libreta_local'); }catch(e){} } // signing in leaves local-only mode
      user = await showAuthGate(recovery);
    }
    // Sync only when authenticated — a local-only session skips all of it.
    if(user){
      try{ localStorage.removeItem('libreta_local'); }catch(e){}
      await pull();              // bring the cloud copy down before the app reads storage
      purgeStaleMonolith();      // one-time: drop the obsolete state.json once on records mode
      installAutosync();         // start watching for local changes to push back up
      installRealtime();         // subscribe to cross-device push notifications
      startPoll();               // slow fallback poll (30s) for events Realtime missed
      mountStatusChip();
    }
  }

  /* ── PULL: download the remote snapshot and apply it locally.
        If there is no remote yet (first device / new account) but this browser
        already has local data, seed the cloud from local instead of wiping it. */
  async function pull(){
    setStatus('syncing');
    // Per-record mode: boot reconcile (seeds the cloud on first run, adopts remote
    // otherwise). The in-memory cache is already hydrated (DB.load runs before boot).
    if(_syncMode()==='records'){ try{ await reconcileRecords(); setStatus('synced'); }catch(e){ console.warn('[cloud] reconcile (boot) failed',e); setStatus('error'); } return; }
    try{
      const txt = await dlText(STATE_PATH());
      if(!txt){
        // No cloud snapshot yet — push whatever is here so it isn't lost.
        if(hasLocalData()) await push(true);
        else setStatus('synced');
        return;
      }
      const snap = JSON.parse(txt);
      // Keep local (push over the cloud) only when this device holds genuine unpushed
      // edits AND the cloud has NOT advanced past what we last synced. If the cloud
      // moved ahead (another device wrote while we were closed), adopt it — never
      // clobber newer remote work with a stale local snapshot at boot. If content
      // matches, the dirty flag was spurious; just adopt the cloud copy.
      const cloudAdvanced = getCloudTs() && snap.updatedAt && snap.updatedAt>getCloudTs();
      if(isDirty() && hasLocalData() && contentSig()!==contentSigFromKeys(snap.keys) && !cloudAdvanced){
        await push(true); return;
      }
      await applySnapshot(snap);
      setCloudTs(snap.updatedAt);
      // Baseline the change-detection pointer. If meta.json doesn't exist yet
      // (e.g. first load after this feature shipped), seed it from the snapshot we
      // just pulled so polling works immediately for every device.
      let rs = await remoteInfo();
      if(!rs){ await writeMeta(snap.updatedAt); rs = snap.updatedAt; }
      _remoteStamp = rs;
      _syncedSig = contentSig();           // baseline for genuine-edit detection
      clearDirty();                         // we are now level with the cloud
      setStatus('synced');
    }catch(e){ console.warn('[cloud] pull failed',e); setStatus('error'); }
  }

  function hasLocalData(){
    try{ return DB.getDocs().length>0 || DB.getTbls().length>0; }
    catch{ return false; }
  }

  /* Gather all folio_* localStorage keys + all IndexedDB media blobs. Documents and
     tables now live in IndexedDB (not localStorage), so inject them under their
     canonical keys — the state.json shape stays identical for backward compatibility. */
  async function snapshot(){
    const keys={};
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.indexOf('folio_')===0) keys[k]=localStorage.getItem(k); }
    try{ keys['folio_docs']=JSON.stringify(DB.getDocs()); keys['folio_tables']=JSON.stringify(DB.getTbls()); }catch(e){}
    const images={};
    try{ const all=await IDB.all(); for(const {id,blob} of all){ if(blob){ const du=await blobToDataURL(blob); if(du) images[id]=du; } } }catch(e){}
    return { app:'libreta', kind:'sync', v:1, updatedAt:new Date().toISOString(), keys, images };
  }

  /* Overwrite local state with a downloaded snapshot. Runs during boot, BEFORE
     autosync is installed and BEFORE DB.load(), so plain localStorage writes
     here neither recurse into the uploader nor race the in-memory cache. */
  async function applySnapshot(snap){
    if(!snap || !snap.keys) return;
    // Suppress autosync (both the localStorage patch and the DB content signal) during
    // apply so bulk writes don't schedule an upload of data we just downloaded.
    _pulling=true; DB._suppress=true;
    try{
      const toRemove=[];
      for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.indexOf('folio_')===0) toRemove.push(k); }
      toRemove.forEach(k=> _rawRemove.call(localStorage,k));
      // docs + tables go to IndexedDB (per-record store); everything else is a small
      // localStorage singleton. Parse the canonical keys out and route them to the adapter.
      let docsArr=null, tblsArr=null;
      for(const [k,v] of Object.entries(snap.keys)){
        if(k==='folio_docs'){   try{ docsArr=JSON.parse(v)||[]; }catch(e){ docsArr=[]; } continue; }
        if(k==='folio_tables'){ try{ tblsArr=JSON.parse(v)||[]; }catch(e){ tblsArr=[]; } continue; }
        _rawSet.call(localStorage,k,v);
      }
      if(docsArr!==null) await Persist.putAllDocs(docsArr);
      if(tblsArr!==null) await Persist.putAllTbls(tblsArr);
      if(snap.images){ for(const [id,du] of Object.entries(snap.images)){ try{ await IDB.put(id, dataURLtoBlob(du)); }catch(e){} } }
      await DB.load();   // refresh the in-memory cache to match what we just wrote
    }finally{ _pulling=false; DB._suppress=false; }
  }

  /* ── PUSH: debounced upload of the current snapshot. */
  function scheduleUpload(){ markDirty(); clearTimeout(_uploadTimer); _uploadTimer=setTimeout(()=>push(), 800); }

  /* Apply a freshly-pulled snapshot WITHOUT a full page reload: write it to local
     storage, re-hydrate the in-memory caches, rebuild image URLs, re-apply theme,
     then re-render the current view in place. Falls back to a reload only if the
     in-place path throws. Keeps the user's scroll position and avoids the loading
     screen flash. */
  async function applyInPlace(snap){
    await applySnapshot(snap);
    setCloudTs(snap.updatedAt);
    _syncedSig = contentSig();   // we now match the cloud — re-baseline
    clearDirty();                 // and drop any spurious dirty flag
    try{
      await DB.load();                                          // re-read docs/tables from storage
      if(typeof preloadBlobs==='function') await preloadBlobs(); // rebuild object URLs for new images
      if(typeof applyCfg==='function') applyCfg();              // theme/font may have changed
      if(typeof rerenderView==='function') rerenderView();      // refresh the visible page in place
      else location.reload();
    }catch(e){ console.warn('[cloud] in-place apply failed — reloading', e); location.reload(); }
  }

  async function push(immediate){
    if(!sb || !user) return;
    if(_busy){ _dirtyWhileBusy=true; return; }   // coalesce: don't overlap uploads
    _busy=true; setStatus('syncing');
    try{
      const _mode=_syncMode();
      // Per-record mode: a two-way reconcile replaces the whole-snapshot upload.
      if(_mode==='records'){ await reconcileRecords(); setStatus('synced'); return; }
      // ── Stale-push guard ──────────────────────────────────────────────────
      // If the cloud moved ahead since we last synced and the user is NOT actively
      // typing here, this device is stale — pull the newer data instead of
      // clobbering it. Gating on activelyEditing() (real input events), not on any
      // localStorage-derived dirty/diff flag, is what reliably stops an idle device
      // from wiping out work done elsewhere. Only while the user is genuinely typing
      // do we let a push win (last-write-wins for their in-progress edit).
      const stamp = await remoteInfo();
      const cloudNewer = !!(stamp && _remoteStamp && stamp!==_remoteStamp);
      if(cloudNewer && !activelyEditing()){
        _busy=false;
        await pullInPlace();
        return;
      }
      // Nothing actually changed locally and we're level with the cloud — skip the
      // upload entirely (avoids churn from passive re-saves / version baselines and
      // the needless broadcast it would trigger).
      if(!localChanged() && !cloudNewer){
        _busy=false; clearDirty(); setStatus('synced'); return;
      }
      const sig = contentSig();   // capture what we're about to upload
      const snap = await snapshot();
      const blob = new Blob([JSON.stringify(snap)], {type:'application/json'});
      const { error } = await sb.storage.from(SUPABASE_BUCKET)
        .upload(STATE_PATH(), blob, { upsert:true, contentType:'application/json', cacheControl:'0' });
      if(error){ console.warn('[cloud] push failed', error); setStatus('error'); }
      else{
        await writeMeta(snap.updatedAt);      // update the pointer so other devices see this push
        setCloudTs(snap.updatedAt);
        _remoteStamp = snap.updatedAt;        // we are now the latest writer
        _syncedSig = sig;                     // re-baseline to what we just uploaded
        clearDirty();   // confirmed up — local and remote now agree
        setStatus('synced');
        // Notify other open tabs/devices so they can pull immediately
        if(_realtimeChannel){
          try{ _realtimeChannel.send({ type:'broadcast', event:'push', payload:{ updatedAt:snap.updatedAt } }); }catch(e){}
        }
        // Dual-write: also shadow the per-record layout so a real device accumulates it
        // for verification, without changing what anyone reads (mono stays authoritative).
        if(_mode==='dual'){ try{ await reconcileRecords(); }catch(e){ console.warn('[cloud] dual-write reconcile failed',e); } }
      }
    }catch(e){ console.warn('[cloud] push error',e); setStatus('error'); }
    finally{
      _busy=false;
      if(_dirtyWhileBusy){ _dirtyWhileBusy=false; scheduleUpload(); }
    }
  }

  /* Watch local writes: any change to a folio_* key schedules a push. Image
     blobs always travel with a companion folio_docs write (the saved ref), so
     this also covers IndexedDB media without hooking IDB directly.
     NOTE: localStorage is an exotic object — assigning to localStorage.setItem
     does NOT override the method (it just stores a junk entry). We must patch
     Storage.prototype, which is what `localStorage.setItem(...)` actually calls. */
  const _proto = Object.getPrototypeOf(localStorage);   // Storage.prototype
  const _rawSet = _proto.setItem;
  const _rawRemove = _proto.removeItem;
  let _patched = false;
  function installAutosync(){
    if(_patched) return; _patched = true;
    // Only *content* keys schedule a push (see CONTENT_RE) — view/UI state writes
    // ride the next content push but never trigger one on their own, so browsing on
    // a stale device can't overwrite newer work, and keeps the device eligible to
    // live-pull (a non-dirty device pulls; a dirty one pushes).
    // CONTENT_RE keys are now all kv-bundle singletons (docs/tables moved to IDB), so a
    // write to one is a kv change → bump the kv mtime (per-record sync's LWW signal).
    _proto.setItem = function(k,v){ _rawSet.call(this,k,v); if(!_pulling&&typeof k==='string'&&CONTENT_RE.test(k)){ _bumpKvMtime(); scheduleUpload(); } };
    _proto.removeItem = function(k){ _rawRemove.call(this,k); if(typeof k==='string'&&CONTENT_RE.test(k)){ _bumpKvMtime(); scheduleUpload(); } };
    // Docs + tables live in IndexedDB now, so their writes never hit the patched
    // setItem above — the DB facade emits this signal instead. Same gate (skip while
    // applying a pulled snapshot) so it can't echo a download back up.
    document.addEventListener('libreta:content', ()=>{ if(!_pulling) scheduleUpload(); });
    // Track genuine user typing so the sync logic can tell "the user is editing
    // here right now" apart from passive re-renders. Capture phase + both events so
    // we never miss the first keystroke. Programmatic innerHTML updates (our own
    // re-renders) do NOT fire these, which is exactly what we want.
    document.addEventListener('beforeinput', markEditActivity, true);
    document.addEventListener('input', markEditActivity, true);
    // Best-effort: when the tab is hidden or closing, flush any pending real edit
    // now instead of waiting out the debounce.
    const flush=()=>{ if(localChanged()){ clearTimeout(_uploadTimer); push(true); } };
    window.addEventListener('visibilitychange', ()=>{
      if(document.visibilityState==='hidden'){
        flush();
      }else{
        // Tab came back to foreground: pull to pick up other devices' changes
        // (unless we're mid-edit), then flush anything pending.
        if(activelyEditing()) flush(); else pullInPlace();
      }
    });
    window.addEventListener('pagehide', flush);
  }

  /* Pull the latest remote snapshot mid-session and apply it in place if it's newer.
     Skipped only while the user is actively typing here (their in-progress edit wins
     until they pause, by which point the debounced push has uploaded it). */
  async function pullInPlace(){
    if(activelyEditing()||_busy) return;
    setStatus('syncing');
    if(_syncMode()==='records'){ try{ await reconcileRecords(); setStatus('synced'); }catch(e){ console.warn('[cloud] reconcile (pull-in-place) failed',e); setStatus('error'); } return; }
    try{
      const stamp = await remoteInfo();
      const txt = await dlText(STATE_PATH());
      if(!txt){ setStatus('synced'); return; }
      const snap = JSON.parse(txt);
      if(snap.updatedAt===getCloudTs()){ _remoteStamp=stamp; setStatus('synced'); return; } // nothing new
      if(!activelyEditing()){
        // Re-check: user may have started typing while the download was in flight.
        _remoteStamp=stamp;
        await applyInPlace(snap);   // update the page live, no reload
        setStatus('synced');
      }else{
        // User started editing during the download — their work wins; push it.
        setStatus('synced');
        scheduleUpload();
      }
    }catch(e){ console.warn('[cloud] pull-in-place failed',e); setStatus('error'); }
  }

  /* Subscribe to a Supabase Realtime broadcast channel scoped to this user.
     When another device pushes it sends a pulse; we pull immediately. */
  function installRealtime(){
    if(!sb) return;
    try{
      _realtimeChannel = sb.channel(`workspace:${user.id}`)
        .on('broadcast',{ event:'push' },({ payload })=>{
          if(!activelyEditing() && payload?.updatedAt !== getCloudTs()) pullInPlace();
        })
        .subscribe();
    }catch(e){ console.warn('[cloud] realtime init failed',e); }
  }

  /* FALLBACK poll: Realtime broadcasts (installRealtime) are the PRIMARY near-instant
     cross-device signal; this poll only catches events Realtime missed (dropped socket,
     backgrounded tab that suppressed the channel, etc.). So it runs on a slow cadence:
     while the tab is visible and the user isn't mid-edit, download the tiny meta.json
     pointer and pull only when it actually changed. Keeping this slow matters for egress
     — every tick is a signed-URL fetch on every open tab, indefinitely; at the old 3 s it
     was ~20 reads/min/tab of constant background egress for a path Realtime already covers. */
  const POLL_MS = 30_000;
  async function checkRemote(){
    if(activelyEditing()||_busy||document.visibilityState!=='visible') return;
    const stamp = await remoteInfo();
    if(stamp && stamp!==_remoteStamp) pullInPlace();
  }
  function startPoll(){ setInterval(checkRemote, POLL_MS); }

  /* ───────────────────────── Password recovery ───────────────────────── */
  /* Supabase recovery links carry `type=recovery` (in the hash for the implicit
     flow, occasionally the query string). Detect it before we mistake the
     resulting session for a normal login. */
  function isRecoveryLink(){
    const s = (window.location.hash||'') + '&' + (window.location.search||'');
    return s.indexOf('type=recovery') !== -1;
  }
  /* Remove the recovery token from the address bar so reloading the page can't
     replay it (and so the app doesn't keep thinking it's mid-recovery). */
  function cleanRecoveryUrl(){
    try{ history.replaceState(null, '', window.location.pathname); }catch(e){}
  }
  /* "Set a new password" page. Reuses the #auth-gate styling. Resolves with the
     user once the password is updated, so boot() can continue straight in. */
  function showRecoveryGate(){
    return new Promise(resolve=>{
      const wrap=document.createElement('div');
      wrap.id='auth-gate';
      wrap.innerHTML=`
        <div class="ag-card">
          <div class="ag-logo">Libre<span>ta</span></div>
          <div class="ag-sub">Choose a new password for your account.</div>
          <form id="rg-form" autocomplete="on">
            <input id="rg-pass" type="password" placeholder="New password" autocomplete="new-password" required minlength="6">
            <input id="rg-pass2" type="password" placeholder="Confirm new password" autocomplete="new-password" required minlength="6">
            <div id="rg-err" class="ag-err"></div>
            <button id="rg-submit" type="submit" class="ag-btn">Update password</button>
          </form>
        </div>`;
      document.body.appendChild(wrap);
      const $=s=>wrap.querySelector(s);
      const err=m=>{ $('#rg-err').textContent=m||''; };
      $('#rg-form').onsubmit=async ev=>{
        ev.preventDefault();
        const p1=$('#rg-pass').value, p2=$('#rg-pass2').value;
        if(p1!==p2){ err('Those passwords don’t match.'); return; }
        $('#rg-submit').disabled=true; err('');
        try{
          const { data, error } = await sb.auth.updateUser({ password:p1 });
          if(error){ err(error.message); $('#rg-submit').disabled=false; return; }
          showLoadingGate();           // keep the cover up while the app pulls + renders
          resolve(data.user);
        }catch(e){ err('Something went wrong. Try again.'); $('#rg-submit').disabled=false; }
      };
      $('#rg-pass').focus();
    });
  }

  /* A little something to read while the workspace loads — a rotating mix of
     short aphorisms and fun facts about notes, memory and ideas. */
  const LOADING_QUOTES=[
    'The palest ink is better than the best memory. — Chinese proverb',
    '“Libreta” means notebook in Spanish.',
    'Writing is thinking on paper. — William Zinsser',
    'Every big idea started as a small note.',
    'Fun fact: writing notes by hand helps you remember them better.',
    'A notebook is a portable garden for your ideas.',
    'Fun fact: the average person has around 6,000 thoughts a day.',
    'Your future self will thank you for writing it down.',
    'Start writing — the water doesn’t flow until the faucet is turned on. — Louis L’Amour',
    'Fun fact: ideas you don’t capture in 5 minutes are usually gone for good.',
    'Fill your paper with the breathings of your heart. — William Wordsworth',
    'A short pencil is better than a long memory.',
  ];
  function pickQuote(){ return LOADING_QUOTES[Math.floor(Math.random()*LOADING_QUOTES.length)]; }

  /* Loading cover — shown the moment auth succeeds and kept up until init.js has
     pulled the snapshot and rendered the themed app, so there's no flash of the
     default shell (item 2). Reuses the #auth-gate overlay element. */
  function showLoadingGate(){
    let wrap=document.getElementById('auth-gate');
    if(!wrap){ wrap=document.createElement('div'); wrap.id='auth-gate'; document.body.appendChild(wrap); }
    wrap.innerHTML=`
      <div class="ag-card">
        <div class="ag-logo">Libre<span>ta</span></div>
        <div class="ag-loading"><span class="ag-spin"></span><span>Loading your workspace…</span></div>
        <div class="ag-quote">${pickQuote().replace(/</g,'&lt;')}</div>
      </div>`;
  }

  /* ───────────────────────── Auth gate UI ───────────────────────── */
  const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  /* Password rules modelled on common consumer sites (min length + character
     classes). Sign-up is blocked until all are met. */
  function pwReqs(p){
    return {
      len:  p.length>=8,
      case: /[a-z]/.test(p) && /[A-Z]/.test(p),
      num:  /[0-9]/.test(p),
      sym:  /[^A-Za-z0-9]/.test(p),
    };
  }
  function pwStrong(p){ const r=pwReqs(p); return r.len&&r.case&&r.num&&r.sym; }

  /* Brand marks for the social buttons (official Google "G" + Apple logo). */
  const GOOGLE_SVG=`<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
  const APPLE_SVG=`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.36 12.78c.03 3.18 2.79 4.24 2.82 4.25-.02.07-.44 1.51-1.45 2.99-.87 1.28-1.78 2.55-3.21 2.58-1.4.03-1.85-.83-3.46-.83-1.6 0-2.1.8-3.43.86-1.38.05-2.43-1.38-3.31-2.66-1.8-2.6-3.18-7.36-1.33-10.57.92-1.6 2.56-2.61 4.34-2.64 1.36-.03 2.64.91 3.46.91.82 0 2.38-1.13 4.01-.97.68.03 2.6.28 3.83 2.06-.1.06-2.29 1.34-2.26 3.99M13.73 4.13c.73-.88 1.22-2.11 1.08-3.33-1.05.04-2.32.7-3.07 1.58-.67.78-1.26 2.03-1.1 3.23 1.17.09 2.36-.6 3.09-1.48"/></svg>`;

  function showAuthGate(recoveryExpired){
    return new Promise(resolve=>{
      const wrap=document.createElement('div');
      wrap.id='auth-gate';
      wrap.innerHTML=`
        <div class="ag-card ag-card-v2">
          <div class="ag-logo">Libre<span>ta</span></div>
          <h1 class="ag-promise">Your workspace.<br>Your data.</h1>
          <div class="ag-promise-sub">No subscription required to think. Everything lives on your device — sync is a layer you opt into, never a wall.</div>
          <div class="ag-pills"><span class="ag-pill ag-pill-g">Works offline</span><span class="ag-pill ag-pill-b">Private by default</span></div>
          <button id="ag-skip" type="button" class="ag-btn ag-btn-primary">Start writing — no account</button>
          <div class="ag-skipnote">Jump straight in. Add sync whenever you like.</div>
          <div class="ag-syncdiv"><span>Or sync across devices</span></div>
          <form id="ag-form" autocomplete="on" novalidate>
            <input id="ag-email" type="email" placeholder="Email" autocomplete="username" required>
            <input id="ag-pass" type="password" placeholder="Password" autocomplete="current-password" required>
            <input id="ag-pass2" type="password" placeholder="Confirm password" autocomplete="new-password" style="display:none">
            <div id="ag-strength" class="ag-strength" style="display:none">
              <div class="ag-strbar"><span id="ag-strfill"></span></div>
              <div id="ag-strlbl" class="ag-strlbl"></div>
              <ul class="ag-reqs">
                <li data-r="len">At least 8 characters</li>
                <li data-r="case">Upper &amp; lowercase</li>
                <li data-r="num">A number</li>
                <li data-r="sym">A symbol (!?@#…)</li>
              </ul>
            </div>
            <div id="ag-err" class="ag-err"></div>
            <button id="ag-submit" type="submit" class="ag-btn">Sign in</button>
            <button id="ag-magic" type="button" class="ag-link">Email me a magic link instead</button>
            <button id="ag-forgot" type="button" class="ag-link">Forgot your password?</button>
          </form>
          <div class="ag-or"><span>or</span></div>
          <div class="ag-social">
            <button type="button" class="ag-soc ag-soc-google" id="ag-google">${GOOGLE_SVG}<span>Continue with Google</span></button>
          </div>
          <button id="ag-toggle" type="button" class="ag-link">New here? Create an account</button>
        </div>`;
      document.body.appendChild(wrap);
      let mode='signin';
      // Client-side brute-force throttle (defense in depth). The authoritative
      // rate limit lives in Supabase (Auth → Rate Limits) and a bot-protection
      // CAPTCHA — those stop an attacker hitting the API directly. This just slows
      // repeated guessing through our own UI: after several failures we lock the
      // submit button for an escalating cooldown. State is per-gate (resets on a
      // successful login or reload).
      let _authFails=0, _lockUntil=0;
      function lockRemaining(){ return Math.ceil((_lockUntil-Date.now())/1000); }
      const $=s=>wrap.querySelector(s);
      const err=m=>{ $('#ag-err').className='ag-err'; $('#ag-err').textContent=m||''; };
      const ok=m=>{ $('#ag-err').className='ag-err ag-ok'; $('#ag-err').textContent=m||''; };
      if(recoveryExpired) err('That reset link has expired. Send a new one below.');
      // Arriving from the landing page's "Get started" CTA (index.html?signup=1) opens
      // straight into account creation; "Sign in" (?signin) keeps the default mode.
      let _wantSignup=false; try{ _wantSignup=new URLSearchParams(location.search).has('signup'); }catch(e){}

      const STR=[['Too weak','#cf6b52'],['Weak','#cf6b52'],['Fair','#C47D32'],['Good','#C9A84C'],['Strong','#5e8c5a']];
      function refreshStrength(){
        const p=$('#ag-pass').value, r=pwReqs(p);
        const score=(r.len?1:0)+(r.case?1:0)+(r.num?1:0)+(r.sym?1:0);
        const [lbl,col]=STR[score];
        $('#ag-strfill').style.width=(score*25)+'%';
        $('#ag-strfill').style.background=col;
        $('#ag-strlbl').textContent=p?lbl:'';
        $('#ag-strlbl').style.color=col;
        ['len','case','num','sym'].forEach(k=>{ const li=$(`.ag-reqs li[data-r="${k}"]`); if(li) li.classList.toggle('met',!!r[k]); });
      }
      function setMode(m){
        mode=m; const signup=m==='signup';
        $('#ag-submit').textContent = signup ? 'Create account' : 'Sign in';
        $('#ag-toggle').textContent = signup ? 'Have an account? Sign in' : 'New here? Create an account';
        $('#ag-pass').setAttribute('autocomplete', signup?'new-password':'current-password');
        $('#ag-pass').placeholder = signup ? 'Create a password' : 'Password';
        $('#ag-pass2').style.display = signup ? '' : 'none';
        $('#ag-strength').style.display = signup ? '' : 'none';
        $('#ag-forgot').style.display = signup ? 'none' : '';
        err(''); if(signup) refreshStrength();
      }
      $('#ag-pass').addEventListener('input', ()=>{ if(mode==='signup') refreshStrength(); });
      /* "Create an account" / "Have an account?" navigate to the dedicated setup vs
         sign-in screen instead of toggling creation fields inline — keeps the sign-in
         gate clean, and account creation gets its own focused page (?signup). */
      $('#ag-toggle').onclick=()=>{ location.href = (mode==='signin') ? 'index.html?signup=1' : 'index.html?signin=1'; };
      /* One-tap OAuth. signInWithOAuth redirects the whole page to the provider;
         on return the session is in the URL and boot() picks it up automatically. */
      async function oauth(provider){
        err('');
        try{
          const { error } = await sb.auth.signInWithOAuth({ provider, options:{ redirectTo: window.location.origin } });
          if(error) err(error.message);   // e.g. provider not yet enabled in Supabase
        }catch(e){ err('Could not start sign-in. Try again.'); }
      }
      $('#ag-google').onclick=()=> oauth('google');
      /* "Start writing — no account": remember the local-only choice and let boot
         continue without a session (resolve with no user). */
      $('#ag-skip').onclick=()=>{ try{ localStorage.setItem('libreta_local','1'); }catch(e){} wrap.remove(); resolve(null); };
      // Apple button hidden for now — re-add a button with id="ag-apple" and
      // `$('#ag-apple').onclick=()=>oauth('apple')` once it's set up in Supabase.
      /* Passwordless magic link — works for new and existing users alike. */
      $('#ag-magic').onclick=async ()=>{
        const email=$('#ag-email').value.trim();
        if(!EMAIL_RE.test(email)){ err('Enter your email above first, then tap “Email me a magic link”.'); $('#ag-email').focus(); return; }
        err('');
        try{
          const { error } = await sb.auth.signInWithOtp({ email, options:{ emailRedirectTo: window.location.origin } });
          if(error){ err(error.message); return; }
          ok('Magic link sent — check your inbox to finish signing in.');
        }catch(e){ err('Could not send the link. Try again.'); }
      };
      $('#ag-forgot').onclick=async ()=>{
        const email=$('#ag-email').value.trim();
        if(!EMAIL_RE.test(email)){ err('Enter a valid email above first, then tap “Forgot your password?”'); $('#ag-email').focus(); return; }
        err('');
        try{
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
          if(error){ err(error.message); return; }
          ok('Reset link sent — check your inbox.');
        }catch(e){ err('Could not send the reset email. Try again.'); }
      };
      $('#ag-form').onsubmit=async ev=>{
        ev.preventDefault();
        if(Date.now()<_lockUntil){ err(`Too many attempts. Try again in ${lockRemaining()}s.`); return; }
        const email=$('#ag-email').value.trim(), password=$('#ag-pass').value;
        if(!EMAIL_RE.test(email)){ err('Enter a valid email address.'); $('#ag-email').focus(); return; }
        if(mode==='signup'){
          if(!pwStrong(password)){ err('Your password doesn’t meet all the requirements below.'); refreshStrength(); return; }
          if($('#ag-pass2').value!==password){ err('Those passwords don’t match.'); $('#ag-pass2').focus(); return; }
        }else if(!password){ err('Enter your password.'); return; }
        $('#ag-submit').disabled=true; err('');
        try{
          const fn = mode==='signin'
            ? sb.auth.signInWithPassword({email,password})
            : sb.auth.signUp({email,password});
          const { data, error } = await fn;
          if(error){
            // Count failed sign-ins; lock the form for an escalating cooldown so a
            // guessing loop through the UI is throttled (5+ fails → 15s, then ×2…).
            if(mode==='signin' && ++_authFails>=5){
              const wait=Math.min(15000*Math.pow(2,_authFails-5), 300000);
              _lockUntil=Date.now()+wait;
              err(`Too many attempts. Try again in ${Math.ceil(wait/1000)}s.`);
            } else err(error.message);
            $('#ag-submit').disabled=false; return;
          }
          _authFails=0; _lockUntil=0;
          const session = data.session;
          if(!session){ // happens if email-confirmation is still ON
            setMode('signin');
            ok('Account created — check your inbox to confirm your email, then sign in.');
            $('#ag-submit').disabled=false; return;
          }
          showLoadingGate();          // keep the cover up while the app pulls + renders
          resolve(session.user);
        }catch(e){ err('Something went wrong. Try again.'); $('#ag-submit').disabled=false; }
      };
      if(_wantSignup) setMode('signup');
      $('#ag-email').focus();
    });
  }

  /* ───────────────────────── Sync status chip ───────────────────────── */
  function mountStatusChip(){
    _statusEl=document.createElement('div');
    _statusEl.id='cloud-chip';
    _statusEl.innerHTML=`<span class="cc-dot"></span><span class="cc-txt">Synced</span>`;
    _statusEl.title=`Signed in as ${user.email} — click for options`;
    _statusEl.onclick=openMenu;
    // Sit inside the topbar's right cluster so it aligns with the header on every
    // view (falls back to body if the shell isn't present).
    (document.getElementById('tp-act')||document.body).appendChild(_statusEl);
    setStatus('synced');
  }
  function setStatus(state){
    if(!_statusEl) return;
    const map={syncing:['Syncing…','#C47D32'], synced:['Synced','#5e8c5a'], error:['Sync error','#b4543e']};
    const [txt,col]=map[state]||map.synced;
    _statusEl.querySelector('.cc-txt').textContent=txt;
    _statusEl.querySelector('.cc-dot').style.background=col;
    _statusEl.dataset.state=state;
  }
  function openMenu(){
    const old=document.getElementById('cloud-menu'); if(old){ old.remove(); return; }
    const m=document.createElement('div'); m.id='cloud-menu';
    // Diagnostics: the account id MUST match on every device — if two devices show
    // different ids, they're separate accounts (e.g. Google vs email/password with
    // the same address) and will never share data. "Cloud" is the latest snapshot
    // time in storage; "Local" is what this device last applied — they should
    // converge after a sync.
    const shortId=(user.id||'').slice(0,8);
    m.innerHTML=`
      <div class="cm-email">${user.email}</div>
      <div class="cm-diag">account <b>${shortId}</b></div>
      <div class="cm-diag" id="cm-cloud">cloud …</div>
      <div class="cm-diag">local <b>${(getCloudTs()||'—').replace('T',' ').slice(0,19)}</b></div>
      <button class="cm-it" data-act="sync">Sync now</button>`;
    document.body.appendChild(m);
    // Fill in the live cloud timestamp asynchronously (cache-busted).
    remoteInfo().then(ts=>{ const el=document.getElementById('cm-cloud'); if(el) el.innerHTML='cloud <b>'+(ts?ts.replace('T',' ').slice(0,19):'none')+'</b>'; });
    m.addEventListener('click', async e=>{
      const act=e.target.dataset.act; if(!act) return;
      m.remove();
      if(act==='sync') syncNow();
    });
    setTimeout(()=>document.addEventListener('click', function h(ev){ if(!m.contains(ev.target)&&ev.target!==_statusEl){ m.remove(); document.removeEventListener('click',h);} }),0);
  }

  /* Manual "Sync now": force a fresh download. If the cloud differs from what we
     last applied, adopt it (the common "this device is stale" case). Otherwise, if
     we hold genuine local changes, push them. Always does real work — never a
     silent no-op — and ignores cached change-detection stamps. */
  async function syncNow(){
    if(_busy) return;
    setStatus('syncing');
    // Per-record mode: state.json is not authoritative (and may be a stale multi-MB
    // monolith from the mono era). A forced sync must reconcile records, NOT download
    // and apply the old snapshot — doing so would both cost a full-snapshot egress hit
    // and clobber current data with stale content. Mirror the other entry points.
    if(_syncMode()==='records'){ try{ await reconcileRecords(); setStatus('synced'); }catch(e){ console.warn('[cloud] sync-now (records) failed',e); setStatus('error'); } return; }
    try{
      const txt = await dlText(STATE_PATH());
      if(txt){
        const snap = JSON.parse(txt);
        if(snap.updatedAt!==getCloudTs()){
          await applyInPlace(snap);                       // cloud is different → adopt it
          _remoteStamp = (await remoteInfo()) || snap.updatedAt;
          setStatus('synced');
          return;
        }
      }
      // Cloud matches what we already have — push only if we hold real local changes.
      if(localChanged()){ clearTimeout(_uploadTimer); await push(true); }
      else setStatus('synced');
    }catch(e){ console.warn('[cloud] sync-now failed',e); setStatus('error'); }
  }

  /* One-time cleanup: in per-record mode the old whole-workspace `state.json` is dead
     weight — nothing reads it anymore, but if it lingers it's a ~multi-MB egress trap
     (any accidental mono/syncNow read re-downloads the whole thing) and wasted storage.
     RLS only lets the *signed-in user* delete their own object, so this can't be done
     server-side — it runs once under the user's session on the first records-mode boot,
     gated by a device-local flag (non-folio_, so it never rides the snapshot). meta.json
     is KEPT: records mode still uses it as the cross-device change pointer. Best-effort. */
  const MONOLITH_PURGED_KEY = 'libreta_monolith_purged';
  async function purgeStaleMonolith(){
    if(_syncMode()!=='records') return;            // only safe once records is authoritative
    try{ if(localStorage.getItem(MONOLITH_PURGED_KEY)) return; }catch(e){ return; }
    try{
      await sb.storage.from(SUPABASE_BUCKET).remove([STATE_PATH()]);   // leave META_PATH() in place
      localStorage.setItem(MONOLITH_PURGED_KEY, String(Date.now()));
    }catch(e){ console.warn('[cloud] stale monolith purge failed (will retry next boot)',e); }
  }

  /* Sign out — exposed so the Settings panel can host the control. */
  async function signOut(){ try{ await sb.auth.signOut(); }catch(e){} location.reload(); }

  /* Erase everything this account stores: the cloud snapshot, all local folio_*
     data, and every cached media blob, then sign out. (The Supabase *auth* user
     itself can't be removed from the browser without a server-side function, so
     this clears the data and signs out — the login can be deleted from Supabase.) */
  async function deleteEverything(){
    try{ if(sb && user) await sb.storage.from(SUPABASE_BUCKET).remove([STATE_PATH(), META_PATH()]); }catch(e){}
    try{
      const ks=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&(k.indexOf('folio_')===0||k===DIRTY_KEY)) ks.push(k); }
      ks.forEach(k=> _rawRemove.call(localStorage,k));
    }catch(e){}
    try{ await IDBData.clear('docs'); await IDBData.clear('tables'); }catch(e){}   // structured data store
    try{ const keys=await IDB.keys(); for(const id of keys) await IDB.del(id); }catch(e){}   // media blobs
    try{ if(sb) await sb.auth.signOut(); }catch(e){}
    location.reload();
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PER-RECORD SYNC (Phase 4) — flag-gated, two-way, per-record last-write-wins.
     Mode lives in localStorage 'libreta_sync_mode' (NOT synced; device-local):
       'mono'    (default) — the proven whole-snapshot state.json sync, unchanged.
       'dual'    — mono stays authoritative AND each push also writes the per-record
                   objects + manifest, so a real device accumulates the new layout for
                   verification without changing read behaviour. (Use this first.)
       'records' — two-way per-record reconcile is authoritative: upload only changed
                   records, download remote-newer ones, propagate deletes via tombstones.
                   Two devices editing DIFFERENT pages both survive. Enable only after
                   verifying on two real devices. Recommended rollout: mono → dual → records.
     Cloud layout (additive to the monolith):
       <uid>/rec/manifest.json  { v, updatedAt, recs:{ "<key>":updatedAt }, deleted:{ "<key>":ts } }
       <uid>/rec/doc/<id>.json, <uid>/rec/tbl/<id>.json, <uid>/rec/kv.json
     <key> ∈ { "doc:<id>", "tbl:<id>", "kv" }. The small content singletons (cfg,
     trash, versions, …) ride together in the kv record; docs+tables are per-record.
  ═══════════════════════════════════════════════════════════════════════ */
  // DEFAULT is now 'records' (per-record two-way sync) — verified across devices + the
  // planReconcile truth-table suite (tests/reconcile.html). 'mono' (whole-snapshot) and
  // 'dual' remain available as explicit per-device overrides.
  // ROLLBACK PATH: in 'records', state.json goes stale (it isn't written), so reverting
  // is mono ← dual ← records: drop to 'dual' and make one edit on your most-current device
  // FIRST (that rebuilds a fresh state.json) before any device reloads on 'mono'.
  const DEFAULT_SYNC_MODE = 'records';
  function _syncMode(){ try{ return localStorage.getItem('libreta_sync_mode')||DEFAULT_SYNC_MODE; }catch(e){ return DEFAULT_SYNC_MODE; } }
  function setSyncMode(m){ try{ localStorage.setItem('libreta_sync_mode', m); }catch(e){} return _syncMode(); }
  const RECMAN = ()=> `${user.id}/rec/manifest.json`;
  const RECKV  = ()=> `${user.id}/rec/kv.json`;
  function _recPath(key){ const i=key.indexOf(':'); return `${user.id}/rec/${key.slice(0,i)}/${key.slice(i+1)}.json`; }
  const _SYNC_KV_KEYS = ['folio_cfg','folio_home_cfg','folio_home_doc','folio_doc_cols','folio_tasks','folio_trash','folio_versions'];
  function _kvBundle(){ const o={}; _SYNC_KV_KEYS.forEach(k=>{ const v=localStorage.getItem(k); if(v!=null) o[k]=v; }); return o; }
  // The kv bundle (small singletons) is one record; LWW needs a comparable timestamp,
  // not a content hash, so we track when any kv key last changed locally (bumped from
  // the Storage patch). ISO strings sort lexicographically == chronologically.
  function _kvMtime(){ try{ return localStorage.getItem('libreta_kv_mtime')||'0'; }catch(e){ return '0'; } }
  function _bumpKvMtime(){ try{ _rawSet.call(localStorage,'libreta_kv_mtime', new Date().toISOString()); }catch(e){} }
  function _applyKv(kv){ if(!kv) return; DB._suppress=true; try{ for(const [k,v] of Object.entries(kv)){ if(typeof v==='string') _rawSet.call(localStorage,k,v); } }finally{ DB._suppress=false; } }
  function localManifest(){
    const recs={};
    try{ DB.getDocs().forEach(d=> recs['doc:'+d.id]= d.updatedAt||'0'); }catch(e){}
    try{ DB.getTbls().forEach(t=> recs['tbl:'+t.id]= t.updatedAt||'0'); }catch(e){}
    recs['kv']=_kvMtime();
    return recs;
  }
  function _getBase(){ try{ return JSON.parse(localStorage.getItem('libreta_sync_manifest')||'{}'); }catch(e){ return {}; } }
  function _setBase(m){ try{ _rawSet.call(localStorage,'libreta_sync_manifest', JSON.stringify(m)); }catch(e){} }

  /* PURE (no IO): decide the sync plan from the local manifest, the remote manifest,
     and the last-synced base (used to tell "I deleted X" apart from "they added X").
     Per-key last-write-wins by updatedAt; remote tombstones win unless we hold a newer
     copy. Unit-tested locally. */
  function planReconcile(local, remote, base){
    local = local||{}; remote = remote||{recs:{},deleted:{}}; base = base||{};
    const rrec=remote.recs||{}, rdel=remote.deleted||{}, brec=base.recs||{};
    const plan={ download:[], upload:[], delLocal:[], tombstone:[] };
    const keys=new Set([...Object.keys(local), ...Object.keys(rrec), ...Object.keys(rdel), ...Object.keys(brec)]);
    for(const k of keys){
      const lt=local[k]||null, rt=rrec[k]||null, dt=rdel[k]||null, bt=brec[k]||null;
      // Remote's EFFECTIVE state: it may list a record (rt) AND a tombstone (dt) at once —
      // e.g. a page deleted then restored. The newer timestamp wins, so a record re-created
      // AFTER its delete un-deletes it (and vice-versa). All timestamps are ISO → comparable.
      const remoteDeleted = !!dt && (!rt || String(dt) >= String(rt));
      if(remoteDeleted){
        // Remote's latest action on this key is a delete (at dt).
        if(lt && String(lt) > String(dt)) plan.upload.push(k);   // our copy is newer than the delete → resurrect it
        else if(lt) plan.delLocal.push(k);                       // honor the remote delete locally
        // else: neither side has it → nothing
        continue;
      }
      // Remote has a live record (rt), or no knowledge of this key.
      const localDeleted = !lt && !!bt;     // had it at last sync, gone now → we deleted it
      if(localDeleted){
        // Propagate our delete as a tombstone, UNLESS the remote was edited AFTER our base
        // (rt > bt) — i.e. another device changed it after we last synced → their edit wins.
        if(rt && String(rt) > String(bt)) plan.download.push(k);
        else plan.tombstone.push(k);
        continue;
      }
      if(rt && (!lt || String(rt) > String(lt))){ plan.download.push(k); continue; }   // remote newer
      if(lt && (!rt || String(lt) > String(rt))){ plan.upload.push(k); continue; }     // local newer / new
      // else: in sync
    }
    return plan;
  }
  async function _uploadJson(path,obj){ try{ const b=new Blob([JSON.stringify(obj)],{type:'application/json'}); const {error}=await sb.storage.from(SUPABASE_BUCKET).upload(path,b,{upsert:true,contentType:'application/json',cacheControl:'0'}); return !error; }catch(e){ return false; } }
  async function _dlJson(path){ const t=await dlText(path); if(!t) return null; try{ return JSON.parse(t); }catch(e){ return null; } }

  /* ═══════════════════════════════════════════════════════════════════════
     MEDIA SYNC (flag-gated, spec: docs/media-sync-spec.md) — per-blob,
     content-addressed cross-device sync of IndexedDB media blobs (images etc).
     Device-local flag, default OFF until verified on two real devices:
       localStorage 'libreta_media_sync' = 'on' | anything else = off.
     Cloud layout (additive to the rec/ layout):
       <uid>/blob/<ref>      — one immutable object per blob (ref = img_<hash>)
       <uid>/rec/blobs.json  — { v, refs:{ "<ref>":uploadedAtISO } }  (union set,
                                 entries are only ever added, never removed — see
                                 "no cloud GC in v1" in the spec)
     Blobs are content-addressed (blobId() hashes the bytes) so a ref's bytes never
     change: no cache-busting on download, and a device never re-downloads a ref it
     already holds. Both diffs below (what's missing locally, what's unconfirmed in
     the cloud) are computed from LOCAL state first — blobs.json is only fetched when
     there's real work on either side, so an idle workspace costs zero network here. */
  function _mediaSyncOn(){ try{ return localStorage.getItem('libreta_media_sync')==='on'; }catch(e){ return false; } }
  function setMediaSync(on){ try{ localStorage.setItem('libreta_media_sync', on?'on':'off'); }catch(e){} return _mediaSyncOn(); }
  const BLOBS_PATH = ()=> `${user.id}/rec/blobs.json`;
  const BLOB_PATH = ref => `${user.id}/blob/${ref}`;
  // Device-local record of refs already confirmed present in the cloud (we uploaded
  // them, or downloaded them from another device) — lets steady-state reconciles skip
  // blobs.json entirely once everything referenced locally is known-synced.
  function _knownBlobs(){ try{ return new Set(JSON.parse(localStorage.getItem('libreta_blob_known')||'[]')); }catch(e){ return new Set(); } }
  function _saveKnownBlobs(set){ try{ localStorage.setItem('libreta_blob_known', JSON.stringify([...set])); }catch(e){} }
  /* Fetch a Storage object as a Blob. No cache-buster (unlike dlText for state.json /
     manifests): blob bytes are immutable, so any cached response is correct. */
  async function _dlBlob(path){
    try{
      const { data, error } = await sb.storage.from(SUPABASE_BUCKET).createSignedUrl(path, 120);
      if(!error && data && data.signedUrl){ const r = await fetch(data.signedUrl); if(r.ok) return await r.blob(); }
    }catch(e){}
    try{ const { data, error } = await sb.storage.from(SUPABASE_BUCKET).download(path); if(error||!data) return null; return data; }
    catch(e){ return null; }
  }
  async function _uploadBlobObject(ref, blob){
    try{
      const { error } = await sb.storage.from(SUPABASE_BUCKET)
        .upload(BLOB_PATH(ref), blob, { upsert:true, contentType: blob.type||'application/octet-stream', cacheControl:'31536000' });
      return !error;
    }catch(e){ return false; }
  }
  /* PURE (no IO): "is there any real work for media sync to do?" True the moment a
     referenced blob is either absent from this device's IndexedDB, or present but not
     yet confirmed synced to the cloud. Gates the ENTIRE network path in reconcileMedia
     — when this is false, a workspace with no new/missing media costs zero requests.
     (We can't yet tell whether a "missing" ref is actually in the cloud without
     fetching blobs.json, so any missing ref conservatively counts as work; planMedia,
     below, does the real classification once the remote set is known.) Unit-tested via
     tests/media-reconcile-tests.js, mirroring planReconcile's truth-table pattern. */
  function needsMediaSync(refs, idbKeys, known){
    const idbSet=new Set(idbKeys||[]), knownSet=new Set(known||[]);
    for(const ref of (refs||[])){
      if(!idbSet.has(ref)) return true;    // referenced but not on this device — worth a look
      if(!knownSet.has(ref)) return true;  // held locally but never confirmed synced
    }
    return false;
  }
  /* PURE (no IO): classify each referenced ref against local IndexedDB state, the
     device's known-synced set, and the cloud's blobs.json refs — exactly the same
     shape of decision as planReconcile, one level simpler (no LWW/tombstones needed;
     content-addressed blobs are immutable, so "exists" is the only fact that matters).
       download — referenced + missing locally + the cloud actually has it
       upload   — referenced + held locally + NOT already in the cloud
       skip     — referenced + held locally + the cloud already has it (dedup: just
                  mark it known, no redundant re-upload)
     A ref that's missing locally AND absent from the cloud lands in none of the three
     — left alone, retried on the next reconcile once the originating device catches up. */
  function planMedia(refs, idbKeys, known, remoteRefs){
    const idbSet=new Set(idbKeys||[]), knownSet=new Set(known||[]), rrefs=remoteRefs||{};
    const plan={ download:[], upload:[], skip:[] };
    for(const ref of (refs||[])){
      const inIdb=idbSet.has(ref), inCloud=!!rrefs[ref];
      if(!inIdb){ if(inCloud) plan.download.push(ref); continue; }
      if(!knownSet.has(ref)){ if(inCloud) plan.skip.push(ref); else plan.upload.push(ref); }
    }
    return plan;
  }
  /* Two-way per-blob reconcile: called from reconcileRecords AFTER doc/table downloads
     are applied and DB.load() has refreshed the cache (so collectRefs() sees any blob
     ref that just arrived via a downloaded doc), and BEFORE this device uploads its own
     changed docs/tables (so a doc we're about to push never points at a blob the cloud
     doesn't have yet — best-effort; a residual race is covered by the missing-blob
     retry on the next reconcile). No-ops instantly if the flag is off. */
  async function reconcileMedia(){
    if(!_mediaSyncOn()) return;
    let refs; try{ refs = [...collectRefs()]; }catch(e){ return; }
    if(!refs.length) return;
    const known = _knownBlobs();
    let idbKeys; try{ idbKeys = await IDB.keys(); }catch(e){ idbKeys = []; }
    if(!needsMediaSync(refs, idbKeys, known)) return;   // steady state — zero network
    const remote = (await _dlJson(BLOBS_PATH())) || { v:1, refs:{} };
    const plan = planMedia(refs, idbKeys, known, remote.refs);
    let cloudChanged=false, landed=false;
    for(const ref of plan.download){
      const blob = await _dlBlob(BLOB_PATH(ref));
      if(blob){ try{ await IDB.put(ref, blob); known.add(ref); landed=true; }catch(e){} }
    }
    plan.skip.forEach(ref=> known.add(ref));   // already in the cloud — record locally, no re-upload
    for(const ref of plan.upload){
      let blob; try{ blob = await IDB.get(ref); }catch(e){ blob=null; }
      if(!blob) continue;
      if(await _uploadBlobObject(ref, blob)){ remote.refs[ref]=new Date().toISOString(); known.add(ref); cloudChanged=true; }
    }
    if(cloudChanged) await _uploadJson(BLOBS_PATH(), remote);
    _saveKnownBlobs(known);
    if(landed){ try{ await preloadBlobs(); }catch(e){} }   // rebuild object URLs for newly-arrived blobs
  }

  /* Two-way per-record reconcile. Downloads remote-newer records, applies remote
     deletions, uploads local-newer records, propagates local deletions as tombstones,
     then writes the merged manifest + meta pointer. Returns the executed plan. */
  async function reconcileRecords(){
    if(!sb||!user) return null;
    const remote = (await _dlJson(RECMAN())) || {recs:{},deleted:{}};
    const plan = planReconcile(localManifest(), remote, _getBase());
    let dataChanged=false;
    for(const k of plan.download){
      if(k==='kv'){ const kv=await _dlJson(RECKV()); if(kv){ _applyKv(kv); try{ _rawSet.call(localStorage,'libreta_kv_mtime', (remote.recs&&remote.recs['kv'])||new Date().toISOString()); }catch(e){} if(typeof applyCfg==='function') applyCfg(); dataChanged=true; } continue; }
      const obj=await _dlJson(_recPath(k)); if(!obj) continue;
      DB._suppress=true; try{ if(k.startsWith('doc:')) await Persist.putDoc(obj); else if(k.startsWith('tbl:')) await Persist.putTbl(obj); } finally{ DB._suppress=false; }
      dataChanged=true;
    }
    for(const k of plan.delLocal){
      DB._suppress=true; try{ if(k.startsWith('doc:')) await Persist.delDoc(k.slice(4)); else if(k.startsWith('tbl:')) await Persist.delTbl(k.slice(4)); } finally{ DB._suppress=false; }
      dataChanged=true;
    }
    if(dataChanged) await DB.load();   // refresh cache before reading it for uploads / re-render
    await reconcileMedia();            // flag-gated; no-op instantly unless libreta_media_sync==='on'
    const localNow = localManifest();
    for(const k of plan.upload){
      if(k==='kv'){ await _uploadJson(RECKV(), _kvBundle()); continue; }
      if(k.startsWith('doc:')){ const d=DB.getDoc(k.slice(4)); if(d) await _uploadJson(_recPath(k), d); }
      else if(k.startsWith('tbl:')){ const t=DB.getTbl(k.slice(4)); if(t) await _uploadJson(_recPath(k), t); }
    }
    const merged={ v:1, updatedAt:new Date().toISOString(), recs:Object.assign({},remote.recs), deleted:Object.assign({},remote.deleted) };
    // Uploading a record un-deletes it: drop any stale tombstone so a restored/re-created
    // page doesn't stay shadowed by an old delete on other devices.
    plan.upload.forEach(k=>{ merged.recs[k]=localNow[k]; delete merged.deleted[k]; });
    // Tombstone timestamp MUST be the same ISO format as record updatedAt — they're
    // compared lexicographically in planReconcile. (Epoch-ms strings like "1719…" sort
    // BEFORE ISO strings like "2026…", so a numeric tombstone never wins and the other
    // device resurrects the deleted page.)
    const tnow=new Date().toISOString();
    plan.tombstone.forEach(k=>{ merged.deleted[k]=tnow; delete merged.recs[k]; });
    plan.delLocal.forEach(k=>{ delete merged.recs[k]; });
    if(plan.upload.length||plan.tombstone.length){
      await _uploadJson(RECMAN(), merged); await writeMeta(merged.updatedAt);
      _remoteStamp=merged.updatedAt; setCloudTs(merged.updatedAt);
      if(_realtimeChannel){ try{ _realtimeChannel.send({type:'broadcast',event:'push',payload:{updatedAt:merged.updatedAt}}); }catch(e){} }
    } else if(remote.updatedAt){ _remoteStamp=remote.updatedAt; setCloudTs(remote.updatedAt); }
    _setBase({ recs:localManifest(), deleted:merged.deleted });
    _syncedSig = contentSig(); clearDirty();
    if(dataChanged){
      if(typeof updateTrashBadge==='function') updateTrashBadge();   // trash count may have changed via the kv bundle
      if(typeof rerenderView==='function' && !activelyEditing()){ if(typeof preloadBlobs==='function') await preloadBlobs(); rerenderView(); }
    }
    return plan;
  }

  return { boot, push, signOut, deleteEverything, reconcileRecords, planReconcile, localManifest, setSyncMode, setMediaSync, planMedia, needsMediaSync, get mediaSyncOn(){ return _mediaSyncOn(); }, get user(){ return user; } };
})();
