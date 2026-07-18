/* ═══════════════════════════════════════════════
   PROPERTY FILTERING (shared across list views)
═══════════════════════════════════════════════ */
const FILT={documents:[],alldocs:[]};
function collectFilterProps(){
  const map={};
  DB.getDocs().forEach(d=>(d.props||[]).forEach(p=>{
    if(!['select','checkbox','date'].includes(p.type)) return;
    if(!map[p.name]) map[p.name]={name:p.name,type:p.type,opts:new Set()};
    if(p.type==='select'){
      if(p.value) map[p.name].opts.add(p.value);
      (p.options||[]).forEach(o=>o.l&&map[p.name].opts.add(o.l));
    }
    if(p.type==='date'&&p.value) map[p.name].opts.add(p.value);
  }));
  return Object.values(map).map(x=>({name:x.name,type:x.type,opts:[...x.opts].sort()}));
}
function fmtFilterDate(v){return new Date(v+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
function docMatchesFilters(doc,conds){
  if(!conds||!conds.length) return true;
  return conds.every(cd=>{
    const p=(doc.props||[]).find(x=>x.name===cd.name);
    if(!p) return false;
    if(cd.type==='checkbox') return cd.values.includes(String(!!p.value));
    if(cd.type==='date'){
      const has=!!p.value;
      return cd.values.some(v=> v==='__any__'?has : v==='__none__'?!has : p.value===v);
    }
    return cd.values.includes(p.value);
  });
}
function openFilterPop(e,scope){
  e.stopPropagation(); S.filterScope=scope; renderFilterPop();
  const pop=document.getElementById('filter-pop');
  const r=e.currentTarget.getBoundingClientRect();
  pop.style.top=(r.bottom+6)+'px'; pop.style.left=Math.min(r.left,window.innerWidth-250)+'px';
  pop.classList.add('open'); openOvl();
}
function renderFilterPop(){
  const scope=S.filterScope; const conds=FILT[scope]||[];
  const props=collectFilterProps();
  let html=`<div class="pm-hdr">Filter by property</div><div class="pm-body" style="max-height:300px;overflow-y:auto">`;
  if(!props.length) html+=`<div style="padding:12px;color:var(--mu);font-size:11px">No filterable properties yet. Add a Select, Checkbox, or Date property.</div>`;
  props.forEach(pr=>{
    html+=`<div class="filt-grp">${escHtml(pr.name)}</div>`;
    const cond=conds.find(c=>c.name===pr.name);
    const rows=pr.type==='select'
      ? pr.opts.map(o=>[o,o])
      : pr.type==='date'
        ? [['__any__','Has a date'],['__none__','No date'],...pr.opts.map(v=>[v,fmtFilterDate(v)])]
        : [['true','Checked'],['false','Unchecked']];
    rows.forEach(([v,lbl])=>{
      const on=cond&&cond.values.includes(v);
      html+=`<div class="filt-opt${on?' on':''}" onclick="toggleFilterVal('${escAttr(pr.name)}','${pr.type}','${escAttr(v)}')"><span class="filt-box">${on?'&#10003;':''}</span>${escHtml(lbl)}</div>`;
    });
  });
  html+=`</div>`;
  if(conds.length) html+=`<div style="padding:8px 12px;border-top:1px solid var(--bd)"><button class="pe-db" style="width:100%" onclick="clearFilters()">Clear all filters</button></div>`;
  document.getElementById('filter-pop').innerHTML=html;
}
function escAttr(s){return String(s).replace(/\\/g,'\\\\').replace(/"/g,'&quot;').replace(/'/g,"\\'")}
function toggleFilterVal(name,type,val){
  const scope=S.filterScope; const arr=FILT[scope];
  let cond=arr.find(c=>c.name===name);
  if(!cond){cond={name,type,values:[]};arr.push(cond)}
  const i=cond.values.indexOf(val);
  if(i>=0)cond.values.splice(i,1);else cond.values.push(val);
  if(!cond.values.length) FILT[scope]=arr.filter(c=>c!==cond);
  renderFilterPop(); applyFilterScope(scope);
}
function removeFilterVal(scope,name,type,val){S.filterScope=scope;toggleFilterVal(name,type,val)}
function clearFilters(){FILT[S.filterScope]=[];renderFilterPop();applyFilterScope(S.filterScope)}
function applyFilterScope(scope){
  if(scope==='documents')renderDocList();
  else if(scope==='alldocs')renderAllDocsTbl();
}
function filterCount(scope){return (FILT[scope]||[]).reduce((n,c)=>n+c.values.length,0)}
function renderFilterUI(scope,btnId,chipsId){
  const n=filterCount(scope);
  const btn=document.getElementById(btnId);
  if(btn) btn.innerHTML=`&#9783; Filter${n?` &middot; ${n}`:''}`;
  const cont=document.getElementById(chipsId);
  if(cont){
    const conds=FILT[scope]||[];
    cont.innerHTML=conds.map(c=>c.values.map(v=>{
      let val=v;
      if(c.type==='checkbox') val=(v==='true'?'Checked':'Unchecked');
      else if(c.type==='date') val=(v==='__any__'?'Has a date':v==='__none__'?'No date':fmtFilterDate(v));
      const lbl=`${c.name}: ${val}`;
      return `<span class="filt-chip">${escHtml(lbl)}<button onclick="removeFilterVal('${escAttr(scope)}','${escAttr(c.name)}','${c.type}','${escAttr(v)}')" title="Remove">&times;</button></span>`;
    }).join('')).join('');
    cont.style.display=conds.length?'flex':'none';
  }
}

