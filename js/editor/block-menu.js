/* ═══════════════════════════════════════════════
   BLOCK MENU
═══════════════════════════════════════════════ */
/* Block-type-specific controls — these used to be little toolbars above each block */
function blockContextItems(blk){
  if(!blk) return '';
  const id=blk.id;
  const dot=on=>on?'● ':'○ ';
  if(blk.type==='page'){
    const disp=blk.display==='card'?'card':'link';
    return `<div class="bm-s"><div class="bm-lbl">Linked page</div>
      <div class="bm-it" onclick="setPageDisplay('${id}','link');closeAll()">${dot(disp==='link')}Display as link</div>
      <div class="bm-it" onclick="setPageDisplay('${id}','card');closeAll()">${dot(disp==='card')}Display as card</div>
    </div>`;
  }
  if(blk.type==='carousel'){
    const fit=blk.fit||'landscape';
    return `<div class="bm-s"><div class="bm-lbl">Carousel</div>
      <div class="bm-it" onclick="carAdd('${id}');closeAll()">＋ Add thumbnail</div>
      <div class="bm-it" onclick="carSetFit('${id}','landscape');closeAll()">${dot(fit==='landscape')}Crop landscape</div>
      <div class="bm-it" onclick="carSetFit('${id}','square');closeAll()">${dot(fit==='square')}Crop square</div>
      <div class="bm-it" onclick="carSetFit('${id}','portrait');closeAll()">${dot(fit==='portrait')}Crop portrait</div>
    </div>`;
  }
  if(blk.type==='toggle'){
    const hs=blk.hsize||'';
    return `<div class="bm-s"><div class="bm-lbl">Toggle header size</div>
      <div class="bm-it" onclick="toggleSetSize('${id}','');closeAll()">${dot(hs==='')}Normal text</div>
      <div class="bm-it" onclick="toggleSetSize('${id}','h1');closeAll()">${dot(hs==='h1')}Heading 1</div>
      <div class="bm-it" onclick="toggleSetSize('${id}','h2');closeAll()">${dot(hs==='h2')}Heading 2</div>
      <div class="bm-it" onclick="toggleSetSize('${id}','h3');closeAll()">${dot(hs==='h3')}Heading 3</div>
    </div>`;
  }
  if(blk.type==='grid'){
    const g=blk.grid||{};
    return `<div class="bm-s"><div class="bm-lbl">Table</div>
      <div class="bm-it" onclick="gridToggleHeader('${id}');closeAll()">${g.header?'☑':'☐'} Header row</div>
      <div class="bm-it" onclick="gridAddRow('${id}');closeAll()">＋ Add row</div>
      <div class="bm-it" onclick="gridAddCol('${id}');closeAll()">＋ Add column</div>
      <div class="bm-it" onclick="gridDelRow('${id}');closeAll()">－ Remove row</div>
      <div class="bm-it" onclick="gridDelCol('${id}');closeAll()">－ Remove column</div>
    </div>`;
  }
  if(blk.type==='youtube'&&blk.url){
    const mode=blk.mode||'embed';
    return `<div class="bm-s"><div class="bm-lbl">Video</div>
      <div class="bm-it" onclick="ytSetMode('${id}','embed');closeAll()">${dot(mode==='embed')}Player</div>
      <div class="bm-it" onclick="ytSetMode('${id}','bookmark');closeAll()">${dot(mode==='bookmark')}Bookmark</div>
      <div class="bm-it" onclick="ytClear('${id}');closeAll()">↻ Replace</div>
    </div>`;
  }
  return '';
}
function openBkMenu(e,id){
  e.stopPropagation(); S.menuId=id; S.menuSub=false;
  const m=document.getElementById('bk-menu');
  const blk=findBlock(id);
  const subs=BT.filter(t=>!['divider','page','database','mention'].includes(t.t)).map(t=>`<div class="bm-si" onclick="xformBlk('${id}','${t.t}');closeAll()">${t.ico} ${t.lbl}</div>`).join('');
  m.innerHTML=blockContextItems(blk)+`
    <div class="bm-s">
      <div class="bm-it" onclick="toggleBmSub()">
        <svg viewBox="0 0 13 13"><path d="M1 6.5h9M7 3.5l3 3-3 3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Turn into <span style="margin-left:auto;color:var(--mu);font-size:9px">▶</span>
      </div>
      <div class="bm-sub" id="bm-sub">${subs}</div>
    </div>
    <div class="bm-s">
      <div class="bm-it" onclick="addBlockRel('${id}','above')">
        <svg viewBox="0 0 13 13"><path d="M6.5 11V4M3.5 7l3-3 3 3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 2h9" stroke-linecap="round"/></svg>Add block above</div>
      <div class="bm-it" onclick="addBlockRel('${id}','below')">
        <svg viewBox="0 0 13 13"><path d="M6.5 2v7M3.5 6l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 11h9" stroke-linecap="round"/></svg>Add block below</div>
      <div class="bm-it" onclick="dupBlk('${id}');closeAll()">
        <svg viewBox="0 0 13 13"><rect x="4" y="4" width="7" height="7" rx="1"/><path d="M2 9V2h7"/></svg>Duplicate</div>
      <div class="bm-it" onclick="copyBlkText('${id}');closeAll()">
        <svg viewBox="0 0 13 13"><path d="M8 1H3a1 1 0 00-1 1v8"/><rect x="4" y="4" width="8" height="8" rx="1"/></svg>Copy text</div>
    </div>
    <div class="bm-s">
      <div class="bm-it danger" onclick="delBlk('${id}');closeAll()">
        <svg viewBox="0 0 13 13"><path d="M2 4h9M5 4V2h3v2M10 4l-.8 7H3.8L3 4" stroke-linecap="round" stroke-linejoin="round"/></svg>Delete</div>
    </div>`;
  const btn=e.currentTarget; const r=btn.getBoundingClientRect();
  const z=parseFloat(document.documentElement.style.zoom||'1')||1;
  const vpH=window.innerHeight/z;
  m.style.left=Math.max(r.left/z-170,8)+'px';
  m.style.top='0px';
  m.classList.add('open'); openOvl();
  // Clamp/flip so the menu stays fully on screen (work in CSS px to respect UI zoom)
  clampBkMenu(r.bottom/z+4, vpH);
}
function clampBkMenu(preferredTop,vpH){
  const m=document.getElementById('bk-menu');
  if(!m) return;
  if(vpH===undefined){const z=parseFloat(document.documentElement.style.zoom||'1')||1;vpH=window.innerHeight/z;}
  const mh=m.offsetHeight;
  let top=preferredTop!==undefined?preferredTop:(parseFloat(m.style.top)||8);
  if(top+mh>vpH-8) top=Math.max(8,vpH-mh-8);
  m.style.top=top+'px';
}
function toggleBmSub(){
  S.menuSub=!S.menuSub;
  document.getElementById('bm-sub')?.classList.toggle('open',S.menuSub);
  clampBkMenu(); // re-clamp after the submenu changes the menu height
}
/* Add an empty paragraph block above or below the given block */
function addBlockRel(id,where){
  closeAll();
  const loc=locate(id); if(!loc) return;
  const nb=mkBlock('paragraph','');
  loc.arr.splice(where==='above'?loc.idx:loc.idx+1,0,nb);
  const row=document.querySelector(`.bk-row[data-id="${id}"]`);
  const newRow=mkBkEl(nb);
  if(row){ if(where==='above') row.before(newRow); else row.after(newRow); }
  const el=newRow.querySelector('.bk'); if(el){el.focus();putCursorStart(el)}
  updNums(); sched();
}
function copyBlkText(id){const b=findBlock(id);if(b){const d=document.createElement('div');d.innerHTML=b.content||'';navigator.clipboard.writeText(d.innerText).catch(()=>{})}}

/* Build a fresh block of a media/special type */
function mkMediaBlock(type){
  if(type==='carousel') return {id:mkId('b'),type:'carousel',content:'',images:[{src:'',caption:''},{src:'',caption:''},{src:'',caption:''}],fit:'landscape'};
  if(type==='grid') return {id:mkId('b'),type:'grid',content:'',grid:defaultGrid()};
  if(type==='youtube') return {id:mkId('b'),type:'youtube',content:'',url:'',mode:'embed'};
  return mkBlock(type,'');
}
/* Insert a new media block right after the given block */
function insertBelow(afterId,type){
  closeAll();
  const loc=locate(afterId);
  const blk=mkMediaBlock(type);
  if(loc)loc.arr.splice(loc.idx+1,0,blk);else S.blocks.push(blk);
  const afterRow=document.querySelector(`.bk-row[data-id="${afterId}"]`);
  const ct=document.getElementById(currentCtId());
  const newRow=mkBkEl(blk);
  if(afterRow)afterRow.after(newRow);else if(ct)ct.appendChild(newRow);
  updNums(); sched();
  if(type==='image') openBlkImgInput(blk.id); // jump straight to the file picker
}

