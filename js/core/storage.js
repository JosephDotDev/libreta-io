/* ═══════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════ */
/* ── PERSISTENCE ADAPTER ──────────────────────────────────────────────────
   The ONE place that knows WHERE documents + tables are stored. Today that's
   localStorage (synchronous). To add a backend (accounts, sync) later you only
   implement these four methods against your API and swap the adapter via
   setPersistenceAdapter() — nothing else in the app changes, because everything
   reads/writes through the synchronous in-memory DB below, never storage directly.

   load* may be async (a network adapter fetches here); persist* may be async
   too (fire-and-forget / queued). The app stays synchronous because reads are
   served from the in-memory cache that load*() hydrates at boot.
─────────────────────────────────────────────────────────────────────────── */
const LocalStorageAdapter = {
  name:'localStorage',
  loadDocs(){ try{return JSON.parse(localStorage.getItem('folio_docs')||'[]')}catch{return[]} },
  loadTbls(){ try{return JSON.parse(localStorage.getItem('folio_tables')||'[]')}catch{return[]} },
  persistDocs(docs){ localStorage.setItem('folio_docs',JSON.stringify(docs)); },   // throws on quota → surfaced as a toast
  persistTbls(tbls){ localStorage.setItem('folio_tables',JSON.stringify(tbls)); },
};
let Persist = LocalStorageAdapter;
function setPersistenceAdapter(adapter){ Persist = adapter; }  // swap-in point for a future backend

/* ── DB ── in-memory source of truth + a thin persistence flush.
   Public API is unchanged and synchronous: getDocs/getDoc/saveDoc/delDoc and
   the table equivalents. Reads hit the cache (no re-parsing); writes update the
   cache and hand off to the adapter. `await DB.load()` hydrates at boot. */
const DB = {
  DK:'folio_docs', TK:'folio_tables',   // kept for any legacy references
  _docs:null, _tbls:null, _ready:false,

  async load(){
    this._docs = await Promise.resolve(Persist.loadDocs());
    this._tbls = await Promise.resolve(Persist.loadTbls());
    this._ready = true;
    return true;
  },
  // Safety net: if anything reads before load() ran, hydrate synchronously once.
  _ensure(){ if(this._ready) return; try{ this._docs=Persist.loadDocs(); this._tbls=Persist.loadTbls(); }catch{ this._docs=this._docs||[]; this._tbls=this._tbls||[]; } this._ready=true; },
  _flushDocs(){ try{ Promise.resolve(Persist.persistDocs(this._docs)); if(typeof searchInvalidate==='function')searchInvalidate(); return true; }
    catch(e){ if(typeof toast==='function')toast('Storage is full — change not saved. Try smaller images.'); return false; } },
  _flushTbls(){ try{ Promise.resolve(Persist.persistTbls(this._tbls)); return true; }
    catch(e){ if(typeof toast==='function')toast('Storage is full — change not saved.'); return false; } },

  getDocs(){ this._ensure(); return this._docs; },
  getDoc(id){ this._ensure(); return this._docs.find(d=>d.id===id)||null; },
  saveDoc(doc){ this._ensure(); doc.updatedAt=new Date().toISOString();
    const i=this._docs.findIndex(d=>d.id===doc.id); if(i>=0)this._docs[i]=doc; else this._docs.unshift(doc);
    return this._flushDocs(); },
  delDoc(id){ this._ensure(); const d=this.getDoc(id);
    if(d&&d.dbId){const t=this.getTbl(d.dbId);if(t){t.rows=t.rows.filter(r=>r.docId!==id);this.saveTbl(t);}}
    this._docs=this._docs.filter(x=>x.id!==id); this._flushDocs();
    if(typeof deleteVersions==='function')deleteVersions(id); },
  getTbls(){ this._ensure(); return this._tbls; },
  getTbl(id){ this._ensure(); return this._tbls.find(t=>t.id===id)||null; },
  saveTbl(t){ this._ensure(); t.updatedAt=new Date().toISOString();
    const i=this._tbls.findIndex(x=>x.id===t.id); if(i>=0)this._tbls[i]=t; else this._tbls.unshift(t);
    return this._flushTbls(); },
  delTbl(id){ this._ensure(); this._tbls=this._tbls.filter(t=>t.id!==id); this._flushTbls(); },

  /* Bulk replace (used by Import) — refresh the cache + persist in one shot. */
  replaceAll(docs,tables){ this._ensure(); if(docs)this._docs=docs; if(tables)this._tbls=tables; this._flushDocs(); this._flushTbls(); },
};
/* Server-/multi-device-safe ids: prefer UUIDs, fall back for old browsers */
function uuid(){ return (crypto&&crypto.randomUUID)?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10); }
const mkId = p => p+'_'+uuid();
const mkBlock = (t,c) => ({id:mkId('b'),type:t||'paragraph',content:c||''});

/* ═══════════════════════════════════════════════
   BINARY MEDIA STORE (IndexedDB)
   Heavy bytes (images, files) live here as Blobs keyed by an `img_<uuid>` ref.
   localStorage only ever holds the short ref. This sidesteps the ~5MB cap and
   keeps the data model server-friendly (ref now → object-storage URL later).
═══════════════════════════════════════════════ */
const IDB = {
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
const imgCache=new Map();  // imageId → object URL (rebuilt each session)
function isBlobRef(v){return typeof v==='string'&&v.startsWith('img_')}
/* Resolve a stored value to a usable URL: blob refs → object URL, legacy data:/http kept as-is */
function srcFor(v){
  if(!v) return '';
  if(isBlobRef(v)) return imgCache.get(v)||'';
  if(typeof v==='string'&&(v.startsWith('data:')||v.startsWith('http')||v.startsWith('blob:'))) return v;
  return '';
}
async function storeBlob(blob){
  ensurePersistence(); // first real media write is a good moment to ask the browser not to evict us
  const id='img_'+uuid();
  await IDB.put(id,blob);
  imgCache.set(id,URL.createObjectURL(blob));
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
function freeBlob(ref){ if(isBlobRef(ref)){IDB.del(ref);const u=imgCache.get(ref);if(u)URL.revokeObjectURL(u);imgCache.delete(ref);} }
async function preloadBlobs(){
  try{const all=await IDB.all();all.forEach(({id,blob})=>{if(blob&&!imgCache.has(id))imgCache.set(id,URL.createObjectURL(blob))})}catch(e){}
}
function compressToBlob(file,maxW,maxH,quality){
  return new Promise(resolve=>{
    const img=new Image(); const url=URL.createObjectURL(file);
    img.onload=()=>{URL.revokeObjectURL(url);let w=img.width,h=img.height;if(w>maxW||h>maxH){const r=Math.min(maxW/w,maxH/h);w=Math.round(w*r);h=Math.round(h*r)}
      const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);
      c.toBlob(b=>resolve(b||file),'image/jpeg',quality);
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

