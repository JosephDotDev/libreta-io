/* ═══════════════════════════════════════════════════════
   COLOR PALETTE
═══════════════════════════════════════════════════════ */
function openColorPalette(e,propId,optIdx){
  e.stopPropagation();
  const prop=S.props.find(p=>p.id===propId);
  const curC=prop?.options?.[optIdx]?.c||'';
  const pal=document.getElementById('color-pal');
  pal.innerHTML=`
    <div class="cp-g">
      ${PALETTE_COLORS.map(c=>`<div class="cp-s${c===curC?' on':''}" style="background:${c}" onclick="applyOptColor('${propId}',${optIdx},'${c}')"></div>`).join('')}
    </div>
    <div class="cp-cu">
      <input type="color" class="cp-ci" value="${curC||'#C47D32'}"
        oninput="applyOptColor('${propId}',${optIdx},this.value)" title="Custom color">
      <span class="cp-cl">Custom</span>
    </div>`;
  const r=e.currentTarget.getBoundingClientRect();
  pal.style.top=(r.bottom+4)+'px';
  pal.style.left=Math.min(r.left,window.innerWidth-168)+'px';
  pal.classList.add('open');
}
function applyOptColor(propId,optIdx,color){
  const prop=S.props.find(p=>p.id===propId); if(!prop||!prop.options[optIdx]) return;
  prop.options[optIdx].c=color;
  const btns=document.querySelectorAll('.pe-oc');
  if(btns[optIdx]) btns[optIdx].style.background=color;
  renderProps(); sched();
}
document.addEventListener('click',e=>{
  if(!e.target.closest('#color-pal')&&!e.target.closest('.pe-oc'))
    document.getElementById('color-pal')?.classList.remove('open');
});


/* ═══════════════════════════════════════════════════════
   FIX 1: Click empty space below blocks → focus last block
═══════════════════════════════════════════════════════ */
/* #2 — the whole header (cover + title + format bar) now lives inside the scroll area and
   scrolls away naturally; the props bar is sticky and stays as a thin row. This just adds a
   subtle shadow under the pinned props bar once you've scrolled. No layout manipulation → no jank. */
function onEditorScroll(e){
  const sc=e.currentTarget; const shell=sc.closest('.ed-shell'); if(!shell) return;
  shell.classList.toggle('scrolled', sc.scrollTop>6);
  if(typeof outlineSyncActive==='function') outlineSyncActive();   // keep the active section in sync
}
/* #5 — clicking empty space places the cursor on the nearest block, or creates a
   new paragraph when the click is below all content. */
function onBlocksAreaClick(e){
  if(e.target.closest('.bk-row')||e.target.closest('.bk')) return;
  if(e.target.closest('.ed-title-row,.props-bar,#fmt-bar,#ed-cover-wrap,.doc-peek-bar,#peek-title,#peek-props')) return;
  if(!S.blocks||!S.blocks.length) return;
  const ctId=currentCtId();
  const ct=document.getElementById(ctId); if(!ct) return;
  const els=[...ct.querySelectorAll('.bk[contenteditable]')];
  if(!els.length){
    const nb=mkBlock('paragraph','');
    S.blocks.push(nb);
    const row=mkBkEl(nb); ct.appendChild(row);
    const el=row.querySelector('.bk'); if(el){el.focus();putCursorEnd(el)}
    updNums(); sched(); return;
  }
  const lastEl=els[els.length-1];
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  // Click below all editable content → create or focus trailing empty paragraph
  if(e.clientY/z > lastEl.getBoundingClientRect().bottom/z){
    if(!lastEl.innerText.trim()){
      lastEl.focus(); putCursorEnd(lastEl);
    } else {
      const nb=mkBlock('paragraph','');
      S.blocks.push(nb);
      const row=mkBkEl(nb); ct.appendChild(row);
      const el=row.querySelector('.bk'); if(el){el.focus();putCursorEnd(el)}
      updNums(); sched();
    }
    return;
  }
  const y=e.clientY;
  let best=els[0],bestDist=Infinity;
  els.forEach(el=>{
    const r=el.getBoundingClientRect();
    const dist=(y>=r.top&&y<=r.bottom)?0:Math.min(Math.abs(y-r.top),Math.abs(y-r.bottom));
    if(dist<bestDist){bestDist=dist;best=el}
  });
  best.focus();
  const cr=document.caretRangeFromPoint?document.caretRangeFromPoint(e.clientX,e.clientY):null;
  if(cr&&best.contains(cr.startContainer)){
    const s=window.getSelection(); s.removeAllRanges(); s.addRange(cr);
  } else putCursorEnd(best);
}

/* ═══════════════════════════════════════════════════════
   FIX 5: Click-to-select option row
═══════════════════════════════════════════════════════ */
function optRowClick(propId,idx){
  const prop=S.props.find(p=>p.id===propId); if(!prop||!prop.options[idx]) return;
  const lbl=prop.options[idx].l;
  if(!lbl||!lbl.trim()) return; // empty-label options aren't selectable yet
  if(prop.type==='multiselect'){
    if(!Array.isArray(prop.value)) prop.value=[];
    const i=prop.value.indexOf(lbl); if(i>=0)prop.value.splice(i,1); else prop.value.push(lbl);
    renderProps(); sched();
    if(S.editPropId===propId&&document.getElementById('prop-editor').classList.contains('open')) renderPropEditor(prop);
    return;
  }
  setSelVal(propId,lbl);
}

/* ═══════════════════════════════════════════════════════
   FIX 5: Inline option rename (click ✏)
═══════════════════════════════════════════════════════ */
function editOptInline(e,propId,idx){
  e.stopPropagation();
  const rows=document.querySelectorAll('#pe-opts .pe-or');
  if(!rows[idx]) return;
  const span=rows[idx].querySelector('.pe-ol-text');
  if(!span) return;
  const prop=S.props.find(p=>p.id===propId);
  const cur=prop?.options?.[idx]?.l||'';
  const inp=document.createElement('input');
  inp.className='pe-ol-edit'; inp.value=cur;
  inp.placeholder='Option '+(idx+1);
  span.replaceWith(inp);
  inp.focus(); if(cur) inp.select();
  let done=false;
  const commit=()=>{if(done)return;done=true;saveOptLabel(propId,idx,inp.value)};
  inp.addEventListener('blur',commit);
  inp.addEventListener('keydown',ev=>{
    if(ev.key==='Enter'){ev.preventDefault();inp.blur()}
    if(ev.key==='Escape'){ev.preventDefault();done=true;
      const p=S.props.find(x=>x.id===propId);if(p)renderPropEditor(p)}
  });
}

/* ═══════════════════════════════════════════════════════
   FIX 6: Drag to reorder select options
═══════════════════════════════════════════════════════ */
let _oDragPropId=null, _oDragIdx=null;

function optDragStart(e,propId,idx){
  _oDragPropId=propId; _oDragIdx=idx;
  e.dataTransfer.effectAllowed='move';
  setTimeout(()=>e.currentTarget.classList.add('dragging'),0);
}
function optDragOver(e,propId,idx){
  e.preventDefault(); e.dataTransfer.dropEffect='move';
  document.querySelectorAll('.pe-or').forEach(r=>r.classList.remove('opt-dov'));
  if(idx!==_oDragIdx) e.currentTarget.classList.add('opt-dov');
}
function optDrop(e,propId,idx){
  e.preventDefault();
  document.querySelectorAll('.pe-or').forEach(r=>r.classList.remove('opt-dov','dragging'));
  if(_oDragIdx===null||_oDragIdx===idx||_oDragPropId!==propId) return;
  const prop=S.props.find(p=>p.id===propId); if(!prop?.options) return;
  const [moved]=prop.options.splice(_oDragIdx,1);
  prop.options.splice(idx,0,moved);
  _oDragPropId=null; _oDragIdx=null;
  renderPropEditor(prop); renderProps(); sched();
}
function optDragEnd(){
  document.querySelectorAll('.pe-or').forEach(r=>r.classList.remove('opt-dov','dragging'));
  _oDragPropId=null; _oDragIdx=null;
}


