/* ═══════════════════════════════════════════════
   WORKSPACE FOLDER — your notes as plain files (desktop only)

   By default everything lives in the webview's own storage (IndexedDB +
   localStorage), which is fast but invisible. This module lets the user point
   Libreta at a folder instead. From then on the folder IS the workspace:

     <folder>/libreta.json        marker: {app, format, createdAt}
     <folder>/pages/<id>.json     one file per page
     <folder>/databases/<id>.json one file per database
     <folder>/media/<ref>.<ext>   images and attachments, by content hash
     <folder>/settings.json       the small folio_* singletons (theme, sidebar, …)
     <folder>/versions.json       page version history
     <folder>/trash.json          deleted pages awaiting purge

   Nothing about the rest of the app changes: it still talks to `DB` and `IDB`,
   and those forward to the adapters below (see setPersistenceAdapter /
   setMediaStore in storage.js). localStorage keeps working as the synchronous
   working copy of settings; a patched Storage.setItem mirrors folio_* writes
   into the three json files, debounced.

   Put the folder in Dropbox, Google Drive, iCloud or OneDrive and another
   computer running Libreta can open the same folder. There is no live merge in
   this version: last writer wins per file, so close Libreta on one machine
   before opening it on another. Files that don't look like Libreta's (Dropbox
   "conflicted copy" files, stray notes) are ignored, never deleted.

   Access to the folder is granted by the native folder picker (dialog:allow-open
   → recursive fs scope) and remembered across launches by the persisted-scope
   plugin. The page never gets access to any other path.
═══════════════════════════════════════════════ */
const WS_DIR_KEY = 'libreta_workspace_dir';   // device-local: which folder this machine uses
const WS_MARKER  = 'libreta.json';
const WS_FORMAT  = 1;
const WS_ID_RE   = /^[A-Za-z0-9_-]+$/;        // ids double as file names — anything else is skipped
const WS_MIME_EXT = { 'image/webp':'webp','image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/svg+xml':'svg','image/avif':'avif','image/bmp':'bmp','image/tiff':'tiff',
  'application/pdf':'pdf','text/plain':'txt','text/markdown':'md','text/csv':'csv','application/json':'json','application/zip':'zip',
  'audio/mpeg':'mp3','audio/wav':'wav','audio/ogg':'ogg','video/mp4':'mp4','video/webm':'webm',
  'font/woff2':'woff2','font/woff':'woff','font/ttf':'ttf','font/otf':'otf','application/octet-stream':'bin' };
const WS_EXT_MIME = Object.fromEntries(Object.entries(WS_MIME_EXT).map(([m,e])=>[e,m]));

const Workspace = (()=>{
  const T = ()=>window.__TAURI__;
  let dir=null, SEP='/';
  const join=(...p)=>p.join(SEP);
  const sepFor=d=>d.includes('\\')?'\\':'/';

  /* ── Files: per-path write queue + write-then-rename so a crash or a cloud client
        mid-copy never leaves a half-written page behind. ── */
  const _q=new Map();
  function _serial(path, fn){
    const next=(_q.get(path)||Promise.resolve()).catch(()=>{}).then(fn);
    _q.set(path,next); next.finally(()=>{ if(_q.get(path)===next) _q.delete(path); });
    return next;
  }
  const _tmp=path=>path+'.'+Math.random().toString(36).slice(2,8)+'.tmp';
  const writeTextAtomic=(path,text)=>_serial(path, async()=>{ const t=_tmp(path); await T().fs.writeTextFile(t,text); await T().fs.rename(t,path); });
  const writeBytesAtomic=(path,bytes)=>_serial(path, async()=>{ const t=_tmp(path); await T().fs.writeFile(t,bytes); await T().fs.rename(t,path); });
  const removeQuiet=path=>_serial(path, async()=>{ try{ await T().fs.remove(path); }catch(e){ /* already gone */ } });
  async function ensureDirs(base,sep){ for(const d of ['pages','databases','media']) await T().fs.mkdir(base+sep+d,{recursive:true}); }

  /* ── Documents + databases: one JSON file each ── */
  async function readJsonDir(sub){
    const base=join(dir,sub); let entries=[];
    try{ entries=await T().fs.readDir(base); }catch(e){ return []; }
    const files=entries.filter(e=>e.isFile&&/^[A-Za-z0-9_-]+\.json$/.test(e.name));
    const out=await Promise.all(files.map(async e=>{
      try{ const o=JSON.parse(await T().fs.readTextFile(join(base,e.name))); return (o&&o.id===e.name.slice(0,-5))?o:null; }
      catch(err){ console.warn('[workspace] skipped unreadable file',sub+'/'+e.name,err); return null; }
    }));
    return out.filter(Boolean);
  }
  function putJson(sub,obj){
    if(!obj||!WS_ID_RE.test(String(obj.id||''))){ console.warn('[workspace] refusing to write record with unsafe id',obj&&obj.id); return Promise.resolve(false); }
    return writeTextAtomic(join(dir,sub,obj.id+'.json'), JSON.stringify(obj,null,2));
  }
  async function replaceDir(sub,arr){
    const keep=new Set((arr||[]).map(o=>o.id));
    let entries=[]; try{ entries=await T().fs.readDir(join(dir,sub)); }catch(e){}
    for(const e of entries){ const m=e.isFile&&e.name.match(/^([A-Za-z0-9_-]+)\.json$/); if(m&&!keep.has(m[1])) await removeQuiet(join(dir,sub,e.name)); }
    for(const o of (arr||[])) await putJson(sub,o);
    return true;
  }
  const FsDataAdapter={
    name:'folder',
    loadDocs(){ return readJsonDir('pages'); },
    loadTbls(){ return readJsonDir('databases'); },
    putDoc(d){ return putJson('pages',d); },
    delDoc(id){ return WS_ID_RE.test(id)?removeQuiet(join(dir,'pages',id+'.json')):Promise.resolve(false); },
    putTbl(t){ return putJson('databases',t); },
    delTbl(id){ return WS_ID_RE.test(id)?removeQuiet(join(dir,'databases',id+'.json')):Promise.resolve(false); },
    putAllDocs(arr){ return replaceDir('pages',arr); },
    putAllTbls(arr){ return replaceDir('databases',arr); },
  };

  /* ── Media: <ref>.<ext> under media/, extension from the blob's type ── */
  const _media=new Map();   // ref → file name
  async function scanMedia(){
    _media.clear(); let entries=[];
    try{ entries=await T().fs.readDir(join(dir,'media')); }catch(e){}
    for(const e of entries){ const m=e.isFile&&e.name.match(/^(img_[A-Za-z0-9-]+)\.([A-Za-z0-9]+)$/); if(m) _media.set(m[1],e.name); }
    return _media;
  }
  const blobFromBytes=(bytes,name)=>new Blob([bytes],{type:WS_EXT_MIME[(name.split('.').pop()||'').toLowerCase()]||'application/octet-stream'});
  async function readMedia(id){
    let name=_media.get(id); if(!name){ await scanMedia(); name=_media.get(id); }
    if(!name) return null;
    try{ return blobFromBytes(await T().fs.readFile(join(dir,'media',name)),name); }catch(e){ return null; }
  }
  const FsMediaStore={
    name:'folder',
    async put(id,blob){
      if(!WS_ID_RE.test(id)) return false;
      const name=id+'.'+(WS_MIME_EXT[blob.type]||'bin'), old=_media.get(id);
      await writeBytesAtomic(join(dir,'media',name), new Uint8Array(await blob.arrayBuffer()));
      _media.set(id,name);
      if(old&&old!==name) removeQuiet(join(dir,'media',old));
      return true;
    },
    get(id){ return readMedia(id); },
    async del(id){ let name=_media.get(id); if(!name){ await scanMedia(); name=_media.get(id); } if(!name) return true; _media.delete(id); await removeQuiet(join(dir,'media',name)); return true; },
    async keys(){ await scanMedia(); return [..._media.keys()]; },
    async all(){ await scanMedia(); const out=[]; for(const [id,name] of _media){ try{ out.push({id, blob:blobFromBytes(await T().fs.readFile(join(dir,'media',name)),name)}); }catch(e){} } return out; },
  };

  /* ── Settings: mirror folio_* localStorage keys into three json files ── */
  const WS_SKIP=new Set(['folio_docs','folio_tables']);   // legacy monoliths — pages live in pages/, never here
  const groupOf=k=>k==='folio_versions'?'versions':k==='folio_trash'?'trash':'settings';
  const isMirrored=k=>typeof k==='string'&&k.indexOf('folio_')===0&&!WS_SKIP.has(k);
  function collect(group){ const o={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(isMirrored(k)&&groupOf(k)===group) o[k]=localStorage.getItem(k); } return o; }
  const _timers={};
  function flushGroup(g){
    clearTimeout(_timers[g]); delete _timers[g];
    return writeTextAtomic(join(dir,g+'.json'), JSON.stringify(collect(g),null,2)).catch(e=>console.warn('[workspace] could not write',g+'.json',e));
  }
  const schedule=g=>{ clearTimeout(_timers[g]); _timers[g]=setTimeout(()=>flushGroup(g),400); };
  const flushAll=()=>Promise.all(['settings','versions','trash'].map(flushGroup));
  let _mirrored=false;
  function installMirror(){
    if(_mirrored) return; _mirrored=true;
    const rawSet=Storage.prototype.setItem, rawRemove=Storage.prototype.removeItem;
    Storage.prototype.setItem=function(k,v){ rawSet.call(this,k,v); if(this===localStorage&&isMirrored(k)) schedule(groupOf(k)); };
    Storage.prototype.removeItem=function(k){ rawRemove.call(this,k); if(this===localStorage&&isMirrored(k)) schedule(groupOf(k)); };
    window.addEventListener('pagehide',()=>{ Object.keys(_timers).forEach(flushGroup); });
  }
  async function loadSettings(){
    const incoming={};
    for(const f of ['settings.json','versions.json','trash.json']){
      try{ Object.assign(incoming, JSON.parse(await T().fs.readTextFile(join(dir,f)))||{}); }catch(e){ /* absent on a brand-new folder */ }
    }
    // The folder's settings replace this device's copies (both are the same workspace).
    const stale=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(isMirrored(k)) stale.push(k); }
    stale.forEach(k=>localStorage.removeItem(k));
    for(const [k,v] of Object.entries(incoming)) if(isMirrored(k)&&typeof v==='string') localStorage.setItem(k,v);
  }

  /* ── Switching stores ── */
  function use(d){ dir=d; SEP=sepFor(d); _media.clear(); setPersistenceAdapter(FsDataAdapter); setMediaStore(FsMediaStore); }
  const remembered=()=>{ try{ return localStorage.getItem(WS_DIR_KEY)||''; }catch(e){ return ''; } };
  const remember=d=>{ try{ localStorage.setItem(WS_DIR_KEY,d); }catch(e){} };
  const forget=()=>{ try{ localStorage.removeItem(WS_DIR_KEY); }catch(e){} };

  /* Boot: called by init.js before anything reads DB or IDB. */
  async function boot(){
    if(!IS_DESKTOP) return;
    const d=remembered(); if(!d) return;
    let ok=false; try{ ok=await T().fs.exists(d+sepFor(d)+WS_MARKER); }catch(e){ ok=false; }
    if(!ok) return gateMissing(d);
    use(d);
    await loadSettings();
    installMirror();
  }
  /* The folder isn't there (drive unplugged, cloud client not running, folder moved).
     Don't quietly boot from this device's stale copy — ask. The returned promise
     never resolves, so the app stays put until the user picks. */
  async function gateMissing(d){
    // init.js runs before the parser reaches the dialog markup further down index.html,
    // and a fast `exists` check can resolve before the DOM is complete — wait for it.
    if(document.readyState==='loading') await new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true}));
    showConfirm(`Libreta can’t find your workspace folder at:\n${d}\n\nIf it’s on a drive or in a cloud folder that isn’t connected yet, connect it and choose Retry. Or use this device’s own storage for now — the folder is left as it is, but notes in it won’t be on this device until it’s back.`,
      ()=>{ forget(); location.reload(); }, 'Use this device for now', 'Workspace folder not found');
    const cfm=document.getElementById('cfm');
    if(cfm){ new MutationObserver(()=>{ if(!cfm.classList.contains('open')) location.reload(); }).observe(cfm,{attributes:true,attributeFilter:['class']}); }
    return new Promise(()=>{});
  }

  /* Settings → "Keep my notes in a folder…" / "Change folder…" */
  async function chooseFolder(){
    if(!IS_DESKTOP){ toast('Folders are a desktop feature'); return; }
    // A folder and an account are two things syncing the same notes. Only one at a
    // time, or they overwrite each other's work.
    if(typeof Cloud!=='undefined' && Cloud.on){
      showConfirm('You’re signed in, and your account is already syncing these notes. A folder would be a second copy syncing the same pages, so Libreta keeps them separate.\n\nLog out first if you’d rather use a folder — your notes stay on this device either way.',
        ()=>{ if(Cloud.signOut) Cloud.signOut(); }, 'Log out', 'Already syncing');
      return;
    }
    let picked=null;
    try{ picked=await T().dialog.open({ directory:true, recursive:true, multiple:false, title:'Choose a folder for your Libreta notes', defaultPath:dir||undefined }); }
    catch(e){ toast('Could not open the folder picker'); return; }
    if(!picked) return;
    const d=String(picked), sep=sepFor(d);
    if(d===dir){ toast('That is already your workspace folder'); return; }
    let hasWs=false; try{ hasWs=await T().fs.exists(d+sep+WS_MARKER); }catch(e){}
    if(hasWs){
      showConfirm('This folder already holds a Libreta workspace. Open it? Nothing on this device is deleted — you can switch back any time.',
        ()=>{ remember(d); location.reload(); }, 'Open that workspace', 'Existing workspace found');
      return;
    }
    let others=[]; try{ others=(await T().fs.readDir(d)).filter(e=>!/^\./.test(e.name)); }catch(e){}
    const go=()=>migrateTo(d,sep);
    if(others.length) showConfirm(`This folder already has ${others.length} item${others.length===1?'':'s'} in it. Libreta will add its own files alongside them (pages/, databases/, media/ and a few .json files). A folder of its own is tidier.`, go, 'Use it anyway', 'Folder is not empty');
    else go();
  }
  /* Copy everything the app currently holds into `d`, then reopen from there. */
  async function migrateTo(d,sep){
    const p=progressToast('Moving your notes into the folder…');
    const prev={dir,SEP};
    try{
      const docs=DB.getDocs(), tbls=DB.getTbls(), media=await IDB.all();   // read from wherever we are now
      use(d);                                                              // …then write to the new folder
      await ensureDirs(d,sep);
      for(const doc of docs) await FsDataAdapter.putDoc(doc);
      for(const t of tbls)   await FsDataAdapter.putTbl(t);
      let n=0; for(const {id,blob} of media){ if(blob) await FsMediaStore.put(id,blob); p.update(`Copying images… ${++n}/${media.length}`); }
      await Promise.all(['settings','versions','trash'].map(g=>writeTextAtomic(join(d,g+'.json'), JSON.stringify(collect(g),null,2))));
      await writeTextAtomic(join(d,WS_MARKER), JSON.stringify({app:'libreta',format:WS_FORMAT,createdAt:new Date().toISOString()},null,2));
      remember(d); p.done('Done — reopening from the folder'); setTimeout(()=>location.reload(),600);
    }catch(e){
      console.error('[workspace] migration failed',e);
      if(prev.dir) use(prev.dir); else { dir=null; setPersistenceAdapter(IdbDataAdapter); setMediaStore(IdbMediaStore); }
      p.fail('Could not write to that folder — nothing was changed');
    }
  }
  /* Settings → "Use this device instead": copy the folder's notes back into this
     device's storage and stop using the folder (the folder is left untouched). */
  function useDevice(){
    if(!dir) return;
    showConfirm('Copy your notes back to this device and stop using the folder? The folder and its files are left exactly as they are.', async()=>{
      const p=progressToast('Copying your notes to this device…');
      try{
        const docs=DB.getDocs(), tbls=DB.getTbls(), media=await FsMediaStore.all();
        await IdbDataAdapter.putAllDocs(docs); await IdbDataAdapter.putAllTbls(tbls);
        for(const {id,blob} of media) await IdbMediaStore.put(id,blob);
        forget(); p.done('Done — reopening from this device'); setTimeout(()=>location.reload(),600);
      }catch(e){ console.error('[workspace] copy back failed',e); p.fail('Could not copy — still using the folder'); }
    }, 'Use this device', 'Switch to device storage');
  }

  /* Settings → "Where your notes live" */
  function render(){
    const el=document.getElementById('cfg-workspace'); if(!el) return;
    if(!IS_DESKTOP){
      // Android has the same __TAURI__ bridge but no folder picker, so don't offer one.
      const where = IS_MOBILE ? 'On this phone' : 'In this browser';
      el.innerHTML=`<div style="font-size:12px;color:var(--tx);margin-bottom:2px">${where}</div>
        <div style="font-size:10px;color:var(--mu);line-height:1.6">Your notes are stored in the app itself. Use <b>Data &amp; Backup → Export</b> to move them to or from a computer. Folders are a desktop feature — a phone can’t open one — so syncing with a computer directly is not available yet.</div>`;
      return;
    }
    if(dir){
      el.innerHTML=`<div style="font-size:12px;color:var(--tx);margin-bottom:2px">In a folder</div>
        <div style="font-size:10px;color:var(--mu);font-family:var(--fm);word-break:break-all;margin-bottom:10px">${escHtml(dir)}</div>
        <div class="cfg-opt-row"><button class="cfg-opt" onclick="Workspace.chooseFolder()">Change folder…</button><button class="cfg-opt" onclick="Workspace.useDevice()">Use this device instead</button></div>
        <div style="font-size:10px;color:var(--mu);margin-top:8px;line-height:1.6">Your notes are the files in that folder — one per page, images in <b>media/</b>. Back it up like any folder. If it sits in Dropbox, Google Drive, iCloud or OneDrive, another computer running Libreta can open the same folder; close Libreta on one computer before opening it on the other.</div>`;
    }else{
      el.innerHTML=`<div style="font-size:12px;color:var(--tx);margin-bottom:2px">On this device</div>
        <div style="font-size:10px;color:var(--mu);margin-bottom:10px">Inside the app’s own storage. Only Export makes a copy you can see.</div>
        <button class="cfg-opt" onclick="Workspace.chooseFolder()">Keep my notes in a folder…</button>
        <div style="font-size:10px;color:var(--mu);margin-top:8px;line-height:1.6">Your notes become ordinary files you can see and back up. Choose a folder inside Dropbox, Google Drive, iCloud or OneDrive and another computer running Libreta can open the same notes.</div>`;
    }
  }

  return { boot, chooseFolder, useDevice, render, flushAll, get dir(){ return dir; }, get active(){ return !!dir; } };
})();
