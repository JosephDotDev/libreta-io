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
  const flex=c.flex||{};   // per-section flex-grow weights for side-by-side resizing
  return {order,collapsed,hidden,rows,flex};
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
/* A stable section-hue per page (pages have no intrinsic section, so derive a
   consistent colour from the id) — gives each card a bit of identity up top. */
const HOME_CARD_HUES=['var(--ac)','var(--c-docs)','var(--gr)','var(--go)','var(--pu)'];
function cardHue(id){ let h=0; const s=String(id||''); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return HOME_CARD_HUES[h%HOME_CARD_HUES.length]; }
function homeCardHtml(d){
  const pos=d.meta?.coverPos!=null?d.meta.coverPos:50;
  const cover=d.meta?.cover
    ? `<div class="home-card-cover" style="${coverThumbBg(d.meta.cover,pos)}"></div>`
    : `<div class="home-card-cover home-card-nocover">${d.meta?.icon?iconHtml(d.meta.icon,'30px'):'<svg class="lic" viewBox="0 0 24 24"><path d="M5 3h9l5 5v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/></svg>'}</div>`;
  const icoInline=(d.meta?.icon&&d.meta?.cover)?`<span class="card-ico">${iconHtml(d.meta.icon,'1.1em')}</span>`:'';
  const chips=listTagsOn()?quickChips(d,false):'';
  return `<div class="home-card" onclick="nav('editor','${d.id}')">
    <div class="home-card-strip" style="background:${cardHue(d.id)}"></div>
    ${cover}
    <button class="home-card-star${isFav(d)?' on':''}" onclick="event.stopPropagation();toggleFavorite('${d.id}')" title="${isFav(d)?'Remove favorite':'Add favorite'}">${isFav(d)?'★':'☆'}</button>
    <div class="home-card-body">
      <div class="home-card-title">${icoInline}<span class="card-ttl">${escHtml(d.title)||'Untitled'}</span></div>
      <div class="home-card-date">${fmtDate(d.updatedAt)}</div>
      ${chips?`<div class="home-card-chips">${chips}</div>`:''}
    </div>
  </div>`;
}
function homeRecentBody(){
  const recent=[...DB.getDocs()].sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,10);
  if(!recent.length) return `<div class="home-empty home-empty-cta">
      <svg class="he-swoosh" viewBox="0 0 150 150" aria-hidden="true"><path d="M18 60 C 52 26, 98 26, 132 58" fill="none" style="stroke:var(--c-docs)" stroke-width="20" stroke-linecap="round" opacity="0.45"/></svg>
      <div class="he-ico"><svg class="lic" viewBox="0 0 24 24"><path d="M4 20l4-1L18.5 8.5a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M13.5 7.5l3 3"/></svg></div>
      <div class="he-tx"><strong>Your workspace is a blank page.</strong><span>Create your first page and start writing, planning, or collecting.</span></div>
      <button class="btn btn-a he-btn" onclick="newDoc()">&#43; Create your first page</button>
    </div>`;
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
  const fx=(cfg.flex&&cfg.flex[key])||1;
  return `<section class="home-sec" data-key="${key}" style="flex:${fx} 1 0" ondragover="homeDragOver(event,'${key}')" ondragleave="homeDragLeave(event)" ondrop="homeDrop(event,'${key}')">${hdr}${collapsed?'':`<div class="home-sec-body">${homeSectionBody(key)}</div>`}</section>`;
}
/* ── Resize side-by-side home sections (a drag handle in the gap between them) ── */
function homeRowHtml(row,cfg){
  // Interleave a resize handle between adjacent sections in a multi-section row.
  const inner=row.map((k,i)=>(i>0?`<div class="home-col-rz" onmousedown="homeColResizeStart(event,'${row[i-1]}','${k}')" title="Drag to resize"></div>`:'')+homeSectionHtml(k,cfg)).join('');
  return `<div class="home-row${row.length>1?' multi':''}">${inner}</div>`;
}
function homeColResizeStart(e,leftKey,rightKey){
  e.preventDefault(); e.stopPropagation();
  const leftEl=document.querySelector(`.home-sec[data-key="${leftKey}"]`);
  const rightEl=document.querySelector(`.home-sec[data-key="${rightKey}"]`);
  if(!leftEl||!rightEl) return;
  const startX=e.clientX;
  const lw=leftEl.getBoundingClientRect().width, rw=rightEl.getBoundingClientRect().width, total=lw+rw;
  const c=getHomeCfg(); c.flex=c.flex||{};
  const totalFlex=((c.flex[leftKey]||1)+(c.flex[rightKey]||1));
  document.body.classList.add('home-col-resizing');
  function move(ev){
    // widths are in the same (zoomed) pixel space as clientX, so the ratio is zoom-safe
    const newLw=Math.max(140, Math.min(total-140, lw+(ev.clientX-startX)));
    const ratio=newLw/total;
    c.flex[leftKey]=+(totalFlex*ratio).toFixed(3);
    c.flex[rightKey]=+(totalFlex*(1-ratio)).toFixed(3);
    leftEl.style.flex=c.flex[leftKey]+' 1 0';
    rightEl.style.flex=c.flex[rightKey]+' 1 0';
  }
  function up(){ document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up); document.body.classList.remove('home-col-resizing'); saveHomeCfg(c); }
  document.addEventListener('mousemove',move); document.addEventListener('mouseup',up);
}
/* ── home customization (cover/icon/title/width) ──
   The Home "Customize" button now opens the unified Settings panel's "This page"
   tab (openCfg('page')); these controls render there via renderPageSettings(). */
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
  // Phase 1 — date reminder line under the greeting + ambient time-of-day backdrop.
  const _dateEl=document.getElementById('home-date');
  if(_dateEl){
    const _ds=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
    let _n=0; try{ _n=DB.getDocs().filter(d=>d.id!==HOME_ID && (typeof sbIsForeignDbEntry!=='function'||!sbIsForeignDbEntry(d))).length; }catch(_){}
    _dateEl.innerHTML=_n>0 ? `${_ds} · <span class="hd-count">${_n} page${_n!==1?'s':''}</span> in your workspace` : _ds;
    _dateEl.style.display=hd.titleHidden?'none':'';
  }
  const _homeC=document.getElementById('home-c');
  if(_homeC){
    _homeC.dataset.tod = h<6?'night':h<12?'morning':h<17?'afternoon':h<21?'evening':'night';
    _homeC.classList.toggle('home-ambient', !(hd.meta&&hd.meta.cover) && !hd.titleHidden);
  }
  // header: cover, icon, title, width
  renderCover(hd); renderEditorIcon(hd);
  const ti=document.getElementById('home-title-input');
  const titleToggle=document.getElementById('home-title-toggle');
  if(ti){
    if(hd.titleHidden){ ti.style.display='none'; document.getElementById('greeting').style.display='none'; if(titleToggle)titleToggle.innerHTML='&#43; Add title'; }
    else { ti.style.display=''; document.getElementById('greeting').style.display=''; ti.value=hd.title||''; if(titleToggle)titleToggle.innerHTML='<svg class="lic" viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-2px;margin-right:5px"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>Remove title'; }
  }
  const w=hd.fmt?.width||'focused'; applyHomeWidth(w); syncHomeWidthBtns(w);
  if(typeof applyDocFmt==='function') applyDocFmt(hd);   // apply the home's per-page typeface
  const cont=document.getElementById('home-sections'); if(!cont) return;
  cont.innerHTML=cfg.rows.map(row=>homeRowHtml(row,cfg)).join('');
  // hidden-sections restore bar
  const hidden=cfg.order.filter(k=>cfg.hidden[k]);
  document.getElementById('home-hidden-bar').innerHTML=hidden.length
    ? `<div class="home-hidden"><span class="home-hidden-lbl">Hidden:</span> ${hidden.map(k=>`<button class="home-hidden-chip" onclick="homeShowSection('${k}')">+ ${HOME_TITLES[k]||k}</button>`).join(' ')}</div>` : '';
  // render the free-form notes blocks if that section is visible & expanded
  if(cfg.order.includes('notes') && !cfg.hidden['notes'] && !cfg.collapsed['notes'] && document.getElementById('home-blocks-ct')){
    renderBlocks('home-blocks-ct'); initHistory();
  }
  if(typeof renderHomeChecklist==='function') renderHomeChecklist();
}
/* ── Get-started checklist (Phase 2) — a dismissible Home card with a colored
   progress ring + steps derived from real workspace state. Auto-hides when every
   step is done or the user dismisses it. ── */
function _homeChecklistDismissed(){ try{ return localStorage.getItem('libreta_checklist_done')==='1'; }catch(e){ return false; } }
function dismissHomeChecklist(){ try{ localStorage.setItem('libreta_checklist_done','1'); }catch(e){} renderHomeChecklist(); }
function _homeChecklistSteps(){
  let docs=[]; try{ docs=DB.getDocs().filter(d=>d.id!==HOME_ID && (typeof sbIsForeignDbEntry!=='function'||!sbIsForeignDbEntry(d))); }catch(e){}
  let usedSlash=false; try{ usedSlash=localStorage.getItem('libreta_used_slash')==='1'; }catch(e){}
  let hasDb=false; try{ hasDb=((typeof DB!=='undefined'&&DB.getTbls)?DB.getTbls():[]).length>0; }catch(e){}
  let synced=false; try{ synced=!!(typeof Cloud!=='undefined'&&Cloud.user); }catch(e){}
  return [
    {done:docs.length>0, color:'var(--c-docs)', lbl:'Create your first page', act:"newDoc()"},
    {done:usedSlash,     color:'var(--gr)',     lbl:'Try the slash menu',     act:"homeChecklistTrySlash()"},
    {done:hasDb,         color:'var(--go)',     lbl:'Build a database',       act:"nav('databases')"},
    {done:synced,        color:'var(--pu)',     lbl:'Turn on sync (optional)'},
  ];
}
function homeChecklistTrySlash(){
  let docs=[]; try{ docs=DB.getDocs().filter(d=>d.id!==HOME_ID && (typeof sbIsForeignDbEntry!=='function'||!sbIsForeignDbEntry(d))).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')); }catch(e){}
  if(docs.length) nav('editor',docs[0].id); else newDoc();
  if(typeof toast==='function') toast('Type / on any empty line to add a block',{type:'info'});
}
function renderHomeChecklist(){
  const host=document.getElementById('home-checklist'); if(!host) return;
  if(_homeChecklistDismissed()){ host.innerHTML=''; return; }
  const steps=_homeChecklistSteps();
  const done=steps.filter(s=>s.done).length, total=steps.length;
  if(done>=total){ host.innerHTML=''; return; }
  const circ=264, off=Math.round(circ*(1-done/total));
  const rows=steps.map(s=>{
    const box=s.done
      ? `<span class="hck-box hck-done" style="background:${s.color};border-color:${s.color}">&#10003;</span>`
      : `<span class="hck-box" style="border-color:${s.color}"></span>`;
    const arrow=(!s.done&&s.act)?`<span class="hck-arrow">&#8594;</span>`:'';
    const click=(!s.done&&s.act)?` onclick="${s.act}"`:'';
    return `<div class="hck-step${s.done?' is-done':''}${(!s.done&&s.act)?' hck-clickable':''}"${click}>${box}<span class="hck-lbl">${s.lbl}</span>${arrow}</div>`;
  }).join('');
  host.innerHTML=`<div class="home-checklist-card">
    <div class="hck-top">
      <div class="hck-ring">
        <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="var(--bd)" stroke-width="10"/><circle cx="50" cy="50" r="42" fill="none" stroke="var(--gr)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${off}" transform="rotate(-90 50 50)"/></svg>
        <span class="hck-frac">${done}/${total}</span>
      </div>
      <div class="hck-head"><div class="hck-ttl">Get started</div><div class="hck-sub">A few steps to make Libreta yours.</div></div>
      <button class="hck-x" onclick="dismissHomeChecklist()" title="Dismiss" aria-label="Dismiss">&times;</button>
    </div>
    <div class="hck-steps">${rows}</div>
  </div>`;
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
      <span class="doc-row-title">${escHtml(d.title)||'<em style="opacity:.4;font-weight:300">Untitled</em>'}</span>
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
      <span class="doc-row-title">${escHtml(d.title)||'<em style="opacity:.4;font-weight:300">Untitled</em>'}</span>
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
  // Database ENTRY pages (a row's backing doc) don't belong at the Documents root —
  // they live inside their database. Hide them here (same rule the sidebar tree uses);
  // they're still reachable via the database itself and the Databases page.
  const _notDbEntry=d=>typeof sbIsForeignDbEntry!=='function'||!sbIsForeignDbEntry(d);
  let docs=sortDocsList(all.filter(d=>_notDbEntry(d)&&docMatchesFilters(d,FILT.documents)));
  if(!docs.length){
    g.className='dl-grid';
    g.innerHTML=`<div class="empty"><svg viewBox="0 0 56 56"><circle cx="25" cy="25" r="16"/><line x1="37" y1="37" x2="50" y2="50"/></svg><h3>No matches</h3><p>No documents match the current filter.</p><button class="btn btn-o" onclick="S.filterScope='documents';clearFilters()">Clear filter</button></div>`;
    return;
  }
  if(S.docView==='tree'){ renderDocTree(g, all.filter(d=>d.id!==HOME_ID&&_notDbEntry(d))); return; }
  if(S.docView==='rows'){
    g.className='dl-rows';
    g.innerHTML=docs.map(docRowHtml).join('');
    return;
  }
  g.className='dl-grid';
  g.innerHTML=docs.map(d=>{
    const exc=(d.blocks||[])
      .filter(b=>!['divider','database','image','file','carousel','bookmark','youtube','page','grid','math'].includes(b.type))
      .map(b=>(b.content||'').replace(/<[^>]+>/g,'')).join(' ').slice(0,120)||'';
    const wc=d.meta?.wordCount||0;
    const rt=d.meta?.readingTime||0;
    const bc=d.meta?.blockCount||0;
    const cover=d.meta?.cover
      ? (isPresetCover(d.meta.cover)
          ? `<div class="dc-cover-thumb dc-cover-accent" style="${coverThumbBg(d.meta.cover)}"></div>`
          : `<img class="dc-cover-thumb" src="${srcFor(d.meta.cover)}" alt="" style="object-position:center ${d.meta.coverPos!=null?d.meta.coverPos:50}%">`)
      : '';
    const ico=d.meta?.icon?`<span class="card-ico">${iconHtml(d.meta.icon,'1.1em')}</span>`:'';
    const chips=listTagsOn()?quickChips(d,true):'';
    const meta=wc>0
      ?`<span class="dc-wc">${wc.toLocaleString()} words &middot; ${rt}m read &middot; ${bc} block${bc!==1?'s':''}</span>`
      :`<span class="dc-wc">Empty</span>`;
    return`<div class="dc" onclick="nav('editor','${d.id}')" onmouseleave="this.style.transform=''">
      ${cover}
      <button class="dc-star${isFav(d)?' on':''}" onclick="event.stopPropagation();toggleFavorite('${d.id}')" title="${isFav(d)?'Remove favorite':'Add favorite'}">${isFav(d)?'★':'☆'}</button>
      <div class="dc-t">${ico}<span class="card-ttl">${escHtml(d.title)||'Untitled'}</span></div>
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

