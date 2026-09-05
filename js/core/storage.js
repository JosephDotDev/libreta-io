/* ═══════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════ */
/* ── PERSISTENCE ADAPTER ──────────────────────────────────────────────────
   The ONE place that knows WHERE documents + tables are stored. As of the storage
   restructure that's IndexedDB (`folio_data`), one record per doc/table — so saving
   one page writes one record instead of re-serialising the whole workspace, and the
   ~5 MB localStorage cap no longer bounds how much you can write. The small singleton
   keys (cfg, sidebar, trash, versions, …) still live in localStorage.

   The adapter API is per-record + bulk. Reads are async (load* hydrates the cache at
   boot); writes are fire-and-forget. The app itself stays SYNCHRONOUS because every
   getDoc/getTbl is served from the in-memory cache the adapter hydrates. Swap the
   adapter via setPersistenceAdapter() to point at a different backend. */

/* Low-level IndexedDB handle for structured data (separate DB from media blobs). */
const IDBData = {
  _db:null,
  open(){
    if(this._db) return Promise.resolve(this._db);
    return new Promise((res,rej)=>{
      const r=indexedDB.open('folio_data',1);
      r.onupgradeneeded=e=>{ const db=e.target.result;
        if(!db.objectStoreNames.contains('docs'))   db.createObjectStore('docs');
        if(!db.objectStoreNames.contains('tables')) db.createObjectStore('tables');
      };
      r.onsuccess=e=>{ this._db=e.target.result; res(this._db); };
      r.onerror=e=>rej(e.target.error);
    });
  },
  async getAll(store){ const db=await this.open(); return new Promise((res,rej)=>{ const tx=db.transaction(store,'readonly'); const rq=tx.objectStore(store).getAll(); rq.onsuccess=()=>res(rq.result||[]); rq.onerror=()=>rej(rq.error); }); },
  async put(store,val,key){ const db=await this.open(); return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).put(val,key); tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error); }); },
  async del(store,key){ const db=await this.open(); return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).delete(key); tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error); }); },
  async clear(store){ const db=await this.open(); return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); tx.objectStore(store).clear(); tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error); }); },
  async count(store){ const db=await this.open(); return new Promise((res)=>{ const tx=db.transaction(store,'readonly'); const rq=tx.objectStore(store).count(); rq.onsuccess=()=>res(rq.result||0); rq.onerror=()=>res(0); }); },
  async putAll(store,arr,keyFn){ const db=await this.open(); return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite'); const os=tx.objectStore(store); (arr||[]).forEach(v=>os.put(v,keyFn(v))); tx.oncomplete=()=>res(true); tx.onerror=()=>rej(tx.error); }); },
};
/* One-time, idempotent: if the IDB store is empty but the legacy monolithic
   localStorage key still holds data (a pre-restructure workspace, or an offline
   device that hasn't pulled), move it into IDB and drop the legacy key. */
async function _maybeMigrate(store, legacyKey){
  try{
    if((await IDBData.count(store))>0){ if(localStorage.getItem(legacyKey)) localStorage.removeItem(legacyKey); return; } // already in IDB; drop any stale legacy copy
    const raw=localStorage.getItem(legacyKey); if(!raw) return;
    const arr=JSON.parse(raw)||[]; if(arr.length) await IDBData.putAll(store, arr, v=>v.id);
    localStorage.removeItem(legacyKey);
  }catch(e){ console.warn('[storage] migrate failed for',store,e); }
}
/* ── COLD-BODY COMPRESSION (Phase 3) ──
   A doc untouched for a while is gzip-compressed on disk and inflated transparently
   on load. A "cold" record is { id, updatedAt, _z:Uint8Array(gzip(JSON(doc))) }; a hot
   record is the plain doc object. Editing a doc re-saves it plain (putDoc), so opening
   anything decompresses it automatically. gzip on text is ~5-10×. Falls back to no-op
   where CompressionStream is unavailable. */
const _hasCompression = typeof CompressionStream!=='undefined' && typeof DecompressionStream!=='undefined';
async function _gzip(str){
  if(!_hasCompression) return null;
  try{ const stream=new Blob([str]).stream().pipeThrough(new CompressionStream('gzip')); return new Uint8Array(await new Response(stream).arrayBuffer()); }
  catch(e){ return null; }
}
async function _gunzip(bytes){
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}
function _isCold(rec){ return rec && rec._z; }
async function _inflateDoc(rec){ return _isCold(rec) ? JSON.parse(await _gunzip(rec._z)) : rec; }
/* Background pass: compress docs whose updatedAt is older than `days`. Idempotent —
   skips already-cold records and never touches the in-memory cache (which holds the
   full doc); it only shrinks what's on disk. Returns how many it compressed. */
async function compactColdDocs(days){
  if(!_hasCompression) return 0;
  if(Persist!==IdbDataAdapter) return 0;   // folder workspaces keep every page as plain, readable JSON
  const cutoff=Date.now()-((days||30)*864e5);
  let recs; try{ recs=await IDBData.getAll('docs'); }catch(e){ return 0; }
  let n=0;
  for(const r of recs){
    if(!r || r._z) continue;
    const t=Date.parse(r.updatedAt||'')||0;
    if(t && t<cutoff){
      const bytes=await _gzip(JSON.stringify(r));
      if(bytes){ try{ await IDBData.put('docs', { id:r.id, updatedAt:r.updatedAt, _z:bytes }, r.id); n++; }catch(e){} }
    }
  }
  return n;
}

const IdbDataAdapter = {
  name:'idb',
  async loadDocs(){ await _maybeMigrate('docs','folio_docs'); const recs=await IDBData.getAll('docs'); return Promise.all(recs.map(_inflateDoc)); },
  async loadTbls(){ await _maybeMigrate('tables','folio_tables'); return IDBData.getAll('tables'); },
  putDoc(d){ return IDBData.put('docs', d, d.id); },   // always stored hot (plain); compaction re-cools it later
  delDoc(id){ return IDBData.del('docs', id); },
  putTbl(t){ return IDBData.put('tables', t, t.id); },
  delTbl(id){ return IDBData.del('tables', id); },
  async putAllDocs(arr){ await IDBData.clear('docs');   return IDBData.putAll('docs', arr, d=>d.id); },
  async putAllTbls(arr){ await IDBData.clear('tables'); return IDBData.putAll('tables', arr, t=>t.id); },
};
let Persist = IdbDataAdapter;
function setPersistenceAdapter(adapter){ Persist = adapter; }  // swap-in point for a future backend
/* Rollback escape hatch: re-serialise IDB back into the legacy localStorage keys.
   (Manual recovery aid — not used in the normal flow.) */
async function migrateBack(){
  try{ localStorage.setItem('folio_docs',   JSON.stringify(await Persist.loadDocs())); }catch(e){}   // loadDocs inflates cold records
  try{ localStorage.setItem('folio_tables', JSON.stringify(await Persist.loadTbls())); }catch(e){}
}

/* Doc/table writes no longer touch localStorage, so the Storage.setItem patch the
   sync layer uses can't see them. Emit a content-changed signal the cloud layer
   subscribes to (see installAutosync). Suppressed while a pulled snapshot is being
   applied so we don't re-upload what we just downloaded. */
function _emitContentChanged(){ if(DB._suppress) return; try{ document.dispatchEvent(new CustomEvent('libreta:content')); }catch(e){} }

/* ── DB ── in-memory source of truth + per-record persistence.
   Public API is unchanged and synchronous: getDocs/getDoc/saveDoc/delDoc and
   the table equivalents. Reads hit the cache (no re-parsing); writes update the
   cache and persist ONE record. `await DB.load()` hydrates at boot. */
const DB = {
  _docs:null, _tbls:null, _ready:false, _suppress:false,

  async load(){
    this._docs = await Promise.resolve(Persist.loadDocs());
    this._tbls = await Promise.resolve(Persist.loadTbls());
    this._ready = true;
    return true;
  },
  // Safety net: IDB can't be read synchronously, so if anything reads before load()
  // resolved, serve empty arrays (load() is awaited at boot before the first render).
  _ensure(){ if(this._ready) return; this._docs=this._docs||[]; this._tbls=this._tbls||[]; },
  _persistDoc(d){ Promise.resolve(Persist.putDoc(d)).catch(e=>{ console.warn('[storage] putDoc failed',e); if(typeof toast==='function')toast('Storage error — change may not be saved.'); }); if(typeof searchInvalidate==='function')searchInvalidate(); _emitContentChanged(); },
  _persistTbl(t){ Promise.resolve(Persist.putTbl(t)).catch(e=>{ console.warn('[storage] putTbl failed',e); if(typeof toast==='function')toast('Storage error — change may not be saved.'); }); _emitContentChanged(); },

  getDocs(){ this._ensure(); return this._docs; },
  getDoc(id){ this._ensure(); return this._docs.find(d=>d.id===id)||null; },
  saveDoc(doc){ this._ensure(); doc.updatedAt=new Date().toISOString();
    const i=this._docs.findIndex(d=>d.id===doc.id); if(i>=0)this._docs[i]=doc; else this._docs.unshift(doc);
    this._persistDoc(doc); return true; },
  delDoc(id){ this._ensure(); const d=this.getDoc(id);
    if(d&&d.dbId){const t=this.getTbl(d.dbId);if(t){t.rows=t.rows.filter(r=>r.docId!==id);this.saveTbl(t);}}
    this._docs=this._docs.filter(x=>x.id!==id);
    Promise.resolve(Persist.delDoc(id)).catch(e=>console.warn('[storage] delDoc failed',e));
    if(typeof searchInvalidate==='function')searchInvalidate(); _emitContentChanged();
    if(typeof deleteVersions==='function')deleteVersions(id); },
  getTbls(){ this._ensure(); return this._tbls; },
  getTbl(id){ this._ensure(); return this._tbls.find(t=>t.id===id)||null; },
  saveTbl(t){ this._ensure(); t.updatedAt=new Date().toISOString();
    const i=this._tbls.findIndex(x=>x.id===t.id); if(i>=0)this._tbls[i]=t; else this._tbls.unshift(t);
    this._persistTbl(t); return true; },
  delTbl(id){ this._ensure(); this._tbls=this._tbls.filter(t=>t.id!==id);
    Promise.resolve(Persist.delTbl(id)).catch(e=>console.warn('[storage] delTbl failed',e)); _emitContentChanged(); },

  /* Bulk replace (used by Import + sync apply) — refresh the cache + persist in one shot.
     `silent` skips the content-changed signal (used when applying a pulled snapshot). */
  replaceAll(docs,tables,silent){ this._ensure(); if(docs)this._docs=docs; if(tables)this._tbls=tables;
    Promise.resolve(Persist.putAllDocs(this._docs)).catch(e=>console.warn('[storage] putAllDocs failed',e));
    Promise.resolve(Persist.putAllTbls(this._tbls)).catch(e=>console.warn('[storage] putAllTbls failed',e));
    if(typeof searchInvalidate==='function')searchInvalidate(); if(!silent) _emitContentChanged(); },
};
/* Server-/multi-device-safe ids: prefer UUIDs, fall back for old browsers */
function uuid(){ return (crypto&&crypto.randomUUID)?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10); }
const mkId = p => p+'_'+uuid();
const mkBlock = (t,c) => ({id:mkId('b'),type:t||'paragraph',content:c||''});

/* ═══════════════════════════════════════════════
   BINARY MEDIA STORE
   Heavy bytes (images, files) live as Blobs keyed by an `img_<hash>` ref; documents
   only ever hold the short ref. IndexedDB is the default store; when the user keeps
   their workspace in a folder (js/core/workspace.js) the same five calls write files
   into <folder>/media/ instead. `IDB` below is the facade the rest of the app uses.
═══════════════════════════════════════════════ */
const IdbMediaStore = {
  _db:null,
  open(){
    if(this._db) return Promise.resolve(this._db);
    return new Promise((res,rej)=>{
      const r=indexedDB.open('folio_media',1);
      r.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains('blobs'))db.createObjectStore('blobs')};
      r.onsuccess=e=>{this._db=e.target.result;res(this._db)};
      r.onerror=e=>rej(e.target.error);
    });
  },
  async put(id,blob){const db=await this.open();return new Promise((res,rej)=>{const tx=db.transaction('blobs','readwrite');tx.objectStore('blobs').put(blob,id);tx.oncomplete=()=>res(true);tx.onerror=()=>rej(tx.error)})},
  async get(id){const db=await this.open();return new Promise((res,rej)=>{const tx=db.transaction('blobs','readonly');const rq=tx.objectStore('blobs').get(id);rq.onsuccess=()=>res(rq.result||null);rq.onerror=()=>rej(rq.error)})},
  async del(id){const db=await this.open();return new Promise(res=>{const tx=db.transaction('blobs','readwrite');tx.objectStore('blobs').delete(id);tx.oncomplete=()=>res(true);tx.onerror=()=>res(false)})},
  async keys(){const db=await this.open();return new Promise(res=>{const tx=db.transaction('blobs','readonly');const rq=tx.objectStore('blobs').getAllKeys();rq.onsuccess=()=>res(rq.result||[]);rq.onerror=()=>res([])})},
  async all(){const db=await this.open();return new Promise(res=>{const tx=db.transaction('blobs','readonly');const s=tx.objectStore('blobs');const ks=s.getAllKeys(),vs=s.getAll();tx.oncomplete=()=>res((ks.result||[]).map((k,i)=>({id:k,blob:vs.result[i]})));tx.onerror=()=>res([])})},
};
let MediaStore = IdbMediaStore;
function setMediaStore(store){ MediaStore = store; }   // swapped by Workspace.boot() in folder mode
const IDB = {
  put:(id,blob)=>MediaStore.put(id,blob), get:id=>MediaStore.get(id), del:id=>MediaStore.del(id),
  keys:()=>MediaStore.keys(), all:()=>MediaStore.all(),
};
const imgCache=new Map();  // imageId → object URL (rebuilt each session)
function isBlobRef(v){return typeof v==='string'&&v.startsWith('img_')}
/* Resolve a stored value to a usable URL: blob refs → object URL, legacy data:/http kept as-is */
function srcFor(v){
  if(!v) return '';
  if(isBlobRef(v)) return imgCache.get(v)||'';
  if(typeof v==='string'&&(v.startsWith('data:')||v.startsWith('http')||v.startsWith('blob:'))) return v;
  return '';
}
/* Content-addressed id: hash the bytes so identical media collapses to ONE stored
   blob (and one ref) no matter how many times it's pasted/uploaded. Falls back to a
   random id if SubtleCrypto is unavailable (e.g. a non-secure context) — still correct,
   just no dedup. 160 bits is collision-safe for any personal workspace. */
async function blobId(blob){
  try{
    const buf=await blob.arrayBuffer();
    const h=await crypto.subtle.digest('SHA-256',buf);
    const hex=[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');
    return 'img_'+hex.slice(0,40);
  }catch(e){ return 'img_'+uuid(); }
}
/* ── Upload size cap ──────────────────────────────────────────────────────────
   Hard ceiling on any single uploaded file (images, attachments, fonts, covers).
   Images are still compressed afterward, but we reject oversized SOURCE files up
   front so we never pull a huge file into a canvas / IndexedDB. */
const MAX_UPLOAD_BYTES=25*1024*1024; // 25 MB
function fmtBytes(n){ n=n||0; if(n>=1048576) return (n/1048576).toFixed(n>=10485760?0:1)+' MB'; if(n>=1024) return Math.round(n/1024)+' KB'; return n+' B'; }
/* Returns true if the file is within the limit; otherwise toasts and returns false.
   `label` lets callers say what was rejected (e.g. "Image", "Font"). */
function withinUploadLimit(file,label){
  if(!file) return false;
  if(file.size>MAX_UPLOAD_BYTES){
    if(typeof toast==='function') toast(`${label||'File'} is ${fmtBytes(file.size)} — the limit is 25 MB.`);
    return false;
  }
  return true;
}
async function storeBlob(blob){
  ensurePersistence(); // first real media write is a good moment to ask the browser not to evict us
  const id=await blobId(blob);
  // Dedup: if this exact content is already stored this session, reuse it (skip the
  // IDB write and a redundant object URL). If it's in IDB from a prior session but not
  // yet cached, the put is a harmless identical-bytes overwrite.
  if(!imgCache.has(id)){
    await IDB.put(id,blob);
    imgCache.set(id,URL.createObjectURL(blob));
  }
  return id;
}
/* Ask the browser to make storage durable (won't be evicted under disk pressure).
   Idempotent + silent if already granted; only attempted once per session. */
let _persistAsked=false;
async function ensurePersistence(){
  if(_persistAsked||!(navigator.storage&&navigator.storage.persist)) return;
  _persistAsked=true;
  try{ if(!(await navigator.storage.persisted())) await navigator.storage.persist(); }catch(e){}
}
/* Release a blob ref. Because blobs are now content-addressed and DEDUPED, the same
   ref can be shared by several blocks/docs — so we must only reclaim it when NOTHING
   still references it (otherwise removing one image would nuke an identical one
   elsewhere). collectRefs() is the same workspace scan the GC uses; if it's not loaded
   yet (very early boot) we keep the blob and let the boot GC reclaim it later. */
function freeBlob(ref){
  if(!isBlobRef(ref)) return;
  try{ if(typeof collectRefs==='function' && collectRefs().has(ref)) return; }catch(e){ return; }
  IDB.del(ref); const u=imgCache.get(ref); if(u)URL.revokeObjectURL(u); imgCache.delete(ref);
}
async function preloadBlobs(){
  try{const all=await IDB.all();all.forEach(({id,blob})=>{if(blob&&!imgCache.has(id))imgCache.set(id,URL.createObjectURL(blob))})}catch(e){}
}
/* Preferred re-encode format. WebP is ~25-35% smaller than JPEG at equal quality AND
   keeps transparency (JPEG flattened alpha onto black — a real bug for PNG/screenshots).
   Detected once; falls back to JPEG on the rare browser without WebP encoding. */
let _imgEncodeType=null;
function imgEncodeType(){
  if(_imgEncodeType) return _imgEncodeType;
  try{
    const c=document.createElement('canvas'); c.width=c.height=1;
    _imgEncodeType = c.toDataURL('image/webp').indexOf('data:image/webp')===0 ? 'image/webp' : 'image/jpeg';
  }catch(e){ _imgEncodeType='image/jpeg'; }
  return _imgEncodeType;
}
function compressToBlob(file,maxW,maxH,quality){
  // GIFs are usually animated — re-encoding them through a canvas flattens them to a
  // single still frame, so store the original bytes untouched (every call site —
  // image blocks, carousel, covers, URL fetches — inherits GIF support this way).
  if(file&&file.type==='image/gif') return Promise.resolve(file);
  return new Promise(resolve=>{
    const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=()=>{URL.revokeObjectURL(url);let w=img.width,h=img.height;if(w>maxW||h>maxH){const r=Math.min(maxW/w,maxH/h);w=Math.round(w*r);h=Math.round(h*r)}
      const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
      c.toBlob(b=>resolve(b||file),imgEncodeType(),quality);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);resolve(file)};
    img.src=url;
  });
}
function dataURLtoBlob(dataURL){
  const [meta,b64]=dataURL.split(','); const mime=(meta.match(/:(.*?);/)||[])[1]||'application/octet-stream';
  const bin=atob(b64); const arr=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:mime});
}
function blobToDataURL(blob){return new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>res(null);r.readAsDataURL(blob)})}
/* Download a remote image to a Blob so it can be cached locally (IndexedDB).
   Tries a direct CORS fetch first, then a CORS proxy for hosts that don't allow it. */
async function fetchImageBlob(url){
  url=normUrl(url);
  try{ const r=await fetch(url,{mode:'cors'}); if(r.ok){const b=await r.blob(); if(b.size&&/^image\//.test(b.type)) return b;} }catch(e){}
  try{ const r=await fetch('https://api.allorigins.win/raw?url='+encodeURIComponent(url)); if(r.ok){const b=await r.blob(); if(b.size&&(/^image\//.test(b.type)||b.type==='')) return b;} }catch(e){}
  return null;
}
function blankDoc(){
  const now=new Date().toISOString();
  return{
    id:mkId('d'), title:'',
    blocks:[mkBlock('paragraph')],
    props:[], fmt:{},
    meta:{
      wordCount:0, blockCount:1, readingTime:0,
      version:1,  pinned:false, icon:'', tags:[],
    },
    createdAt:now, updatedAt:now,
  };
}
function blankTbl(){
  const c1=mkId('c'),c2=mkId('c'),c3=mkId('c');
  return{id:mkId('t'),name:'Untitled Table',titleCol:c1,
    columns:[{id:c1,name:'Name',type:'text'},{id:c2,name:'Status',type:'status',options:idbDefaultStatusOpts()},{id:c3,name:'Due Date',type:'date'}],
    rows:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}

