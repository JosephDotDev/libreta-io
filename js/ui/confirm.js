/* ═══════════════════════════════════════════════
   CUSTOM CONFIRM DIALOG
═══════════════════════════════════════════════ */
function showConfirm(msg, onOk, okLabel, title) {
  document.getElementById('cfm-msg').textContent   = msg   || 'This cannot be undone.';
  document.getElementById('cfm-ok').textContent    = okLabel|| 'Delete';
  document.getElementById('cfm-title').textContent = title  || 'Are you sure?';
  document.getElementById('cfm-ok').onclick = ()=>{ closeConfirm(); onOk&&onOk(); };
  document.getElementById('cfm').classList.add('open');
}
function closeConfirm(){ document.getElementById('cfm').classList.remove('open'); }

