/* ═══════════════════════════════════════════════════════════════════════════
   PER-BLOB MEDIA SYNC — needsMediaSync() / planMedia() truth-table tests

   These are the PURE decision core of media sync (js/cloud/sync.js, spec:
   docs/media-sync-spec.md). Blobs are content-addressed (img_<hash>), so unlike
   planReconcile there's no LWW/tombstone logic — "does this ref exist yet" is the
   only fact that matters:
     • needsMediaSync(refs, idbKeys, known) — should reconcileMedia touch the network
       at all? False the instant nothing referenced is missing-or-unconfirmed, which
       is what keeps a steady-state workspace at zero media-sync egress.
     • planMedia(refs, idbKeys, known, remoteRefs) — once the cloud's blob set is
       known, classify each ref into download / upload / skip.

   Run it:
     • open tests/media-reconcile.html in a browser, OR
     • in the app console: runMediaReconcileTests(Cloud.needsMediaSync, Cloud.planMedia)
═══════════════════════════════════════════════════════════════════════════ */
(function(root){
  /* Each case exercises both functions against the same scenario, since a scenario
     where needsMediaSync is false should never reach planMedia in real use — but we
     still assert planMedia's classification is consistent (empty) there too. */
  const MEDIA_TESTS = [
    { name:'steady_state — referenced blob already local + known → no work',
      refs:['img_a'], idbKeys:['img_a'], known:['img_a'], remoteRefs:{'img_a':'ts'},
      needsSync:false, expect:{} },

    { name:'new_local_blob — held locally, never confirmed, cloud lacks it → upload',
      refs:['img_new'], idbKeys:['img_new'], known:[], remoteRefs:{},
      needsSync:true, expect:{ upload:['img_new'] } },

    { name:'missing_but_cloud_has_it — referenced (e.g. just-pulled doc), not local yet, cloud has it → download',
      refs:['img_remote'], idbKeys:[], known:[], remoteRefs:{'img_remote':'ts'},
      needsSync:true, expect:{ download:['img_remote'] } },

    { name:'missing_and_cloud_lacks_it — neither side has bytes yet (race) → left alone, retried later',
      refs:['img_notyet'], idbKeys:[], known:[], remoteRefs:{},
      needsSync:true, expect:{} },

    { name:'cross_device_dedup — held locally + unconfirmed, but cloud already has this exact ref (another device uploaded it) → skip, no re-upload',
      refs:['img_shared'], idbKeys:['img_shared'], known:[], remoteRefs:{'img_shared':'ts'},
      needsSync:true, expect:{ skip:['img_shared'] } },

    { name:'mixed — one steady, one downloadable, one uploadable, all in one pass',
      refs:['img_fine','img_dl','img_up'], idbKeys:['img_fine','img_up'], known:['img_fine'], remoteRefs:{'img_dl':'ts'},
      needsSync:true, expect:{ download:['img_dl'], upload:['img_up'] } },

    { name:'empty_refs — nothing referenced at all → no work',
      refs:[], idbKeys:['img_orphan'], known:[], remoteRefs:{'img_orphan':'ts'},
      needsSync:false, expect:{} },

    { name:'known_but_evicted — confirmed synced earlier, but IDB no longer has the bytes (eviction) → re-fetch',
      refs:['img_evicted'], idbKeys:[], known:['img_evicted'], remoteRefs:{'img_evicted':'ts'},
      needsSync:true, expect:{ download:['img_evicted'] } },
  ];

  function runMediaReconcileTests(needsMediaSync, planMedia){
    if(typeof needsMediaSync!=='function') throw new Error('pass Cloud.needsMediaSync');
    if(typeof planMedia!=='function') throw new Error('pass Cloud.planMedia');
    const sortAll=o=>{ const r={download:[],upload:[],skip:[]};
      ['download','upload','skip'].forEach(k=> r[k]=[...(o[k]||[])].sort()); return r; };
    const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const results=MEDIA_TESTS.map(c=>{
      let gotNeeds, gotPlan, err=null;
      try{
        gotNeeds = needsMediaSync(c.refs, c.idbKeys, c.known);
        gotPlan = sortAll(planMedia(c.refs, c.idbKeys, c.known, c.remoteRefs));
      }catch(e){ err=String(e); gotNeeds=null; gotPlan=null; }
      const wantPlan = sortAll(c.expect||{});
      const pass = !err && gotNeeds===c.needsSync && eq(gotPlan,wantPlan);
      return { name:c.name, pass, wantNeeds:c.needsSync, gotNeeds, wantPlan, gotPlan, err };
    });
    const passed=results.filter(r=>r.pass).length;
    const summary={ passed, failed:results.length-passed, total:results.length,
      failures: results.filter(r=>!r.pass).map(r=>({name:r.name, wantNeeds:r.wantNeeds, gotNeeds:r.gotNeeds, wantPlan:r.wantPlan, gotPlan:r.gotPlan, err:r.err})) };
    return summary;
  }

  root.MEDIA_TESTS = MEDIA_TESTS;
  root.runMediaReconcileTests = runMediaReconcileTests;
})(typeof window!=='undefined'?window:globalThis);
