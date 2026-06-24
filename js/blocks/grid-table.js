/* ═══════════════════════════════════════════════
   #7 SIMPLE TABLE (grid) BLOCK
═══════════════════════════════════════════════ */
function defaultGrid(){return {header:true, rows:[['Column 1','Column 2','Column 3'],['','',''],['','','']]}}
function mkGridHtml(blk){
  const g=blk.grid||defaultGrid();
  const ncol=g.rows[0]?g.rows[0].length:0;
  const colRow=`<tr class="bk-grid-chrow"><td class="bk-grid-corner"></td>${Array.from({length:ncol},(_,ci)=>`<td class="bk-grid-chandle" draggable="true" onclick="gridHandleMenu(event,'${blk.id}','col',${ci})" ondragstart="gridColDragStart(event,'${blk.id}',${ci})" ondragover="gridColDragOver(event)" ondragleave="gridColDragLeave(event)" ondrop="gridColDrop(event,'${blk.id}',${ci})" ondragend="gridDragEnd()" title="Click for options · drag to move">⠿</td>`).join('')}</tr>`;
  const rowsH=g.rows.map((r,ri)=>`<tr class="${g.header&&ri===0?'bk-grid-hdr':''}" ondragover="gridRowDragOver(event)" ondragleave="gridRowDragLeave(event)" ondrop="gridRowDrop(event,'${blk.id}',${ri})"><td class="bk-grid-rhandle" draggable="true" onclick="gridHandleMenu(event,'${blk.id}','row',${ri})" ondragstart="gridRowDragStart(event,'${blk.id}',${ri})" ondragend="gridDragEnd()" title="Click for options · drag to move">⠿</td>`+r.map((c,ci)=>`<td contenteditable="true" onpaste="onGridPaste(event,this)" oninput="gridSet('${blk.id}',${ri},${ci},this.innerHTML)">${gridCellHtml(c)}</td>`).join('')+'</tr>').join('');
  return `<div class="bk-grid-wrap"><table class="bk-grid${g.header?' has-header':''}">${colRow}${rowsH}</table></div>`;
}
let _gridColDrag=null,_gridRowDrag=null;
function gridColDragStart(e,id,ci){_gridColDrag={id,ci};try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','c');}catch(_){}e.stopPropagation();}
function gridColDragOver(e){if(!_gridColDrag)return;e.preventDefault();e.stopPropagation();e.currentTarget.classList.add('bk-grid-col-drop');}
function gridColDragLeave(e){e.currentTarget.classList.remove('bk-grid-col-drop');}
function gridColDrop(e,id,ci){e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('bk-grid-col-drop');if(!_gridColDrag)return;const b=findBlock(id);if(b&&b.grid&&_gridColDrag.ci!==ci){b.grid.rows.forEach(r=>{const[c]=r.splice(_gridColDrag.ci,1);r.splice(ci,0,c);});}_gridColDrag=null;reRenderBlock(id);sched();}
function gridRowDragStart(e,id,ri){_gridRowDrag={id,ri};try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','r');}catch(_){}e.stopPropagation();}
function gridRowDragOver(e){if(!_gridRowDrag)return;e.preventDefault();e.stopPropagation();e.currentTarget.classList.add('bk-grid-row-drop');}
function gridRowDragLeave(e){e.currentTarget.classList.remove('bk-grid-row-drop');}
function gridRowDrop(e,id,ri){e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove('bk-grid-row-drop');if(!_gridRowDrag)return;const b=findBlock(id);if(b&&b.grid&&_gridRowDrag.ri!==ri){const[r]=b.grid.rows.splice(_gridRowDrag.ri,1);b.grid.rows.splice(ri,0,r);}_gridRowDrag=null;reRenderBlock(id);sched();}
function gridDragEnd(){_gridColDrag=null;_gridRowDrag=null;document.querySelectorAll('.bk-grid-col-drop,.bk-grid-row-drop').forEach(t=>t.classList.remove('bk-grid-col-drop','bk-grid-row-drop'));}
/* Older grid cells were stored as plain text; new ones store HTML (so mentions persist) */
function gridCellHtml(c){ c=c||''; return /<(a|img|span)\b/.test(c)?c:escHtml(c); }
function gridSet(id,r,c,val){const b=findBlock(id);if(!b||!b.grid||!b.grid.rows[r])return;b.grid.rows[r][c]=val;sched()}
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
function gridDelRow(id){const b=findBlock(id);if(!b||!b.grid||b.grid.rows.length<=1)return;b.grid.rows.pop();reRenderBlock(id);sched()}
function gridDelCol(id){const b=findBlock(id);if(!b||!b.grid||(b.grid.rows[0]&&b.grid.rows[0].length<=1))return;b.grid.rows.forEach(r=>r.pop());reRenderBlock(id);sched()}
/* ── Per-row / per-column edit: click a handle for an insert/delete menu ── */
function gridDelRowAt(id,ri){const b=findBlock(id);if(!b||!b.grid||b.grid.rows.length<=1)return;b.grid.rows.splice(ri,1);reRenderBlock(id);sched()}
function gridDelColAt(id,ci){const b=findBlock(id);if(!b||!b.grid||(b.grid.rows[0]&&b.grid.rows[0].length<=1))return;b.grid.rows.forEach(r=>r.splice(ci,1));reRenderBlock(id);sched()}
function gridInsRowAt(id,ri,side){const b=findBlock(id);if(!b||!b.grid)return;const n=b.grid.rows[0]?b.grid.rows[0].length:1;b.grid.rows.splice(side==='after'?ri+1:ri,0,new Array(n).fill(''));reRenderBlock(id);sched()}
function gridInsColAt(id,ci,side){const b=findBlock(id);if(!b||!b.grid)return;const at=side==='after'?ci+1:ci;b.grid.rows.forEach(r=>r.splice(at,0,''));reRenderBlock(id);sched()}
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

