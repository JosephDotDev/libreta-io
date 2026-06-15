function mkDbBlockHtml(blk){
  const tbl=idbTbl(blk);
  if(!tbl) return `<div class="idb"><div class="idb-hd"><span class="idb-title-s">Database not found</span></div></div>`;
  const view=blk.view||'table';
  let toolbar, body;
  if(view==='board'){ toolbar=idbToolbar(blk,tbl,'board'); body=idbBoardView(blk,tbl); }
  else if(view==='calendar'){ toolbar=idbCalBar(blk,tbl); body=idbCalView(blk,tbl); }
  else if(view==='timeline'){ toolbar=idbTimelineBar(blk,tbl); body=idbTimelineView(blk,tbl); }
  else { toolbar=idbToolbar(blk,tbl,'table'); body=idbTableView(blk,tbl); }
  const viewSel=`<select class="idb-viewsel" onchange="idbSetView('${blk.id}',this.value)" title="Change view">${Object.keys(IDB_VIEWS).map(v=>`<option value="${v}"${v===view?' selected':''}>${IDB_VIEWS[v]}</option>`).join('')}</select>`;
  // Table/Board: collapse name + modifier buttons + view picker onto a single
  // header row. Calendar/Timeline keep their own bar (date nav lives there).
  const inline=(view==='table'||view==='board');
  return `<div class="idb${inline?' idb-onerow':''}" data-tid="${tbl.id}">
    <div class="idb-hd">
      <input class="idb-title" value="${escAttr(tbl.name)}" onblur="idbRename('${blk.id}',this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">
      ${inline?(toolbar||''):''}
      <span class="idb-hd-r">${viewSel}</span>
    </div>${inline?'':(toolbar||'')}${body}</div>`;
}
const IDB_TYPE_ICON={text:'T',number:'#',select:'\u25c9',multiselect:'\u2263',status:'\u25d0',date:'\u2637',checkbox:'\u2611',image:'\u25a3',cover:'\u25a6',url:'\u2197',link:'\ud83d\udd17',document:'\u2197'};
function idbTypeIcon(type){return `<span class="idb-th-ico">${IDB_TYPE_ICON[type]||'\u2022'}</span>`;}
function idbGroupPill(gcol,g){
  if(g.key==='') return `<span class="idb-grp-none">${escHtml(g.label)}</span>`;
  if(gcol.type==='status') return `<span class="idb-status"><span class="idb-status-dot" style="background:${g.color}"></span>${escHtml(g.label)}</span>`;
  return `<span class="chip" style="background:${g.color}22;color:${g.color}">${escHtml(g.label)}</span>`;
}
