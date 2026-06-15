/* A "database" === a folio table. columns = shared properties, rows = entries.
   Each row can be opened as a full page (row.docId) whose properties ARE the
   shared columns \u2014 so every entry in a database carries the same properties. */
function idbTbl(blk){ return blk&&blk.tableId?DB.getTbl(blk.tableId):null; }
/* The "title" / primary column is tracked by id (tbl.titleCol), so columns can be
   reordered around it — including placing columns before it — without the page
   name jumping to whatever happens to be first. Defaults to the first column. */
function idbTitleColId(tbl){ const id=tbl&&tbl.titleCol; if(id&&tbl.columns.some(c=>c.id===id)) return id; return tbl&&tbl.columns[0]&&tbl.columns[0].id; }
function idbTitleCol(tbl){ return (tbl&&tbl.columns.find(c=>c.id===idbTitleColId(tbl)))||(tbl&&tbl.columns[0]); }
function idbRowTitle(tbl,row){ const tc=idbTitleCol(tbl); return (tc&&row&&row.cells[tc.id])||''; }
function idbDdPos(dd,rect){
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  const top=rect.bottom/z+4, left=rect.left/z;
  dd.style.top=top+'px'; dd.style.left=left+'px';
  // After it becomes visible, nudge it back on-screen if it overflows the viewport.
  requestAnimationFrame(()=>{
    const vw=window.innerWidth/z, vh=window.innerHeight/z;
    const w=dd.offsetWidth||220, h=dd.offsetHeight||200;
    let l=left, t=top;
    if(l+w>vw-8) l=Math.max(8, (rect.right/z)-w);
    if(l+w>vw-8) l=Math.max(8, vw-w-8);
    if(t+h>vh-8) t=Math.max(8, vh-h-8);
    dd.style.left=l+'px'; dd.style.top=t+'px';
  });
}
const IDB_VIEWS={table:'\u229e Table',board:'\u25a5 Board',calendar:'\u25a4 Calendar',timeline:'\u2630 Timeline'};
const IDB_COL_TYPES=[
  {t:'text',ico:'T',lbl:'Text'},{t:'number',ico:'#',lbl:'Number'},
  {t:'select',ico:'\u25c9',lbl:'Select'},{t:'multiselect',ico:'\u2263',lbl:'Multi-select'},
  {t:'status',ico:'\u25d0',lbl:'Status'},
  {t:'date',ico:'\u2637',lbl:'Date'},{t:'checkbox',ico:'\u2713',lbl:'Checkbox'},
  {t:'image',ico:'\u25a3',lbl:'Image'},{t:'cover',ico:'\u25a6',lbl:'Page cover'},
  {t:'url',ico:'\u2197',lbl:'URL'},
  {t:'link',ico:'\ud83d\udd17',lbl:'Link'},
];
/* select & status are single-value; all three below share the option list + in-place editor */
function isSelectish(c){return !!c&&(c.type==='select'||c.type==='status');}
/* any option-backed type (incl. multiselect), used for the shared option editor & chips */
function hasOpts(c){return !!c&&(c.type==='select'||c.type==='status'||c.type==='multiselect');}
/* Normalize a multi-select cell value to a clean array of labels (tolerates legacy strings). */
function msVals(v){ if(Array.isArray(v))return v.filter(x=>x!=null&&x!==''); if(v==null||v==='')return []; return [String(v)]; }
function idbDefaultSelOpts(){return [{l:'Todo',c:PALETTE_COLORS[1]},{l:'Doing',c:PALETTE_COLORS[0]},{l:'Done',c:PALETTE_COLORS[4]}];}
/* A status is an ordered, multi-step pipeline (top\u2192bottom = first\u2192last). */
function idbDefaultStatusOpts(){return [
  {l:'Not started',c:'#888888'},{l:'Planning',c:PALETTE_COLORS[7]},
  {l:'In progress',c:PALETTE_COLORS[0]},{l:'In review',c:PALETTE_COLORS[2]},
  {l:'Done',c:PALETTE_COLORS[4]},
];}
function idbSeedOpts(type){return type==='status'?idbDefaultStatusOpts():((type==='select'||type==='multiselect')?idbDefaultSelOpts():undefined);}
/* Re-render every database block (and the full-page DB) bound to a table, so
   sibling views of the same database stay in sync after an edit. exceptId keeps
   the block you're actively editing untouched (preserves caret/focus). */
function idbRerenderSiblings(tableId,exceptId){
  const ids=[...document.querySelectorAll('.bk-row[data-type="database"]')].map(r=>r.dataset.id)
    .filter(id=>id!==exceptId).filter(id=>{const b=findBlock(id);return b&&b.tableId===tableId;});
  ids.forEach(reRenderBlock);
  if(S.pageDbBlk&&S.pageDbBlk.tableId===tableId&&exceptId!=='__pagedb__') renderPageDb();
}
/* Re-render the acting block AND its siblings after a data change. */
function idbSync(blockId,tableId){ reRenderBlock(blockId); idbRerenderSiblings(tableId,blockId); }
/* Reusable property name+type picker popover (replaces prompt()s). */
let _colPop=null;
function idbColPop(rect,opts){
  _colPop={type:opts.type||'text',onSave:opts.onSave,onDelete:opts.onDelete};
  const pop=document.getElementById('idb-colpop');
  pop.innerHTML=`<div class="idb-cp-lbl">${opts.title||'Property'}</div>
    <input class="idb-cp-name" placeholder="Property name" value="${escAttr(opts.name||'')}" onkeydown="if(event.key==='Enter'){event.preventDefault();idbColPopSave();}else if(event.key==='Escape'){idbColPopClose();}">
    <div class="idb-cp-lbl">Type</div>
    <div class="idb-cp-types">${IDB_COL_TYPES.map(t=>`<button class="idb-cp-type${t.t===_colPop.type?' on':''}" data-t="${t.t}" onclick="idbColPopType('${t.t}')"><span style="width:13px;display:inline-block;text-align:center">${t.ico}</span>${t.lbl}</button>`).join('')}</div>
    <div class="idb-cp-actions">${opts.onDelete?`<button class="idb-cp-btn danger" onclick="idbColPopDelete()" title="Delete property">\ud83d\uddd1</button>`:''}<button class="idb-cp-btn sec" onclick="idbColPopClose()">Cancel</button><button class="idb-cp-btn" onclick="idbColPopSave()">${opts.onDelete?'Save':'Add'}</button></div>`;
  pop.classList.add('open');
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  let top=rect.bottom/z+6, left=rect.left/z;
  const vw=window.innerWidth/z, vh=window.innerHeight/z;
  if(left+256>vw) left=vw-256; if(top+250>vh) top=Math.max(8,vh-250);
  pop.style.top=Math.max(8,top)+'px'; pop.style.left=Math.max(8,left)+'px';
  openOvl();
  setTimeout(()=>pop.querySelector('.idb-cp-name')?.focus(),20);
}
function idbColPopType(t){_colPop.type=t;document.querySelectorAll('#idb-colpop .idb-cp-type').forEach(b=>b.classList.toggle('on',b.dataset.t===t));}
function idbColPopSave(){
  const pop=document.getElementById('idb-colpop');
  const name=pop.querySelector('.idb-cp-name').value.trim();
  if(!name){pop.querySelector('.idb-cp-name').focus();return;}
  const cb=_colPop.onSave, type=_colPop.type; idbColPopClose(); cb&&cb(name,type);
}
function idbColPopDelete(){const cb=_colPop.onDelete; idbColPopClose(); cb&&cb();}
function idbColPopClose(){const pop=document.getElementById('idb-colpop');if(pop)pop.classList.remove('open');_colPop=null;closeOvlSafe();}

function idbYM(blk){const now=new Date();return blk.calYM||(now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0'));}
/* Rows after applying the block's filters (shared by every view). */
function idbFilteredRows(blk,tbl){
  let rows=tbl.rows;
  (blk.filters||[]).forEach(f=>{
    const col=tbl.columns.find(c=>c.id===f.colId); if(!col){return;}
    rows=rows.filter(r=>{
      const v=r.cells[f.colId]||'';
      if(isSelectish(col)) return f.op==='isnot'?v!==f.val:v===f.val;
      if(col.type==='multiselect'){const has=msVals(v).includes(f.val);return f.op==='isnot'?!has:has;}
      if(col.type==='checkbox') return f.val==='1'?!!v:!v;
      if(col.type==='date'){ if(!v)return false; if(f.op==='before')return v<f.val; if(f.op==='after')return v>f.val; return v===f.val; }
      return String(v).toLowerCase().includes(String(f.val).toLowerCase());
    });
  });
  return rows;
}
function idbFilterOpLabel(f){return ({contains:'contains',isnot:'is not',before:'before',after:'after',on:'on'})[f.op]||'is';}
function idbFilterValLabel(f){
  if(/^\d{4}-\d{2}-\d{2}$/.test(f.val)) return new Date(f.val+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
  return f.val===''?'unchecked':(f.val==='1'?'checked':f.val);
}
function idbFilterChips(blk,tbl){
  return (blk.filters||[]).map((f,i)=>{const col=tbl.columns.find(c=>c.id===f.colId);
    return `<span class="idb-fchip">${escHtml(col?col.name:'?')} <span class="idb-mu">${idbFilterOpLabel(f)}</span> <b>${escHtml(idbFilterValLabel(f))}</b><button onclick="idbRemoveFilter('${blk.id}',${i})" title="Remove">\u2715</button></span>`;}).join('');
}
/* Columns the view shows (respects per-view hidden columns). */
function idbVisibleCols(blk,tbl){const h=blk.hiddenCols||[];return tbl.columns.filter(c=>!h.includes(c.id));}
/* Comparator for sorting by a column's value. */
function idbCmp(col,va,vb){
  va=va||''; vb=vb||'';
  if(col.type==='number'){const na=parseFloat(va),nb=parseFloat(vb);return (isNaN(na)?-Infinity:na)-(isNaN(nb)?-Infinity:nb);}
  if(col.type==='checkbox')return (va?1:0)-(vb?1:0);
  if(isSelectish(col)){const ord=(col.options||[]).map(o=>o.l);const ia=ord.indexOf(va),ib=ord.indexOf(vb);return (ia<0?9999:ia)-(ib<0?9999:ib);}
  if(col.type==='date')return String(va).localeCompare(String(vb)); // ISO dates sort lexically
  return String(va).localeCompare(String(vb),undefined,{sensitivity:'base'});
}
/* Filtered + sorted rows for a view. */
function idbViewRows(blk,tbl){
  let rows=idbFilteredRows(blk,tbl);
  if(blk.sort&&blk.sort.colId){
    const col=tbl.columns.find(c=>c.id===blk.sort.colId);
    if(col){const dir=blk.sort.dir==='desc'?-1:1;rows=[...rows].sort((a,b)=>dir*idbCmp(col,a.cells[col.id],b.cells[col.id]));}
  }
  return rows;
}
const IDB_ICON={
  group:'<svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="3.2" rx="1" fill="currentColor"/><rect x="2" y="9.8" width="12" height="3.2" rx="1" fill="currentColor"/></svg>',
  sort:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13V3M3 5l2-2 2 2M11 3v10M9 11l2 2 2-2"/></svg>',
  filter:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M2 3.5h12l-4.5 5.5v3.5l-3 1.5V9z"/></svg>',
  props:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="5" cy="5" r="1.9" fill="currentColor" stroke="none"/><circle cx="11" cy="11" r="1.9" fill="currentColor" stroke="none"/><path d="M8.5 5H14M2 11h5.5" stroke-linecap="round"/></svg>',
  details:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M2 6.5h12" /><circle cx="5" cy="4.5" r=".5" fill="currentColor"/></svg>',
  color:'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="4" width="13" height="2.5" rx=".6" fill="currentColor" stroke="none" opacity=".45"/><rect x="1.5" y="9.5" width="13" height="2.5" rx=".6" fill="currentColor" stroke="none" opacity=".45"/><circle cx="13" cy="5.25" r="1.9" fill="currentColor" stroke="none"/></svg>',
};
const IDB_EYE='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="1.9"/></svg>';
const IDB_EYE_OFF='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="1.9"/><path d="M2 2l12 12" stroke-linecap="round"/></svg>';
