/* ═══════════════════════════════════════════════
   #7 SIMPLE TABLE (grid) BLOCK
═══════════════════════════════════════════════ */
function defaultGrid(){return {header:true, rows:[['Column 1','Column 2','Column 3'],['','',''],['','','']]}}
function mkGridHtml(blk){
  const g=blk.grid||defaultGrid();
  const ncol=g.rows[0]?g.rows[0].length:0;
  const colRow=`<tr class="bk-grid-chrow"><td class="bk-grid-corner"></td>${Array.from({length:ncol},(_,ci)=>`<td class="bk-grid-chandle" draggable="true" ondragstart="gridColDragStart(event,'${blk.id}',${ci})" ondragover="gridColDragOver(event)" ondragleave="gridColDragLeave(event)" ondrop="gridColDrop(event,'${blk.id}',${ci})" ondragend="gridDragEnd()" title="Drag to move column">⠿</td>`).join('')}</tr>`;
  const rowsH=g.rows.map((r,ri)=>`<tr class="${g.header&&ri===0?'bk-grid-hdr':''}" ondragover="gridRowDragOver(event)" ondragleave="gridRowDragLeave(event)" ondrop="gridRowDrop(event,'${blk.id}',${ri})"><td class="bk-grid-rhandle" draggable="true" ondragstart="gridRowDragStart(event,'${blk.id}',${ri})" ondragend="gridDragEnd()" title="Drag to move row">⠿</td>`+r.map((c,ci)=>`<td contenteditable="true" onpaste="onGridPaste(event,this)" oninput="gridSet('${blk.id}',${ri},${ci},this.innerHTML)">${gridCellHtml(c)}</td>`).join('')+'</tr>').join('');
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

