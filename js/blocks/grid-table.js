/* ═══════════════════════════════════════════════
   #7 SIMPLE TABLE (grid) BLOCK
═══════════════════════════════════════════════ */
function defaultGrid(){return {header:true, rows:[['Column 1','Column 2','Column 3'],['','',''],['','','']]}}
const GRID_HANDLE_W=16, GRID_DEF_COLW=120, GRID_MIN_COLW=40;
/* Row/column tint palette — fixed hues washed to 16% so they read on light and
   dark themes alike (matches the --acs accent-tint recipe in applyCfg). */
const GRID_COLORS={rose:'#E06C88',gold:'#D9A441',lime:'#7DC26A',teal:'#4DB8A8',blue:'#4D88E8',purple:'#8B7BD8',gray:'#8A8A8A'};
function gridTint(k){const c=GRID_COLORS[k];return c?`color-mix(in srgb, ${c} 16%, transparent)`:''}
function mkGridHtml(blk){
  const g=blk.grid||defaultGrid();
  const ncol=g.rows[0]?g.rows[0].length:0;
  const colW=g.colW||[];
  const fixed=colW.some(w=>w);
  // Notion model: an untouched table spans the page (auto layout); once any column
  // has been resized the table's width IS the sum of its column widths — shrinking
  // a column shrinks the whole table instead of inflating its siblings.
  const wsum=fixed?Array.from({length:ncol},(_,ci)=>colW[ci]||GRID_DEF_COLW).reduce((s,w)=>s+w,0)+GRID_HANDLE_W:0;
  const colBg=g.colBg||[], rowBg=g.rowBg||[], colAlign=g.colAlign||[];
  const colgroup=`<colgroup><col style="width:${GRID_HANDLE_W}px">${Array.from({length:ncol},(_,ci)=>{
    const st=[fixed?`width:${colW[ci]||GRID_DEF_COLW}px`:'',colBg[ci]?`background:${gridTint(colBg[ci])}`:''].filter(Boolean).join(';');
    return `<col${st?` style="${st}"`:''}>`;
  }).join('')}</colgroup>`;
  const colRow=`<tr class="bk-grid-chrow"><td class="bk-grid-corner"></td>${Array.from({length:ncol},(_,ci)=>`<td class="bk-grid-chandle" draggable="true" onclick="gridHandleMenu(event,'${blk.id}','col',${ci})" ondragstart="gridColDragStart(event,'${blk.id}',${ci})" ondragover="gridColDragOver(event)" ondragleave="gridColDragLeave(event)" ondrop="gridColDrop(event,'${blk.id}',${ci})" ondragend="gridDragEnd()" title="Click for options · drag to move">⠿</td>`).join('')}</tr>`;
  const rowsH=g.rows.map((r,ri)=>{
    const rh=g.rowH&&g.rowH[ri]?` style="height:${g.rowH[ri]}px"`:'';
    return `<tr${rh} class="${g.header&&ri===0?'bk-grid-hdr':''}" ondragover="gridRowDragOver(event)" ondragleave="gridRowDragLeave(event)" ondrop="gridRowDrop(event,'${blk.id}',${ri})"><td class="bk-grid-rhandle" draggable="true" onclick="gridHandleMenu(event,'${blk.id}','row',${ri})" ondragstart="gridRowDragStart(event,'${blk.id}',${ri})" ondragend="gridDragEnd()" title="Click for options · drag to move">⠿</td>`+r.map((c,ci)=>{
      // Row tint goes on the td (inline wins over the header-row CSS); col tint on
      // <col> shows wherever tds stay transparent → natural row-over-column priority.
      const st=[rowBg[ri]?`background:${gridTint(rowBg[ri])}`:'',colAlign[ci]?`text-align:${colAlign[ci]}`:''].filter(Boolean).join(';');
      return `<td${st?` style="${st}"`:''} contenteditable="true" onkeydown="gridCellKey(event,this)" onpaste="onGridPaste(event,this)" oninput="gridSet('${blk.id}',${ri},${ci},this.innerHTML)" onfocus="gridCellFocus(this,'${blk.id}',${ri},${ci})" onblur="gridCellBlur(this,'${blk.id}',${ri},${ci})">${gridCellDisplay(g,ri,ci)}</td>`;
    }).join('')+'</tr>';
  }).join('');
  return `<div class="bk-grid-outer"><div class="bk-grid-wrap"><table class="bk-grid${g.header?' has-header':''}${g.headerCol?' has-hcol':''}${fixed?' bk-grid-fixed':''}"${fixed?` style="width:${wsum}px"`:''}>${colgroup}${colRow}${rowsH}</table></div><div class="bk-grid-addcol" onclick="gridAddCol('${blk.id}')" title="Add column">+</div><div class="bk-grid-addrow" onclick="gridAddRow('${blk.id}')" title="Add row">+</div></div>`;
}
/* ═══ FORMULAS ═══
   A cell whose text starts with "=" is a formula: cell refs (A1 = first column,
   first row — the header row counts as row 1), ranges (A2:A5), SUM/AVG/MIN/MAX/
   COUNT, and + - * / ( ). The raw formula stays in the data model; the rendered
   cell shows the computed value and reveals the formula while being edited. */
function gridRawText(v){const d=document.createElement('div');d.innerHTML=v||'';return (d.textContent||'').trim()}
function gridIsFx(v){return gridRawText(v)[0]==='='}
function gridFmtNum(n){ if(!isFinite(n))return '#ERR'; const r=Math.round(n*1e6)/1e6; return String(r) }
function gridEvalCell(g,ri,ci,stack){
  const row=g.rows[ri]; if(!row||row[ci]==null) return '';
  const raw=gridRawText(row[ci]);
  if(raw[0]!=='=') return raw;
  const key=ri+','+ci;
  if(stack.has(key)) throw {cycle:true};
  stack.add(key);
  try{ return gridFmtNum(gridEvalFormula(g,raw.slice(1),stack)); }
  finally{ stack.delete(key); }
}
function gridCellValue(g,ri,ci){ try{ return gridEvalCell(g,ri,ci,new Set()); }catch(e){ return e&&e.cycle?'#CYCLE':'#ERR'; } }
function gridEvalFormula(g,s,stack){
  let i=0;
  const ws=()=>{while(i<s.length&&s[i]===' ')i++};
  const num=v=>{const n=parseFloat(v);return isNaN(n)?0:n};
  function refAt(){ const m=/^([A-Za-z]+)([0-9]+)/.exec(s.slice(i)); if(!m) return null;
    const ci=[...m[1].toUpperCase()].reduce((a,ch)=>a*26+ch.charCodeAt(0)-64,0)-1, ri=parseInt(m[2],10)-1;
    return {len:m[0].length,ri,ci};
  }
  function rangeVals(a,b){ const out=[];
    for(let r=Math.min(a.ri,b.ri);r<=Math.max(a.ri,b.ri);r++)
      for(let c=Math.min(a.ci,b.ci);c<=Math.max(a.ci,b.ci);c++){
        const v=parseFloat(gridEvalCell(g,r,c,stack)); if(!isNaN(v)) out.push(v);
      }
    return out;
  }
  function parseArgs(){ // list of numbers; a range contributes all its numeric cells
    const vals=[]; ws(); if(s[i]===')') return vals;
    for(;;){ ws();
      const r1=refAt();
      if(r1){ const save=i; i+=r1.len; ws();
        if(s[i]===':'){ i++; ws(); const r2=refAt(); if(!r2) throw 0; i+=r2.len; vals.push(...rangeVals(r1,r2)); }
        else { i=save; vals.push(parseExpr()); }
      } else vals.push(parseExpr());
      ws(); if(s[i]===','){ i++; continue; } break;
    }
    return vals;
  }
  function parseFactor(){ ws();
    if(s[i]==='-'){ i++; return -parseFactor(); }
    if(s[i]==='('){ i++; const v=parseExpr(); ws(); if(s[i]!==')') throw 0; i++; return v; }
    const fm=/^([A-Za-z]+)\(/.exec(s.slice(i));
    if(fm){ const fn=fm[1].toUpperCase(); i+=fm[0].length;
      const a=parseArgs(); ws(); if(s[i]!==')') throw 0; i++;
      switch(fn){
        case 'SUM': return a.reduce((x,y)=>x+y,0);
        case 'AVG': case 'AVERAGE': return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
        case 'MIN': return a.length?Math.min(...a):0;
        case 'MAX': return a.length?Math.max(...a):0;
        case 'COUNT': return a.length;
        default: throw 0;
      }
    }
    const r=refAt();
    if(r){ i+=r.len; return num(gridEvalCell(g,r.ri,r.ci,stack)); }
    const nm=/^[0-9]*\.?[0-9]+/.exec(s.slice(i));
    if(nm){ i+=nm[0].length; return parseFloat(nm[0]); }
    throw 0;
  }
  function parseTerm(){ let v=parseFactor(); ws();
    while(s[i]==='*'||s[i]==='/'){ const op=s[i++]; const r=parseFactor(); v=op==='*'?v*r:v/r; ws(); }
    return v;
  }
  function parseExpr(){ let v=parseTerm(); ws();
    while(s[i]==='+'||s[i]==='-'){ const op=s[i++]; const r=parseTerm(); v=op==='+'?v+r:v-r; ws(); }
    return v;
  }
  const v=parseExpr(); ws(); if(i<s.length) throw 0;
  return v;
}
function gridCellDisplay(g,ri,ci){
  const c=g.rows[ri][ci];
  if(!gridIsFx(c)) return gridCellHtml(c);
  const raw=gridRawText(c);
  return `<span class="bk-grid-fx" title="${escHtml(raw)}">${escHtml(gridCellValue(g,ri,ci))}</span>`;
}
/* Editing a formula cell: reveal the raw formula on focus, show the computed
   value again on blur, and keep every other formula cell's display fresh. */
function gridCellFocus(td,id,ri,ci){
  const b=findBlock(id); if(!b||!b.grid) return;
  const raw=gridRawText(b.grid.rows[ri][ci]);
  if(raw[0]==='='){ td.textContent=raw; if(typeof putCursorEnd==='function') putCursorEnd(td); }
}
function gridCellBlur(td,id,ri,ci){
  const b=findBlock(id); if(!b||!b.grid||!b.grid.rows[ri]) return;
  if(gridIsFx(b.grid.rows[ri][ci])) td.innerHTML=gridCellDisplay(b.grid,ri,ci);
  gridRefreshFormulas(id);
}
function gridRefreshFormulas(id){
  const b=findBlock(id); if(!b||!b.grid) return;
  const rowEl=document.querySelector(`.bk-row[data-id="${id}"]`); if(!rowEl) return;
  const trs=[...rowEl.querySelectorAll('table.bk-grid tr')].filter(tr=>!tr.classList.contains('bk-grid-chrow'));
  trs.forEach((tr,ri)=>{
    [...tr.children].filter(td=>!td.classList.contains('bk-grid-rhandle')).forEach((td,ci)=>{
      if(td===document.activeElement) return;                 // don't clobber an edit in progress
      if(b.grid.rows[ri]&&gridIsFx(b.grid.rows[ri][ci])) td.innerHTML=gridCellDisplay(b.grid,ri,ci);
    });
  });
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
  // "+" add strips (Notion-style) live in the outer div — OUTSIDE the scrollable
  // wrap, so overhanging the table edge can never make the wrap scrollable.
  const outer=wrap.parentElement;
  if(outer&&outer.classList.contains('bk-grid-outer')){
    const addCol=outer.querySelector(':scope > .bk-grid-addcol');
    const addRow=outer.querySelector(':scope > .bk-grid-addrow');
    // Outer doesn't scroll → its coordinates are the wrap-relative VISUAL rects
    // (no scrollLeft/scrollTop compensation, unlike the grips above).
    const oRight=Math.min((tblR.right-wrapR.left)/z,wrap.clientWidth);
    const oTop=visTop-wrap.scrollTop, oLeft=visLeft-wrap.scrollLeft;
    const oBottom=(tblR.bottom-wrapR.top)/z;
    if(addCol){ addCol.style.left=oRight+'px'; addCol.style.top=oTop+'px'; addCol.style.height=(oBottom-oTop)+'px'; }
    if(addRow){ addRow.style.top=oBottom+'px'; addRow.style.left=oLeft+'px'; addRow.style.width=(oRight-oLeft)+'px'; }
  }
  if(!wrap._gridRO){
    wrap._gridRO=new ResizeObserver(()=>gridSyncGrips(id));
    wrap._gridRO.observe(table);
    // Column widths can redistribute while the table's outer box stays the same size
    // (auto layout reflowing as you type), which the table observer can't see.
    table.querySelectorAll(':scope .bk-grid-chrow .bk-grid-chandle').forEach(td=>wrap._gridRO.observe(td));
  }
}
/* A genuinely wide table scrolls horizontally — grips must follow the content.
   One delegated capture-phase listener (scroll doesn't bubble but does capture)
   instead of per-wrap listeners, which get lost when a re-render swaps the wrap. */
document.addEventListener('scroll',e=>{
  const w=e.target;
  if(!(w instanceof Element)||!w.classList.contains('bk-grid-wrap')) return;
  const row=w.closest('.bk-row');
  if(row) gridSyncGrips(row.dataset.id);
},true);
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
  // Table width = sum of column widths (Notion model): kept in lockstep with the
  // dragged column so shrinking a column shrinks the table itself, live.
  const tableW=()=>widths.reduce((s,w)=>s+w,0)+GRID_HANDLE_W;
  table.style.width=tableW()+'px';
  const startX=e.clientX/z, startW=widths[ci];
  S._gridResize={id,kind:'col',idx:ci};
  document.body.classList.add('bk-grid-resizing');
  const prevCursor=document.body.style.cursor; document.body.style.cursor='col-resize';
  const move=ev=>{
    const w=Math.max(GRID_MIN_COLW,Math.round(startW+(ev.clientX/z-startX)));
    widths[ci]=w; col.style.width=w+'px'; table.style.width=tableW()+'px';
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
function gridColDrop(e,id,ci){e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('bk-grid-col-drop');if(!_gridColDrag)return;const b=findBlock(id);if(b&&b.grid&&_gridColDrag.ci!==ci){b.grid.rows.forEach(r=>{const[c]=r.splice(_gridColDrag.ci,1);r.splice(ci,0,c);});_gridColArrs(b.grid).forEach(a=>{while(a.length<b.grid.rows[0].length)a.push(null);const[v]=a.splice(_gridColDrag.ci,1);a.splice(ci,0,v);});}_gridColDrag=null;reRenderBlock(id);sched();}
function gridRowDragStart(e,id,ri){_gridRowDrag={id,ri};try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','r');}catch(_){}e.stopPropagation();}
function gridRowDragOver(e){if(!_gridRowDrag)return;e.preventDefault();e.stopPropagation();e.currentTarget.classList.add('bk-grid-row-drop');}
function gridRowDragLeave(e){e.currentTarget.classList.remove('bk-grid-row-drop');}
function gridRowDrop(e,id,ri){e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('bk-grid-row-drop');if(!_gridRowDrag)return;const b=findBlock(id);if(b&&b.grid&&_gridRowDrag.ri!==ri){const[r]=b.grid.rows.splice(_gridRowDrag.ri,1);b.grid.rows.splice(ri,0,r);_gridRowArrs(b.grid).forEach(a=>{while(a.length<b.grid.rows.length)a.push(null);const[v]=a.splice(_gridRowDrag.ri,1);a.splice(ri,0,v);});}_gridRowDrag=null;reRenderBlock(id);sched();}
function gridDragEnd(){_gridColDrag=null;_gridRowDrag=null;document.querySelectorAll('.bk-grid-col-drop,.bk-grid-row-drop').forEach(t=>t.classList.remove('bk-grid-col-drop','bk-grid-row-drop'));}
/* Older grid cells were stored as plain text; new ones store HTML (so mentions persist) */
function gridCellHtml(c){ c=c||''; return /<(a|img|span)\b/.test(c)?c:escHtml(c); }
function gridSet(id,r,c,val){const b=findBlock(id);if(!b||!b.grid||!b.grid.rows[r])return;b.grid.rows[r][c]=val;gridRefreshFormulas(id);sched()}
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
function gridToggleHeaderCol(id){const b=findBlock(id);if(!b||!b.grid)return;b.grid.headerCol=!b.grid.headerCol;reRenderBlock(id);sched()}
function gridSetRowBg(id,ri,k){const b=findBlock(id);if(!b||!b.grid)return;b.grid.rowBg=b.grid.rowBg||[];b.grid.rowBg[ri]=k||null;reRenderBlock(id);sched()}
function gridSetColBg(id,ci,k){const b=findBlock(id);if(!b||!b.grid)return;b.grid.colBg=b.grid.colBg||[];b.grid.colBg[ci]=k||null;reRenderBlock(id);sched()}
function gridSetColAlign(id,ci,a){const b=findBlock(id);if(!b||!b.grid)return;b.grid.colAlign=b.grid.colAlign||[];b.grid.colAlign[ci]=a||null;reRenderBlock(id);sched()}
/* Keep every per-row / per-column companion array in step with a structural edit */
function _gridRowArrs(g){return ['rowH','rowBg'].map(k=>g[k]).filter(Boolean)}
function _gridColArrs(g){return ['colW','colBg','colAlign'].map(k=>g[k]).filter(Boolean)}
function gridAddRow(id){const b=findBlock(id);if(!b||!b.grid)return;const n=b.grid.rows[0]?b.grid.rows[0].length:1;b.grid.rows.push(new Array(n).fill(''));reRenderBlock(id);sched()}
function gridAddCol(id){const b=findBlock(id);if(!b||!b.grid)return;b.grid.rows.forEach(r=>r.push(''));if(b.grid.colW&&b.grid.colW.some(w=>w))b.grid.colW[b.grid.rows[0].length-1]=GRID_DEF_COLW;reRenderBlock(id);sched()}
function gridDelRow(id){const b=findBlock(id);if(!b||!b.grid||b.grid.rows.length<=1)return;const at=b.grid.rows.length-1;b.grid.rows.pop();_gridRowArrs(b.grid).forEach(a=>a.splice(at,1));reRenderBlock(id);sched()}
function gridDelCol(id){const b=findBlock(id);if(!b||!b.grid||(b.grid.rows[0]&&b.grid.rows[0].length<=1))return;const at=b.grid.rows[0].length-1;b.grid.rows.forEach(r=>r.pop());_gridColArrs(b.grid).forEach(a=>a.splice(at,1));reRenderBlock(id);sched()}
/* ── Per-row / per-column edit: click a handle for an insert/delete menu ── */
function gridDelRowAt(id,ri){const b=findBlock(id);if(!b||!b.grid||b.grid.rows.length<=1)return;b.grid.rows.splice(ri,1);_gridRowArrs(b.grid).forEach(a=>a.splice(ri,1));reRenderBlock(id);sched()}
function gridDelColAt(id,ci){const b=findBlock(id);if(!b||!b.grid||(b.grid.rows[0]&&b.grid.rows[0].length<=1))return;b.grid.rows.forEach(r=>r.splice(ci,1));_gridColArrs(b.grid).forEach(a=>a.splice(ci,1));reRenderBlock(id);sched()}
function gridInsRowAt(id,ri,side){const b=findBlock(id);if(!b||!b.grid)return;const n=b.grid.rows[0]?b.grid.rows[0].length:1;const at=side==='after'?ri+1:ri;b.grid.rows.splice(at,0,new Array(n).fill(''));_gridRowArrs(b.grid).forEach(a=>a.splice(at,0,null));reRenderBlock(id);sched()}
function gridInsColAt(id,ci,side){const b=findBlock(id);if(!b||!b.grid)return;const at=side==='after'?ci+1:ci;b.grid.rows.forEach(r=>r.splice(at,0,''));_gridColArrs(b.grid).forEach(a=>a.splice(at,0,a===b.grid.colW&&a.some(w=>w)?GRID_DEF_COLW:null));reRenderBlock(id);sched()}
function gridCloseMenu(){const m=document.getElementById('grid-handle-menu');if(m)m.style.display='none';document.removeEventListener('mousedown',_gridMenuOutside);}
function _gridMenuOutside(ev){const m=document.getElementById('grid-handle-menu');if(m&&!m.contains(ev.target))gridCloseMenu();}
function gridHandleMenu(e,id,kind,idx){
  e.stopPropagation(); e.preventDefault();
  let m=document.getElementById('grid-handle-menu');
  if(!m){ m=document.createElement('div'); m.id='grid-handle-menu'; m.className='grid-hmenu'; document.body.appendChild(m); }
  const col=kind==='col';
  const b=findBlock(id); const g=b&&b.grid||{};
  const cur=col?(g.colBg||[])[idx]:(g.rowBg||[])[idx];
  const swatches=Object.keys(GRID_COLORS).map(k=>
    `<span class="ghm-sw${cur===k?' on':''}" style="background:color-mix(in srgb, ${GRID_COLORS[k]} 55%, transparent)" title="${k[0].toUpperCase()+k.slice(1)}" onclick="gridSet${col?'ColBg':'RowBg'}('${id}',${idx},'${k}');gridCloseMenu()"></span>`).join('')
    +`<span class="ghm-sw ghm-sw-none${!cur?' on':''}" title="No color" onclick="gridSet${col?'ColBg':'RowBg'}('${id}',${idx},null);gridCloseMenu()">✕</span>`;
  const alnIco={left:[1,10],center:[3.5,12.5],right:[6,15]};
  const aln=a=>`<svg viewBox="0 0 16 16" width="13" height="13"><line x1="${alnIco[a][0]}" y1="4" x2="${alnIco[a][1]}" y2="4"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="${alnIco[a][0]}" y1="12" x2="${alnIco[a][1]}" y2="12"/></svg>`;
  const curAln=(g.colAlign||[])[idx]||'left';
  const alignRow=col?`<div class="ghm-row" title="Align text">
      <span class="ghm-aln${curAln==='left'?' on':''}" onclick="gridSetColAlign('${id}',${idx},null);gridCloseMenu()">${aln('left')}</span>
      <span class="ghm-aln${curAln==='center'?' on':''}" onclick="gridSetColAlign('${id}',${idx},'center');gridCloseMenu()">${aln('center')}</span>
      <span class="ghm-aln${curAln==='right'?' on':''}" onclick="gridSetColAlign('${id}',${idx},'right');gridCloseMenu()">${aln('right')}</span>
    </div>`:'';
  const headerIt=(col&&idx===0)?`<div class="ghm-it" onclick="gridToggleHeaderCol('${id}');gridCloseMenu()">${g.headerCol?'☑':'☐'} Header column</div>`
                :(!col&&idx===0)?`<div class="ghm-it" onclick="gridToggleHeader('${id}');gridCloseMenu()">${g.header?'☑':'☐'} Header row</div>`:'';
  m.innerHTML=`
    <div class="ghm-row ghm-swrow">${swatches}</div>${alignRow}
    <div class="ghm-sep"></div>
    <div class="ghm-it" onclick="grid${col?'InsColAt':'InsRowAt'}('${id}',${idx},'before');gridCloseMenu()">↤ Insert ${col?'left':'above'}</div>
    <div class="ghm-it" onclick="grid${col?'InsColAt':'InsRowAt'}('${id}',${idx},'after');gridCloseMenu()">↦ Insert ${col?'right':'below'}</div>
    ${headerIt}
    <div class="ghm-it ghm-danger" onclick="grid${col?'DelColAt':'DelRowAt'}('${id}',${idx});gridCloseMenu()"><svg class="lic" viewBox="0 0 24 24" width="13" height="13" style="vertical-align:-2px;margin-right:5px"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>Delete ${col?'column':'row'}</div>`;
  const r=e.currentTarget.getBoundingClientRect();
  m.style.display='block';
  m.style.left=Math.min(r.left,window.innerWidth-160)+'px';
  m.style.top=(r.bottom+4)+'px';
  setTimeout(()=>document.addEventListener('mousedown',_gridMenuOutside),0);
}

