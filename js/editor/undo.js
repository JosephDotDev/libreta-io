/* ═══════════════════════════════════════════════
   UNDO / REDO  (per open document)
═══════════════════════════════════════════════ */
function histTitleEl(){return document.getElementById(S.peekOpen?'peek-title':(S.view==='overview'?'ov-panel-title':'ed-title'))}
function histBlocksCt(){return currentCtId()}
function histSnap(){return JSON.stringify({b:S.blocks,p:S.props,t:histTitleEl()?.value||''})}
function initHistory(){S.hist=[];S.histRedo=[];S.histPresent=histSnap();}
function commitHistory(){
  const cur=histSnap();
  if(cur===S.histPresent) return;
  if(typeof clearTrashUndo==='function') clearTrashUndo();   // a real edit cancels the "undo last delete" gesture
  if(S.histPresent!=null){S.hist.push(S.histPresent); if(S.hist.length>60)S.hist.shift();}
  S.histPresent=cur; S.histRedo=[];
}
function restoreSnap(s){
  const o=JSON.parse(s);
  S.blocks=o.b; S.props=o.p;
  const t=histTitleEl(); if(t) t.value=o.t;
  renderBlocks(histBlocksCt()); renderProps();
  clearTimeout(S.saveTimer); flushSave();
}
function doUndo(){
  commitHistory();                 // capture any pending typing first
  if(!S.hist.length) return;
  const prev=S.hist.pop();
  S.histRedo.push(S.histPresent);
  S.histPresent=prev; restoreSnap(prev);
}
function doRedo(){
  if(!S.histRedo.length) return;
  const next=S.histRedo.pop();
  S.hist.push(S.histPresent);
  S.histPresent=next; restoreSnap(next);
}
document.addEventListener('keydown',e=>{
  if(!(e.metaKey||e.ctrlKey)) return;
  const k=e.key.toLowerCase();
  if(k!=='z'&&k!=='y') return;
  if((S.view!=='editor'&&S.view!=='overview'&&S.view!=='home')||!S.docId) return;
  e.preventDefault();
  if(k==='y'||(k==='z'&&e.shiftKey)) doRedo(); else doUndo();
});

