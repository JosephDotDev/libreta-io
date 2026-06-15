/* ═══════════════════════════════════════════════
   SIDEBAR PAGE TREE  (customizable hierarchy)

   The hierarchy itself lives on the documents (meta.parent). Sidebar-only
   preferences — custom sibling order, collapsed nodes, and hidden pages — live
   separately in localStorage so they never pollute document data:
     folio_sidebar = { order:{<parentId|'root'>:[ids]}, collapsed:{id:true}, hidden:{id:true} }
═══════════════════════════════════════════════ */
const SB_KEY='folio_sidebar';
function sbState(){ try{const s=JSON.parse(localStorage.getItem(SB_KEY))||{}; s.order=s.order||{}; s.collapsed=s.collapsed||{}; s.hidden=s.hidden||{}; return s;}catch{return{order:{},collapsed:{},hidden:{}};} }
function saveSbState(s){ try{localStorage.setItem(SB_KEY,JSON.stringify(s));}catch(e){} }

/* Visible children of a parent (null = top level), in the user's custom order. */
function sbOrderedChildren(parentId){
  const st=sbState();
  const kids=DB.getDocs().filter(d=> d.id!==HOME_ID && ((d.meta&&d.meta.parent)||null)===(parentId||null) && !st.hidden[d.id]);
  const ord=st.order[parentId||'root']||[];
  kids.sort((a,b)=>{
    const ia=ord.indexOf(a.id), ib=ord.indexOf(b.id);
    if(ia<0&&ib<0) return (b.updatedAt||'').localeCompare(a.updatedAt||''); // unordered → newest first
    if(ia<0) return 1; if(ib<0) return -1; return ia-ib;
  });
  return kids;
}
/* Is `id` inside the subtree rooted at `ancestorId`? (guards illegal moves) */
function isDescendant(ancestorId,id){
  let cur=id?DB.getDoc(id):null; const seen=new Set();
  while(cur&&!seen.has(cur.id)){ if(cur.id===ancestorId) return true; seen.add(cur.id); cur=cur.meta&&cur.meta.parent?DB.getDoc(cur.meta.parent):null; }
  return false;
}
function _sbIcon(d){
  return d&&d.meta&&d.meta.icon
    ? `<span class="sb-it-ico">${iconHtml(d.meta.icon,'14px')}</span>`
    : `<span class="sb-it-ico"><svg viewBox="0 0 16 16"><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z"/><path d="M9 1v5h5"/></svg></span>`;
}
function renderTreeNode(doc,depth){
  const st=sbState();
  const kids=sbOrderedChildren(doc.id);
  const hasKids=kids.length>0;
  const collapsed=!!st.collapsed[doc.id];
  const active=(S.view==='editor'&&S.docId===doc.id)?' active':'';
  const chev=hasKids
    ? `<span class="sb-tree-chev${collapsed?' collapsed':''}" onclick="toggleTreeNode(event,'${doc.id}')">&#9662;</span>`
    : `<span class="sb-tree-spacer"></span>`;
  let html=`<div class="sb-tree-row" data-id="${doc.id}" draggable="true"
      ondragstart="sbTreeDragStart(event,'${doc.id}')" ondragover="sbTreeDragOver(event,'${doc.id}')" ondragleave="sbTreeDragLeave(event)" ondrop="sbTreeDrop(event,'${doc.id}')" ondragend="sbTreeDragEnd()"
      style="padding-left:${6+depth*13}px">
      ${chev}
      <button class="sb-tree-it${active}" onclick="nav('editor','${doc.id}')" title="${escAttr(doc.title||'Untitled')}">${_sbIcon(doc)}<span class="sb-it-nm">${escHtml(doc.title||'Untitled')}</span></button>
      <button class="sb-tree-act sb-tree-menu" onclick="openTreeMenu(event,'${doc.id}')" data-tip="More">&#8943;</button>
      <button class="sb-tree-act sb-tree-add" onclick="addChildPage(event,'${doc.id}')" data-tip="Add page inside">+</button>
    </div>`;
  if(hasKids&&!collapsed) html+=kids.map(k=>renderTreeNode(k,depth+1)).join('');
  return html;
}
function renderSidebarTree(){
  const tree=document.getElementById('sb-tree'); if(!tree) return;
  const grpCollapsed=!!getSbGroups().pages;
  const hdr=document.querySelector('#sb-pages .sb-list-chev'); if(hdr) hdr.classList.toggle('collapsed',grpCollapsed);
  if(grpCollapsed){ tree.innerHTML=''; return; }
  const roots=sbOrderedChildren(null);
  tree.innerHTML=roots.length ? roots.map(d=>renderTreeNode(d,0)).join('')
    : '<div class="sb-tree-empty">No pages yet — click <b>+</b> to add one.</div>';
}
function renderHiddenList(){
  const st=sbState();
  const ids=Object.keys(st.hidden).filter(id=>st.hidden[id]&&DB.getDoc(id));
  const g=document.getElementById('sb-hidden'); if(!g) return;
  g.style.display=ids.length?'block':'none';
  const collapsed=!!getSbGroups().hidden; g.querySelector('.sb-list-chev').classList.toggle('collapsed',collapsed);
  document.getElementById('sb-hidden-list').innerHTML=collapsed?'':ids.map(id=>{const d=DB.getDoc(id);
    return `<div class="sb-tree-row" style="padding-left:6px"><span class="sb-tree-spacer"></span>
      <button class="sb-tree-it dim" onclick="nav('editor','${id}')" title="${escAttr(d.title||'Untitled')}">${_sbIcon(d)}<span class="sb-it-nm">${escHtml(d.title||'Untitled')}</span></button>
      <button class="sb-tree-act" onclick="showDoc(event,'${id}')" data-tip="Show in sidebar">&#128065;</button></div>`;
  }).join('');
}
function toggleTreeNode(e,id){ e.stopPropagation(); const st=sbState(); st.collapsed[id]=!st.collapsed[id]; saveSbState(st); renderSidebarTree(); }

/* ── Create ── plain pages (like inline /page), not auto-joined to a database. */
function createSidebarDoc(parentId){
  const d=blankDoc();
  if(parentId){ d.meta=d.meta||{}; d.meta.parent=parentId; }
  DB.saveDoc(d);
  const st=sbState(); const key=parentId||'root';
  const cur=(st.order[key]||sbOrderedChildren(parentId).filter(x=>x.id!==d.id).map(x=>x.id));
  cur.push(d.id); st.order[key]=cur;
  if(parentId) delete st.collapsed[parentId]; // reveal the new child
  saveSbState(st);
  renderSidebarLists();
  nav('editor',d.id);
}
function addTopPage(e){ e&&e.stopPropagation&&e.stopPropagation(); createSidebarDoc(null); }
function addChildPage(e,parentId){ e&&e.stopPropagation&&e.stopPropagation(); createSidebarDoc(parentId); }

/* ── Per-page menu ── */
function openSbPopover(rect,html){
  let m=document.getElementById('sb-menu');
  if(!m){ m=document.createElement('div'); m.id='sb-menu'; m.className='sb-menu'; document.body.appendChild(m); }
  m.innerHTML=html; m.style.display='block';
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  let left=rect.left/z, top=rect.bottom/z+4; const vw=window.innerWidth/z, vh=window.innerHeight/z;
  requestAnimationFrame(()=>{ const w=m.offsetWidth,h=m.offsetHeight; if(left+w>vw-8)left=vw-w-8; if(top+h>vh-8)top=Math.max(8,rect.top/z-h-4); m.style.left=Math.max(8,left)+'px'; m.style.top=Math.max(8,top)+'px'; });
  openOvl();
}
function closeSbMenu(){ const m=document.getElementById('sb-menu'); if(m)m.style.display='none'; closeOvlSafe(); }
function openTreeMenu(e,id){
  e.stopPropagation();
  const html=`
    <div class="sb-menu-it" onclick="closeSbMenu();nav('editor','${id}')"><span class="sb-menu-i">&#8599;</span> Open</div>
    <div class="sb-menu-it" onclick="addChildPage(event,'${id}');closeSbMenu()"><span class="sb-menu-i">+</span> Add page inside</div>
    <div class="sb-menu-it" onclick="duplicateDoc(event,'${id}')"><span class="sb-menu-i">&#10697;</span> Duplicate</div>
    <div class="sb-menu-it" onclick="openMovePicker(event,'${id}')"><span class="sb-menu-i">&#8594;</span> Move to&hellip;</div>
    <div class="sb-menu-it" onclick="hideDoc(event,'${id}')"><span class="sb-menu-i">&#128065;</span> Hide from sidebar</div>
    <div class="sb-menu-sep"></div>
    <div class="sb-menu-it danger" onclick="deleteSbDoc(event,'${id}')"><span class="sb-menu-i">&#128465;</span> Delete</div>`;
  openSbPopover(e.currentTarget.getBoundingClientRect(),html);
}
function openMovePicker(e,id){
  e&&e.stopPropagation&&e.stopPropagation();
  const dests=DB.getDocs().filter(d=> d.id!==HOME_ID && d.id!==id && !isDescendant(id,d.id));
  let html=`<div class="sb-menu-hdr">Move &ldquo;${escHtml((DB.getDoc(id)||{}).title||'Untitled')}&rdquo; to</div>
    <div class="sb-menu-it" onclick="moveDocTo('${id}','')"><span class="sb-menu-i">&#9650;</span> Top level</div>`;
  html+=dests.slice(0,50).map(d=>`<div class="sb-menu-it" onclick="moveDocTo('${id}','${d.id}')">${_sbIcon(d)}<span class="sb-it-nm">${escHtml(d.title||'Untitled')}</span></div>`).join('')
    ||'<div class="sb-menu-empty">No other pages</div>';
  const m=document.getElementById('sb-menu'); if(m) m.innerHTML=html;
}
function moveDocTo(id,destId){
  destId=destId||null;
  if(destId===id||isDescendant(id,destId)){ closeSbMenu(); return; }
  const d=DB.getDoc(id); if(!d){closeSbMenu();return;}
  d.meta=d.meta||{}; if(destId) d.meta.parent=destId; else delete d.meta.parent; DB.saveDoc(d);
  const st=sbState(); const key=destId||'root';
  const cur=(st.order[key]||sbOrderedChildren(destId).map(x=>x.id)).filter(x=>x!==id); cur.push(id); st.order[key]=cur;
  if(destId) delete st.collapsed[destId];
  saveSbState(st); closeSbMenu(); renderSidebarLists(); if(typeof refreshActiveLists==='function') refreshActiveLists(); toast('Page moved');
}
function hideDoc(e,id){ e&&e.stopPropagation&&e.stopPropagation(); const st=sbState(); st.hidden[id]=true; saveSbState(st); closeSbMenu(); renderSidebarLists(); toast('Hidden from sidebar'); }
function showDoc(e,id){ e&&e.stopPropagation&&e.stopPropagation(); const st=sbState(); delete st.hidden[id]; saveSbState(st); renderSidebarLists(); toast('Shown in sidebar'); }

/* ── Duplicate (deep: clones the page and its whole sub-tree, remapping links) ── */
function _remapPageBlocks(blocks,idMap){
  (blocks||[]).forEach(b=>{
    if(!b) return;
    if(b.type==='page'&&b.pageId&&idMap[b.pageId]) b.pageId=idMap[b.pageId];
    if(b.cols) b.cols.forEach(col=>_remapPageBlocks(col,idMap));
    if(b.children) _remapPageBlocks(b.children,idMap);
  });
}
function _dupTree(srcId,parentId,isRoot){
  const src=DB.getDoc(srcId); if(!src) return null;
  const copy=JSON.parse(JSON.stringify(src));
  copy.id=mkId('d'); copy.createdAt=new Date().toISOString(); copy.updatedAt=copy.createdAt;
  copy.meta=copy.meta||{}; if(parentId) copy.meta.parent=parentId; else delete copy.meta.parent;
  if(isRoot) copy.title=(src.title||'Untitled')+' (copy)';
  delete copy.dbId; delete copy.rowId; // a duplicate is its own page, not the same DB row
  const idMap={};
  DB.getDocs().filter(d=>(d.meta&&d.meta.parent)===srcId).forEach(cd=>{ const n=_dupTree(cd.id,copy.id,false); if(n) idMap[cd.id]=n; });
  _remapPageBlocks(copy.blocks,idMap);
  DB.saveDoc(copy);
  return copy.id;
}
function duplicateDoc(e,id){
  e&&e.stopPropagation&&e.stopPropagation(); closeSbMenu();
  const src=DB.getDoc(id); if(!src) return;
  const newId=_dupTree(id,(src.meta&&src.meta.parent)||null,true);
  if(!newId) return;
  // place the copy right after the original in its sibling order
  const st=sbState(); const key=(src.meta&&src.meta.parent)||'root';
  let sibs=(st.order[key]||sbOrderedChildren((src.meta&&src.meta.parent)||null).map(x=>x.id)).filter(x=>x!==newId);
  const oi=sibs.indexOf(id); sibs.splice(oi<0?sibs.length:oi+1,0,newId); st.order[key]=sibs; saveSbState(st);
  renderSidebarLists(); if(typeof refreshActiveLists==='function') refreshActiveLists(); toast('Page duplicated'); nav('editor',newId);
}

/* ── Delete → move the page (and its whole sub-tree) to Trash ── */
function deleteSbDoc(e,id){
  e&&e.stopPropagation&&e.stopPropagation(); closeSbMenu();
  const d=DB.getDoc(id); const subs=_collectSubtree(id,[]).length-1;   // entire sub-tree, not just direct kids
  showConfirm(`Move “${(d&&d.title)||'Untitled'}”${subs?` and its ${subs} sub-page${subs>1?'s':''}`:''} to Trash?`,
    ()=>{ const res=trashDoc(id);   // trashDoc handles closing the open page + refreshing the sidebar
      if(res) toast(`Moved to Trash · ${undoHint()} to undo`); },'Delete','Move to Trash');
}

/* ── Drag-and-drop reorder + nest (native; sidebar buttons aren't contenteditable) ── */
let _sbDrag=null;
function sbTreeDragStart(e,id){ _sbDrag=id; try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','sb');}catch(_){}
  const row=e.currentTarget; setTimeout(()=>row&&row.classList.add('sb-dragging'),0); e.stopPropagation(); }
function _sbZone(e,row){ const r=row.getBoundingClientRect(); const z=parseFloat(document.documentElement.style.zoom||'1')||1; const y=e.clientY/z-r.top/z, h=r.height/z; if(y<h*0.3) return 'before'; if(y>h*0.7) return 'after'; return 'inside'; }
function _clearSbDrops(){ document.querySelectorAll('.sb-drop-before,.sb-drop-after,.sb-drop-inside').forEach(r=>r.classList.remove('sb-drop-before','sb-drop-after','sb-drop-inside')); }
function sbTreeDragOver(e,id){
  if(!_sbDrag||_sbDrag===id||isDescendant(_sbDrag,id)) return;
  e.preventDefault(); e.stopPropagation(); if(e.dataTransfer)e.dataTransfer.dropEffect='move';
  _clearSbDrops(); e.currentTarget.classList.add('sb-drop-'+_sbZone(e,e.currentTarget));
}
function sbTreeDragLeave(e){ e.currentTarget.classList.remove('sb-drop-before','sb-drop-after','sb-drop-inside'); }
function sbTreeDrop(e,id){
  e.preventDefault(); e.stopPropagation();
  const zone=_sbZone(e,e.currentTarget); _clearSbDrops();
  const moved=_sbDrag; _sbDrag=null;
  if(!moved||moved===id||isDescendant(moved,id)) return;
  if(zone==='inside') sbNestInto(moved,id); else sbReorder(moved,id,zone);
}
function sbTreeDragEnd(){ _sbDrag=null; _clearSbDrops(); document.querySelectorAll('.sb-dragging').forEach(r=>r.classList.remove('sb-dragging')); }
function sbTreeRootOver(e){ if(_sbDrag&&e.target.id==='sb-tree'){ e.preventDefault(); e.target.classList.add('sb-tree-root-drop'); } }
function sbTreeRootDrop(e){ const tree=document.getElementById('sb-tree'); tree&&tree.classList.remove('sb-tree-root-drop'); if(_sbDrag&&e.target.id==='sb-tree'){ e.preventDefault(); const m=_sbDrag; _sbDrag=null; moveDocTo(m,null); } }
function sbReorder(moved,targetId,where){
  const target=DB.getDoc(targetId); const np=(target.meta&&target.meta.parent)||null;
  const md=DB.getDoc(moved); md.meta=md.meta||{}; if(np)md.meta.parent=np; else delete md.meta.parent; DB.saveDoc(md);
  const st=sbState(); const key=np||'root';
  let sibs=sbOrderedChildren(np).map(d=>d.id).filter(x=>x!==moved);
  const ti=sibs.indexOf(targetId); sibs.splice(where==='after'?ti+1:ti,0,moved);
  st.order[key]=sibs; saveSbState(st); renderSidebarLists();
}
function sbNestInto(moved,targetId){
  const md=DB.getDoc(moved); md.meta=md.meta||{}; md.meta.parent=targetId; DB.saveDoc(md);
  const st=sbState(); const cur=(st.order[targetId]||sbOrderedChildren(targetId).map(x=>x.id)).filter(x=>x!==moved); cur.push(moved); st.order[targetId]=cur;
  delete st.collapsed[targetId]; saveSbState(st); renderSidebarLists();
}
