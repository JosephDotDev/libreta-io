/* ═══════════════════════════════════════════════
   SLASH MENU
═══════════════════════════════════════════════ */
function openSlash(el,id){
  S.slashId=id; S.slashQ=''; S.slashFoc=0; S.slashSub=false;
  const rect=el.getBoundingClientRect();
  const m=document.getElementById('slash-menu');
  // Restore the canonical structure each open — some submenus (e.g. Database)
  // replace the menu's contents, which would otherwise destroy #sm-its.
  m.innerHTML='<div class="sm-hdr">Block type — type to filter</div><div id="sm-its" class="sm-its"></div>';
  m.style.top=(rect.bottom+4)+'px';
  m.style.left=Math.min(rect.left,window.innerWidth-268)+'px';
  renderSlashItems(); m.classList.add('open'); openOvl();
}
function closeSlash(){document.getElementById('slash-menu').classList.remove('open');S.slashId=null;S.slashQ='';S.slashSub=false;closeOvlSafe()}
/* Highlight item `idx` among whatever items are currently shown (canonical list
   OR a submenu like the Database picker) without rebuilding the menu — so arrow
   keys work the same in both. */
function slashSetFoc(idx){
  const its=[...document.querySelectorAll('#slash-menu .sm-it')];
  if(!its.length) return;
  idx=Math.max(0,Math.min(idx,its.length-1)); S.slashFoc=idx;
  its.forEach((el,i)=>el.classList.toggle('foc',i===idx));
  its[idx].scrollIntoView({block:'nearest'});
}
function renderSlashItems(){
  S.slashSub=false;                 // canonical list is showing again
  const q=S.slashQ.toLowerCase();
  const items=q?BT.filter(t=>t.lbl.toLowerCase().includes(q)||t.t.includes(q)):BT;
  let cont=document.getElementById('sm-its');
  if(!cont){ // structure was clobbered — rebuild it
    const m=document.getElementById('slash-menu');
    m.innerHTML='<div class="sm-hdr">Block type — type to filter</div><div id="sm-its" class="sm-its"></div>';
    cont=document.getElementById('sm-its');
  }
  cont.innerHTML=items.map((t,i)=>`
    <div class="sm-it${i===S.slashFoc?' foc':''}" onclick="pickSlash('${t.t}')">
      <div class="sm-ico">${t.ico}</div>
      <div><div class="sm-nm">${t.lbl}</div><div class="sm-ds">${t.ds}</div></div>
    </div>`).join('')||`<div style="padding:12px;color:var(--mu);font-size:11px">No matches</div>`;
  // Keep the highlighted item in view when navigating past the scroll edge.
  const foc=cont.querySelector('.sm-it.foc');
  if(foc) foc.scrollIntoView({block:'nearest'});
}
function pickSlash(type){
  if(!S.slashId) return;
  if(type==='page'){
    const sid=S.slashId; const loc=locate(sid); closeSlash();
    const child=blankDoc(); child.meta=child.meta||{}; child.meta.parent=S.docId; DB.saveDoc(child);
    if(loc){ loc.arr[loc.idx]={id:sid,type:'page',content:'',pageId:child.id}; const row=document.querySelector(`.bk-row[data-id="${sid}"]`); if(row)row.replaceWith(mkBkEl(loc.arr[loc.idx])); }
    flushSave(); nav('editor',child.id);
    return;
  }
  if(type==='mention'){
    const sid=S.slashId; const el=document.querySelector('.bk[data-id="'+sid+'"]'); closeSlash();
    if(el){el.innerHTML='';saveBlk(sid,'')}
    const rect=el?el.getBoundingClientRect():{bottom:140,left:140};
    promptUrl(rect,(url)=>{ if(url&&el){el.focus();putCursorEnd(el);insertMention(el,url)} });
    return;
  }
  if(type==='database'){
    // Only offer the format for a NEW database (Table / Board / Calendar). Pointing a
    // block at an existing database is done from the database's own header, so the
    // slash menu doesn't balloon with every table in the workspace.
    idbSlashView(S.slashId,'__new__');
    return;
  }
  if(type==='db-board'||type==='db-calendar'){
    // Shortcut: spin up a brand-new database directly in the chosen view, skipping
    // the source/view picker. (Use /database to point a block at an existing DB.)
    idbCreateNew(S.slashId, type.slice(3));   // 'board' | 'calendar'
    return;
  }
  if(type==='math'){
    const sid=S.slashId; const el=document.querySelector('.bk[data-id="'+sid+'"]'); if(el){ el.innerHTML=''; saveBlk(sid,''); }
    closeSlash(); xformBlk(sid,'math','');
    setTimeout(()=>{ if(typeof mathEdit==='function') mathEdit(sid); },30);
    return;
  }
  const el=document.querySelector('.bk[data-id="'+S.slashId+'"]');
  if(el){el.innerHTML='';saveBlk(S.slashId,'')}
  xformBlk(S.slashId,type,'');
  const sid=S.slashId; closeSlash();
  setTimeout(()=>{const e2=document.querySelector('.bk[data-id="'+sid+'"]');if(e2){e2.focus();putCursorEnd(e2)}},0);
}
document.addEventListener('keydown',e=>{
  if(!S.slashId) return;
  const its=document.querySelectorAll('#slash-menu .sm-it');
  if(e.key==='ArrowDown'){e.preventDefault();slashSetFoc(S.slashFoc+1)}
  else if(e.key==='ArrowUp'){e.preventDefault();slashSetFoc(S.slashFoc-1)}
  else if(e.key==='Enter'){e.preventDefault();(its[S.slashFoc]||document.querySelector('#slash-menu .sm-it.foc'))?.click()}
  else if(e.key==='Escape'){closeSlash();const el=document.querySelector(`.bk[data-id="${S.slashId||''}"]`);if(el){el.innerHTML='';el.focus()}}
});

