/* ═══════════════════════════════════════════════════════════════════════════
   PER-RECORD SYNC — planReconcile() truth-table tests

   planReconcile(local, remote, base) is the PURE decision core of records-mode sync
   (js/cloud/sync.js). Given the local manifest, the remote manifest, and the
   last-synced base, it returns { download, upload, delLocal, tombstone } — the keys to
   pull, push, delete locally, and tombstone. Every real-world sync bug we hit traced
   back to a case this table now pins down. Keep this in sync with planReconcile.

   Run it:
     • open tests/reconcile.html in a browser, OR
     • in the app console:  runReconcileTests(Cloud.planReconcile)

   Each key is "doc:<id>" | "tbl:<id>" | "kv". Timestamps are ISO strings (they sort
   lexicographically == chronologically), which is the whole contract — a record and a
   tombstone are compared by these strings.
═══════════════════════════════════════════════════════════════════════════ */
(function(root){
  // Ordered timestamps, oldest → newest.
  const T0='2026-01-01T00:00:00.000Z';
  const T1='2026-06-23T01:00:00.000Z';
  const T2='2026-06-23T02:00:00.000Z';
  const T3='2026-06-23T03:00:00.000Z';
  const KV=T1; // kv stamp value used where kv is unchanged

  /* Each case: { name, local, remote:{recs,deleted}, base:{recs,deleted?}, expect } */
  const RECONCILE_TESTS = [
    { name:'fresh_seed — first push, remote empty → upload everything',
      local:{'doc:a':T1,'doc:b':T1,'kv':KV}, remote:{recs:{},deleted:{}}, base:{},
      expect:{ upload:['doc:a','doc:b','kv'] } },

    { name:'in_sync — identical local/remote/base → no-op',
      local:{'doc:a':T1,'kv':KV}, remote:{recs:{'doc:a':T1,'kv':KV},deleted:{}}, base:{recs:{'doc:a':T1,'kv':KV},deleted:{}},
      expect:{} },

    { name:'remote_newer — a remote edit → download',
      local:{'doc:a':T1,'kv':KV}, remote:{recs:{'doc:a':T2,'kv':KV},deleted:{}}, base:{recs:{'doc:a':T1,'kv':KV},deleted:{}},
      expect:{ download:['doc:a'] } },

    { name:'local_newer — our edit → upload',
      local:{'doc:a':T2,'kv':KV}, remote:{recs:{'doc:a':T1,'kv':KV},deleted:{}}, base:{recs:{'doc:a':T1,'kv':KV},deleted:{}},
      expect:{ upload:['doc:a'] } },

    { name:'concurrent_different_pages — A local-newer, B remote-newer → upload A + download B',
      local:{'doc:a':T3,'doc:b':T1,'kv':KV}, remote:{recs:{'doc:a':T1,'doc:b':T3,'kv':KV},deleted:{}}, base:{recs:{'doc:a':T1,'doc:b':T1,'kv':KV},deleted:{}},
      expect:{ upload:['doc:a'], download:['doc:b'] } },

    { name:'new_remote_doc — page created on another device → download',
      local:{'kv':KV}, remote:{recs:{'doc:new':T2,'kv':KV},deleted:{}}, base:{recs:{'kv':KV},deleted:{}},
      expect:{ download:['doc:new'] } },

    { name:'local_delete — we deleted it, remote unchanged → tombstone',
      local:{'kv':KV}, remote:{recs:{'doc:x':T1,'kv':KV},deleted:{}}, base:{recs:{'doc:x':T1,'kv':KV},deleted:{}},
      expect:{ tombstone:['doc:x'] } },

    { name:'local_delete_vs_remote_edit — we deleted, but remote edited after our base → their edit wins (download)',
      local:{'kv':KV}, remote:{recs:{'doc:x':T3,'kv':KV},deleted:{}}, base:{recs:{'doc:x':T1,'kv':KV},deleted:{}},
      expect:{ download:['doc:x'] } },

    { name:'receive_delete — remote tombstone newer than our copy → delete locally',
      local:{'doc:x':T1,'kv':KV}, remote:{recs:{'kv':KV},deleted:{'doc:x':T2}}, base:{recs:{'doc:x':T1,'kv':KV},deleted:{}},
      expect:{ delLocal:['doc:x'] } },

    { name:'receive_delete_but_local_newer — we edited after the remote delete → resurrect (upload)',
      local:{'doc:x':T3,'kv':KV}, remote:{recs:{'kv':KV},deleted:{'doc:x':T2}}, base:{recs:{'doc:x':T1,'kv':KV},deleted:{}},
      expect:{ upload:['doc:x'] } },

    { name:'both_deleted_stable — neither has it, remote tombstone present → no-op',
      local:{'kv':KV}, remote:{recs:{'kv':KV},deleted:{'doc:x':T2}}, base:{recs:{'kv':KV},deleted:{'doc:x':T2}},
      expect:{} },

    { name:'restore_sender — we restored it (fresh ts) over an older tombstone → upload',
      local:{'doc:x':T3,'kv':KV}, remote:{recs:{'kv':KV},deleted:{'doc:x':T2}}, base:{recs:{'kv':KV},deleted:{'doc:x':T2}},
      expect:{ upload:['doc:x'] } },

    { name:'restore_receiver — remote lists rec NEWER than its lingering tombstone → download (not ignore)',
      local:{'kv':KV}, remote:{recs:{'doc:x':T3,'kv':KV},deleted:{'doc:x':T2}}, base:{recs:{'kv':KV},deleted:{'doc:x':T2}},
      expect:{ download:['doc:x'] } },

    { name:'tombstone_newer_than_rec_local_present — remote rec old + tombstone new, we still hold it → delete',
      local:{'doc:x':T1,'kv':KV}, remote:{recs:{'doc:x':T1,'kv':KV},deleted:{'doc:x':T3}}, base:{recs:{'doc:x':T1,'kv':KV},deleted:{}},
      expect:{ delLocal:['doc:x'] } },

    { name:'tombstone_newer_than_rec_local_absent — same but we already lack it → no-op',
      local:{'kv':KV}, remote:{recs:{'doc:x':T1,'kv':KV},deleted:{'doc:x':T3}}, base:{recs:{'kv':KV},deleted:{}},
      expect:{} },

    { name:'kv_local_change — settings/trash changed here → upload kv',
      local:{'kv':T2}, remote:{recs:{'kv':T1},deleted:{}}, base:{recs:{'kv':T1},deleted:{}},
      expect:{ upload:['kv'] } },

    { name:'kv_remote_change — settings/trash changed elsewhere → download kv',
      local:{'kv':T1}, remote:{recs:{'kv':T2},deleted:{}}, base:{recs:{'kv':T1},deleted:{}},
      expect:{ download:['kv'] } },

    { name:'equal_timestamps — same ts on both sides → no spurious transfer',
      local:{'doc:a':T1,'kv':KV}, remote:{recs:{'doc:a':T1,'kv':KV},deleted:{}}, base:{recs:{'doc:a':T0,'kv':KV},deleted:{}},
      expect:{} },
  ];

  function runReconcileTests(planReconcile){
    if(typeof planReconcile!=='function') throw new Error('pass Cloud.planReconcile');
    const sortAll=o=>{ const r={download:[],upload:[],delLocal:[],tombstone:[]};
      ['download','upload','delLocal','tombstone'].forEach(k=> r[k]=[...(o[k]||[])].sort()); return r; };
    const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const results=RECONCILE_TESTS.map(c=>{
      let got, err=null;
      try{ got=sortAll(planReconcile(c.local, c.remote, c.base)); }catch(e){ err=String(e); got=null; }
      const want=sortAll(c.expect||{});
      const pass=!err && eq(got,want);
      return { name:c.name, pass, want, got, err };
    });
    const passed=results.filter(r=>r.pass).length;
    const summary={ passed, failed:results.length-passed, total:results.length,
      failures: results.filter(r=>!r.pass).map(r=>({name:r.name, want:r.want, got:r.got, err:r.err})) };
    return summary;
  }

  root.RECONCILE_TESTS = RECONCILE_TESTS;
  root.runReconcileTests = runReconcileTests;
})(typeof globalThis!=='undefined'?globalThis:window);
