/* ── FILTERING ── two-step popover: pick a property, then a condition/value. */
let _filterDraft=null;
function idbOpenFilter(e,blockId){
  e.stopPropagation();
  const blk=findBlock(blockId),tbl=idbTbl(blk); if(!tbl)return;
  _filterDraft={blockId};
  const pop=document.getElementById('idb-filterpop');
  pop.innerHTML=`<div class="idb-cp-lbl">Filter where…</div>`+tbl.columns.map(c=>`<div class="idb-dd-it" onclick="idbFilterPickCol('${c.id}')">${escHtml(c.name)} <span class="idb-mu" style="margin-left:auto">${c.type}</span></div>`).join('');
  idbDdPos(pop,e.currentTarget.getBoundingClientRect()); pop.classList.add('open'); openOvl();
}
function idbFilterPickCol(colId){
  if(!_filterDraft)return;
  const blk=findBlock(_filterDraft.blockId),tbl=idbTbl(blk); const col=tbl.columns.find(c=>c.id===colId);
  const pop=document.getElementById('idb-filterpop');
  if(hasOpts(col)){
    const lbl=col.type==='multiselect'?'includes':'is';
    pop.innerHTML=`<div class="idb-cp-lbl">${escHtml(col.name)} ${lbl}</div>`+((col.options||[]).filter(o=>o.l).map(o=>`<div class="idb-dd-it" onclick="idbAddFilter('${colId}','is','${escAttr(o.l)}')"><span class="idb-dd-dot" style="background:${o.c}"></span>${escHtml(o.l)}</div>`).join('')||'<div class="idb-dd-empty">No options</div>');
  } else if(col.type==='checkbox'){
    pop.innerHTML=`<div class="idb-cp-lbl">${escHtml(col.name)}</div><div class="idb-dd-it" onclick="idbAddFilter('${colId}','is','1')">Checked</div><div class="idb-dd-it" onclick="idbAddFilter('${colId}','is','')">Unchecked</div>`;
  } else if(col.type==='date'){
    const today=new Date().toISOString().slice(0,10);
    pop.dataset.fdop='on';
    pop.innerHTML=`<div class="idb-cp-lbl">${escHtml(col.name)} is</div>
      <div class="idb-fdate-ops">
        <button class="idb-fop" data-op="before" onclick="idbFDateOp(this)">Before</button>
        <button class="idb-fop on" data-op="on" onclick="idbFDateOp(this)">On</button>
        <button class="idb-fop" data-op="after" onclick="idbFDateOp(this)">After</button>
      </div>
      <input type="date" class="idb-cp-name idb-fdate-input" value="${today}">
      <button class="idb-cp-btn" style="width:100%;margin-top:9px" onclick="idbAddDateFilter('${colId}')">Add filter</button>`;
  } else {
    pop.innerHTML=`<div class="idb-cp-lbl">${escHtml(col.name)} contains</div><input class="idb-cp-name" placeholder="Text…" onkeydown="if(event.key==='Enter'){event.preventDefault();idbAddFilter('${colId}','contains',this.value);}"><button class="idb-cp-btn" style="width:100%;margin-top:8px" onclick="idbAddFilter('${colId}','contains',this.previousElementSibling.value)">Add filter</button>`;
    setTimeout(()=>pop.querySelector('.idb-cp-name')?.focus(),20);
  }
}
function idbFDateOp(btn){const pop=document.getElementById('idb-filterpop');pop.dataset.fdop=btn.dataset.op;pop.querySelectorAll('.idb-fop').forEach(b=>b.classList.toggle('on',b===btn));}
function idbAddDateFilter(colId){const pop=document.getElementById('idb-filterpop');const op=pop.dataset.fdop||'on';const val=pop.querySelector('.idb-fdate-input')?.value;if(!val)return;idbAddFilter(colId,op,val);}
function idbAddFilter(colId,op,val){
  if(!_filterDraft)return; const blk=findBlock(_filterDraft.blockId); if(!blk)return;
  blk.filters=blk.filters||[]; blk.filters.push({colId,op,val});
  const bid=_filterDraft.blockId; idbCloseFilter(); idbPersistView(blk); reRenderBlock(bid);
}
function idbRemoveFilter(blockId,i){const blk=findBlock(blockId);if(blk&&blk.filters){blk.filters.splice(i,1);idbPersistView(blk);reRenderBlock(blockId);}}
function idbCloseFilter(){const pop=document.getElementById('idb-filterpop');if(pop)pop.classList.remove('open');_filterDraft=null;closeOvlSafe();}
/* (Calendar is the aggregated view rendered by renderCal() on nav('calendar') —
   it pulls every dated page + database row, so it needs no "default" database.) */
