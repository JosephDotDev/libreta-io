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
const TASK_DEFAULT_STATUSES=[{l:'To do',c:'#C47D32'},{l:'In progress',c:'#4E7EC4'},{l:'Done',c:'#4E9E72'}];
/* Remembered quick-add destination ('standalone' | a board id | '__new__'). */
let _tkLastDest='standalone';

/* The status/select column that makes a table a "board" (Status preferred). */
function taskStatusCol(tbl){ return (tbl.columns||[]).find(c=>c.type==='status') || (tbl.columns||[]).find(c=>c.type==='select') || null; }

/* All boards (tables with a status/select column), each resolved to a colour and
   hidden flag. */
function taskBoards(){
  const prefs=_taskPrefs(); const out=[];
  // The "default database" is plumbing: every page silently joins it to share
  // sortable properties, so it isn't a real task board — skip it (otherwise every
  // page in the workspace shows up here as a task).
  const defaultDbId=(typeof getCfg==='function'&&getCfg().defaultDbId)||null;
  DB.getTbls().forEach(t=>{ if(t.id!==defaultDbId && taskStatusCol(t)) out.push({id:t.id,name:t.name||'Board',tbl:t}); });
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
    </span>`).join('')
    + (anyHidden?`<button class="cal-leg-all" onclick="showAllTaskSrc()">Show all</button>`:'');
}

function renderTasks(){
  const boards=taskBoards();
  renderTaskLegend(boards);

  // Status columns / ordering — merge each board's status options by label so boards
  // that share "To do / Doing / Done" line up.
  const order=[]; const statusColor={}; const seen=new Set();
  const seeStatus=(label,color)=>{ if(label && !seen.has(label)){ seen.add(label); order.push(label); statusColor[label]=color; } };
  boards.forEach(b=>{ if(b.hidden) return; const sc=taskStatusCol(b.tbl);
    (sc.options||[]).forEach(o=>seeStatus(o.l,o.c)); });

  // Pool board rows + standalone tasks into status buckets.
  const groups={}; const NO='__nostatus__';
  const add=(s,task)=>{ (groups[s]=groups[s]||[]).push(task); };
  boards.forEach(b=>{ if(b.hidden) return; const tbl=b.tbl; const sc=taskStatusCol(tbl);
    const titleCol=tbl.columns&&tbl.columns[0];
    (tbl.rows||[]).forEach(row=>{
      const sv=row.cells[sc.id]||'';
      const title=(titleCol?row.cells[titleCol.id]:'')||'';
      const task={ title, tblId:tbl.id, rowId:row.id, board:b.name, boardColor:b.color };
      if(sv){ seeStatus(sv,(sc.options||[]).find(o=>o.l===sv)?.c||'var(--mu)'); add(sv,task); } else add(NO,task);
    });
  });
  _loadStdTasks().forEach(t=>{
    const task={ title:t.title, stdId:t.id, standalone:true, board:'Standalone', boardColor:'var(--mu)' };
    if(t.status){ seeStatus(t.status,statusColor[t.status]||'var(--mu)'); add(t.status,task); } else add(NO,task);
  });

  // No real statuses anywhere → seed default columns so tasks have somewhere to land.
  if(!order.length) TASK_DEFAULT_STATUSES.forEach(s=>seeStatus(s.l,s.c));

  const board=document.getElementById('tk-board'); if(!board) return;
  const colKeys=order.slice();
  if(groups[NO]&&groups[NO].length) colKeys.push(NO);

  const card=t=> t.standalone
    ? `<div class="tk-card tk-card-std" title="Standalone task">
        <button class="tk-card-del" onclick="event.stopPropagation();tkDeleteStandalone('${t.stdId}')" data-tip="Delete task">&#10005;</button>
        <div class="tk-card-title">${escHtml(t.title)||'<span class="tk-mu">Untitled</span>'}</div>
        <div class="tk-card-meta"><span class="tk-board-dot" style="background:${t.boardColor}"></span>${escHtml(t.board)}</div>
      </div>`
    : `<div class="tk-card" onclick="calOpenRow('${t.tblId}','${t.rowId}')" title="Open task">
        <button class="tk-card-del" onclick="event.stopPropagation();tkDeleteTask('${t.tblId}','${t.rowId}')" data-tip="Delete task">&#10005;</button>
        <div class="tk-card-title">${escHtml(t.title)||'<span class="tk-mu">Untitled</span>'}</div>
        <div class="tk-card-meta"><span class="tk-board-dot" style="background:${t.boardColor}"></span>${escHtml(t.board)}</div>
      </div>`;

  board.innerHTML=colKeys.map(s=>{
    const label=s===NO?'No status':s;
    const dot=s===NO?'var(--mu)':(statusColor[s]||'var(--mu)');
    const st=escAttr(s===NO?'':s);
    const items=(groups[s]||[]).map(card).join('');
    return `<div class="tk-col">
      <div class="tk-col-h"><span class="tk-col-dot" style="background:${dot}"></span><span class="tk-col-nm">${escHtml(label)}</span><span class="tk-col-ct">${(groups[s]||[]).length}</span>
        <button class="tk-col-add" data-status="${st}" onclick="tkOpenAdd(event,'top')" data-tip="Add a task">&#43;</button></div>
      <div class="tk-col-b">${items}<div class="tk-add" data-status="${st}" onclick="tkOpenAdd(event,'bottom')"><span class="tk-add-plus">&#43;</span> New task</div></div>
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
  const status=e.currentTarget.getAttribute('data-status')||'';
  const col=e.currentTarget.closest('.tk-col'); if(!col) return;
  const body=col.querySelector('.tk-col-b');
  col.querySelectorAll('.tk-addbox').forEach(x=>x.remove());
  const box=document.createElement('div'); box.className='tk-addbox'; box.dataset.status=status;
  box.innerHTML=`<input class="tk-add-input" placeholder="Task name…"
      onkeydown="if(event.key==='Enter'){event.preventDefault();tkSubmitAdd(this);}else if(event.key==='Escape'){renderTasks();}">
    <select class="tk-add-dest" data-tip="Where this task lives" onmousedown="event.stopPropagation()" onchange="_tkLastDest=this.value">${_tkDestOptions()}</select>`;
  if(where==='top') body.insertBefore(box, body.firstChild); else body.insertBefore(box, body.querySelector('.tk-add'));
  box.querySelector('input').focus();
}
function tkSubmitAdd(input){
  const box=input.closest('.tk-addbox'); if(!box) return;
  const status=box.dataset.status||'';
  const dest=box.querySelector('.tk-add-dest')?.value||'standalone';
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
    if(tbl){ const sc=taskStatusCol(tbl); const titleCol=tbl.columns[0];
      const cells={}; tbl.columns.forEach(c=>cells[c.id]=''); if(titleCol)cells[titleCol.id]=title; if(sc&&status)cells[sc.id]=status;
      tbl.rows=tbl.rows||[]; tbl.rows.push({id:mkId('r'),cells}); DB.saveTbl(tbl); }
  }
  renderTasks();
  // keep adding: re-open the input at the top of the same column for fast entry
  setTimeout(()=>{ const add=[...document.querySelectorAll('.tk-col-add')].find(b=>(b.getAttribute('data-status')||'')===status); if(add) tkOpenAdd({stopPropagation(){},currentTarget:add},'top'); },0);
}
function tkDeleteTask(tblId,rowId){
  if(typeof idbDeleteRow==='function') idbDeleteRow(tblId,rowId);
  renderTasks();
}
function tkDeleteStandalone(id){
  _saveStdTasks(_loadStdTasks().filter(t=>t.id!==id));
  renderTasks();
}
