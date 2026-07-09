/* ═══════════════════════════════════════════════
   #7 SIMPLE TABLE (grid) BLOCK
═══════════════════════════════════════════════ */
function defaultGrid(){return {header:true, rows:[['Column 1','Column 2','Column 3'],['','',''],['','','']]}}
function mkGridHtml(blk){
  const g=blk.grid||defaultGrid();
  const ncol=g.rows[0]?g.rows[0].length:0;
  const colW=g.colW||[];
  const fixed=colW.some(w=>w);
  const colgroup=`<colgroup><col style="width:16px">${Array.from({length:ncol},(_,ci)=>`<col${colW[ci]?` style="width:${colW[ci]}px"`:''}>`).join('')}</colgroup>`;
  const colRow=`<tr class="bk-grid-chrow"><td class="bk-grid-corner"></td>${Array.from({length:ncol},(_,ci)=>`<td class="bk-grid-chandle" draggable="true" onclick="gridHandleMenu(event,'${blk.id}','col',${ci})" ondragstart="gridColDragStart(event,'${blk.id}',${ci})" ondragover="gridColDragOver(event)" ondragleave="gridColDragLeave(event)" ondrop="gridColDrop(event,'${blk.id}',${ci})" ondragend="gridDragEnd()" title="Click for options · drag to move">⠿</td>`).join('')}</tr>`;
  const rowsH=g.rows.map((r,ri)=>{
    const rh=g.rowH&&g.rowH[ri]?` style="height:${g.rowH[ri]}px"`:'';
    return `<tr${rh} class="${g.header&&ri===0?'bk-grid-hdr':''}" ondragover="gridRowDragOver(event)" ondragleave="gridRowDragLeave(event)" ondrop="gridRowDrop(event,'${blk.id}',${ri})"><td class="bk-grid-rhandle" draggable="true" onclick="gridHandleMenu(event,'${blk.id}','row',${ri})" ondragstart="gridRowDragStart(event,'${blk.id}',${ri})" ondragend="gridDragEnd()" title="Click for options · drag to move">⠿</td>`+r.map((c,ci)=>`<td contenteditable="true" onkeydown="gridCellKey(event,this)" onpaste="onGridPaste(event,this)" oninput="gridSet('${blk.id}',${ri},${ci},this.innerHTML)">${gridCellHtml(c)}</td>`).join('')+'</tr>';
  }).join('');
  return `<div class="bk-grid-wrap"><table class="bk-grid${g.header?' has-header':''}${fixed?' bk-grid-fixed':''}">${colgroup}${colRow}${rowsH}</table></div>`;
}
/* ── Column/row resize: thin overlay grips positioned over the real column/row
   boundaries (measured from live layout, so they work before any manual sizing
   too). A ResizeObserver keeps them aligned as cells wrap/grow while typing. ── */
function gridSyncGrips(id){
  // While a resize is actively in progress on this table, a row-height drag keeps
  // changing the table's outer height, which re-triggers the ResizeObserver below on
  // every frame — tearing down/rebuilding every grip mid-drag causes visible flicker
  // (lines flashing missing/duplicated). Skip the churn; the drag's own `up` handler
  // calls this once more for a final, accurate sync.
  if(S._gridResize&&S._gridResize.id===id) return;
  const wrap=document.querySelector(`.bk-row[data-id="${id}"] .bk-grid-wrap`); if(!wrap) return;
  wrap.querySelectorAll('.bk-grid-colgrip,.bk-grid-rowgrip').forEach(el=>el.remove());
  const table=wrap.querySelector('table.bk-grid'); if(!table) return;
  // Position grips from getBoundingClientRect (the browser's actual rendered pixels,
  // scaled by the UI-scale CSS zoom), not offsetLeft/offsetWidth (unscaled local
  // layout values) — offsetLeft math drifts from the true rendered border-collapse
  // boundary at non-integer zoom ratios (e.g. 120%/135%), throwing grips off by a
  // few px. Every other resize handler in the app follows this same rect/z pattern.
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  const wrapR=wrap.getBoundingClientRect();
  const tblR=table.getBoundingClientRect();
  const tblH=tblR.height/z, tblW=tblR.width/z;
  // Grip strips are absolutely positioned INSIDE the scrollable wrap, so:
  //  - add scrollLeft/scrollTop (rects are visual, abs-positioning is in content space);
  //  - clamp each strip fully inside the wrap's content box. An overhanging strip
  //    silently makes the wrap scrollable by a few px in BOTH axes (overflow-x:auto
  //    forces overflow-y:auto too), and any accidental micro-scroll then clips grips
  //    out of view or shifts them off the boundary. --line-x/--line-y keep the visible
  //    line exactly on the boundary even when the strip itself had to be clamped.
  const GRIP=13;
  const active=S._gridResize;
  // Lines are anchored to the table's VISIBLE area: below the (invisible) column-handle
  // strip and right of the (invisible) row-handle column — not the table's outer box.
  const dataRows=[...table.rows].filter(tr=>!tr.classList.contains('bk-grid-chrow'));
  const firstHandle=dataRows[0]&&dataRows[0].querySelector('.bk-grid-rhandle');
  const visTop=dataRows[0]?(dataRows[0].getBoundingClientRect().top-wrapR.top)/z+wrap.scrollTop:0;
  const visLeft=firstHandle?(firstHandle.getBoundingClientRect().right-wrapR.left)/z+wrap.scrollLeft:0;
  table.querySelectorAll(':scope > tbody > tr.bk-grid-chrow > td.bk-grid-chandle, :scope > tr.bk-grid-chrow > td.bk-grid-chandle').forEach((td,ci)=>{
    const g=document.createElement('div');
    g.className='bk-grid-colgrip'+(active&&active.id===id&&active.kind==='col'&&active.idx===ci?' rz-active':'');
    const bx=(td.getBoundingClientRect().right-wrapR.left)/z+wrap.scrollLeft;      // boundary x in wrap content space
    const left=Math.max(0,Math.min(bx-GRIP/2,wrap.clientWidth+wrap.scrollLeft-GRIP));
    g.style.left=left+'px'; g.style.top=visTop+'px'; g.style.height=(tblH-visTop)+'px';
    // The 3px line is clamped inside the wrap as well — even a 1px overhang past the
    // content box makes the wrap scrollable and re-introduces the micro-scroll bug.
    g.style.setProperty('--line-x',(Math.min(bx,wrap.clientWidth+wrap.scrollLeft-2)-left)+'px');
    g.title='Drag to resize column';
    g.addEventListener('mousedown',e=>gridColResizeStart(e,id,ci));
    wrap.appendChild(g);
  });
  dataRows.forEach((tr,ri)=>{
    const td=tr.querySelector('.bk-grid-rhandle'); if(!td) return;
    const g=document.createElement('div');
    g.className='bk-grid-rowgrip'+(active&&active.id===id&&active.kind==='row'&&active.idx===ri?' rz-active':'');
    const by=(td.getBoundingClientRect().bottom-wrapR.top)/z+wrap.scrollTop;       // boundary y in wrap content space
    const top=Math.max(0,Math.min(by-GRIP/2,wrap.clientHeight+wrap.scrollTop-GRIP));
    g.style.top=top+'px'; g.style.left=visLeft+'px';
    g.style.width=(Math.min(tblW,wrap.clientWidth+wrap.scrollLeft)-visLeft)+'px';
    g.style.setProperty('--line-y',(Math.min(by,wrap.clientHeight+wrap.scrollTop-2)-top)+'px');
    g.title='Drag to resize row';
    g.addEventListener('mousedown',e=>gridRowResizeStart(e,id,ri));
    wrap.appendChild(g);
  });
  if(!wrap._gridRO){
    wrap._gridRO=new ResizeObserver(()=>gridSyncGrips(id));
    wrap._gridRO.observe(table);
    // Column widths can redistribute while the table's outer box stays the same size
    // (auto layout reflowing as you type), which the table observer can't see.
    table.querySelectorAll(':scope .bk-grid-chrow .bk-grid-chandle').forEach(td=>wrap._gridRO.observe(td));
    // A genuinely wide table scrolls horizontally — grips must follow the content.
    wrap.addEventListener('scroll',()=>gridSyncGrips(id),{passive:true});
  }
}
function gridColResizeStart(e,id,ci){
  e.preventDefault(); e.stopPropagation();
  const b=findBlock(id); if(!b||!b.grid) return;
  const wrap=document.querySelector(`.bk-row[data-id="${id}"] .bk-grid-wrap`); if(!wrap) return;
  const table=wrap.querySelector('table.bk-grid'); if(!table) return;
  const cols=table.querySelectorAll('colgroup col');
  const chandles=table.querySelectorAll('.bk-grid-chrow .bk-grid-chandle');
  const col=cols[ci+1]; if(!col||!chandles[ci]) return;
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  // Freeze every column's CURRENT (auto-layout) width before switching to fixed
  // layout — otherwise the browser redistributes every un-pinned column equally
  // the instant fixed layout kicks in, snapping other boundaries out of place.
  // Measured via getBoundingClientRect/z (matches gridSyncGrips) rather than
  // offsetWidth so the frozen width matches what's actually rendered on screen.
  const widths=[...chandles].map(td=>Math.round(td.getBoundingClientRect().width/z));
  cols.forEach((c,i)=>{ if(i>0&&widths[i-1]) c.style.width=widths[i-1]+'px'; });
  table.classList.add('bk-grid-fixed');
  const startX=e.clientX/z, startW=widths[ci];
  S._gridResize={id,kind:'col',idx:ci};
  document.body.classList.add('bk-grid-resizing');
  const prevCursor=document.body.style.cursor; document.body.style.cursor='col-resize';
  const move=ev=>{
    const w=Math.max(40,Math.round(startW+(ev.clientX/z-startX)));
    col.style.width=w+'px';
  };
  const up=()=>{
    document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up);
    document.body.classList.remove('bk-grid-resizing'); document.body.style.cursor=prevCursor; S._gridResize=null;
    // Persist every column's frozen width, not just the one dragged — otherwise the
    // next render only pins one column and the equal-split jump comes back.
    b.grid.colW=[...cols].slice(1).map(c=>parseInt(c.style.width)||null);
    sched(); gridSyncGrips(id);
  };
  document.addEventListener('mousemove',move); document.addEventListener('mouseup',up);
}
function gridRowResizeStart(e,id,ri){
  e.preventDefault(); e.stopPropagation();
  const b=findBlock(id); if(!b||!b.grid) return;
  const wrap=document.querySelector(`.bk-row[data-id="${id}"] .bk-grid-wrap`); if(!wrap) return;
  const table=wrap.querySelector('table.bk-grid'); if(!table) return;
  const dataRows=[...table.rows].filter(tr=>!tr.classList.contains('bk-grid-chrow'));
  const tr=dataRows[ri]; if(!tr) return;
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  const startY=e.clientY/z, startH=Math.round(tr.getBoundingClientRect().height/z);
  S._gridResize={id,kind:'row',idx:ri};
  document.body.classList.add('bk-grid-resizing');
  const prevCursor=document.body.style.cursor; document.body.style.cursor='row-resize';
  const move=ev=>{
    const h=Math.max(28,Math.round(startH+(ev.clientY/z-startY)));
    tr.style.height=h+'px';
  };
  const up=()=>{
    document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up);
    document.body.classList.remove('bk-grid-resizing'); document.body.style.cursor=prevCursor; S._gridResize=null;
    b.grid.rowH=b.grid.rowH||[]; b.grid.rowH[ri]=parseInt(tr.style.height)||null;
    sched(); gridSyncGrips(id);
  };
  document.addEventListener('mousemove',move); document.addEventListener('mouseup',up);
}
let _gridColDrag=null,_gridRowDrag=null;
function gridColDragStart(e,id,ci){_gridColDrag={id,ci};try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','c');}catch(_){}e.stopPropagation();}
function gridColDragOver(e){if(!_gridColDrag)return;e.preventDefault();e.stopPropagation();e.currentTarget.classList.add('bk-grid-col-drop');}
function gridColDragLeave(e){e.currentTarget.classList.remove('bk-grid-col-drop');}
function gridColDrop(e,id,ci){e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('bk-grid-col-drop');if(!_gridColDrag)return;const b=findBlock(id);if(b&&b.grid&&_gridColDrag.ci!==ci){b.grid.rows.forEach(r=>{const[c]=r.splice(_gridColDrag.ci,1);r.splice(ci,0,c);});if(b.grid.colW){const[w]=b.grid.colW.splice(_gridColDrag.ci,1);b.grid.colW.splice(ci,0,w);}}_gridColDrag=null;reRenderBlock(id);sched();}
function gridRowDragStart(e,id,ri){_gridRowDrag={id,ri};try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','r');}catch(_){}e.stopPropagation();}
function gridRowDragOver(e){if(!_gridRowDrag)return;e.preventDefault();e.stopPropagation();e.currentTarget.classList.add('bk-grid-row-drop');}
function gridRowDragLeave(e){e.currentTarget.classList.remove('bk-grid-row-drop');}
function gridRowDrop(e,id,ri){e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('bk-grid-row-drop');if(!_gridRowDrag)return;const b=findBlock(id);if(b&&b.grid&&_gridRowDrag.ri!==ri){const[r]=b.grid.rows.splice(_gridRowDrag.ri,1);b.grid.rows.splice(ri,0,r);if(b.grid.rowH){const[h]=b.grid.rowH.splice(_gridRowDrag.ri,1);b.grid.rowH.splice(ri,0,h);}}_gridRowDrag=null;reRenderBlock(id);sched();}
function gridDragEnd(){_gridColDrag=null;_gridRowDrag=null;document.querySelectorAll('.bk-grid-col-drop,.bk-grid-row-drop').forEach(t=>t.classList.remove('bk-grid-col-drop','bk-grid-row-drop'));}
/* Older grid cells were stored as plain text; new ones store HTML (so mentions persist) */
function gridCellHtml(c){ c=c||''; return /<(a|img|span)\b/.test(c)?c:escHtml(c); }
function gridSet(id,r,c,val){const b=findBlock(id);if(!b||!b.grid||!b.grid.rows[r])return;b.grid.rows[r][c]=val;sched()}
/* Enter → drop to the cell below in the same column (like a spreadsheet) instead of
   inserting a newline. Shift+Enter still adds a line break within the cell. Tab keeps
   its native behaviour (moves to the next cell). */
function gridCellKey(e,td){
  if(e.key!=='Enter'||e.shiftKey) return;
  e.preventDefault();
  const tr=td.parentElement; const idx=[...tr.children].indexOf(td);
  let row=tr;
  while(row=row.nextElementSibling){
    const next=row.children[idx];
    if(next&&next.isContentEditable){ next.focus(); if(typeof putCursorEnd==='function') putCursorEnd(next); return; }
  }
}
/* Paste a URL into a grid cell → formatted mention */
function onGridPaste(e,td){
  const text=e.clipboardData.getData('text/plain');
  e.preventDefault();
  if(isUrl(text)){
    const mid='m_'+uuid(); const url=normUrl(text);
    document.execCommand('insertHTML',false,mentionHtml(quickMeta(text),mid)+' ');
    fetchLinkMeta(url).then(m=>{mentionCache.set(url,m);const node=td.querySelector(`.mention[data-mid="${mid}"]`);if(node){node.outerHTML=mentionHtml(m,mid);td.dispatchEvent(new Event('input',{bubbles:true}));}});
  } else { document.execCommand('insertText',false,text); }
  td.dispatchEvent(new Event('input',{bubbles:true}));
}
function gridToggleHeader(id){const b=findBlock(id);if(!b||!b.grid)return;b.grid.header=!b.grid.header;reRenderBlock(id);sched()}
function gridAddRow(id){const b=findBlock(id);if(!b||!b.grid)return;const n=b.grid.rows[0]?b.grid.rows[0].length:1;b.grid.rows.push(new Array(n).fill(''));reRenderBlock(id);sched()}
function gridAddCol(id){const b=findBlock(id);if(!b||!b.grid)return;b.grid.rows.forEach(r=>r.push(''));reRenderBlock(id);sched()}
function gridDelRow(id){const b=findBlock(id);if(!b||!b.grid||b.grid.rows.length<=1)return;b.grid.rows.pop();if(b.grid.rowH)b.grid.rowH.pop();reRenderBlock(id);sched()}
function gridDelCol(id){const b=findBlock(id);if(!b||!b.grid||(b.grid.rows[0]&&b.grid.rows[0].length<=1))return;b.grid.rows.forEach(r=>r.pop());if(b.grid.colW)b.grid.colW.pop();reRenderBlock(id);sched()}
/* ── Per-row / per-column edit: click a handle for an insert/delete menu ── */
function gridDelRowAt(id,ri){const b=findBlock(id);if(!b||!b.grid||b.grid.rows.length<=1)return;b.grid.rows.splice(ri,1);if(b.grid.rowH)b.grid.rowH.splice(ri,1);reRenderBlock(id);sched()}
function gridDelColAt(id,ci){const b=findBlock(id);if(!b||!b.grid||(b.grid.rows[0]&&b.grid.rows[0].length<=1))return;b.grid.rows.forEach(r=>r.splice(ci,1));if(b.grid.colW)b.grid.colW.splice(ci,1);reRenderBlock(id);sched()}
function gridInsRowAt(id,ri,side){const b=findBlock(id);if(!b||!b.grid)return;const n=b.grid.rows[0]?b.grid.rows[0].length:1;const at=side==='after'?ri+1:ri;b.grid.rows.splice(at,0,new Array(n).fill(''));if(b.grid.rowH)b.grid.rowH.splice(at,0,null);reRenderBlock(id);sched()}
function gridInsColAt(id,ci,side){const b=findBlock(id);if(!b||!b.grid)return;const at=side==='after'?ci+1:ci;b.grid.rows.forEach(r=>r.splice(at,0,''));if(b.grid.colW)b.grid.colW.splice(at,0,null);reRenderBlock(id);sched()}
function gridCloseMenu(){const m=document.getElementById('grid-handle-menu');if(m)m.style.display='none';document.removeEventListener('mousedown',_gridMenuOutside);}
function _gridMenuOutside(ev){const m=document.getElementById('grid-handle-menu');if(m&&!m.contains(ev.target))gridCloseMenu();}
function gridHandleMenu(e,id,kind,idx){
  e.stopPropagation(); e.preventDefault();
  let m=document.getElementById('grid-handle-menu');
  if(!m){ m=document.createElement('div'); m.id='grid-handle-menu'; m.className='grid-hmenu'; document.body.appendChild(m); }
  const col=kind==='col';
  m.innerHTML=`
    <div class="ghm-it" onclick="grid${col?'InsColAt':'InsRowAt'}('${id}',${idx},'before');gridCloseMenu()">↤ Insert ${col?'left':'above'}</div>
    <div class="ghm-it" onclick="grid${col?'InsColAt':'InsRowAt'}('${id}',${idx},'after');gridCloseMenu()">↦ Insert ${col?'right':'below'}</div>
    <div class="ghm-it ghm-danger" onclick="grid${col?'DelColAt':'DelRowAt'}('${id}',${idx});gridCloseMenu()"><svg class="lic" viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-2px;margin-right:5px"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>Delete ${col?'column':'row'}</div>`;
  const r=e.currentTarget.getBoundingClientRect();
  m.style.display='block';
  m.style.left=Math.min(r.left,window.innerWidth-160)+'px';
  m.style.top=(r.bottom+4)+'px';
  setTimeout(()=>document.addEventListener('mousedown',_gridMenuOutside),0);
}

