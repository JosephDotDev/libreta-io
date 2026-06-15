/* ═══════════════════════════════════════════════
   SPLIT / MERGE / DELETE / TRANSFORM BLOCKS
═══════════════════════════════════════════════ */
function splitBlk(id,el){
  const sel=window.getSelection(); if(!sel.rangeCount) return;
  const rng=sel.getRangeAt(0);

  // Content AFTER cursor
  const aRng=rng.cloneRange(); aRng.selectNodeContents(el); aRng.setStart(rng.endContainer,rng.endOffset);
  const aDiv=document.createElement('div'); aDiv.appendChild(aRng.cloneContents()); const aHTML=aDiv.innerHTML;

  // Content BEFORE cursor
  const bRng=rng.cloneRange(); bRng.selectNodeContents(el); bRng.setEnd(rng.startContainer,rng.startOffset);
  const bDiv=document.createElement('div'); bDiv.appendChild(bRng.cloneContents()); const bHTML=bDiv.innerHTML;

  const loc=locate(id); if(!loc) return; const arr=loc.arr, idx=loc.idx;
  arr[idx].content=bHTML; el.innerHTML=bHTML;

  const curT=arr[idx].type;

  /* Enter in a toggle header → start the first child inside the toggle (expands it) */
  if(curT==='toggle'){
    const tb=arr[idx]; tb.collapsed=false; tb.children=tb.children||[];
    const nb=mkBlock('paragraph',aHTML); tb.children.unshift(nb);
    const row=el.closest('.bk-row'); if(row) row.replaceWith(mkBkEl(tb));
    const newEl=document.querySelector(`.bk[data-id="${nb.id}"]`); if(newEl){newEl.focus();putCursorStart(newEl)}
    updNums(); sched(); return;
  }
  /* Pressing Enter on an EMPTY list item exits the list (back to paragraph) */
  if(['bullet','numbered','alpha','todo'].includes(curT) && !el.innerText.trim() && !aHTML){
    xformBlk(id,'paragraph',''); updNums(); sched(); return;
  }

  const newT=(['bullet','numbered','alpha','todo'].includes(curT))?curT:'paragraph';
  const nb=mkBlock(newT,aHTML);
  arr.splice(idx+1,0,nb);

  const curRow=el.closest('.bk-row');
  const newRow=mkBkEl(nb); curRow.after(newRow);
  const newEl=newRow.querySelector('.bk');
  if(newEl){newEl.focus();putCursorStart(newEl)}
  updNums(); sched();
}

function mergeWithPrev(id,el){
  const loc=locate(id); if(!loc||loc.idx===0) return;
  const arr=loc.arr, idx=loc.idx;
  const prev=arr[idx-1];
  if(prev.type==='divider'){delBlk(prev.id);return}
  const pEl=document.querySelector(`.bk[data-id="${prev.id}"]`);
  if(!pEl){
    // Previous block has no editable text surface (image, file, database, page
    // link, etc.) — there's nothing to merge text into. Hop this block above it
    // instead of silently doing nothing, so Backspace at the start always acts.
    const [cur]=arr.splice(idx,1); arr.splice(idx-1,0,cur);
    rerender(); updNums(); sched();
    const moved=document.querySelector(`.bk[data-id="${id}"]`);
    if(moved){ moved.focus(); putCursorStart(moved); }
    return;
  }
  const mergedHTML=pEl.innerHTML+el.innerHTML;
  arr[idx-1].content=mergedHTML; pEl.innerHTML=mergedHTML;
  const prevTextLen=pEl.innerText.length-el.innerText.length;
  arr.splice(idx,1);
  el.closest('.bk-row').remove();
  pEl.focus(); putCursorAtOffset(pEl,Math.max(0,prevTextLen));
  updNums(); sched();
}

function delBlk(id){
  const loc=locate(id); if(!loc) return;
  const arr=loc.arr, idx=loc.idx;
  if(arr===S.blocks && S.blocks.length===1){S.blocks[0]=mkBlock('paragraph');rerender();const el=document.querySelector('.bk');if(el)el.focus();return}
  const row=document.querySelector(`.bk-row[data-id="${id}"]`);
  const prevRow=row?row.previousElementSibling:null, nextRow=row?row.nextElementSibling:null;
  arr.splice(idx,1);
  // If this emptied a column, tidy up the columns layout and re-render.
  if(loc.colsBlock && arr.length===0){
    cleanupColumns(loc.colsBlock); rerender(); updNums(); sched(); return;
  }
  // If this emptied a toggle's body, keep one paragraph so it stays usable.
  if(loc.toggleBlock && arr.length===0){
    arr.push(mkBlock('paragraph','')); reRenderBlock(loc.toggleBlock.id);
    const el=document.querySelector(`.bk[data-id="${arr[0].id}"]`); if(el){el.focus();putCursorStart(el)}
    updNums(); sched(); return;
  }
  if(row){
    row.remove();
    const target=prevRow||nextRow;
    if(target){const el=target.querySelector('.bk');if(el){el.focus();putCursorEnd(el)}}
  }
  updNums(); sched();
}

function xformBlk(id,newT,newContent){
  const loc=locate(id); if(!loc) return; const arr=loc.arr, idx=loc.idx;
  const content=newContent!==undefined?newContent:arr[idx].content;

  const oldType=arr[idx].type;
  const MEDIA=['image','file','carousel','youtube','grid','page'];
  if(newT==='divider'){
    arr[idx]={id,type:'divider',content:''};
    const row=document.querySelector(`.bk-row[data-id="${id}"]`);
    if(row){const nr=mkBkEl(arr[idx]);row.replaceWith(nr);
      const nxt=nr.nextElementSibling;
      if(nxt){const e2=nxt.querySelector('.bk');if(e2){e2.focus();putCursorStart(e2)}}
      else addBlkAfter(id,'paragraph','');
    }
  } else if(MEDIA.includes(newT)||MEDIA.includes(oldType)){
    /* Always do a full row-swap when involving non-editable block types */
    const nonEditable=MEDIA.includes(newT);
    const base={id,type:newT,content:nonEditable?'':content};
    if(newT==='carousel'){base.images=arr[idx].images||[{src:'',caption:''},{src:'',caption:''},{src:'',caption:''}];base.fit=arr[idx].fit||'landscape'}
    if(newT==='grid') base.grid=arr[idx].grid||defaultGrid();
    if(newT==='youtube'){base.url=arr[idx].url||'';base.mode=arr[idx].mode||'embed'}
    arr[idx]=base;
    const row=document.querySelector(`.bk-row[data-id="${id}"]`);
    if(row){
      const nr=mkBkEl(arr[idx]); row.replaceWith(nr);
      if(!nonEditable){
        const e2=nr.querySelector('.bk'); if(e2){e2.focus();putCursorEnd(e2)}
      }
    }
  } else if(['callout','todo','toggle'].includes(newT)||['callout','todo','toggle'].includes(oldType)){
    /* Editable but need a wrapper (icon / checkbox / toggle) — full row-swap, keep content */
    const base={id,type:newT,content};
    if(newT==='callout') base.icon=arr[idx].icon||'💡';
    if(newT==='todo') base.checked=arr[idx].checked||false;
    if(newT==='toggle'){base.collapsed=false;base.children=arr[idx].children||[mkBlock('paragraph')];}
    arr[idx]=base;
    const row=document.querySelector(`.bk-row[data-id="${id}"]`);
    if(row){const nr=mkBkEl(base);row.replaceWith(nr);const e2=nr.querySelector('.bk');if(e2){e2.focus();putCursorEnd(e2)}}
  } else {
    arr[idx].type=newT; arr[idx].content=content;
    const el=document.querySelector(`.bk[data-id="${id}"]`);
    if(el){el.dataset.t=newT;el.dataset.ph=PH[newT]||'';el.innerHTML=content;el.closest('.bk-row').dataset.type=newT}
  }
  updNums(); sched();
}

function dupBlk(id){
  const loc=locate(id); if(!loc) return;
  const dup=JSON.parse(JSON.stringify(loc.block)); reassignIds(dup);
  loc.arr.splice(loc.idx+1,0,dup);
  const origRow=document.querySelector(`.bk-row[data-id="${id}"]`);
  if(origRow)origRow.after(mkBkEl(dup));
  updNums(); sched();
}

function addBlkAfter(afterId,type,content){
  const loc=locate(afterId);
  const nb=mkBlock(type,content||'');
  if(loc)loc.arr.splice(loc.idx+1,0,nb);else S.blocks.push(nb);
  const afterRow=document.querySelector(`.bk-row[data-id="${afterId}"]`);
  const newRow=mkBkEl(nb);
  if(afterRow)afterRow.after(newRow);else document.getElementById(currentCtId()).appendChild(newRow);
  const newEl=newRow.querySelector('.bk');if(newEl){newEl.focus();putCursorStart(newEl)}
  updNums(); sched();
}

