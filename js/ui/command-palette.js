/* ═══════════════════════════════════════════════
   COMMAND PALETTE  (⌘K / Ctrl-K)

   A centered modal that searches pages + databases and offers Create actions,
   with every result tinted by what it is (pages = Documents blue, databases =
   gold, new page = accent). Reuses the sidebar search index (runSearch /
   _searchSnippet) so typing stays snappy. The sidebar search box still works
   independently — this replaces ⌘K's old "focus the sidebar" behaviour.
═══════════════════════════════════════════════ */
let cmdkItems=[], cmdkFoc=0;

const _CMDK_ICO={
  file:'<svg viewBox="0 0 16 16"><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z"/><path d="M9 1v5h5"/></svg>',
  db:'<svg viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="13" height="13" rx="1"/><line x1="1.5" y1="5.5" x2="14.5" y2="5.5"/><line x1="6" y1="5.5" x2="6" y2="14.5"/></svg>',
  plus:'<svg viewBox="0 0 16 16"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>',
  search:'<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></svg>',
};
function _cmdkPageIco(p){ return (p&&p.icon)?iconHtml(p.icon,'16px'):_CMDK_ICO.file; }

function openCmdK(){
  const m=document.getElementById('cmdk'); if(!m) return;
  if(m.classList.contains('open')){ closeCmdK(); return; } // ⌘K again toggles closed
  if(typeof closeAll==='function') closeAll();             // dismiss any open menus first
  m.classList.add('open');
  const inp=document.getElementById('cmdk-input'); if(inp) inp.value='';
  cmdkRender('');
  setTimeout(()=>{ const i=document.getElementById('cmdk-input'); if(i) i.focus(); },0);
}
function closeCmdK(){ const m=document.getElementById('cmdk'); if(m) m.classList.remove('open'); }
function cmdkBackdrop(e){ if(e.target===e.currentTarget) closeCmdK(); }
function cmdkInput(v){ cmdkRender(v); }

function _cmdkRecentPages(){
  return [...DB.getDocs()]
    .filter(d=>d.id!==HOME_ID && (typeof sbIsForeignDbEntry!=='function'||!sbIsForeignDbEntry(d)))
    .sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''))
    .slice(0,6)
    .map(d=>({id:d.id,title:d.title,icon:d.meta&&d.meta.icon}));
}
function cmdkRow(idx,color,ico,title,sub){
  return `<div class="cmdk-row" data-idx="${idx}" onmousemove="cmdkSetFoc(${idx})" onclick="cmdkActivate(${idx})">
    <span class="cmdk-ic" style="color:${color};background:color-mix(in srgb,${color} 16%,transparent)">${ico}</span>
    <div class="cmdk-tx"><div class="cmdk-nm">${escHtml(title)}</div><div class="cmdk-sub">${escHtml(sub||'')}</div></div>
  </div>`;
}
function cmdkRender(v){
  const box=document.getElementById('cmdk-results'); if(!box) return;
  const q=(v||'').trim(), ql=q.toLowerCase();
  const items=[]; let html='';

  // ── Jump to ──
  const pages = q ? ((typeof runSearch==='function')?runSearch(q):[]) : _cmdkRecentPages();
  const tbls = ((typeof DB!=='undefined'&&DB.getTbls)?DB.getTbls():[])
    .filter(t=>!q || (t.name||'').toLowerCase().includes(ql)).slice(0,6);
  let jump='';
  pages.forEach(p=>{
    const i=items.length; items.push({kind:'page',id:p.id});
    const snip=(q&&typeof _searchSnippet==='function')?_searchSnippet(p.id,ql):'';
    jump+=cmdkRow(i,'var(--c-docs)',_cmdkPageIco(p),p.title||'Untitled',snip||'Page');
  });
  tbls.forEach(t=>{
    const i=items.length; items.push({kind:'table',id:t.id});
    const n=(t.rows||[]).length;
    jump+=cmdkRow(i,'var(--go)',_CMDK_ICO.db,t.name||'Untitled',`Database · ${n} row${n!==1?'s':''}`);
  });
  if(jump) html+=`<div class="cmdk-grp-lbl">Jump to</div>${jump}`;

  // ── Create ──
  if(q){
    let create='';
    let i=items.length; items.push({kind:'newpage',q});
    create+=cmdkRow(i,'var(--ac)',_CMDK_ICO.plus,`New page “${q}”`,'Documents');
    i=items.length; items.push({kind:'newdb',q});
    create+=cmdkRow(i,'var(--go)',_CMDK_ICO.db,`New database “${q}”`,'Table, board, or calendar');
    html+=`<div class="cmdk-grp-lbl">Create</div>${create}`;
  }

  if(!items.length) html=`<div class="cmdk-empty">No matches for “${escHtml(q)}”.</div>`;
  box.innerHTML=html;
  cmdkItems=items; cmdkFoc=0; cmdkSetFoc(0);
}
function cmdkSetFoc(idx){
  if(!cmdkItems.length) return;
  idx=Math.max(0,Math.min(idx,cmdkItems.length-1)); cmdkFoc=idx;
  const rows=document.querySelectorAll('#cmdk-results .cmdk-row');
  rows.forEach((r,i)=>r.classList.toggle('foc',i===idx));
  if(rows[idx]) rows[idx].scrollIntoView({block:'nearest'});
}
function cmdkKey(e){
  if(e.key==='ArrowDown'){ e.preventDefault(); cmdkSetFoc(cmdkFoc+1); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); cmdkSetFoc(cmdkFoc-1); }
  else if(e.key==='Enter'){ e.preventDefault(); cmdkActivate(cmdkFoc); }
  else if(e.key==='Escape'){ e.preventDefault(); closeCmdK(); }
}
function cmdkActivate(idx){
  const it=cmdkItems[idx]; if(!it) return;
  closeCmdK();
  if(it.kind==='page'){ nav('editor',it.id); }
  else if(it.kind==='table'){ nav('databases'); if(typeof openTbl==='function') openTbl(it.id); }
  else if(it.kind==='newpage'){ const d=blankDoc(); d.title=it.q; DB.saveDoc(d); nav('editor',d.id); }
  else if(it.kind==='newdb'){
    const t=blankTbl(); t.name=it.q||'New Database';
    const cells={}; t.columns.forEach(c=>cells[c.id]=''); t.rows.push({id:mkId('r'),cells});
    DB.saveTbl(t); S.tblId=t.id; nav('databases');
    if(typeof openTbl==='function') openTbl(t.id);
    if(typeof renderTblList==='function') renderTblList();
  }
}
