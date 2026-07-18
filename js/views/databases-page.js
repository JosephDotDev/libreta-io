/* ═══════════════════════════════════════════════
   TABLES VIEW
═══════════════════════════════════════════════ */
function newTable(){const t=blankTbl();t.name='New Database';const cells={};t.columns.forEach(c=>cells[c.id]='');t.rows.push({id:mkId('r'),cells});DB.saveTbl(t);S.tblId=t.id;renderTblList();openTbl(t.id)}
function renderTblList(){
  const tbls=DB.getTbls();
  const isAll=S.tblId==='__all_docs__';
  const allItem=`<div class="tbl-sb-it${isAll?' active':''}" onclick="openTbl('__all_docs__')">
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z"/>
      <path d="M9 1v5h5"/>
    </svg>All Documents</div>`;
  const customItems=tbls.map(t=>`
    <div class="tbl-sb-it${t.id===S.tblId?' active':''}" onclick="openTbl('${t.id}')">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5.5" x2="15" y2="5.5"/><line x1="6" y1="5.5" x2="6" y2="15"/>
      </svg>${escHtml(t.name||'')}
    </div>`).join('');
  document.getElementById('tbl-list').innerHTML=allItem+customItems;
  /* Auto-open All Documents on first visit */
  if(!S.tblId){ openTbl('__all_docs__'); }
}
function openTbl(id){
  S.tblId=id;
  renderTblList();
  if(id==='__all_docs__'){
    S.allDocsSort=S.allDocsSort||{col:'updatedAt',dir:'desc'};
    S.allDocsFilter=S.allDocsFilter||'';
    S.pageDbBlk=null;
    renderAllDocsTbl();
  }else{
    const tbl=DB.getTbl(id);
    if(tbl){
      // Render the SAME interactive database component used inline (table/board/calendar).
      S.pageDbBlk={id:'__pagedb__',type:'database',tableId:id,view:tbl._view||'table',groupCol:tbl._groupCol,dateCol:tbl._dateCol,calYM:tbl._calYM,calView:tbl._calView,calAnchorDS:tbl._calAnchorDS,filters:tbl._filters||[],sort:tbl._sort,hiddenCols:tbl._hiddenCols||[],groupCollapsed:tbl._groupCollapsed||{},colWidths:tbl._colWidths||{},tlDesc:tbl._tlDesc,colorRules:tbl._colorRules||[],hiddenGroups:tbl._hiddenGroups||{},hideGroupCount:!!tbl._hideGroupCount,groupPageSize:tbl._groupPageSize||0,groupShown:tbl._groupShown||{}};
    } else S.pageDbBlk=null;
    renderPageDb();
  }
  if(S.view==='databases') renderBreadcrumbs('databases',id);
  writeRoute('databases', id==='__all_docs__'?null:id); // deep-linkable: #/db/<tableId>
}
/* Open a database as its own full page (from an inline block's ↗ button or a link). */
function openDbPage(tableId){
  S.tblId=tableId;      // nav('databases') opens whatever S.tblId points at
  nav('databases');
}
