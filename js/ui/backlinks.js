/* ═══════════════════════════════════════════════
   BACKLINKS
   "Linked from" — every other page that points at the page you're viewing, so the
   web of connections is visible from both ends. A page links to another when it
   carries a `page` block referencing it (sub-pages, inline page links) or a database
   `document` cell pointing at it. Rendered as a quiet section under the page body.
═══════════════════════════════════════════════ */
function findBacklinks(targetId){
  if(!targetId) return [];
  const out=[]; const seen=new Set();
  const add=(doc,via)=>{ if(!doc||doc.id===targetId||seen.has(doc.id)) return; seen.add(doc.id); out.push({id:doc.id,title:doc.title||'Untitled',icon:doc.meta&&doc.meta.icon,via}); };
  DB.getDocs().forEach(doc=>{
    if(doc.id===targetId) return;
    // a page block (sub-page or inline page link) pointing at the target
    const blocks=(typeof flattenBlocks==='function')?flattenBlocks(doc.blocks||[]):(doc.blocks||[]);
    if(blocks.some(b=>b&&b.type==='page'&&b.pageId===targetId)){ add(doc,'page'); return; }
  });
  // database "document" cells that reference the target page
  DB.getTbls().forEach(tbl=>{
    const docCols=(tbl.columns||[]).filter(c=>c.type==='document'); if(!docCols.length) return;
    (tbl.rows||[]).forEach(row=>{
      if(docCols.some(c=>row.cells[c.id]===targetId)){
        const host=row.docId?DB.getDoc(row.docId):null;
        if(host) add(host,'db');
        else { // a row with no page of its own — surface its database instead
          if(!seen.has('tbl:'+tbl.id)){ seen.add('tbl:'+tbl.id); out.push({id:null,tblId:tbl.id,title:(tbl.name||'Database'),via:'db'}); }
        }
      }
    });
  });
  return out;
}
function renderBacklinks(targetId){
  const el=document.getElementById('backlinks-sec'); if(!el) return;
  const id=targetId||S.docId;
  const links=findBacklinks(id);
  if(!links.length){ el.innerHTML=''; el.style.display='none'; return; }
  el.style.display='';
  const items=links.map(l=>{
    const ico=l.id&&l.icon?iconHtml(l.icon,'16px'):(l.via==='db'?'🗂':'📄');
    const onclick=l.id?`nav('editor','${l.id}')`:`nav('tables','${l.tblId}')`;
    return `<button class="bl-item" onclick="${onclick}"><span class="bl-ico">${ico}</span><span class="bl-title">${escHtml(l.title)}</span><span class="bl-arrow">&#8599;</span></button>`;
  }).join('');
  el.innerHTML=`<div class="bl-sec">
    <div class="bl-hd"><svg class="bl-hd-ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M9 15l6-6"/><path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1"/><path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1"/></svg>Linked from <span class="bl-count">${links.length}</span></div>
    <div class="bl-list">${items}</div>
  </div>`;
}
