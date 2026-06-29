/* ═══════════════════════════════════════════════
   VERSION HISTORY  (Notion-style page snapshots)

   Each document keeps a rolling list of content snapshots in localStorage
   (folio_versions[docId] = [{ts,title,blocks,props,meta}, …], oldest→newest).
   Snapshots are captured automatically: a baseline when a page is opened, then
   periodically while editing (throttled), and always right before a restore so
   reverting is itself reversible.

   IMPORTANT — nested pages: a snapshot only stores THIS page's own content. A
   sub-page is a separate document (a `page` block holds a `pageId` pointer).
   Restoring an older version therefore only rewrites the parent's blocks; it
   never deletes child documents. If the restored version predates a sub-page,
   that page-link block simply disappears from the parent — the child document
   still exists and stays reachable from the Documents list (it's "orphaned",
   not deleted). This mirrors how Notion treats sub-pages.
═══════════════════════════════════════════════ */
const VERSION_KEY='folio_versions';
const MAX_VERSIONS=40;                 // per document
const VERSION_MIN_GAP_MS=3*60*1000;    // ≥3 min between automatic snapshots

function _allVersions(){ try{return JSON.parse(localStorage.getItem(VERSION_KEY)||'{}')}catch{return{}} }
function _saveAllVersions(o){ try{localStorage.setItem(VERSION_KEY,JSON.stringify(o));return true}catch(e){ if(typeof toast==='function')toast('Storage is full — version not saved.'); return false; } }
function getVersions(docId){ const a=_allVersions()[docId]; return Array.isArray(a)?a:[]; }
function saveVersions(docId,list){ const all=_allVersions(); all[docId]=list; _saveAllVersions(all); }
function deleteVersions(docId){ const all=_allVersions(); if(docId in all){ delete all[docId]; _saveAllVersions(all); } }

function _sameVersionContent(a,b){
  return a.title===b.title
    && JSON.stringify(a.blocks||[])===JSON.stringify(b.blocks||[])
    && JSON.stringify(a.props||[])===JSON.stringify(b.props||[]);
}
/* Push a snapshot of the document's CURRENT persisted content. De-duped against
   the latest snapshot; throttled to VERSION_MIN_GAP_MS unless opts.force. */
function snapshotVersion(doc,opts){
  opts=opts||{};
  if(!doc||!doc.id) return;
  if(typeof HOME_ID!=='undefined'&&doc.id===HOME_ID) return; // home isn't versioned
  const list=getVersions(doc.id);
  const snap={
    ts:new Date().toISOString(),
    title:doc.title||'',
    blocks:doc.blocks||[],
    props:doc.props||[],
    meta:{cover:(doc.meta&&doc.meta.cover)||null, icon:(doc.meta&&doc.meta.icon)||null},
    label:opts.label||null,
  };
  const last=list[list.length-1];
  if(last&&_sameVersionContent(last,snap)) return;                       // nothing changed
  if(!opts.force&&last&&(Date.now()-new Date(last.ts).getTime()<VERSION_MIN_GAP_MS)) return; // too soon
  list.push(snap);
  while(list.length>MAX_VERSIONS) list.shift();
  saveVersions(doc.id,list);
}

/* Page-link block pointers in a block tree (for orphan reporting on restore). */
function collectPageIds(blocks){
  const ids=new Set();
  (typeof flattenBlocks==='function'?flattenBlocks(blocks||[]):(blocks||[])).forEach(b=>{ if(b&&b.type==='page'&&b.pageId) ids.add(b.pageId); });
  return ids;
}

/* ── Restore ── snapshots current state first (so this revert can be undone),
   then rewrites only this document's content. Never deletes child documents. */
function restoreVersion(docId,ts){
  const editingThis=(S.docId===docId);
  if(editingThis){ clearTimeout(S.saveTimer); flushSave(); } // capture in-flight edits before snapshotting
  const doc=DB.getDoc(docId); if(!doc){ toast('That page no longer exists'); return; }
  const list=getVersions(docId);
  const v=list.find(x=>x.ts===ts); if(!v){ toast('Version not found'); return; }

  snapshotVersion(doc,{force:true,label:'before restore'}); // reversible

  const curPages=collectPageIds(doc.blocks);
  const verPages=collectPageIds(v.blocks);
  const orphans=[...curPages].filter(id=>!verPages.has(id)&&DB.getDoc(id)); // sub-pages this revert un-links (but keeps)

  doc.title=v.title||'';
  doc.blocks=JSON.parse(JSON.stringify(v.blocks||[]));
  doc.props=JSON.parse(JSON.stringify(v.props||[]));
  doc.meta=doc.meta||{};
  doc.meta.cover=v.meta?v.meta.cover:doc.meta.cover;
  doc.meta.icon=v.meta?v.meta.icon:doc.meta.icon;
  // keep the database row's title column in sync, if this doc is a DB entry
  if(doc.dbId&&doc.rowId){ const t=DB.getTbl(doc.dbId); const r=t&&t.rows.find(x=>x.id===doc.rowId); const tc=t&&idbTitleCol(t); if(r&&tc){ r.cells[tc.id]=doc.title; DB.saveTbl(t); } }
  DB.saveDoc(doc);

  closeVersionPreview(); closeVersionPanel();
  if(editingThis){ openEditor(docId); }       // reload editor from restored content
  else { renderSidebarLists(); }
  if(orphans.length) toast(`Version restored · ${orphans.length} sub-page${orphans.length>1?'s':''} created later kept in Documents`);
  else toast('Version restored');
}

/* ── Panel ── */
function openVersionPanel(){
  if(!S.docId||S.docId===HOME_ID){ toast('Open a page to see its history'); return; }
  if(S.peekOpen){ clearTimeout(S.saveTimer); flushSave(); } // make sure latest is captured/snapshot-eligible
  else { clearTimeout(S.saveTimer); flushSave(); }
  renderVersionList();
  document.getElementById('vh-panel').classList.add('open');
  document.getElementById('vh-ovl').classList.add('open');
}
function closeVersionPanel(){
  document.getElementById('vh-panel')?.classList.remove('open');
  document.getElementById('vh-ovl')?.classList.remove('open');
}
function fmtVersionTime(ts){
  const d=new Date(ts), now=new Date();
  const time=d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  const sameDay=d.toDateString()===now.toDateString();
  const yest=new Date(now); yest.setDate(now.getDate()-1);
  const isYest=d.toDateString()===yest.toDateString();
  if(sameDay) return 'Today · '+time;
  if(isYest)  return 'Yesterday · '+time;
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:d.getFullYear()!==now.getFullYear()?'numeric':undefined})+' · '+time;
}
function versionSnippet(snap){
  const leaves=typeof flattenBlocks==='function'?flattenBlocks(snap.blocks||[]):(snap.blocks||[]);
  const txt=leaves.filter(b=>b&&typeof b.content==='string'&&b.content)
    .map(b=>{const d=document.createElement('div');d.innerHTML=b.content;return d.innerText.trim();})
    .filter(Boolean).join(' · ');
  return txt.length>120?txt.slice(0,120)+'…':txt;
}
function renderVersionList(){
  const el=document.getElementById('vh-list'); if(!el) return;
  const list=getVersions(S.docId).slice().reverse(); // newest first
  if(!list.length){ el.innerHTML='<div class="vh-empty">No saved versions yet.<br>Versions are captured automatically as you edit.</div>'; return; }
  // Scrubbable timeline (oldest → newest, left → right) above the detailed list.
  const chrono=getVersions(S.docId);
  const timeline = chrono.length>1
    ? `<div class="vh-timeline"><div class="vh-tl-dots">${chrono.map((v,i)=>{
        const isLatest=i===chrono.length-1;
        const t=isLatest?'now':new Date(v.ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}).replace(' ','');
        return `<button class="vh-tl-dot${isLatest?' latest':''}" onclick="previewVersion('${S.docId}','${v.ts}')" title="${escHtml(fmtVersionTime(v.ts))}"><span class="vh-tl-pt"></span><span class="vh-tl-t">${escHtml(t)}</span></button>`;
      }).join('')}</div></div>`
    : '';
  const items=list.map((v,i)=>{
    const isCurrent=i===0;
    const snip=versionSnippet(v);
    const wc=(typeof flattenBlocks==='function'?flattenBlocks(v.blocks||[]):[]).length;
    return `<div class="vh-item" onclick="previewVersion('${S.docId}','${v.ts}')">
      <div class="vh-it-top"><span class="vh-it-time">${escHtml(fmtVersionTime(v.ts))}</span>${isCurrent?'<span class="vh-it-cur">Latest</span>':''}${v.label?`<span class="vh-it-lbl">${escHtml(v.label)}</span>`:''}</div>
      <div class="vh-it-snip">${escHtml(snip)||'<span class="vh-mu">No text content</span>'}</div>
      <div class="vh-it-meta">${wc} block${wc!==1?'s':''}${v.meta&&v.meta.icon?' · has icon':''}${v.meta&&v.meta.cover?' · has cover':''}</div>
    </div>`;
  }).join('');
  el.innerHTML=timeline+items;
}

/* ── Read-only preview of a snapshot (centered modal) ── */
function versionPreviewHtml(snap){
  const ICON={image:'🖼 Image',file:'📎 File',carousel:'🖼 Image gallery',youtube:'▶ Embed',grid:'▦ Table',database:'▦ Database'};
  const render=(blocks)=> (blocks||[]).map(b=>{
    if(!b) return '';
    const c=b.content||'';
    switch(b.type){
      case 'h1': return `<h1>${c}</h1>`;
      case 'h2': return `<h2>${c}</h2>`;
      case 'h3': return `<h3>${c}</h3>`;
      case 'quote': return `<blockquote>${c}</blockquote>`;
      case 'callout': return `<div class="vh-callout">${b.icon||'💡'} ${c}</div>`;
      case 'code': return `<pre>${escHtml((document.createElement('div').innerHTML=c,document.createElement('div')).textContent||c)}</pre>`;
      case 'bullet': return `<div class="vh-li">• ${c}</div>`;
      case 'numbered': return `<div class="vh-li vh-num">${c}</div>`;
      case 'alpha': return `<div class="vh-li vh-num">${c}</div>`;
      case 'todo': return `<div class="vh-li">${b.checked?'☑':'☐'} ${c}</div>`;
      case 'divider': return `<hr>`;
      case 'toggle': return `<div class="vh-toggle">▸ ${c}</div>`+(b.children?`<div class="vh-indent">${render(b.children)}</div>`:'');
      case 'columns': return `<div class="vh-cols">${(b.cols||[]).map(col=>`<div class="vh-col">${render(col)}</div>`).join('')}</div>`;
      case 'page': { const d=b.pageId?DB.getDoc(b.pageId):null; return `<div class="vh-page">📄 ${escHtml(d?d.title||'Untitled':'Sub-page')}</div>`; }
      default:
        if(ICON[b.type]) return `<div class="vh-placeholder">${ICON[b.type]}</div>`;
        return c?`<p>${c}</p>`:'';
    }
  }).join('');
  const cover=snap.meta&&snap.meta.cover?`<div class="vh-pv-cover"><img src="${srcFor(snap.meta.cover)}" alt=""></div>`:'';
  const icon=snap.meta&&snap.meta.icon?`<div class="vh-pv-icon">${typeof iconHtml==='function'?iconHtml(snap.meta.icon,'40px'):''}</div>`:'';
  return `${cover}<div class="vh-pv-inner">${icon}<h1 class="vh-pv-title">${escHtml(snap.title||'Untitled')}</h1>${render(snap.blocks)}</div>`;
}
function previewVersion(docId,ts){
  const v=getVersions(docId).find(x=>x.ts===ts); if(!v) return;
  let m=document.getElementById('vh-preview');
  if(!m){ m=document.createElement('div'); m.id='vh-preview'; m.className='vh-preview';
    m.addEventListener('click',e=>{ if(e.target===m) closeVersionPreview(); });
    document.body.appendChild(m);
  }
  m.innerHTML=`<div class="vh-pv-card">
      <div class="vh-pv-bar">
        <div><div class="vh-pv-when">${escHtml(fmtVersionTime(v.ts))}</div><div class="vh-pv-sub">Read-only preview</div></div>
        <div class="vh-pv-acts">
          <button class="vh-btn" onclick="closeVersionPreview()">Close</button>
          <button class="vh-btn" onclick="versionOpenAsCopy('${docId}','${v.ts}')">Open as copy</button>
          <button class="vh-btn primary" onclick="restoreVersion('${docId}','${v.ts}')">Restore this version</button>
        </div>
      </div>
      <div class="vh-pv-body">${versionPreviewHtml(v)}</div>
    </div>`;
  requestAnimationFrame(()=>m.classList.add('open'));
}
function closeVersionPreview(){ const m=document.getElementById('vh-preview'); if(m){ m.classList.remove('open'); setTimeout(()=>{ if(!m.classList.contains('open'))m.innerHTML=''; },180); } }
/* Spin a snapshot off into a brand-new page instead of overwriting the current one. */
function versionOpenAsCopy(docId,ts){
  const v=getVersions(docId).find(x=>x.ts===ts); if(!v) return;
  const d=blankDoc(); d.title=(v.title||'Untitled')+' (copy)';
  d.blocks=JSON.parse(JSON.stringify(v.blocks&&v.blocks.length?v.blocks:[mkBlock('paragraph')]));
  if(v.meta){ d.meta=d.meta||{}; if(v.meta.icon) d.meta.icon=v.meta.icon; if(v.meta.cover) d.meta.cover=v.meta.cover; }
  DB.saveDoc(d);
  closeVersionPreview(); closeVersionPanel();
  nav('editor',d.id);
  if(typeof toast==='function') toast('Opened as a copy',{type:'success'});
}
