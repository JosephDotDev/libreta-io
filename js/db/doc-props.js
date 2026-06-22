/* ── SHARED PROPERTIES IN THE DOCUMENT EDITOR ──
   When a doc is an entry in a database (S.dbRow), the props bar shows the
   database's columns (minus the first, which is the page title) bound to this
   row's cells. Editing writes to the row; adding a property adds a shared column. */
function propDispHtml(c,v){
  if(c.type==='multiselect'){const ch=idbMsChips(c,v);return ch||'<span style="color:var(--mu)">+ Add</span>';}
  if(isSelectish(c)&&v){const o=(c.options||[]).find(x=>x.l===v);const col=o?o.c:'var(--mu)';return `<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:7px;height:7px;border-radius:50%;background:${col};display:inline-block"></span><span style="color:${col}">${escHtml(v)}</span></span>`;}
  if(c.type==='image')return v?`<img class="prop-file-thumb" src="${srcFor(v)}" alt="">`:'<span style="color:var(--mu)">+ Add image</span>';
  if(c.type==='date'&&v) return new Date(v+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  if(c.type==='checkbox') return `<span class="idb-cb${v?' on':''}">${v?'✓':''}</span>`;
  if(c.type==='number'&&v!=='') return v?Number(v).toLocaleString():'&#8212;';
  if(c.type==='url'&&v){try{return '<span style="color:var(--ac)">'+escHtml(new URL(v).hostname)+'</span>'}catch{return escHtml(String(v).slice(0,20))}}
  if(c.type==='text'&&v) return escHtml(String(v));  // full text — it renders in the wrapping, full-width .prop-val-text box
  if(c.type==='link'&&v) return tblMentionHtml(v);
  if(c.type==='document'&&v){const d=DB.getDoc(v);return d?'↗ '+escHtml(d.title||'Untitled'):'&#8212;';}
  return '<span style="color:var(--mu)">&#8212;</span>';
}
/* Stacked name/value units for a DB entry's shared properties.
   Returns {inline:[…], text:[…]} so text props can sit on their own line.
   Menu lives on the NAME; the VALUE is edited directly. */
function idbDocPropUnits(){
  const out={inline:[],text:[]};
  if(!S.dbRow) return out;
  const tbl=DB.getTbl(S.dbRow.tableId); if(!tbl) return out;
  const row=tbl.rows.find(r=>r.id===S.dbRow.rowId); if(!row) return out;
  const titleId=idbTitleColId(tbl);
  const hidden=idbHiddenDocProps(tbl);
  tbl.columns.forEach(c=>{
    // A "cover" column mirrors the page's cover image, which is part of the page
    // chrome (set via Add cover) — not an editable field. Don't surface it as a prop.
    if(c.id===titleId||c.type==='cover'||hidden.has(c.id)) return;
    const isText=c.type==='text';
    const v=propDispHtml(c,row.cells[c.id]||'');
    const unit=`<div class="prop-unit prop-db${isText?' prop-text-unit':''}" data-cid="${c.id}">
      <div class="prop-name prop-click" onclick="idbDocPropValMenu(event,'${c.id}')" title="Edit · rename · delete">${escHtml(c.name)}</div>
      <div class="prop-val ${isText?'prop-val-text':'prop-val-pill'} prop-click" onclick="idbDocPropClick(event,'${c.id}')" title="Click to edit">${v}</div>
    </div>`;
    (isText?out.text:out.inline).push(unit);
  });
  return out;
}
/* Per-page hidden shared properties (item 7). Stored on the row's backing doc so
   each page controls which DB props show in its own detail view. */
function idbHiddenDocProps(tbl){
  const doc=S.docId&&DB.getDoc(S.docId);
  const arr=doc&&doc.meta&&Array.isArray(doc.meta.hiddenProps)?doc.meta.hiddenProps:[];
  return new Set(arr);
}
function idbToggleDocProp(colId){
  const doc=S.docId&&DB.getDoc(S.docId); if(!doc) return;
  doc.meta=doc.meta||{}; const arr=Array.isArray(doc.meta.hiddenProps)?doc.meta.hiddenProps:[];
  const i=arr.indexOf(colId);
  if(i>=0) arr.splice(i,1); else arr.push(colId);
  doc.meta.hiddenProps=arr; DB.saveDoc(doc);
  renderProps(); renderDocPropsPanel();
}
function idbDocRow(){const tbl=DB.getTbl(S.dbRow?.tableId);return{tbl,row:tbl&&tbl.rows.find(r=>r.id===S.dbRow.rowId)};}
function idbDocPropClick(e,colId){
  e.stopPropagation();
  const {tbl,row}=idbDocRow(); if(!tbl||!row) return;
  const col=tbl.columns.find(c=>c.id===colId); if(!col) return;
  const rect=e.currentTarget.getBoundingClientRect();
  if(col.type==='multiselect'){
    idbSelEditor({tbl,colId,multi:true,cur:msVals(row.cells[colId]),
      onToggle:val=>{const set=msVals(row.cells[colId]);const i=set.indexOf(val);if(i>=0)set.splice(i,1);else set.push(val);row.cells[colId]=set;DB.saveTbl(tbl);},
      onClear:()=>{row.cells[colId]=[];DB.saveTbl(tbl);},
      rerender:()=>renderProps()
    }, rect);
    return;
  }
  if(isSelectish(col)){ idbDocSelDD(colId,rect); return; }
  if(col.type==='image'){ idbDocImgUpload(colId); return; }
  if(col.type==='date'){ S.dpTarget={type:'idbdoc',colId}; const v=row.cells[colId]||''; const d=v?new Date(v+'T12:00:00'):new Date(); S.dpY=d.getFullYear(); S.dpM=d.getMonth(); renderDp('Date'); posModal(document.getElementById('pm-dp'),rect); return; }
  if(col.type==='checkbox'){ row.cells[colId]=row.cells[colId]?'':'1'; DB.saveTbl(tbl); renderProps(); return; }
  if(col.type==='url'||col.type==='link'){ promptUrl(rect,(url)=>{row.cells[colId]=url?normUrl(url):'';DB.saveTbl(tbl);renderProps();}); return; }
  // text / number → edit in place (no OS prompt)
  idbDocInlineText(colId, col.type==='number');
}
/* Inline text/number cell editor — replaces the value chip with an input. */
function idbDocInlineText(colId,isNum){
  const {tbl,row}=idbDocRow(); if(!tbl||!row) return;
  const span=document.querySelector(`.prop-unit[data-cid="${colId}"] .prop-val`); if(!span) return;
  const inp=document.createElement('input'); inp.className='prop-inline-edit'; if(isNum)inp.type='number'; inp.value=row.cells[colId]||'';
  span.replaceWith(inp); inp.focus(); inp.select();
  let done=false;
  const commit=()=>{ if(done)return; done=true; row.cells[colId]=inp.value; DB.saveTbl(tbl); renderProps(); if(typeof idbRerenderSiblings==='function') idbRerenderSiblings(tbl.id,null); };
  inp.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ev.preventDefault();commit();} else if(ev.key==='Escape'){ev.preventDefault();done=true;renderProps();} });
  inp.addEventListener('blur',commit);
}
/* Rename a shared column in place. */
function idbDocPropRename(e,cid){
  e&&e.stopPropagation&&e.stopPropagation();
  const {tbl}=idbDocRow(); if(!tbl) return;
  const col=tbl.columns.find(c=>c.id===cid); if(!col) return;
  const span=e.currentTarget; if(!span) return;
  const inp=document.createElement('input'); inp.className='prop-inline-edit'; inp.value=col.name;
  span.replaceWith(inp); inp.focus(); inp.select();
  let done=false;
  const commit=()=>{ if(done)return; done=true; const v=inp.value.trim(); if(v){col.name=v;DB.saveTbl(tbl);} renderProps(); if(typeof idbRerenderSiblings==='function') idbRerenderSiblings(tbl.id,null); };
  inp.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ev.preventDefault();commit();} else if(ev.key==='Escape'){ev.preventDefault();done=true;renderProps();} });
  inp.addEventListener('blur',commit);
}
function idbDocPropRenameById(cid){ const span=document.querySelector(`.prop-unit[data-cid="${cid}"] .prop-name`); if(span) idbDocPropRename({stopPropagation(){},currentTarget:span},cid); }
function idbDocPropValMenu(e,cid){
  e&&e.stopPropagation&&e.stopPropagation();
  const rect=e.currentTarget.getBoundingClientRect();
  openSbPopover(rect,`
    <div class="sb-menu-it" onclick="closeSbMenu();idbDocPropEditValue('${cid}')"><span class="sb-menu-i">&#9998;</span> Edit</div>
    <div class="sb-menu-it" onclick="closeSbMenu();idbDocPropRenameById('${cid}')"><span class="sb-menu-i">&#8801;</span> Rename</div>
    <div class="sb-menu-sep"></div>
    <div class="sb-menu-it danger" onclick="closeSbMenu();idbDocPropDelete('${cid}')"><span class="sb-menu-i">&#128465;</span> Delete</div>`);
}
function idbDocPropEditValue(cid){
  const tag=document.querySelector(`.prop-unit[data-cid="${cid}"] .prop-val`); if(!tag) return;
  idbDocPropClick({stopPropagation(){},currentTarget:tag},cid);
}
function idbDocPropDelete(cid){
  const {tbl}=idbDocRow(); if(!tbl) return;
  const col=tbl.columns.find(c=>c.id===cid);
  showConfirm(`Delete the property “${col?col.name:''}” from every entry in this database?`,()=>{
    tbl.columns=tbl.columns.filter(c=>c.id!==cid); tbl.rows.forEach(r=>delete r.cells[cid]); DB.saveTbl(tbl);
    renderProps(); if(typeof idbRerenderSiblings==='function') idbRerenderSiblings(tbl.id,null);
  },'Delete','Delete property');
}
/* Upload/replace an image into an image-type shared property from the page view.
   (This was referenced by idbDocPropClick but never defined — clicking an image
   property did nothing useful.) */
function idbDocImgUpload(colId){
  const {tbl,row}=idbDocRow(); if(!tbl||!row) return;
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=()=>{
    const file=inp.files&&inp.files[0]; if(!file) return;
    compressToBlob(file,1600,1200,0.85).then(async blob=>{
      if(!blob) return;
      const id=await storeBlob(blob); const prev=row.cells[colId];
      row.cells[colId]=id; DB.saveTbl(tbl);
      renderProps(); if(typeof idbRerenderSiblings==='function') idbRerenderSiblings(tbl.id,null);
      if(typeof isBlobRef==='function'&&isBlobRef(prev)&&prev!==id) freeBlob(prev);
    });
  };
  inp.click();
}
function idbDocSelDD(colId,rect){
  const {tbl,row}=idbDocRow(); if(!tbl||!row) return;
  idbSelEditor({tbl,colId,cur:row.cells[colId]||'',
    onPick:val=>{row.cells[colId]=val;DB.saveTbl(tbl);},
    rerender:()=>renderProps()
  }, rect);
}
function idbDocAddCol(e){
  e&&e.stopPropagation&&e.stopPropagation();
  const {tbl}=idbDocRow(); if(!tbl) return;
  const rect=(e&&e.currentTarget&&e.currentTarget.getBoundingClientRect)?e.currentTarget.getBoundingClientRect():{bottom:160,left:160};
  idbColPop(rect,{title:'New shared property',type:'select',onSave:(name,type)=>{
    const col={id:mkId('c'),name,type,options:idbSeedOpts(type)};
    tbl.columns.push(col); tbl.rows.forEach(r=>{if(!(col.id in r.cells))r.cells[col.id]='';}); DB.saveTbl(tbl); renderProps();
  }});
}

/* ── Properties show/hide panel (item 7) ──
   A per-page panel listing every shared DB property with an eye toggle. The
   choice is stored on the page's doc (meta.hiddenProps), so it scopes to this
   page only and leaves the database's columns untouched. */
const _eyeOpen='<svg viewBox="0 0 16 16" width="14" height="14"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>';
const _eyeOff='<svg viewBox="0 0 16 16" width="14" height="14"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" stroke-width="1.3"/></svg>';
function openDocPropsPanel(e){
  e&&e.stopPropagation&&e.stopPropagation();
  if(document.getElementById('docprops-panel')){ closeDocPropsPanel(); return; }
  const p=document.createElement('div'); p.id='docprops-panel'; p.className='docprops-panel';
  document.body.appendChild(p);
  const r=(e&&e.currentTarget&&e.currentTarget.getBoundingClientRect)?e.currentTarget.getBoundingClientRect():{bottom:120,left:120};
  p.style.top=(r.bottom+6)+'px';
  p.style.left=Math.min(r.left, window.innerWidth-250)+'px';
  renderDocPropsPanel();
  setTimeout(()=>document.addEventListener('click',_docPropsOutside),0);
}
function _docPropsOutside(ev){
  const p=document.getElementById('docprops-panel');
  if(p && !p.contains(ev.target)) closeDocPropsPanel();
}
function closeDocPropsPanel(){
  document.getElementById('docprops-panel')?.remove();
  document.removeEventListener('click',_docPropsOutside);
}
function renderDocPropsPanel(){
  const p=document.getElementById('docprops-panel'); if(!p) return;
  const tbl=DB.getTbl(S.dbRow?.tableId); if(!tbl){ closeDocPropsPanel(); return; }
  const titleId=idbTitleColId(tbl), hidden=idbHiddenDocProps(tbl);
  const cols=tbl.columns.filter(c=>c.id!==titleId&&c.type!=='cover');
  p.innerHTML=`<div class="dpp-hdr">Page properties</div>`+
    (cols.length?cols.map(c=>{
      const on=!hidden.has(c.id);
      return `<button class="dpp-it${on?'':' off'}" onclick="idbToggleDocProp('${c.id}')">
        <span class="dpp-name">${escHtml(c.name)}</span>
        <span class="dpp-eye">${on?_eyeOpen:_eyeOff}</span></button>`;
    }).join(''):`<div class="dpp-empty">No shared properties yet.</div>`)+
    `<div class="dpp-foot">Hidden properties affect this page only.</div>`;
}

/* ===================================================
   TABLE <-> DOCUMENT LINK
=================================================== */
function openLinkedDoc(tblId,rowId,colId){
  const tbl=DB.getTbl(tblId); const row=tbl&&tbl.rows.find(r=>r.id===rowId); if(!row) return;
  let docId=row.cells[colId];
  if(!docId){
    const doc=blankDoc();
    const fc=tbl.columns[0];
    doc.title=(fc?row.cells[fc.id]:'')||'';   // empty → UI shows a soft "Untitled" placeholder
    doc.props.push({id:mkId('p'),name:'Source Table',type:'text',value:tbl.name});
    DB.saveDoc(doc); row.cells[colId]=doc.id; DB.saveTbl(tbl); docId=doc.id;
  }
  nav('editor',docId);
}


