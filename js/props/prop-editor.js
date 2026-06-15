/* ═══════════════════════════════════════════════════════
   PROPERTY EDITOR – Constants
═══════════════════════════════════════════════════════ */
const PROP_TYPES_DEF=[
  {t:'text',     ico:'T',  lbl:'Text'},
  {t:'number',   ico:'#',  lbl:'Number'},
  {t:'select',   ico:'◉',  lbl:'Select'},
  {t:'multiselect',ico:'≣',lbl:'Multi'},
  {t:'date',     ico:'📅', lbl:'Date'},
  {t:'checkbox', ico:'✓',  lbl:'Check'},
  {t:'url',      ico:'↗',  lbl:'URL'},
  {t:'file',     ico:'📎', lbl:'File'},
];
const PALETTE_COLORS=[
  '#C47D32','#E8A44E','#C9A84C','#8BAD52',
  '#4E9E72','#4E9EAA','#4E7EC4','#7E6FBE',
  '#C454B4','#C45454','#888888','#5E4F3E',
];

function escHtml(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ═══════════════════════════════════════════════════════
   PROPERTY EDITOR – Open / Close / Render
═══════════════════════════════════════════════════════ */
function openPropEditor(e,propId){
  e.stopPropagation&&e.stopPropagation();
  const prop=S.props.find(p=>p.id===propId); if(!prop) return;
  S.editPropId=propId;
  renderPropEditor(prop);
  const ed=document.getElementById('prop-editor');
  const rect=e.currentTarget?e.currentTarget.getBoundingClientRect():{bottom:120,left:120};
  let top=rect.bottom+6,left=Math.min(rect.left,window.innerWidth-296);
  if(top+440>window.innerHeight) top=Math.max(rect.top-440,10);
  ed.style.top=top+'px'; ed.style.left=left+'px';
  ed.classList.add('open'); openOvl();
  setTimeout(()=>document.getElementById('pe-name')?.focus(),30);
}
function closePropEditor(){
  document.getElementById('prop-editor').classList.remove('open');
  document.getElementById('color-pal').classList.remove('open');
  S.editPropId=null; closeOvlSafe();
}
function renderPropEditor(prop){
  const nm=document.getElementById('pe-name'); if(nm) nm.value=prop.name;
  document.getElementById('pe-types').innerHTML=PROP_TYPES_DEF.map(pt=>
    `<button class="pe-tb${prop.type===pt.t?' on':''}" onclick="changePropType('${pt.t}')" title="${pt.lbl}">
      <span class="pe-ti">${pt.ico}</span><span class="pe-tl">${pt.lbl}</span>
    </button>`).join('');
  document.getElementById('pe-body').innerHTML=buildPropValueUI(prop);
}
function buildPropValueUI(prop){
  if(prop.type==='select'||prop.type==='multiselect'){
    const multi=prop.type==='multiselect';
    const opts=prop.options||[];
    const rows=opts.map((o,i)=>{
      const isSel=multi?(Array.isArray(prop.value)&&prop.value.includes(o.l)):!!(prop.value&&prop.value===o.l);
      return `<div class="pe-or${isSel?' sel':''}" draggable="true"
          ondragstart="optDragStart(event,'${prop.id}',${i})"
          ondragover="optDragOver(event,'${prop.id}',${i})"
          ondrop="optDrop(event,'${prop.id}',${i})"
          ondragleave="this.classList.remove('opt-dov')"
          ondragend="optDragEnd()"
          onclick="optRowClick('${prop.id}',${i})">
        <span class="pe-dh">&#10240;</span>
        <button class="pe-oc" style="background:${o.c}"
          onclick="event.stopPropagation();openColorPalette(event,'${prop.id}',${i})"></button>
        <span class="pe-ol-text${!o.l?' empty':''}">
          ${o.l||`<em style="color:var(--mu);font-style:normal">Option ${i+1}</em>`}
        </span>
        <span class="pe-sel-mark">${isSel?'&#x2713;':''}</span>
        <div class="pe-opt-acts">
          <button class="pe-oe" title="Rename"
            onclick="event.stopPropagation();editOptInline(event,'${prop.id}',${i})">&#9998;</button>
          <button class="pe-od" title="Delete"
            onclick="event.stopPropagation();deleteOpt('${prop.id}',${i})">&#10005;</button>
        </div>
      </div>`;
    }).join('');
    return `<div class="pe-sl">${multi?'Click to toggle (choose several)':'Click to select'} &bull; &#9998; rename &bull; drag &#10240; to reorder</div>
      <div id="pe-opts">${rows||'<div style="color:var(--mu);font-size:11px;padding:6px 0;font-style:italic">No options yet</div>'}</div>
      <div class="pe-ao">
        <input id="pe-new-opt" class="pe-ai" placeholder="New option&#8230;"
          onkeydown="if(event.key==='Enter')addOptInEditor('${prop.id}')">
        <button class="pe-ab" onclick="addOptInEditor('${prop.id}')">+</button>
      </div>`;
  }
  if(prop.type==='date'){
    const val=prop.value;
    const disp=val?new Date(val+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'}):null;
    return `<div class="pe-sl">Date</div>
      <div class="${disp?'pe-dd':'pe-dn'}">${disp||'No date set'}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="pe-db" onclick="openDateFromEditor()">&#128197; ${val?'Change date':'Set date'}</button>
        ${val?`<button class="pe-db" onclick="clearPropDate('${prop.id}')">Clear</button>`:''}
      </div>`;
  }
  if(prop.type==='text'){
    return `<div class="pe-sl">Value</div>
      <textarea class="pe-ta" placeholder="Enter value&#8230;"
        oninput="liveSetPropVal('${prop.id}',this.value)">${escHtml(prop.value||'')}</textarea>`;
  }
  if(prop.type==='number'){
    return `<div class="pe-sl">Value</div>
      <input type="number" class="pe-ni" value="${prop.value??''}" placeholder="0"
        oninput="liveSetPropVal('${prop.id}',this.value)">`;
  }
  if(prop.type==='checkbox'){
    const on=!!prop.value;
    return `<div class="pe-sl">Value</div>
      <div class="pe-cbw" onclick="togglePropCheck('${prop.id}')">
        <div class="pe-cb${on?' on':''}">${on?'&#x2713;':''}</div>
        <span class="pe-cbl">${on?'Checked &#8212; click to uncheck':'Unchecked &#8212; click to check'}</span>
      </div>`;
  }
  if(prop.type==='file'){
    const val=prop.value;
    if(val&&val.name){
      const isImgF=val.type?.startsWith('image/');
      return `<div class="pe-sl">File</div>
        ${isImgF?`<img src="${srcFor(val.id||val.data)}" style="width:100%;max-height:130px;object-fit:contain;border-radius:6px;margin-bottom:8px;display:block;border:1px solid var(--bd)">`:''
        }<div class="bk-file-card" onclick="downloadPropFile('${prop.id}')" style="margin-bottom:8px">
          <span class="bk-file-ico">${getFileIcon(val.type)}</span>
          <div class="bk-file-info">
            <div class="bk-file-nm">${escHtml(val.name)}</div>
            <div class="bk-file-sz">${formatFileSize(val.size)}</div>
          </div>
          <span class="bk-file-dl">&#8595; Download</span>
        </div>
        <div style="display:flex;gap:6px">
          <button class="pe-db" onclick="triggerPropFileUpload('${prop.id}')">Replace file</button>
          <button class="pe-db" onclick="clearPropFile('${prop.id}')">Remove</button>
        </div>`;
    }
    return `<div class="pe-sl">File</div>
      <div class="ip-up-area" onclick="triggerPropFileUpload('${prop.id}')" style="margin-bottom:8px">
        <div class="ip-up-ico">📎</div>
        <div class="ip-up-lbl">Click to upload a file</div>
        <div class="ip-up-hint">Image, PDF, document, or any file</div>
      </div>`;
  }
  if(prop.type==='url'){
    return `<div class="pe-sl">URL</div>
      <div class="pe-ur">
        <input type="url" class="pe-ui" value="${escHtml(prop.value||'')}" placeholder="https://&#8230;"
          oninput="liveSetPropVal('${prop.id}',this.value)">
        ${prop.value?`<a class="pe-uv" href="${escHtml(safeUrl(prop.value))}" target="_blank" rel="noopener">&#x2197;</a>`:''}
      </div>`;
  }
  return '';
}

/* ═══════════════════════════════════════════════════════
   PROPERTY EDITOR – Mutators
═══════════════════════════════════════════════════════ */
function liveUpdatePropName(val){
  const prop=S.props.find(p=>p.id===S.editPropId); if(!prop) return;
  prop.name=val; renderProps(); sched();
}
function changePropType(newType){
  const prop=S.props.find(p=>p.id===S.editPropId); if(!prop||prop.type===newType) return;
  prop.type=newType; prop.value=newType==='checkbox'?false:(newType==='multiselect'?[]:null);
  if((newType==='select'||newType==='multiselect')&&!prop.options)
    prop.options=[{l:'Option 1',c:PALETTE_COLORS[0]},{l:'Option 2',c:PALETTE_COLORS[1]},{l:'Option 3',c:PALETTE_COLORS[2]}];
  renderPropEditor(prop); renderProps(); sched();
}
function liveSetPropVal(propId,val){
  const prop=S.props.find(p=>p.id===propId); if(!prop) return;
  prop.value=val; renderProps(); sched();
}
function togglePropCheck(propId){
  const prop=S.props.find(p=>p.id===propId); if(!prop) return;
  prop.value=!prop.value; renderPropEditor(prop); renderProps(); sched();
}
function saveOptLabel(propId,idx,label){
  const prop=S.props.find(p=>p.id===propId); if(!prop||!prop.options[idx]) return;
  const trimmed=label.trim();
  const old=prop.options[idx].l;
  if(Array.isArray(prop.value)){const vi=prop.value.indexOf(old);if(vi>=0)prop.value[vi]=trimmed;}
  else if(prop.value===old) prop.value=trimmed;
  prop.options[idx].l=trimmed;
  renderProps(); sched();
  if(S.editPropId===propId&&document.getElementById('prop-editor').classList.contains('open'))
    renderPropEditor(prop);
}
function deleteOpt(propId,idx){
  const prop=S.props.find(p=>p.id===propId); if(!prop) return;
  const lbl=prop.options[idx]?.l;
  if(Array.isArray(prop.value)){const vi=prop.value.indexOf(lbl);if(vi>=0)prop.value.splice(vi,1);}
  else if(prop.value===lbl) prop.value=null;
  prop.options.splice(idx,1);
  renderProps(); sched();
  if(S.editPropId===propId&&document.getElementById('prop-editor').classList.contains('open'))
    renderPropEditor(prop);
}
function addOptInEditor(propId){
  const inp=document.getElementById('pe-new-opt');
  const lbl=inp?.value.trim(); if(!lbl) return;
  const prop=S.props.find(p=>p.id===propId); if(!prop) return;
  const c=PALETTE_COLORS[(prop.options?.length||0)%PALETTE_COLORS.length];
  prop.options=prop.options||[]; prop.options.push({l:lbl,c});
  renderPropEditor(prop); renderProps(); sched();
  setTimeout(()=>{const i=document.getElementById('pe-new-opt');if(i){i.value='';i.focus()}},20);
}
function removePropFromEditor(){
  if(!S.editPropId) return;
  removeProp(S.editPropId); closePropEditor();
}
function openDateFromEditor(){
  const prop=S.props.find(p=>p.id===S.editPropId); if(!prop) return;
  S.dpTarget={type:'prop',propId:S.editPropId};
  const d=prop.value?new Date(prop.value+'T12:00:00'):new Date();
  S.dpY=d.getFullYear(); S.dpM=d.getMonth(); renderDp(prop.name);
  const edR=document.getElementById('prop-editor').getBoundingClientRect();
  const dp=document.getElementById('pm-dp');
  dp.style.top=edR.top+'px';
  dp.style.left=Math.min(edR.right+8,window.innerWidth-230)+'px';
  dp.classList.add('open'); openOvl();
}
function clearPropDate(propId){
  const prop=S.props.find(p=>p.id===propId); if(!prop) return;
  prop.value=null; renderPropEditor(prop); renderProps(); sched();
}

