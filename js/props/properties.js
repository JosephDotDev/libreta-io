/* ═══════════════════════════════════════════════
   PROPERTIES
═══════════════════════════════════════════════ */
/* Value display for a page (S.props) property. */
function propValueDisp(p){
  if(p.type==='select'&&p.value){
    const o=(p.options||[]).find(x=>x.l===p.value);const c=o?o.c:'var(--mu)';
    return `<span style="display:inline-flex;align-items:center;gap:4px"><span style="width:7px;height:7px;border-radius:50%;background:${c};display:inline-block;flex-shrink:0"></span><span style="color:${c}">${escHtml(p.value)}</span></span>`;
  }
  if(p.type==='multiselect') return idbMsChips(p,p.value)||'';
  if(p.type==='date'&&p.value) return new Date(p.value+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  if(p.type==='text'&&p.value) return escHtml(String(p.value));
  if(p.type==='number'&&p.value!==null&&p.value!=='') return Number(p.value).toLocaleString();
  if(p.type==='checkbox') return p.value?'<span style="color:var(--gr)">&#x2713; Yes</span>':'<span style="color:var(--mu)">&#x2610; No</span>';
  if(p.type==='url'&&p.value){ try{return '<span style="color:var(--ac)">'+escHtml(new URL(p.value).hostname)+'</span>'}catch{return escHtml(String(p.value).slice(0,24))} }
  if(p.type==='file'&&p.value&&p.value.name){
    const isImg2=p.value.type?.startsWith('image/');
    return isImg2
      ?`<img class="prop-file-thumb" src="${srcFor(p.value.id||p.value.data)}">&nbsp;<span style="color:var(--mu)">${escHtml(p.value.name)}</span>`
      :`<span style="color:var(--mu)">${getFileIcon(p.value.type)} ${escHtml(p.value.name)}</span>`;
  }
  return '';
}
/* One stacked name-above-value unit (Notion style). The menu lives on the NAME;
   the value is edited directly. Text props get a wide box on their own line. */
function propUnitHtml(p){
  const isText=p.type==='text';
  const v=propValueDisp(p)||'<span class="prop-empty">Empty</span>';
  return `<div class="prop-unit${isText?' prop-text-unit':''}" data-pid="${p.id}">
    <div class="prop-name prop-click" onclick="propNameMenu(event,'${p.id}')" title="Edit \u00b7 rename \u00b7 delete">${escHtml(p.name)}</div>
    <div class="prop-val ${isText?'prop-val-text':'prop-val-pill'} prop-click" onclick="propEditValueDirect(event,'${p.id}')" title="Click to edit">${v}</div>
  </div>`;
}
function renderProps(){
  const _html=(()=>{
    const inline=[], text=[];
    if(S.dbRow && typeof idbDocPropUnits==='function'){ const u=idbDocPropUnits(); inline.push(...u.inline); text.push(...u.text); }
    S.props.forEach(p=>{ (p.type==='text'?text:inline).push(propUnitHtml(p)); });
    const addBtn = S.dbRow
      ? `<button class="prop-add" onclick="idbDocAddCol(event)" data-tip="Adds a shared property to every entry in this database">+ Add property</button>`
      : `<button class="prop-add" onclick="openPropTypePicker(event)" data-tip="Add a property to this page">+ Add property</button>`;
    return `<div class="props-grid">${inline.join('')}${addBtn}</div>`
      + (text.length?`<div class="props-text-col">${text.join('')}</div>`:'');
  })();
  /* legacy display switch retained below for reference (unused) */
  function _legacyPropChip(p){
      let v='&#8212;';
      if(p.type==='select'&&p.value){
        const o=(p.options||[]).find(x=>x.l===p.value);const c=o?o.c:'var(--mu)';
        v=`<span style="display:inline-flex;align-items:center;gap:3px"><span style="width:7px;height:7px;border-radius:50%;background:${c};display:inline-block;flex-shrink:0"></span><span style="color:${c}">${p.value}</span></span>`;
      }else if(p.type==='multiselect'){
        const ch=idbMsChips(p,p.value); v=ch||'&#8212;';
      }else if(p.type==='date'&&p.value){
        v=new Date(p.value+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      }else if(p.type==='text'&&p.value){
        const sv=String(p.value);v=sv.length>24?sv.slice(0,24)+'\u2026':sv;
      }else if(p.type==='number'&&p.value!==null&&p.value!==''){
        v=Number(p.value).toLocaleString();
      }else if(p.type==='checkbox'){
        v=p.value?'<span style="color:var(--gr)">&#x2713;</span>':'<span style="color:var(--mu)">&#x2610;</span>';
      }else if(p.type==='url'&&p.value){
        try{v='<span style="color:var(--ac)">'+new URL(p.value).hostname+'</span>'}catch{v=p.value.slice(0,20)}
      }else if(p.type==='file'&&p.value&&p.value.name){
        const isImg2=p.value.type?.startsWith('image/');
        v=isImg2
          ?`<img class="prop-file-thumb" src="${srcFor(p.value.id||p.value.data)}">&nbsp;<span style="color:var(--mu)">${p.value.name.length>14?p.value.name.slice(0,14)+'…':p.value.name}</span>`
          :`<span style="color:var(--mu)">${getFileIcon(p.value.type)} ${p.value.name.length>16?p.value.name.slice(0,16)+'…':p.value.name}</span>`;
      }
      return `<span class="prop-tag" data-pid="${p.id}"><span class="prop-tag-l prop-click" onclick="renamePropInline(event,'${p.id}')" title="Click to rename">${escHtml(p.name)}</span><span class="prop-tag-v prop-click" onclick="propValMenu(event,'${p.id}')" title="Click to edit"> ${v}</span></span>`;
  }
  /* When a peek is open it owns the property bar (its own doc). */
  if(S.peekOpen){const pk=document.getElementById('peek-props');if(pk)pk.innerHTML=_html;return;}
  /* Primary container (main editor) */
  const row=document.getElementById('props-row');
  if(row) row.innerHTML=_html;
  /* Mirror into overview side panel when it is open */
  const panelRow=document.getElementById('ov-panel-props');
  if(panelRow&&document.getElementById('ov-panel')?.classList.contains('open'))
    panelRow.innerHTML=_html;
}

function openPropTypePicker(e){
  e.stopPropagation();
  const m=document.getElementById('pm-ptp');
  m.style.width='180px';
  m.innerHTML=PROP_TYPES_DEF.map(pt=>
    `<div class="ptp-it" onclick="addProp('${pt.t}')"><span style="font-size:14px;width:22px;display:inline-block;text-align:center">${pt.ico}</span> ${pt.lbl}</div>`
  ).join('');
  const r=e.currentTarget.getBoundingClientRect();
  m.style.top=(r.bottom+4)+'px'; m.style.left=r.left+'px';
  m.classList.add('open'); openOvl();
}
function addProp(type){
  const names={select:'Status',multiselect:'Tags',date:'Deadline',text:'Note',number:'Count',checkbox:'Done',url:'Link',file:'Attachment'};
  const newProp={
    id:mkId('p'),name:names[type]||type,type,
    value:type==='checkbox'?false:(type==='multiselect'?[]:null),
    options:(type==='select'||type==='multiselect')?[
      {l:'',c:PALETTE_COLORS[0]},
      {l:'',c:PALETTE_COLORS[1]},
      {l:'',c:PALETTE_COLORS[2]},
    ]:undefined
  };
  S.props.push(newProp); renderProps(); sched(); closeAll();
  setTimeout(()=>{
    const last=document.querySelector(`.prop-unit[data-pid="${newProp.id}"]`);
    if(last) openPropEditor({stopPropagation:()=>{},currentTarget:last},newProp.id);
  },60);
}
function openPropEdit(e,propId){ openPropEditor(e,propId); }
function openSelPicker(propId,rect){}
function setSelVal(propId,val){
  if(val===undefined||val===null||!String(val).trim()) return;
  const prop=S.props.find(x=>x.id===propId); if(!prop) return;
  prop.value=prop.value===val?null:val;
  renderProps(); sched();
  if(S.editPropId===propId&&document.getElementById('prop-editor').classList.contains('open'))
    renderPropEditor(prop);
}
function addSelOpt(propId){}
function removeProp(id){S.props=S.props.filter(p=>p.id!==id);renderProps();sched()}

/* ── Per-property interactions ──
   Menu (Edit/Rename/Delete) lives on the NAME; the VALUE is edited directly. */
function propNameMenu(e,pid){
  e&&e.stopPropagation&&e.stopPropagation();
  const rect=e.currentTarget.getBoundingClientRect();
  openSbPopover(rect,`
    <div class="sb-menu-it" onclick="closeSbMenu();propEditValueById('${pid}')"><span class="sb-menu-i">&#9998;</span> Edit value</div>
    <div class="sb-menu-it" onclick="closeSbMenu();renamePropById('${pid}')"><span class="sb-menu-i">&#8801;</span> Rename</div>
    <div class="sb-menu-sep"></div>
    <div class="sb-menu-it danger" onclick="closeSbMenu();removeProp('${pid}')"><span class="sb-menu-i">&#128465;</span> Delete</div>`);
}
/* Direct value edit: inline field for text/number/url, toggle for checkbox,
   the in-place picker for select/multiselect/date/file. */
function propEditValueDirect(e,pid){
  e&&e.stopPropagation&&e.stopPropagation();
  const prop=S.props.find(p=>p.id===pid); if(!prop) return;
  if(prop.type==='checkbox'){ prop.value=!prop.value; renderProps(); sched(); return; }
  if(prop.type==='text'||prop.type==='number'||prop.type==='url'){ propInlineValue(e.currentTarget,pid,prop.type); return; }
  openPropEditor({stopPropagation(){},currentTarget:e.currentTarget},pid);
}
function propEditValueById(pid){
  const span=document.querySelector(`.prop-unit[data-pid="${pid}"] .prop-val`);
  propEditValueDirect({stopPropagation(){},currentTarget:span||document.querySelector(`.prop-unit[data-pid="${pid}"]`)},pid);
}
function propInlineValue(span,pid,type){
  const prop=S.props.find(p=>p.id===pid); if(!prop||!span) return;
  const isText=type==='text';
  const inp=document.createElement(isText?'textarea':'input');
  inp.className='prop-inline-edit'+(isText?' prop-inline-text':''); if(type==='number')inp.type='number'; if(type==='url')inp.type='url';
  inp.value=prop.value==null?'':prop.value;
  span.replaceWith(inp); inp.focus(); inp.select&&inp.select();
  let done=false;
  const commit=()=>{ if(done)return; done=true; prop.value=inp.value; renderProps(); sched(); };
  inp.addEventListener('keydown',ev=>{
    if(ev.key==='Enter'&&(!isText||ev.metaKey||ev.ctrlKey)){ ev.preventDefault(); commit(); }
    else if(ev.key==='Escape'){ ev.preventDefault(); done=true; renderProps(); }
  });
  inp.addEventListener('blur',commit);
}
/* Rename a property in place (replaces the name label with an input). */
function renamePropInline(e,pid){
  e&&e.stopPropagation&&e.stopPropagation();
  const prop=S.props.find(p=>p.id===pid); if(!prop) return;
  const span=e.currentTarget; if(!span) return;
  const inp=document.createElement('input'); inp.className='prop-inline-edit'; inp.value=prop.name;
  span.replaceWith(inp); inp.focus(); inp.select();
  let done=false;
  const commit=()=>{ if(done)return; done=true; const v=inp.value.trim(); if(v)prop.name=v; renderProps(); sched(); };
  inp.addEventListener('keydown',ev=>{ if(ev.key==='Enter'){ev.preventDefault();commit();} else if(ev.key==='Escape'){ev.preventDefault();done=true;renderProps();} });
  inp.addEventListener('blur',commit);
}
function renamePropById(pid){
  const span=document.querySelector(`.prop-unit[data-pid="${pid}"] .prop-name`);
  if(span) renamePropInline({stopPropagation(){},currentTarget:span},pid);
}

/* ── Date Picker ── */
const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DH=['Su','Mo','Tu','We','Th','Fr','Sa'];
function renderDp(title){
  const dp=document.getElementById('pm-dp');
  const now=new Date(); const tod=dateStr(now);
  let curVal=null;
  if(S.dpTarget?.type==='prop'){const p=S.props.find(x=>x.id===S.dpTarget.propId);curVal=p?.value}
  else if(S.dpTarget?.type==='tbl'){const t=DB.getTbl(S.dpTarget.tblId);curVal=t?.rows.find(r=>r.id===S.dpTarget.rowId)?.cells[S.dpTarget.colId]}
  const fd=new Date(S.dpY,S.dpM,1).getDay(),dim=new Date(S.dpY,S.dpM+1,0).getDate(),pdim=new Date(S.dpY,S.dpM,0).getDate();
  let cells=''; for(let i=fd-1;i>=0;i--)cells+=`<div class="dp-d om">${pdim-i}</div>`;
  for(let d=1;d<=dim;d++){const ds=`${S.dpY}-${pad(S.dpM+1)}-${pad(d)}`;cells+=`<div class="dp-d${ds===tod?' tod':''}${ds===curVal?' sel':''}" onclick="pickDate('${ds}')">${d}</div>`}
  const fill=(7-(fd+dim)%7)%7; for(let d=1;d<=fill;d++)cells+=`<div class="dp-d om">${d}</div>`;
  dp.innerHTML=`<div class="dp-hdr">${title||'Date'}</div>
    <div class="dp-nav"><button class="dp-nb" onclick="dpShift(-1)">←</button><span class="dp-mo">${MO[S.dpM]} ${S.dpY}</span><button class="dp-nb" onclick="dpShift(1)">→</button></div>
    <div class="dp-g">${DH.map(d=>`<div class="dp-dh">${d}</div>`).join('')}${cells}</div>
    <div class="dp-foot"><button class="dp-clr" onclick="pickDate(null)">Clear date</button></div>`;
}
function dpShift(d){S.dpM+=d;if(S.dpM>11){S.dpM=0;S.dpY++}if(S.dpM<0){S.dpM=11;S.dpY--}renderDp()}
function pickDate(ds){
  if(S.dpTarget?.type==='prop'){
    const p=S.props.find(x=>x.id===S.dpTarget.propId);
    if(p){p.value=ds;renderProps();sched()}
  }else if(S.dpTarget?.type==='tbl'){
    setTblCell(S.dpTarget.tblId,S.dpTarget.rowId,S.dpTarget.colId,ds||'');
    renderTbl(DB.getTbl(S.dpTarget.tblId));
  }else if(S.dpTarget?.type==='idb'){
    idbSetCell(S.dpTarget.blockId,S.dpTarget.rowId,S.dpTarget.colId,ds||'');
    reRenderBlock(S.dpTarget.blockId);
  }else if(S.dpTarget?.type==='idbdoc'){
    const tbl=DB.getTbl(S.dbRow?.tableId), row=tbl&&tbl.rows.find(r=>r.id===S.dbRow.rowId);
    if(row){row.cells[S.dpTarget.colId]=ds||'';DB.saveTbl(tbl);}
    renderProps();
  }
  document.getElementById('pm-dp').classList.remove('open');
  closeOvlSafe();
  // Re-render prop editor if it was open (date was changed from inside editor)
  if(S.editPropId){
    const ep=S.props.find(p=>p.id===S.editPropId);
    if(ep&&document.getElementById('prop-editor').classList.contains('open')) renderPropEditor(ep);
  }
}
function posModal(el,rect){
  el.style.top=(rect.bottom+4)+'px';
  el.style.left=Math.min(rect.left,window.innerWidth-228)+'px';
  el.classList.add('open'); openOvl();
}

