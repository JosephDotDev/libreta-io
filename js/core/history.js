const NAV={stack:[],pos:-1};
let _navSuppress=false;
function navHistoryPush(view,id){
  NAV.stack=NAV.stack.slice(0,NAV.pos+1);
  const last=NAV.stack[NAV.pos];
  if(last&&last.view===view&&last.id===id){updateNavButtons();return}
  NAV.stack.push({view,id:id||null}); NAV.pos=NAV.stack.length-1;
  if(NAV.stack.length>100){NAV.stack.shift();NAV.pos--}
  updateNavButtons();
}
function navBack(){ if(NAV.pos>0){NAV.pos--;const t=NAV.stack[NAV.pos];_navSuppress=true;nav(t.view,t.id);_navSuppress=false;} }
function navForward(){ if(NAV.pos<NAV.stack.length-1){NAV.pos++;const t=NAV.stack[NAV.pos];_navSuppress=true;nav(t.view,t.id);_navSuppress=false;} }
function updateNavButtons(){
  const b=document.getElementById('nav-back'),f=document.getElementById('nav-fwd');
  if(b)b.disabled=NAV.pos<=0;
  if(f)f.disabled=NAV.pos>=NAV.stack.length-1;
}
function renderBreadcrumbs(view,id){
  const el=document.getElementById('breadcrumbs'); if(!el) return;
  const root={label:'Workspace',view:'home'};
  let crumbs;
  if(view==='home') crumbs=[{label:'Home',view:'home'}];
  else if(view==='documents') crumbs=[root,{label:'Documents',view:'documents'}];
  else if(view==='editor'){
    // Walk the parent chain so nested pages show their ancestry
    const chain=[]; let cur=id?DB.getDoc(id):null; const seen=new Set();
    const rootDoc=cur;
    while(cur&&!seen.has(cur.id)){ seen.add(cur.id); chain.unshift({label:cur.title||'Untitled',view:'editor',id:cur.id}); cur=cur.meta&&cur.meta.parent?DB.getDoc(cur.meta.parent):null; }
    // A DB row doc has no meta.parent — its TRUE structural parent is the database it
    // belongs to. Show Workspace / <Database> / <Entry> (the db links to its own page),
    // rather than whatever page we happened to come from.
    const isOrphanRow=!!(rootDoc&&rootDoc.dbId&&rootDoc.rowId&&!(rootDoc.meta&&rootDoc.meta.parent));
    if(isOrphanRow){
      const tbl=DB.getTbl(rootDoc.dbId);
      if(tbl) crumbs=[root,{label:tbl.name||'Database',view:'databases',id:tbl.id},...chain];
      else crumbs=[root,{label:'Documents',view:'documents'},...chain];
    } else crumbs=[root,{label:'Documents',view:'documents'},...chain];
  }
  else if(view==='databases'){const t=(S.tblId&&S.tblId!=='__all_docs__')?DB.getTbl(S.tblId):null;crumbs=[root,{label:'Databases',view:'databases'}];if(S.tblId==='__all_docs__')crumbs.push({label:'All Documents',view:'databases'});else if(t)crumbs.push({label:t.name,view:'databases',id:t.id});}
  else if(view==='calendar') crumbs=[root,{label:'Calendar',view:'calendar'}];
  else crumbs=[root];
  el.innerHTML=crumbs.map((c,i)=>{
    const sep=i>0?'<span class="bc-sep">/</span>':'';
    const isLast=i===crumbs.length-1;
    // A database crumb with an id opens that database's full page; everything else navs normally.
    const onclick=(!isLast)?(c.view==='databases'&&c.id?`onclick="openDbPage('${c.id}')"`:`onclick="nav('${c.view}'${c.id?`,'${c.id}'`:''})"`):'';
    return `${sep}<span class="${isLast?'bc-cur':'bc-link'}" ${onclick}>${escHtml(c.label)}</span>`;
  }).join('');
  // The page title in the topbar adopts the page's own typeface (the "page logo"
  // feel) — editor/home carry a per-page font; other views fall back to global.
  let fdoc=null;
  if(view==='editor'&&id) fdoc=DB.getDoc(id);
  else if(view==='home'&&typeof getHomeDoc==='function') fdoc=getHomeDoc();
  if(fdoc){ const f=FONTS[normFontKey((fdoc.fmt&&fdoc.fmt.font)||getCfg().font)]||FONTS.cormorant; el.style.fontFamily=f.stack; }
  else el.style.fontFamily='';
}

