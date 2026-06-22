/* ═══════════════════════════════════════════════
   TASKS — one central board that every kanban feeds into.
   A "board" = any database table with a Status (or Select) column. Every row in
   such a table is a task; they're pooled here and grouped by status, exactly the
   way the Calendar pools dated items from every date source. Each board gets its
   own colour and can be shown/hidden; prefs persist in localStorage (folio_taskprefs)
   so they survive reloads and ride along with cloud sync.
═══════════════════════════════════════════════ */
const TASKPREFS_KEY='folio_taskprefs';
function _taskPrefs(){ try{ const p=JSON.parse(localStorage.getItem(TASKPREFS_KEY)||'{}'); p.colors=p.colors||{}; p.hidden=p.hidden||{}; return p; }catch{ return {colors:{},hidden:{}}; } }
function _saveTaskPrefs(p){ try{ localStorage.setItem(TASKPREFS_KEY,JSON.stringify(p)); }catch(e){} }

/* Standalone tasks — quick tasks that DON'T belong to any database. Kept in their
   own light store so the user can jot tasks without spawning a database for each.
   It's a folio_* key (rides cloud sync; folio_tasks is allow-listed in sync.js). */
const STD_TASKS_KEY='folio_tasks';
function _loadStdTasks(){ try{ return JSON.parse(localStorage.getItem(STD_TASKS_KEY)||'[]'); }catch{ return []; } }
function _saveStdTasks(arr){ try{ localStorage.setItem(STD_TASKS_KEY,JSON.stringify(arr)); }catch(e){} }
/* Columns shown when there are no boards yet (so standalone tasks have a home). */
const TASK_DEFAULT_STATUSES=[{l:'To do',c:'#E05572'},{l:'In progress',c:'#4D88E8'},{l:'Done',c:'#5DC27A'}];
/* Remembered quick-add destination ('standalone' | a board id | '__new__'). */
let _tkLastDest='standalone';

/* The status/select column that makes a table a "board" (Status preferred). */
function taskStatusCol(tbl){ return (tbl.columns||[]).find(c=>c.type==='status') || (tbl.columns||[]).find(c=>c.type==='select') || null; }

/* All boards (tables with a status/select column), each resolved to a colour and
   hidden flag. */
function taskBoards(){
  const prefs=_taskPrefs(); const out=[];
  // Every database that has a status/select column is a task board.
  DB.getTbls().forEach(t=>{ if(taskStatusCol(t)) out.push({id:t.id,name:t.name||'Board',tbl:t}); });
  out.forEach((s,i)=>{ s.color=prefs.colors[s.id]||PALETTE_COLORS[i%PALETTE_COLORS.length]; s.hidden=!!prefs.hidden[s.id]; });
  return out;
}
function toggleTaskSrc(id){ const p=_taskPrefs(); if(p.hidden[id]) delete p.hidden[id]; else p.hidden[id]=true; _saveTaskPrefs(p); renderTasks(); }
function setTaskSrcColor(id,color){ const p=_taskPrefs(); p.colors[id]=color; _saveTaskPrefs(p); renderTasks(); }
function showAllTaskSrc(){ const p=_taskPrefs(); p.hidden={}; _saveTaskPrefs(p); renderTasks(); }

function renderTaskLegend(boards){
  const el=document.getElementById('tk-legend'); if(!el) return;
  if(!boards.length){ el.innerHTML='<span class="cal-leg-empty">No boards yet — add a database with a Status or Select property and its rows show up here.</span>'; return; }
  const anyHidden=boards.some(b=>b.hidden);
  el.innerHTML=boards.map(b=>`<span class="cal-leg${b.hidden?' off':''}" title="${b.hidden?'Show':'Hide'} ${escAttr(b.name)}">
      <label class="cal-leg-dot" style="background:${b.color}" title="Change colour" onclick="event.stopPropagation()"><input type="color" value="${b.color}" oninput="setTaskSrcColor('${b.id}',this.value)"></label>
      <span class="cal-leg-nm" onclick="toggleTaskSrc('${b.id}')">${escHtml(b.name)}</span>
      <button class="cal-leg-del" onclick="event.stopPropagation();tkDeleteBoard('${b.id}')" data-tip="Delete database">&#10005;</button>
    </span>`).join('')
    + (anyHidden?`<button class="cal-leg-all" onclick="showAllTaskSrc()">Show all</button>`:'');
}

/* The board ALWAYS splits into vertical status swim lanes. "Split by database" adds
   a second, horizontal grouping: the status board is repeated as a section per
   database, each showing only THAT database's own statuses — so unrelated status
   sets never collide. Persisted in prefs (legacy groupBy:'board' = split on). */
function _taskSplitDb(){ return _taskPrefs().groupBy==='board'; }
function setTaskGroupBy(mode){ const p=_taskPrefs(); p.groupBy=(mode==='board'?'board':'status'); _saveTaskPrefs(p); renderTasks(); }
function renderTaskToolbar(){
  const el=document.getElementById('tk-tools'); if(!el) return;
  const on=_taskSplitDb();
  el.innerHTML=`<span class="tk-tools-lbl">Split by database</span>
    <div class="tk-seg">
      <button class="tk-seg-b${!on?' on':''}" onclick="setTaskGroupBy('status')">Off</button>
      <button class="tk-seg-b${on?' on':''}" onclick="setTaskGroupBy('board')">On</button>
    </div>`;
}
/* Resolve a row's title via the table's REAL title column (idbRowTitle honours
   tbl.titleCol), not columns[0] — which is wrong once columns are reordered and was
   the cause of titled entries showing as "Untitled". Falls back to the doc title. */
function _tkRowTitle(tbl,row){
  const t=(typeof idbRowTitle==='function'?idbRowTitle(tbl,row):'')||'';
  if(t) return t;
  if(row.docId){ const d=DB.getDoc(row.docId); if(d&&d.title) return d.title; }
  return '';
}
function _tkCard(t,chip){
  const del=t.standalone?`tkDeleteStandalone('${t.stdId}')`:`tkDeleteTask('${t.tblId}','${t.rowId}')`;
  const open=t.standalone?'':`onclick="calOpenRow('${t.tblId}','${t.rowId}')"`;
  return `<div class="tk-card${t.standalone?' tk-card-std':''}" ${open} title="${t.standalone?'Standalone task':'Open task'}">
      <button class="tk-card-del" onclick="event.stopPropagation();${del}" data-tip="Delete task">&#10005;</button>
      <div class="tk-card-title">${escHtml(t.title)||'<span class="tk-mu">Untitled</span>'}</div>
      ${chip?`<div class="tk-card-meta">${chip}</div>`:''}
    </div>`;
}
const _tkBoardChip=t=>`<span class="tk-board-dot" style="background:${t.boardColor}"></span>${escHtml(t.board)}`;
function renderTasks(){
  const boards=taskBoards();
  renderTaskLegend(boards);
  renderTaskToolbar();
  const split=_taskSplitDb();

  // Shared status palette/order — merge boards' status options by label.
  const order=[]; const statusColor={}; const seen=new Set();
  const seeStatus=(label,color)=>{ if(label && !seen.has(label)){ seen.add(label); order.push(label); statusColor[label]=color; } };
  boards.forEach(b=>{ if(b.hidden) return; const sc=taskStatusCol(b.tbl);
    (sc.options||[]).forEach(o=>seeStatus(o.l,o.c)); });

  // Pool every board row + standalone task into one flat list.
  const tasks=[];
  boards.forEach(b=>{ if(b.hidden) return; const tbl=b.tbl, sc=taskStatusCol(tbl);
    (tbl.rows||[]).forEach(row=>{ const sv=row.cells[sc.id]||''; const title=_tkRowTitle(tbl,row);
      if(sv) seeStatus(sv,(sc.options||[]).find(o=>o.l===sv)?.c||'var(--mu)');
      tasks.push({title,tblId:tbl.id,rowId:row.id,board:b.name,boardId:b.id,boardColor:b.color,status:sv}); });
  });
  _loadStdTasks().forEach(t=>{ if(t.status) seeStatus(t.status,statusColor[t.status]||'var(--mu)');
    tasks.push({title:t.title,stdId:t.id,standalone:true,board:'Standalone',boardId:'standalone',boardColor:'var(--mu)',status:t.status||''}); });
  if(!order.length) TASK_DEFAULT_STATUSES.forEach(s=>seeStatus(s.l,s.c));

  const board=document.getElementById('tk-board'); if(!board) return;
  board.classList.toggle('tk-sectioned',split);
  board.innerHTML = split
    ? _tkRenderSectioned(tasks,boards,statusColor)
    : _tkRenderByStatus(tasks,order,statusColor);
}
/* Build one status swim-lane column. `dest` (optional) pins quick-add to a database. */
function _tkStatusCol(c,rows,dest){
  const st=escAttr(c.key==='__nostatus__'?'':c.key);
  const d=dest?`data-dest="${escAttr(dest)}"`:'';
  const items=rows.map(t=>_tkCard(t,c.chip?c.chip(t):'')).join('');
  return `<div class="tk-col">
    <div class="tk-col-h"><span class="tk-col-dot" style="background:${c.color}"></span><span class="tk-col-nm">${escHtml(c.label)}</span><span class="tk-col-ct">${rows.length}</span>
      <button class="tk-col-add" data-status="${st}" ${d} onclick="tkOpenAdd(event,'top')" data-tip="Add a task">&#43;</button></div>
    <div class="tk-col-b">${items}<div class="tk-add" data-status="${st}" ${d} onclick="tkOpenAdd(event,'bottom')"><span class="tk-add-plus">&#43;</span> New task</div></div>
  </div>`;
}
/* Flat: one row of status columns; cards carry a board chip so sources stay distinct. */
function _tkRenderByStatus(tasks,order,statusColor){
  const NO='__nostatus__';
  const groups={}; tasks.forEach(t=>{ const k=t.status||NO; (groups[k]=groups[k]||[]).push(t); });
  const colKeys=order.slice(); if(groups[NO]&&groups[NO].length) colKeys.push(NO);
  return colKeys.map(s=>_tkStatusCol(
    {key:s,label:s===NO?'No status':s,color:s===NO?'var(--mu)':(statusColor[s]||'var(--mu)'),chip:_tkBoardChip},
    groups[s]||[])).join('');
}
/* Split: a horizontal section per database, each its own row of status lanes drawn
   from THAT database's own status options. Cards need no board chip — the section is
   the database, the column is the status. Empty databases still show (with a delete). */
/* Saved section order / collapse state (persisted in task prefs). */
function _tkSecOrder(){ const p=_taskPrefs(); return Array.isArray(p.secOrder)?p.secOrder:[]; }
function _tkSecCollapsed(){ const p=_taskPrefs(); return p.secCollapsed||{}; }
function tkToggleSec(key){ const p=_taskPrefs(); p.secCollapsed=p.secCollapsed||{}; if(p.secCollapsed[key])delete p.secCollapsed[key]; else p.secCollapsed[key]=true; _saveTaskPrefs(p); renderTasks(); }
/* Drag-reorder of database sections. */
let _tkSecDrag=null;
function tkSecDragStart(e,key){ _tkSecDrag=key; try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','sec');}catch(_){} e.stopPropagation(); }
function tkSecDragOver(e){ if(_tkSecDrag==null)return; e.preventDefault(); const sec=e.currentTarget; document.querySelectorAll('.tk-sec.tk-sec-dragover').forEach(s=>{if(s!==sec)s.classList.remove('tk-sec-dragover');}); sec.classList.add('tk-sec-dragover'); }
function tkSecDragEnd(){ _tkSecDrag=null; document.querySelectorAll('.tk-sec-dragover').forEach(s=>s.classList.remove('tk-sec-dragover')); }
function tkSecDrop(e,key){ e.preventDefault(); e.stopPropagation(); const from=_tkSecDrag; tkSecDragEnd(); if(!from||from===key)return;
  const order=[...document.querySelectorAll('.tk-sec')].map(s=>s.dataset.key);
  const fi=order.indexOf(from); if(fi<0)return; order.splice(fi,1);
  const ki=order.indexOf(key); order.splice(ki<0?order.length:ki,0,from);
  const p=_taskPrefs(); p.secOrder=order; _saveTaskPrefs(p); renderTasks();
}
function _tkRenderSectioned(tasks,boards,statusColor){
  let secs=boards.filter(b=>!b.hidden).map(b=>({key:b.id,label:b.name,color:b.color,tbl:b.tbl}));
  if(tasks.some(t=>t.standalone)) secs.push({key:'standalone',label:'Standalone',color:'var(--mu)'});
  if(!secs.length) return `<div class="tk-empty">No databases with a Status or Select property yet — add one and its rows show up here.</div>`;
  // Apply the saved drag order (known keys first in their saved order, new ones after).
  const ord=_tkSecOrder();
  secs.sort((a,b)=>{ const ia=ord.indexOf(a.key), ib=ord.indexOf(b.key); return (ia<0?1e9:ia)-(ib<0?1e9:ib); });
  const collapsed=_tkSecCollapsed();
  const byBoard={}; tasks.forEach(t=>{ (byBoard[t.boardId]=byBoard[t.boardId]||[]).push(t); });
  const NO='__nostatus__';
  return secs.map(sec=>{
    const secTasks=byBoard[sec.key]||[];
    const isC=!!collapsed[sec.key];
    let colsHtml='';
    if(!isC){
      let colDefs;
      if(sec.tbl){ const sc=taskStatusCol(sec.tbl); colDefs=(sc.options||[]).map(o=>({key:o.l,label:o.l,color:o.c})); }
      else { const used=[...new Set(secTasks.map(t=>t.status).filter(Boolean))];
        colDefs=(used.length?used:TASK_DEFAULT_STATUSES.map(s=>s.l)).map(l=>({key:l,label:l,color:statusColor[l]||'var(--mu)'})); }
      const groups={}; secTasks.forEach(t=>{ const k=t.status||NO; (groups[k]=groups[k]||[]).push(t); });
      const colKeys=colDefs.slice(); if(groups[NO]&&groups[NO].length) colKeys.push({key:NO,label:'No status',color:'var(--mu)'});
      colsHtml=`<div class="tk-sec-cols">${colKeys.map(c=>_tkStatusCol(c,groups[c.key]||[],sec.key)).join('')}</div>`;
    }
    const del=sec.tbl?`<button class="tk-sec-del" onclick="event.stopPropagation();tkDeleteBoard('${sec.key}')" data-tip="Delete this database">&#10005;</button>`:'';
    return `<div class="tk-sec${isC?' tk-sec-collapsed':''}" data-key="${escAttr(sec.key)}" ondragover="tkSecDragOver(event)" ondrop="tkSecDrop(event,'${escAttr(sec.key)}')">
      <div class="tk-sec-h" draggable="true" ondragstart="tkSecDragStart(event,'${escAttr(sec.key)}')" ondragend="tkSecDragEnd()">
        <button class="tk-sec-chev${isC?' collapsed':''}" onclick="event.stopPropagation();tkToggleSec('${escAttr(sec.key)}')" title="${isC?'Expand':'Collapse'}">&#9662;</button>
        <span class="tk-col-dot" style="background:${sec.color}"></span><span class="tk-sec-nm">${escHtml(sec.label)}</span><span class="tk-col-ct">${secTasks.length}</span>${del}
        <span class="tk-sec-grip" title="Drag to reorder">⠿</span>
      </div>${colsHtml}
    </div>`;
  }).join('');
}
/* ── Quick add / delete ── */
function _tkDestOptions(){
  const boards=taskBoards().filter(b=>!b.hidden);
  return `<option value="standalone"${_tkLastDest==='standalone'?' selected':''}>Standalone (no database)</option>`
    + boards.map(b=>`<option value="${b.id}"${_tkLastDest===b.id?' selected':''}>${escHtml(b.name)}</option>`).join('')
    + `<option value="__new__"${_tkLastDest==='__new__'?' selected':''}>+ New database…</option>`;
}
/* Open the inline quick-add (title field + destination picker) at the top or bottom
   of a column. The destination decides whether the task goes to a database or stays
   standalone — so a quick task never silently spawns a new database. */
function tkOpenAdd(e,where){
  e.stopPropagation();
  const trg=e.currentTarget;
  const status=trg.getAttribute('data-status')||'';
  const dest=trg.getAttribute('data-dest')||'';   // set in Database mode → destination is fixed to that column
  const col=trg.closest('.tk-col'); if(!col) return;
  const body=col.querySelector('.tk-col-b');
  col.querySelectorAll('.tk-addbox').forEach(x=>x.remove());
  const box=document.createElement('div'); box.className='tk-addbox'; box.dataset.status=status; if(dest) box.dataset.dest=dest;
  // Database mode already knows the destination, so it skips the picker; Status mode
  // keeps the picker so a quick task never silently spawns a new database.
  const picker=dest?'':`<select class="tk-add-dest" data-tip="Where this task lives" onmousedown="event.stopPropagation()" onchange="_tkLastDest=this.value">${_tkDestOptions()}</select>`;
  box.innerHTML=`<input class="tk-add-input" placeholder="Task name…"
      onkeydown="if(event.key==='Enter'){event.preventDefault();tkSubmitAdd(this);}else if(event.key==='Escape'){renderTasks();}">${picker}`;
  if(where==='top') body.insertBefore(box, body.firstChild); else body.insertBefore(box, body.querySelector('.tk-add'));
  box.querySelector('input').focus();
}
function tkSubmitAdd(input){
  const box=input.closest('.tk-addbox'); if(!box) return;
  const status=box.dataset.status||'';
  const dest=box.dataset.dest || box.querySelector('.tk-add-dest')?.value || 'standalone';
  tkCreateTask(status, input.value, dest);
}
function tkCreateTask(status,title,dest){
  title=(title||'').trim();
  _tkLastDest=dest;
  if(!title){ renderTasks(); return; }
  if(dest==='standalone'){
    const arr=_loadStdTasks(); arr.push({id:mkId('tk'),title,status:status||'',createdAt:new Date().toISOString()}); _saveStdTasks(arr);
  }else if(dest==='__new__'){
    const t=blankTbl(); t.name='Tasks'; const sc=taskStatusCol(t); const titleCol=t.columns[0];
    const cells={}; t.columns.forEach(c=>cells[c.id]=''); if(titleCol)cells[titleCol.id]=title; if(sc&&status)cells[sc.id]=status;
    t.rows=[{id:mkId('r'),cells}]; DB.saveTbl(t);
    _tkLastDest=t.id;   // keep adding into THIS new board, not a fresh one each time
  }else{
    const tbl=DB.getTbl(dest);
    if(tbl){ const sc=taskStatusCol(tbl); const titleCol=(typeof idbTitleCol==='function'&&idbTitleCol(tbl))||tbl.columns[0];
      const cells={}; tbl.columns.forEach(c=>cells[c.id]=''); if(titleCol)cells[titleCol.id]=title; if(sc&&status)cells[sc.id]=status;
      tbl.rows=tbl.rows||[]; tbl.rows.push({id:mkId('r'),cells}); DB.saveTbl(tbl); }
  }
  renderTasks();
  // keep adding: re-open the input at the top of the same column for fast entry.
  // Split mode columns repeat per database, so match destination AND status.
  setTimeout(()=>{
    const split=_taskSplitDb();
    const add=[...document.querySelectorAll('.tk-col-add')].find(b=> split
      ? (b.getAttribute('data-dest')||'')===_tkLastDest && (b.getAttribute('data-status')||'')===status
      : (b.getAttribute('data-status')||'')===status);
    if(add) tkOpenAdd({stopPropagation(){},currentTarget:add},'top');
  },0);
}
function tkDeleteTask(tblId,rowId){
  if(typeof idbDeleteRow==='function') idbDeleteRow(tblId,rowId);
  renderTasks();
}
function tkDeleteStandalone(id){
  _saveStdTasks(_loadStdTasks().filter(t=>t.id!==id));
  renderTasks();
}
/* Delete a whole database from the Tasks page (e.g. a leftover empty board).
   Removes the table, its entry docs, and any saved task-prefs for it. */
function tkDeleteBoard(tblId){
  const tbl=DB.getTbl(tblId); if(!tbl) return;
  const n=(tbl.rows||[]).length;
  showConfirm(`Delete the “${tbl.name||'Untitled'}” database${n?` and its ${n} entr${n===1?'y':'ies'}`:''}? This can’t be undone.`,()=>{
    (tbl.rows||[]).forEach(r=>{ if(r.docId){ const d=DB.getDoc(r.docId); if(d&&d.dbId===tblId&&typeof DB.delDoc==='function') DB.delDoc(r.docId); } });
    DB.delTbl(tblId);
    const p=_taskPrefs(); delete p.colors[tblId]; delete p.hidden[tblId]; _saveTaskPrefs(p);
    renderTasks();
  },'Delete','Delete database');
}
