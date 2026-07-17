/* ═══════════════════════════════════════════════
   QUICK PROPERTY EDITING (from any list surface)
═══════════════════════════════════════════════ */
function setDocProp(docId,propId,value){
  const doc=DB.getDoc(docId); if(!doc) return;
  const p=(doc.props||[]).find(x=>x.id===propId); if(!p) return;
  p.value=value; DB.saveDoc(doc);
  if(S.docId===docId){ S.props=doc.props; renderProps(); }
  refreshActiveLists();
}
function toggleDocCheck(docId,propId){
  const doc=DB.getDoc(docId); const p=doc?.props?.find(x=>x.id===propId); if(!p) return;
  setDocProp(docId,propId,!p.value);
}
function refreshActiveLists(){
  if(S.view==='documents') renderDocList();
  else if(S.view==='overview') renderOvRows();
  else if(S.view==='tables'&&S.tblId==='__all_docs__') renderAllDocsTbl();
  else if(S.view==='calendar') renderCal();
}
/* Build property chips. interactive=true makes select/checkbox chips clickable. */
function quickChips(doc,interactive){
  return (doc.props||[]).filter(p=>
    (p.type==='checkbox'&&interactive) || (p.value&&p.value!==false&&p.value!=='')
  ).map(p=>{
    if(p.type==='select'){
      const o=(p.options||[]).find(x=>x.l===p.value); const c=o?o.c:'var(--mu)';
      const click=interactive?`onclick="event.stopPropagation();openDocSelDD(event,'${doc.id}','${p.id}')"`:'';
      return `<span class="chip${interactive?' chip-int':''}" style="background:${c}22;color:${c}" ${click} title="${escHtml(p.name)} — click to change">${escHtml(p.value)}</span>`;
    }
    if(p.type==='checkbox'){
      const on=!!p.value;
      const click=interactive?`onclick="event.stopPropagation();toggleDocCheck('${doc.id}','${p.id}')"`:'';
      if(!on&&!interactive) return '';
      const bg=on?'var(--acs)':'var(--sur2)', fg=on?'var(--ac)':'var(--mu)';
      return `<span class="chip${interactive?' chip-int':''}" style="background:${bg};color:${fg}" ${click} title="${escHtml(p.name)} — click to toggle">${on?'&#10003;':'&#9744;'} ${escHtml(p.name)}</span>`;
    }
    if(p.type==='date'){
      const dt=new Date(p.value+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
      return `<span class="chip" style="background:var(--sur2);color:var(--mu)" title="${escHtml(p.name)}">${escHtml(p.name)}: ${dt}</span>`;
    }
    return '';
  }).filter(Boolean).join(' ');
}
function openDocSelDD(e,docId,propId){
  e.stopPropagation();
  const doc=DB.getDoc(docId); const p=doc?.props?.find(x=>x.id===propId); if(!p) return;
  const cur=p.value||'';
  const dd=document.getElementById('tbl-dd');
  const opts=(p.options||[]).map(o=>`<div class="qd-it" onclick="setDocProp('${docId}','${propId}','${escAttr(o.l)}');closeQuickDD()"><span class="qd-dot" style="background:${o.c}"></span>${escHtml(o.l)}${o.l===cur?' &#10003;':''}</div>`).join('');
  const clr=`<div class="qd-it qd-clr" onclick="setDocProp('${docId}','${propId}',null);closeQuickDD()">Clear</div>`;
  dd.innerHTML=opts+clr;
  const r=e.currentTarget.getBoundingClientRect();
  dd.style.top=(r.bottom+4)+'px'; dd.style.left=Math.min(r.left,window.innerWidth-160)+'px';
  dd.style.display='block'; openOvl();
}
function closeQuickDD(){document.getElementById('tbl-dd').style.display='none';closeOvlSafe()}

