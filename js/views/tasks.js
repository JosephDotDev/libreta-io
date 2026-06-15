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

  // Status columns / ordering — collect each board's status options in order,
  // merging by label (so boards that share "To do / Doing / Done" line up).
  const order=[]; const statusColor={}; const seen=new Set();
  boards.forEach(b=>{ if(b.hidden) return; const sc=taskStatusCol(b.tbl);
    (sc.options||[]).forEach(o=>{ if(o.l && !seen.has(o.l)){ seen.add(o.l); order.push(o.l); statusColor[o.l]=o.c; } });
  });

  // Pool every row from every visible board into status buckets.
  const groups={}; const NO='__nostatus__'; let total=0;
  const add=(s,task)=>{ (groups[s]=groups[s]||[]).push(task); total++; };
  boards.forEach(b=>{ if(b.hidden) return; const tbl=b.tbl; const sc=taskStatusCol(tbl);
    const titleCol=tbl.columns&&tbl.columns[0];
    (tbl.rows||[]).forEach(row=>{
      const sv=row.cells[sc.id]||'';
      const title=(titleCol?row.cells[titleCol.id]:'')||'Untitled';
      const task={ title, tblId:tbl.id, rowId:row.id, board:b.name, boardColor:b.color };
      if(sv){ if(!seen.has(sv)){ seen.add(sv); order.push(sv); statusColor[sv]=(sc.options||[]).find(o=>o.l===sv)?.c; } add(sv,task); }
      else add(NO,task);
    });
  });

  const board=document.getElementById('tk-board'); if(!board) return;
  if(!boards.length || total===0){
    board.innerHTML=`<div class="tk-empty">${boards.length?'No tasks yet — add rows to a board and set their status.':'No boards yet.'}<br><span>A “board” is any database with a Status or Select property.</span></div>`;
    return;
  }
  // Columns: each populated status in merged order, then "No status" last.
  const colKeys=order.filter(s=>groups[s]&&groups[s].length);
  if(groups[NO]&&groups[NO].length) colKeys.push(NO);
  const card=t=>`<div class="tk-card" onclick="calOpenRow('${t.tblId}','${t.rowId}')" title="Open task">
      <div class="tk-card-title">${escHtml(t.title)}</div>
      <div class="tk-card-meta"><span class="tk-board-dot" style="background:${t.boardColor}"></span>${escHtml(t.board)}</div>
    </div>`;
  board.innerHTML=colKeys.map(s=>{
    const label=s===NO?'No status':s;
    const dot=s===NO?'var(--mu)':(statusColor[s]||'var(--mu)');
    return `<div class="tk-col">
      <div class="tk-col-h"><span class="tk-col-dot" style="background:${dot}"></span><span class="tk-col-nm">${escHtml(label)}</span><span class="tk-col-ct">${groups[s].length}</span></div>
      <div class="tk-col-b">${groups[s].map(card).join('')}</div>
    </div>`;
  }).join('');
}
