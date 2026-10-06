/* ═══════════════════════════════════════════════
   TRASH  (soft-delete with restore + 30-day auto-purge)

   Deleting a page moves it (and its whole sub-tree) out of the live DB into a
   separate `folio_trash` store instead of dropping it. Because it's a `folio_*`
   key it rides along with cloud sync automatically, and because the docs stay
   intact their media blobs survive — collectRefs() scans the trash so gcBlobs()
   never reclaims a trashed page's images. Heavy media (IndexedDB blobs) is only
   freed when a page is purged: either manually, or after TRASH_TTL_DAYS.

   Entries are tagged with a `_trash` envelope: {batch, at, root, row?}. A single
   delete of a nested page makes one batch covering the whole sub-tree, so Restore
   brings the family back together and the most recent batch is one ⌘Z away.
═══════════════════════════════════════════════ */
const TRASH_KEY='folio_trash';
const TRASH_TTL_DAYS=30;

function _loadTrash(){ try{return JSON.parse(localStorage.getItem(TRASH_KEY)||'[]')}catch{return[]} }
/* Trash shares localStorage's ~5 MB cap with page history. On a genuine quota error,
   trim old history (best-effort data) to make room and retry once before giving up. */
function _saveTrash(arr){
  const s=JSON.stringify(arr);
  for(let attempt=0;attempt<2;attempt++){
    try{ localStorage.setItem(TRASH_KEY,s); return true; }
    catch(e){
      if(!isQuotaError(e)){ console.warn('[trash] couldn’t save Trash',e); return false; }
      const need=s.length-(localStorage.getItem(TRASH_KEY)||'').length+50000;
      if(attempt===0&&typeof trimVersionsToFree==='function'&&trimVersionsToFree(need)) continue;
      console.warn('[trash] localStorage quota reached',lsUsage());
      return false;
    }
  }
  return false;
}
function trashCount(){ return _loadTrash().length; }

/* The page + every descendant (via meta.parent), depth-first. */
function _collectSubtree(id,acc){ acc=acc||[]; acc.push(id);
  DB.getDocs().filter(d=>(d.meta&&d.meta.parent)===id).forEach(c=>_collectSubtree(c.id,acc)); return acc; }

/* ── Move a page (and its sub-tree) to Trash. Returns {batch,count,rootTitle}. */
function trashDoc(rootId){
  const ids=_collectSubtree(rootId,[]);
  if(!ids.length) return null;
  const rootTitle=(DB.getDoc(rootId)||{}).title||'Untitled';
  const batch=mkId('trash'), now=new Date().toISOString();
  const trash=_loadTrash();
  // Build every Trash entry FIRST and persist the Trash list BEFORE touching the live
  // data: if Trash can't be saved (storage full), nothing gets deleted — the old order
  // removed the pages first, so a failed save lost them from both places.
  const lifts=[];   // [{id, tableId}] database rows to lift out once Trash is safe
  ids.forEach(id=>{
    const d=DB.getDoc(id); if(!d) return;
    const entry=JSON.parse(JSON.stringify(d));
    entry._trash={batch, at:now, root:id===rootId};
    // If this page is a database row, stash the row so a restore can re-attach it.
    if(d.dbId){ const t=DB.getTbl(d.dbId);
      if(t){ const row=(t.rows||[]).find(r=>r.docId===id);
        if(row){ entry._trash.row={tableId:d.dbId, idx:t.rows.indexOf(row), row:JSON.parse(JSON.stringify(row))};
          lifts.push({id,tableId:d.dbId}); } } }
    trash.unshift(entry);
  });
  if(!_saveTrash(trash)){
    if(typeof toast==='function') toast('Couldn’t move to Trash — this device’s settings storage (~5 MB) is full. Nothing was deleted.',{type:'error',ms:6000});
    return null;
  }
  lifts.forEach(({id,tableId})=>{ const t=DB.getTbl(tableId);
    if(t){ t.rows=(t.rows||[]).filter(r=>r.docId!==id); DB.saveTbl(t); } });
  ids.forEach(id=>{
    // Drop from the live set: remove from the in-memory cache AND the per-record IDB
    // store (Phase-1 storage has no whole-array flush). Keep versions + media blobs so
    // Restore works — that's why we don't call DB.delDoc (which would delete versions).
    DB._docs=DB._docs.filter(x=>x.id!==id);
    Promise.resolve(Persist.delDoc(id)).catch(e=>console.warn('[trash] per-record delete failed',e));
  });
  if(typeof searchInvalidate==='function') searchInvalidate();
  if(typeof _emitContentChanged==='function') _emitContentChanged();   // notify the sync layer the live set changed
  _pendingUndo=batch;
  // If the page currently open got trashed (e.g. you deleted one of its ancestors),
  // close it — otherwise its pending autosave resurrects it and the breadcrumbs go stale.
  if(S.docId && ids.includes(S.docId)){
    clearTimeout(S.saveTimer); S.docId=null;
    if(S.view==='editor' && typeof nav==='function') nav('home');
  }
  if(typeof renderSidebarLists==='function') renderSidebarLists();   // refresh Recents/tree immediately
  if(typeof refreshActiveLists==='function') refreshActiveLists();   // keep the Documents page in sync
  if(typeof updateTrashBadge==='function') updateTrashBadge();
  return {batch, count:ids.length, rootTitle, ids};
}

/* ── Move a database ENTRY to Trash. Every entry-delete surface (calendar, board,
   table row menu, Tasks page, full Calendar) routes through here, so an entry's
   page can never outlive its row and float around in Recents. Rows that were never
   opened have no page yet — give them one first so they land in Trash, restorable. */
function trashDbRow(tableId,rowId){
  const tbl=DB.getTbl(tableId); if(!tbl) return null;
  const row=(tbl.rows||[]).find(r=>r.id===rowId); if(!row) return null;
  const docId=idbEnsureRowDoc(tbl,row);
  // trashDoc finds the row via the page's dbId — heal pages that lost the link.
  const d=DB.getDoc(docId);
  if(d&&(d.dbId!==tableId||d.rowId!==rowId)){ d.dbId=tableId; d.rowId=rowId; DB.saveDoc(d); }
  if(S.peekOpen&&S.docId===docId&&typeof closeDocPeek==='function') closeDocPeek();
  const res=trashDoc(docId);
  if(typeof idbRerenderSiblings==='function') idbRerenderSiblings(tableId,null);
  return res;
}
/* ── Boot repair: before trashDbRow existed, deleting an entry dropped its row but
   left its page live — reachable from Recents, absent from Trash. Such a page still
   points (dbId) at a database that exists but has no row for it; nothing else in
   the app produces that state (moves re-point dbId, the default-DB migration clears
   it, whole-database deletes remove the pages). Give each orphan a minimal row
   (title only — the old delete discarded the cells) and send it through trashDbRow,
   so it lands in Trash and Restore puts it back in its database. Idempotent. */
function sweepOrphanEntryPages(){
  let n=0;
  DB.getDocs().forEach(d=>{
    if(!d||!d.dbId) return;
    const t=DB.getTbl(d.dbId); if(!t) return;                  // whole DB gone — not this bug
    t.rows=t.rows||[];
    if(t.rows.some(r=>r.docId===d.id)) return;                 // healthy entry
    const cells={}; (t.columns||[]).forEach(c=>cells[c.id]='');
    const tc=typeof idbTitleColId==='function'?idbTitleColId(t):null;
    if(tc) cells[tc]=d.title||'';
    const rid=(d.rowId&&!t.rows.some(r=>r.id===d.rowId))?d.rowId:mkId('r');
    t.rows.push({id:rid,cells,docId:d.id}); DB.saveTbl(t);
    if(trashDbRow(t.id,rid)) n++;
  });
  if(n){ _pendingUndo=null;                                    // ⌘Z must not resurrect boot-time repairs
    if(typeof toast==='function') toast(`Moved ${n} deleted entr${n===1?'y':'ies'} to Trash`,{type:'info',ms:4000}); }
  return n;
}
/* Confirm first — the ✕ on calendar events / board cards is easy to hit by accident. */
function confirmTrashDbRow(tableId,rowId,after){
  const tbl=DB.getTbl(tableId); const row=tbl&&(tbl.rows||[]).find(r=>r.id===rowId); if(!row) return;
  const title=(typeof idbRowTitle==='function'&&idbRowTitle(tbl,row))||'Untitled';
  showConfirm(`Move “${title}” to Trash? You can restore it from Trash for ${TRASH_TTL_DAYS} days.`,()=>{
    const res=trashDbRow(tableId,rowId);
    if(typeof after==='function') after();
    if(res&&typeof toast==='function') toast(`Moved to Trash · ${undoHint()} to undo`);
  },'Move to Trash','Delete entry');
}

/* ── Restore every entry in a batch back into the live DB. */
function restoreTrash(batch){
  const trash=_loadTrash(); const keep=[], restored=[];
  trash.forEach(e=>{ (e._trash&&e._trash.batch===batch?restored:keep).push(e); });
  if(!restored.length) return 0;
  restored.forEach(e=>{
    const stash=e._trash&&e._trash.row;
    const clean=JSON.parse(JSON.stringify(e)); delete clean._trash;
    DB.saveDoc(clean);
    if(stash){ const t=DB.getTbl(stash.tableId);
      if(t && !(t.rows||[]).some(r=>r.docId===clean.id)){ t.rows=t.rows||[];
        // Back into its original slot (older trash entries have no idx → append).
        const at=Number.isInteger(stash.idx)?Math.min(stash.idx,t.rows.length):t.rows.length;
        t.rows.splice(at,0,stash.row); DB.saveTbl(t);
        if(typeof idbRerenderSiblings==='function') idbRerenderSiblings(stash.tableId,null); } }
  });
  _saveTrash(keep);
  if(_pendingUndo===batch) _pendingUndo=null;
  if(typeof updateTrashBadge==='function') updateTrashBadge();
  return restored.length;
}

/* ── Permanent delete: drop from trash, free version history, reclaim media. */
function _purgeIds(ids){
  if(!ids.length) return;
  const idset=new Set(ids);
  _saveTrash(_loadTrash().filter(e=>!idset.has(e.id)));
  ids.forEach(id=>{ if(typeof deleteVersions==='function') deleteVersions(id); });
  if(typeof gcBlobs==='function') gcBlobs();   // reclaim now-orphaned image/file blobs
  if(typeof updateTrashBadge==='function') updateTrashBadge();
}
function purgeTrashBatch(batch){ _purgeIds(_loadTrash().filter(e=>e._trash&&e._trash.batch===batch).map(e=>e.id)); }
function emptyTrash(){ _purgeIds(_loadTrash().map(e=>e.id)); }
/* Runs at boot: anything past its TTL is gone for good. */
function purgeExpiredTrash(){
  const cut=Date.now()-TRASH_TTL_DAYS*864e5;
  const ids=_loadTrash().filter(e=>e._trash&&new Date(e._trash.at).getTime()<cut).map(e=>e.id);
  if(ids.length) _purgeIds(ids);
}

/* ── One-shot "undo last delete" via ⌘Z / Ctrl+Z ──────────────────────────────
   Stays armed only until the next real edit (cleared from commitHistory) or the
   next delete. Capture-phase + stopImmediatePropagation so it wins over the
   editor's own undo handler. */
let _pendingUndo=null;
function clearTrashUndo(){ _pendingUndo=null; }
document.addEventListener('keydown',e=>{
  if(!_pendingUndo) return;
  if(!(e.metaKey||e.ctrlKey) || e.shiftKey) return;
  if(e.key.toLowerCase()!=='z') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const batch=_pendingUndo; const n=restoreTrash(batch);
  if(typeof renderSidebarLists==='function') renderSidebarLists();
  if(typeof refreshActiveLists==='function') refreshActiveLists();
  if(n && typeof toast==='function') toast('Page restored');
},true);

/* ── Trash panel UI ──────────────────────────────────────────────────────── */
function _isMac(){ return /Mac|iP(hone|ad|od)/.test(navigator.platform||navigator.userAgent||''); }
function undoHint(){ return _isMac()?'⌘Z':'Ctrl+Z'; }

function updateTrashBadge(){
  const c=trashCount();
  const el=document.getElementById('sb-trash-count'); if(el) el.textContent=c?` (${c})`:'';
  const btn=document.getElementById('cfg-empty-trash');
  if(btn){ const ico='<svg class="lic" viewBox="0 0 24 24" width="14" height="14" style="vertical-align:-2px;margin-right:6px"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>'; btn.innerHTML=ico+(c?`Empty Trash now (${c})`:'Empty Trash now'); btn.disabled=!c; btn.style.opacity=c?'':'.5'; }
}
function openTrashPanel(){ renderTrashPanel();
  document.getElementById('trash-panel').classList.add('open');
  document.getElementById('trash-ovl').classList.add('open'); }
function closeTrashPanel(){
  document.getElementById('trash-panel').classList.remove('open');
  document.getElementById('trash-ovl').classList.remove('open'); }

function renderTrashPanel(){
  const list=document.getElementById('trash-list'); if(!list) return;
  const trash=_loadTrash();
  const emptyBtn=document.getElementById('trash-empty-btn'); if(emptyBtn) emptyBtn.style.display=trash.length?'':'none';
  if(!trash.length){ list.innerHTML='<div class="vh-empty">Trash is empty.<br>Deleted pages rest here for '+TRASH_TTL_DAYS+' days before they’re gone for good.</div>'; return; }
  // Group entries by their delete batch; newest first.
  const groups={}; trash.forEach(e=>{ const b=e._trash.batch; (groups[b]=groups[b]||[]).push(e); });
  const batches=Object.values(groups).sort((a,b)=> new Date(b[0]._trash.at)-new Date(a[0]._trash.at));
  const icon=(typeof _sbIcon==='function')?_sbIcon:()=> '';
  list.innerHTML=batches.map(g=>{
    const root=g.find(e=>e._trash.root)||g[0];
    const extra=g.length-1;
    const at=root._trash.at;
    const left=Math.max(0, TRASH_TTL_DAYS-Math.floor((Date.now()-new Date(at).getTime())/864e5));
    const urg=left<=3?'urgent':(left<=7?'soon':'');
    return `<div class="vh-item trash-item">
      <div class="vh-it-top">${icon(root)}<span class="vh-it-time">${escHtml(root.title||'Untitled')}</span>${extra?`<span class="vh-it-lbl">+${extra} sub-page${extra>1?'s':''}</span>`:''}</div>
      <div class="vh-it-meta">Deleted ${fmtDate(at)} <span class="trash-left ${urg}">${left}d left</span></div>
      <div class="trash-actions">
        <button class="trash-btn" onclick="restoreFromTrash('${root._trash.batch}')">Restore</button>
        <button class="trash-btn danger" onclick="confirmPurge('${root._trash.batch}','${escAttr(root.title||'Untitled')}')">Delete forever</button>
      </div></div>`;
  }).join('');
}
function restoreFromTrash(batch){
  restoreTrash(batch);
  if(typeof renderSidebarLists==='function') renderSidebarLists();
  if(typeof refreshActiveLists==='function') refreshActiveLists();
  renderTrashPanel(); if(typeof toast==='function') toast('Page restored');
}
function confirmPurge(batch,title){
  showConfirm(`Permanently delete “${title}” and everything inside it? This frees its storage and can’t be undone.`,
    ()=>{ purgeTrashBatch(batch); renderTrashPanel(); if(typeof toast==='function') toast('Deleted forever'); },
    'Delete forever','Delete permanently');
}
function confirmEmptyTrash(){
  showConfirm('Permanently delete everything in Trash? This frees their storage and can’t be undone.',
    ()=>{ emptyTrash(); renderTrashPanel(); if(typeof toast==='function') toast('Trash emptied'); },
    'Empty Trash','Empty Trash');
}
