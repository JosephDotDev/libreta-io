/* ═══════════════════════════════════════════════
   HOME PAGE — configurable sections + favorites + free-form notes
═══════════════════════════════════════════════ */
const HOME_ID='__home__';
const HOME_TITLES={recent:'Recent Pages',favorites:'Favorites',notes:'Notes'};
function getHomeCfg(){
  let c=null; try{c=JSON.parse(localStorage.getItem('folio_home_cfg'))}catch{}
  c=c||{};
  const order=Array.isArray(c.order)?c.order:['recent','favorites','notes'];
  const collapsed=c.collapsed||{}, hidden=c.hidden||{};
  // Layout = rows of section keys (a row with >1 key = side-by-side). Derived from
  // the saved rows, kept in sync with hidden/order.
  let rows=Array.isArray(c.rows)?c.rows.map(r=>Array.isArray(r)?r.filter(k=>order.includes(k)&&!hidden[k]):[]).filter(r=>r.length):null;
  const seen=new Set();
  rows=(rows||[]).map(r=>r.filter(k=>{if(seen.has(k))return false;seen.add(k);return true;})).filter(r=>r.length);
  order.filter(k=>!hidden[k]&&!seen.has(k)).forEach(k=>rows.push([k])); // append any new/unplaced sections
  if(!rows.length) rows=order.filter(k=>!hidden[k]).map(k=>[k]);
  return {order,collapsed,hidden,rows};
}
function saveHomeCfg(c){ localStorage.setItem('folio_home_cfg',JSON.stringify(c)); }
function getHomeDoc(){
  let d=null; try{d=JSON.parse(localStorage.getItem('folio_home_doc'))}catch{}
  if(!d||!Array.isArray(d.blocks)) d={id:HOME_ID,title:'Your workspace.',blocks:[mkBlock('paragraph')]};
  d.id=HOME_ID; d.props=[]; d.meta=d.meta||{}; d.fmt=d.fmt||{};
  if(d.titleHidden===undefined) d.titleHidden=false;
  return d;
}
function saveHomeDoc(docOrBlocks){
  let d;
  if(Array.isArray(docOrBlocks)){ d=getHomeDoc(); d.blocks=docOrBlocks; }
  else { d=docOrBlocks; d.id=HOME_ID; d.props=[]; }
  localStorage.setItem('folio_home_doc',JSON.stringify(d));
}
/* The "active document" is the editor doc, or the special home doc when on Home —
   lets the cover/icon/reposition handlers serve both without duplication. */
function getActiveDoc(){ return S.docId===HOME_ID?getHomeDoc():DB.getDoc(S.docId); }
function saveActiveDoc(doc){ if(S.docId===HOME_ID){ saveHomeDoc(doc); return true; } return DB.saveDoc(doc); }
function isFav(d){ return !!(d&&d.meta&&d.meta.favorite); }
function toggleFavorite(docId){
  const doc=DB.getDoc(docId); if(!doc) return;
  doc.meta=doc.meta||{}; doc.meta.favorite=!doc.meta.favorite; DB.saveDoc(doc);
  if(S.view==='home') renderHome(); else refreshActiveLists();
  if(S.view==='editor'&&S.docId===docId) renderFavBtn(doc);
  renderSidebarLists();
}
function renderFavBtn(doc){ const b=document.getElementById('tp-fav-btn'); if(b){const on=isFav(doc); b.innerHTML=on?'★':'☆'; b.classList.toggle('on',on); b.title=on?'Favorited — click to remove':'Favorite'; b.dataset.tip=b.title;} }

/* ── home section management ── */
function homeToggleCollapse(key){ const c=getHomeCfg(); c.collapsed[key]=!c.collapsed[key]; saveHomeCfg(c); renderHome(); }
function homeHideSection(key){ const c=getHomeCfg(); c.hidden[key]=true; saveHomeCfg(c); renderHome(); }
function homeShowSection(key){ const c=getHomeCfg(); c.hidden[key]=false; saveHomeCfg(c); renderHome(); }
function homeMoveSection(key,dir){ const c=getHomeCfg(); const i=c.order.indexOf(key),j=i+dir; if(i<0||j<0||j>=c.order.length)return; const t=c.order[i];c.order[i]=c.order[j];c.order[j]=t; saveHomeCfg(c); renderHome(); }
/* Drag home sections like blocks — vertical reorder + side-by-side stacking. */
let _homeDrag=null;
function homeDragStart(e,key){ _homeDrag=key; try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','s');}catch(_){}; e.stopPropagation(); document.body.classList.add('home-dragging'); }
function homeDragEnd(){ _homeDrag=null; document.body.classList.remove('home-dragging'); document.querySelectorAll('.home-drop').forEach(s=>{s.classList.remove('home-drop');delete s.dataset.dropzone;}); }
function homeDragOver(e,key){
  if(!_homeDrag||_homeDrag===key) return;
  e.preventDefault(); e.stopPropagation();
  const sec=e.currentTarget, r=sec.getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width, y=(e.clientY-r.top)/r.height;
  let zone; if(x<0.26)zone='left'; else if(x>0.74)zone='right'; else if(y<0.5)zone='top'; else zone='bottom';
  document.querySelectorAll('.home-drop').forEach(s=>{if(s!==sec){s.classList.remove('home-drop');delete s.dataset.dropzone;}});
  sec.dataset.dropzone=zone; sec.classList.add('home-drop');
}
function homeDragLeave(e){ const s=e.currentTarget; if(!s.contains(e.relatedTarget)){s.classList.remove('home-drop');delete s.dataset.dropzone;} }
function homeDrop(e,key){
  if(!_homeDrag||_homeDrag===key){ homeDragEnd(); return; }
  e.preventDefault(); e.stopPropagation();
  const zone=e.currentTarget.dataset.dropzone||'bottom';
  const src=_homeDrag; homeDragEnd();
  homeMoveTo(src,key,zone);
}
function homeMoveTo(src,target,zone){
  const c=getHomeCfg();
  let rows=c.rows.map(r=>[...r]);
  rows=rows.map(r=>r.filter(k=>k!==src)).filter(r=>r.length); // pull src out
  let tr=-1,tc=-1; rows.forEach((r,ri)=>{const ci=r.indexOf(target);if(ci>=0){tr=ri;tc=ci;}});
  if(tr<0){ rows.push([src]); }
  else if(zone==='left'||zone==='right'){
    if(rows[tr].length>=3){ rows.splice(zone==='left'?tr:tr+1,0,[src]); } // cap 3 per row → new row instead
    else rows[tr].splice(zone==='left'?tc:tc+1,0,src);
  } else { rows.splice(zone==='top'?tr:tr+1,0,[src]); }
  c.rows=rows; saveHomeCfg(c); renderHome();
}

/* ── home content builders ── */
function homeCardHtml(d){
  const pos=d.meta?.coverPos!=null?d.meta.coverPos:50;
  const cover=d.meta?.cover
    ? `<div class="home-card-cover" style="${coverThumbBg(d.meta.cover,pos)}"></div>`
    : `<div class="home-card-cover home-card-nocover">${d.meta?.icon?iconHtml(d.meta.icon,'30px'):'<span style="opacity:.5;font-size:26px">📄</span>'}</div>`;
  const icoInline=(d.meta?.icon&&d.meta?.cover)?iconHtml(d.meta.icon,'15px')+' ':'';
  const chips=listTagsOn()?quickChips(d,false):'';
  return `<div class="home-card" onclick="nav('editor','${d.id}')">
    ${cover}
    <button class="home-card-star${isFav(d)?' on':''}" onclick="event.stopPropagation();toggleFavorite('${d.id}')" title="${isFav(d)?'Remove favorite':'Add favorite'}">${isFav(d)?'★':'☆'}</button>
    <div class="home-card-body">
      <div class="home-card-title">${icoInline}${d.title||'Untitled'}</div>
      <div class="home-card-date">${fmtDate(d.updatedAt)}</div>
      ${chips?`<div class="home-card-chips">${chips}</div>`:''}
    </div>
  </div>`;
}
function homeRecentBody(){
  const recent=[...DB.getDocs()].sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,10);
  if(!recent.length) return `<div class="home-empty">No pages yet — create one to get started.</div>`;
  return `<div class="home-carousel">${recent.map(homeCardHtml).join('')}</div>`;
}
function homeFavoritesBody(){
  const favs=[...DB.getDocs()].filter(isFav).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
  if(!favs.length) return `<div class="home-empty">No favorites yet — tap the ☆ on any page to pin it here.</div>`;
  return `<div class="home-carousel">${favs.map(homeCardHtml).join('')}</div>`;
}
function homeSectionBody(key){
  if(key==='recent') return homeRecentBody();
  if(key==='favorites') return homeFavoritesBody();
  if(key==='notes') return `<div class="blocks-ct home-notes-ct" id="home-blocks-ct" onclick="onBlocksAreaClick(event)"></div>`;
  return '';
}
function homeSectionHtml(key,cfg){
  const collapsed=!!cfg.collapsed[key];
  const hdr=`<div class="home-sec-hdr">
    <span class="home-sec-grip" draggable="true" ondragstart="homeDragStart(event,'${key}')" ondragend="homeDragEnd()" title="Drag to move / stack">⠿</span>
    <div class="home-sec-head-l" onclick="homeToggleCollapse('${key}')">
      <span class="home-sec-chev${collapsed?' collapsed':''}">&#9662;</span>
      <span class="home-sec-title">${HOME_TITLES[key]||key}</span>
    </div>
    <div class="home-sec-ctrls">
      <button onclick="event.stopPropagation();homeHideSection('${key}')" title="Hide section"><svg viewBox="0 0 16 16"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="2"/></svg></button>
    </div>
  </div>`;
  return `<section class="home-sec" data-key="${key}" ondragover="homeDragOver(event,'${key}')" ondragleave="homeDragLeave(event)" ondrop="homeDrop(event,'${key}')">${hdr}${collapsed?'':`<div class="home-sec-body">${homeSectionBody(key)}</div>`}</section>`;
}
/* ── home title + width (document-like header) ── */
function onHomeTitleInput(){ sched(); }
function toggleHomeTitle(){
  const hd=getHomeDoc();
  const ti=document.getElementById('home-title-input'); if(ti&&!hd.titleHidden) hd.title=ti.value; // keep text when hiding
  hd.titleHidden=!hd.titleHidden;
  saveHomeDoc(hd); renderHome();
}
function setHomeWidth(w){ const hd=getHomeDoc(); hd.fmt=hd.fmt||{}; hd.fmt.width=w; saveHomeDoc(hd); applyHomeWidth(w); syncHomeWidthBtns(w); }
function applyHomeWidth(w){ const c=document.getElementById('home-c'); if(c) c.classList.toggle('w-full', w==='full'); }
function syncHomeWidthBtns(w){ document.getElementById('home-w-focused')?.classList.toggle('on',w!=='full'); document.getElementById('home-w-full')?.classList.toggle('on',w==='full'); }
function renderHome(){
  // persist any pending notes edit before we rebuild the DOM
  if(S.docId===HOME_ID){ clearTimeout(S.saveTimer); flushSave(); }
  const h=new Date().getHours();
  document.getElementById('greeting').textContent=h<12?'good morning':h<17?'good afternoon':h<21?'good evening':'working late?';
  const cfg=getHomeCfg();
  // load home doc into the editing context (block engine + cover/icon/flushSave target it)
  const hd=getHomeDoc(); S.docId=HOME_ID; S.blocks=hd.blocks&&hd.blocks.length?hd.blocks:[mkBlock('paragraph')]; S.props=[];
  // header: cover, icon, title, width
  renderCover(hd); renderEditorIcon(hd);
  const ti=document.getElementById('home-title-input');
  const titleToggle=document.getElementById('home-title-toggle');
  if(ti){
    if(hd.titleHidden){ ti.style.display='none'; document.getElementById('greeting').style.display='none'; if(titleToggle)titleToggle.innerHTML='&#43; Add title'; }
    else { ti.style.display=''; document.getElementById('greeting').style.display=''; ti.value=hd.title||''; if(titleToggle)titleToggle.innerHTML='&#128465; Remove title'; }
  }
  const w=hd.fmt?.width||'focused'; applyHomeWidth(w); syncHomeWidthBtns(w);
  if(typeof applyDocFmt==='function') applyDocFmt(hd);   // apply the home's per-page typeface
  const cont=document.getElementById('home-sections'); if(!cont) return;
  cont.innerHTML=cfg.rows.map(row=>`<div class="home-row${row.length>1?' multi':''}">${row.map(k=>homeSectionHtml(k,cfg)).join('')}</div>`).join('');
  // hidden-sections restore bar
  const hidden=cfg.order.filter(k=>cfg.hidden[k]);
  document.getElementById('home-hidden-bar').innerHTML=hidden.length
    ? `<div class="home-hidden"><span class="home-hidden-lbl">Hidden:</span> ${hidden.map(k=>`<button class="home-hidden-chip" onclick="homeShowSection('${k}')">+ ${HOME_TITLES[k]||k}</button>`).join(' ')}</div>` : '';
  // render the free-form notes blocks if that section is visible & expanded
  if(cfg.order.includes('notes') && !cfg.hidden['notes'] && !cfg.collapsed['notes'] && document.getElementById('home-blocks-ct')){
    renderBlocks('home-blocks-ct'); initHistory();
  }
}
function setDocView(v){S.docView=v;localStorage.setItem('folio_doc_view',v);renderDocList()}
function setDocSort(v){const[col,dir]=v.split('-');S.docSort={col,dir};localStorage.setItem('folio_doc_sort',v);renderDocList()}
/* ── Documents page: collapsible nested hierarchy (mirrors the sidebar tree) ── */
function docTreeState(){ try{return JSON.parse(localStorage.getItem('folio_doc_tree')||'{}')}catch{return{}} }
function toggleDocTreeNode(e,id){ e&&e.stopPropagation&&e.stopPropagation(); const c=docTreeState(); c[id]=!c[id]; localStorage.setItem('folio_doc_tree',JSON.stringify(c)); renderDocList(); }
function _docTreeRow(d,depth,kidCount,collapsed){
  const ico=d.meta?.icon?iconHtml(d.meta.icon,'18px'):'<span style="opacity:.5">📄</span>';
  const chips=listTagsOn()?quickChips(d,true):'';
  const chev=kidCount
    ? `<span class="doc-tree-chev${collapsed?' collapsed':''}" onclick="event.stopPropagation();toggleDocTreeNode(event,'${d.id}')">&#9662;</span>`
    : `<span class="doc-tree-spacer"></span>`;
  return `<div class="doc-row doc-tree-row" style="padding-left:${12+depth*22}px" onclick="nav('editor','${d.id}')">
    ${chev}
    <span class="doc-row-ico">${ico}</span>
    <div class="doc-row-main">
      <span class="doc-row-title">${d.title||'<em style="opacity:.4;font-weight:300">Untitled</em>'}</span>
      ${chips?`<span class="doc-row-chips">${chips}</span>`:''}
    </div>
    ${kidCount?`<span class="doc-tree-count" title="${kidCount} sub-page${kidCount>1?'s':''}">${kidCount}</span>`:''}
    <span class="doc-row-date">${fmtDate(d.updatedAt)}</span>
    <button class="doc-row-star${isFav(d)?' on':''}" onclick="event.stopPropagation();toggleFavorite('${d.id}')" title="${isFav(d)?'Remove favorite':'Add favorite'}">${isFav(d)?'★':'☆'}</button>
    <button class="doc-tree-add" onclick="event.stopPropagation();addChildPage(event,'${d.id}')" title="Add page inside">+</button>
    <button class="doc-tree-menu" onclick="event.stopPropagation();openTreeMenu(event,'${d.id}')" title="More — duplicate, move, delete">&#8943;</button>
  </div>`;
}
function renderDocTree(g, all){
  // Visible = pages matching the active filter, plus every ancestor needed to
  // reach them, so the hierarchy stays connected to the root.
  const matched=new Set(all.filter(d=>docMatchesFilters(d,FILT.documents)).map(d=>d.id));
  const visible=new Set();
  matched.forEach(id=>{ let cur=DB.getDoc(id); const seen=new Set();
    while(cur&&!seen.has(cur.id)){ visible.add(cur.id); seen.add(cur.id); cur=(cur.meta&&cur.meta.parent)?DB.getDoc(cur.meta.parent):null; } });
  const byParent={};
  all.forEach(d=>{ if(!visible.has(d.id)) return;
    const p=(d.meta&&d.meta.parent&&visible.has(d.meta.parent))?d.meta.parent:'root';
    (byParent[p]=byParent[p]||[]).push(d); });
  const coll=docTreeState();
  const walk=(key,depth)=>sortDocsList(byParent[key]||[]).map(d=>{
    const kids=byParent[d.id]||[];
    const collapsed=!!coll[d.id];
    let h=_docTreeRow(d,depth,kids.length,collapsed);
    if(kids.length&&!collapsed) h+=walk(d.id,depth+1);
    return h;
  }).join('');
  g.className='dl-rows doc-tree';
  g.innerHTML=walk('root',0)||'<div class="dl-tree-empty">No documents match the current filter.</div>';
}
function sortDocsList(docs){
  const s=S.docSort||{col:'updatedAt',dir:'desc'};
  return [...docs].sort((a,b)=>{
    let va,vb;
    if(s.col==='title'){va=(a.title||'').toLowerCase();vb=(b.title||'').toLowerCase()}
    else if(s.col==='wordCount'){va=a.meta?.wordCount||0;vb=b.meta?.wordCount||0}
    else if(s.col==='createdAt'){va=a.createdAt||'';vb=b.createdAt||''}
    else{va=a.updatedAt||'';vb=b.updatedAt||''}
    const cmp=typeof va==='number'?va-vb:String(va).localeCompare(String(vb));
    return s.dir==='asc'?cmp:-cmp;
  });
}
function docRowHtml(d){
  const wc=d.meta?.wordCount||0;
  const ico=d.meta?.icon?iconHtml(d.meta.icon,'18px'):'<span style="opacity:.5">📄</span>';
  const chips=listTagsOn()?quickChips(d,true):'';
  return `<div class="doc-row" onclick="nav('editor','${d.id}')">
    <span class="doc-row-ico">${ico}</span>
    <div class="doc-row-main">
      <span class="doc-row-title">${d.title||'<em style="opacity:.4;font-weight:300">Untitled</em>'}</span>
      ${chips?`<span class="doc-row-chips">${chips}</span>`:''}
    </div>
    <span class="doc-row-meta">${wc>0?wc.toLocaleString()+' words':''}</span>
    <span class="doc-row-date">${fmtDate(d.updatedAt)}</span>
    <button class="doc-row-star${isFav(d)?' on':''}" onclick="event.stopPropagation();toggleFavorite('${d.id}')" title="${isFav(d)?'Remove favorite':'Add favorite'}">${isFav(d)?'★':'☆'}</button>
    <button class="dc-del" onclick="event.stopPropagation();showConfirm('Move this document to Trash?',()=>{trashDoc('${d.id}');renderDocList()},'Delete','Move to Trash')" title="Delete">&#10005;</button>
  </div>`;
}
function renderDocList(){
  renderSidebarLists();
  const all=DB.getDocs(); const g=document.getElementById('doc-grid');
  renderFilterUI('documents','doc-filter-btn','doc-filter-chips');
  // sync controls
  const sortSel=document.getElementById('doc-sort'); if(sortSel&&S.docSort) sortSel.value=`${S.docSort.col}-${S.docSort.dir}`;
  document.getElementById('docv-cards')?.classList.toggle('on',(S.docView||'cards')==='cards');
  document.getElementById('docv-rows')?.classList.toggle('on',S.docView==='rows');
  document.getElementById('docv-tree')?.classList.toggle('on',S.docView==='tree');
  if(!all.length){
    g.className='dl-grid';
    g.innerHTML=`<div class="empty"><svg viewBox="0 0 56 56"><path d="M34 4H14a2 2 0 00-2 2v44a2 2 0 002 2h28a2 2 0 002-2V20L34 4z"/><path d="M34 4v16h16"/><line x1="18" y1="30" x2="38" y2="30"/><line x1="18" y1="38" x2="30" y2="38"/></svg><h3>No documents</h3><p>Create your first document to get started.</p><button class="btn btn-a" onclick="newDoc()">+ New Document</button></div>`;
    return;
  }
  let docs=sortDocsList(all.filter(d=>docMatchesFilters(d,FILT.documents)));
  if(!docs.length){
    g.className='dl-grid';
    g.innerHTML=`<div class="empty"><svg viewBox="0 0 56 56"><circle cx="25" cy="25" r="16"/><line x1="37" y1="37" x2="50" y2="50"/></svg><h3>No matches</h3><p>No documents match the current filter.</p><button class="btn btn-o" onclick="S.filterScope='documents';clearFilters()">Clear filter</button></div>`;
    return;
  }
  if(S.docView==='tree'){ renderDocTree(g, all.filter(d=>d.id!==HOME_ID)); return; }
  if(S.docView==='rows'){
    g.className='dl-rows';
    g.innerHTML=docs.map(docRowHtml).join('');
    return;
  }
  g.className='dl-grid';
  g.innerHTML=docs.map(d=>{
    const exc=(d.blocks||[])
      .filter(b=>!['divider','database','image','file','carousel'].includes(b.type))
      .map(b=>b.content.replace(/<[^>]+>/g,'')).join(' ').slice(0,120)||'';
    const wc=d.meta?.wordCount||0;
    const rt=d.meta?.readingTime||0;
    const bc=d.meta?.blockCount||0;
    const cover=d.meta?.cover
      ? (isAccentCover(d.meta.cover)
          ? `<div class="dc-cover-thumb dc-cover-accent" style="background:var(--ac)"></div>`
          : `<img class="dc-cover-thumb" src="${srcFor(d.meta.cover)}" alt="" style="object-position:center ${d.meta.coverPos!=null?d.meta.coverPos:50}%">`)
      : '';
    const ico=d.meta?.icon?iconHtml(d.meta.icon,'20px'):'';
    const icoGap=ico?`<span style="margin-right:5px;display:inline-flex;align-items:center">${ico}</span>`:'';
    const chips=listTagsOn()?quickChips(d,true):'';
    const meta=wc>0
      ?`<span class="dc-wc">${wc.toLocaleString()} words &middot; ${rt}m read &middot; ${bc} block${bc!==1?'s':''}</span>`
      :`<span class="dc-wc">Empty</span>`;
    return`<div class="dc" onclick="nav('editor','${d.id}')" onmouseleave="this.style.transform=''">
      ${cover}
      <button class="dc-star${isFav(d)?' on':''}" onclick="event.stopPropagation();toggleFavorite('${d.id}')" title="${isFav(d)?'Remove favorite':'Add favorite'}">${isFav(d)?'★':'☆'}</button>
      <div class="dc-t">${icoGap}${d.title||'Untitled'}</div>
      <div class="dc-e">${exc||'<em style="opacity:.4">No content</em>'}</div>
      ${chips?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">${chips}</div>`:''}
      <div class="dc-meta-row">
        <span>${fmtDate(d.updatedAt)}</span>
        ${meta}
        <button class="dc-del" onclick="event.stopPropagation();showConfirm('Move this document to Trash?',()=>{trashDoc('${d.id}');renderDocList()},'Delete','Move to Trash')" title="Delete">&#10005;</button>
      </div>
    </div>`;
  }).join('');
}

