/* ═══════════════════════════════════════════════
   MEDIA: reference collection, GC, one-time migration, export/import
═══════════════════════════════════════════════ */
function collectRefs(){
  const refs=new Set();
  const add=v=>{ if(isBlobRef(v)) refs.add(v); };
  const scanDoc=d=>{
    add(d.meta&&d.meta.cover); add(d.meta&&d.meta.icon);
    flattenBlocks(d.blocks||[]).forEach(b=>{
      add(b.src); add(b.fileId); add(b.icon);
      if(b.images) b.images.forEach(im=>add(im.src));
    });
    (d.props||[]).forEach(p=>{ if(p.value&&p.value.id) add(p.value.id); });
  };
  DB.getDocs().forEach(scanDoc);
  scanDoc(getHomeDoc());  // free-form home notes can hold images too
  // Database tables hold blob refs in their cells (image properties, etc.).
  DB.getTbls().forEach(t=>{ (t.rows||[]).forEach(r=>{ if(r.cells) Object.values(r.cells).forEach(add); }); });
  // Version-history snapshots reference images too — keep their blobs alive so a
  // restored older version still shows its pictures.
  try{ const vs=(typeof _allVersions==='function')?_allVersions():{}; Object.values(vs).forEach(list=>(list||[]).forEach(scanDoc)); }catch(e){}
  // Pages sitting in Trash still own their media — keep their blobs until they're purged.
  try{ JSON.parse(localStorage.getItem('folio_trash')||'[]').forEach(scanDoc); }catch(e){}
  // Uploaded custom fonts are stored as blobs too — keep them from being GC'd.
  try{ (getCfg().customFonts||[]).forEach(cf=>add(cf&&cf.ref)); }catch(e){}
  return refs;
}
async function gcBlobs(){
  try{
    const keys=await IDB.keys(); const refs=collectRefs();
    for(const k of keys){ if(!refs.has(k)){ await IDB.del(k); const u=imgCache.get(k); if(u)URL.revokeObjectURL(u); imgCache.delete(k); } }
  }catch(e){}
}
/* One-time: move any inline base64 still sitting in localStorage into IndexedDB refs. */
async function migrateInlineImages(){
  const docs=DB.getDocs();
  const conv=async v=>{ if(typeof v==='string'&&v.startsWith('data:')){ try{return await storeBlob(dataURLtoBlob(v))}catch(e){return v} } return v; };
  for(const d of docs){
    let changed=false;
    if(d.meta){
      const c=await conv(d.meta.cover); if(c!==d.meta.cover){d.meta.cover=c;changed=true}
      const ic=await conv(d.meta.icon); if(ic!==d.meta.icon){d.meta.icon=ic;changed=true}
    }
    for(const b of flattenBlocks(d.blocks||[])){
      if(typeof b.src==='string'&&b.src.startsWith('data:')){b.src=await conv(b.src);changed=true}
      if(b.images) for(const im of b.images){ if(typeof im.src==='string'&&im.src.startsWith('data:')){im.src=await conv(im.src);changed=true} }
      if(typeof b.fileData==='string'&&b.fileData.startsWith('data:')){b.fileId=await conv(b.fileData);delete b.fileData;changed=true}
    }
    for(const p of (d.props||[])){ if(p.value&&typeof p.value.data==='string'&&p.value.data.startsWith('data:')){p.value.id=await conv(p.value.data);delete p.value.data;changed=true} }
    if(changed) DB.saveDoc(d);
  }
}
async function exportData(){
  const docs=DB.getDocs(), tables=DB.getTbls(), cfg=getCfg();
  const images={};
  for(const id of collectRefs()){ const blob=await IDB.get(id); if(blob){ const du=await blobToDataURL(blob); if(du) images[id]=du; } }
  const bundle={app:'libreta',version:1,exportedAt:new Date().toISOString(),docs,tables,cfg,images};
  const blob=new Blob([JSON.stringify(bundle)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='libreta-backup-'+new Date().toISOString().slice(0,10)+'.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  toast('Exported '+docs.length+' document'+(docs.length!==1?'s':''));
}
/* Storage durability status + manual request (shown in Options → Data & Backup) */
async function renderStorageStatus(){
  const el=document.getElementById('storage-status'); if(!el) return;
  if(!(navigator.storage&&navigator.storage.estimate)){ el.innerHTML='Storage API not available in this browser.'; return; }
  let persisted=false, usage=0, quota=0;
  try{ if(navigator.storage.persisted) persisted=await navigator.storage.persisted(); const est=await navigator.storage.estimate(); usage=est.usage||0; quota=est.quota||0; }catch(e){}
  const pct=quota?Math.min(100,Math.round(usage/quota*100)):0;
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="width:8px;height:8px;border-radius:50%;background:${persisted?'var(--gr)':'var(--mu)'};display:inline-block"></span>
      <span style="color:var(--tx)">${persisted?'Persistent — safe from eviction':'Best-effort — may be evicted under disk pressure'}</span>
    </div>
    <div style="color:var(--mu)">Using ${formatFileSize(usage)} of ~${formatFileSize(quota)} available${quota?` (${pct}%)`:''}.</div>
    ${persisted?'':`<button class="cfg-opt" style="margin-top:8px" onclick="requestPersistentStorage()">Make storage persistent</button>`}`;
}
async function requestPersistentStorage(){
  if(!(navigator.storage&&navigator.storage.persist)){ toast('This browser does not support persistent storage'); return; }
  try{
    const ok=await navigator.storage.persist();
    toast(ok?'Storage is now persistent':'The browser declined — try again after using the app more');
  }catch(e){ toast('Could not request persistent storage'); }
  renderStorageStatus();
}
function triggerImport(){ const i=document.getElementById('import-file-input'); i.value=''; i.click(); }
async function onImportFile(input){
  const file=input.files[0]; if(!file) return;
  let bundle;
  try{ bundle=JSON.parse(await file.text()); }catch(e){ toast('Could not read that backup file'); return; }
  if(!bundle||(bundle.app!=='libreta'&&bundle.app!=='folio')){ toast('That is not a Libreta backup file'); return; }
  // A backup file is untrusted input (it may have been authored or tampered with
  // elsewhere). Strip any script / event-handler / dangerous markup from block
  // content before it ever reaches the DOM — otherwise an imported page could run
  // code in our origin and hijack the signed-in session.
  if(typeof sanitizeImportedDocs==='function') sanitizeImportedDocs(bundle.docs);
  const n=(bundle.docs||[]).length;
  showConfirm('Import this backup? It will REPLACE all current documents, tables, and settings.',async()=>{
    if(bundle.images){ for(const [id,dataURL] of Object.entries(bundle.images)){ try{const b=dataURLtoBlob(dataURL);await IDB.put(id,b);imgCache.set(id,URL.createObjectURL(b));}catch(e){} } }
    DB.replaceAll(bundle.docs||[], bundle.tables||[]); // updates the in-memory cache + persists via the adapter
    if(bundle.cfg) localStorage.setItem(CFG_KEY,JSON.stringify(bundle.cfg));
    applyCfg(); gcBlobs(); nav('documents'); toast('Imported '+n+' document'+(n!==1?'s':''));
  },'Import & Replace','Import backup');
}
