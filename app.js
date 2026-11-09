(function(){
'use strict';
const APP_VERSION='0.9.1.1';
/* Eigener Speicher je Adresse: die Live-App unter / behält ihre Namen, eine Test-App unter /test/ bekommt eigene */
const BASE=location.pathname.replace(/[^/]*$/,'');
const NS=BASE==='/'?'':BASE.replace(/^\/|\/$/g,'').replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'-';
const IS_TEST=!!NS;
const KEY=NS+'tankbox-v1',KEYS=NS+'tankbox-zugang',GH_LS=NS+'tankbox-gh-status';

/* ---------- Kleine Helfer ---------- */
function sod(d){const x=new Date(d);x.setHours(0,0,0,0);return x}
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function parse(s){const p=String(s).split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}
const T=()=>sod(new Date());
const daysAgo=s=>Math.round((T()-sod(parse(s)))/864e5);
const fmtD=d=>d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
const fmtS=s=>s?fmtD(parse(s)):'–';
const nf=(n,d)=>Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
const eur=n=>Number(n||0).toLocaleString('de-DE',{style:'currency',currency:'EUR'});
const km=n=>nf(n,0)+' km';
const eur0=n=>Number(n||0).toLocaleString('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const num=v=>{if(v==null)return NaN;let s=String(v).trim().replace(/\s|€|l|km/gi,'');if(!s)return NaN;
  if(s.includes(',')){s=s.replace(/\./g,'').replace(',','.')}return parseFloat(s)};
const MON=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const SORTEN=['Diesel','Super E5','Super E10','Super Plus','Premium-Diesel','LPG','Sonstiges'];
const te=new TextEncoder(),td=new TextDecoder();
function toB64(buf){const u=new Uint8Array(buf);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)}
function fromB64(s){const b=atob(s);const u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
const fmtSize=n=>n>1e6?nf(n/1e6,1)+' MB':Math.max(1,Math.round(n/1e3))+' KB';

/* Bewegung, Vibration */
const RM=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
const motion=()=>!RM.matches&&!!Element.prototype.animate;
const buzz=p=>{try{if(navigator.vibrate&&!document.hidden)navigator.vibrate(p)}catch(e){}};
const BIG_YAY=new Set(['Update online','GitHub verbunden','Erste Tankung!']);
function celebrate(text){if(!motion()){buzz([12,50,24]);if(text)toast(text);return}DS.yay(text,BIG_YAY.has(text))}
function toast(msg){const r=document.getElementById('toastRoot');clearTimeout(toast.t);clearTimeout(toast.t2);
  r.innerHTML=`<div class="toast" role="status">${esc(msg)}</div>`;
  toast.t=setTimeout(()=>{const t=r.firstElementChild;if(!t)return;if(!motion()){r.innerHTML='';return}
    t.classList.add('out');toast.t2=setTimeout(()=>{if(t.isConnected)t.remove()},220)},4000)}

/* ---------- Speicher: Daten in localStorage + Zweitkopie in IndexedDB, Fotos in IndexedDB ---------- */
let idbP=null;
function idb(){if(idbP)return idbP;idbP=new Promise((res,rej)=>{const r=indexedDB.open(NS+'tankbox',1);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv');if(!d.objectStoreNames.contains('fotos'))d.createObjectStore('fotos')};
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return idbP}
async function st(store,mode,fn){const d=await idb();return new Promise((res,rej)=>{const tx=d.transaction(store,mode);const s=tx.objectStore(store);
  let out;const r=fn(s);if(r)r.onsuccess=()=>{out=r.result};tx.oncomplete=()=>res(out);tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error)})}
const kvGet=k=>st('kv','readonly',s=>s.get(k)),kvPut=(k,v)=>st('kv','readwrite',s=>s.put(v,k));
const fotoGet=id=>st('fotos','readonly',s=>s.get(id)),fotoPut=(id,b)=>st('fotos','readwrite',s=>s.put(b,id)),
  fotoDel=id=>st('fotos','readwrite',s=>s.delete(id)),fotoKeys=()=>st('fotos','readonly',s=>s.getAllKeys()),fotoClear=()=>st('fotos','readwrite',s=>s.clear());

let db=null;
const empty=()=>({v:1,did:uid(),fills:[],services:[],stationen:[],meta:{}});
const dbOk=o=>!!(o&&Array.isArray(o.fills));
async function load(){
  let a=null,b=null;
  try{a=JSON.parse(localStorage.getItem(KEY))}catch(e){}
  try{const m=await kvGet('daten');b=m?JSON.parse(m):null}catch(e){}
  const ta=dbOk(a)?a.saved||0:-1,tb=dbOk(b)?b.saved||0:-1;
  db=ta<0&&tb<0?empty():tb>ta?b:a;
  if(!db.did)db.did=uid();db.meta=db.meta||{};if(!Array.isArray(db.services))db.services=[];if(!Array.isArray(db.stationen))db.stationen=[];
  if(tb>ta&&ta>=0)setTimeout(()=>toast('Die Daten wurden aus der Zweitkopie wiederhergestellt.'),800);
}
let saving=Promise.resolve();
function save(dirty=true,sync=true){
  if(dirty)db.meta.dirty=(db.meta.dirty||0)+1;
  db.saved=Date.now();const json=JSON.stringify(db);
  saving=saving.then(async()=>{
    let ok=true;try{localStorage.setItem(KEY,json)}catch(e){ok=false}
    try{await kvPut('daten',json)}catch(e){if(!ok)throw e}
  }).then(()=>{if(sync)ghQueue()}).catch(()=>toast('Speichern fehlgeschlagen. Der Speicher ist vermutlich voll.'));
  return saving}
let persisted=null;
async function askPersist(){try{if(navigator.storage&&navigator.storage.persist){persisted=await navigator.storage.persisted()||await navigator.storage.persist()}}catch(e){}}

/* Zugangsschlüssel (GitHub-Sicherung, App-Update) liegen getrennt von den Daten und kommen nie in Sicherungen */
function keys(){try{return JSON.parse(localStorage.getItem(KEYS))||{}}catch(e){return {}}}
function setKeys(o){const k=Object.assign(keys(),o);Object.keys(k).forEach(x=>{if(k[x]==null)delete k[x]});
  try{localStorage.setItem(KEYS,JSON.stringify(k))}catch(e){}kvPut('zugang',JSON.stringify(k)).catch(()=>{})}
async function loadKeys(){if(localStorage.getItem(KEYS))return;try{const m=await kvGet('zugang');if(m)localStorage.setItem(KEYS,m)}catch(e){}}

/* ---------- Rechnen: Verbrauch nach Volltank-Methode ---------- */
const byKm=()=>db.fills.slice().sort((a,b)=>(a.km-b.km)||(a.datum<b.datum?-1:1));
const byDate=()=>db.fills.slice().sort((a,b)=>(b.datum+(b.zeit||'')).localeCompare(a.datum+(a.zeit||''))||(b.km-a.km));
/* Für jede volle Tankung: Liter seit der letzten vollen Tankung (Teilbetankungen dazwischen eingerechnet) / gefahrene km */
function calc(){
  const s=byKm(),out={};let last=null,acc=0;
  for(const f of s){
    const prev=out._p;out[f.id]={dist:prev?f.km-prev.km:null};out._p=f;
    if(last&&f.km>last.km){acc+=+f.liter||0;
      if(f.voll!==false){const d=f.km-last.km;out[f.id].verb=acc/d*100;out[f.id].seit=d;acc=0;last=f}}
    else if(f.voll!==false){last=f;acc=0}
  }
  delete out._p;return out}
function stats(){
  const c=calc(),s=byKm();let lit=0,dist=0;
  // Durchschnitt über alle sauber messbaren Abschnitte
  for(const f of s){const x=c[f.id];if(x&&x.verb!=null){dist+=x.seit;}}
  const fulls=s.filter(f=>c[f.id]&&c[f.id].verb!=null);
  if(fulls.length){const first=s.find(f=>f.voll!==false);const lastF=fulls[fulls.length-1];
    lit=s.filter(f=>f.km>first.km&&f.km<=lastF.km).reduce((a,f)=>a+(+f.liter||0),0);dist=lastF.km-first.km}
  const y=String(new Date().getFullYear()),ym=iso(new Date()).slice(0,7);
  const yearF=db.fills.filter(f=>f.datum.startsWith(y)),monF=db.fills.filter(f=>f.datum.startsWith(ym));
  const sum=a=>a.reduce((t,f)=>t+(+f.betrag||0),0);
  const svY=db.services.filter(v=>v.datum.startsWith(y)).reduce((t,v)=>t+(+v.betrag||0),0),waY=yearF.reduce((t,f)=>t+(+f.waesche||0),0);
  const kmAll=s.length>1?s[s.length-1].km-s[0].km:0;
  const costAll=s.length>1?s.slice(1).reduce((t,f)=>t+(+f.betrag||0),0):0;
  return {c,avg:dist>0?lit/dist*100:null,year:sum(yearF)+svY+waY,yearX:svY+waY,yearN:yearF.length,month:sum(monF),monthN:monF.length,
    kmNow:s.length?s[s.length-1].km:null,per100:kmAll>0?costAll/kmAll*100:null,
    kmYear:(()=>{const ys=s.filter(f=>f.datum.startsWith(y));const before=s.filter(f=>f.datum<y+'-01-01');const start=before.length?before[before.length-1].km:(ys[0]&&ys[0].km);return ys.length&&start!=null?ys[ys.length-1].km-start:0})()}
}
/* Plausibilität: Hinweise, kein Verbot */
function checks(f,selfId){
  const w=[];const L=+f.liter,P=+f.ppl,B=+f.betrag,K=+f.km;
  if(L>0&&P>0&&B>0&&Math.abs(L*P-B)>Math.max(.05,B*.005))w.push(`Liter × Preis ergibt ${eur(L*P)}, nicht ${eur(B)}. Bitte prüfen.`);
  if(P&&(P<.8||P>3.5))w.push('Der Preis pro Liter wirkt ungewöhnlich.');
  if(L>150)w.push('Mehr als 150 Liter auf einmal? Bitte prüfen.');
  if(K>0&&f.datum){
    const others=db.fills.filter(x=>x.id!==selfId);
    const before=others.filter(x=>x.datum<f.datum||(x.datum===f.datum&&(x.zeit||'')<=(f.zeit||''))).sort((a,b)=>b.km-a.km)[0];
    const after=others.filter(x=>x.datum>f.datum||(x.datum===f.datum&&(x.zeit||'')>(f.zeit||''))).sort((a,b)=>a.km-b.km)[0];
    if(before&&K<=before.km)w.push(`Der Kilometerstand ist nicht höher als bei der Tankung am ${fmtS(before.datum)} (${km(before.km)}).`);
    else if(after&&K>=after.km)w.push(`Der Kilometerstand ist höher als bei der späteren Tankung am ${fmtS(after.datum)} (${km(after.km)}).`);
    else if(before&&L>0&&f.voll!==false&&before.voll!==false){const v=L/(K-before.km)*100;
      if(v>25||v<2.5)w.push(`Das wären ${nf(v,1)} l/100 km seit der letzten Tankung. Fehlt eine Quittung, oder ist der km-Stand vertippt?`)}
  }
  return w}

/* ---------- Automatische Sicherung in ein privates GitHub-Repo ----------
   Hochgeladen werden daten.json (alle Tankungen, ohne Zugangsschlüssel) und fotos/<id>.jpg.
   Im Repo wird nie automatisch etwas gelöscht, ein fremder Datenstand wird nie überschrieben. */
const GH_API='https://api.github.com';
let ghTimer=0,ghBusy=false,ghAgain=null;
let ghStat=(()=>{try{return JSON.parse(localStorage.getItem(GH_LS))||{}}catch(e){return {}}})();
function ghCfg(){const g=keys().gh;return g&&g.token&&g.owner&&g.repo?Object.assign({},g):null}
const bkDir=v=>String(v||'').trim().replace(/^\/+|\/+$/g,'').replace(/[^\w.\/-]/g,'');
function setGhStat(o){ghStat=Object.assign({},ghStat,o);try{localStorage.setItem(GH_LS,JSON.stringify(ghStat))}catch(e){}
  const el=document.getElementById('ghStatus');if(el)el.innerHTML=ghStatusText();bkDot();
  if(o.err!==undefined&&!document.getElementById('sheetRoot').firstElementChild)render()}
async function ghFetch(g,method,path,body,raw){
  path=g.dir&&path.startsWith('/contents/')?'/contents/'+encodeURI(g.dir)+'/'+path.slice(10):g.dir&&path==='/contents'?'/contents/'+encodeURI(g.dir):path;
  const r=await fetch(`${GH_API}/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}${path}`,{method,cache:'no-store',
    headers:Object.assign({Authorization:'Bearer '+g.token,Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json'},body?{'Content-Type':'application/json'}:{}),
    body:body?JSON.stringify(body):undefined});
  if(r.status===404&&method==='GET')return null;
  if(!r.ok){const e=new Error('GitHub '+r.status);e.status=r.status;throw e}
  return raw?r.arrayBuffer():r.status===204?null:r.json();
}
const ghErrText=e=>e&&e.conflict?'Im Repo liegt ein anderer Datenstand. Öffne „Daten“, um zu entscheiden.'
  :e&&e.status===401?'Der GitHub-Zugangsschlüssel ist ungültig oder abgelaufen.'
  :e&&(e.status===403||e.status===404)?'Kein Zugriff auf das Repo. Prüfe Name und Rechte des Schlüssels (Contents: Read and write).'
  :e&&e.status===422?'GitHub hat die Datei abgelehnt (zu groß?).'
  :'Keine Verbindung zu GitHub. Es wird später erneut versucht.';
function ghStatusText(){
  if(ghBusy)return '⏳ Wird gesichert …';
  if(ghStat.err)return `<span style="color:var(--crit)">${esc(ghStat.err)}</span>`;
  if(ghStat.at){const m=Math.round((Date.now()-ghStat.at)/60000);return `✓ Zuletzt gesichert ${m<1?'gerade eben':m<60?'vor '+m+' Min.':m<1440?'vor '+Math.round(m/60)+' Std.':'am '+fmtD(new Date(ghStat.at))}.`}
  return 'Noch nicht gesichert.';
}
/* Was gesichert wird: die Daten ohne Zähler und Zeitstempel, damit unveränderte Stände nicht neu hochgeladen werden */
const payload=()=>JSON.stringify({app:'tankbox',format:1,version:APP_VERSION,did:db.did,fills:byDate(),services:svcByDate(),stationen:db.stationen},null,1);
async function ghRemote(g){
  const cur=await ghFetch(g,'GET','/contents/daten.json');if(!cur)return {cur:null,json:null};
  let json=null;
  try{json=cur.content&&cur.encoding==='base64'?td.decode(fromB64(cur.content.replace(/\s/g,''))):td.decode(new Uint8Array(await ghFetch(g,'GET','/contents/daten.json',null,true)))}catch(e){}
  return {cur,json};
}
function ghQueue(delay){if(!ghCfg())return;clearTimeout(ghTimer);ghTimer=setTimeout(()=>ghSync(),delay==null?4000:delay)}
async function ghSync(force){
  const g=ghCfg();if(!g)return;
  if(ghBusy){ghAgain={force};return}
  ghBusy=true;clearTimeout(ghTimer);ghTimer=0;setGhStat({});
  try{
    // 1) Fotos, die im Repo noch fehlen (Fotos ändern sich nie, daher reicht der Name)
    const ids=allEntries().map(f=>f.foto).concat(db.stationen.map(x=>x.bild),Object.values(db.meta.brandImgs||{})).filter(Boolean);
    if(ids.length){
      const list=await ghFetch(g,'GET','/contents/fotos');const have=new Set((list||[]).map(x=>String(x.name).replace(/\.jpg$/,'')));
      for(const id of ids){if(have.has(id))continue;const b=await fotoGet(id).catch(()=>null);if(!b)continue;
        await ghFetch(g,'PUT',`/contents/fotos/${id}.jpg`,{message:'MyTankBox: Quittung',content:toB64(await b.arrayBuffer())})}
    }
    // 2) Daten – aber nie einen fremden Stand überschreiben
    const local=payload();
    for(let attempt=0;attempt<2;attempt++){
      const {cur,json}=await ghRemote(g);
      if(json===local)break;
      if(cur&&!force){let rv=null;try{rv=JSON.parse(json)}catch(e){}
        if(!rv||rv.did!==db.did){const e=new Error('conflict');e.conflict=true;throw e}}
      try{await ghFetch(g,'PUT','/contents/daten.json',{message:'MyTankBox-Sicherung '+new Date().toLocaleString('de-DE'),content:toB64(te.encode(local)),sha:cur?cur.sha:undefined});break}
      catch(e){if(e.status!==409||attempt)throw e}
    }
    const first=!ghStat.at;
    db.meta.dirty=0;db.meta.lastBackup=iso(new Date());await save(false,false);
    setGhStat({at:Date.now(),err:'',conflict:false});
    if(first)celebrate('Erste Sicherung');
  }catch(e){
    setGhStat({err:ghErrText(e),conflict:!!e.conflict});
    if(!e.conflict&&!(e.status>=400&&e.status<500))setTimeout(()=>ghQueue(0),5*60e3); // Netzwerkfehler: später nochmal
  }finally{
    ghBusy=false;const el=document.getElementById('ghStatus');if(el)el.innerHTML=ghStatusText();
    if(ghAgain){const a=ghAgain;ghAgain=null;ghSync(a.force)}
  }
}
// Beim Wegwechseln aus der App ausstehende Sicherung sofort starten
document.addEventListener('visibilitychange',()=>{if(document.hidden&&ghTimer)ghSync()});
/* GitHub-Stand laden: ersetzt die Daten auf diesem Gerät */
async function ghRestore(g,onStep){
  const {json}=await ghRemote(g);let o=null;try{o=JSON.parse(json)}catch(e){}
  if(!o||o.app!=='tankbox'||!Array.isArray(o.fills))throw new Error('Im Repo wurde keine MyTankBox-Sicherung gefunden.');
  const need=o.fills.concat(o.services||[]).map(f=>f.foto).concat((o.stationen||[]).map(x=>x.bild)).filter(Boolean);
  if(o.meta&&o.meta.brandImgs)need.push(...Object.values(o.meta.brandImgs));let n=0;
  for(const id of need){onStep&&onStep(++n,need.length);if(await fotoGet(id).catch(()=>null))continue;
    const b=await ghFetch(g,'GET','/contents/fotos/'+encodeURIComponent(id)+'.jpg',null,true).catch(()=>null);
    if(b)await fotoPut(id,new Blob([b],{type:'image/jpeg'}))}
  db={v:1,did:o.did||uid(),fills:o.fills,services:Array.isArray(o.services)?o.services:[],stationen:Array.isArray(o.stationen)?o.stationen:[],meta:Object.assign({},db.meta,{dirty:0,lastBackup:iso(new Date())})};
  await save(false);
}

/* ---------- Sicherungsdatei (zusätzlich oder statt GitHub) ---------- */
async function exportBackup(){
  const fotos={};for(const id of allEntries().map(f=>f.foto).concat(db.stationen.map(x=>x.bild),Object.values(db.meta.brandImgs||{})).filter(Boolean)){const b=await fotoGet(id).catch(()=>null);if(b)fotos[id]=toB64(await b.arrayBuffer())}
  const o=JSON.parse(payload());o.exported=new Date().toISOString();o.fotos=fotos;
  const ok=await deliverFile('tankbox-sicherung-'+iso(new Date())+'.tankbox',JSON.stringify(o),'application/json');
  if(ok){db.meta.dirty=0;db.meta.lastBackup=iso(new Date());await save(false,false);bkDot();toast('Sicherung erstellt.')}
}
async function readBackupFile(file){
  let o=null;try{o=JSON.parse(await file.text())}catch(e){}
  if(!o||o.app!=='tankbox'||!Array.isArray(o.fills))throw new Error('Das ist keine MyTankBox-Sicherung.');
  return o}
async function restoreBackup(o){
  for(const [id,b64] of Object.entries(o.fotos||{}))await fotoPut(id,new Blob([fromB64(b64)],{type:'image/jpeg'}));
  db={v:1,did:o.did||uid(),fills:o.fills,services:Array.isArray(o.services)?o.services:[],stationen:Array.isArray(o.stationen)?o.stationen:[],meta:Object.assign({},db.meta,{dirty:0,lastBackup:iso(new Date())})};
  await save(false);closeSheet(false);render();celebrate('Wiederhergestellt');toast(o.fills.length+' Tankungen'+(db.services.length?' und '+db.services.length+' Service-Einträge':'')+' geladen.')}
async function deliverFile(name,text,type){
  const blob=new Blob([text],{type});
  try{const file=new File([blob],name,{type});if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return true}}
  catch(e){if(e&&e.name==='AbortError')return false}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);return true}
function exportCsv(){
  const c=calc(),q=v=>'"'+String(v??'').replace(/"/g,'""')+'"',n=(v,d)=>v==null||v===''||isNaN(v)?'':Number(v).toFixed(d).replace('.',',');
  const rows=[['Typ','Datum','Uhrzeit','Kilometerstand','Liter / Menge','Preis pro Liter','Betrag','Autowäsche','Kraftstoff / Art','Ort','Adresse','Volltank','Gefahrene km','Verbrauch l/100km','Nächste fällig','Notiz'].map(q).join(';')];
  const all=byKm().map(f=>({k:f.datum+(f.zeit||''),r:()=>{const x=c[f.id]||{};return [q('Tankung'),q(fmtS(f.datum)),q(f.zeit||''),n(f.km,0),n(f.liter,2),n(f.ppl,3),n(f.betrag,2),n(f.waesche,2),q(f.sorte||''),q(f.station||''),q(f.adresse||''),q(f.voll===false?'nein':'ja'),n(x.dist,0),n(x.verb,2),'',q(f.notiz||'')]}}))
    .concat(db.services.map(v=>({k:v.datum+'~',r:()=>[q(svcName(v)),q(fmtS(v.datum)),'',n(v.km,0),n(v.menge,1),'',n(v.betrag,2),'',q(svcDetail(v)),q(v.ort||''),'','','','',q(nextText(v)),q(v.notiz||'')]})));
  all.sort((a,b)=>a.k.localeCompare(b.k)).forEach(x=>rows.push(x.r().join(';')));
  return deliverFile('tankbox-'+iso(new Date())+'.csv','﻿'+rows.join('\r\n'),'text/csv')}

/* ---------- Sheet (wie in den anderen Boxen) ---------- */
const root=document.getElementById('sheetRoot');
let sheetTok=0,histPushed=false,ignorePop=false;
function openSheet(html,onMount){
  const replacing=!!root.firstElementChild;++sheetTok;
  root.innerHTML=`<div class="scrim${replacing?' swap':''}"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
  const sc=root.firstElementChild,sh=sc.firstElementChild;
  sc.addEventListener('click',e=>{if(e.target===sc)closeSheet()});
  root.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeSheet());
  document.body.style.overflow='hidden';
  if(!histPushed){try{history.pushState({tankbox:1},'');histPushed=true}catch(e){}}
  if(onMount)onMount(sh);
  if(motion()){if(replacing)sh.animate([{opacity:0,transform:'translateY(14px) scale(.985)'},{opacity:1,transform:'none'}],{duration:260,easing:'cubic-bezier(.2,.85,.25,1)'});
    else sh.animate([{transform:'translateY(100%)'},{transform:'none'}],{duration:420,easing:'cubic-bezier(.2,.9,.25,1)'})}
  dragSheet(sc,sh);
}
function dragSheet(sc,sh){
  let y0=0,x0=0,dy=0,mode=null,v=0,ly=0,lt=0,hit=false;
  sh.addEventListener('touchstart',e=>{if(e.touches.length!==1||(e.target.closest&&e.target.closest('.mapfull,.mapbox'))){mode='x';return}const t=e.touches[0];y0=ly=t.clientY;x0=t.clientX;lt=performance.now();dy=0;v=0;mode=null;hit=false},{passive:true});
  sh.addEventListener('touchmove',e=>{if(mode==='x'||mode==='scroll'||sc.classList.contains('closing'))return;
    const t=e.touches[0],d=t.clientY-y0,dx=t.clientX-x0;
    if(!mode){if(Math.abs(d)<7&&Math.abs(dx)<7)return;
      if(d>0&&sh.scrollTop<=0&&Math.abs(d)>Math.abs(dx)){mode='drag';y0=t.clientY;sc.classList.add('drag');sh.getAnimations().forEach(a=>a.finish())}else{mode='scroll';return}}
    if(e.cancelable)e.preventDefault();
    const raw=t.clientY-y0;dy=Math.max(0,raw);const now=performance.now();v=.7*((t.clientY-ly)/Math.max(1,now-lt))+.3*v;ly=t.clientY;lt=now;
    sh.style.transform=`translateY(${raw>0?raw:raw*.12}px)`;sc.style.setProperty('--k',String(1-Math.min(1,dy/(sh.offsetHeight||1))));
    const over=dy>Math.min(sh.offsetHeight*.3,220);if(over!==hit){hit=over;if(over)buzz(6)}},{passive:false});
  const end=()=>{if(mode!=='drag'){mode=null;return}mode=null;sc.classList.remove('drag');
    if(hit||(v>.55&&dy>24)){closeSheet();return}
    const from=sh.style.transform;sh.style.transform='';sc.style.removeProperty('--k');
    if(motion()&&from)sh.animate([{transform:from},{transform:'translateY(0)'}],{duration:360,easing:'cubic-bezier(.2,.9,.3,1.15)'})};
  sh.addEventListener('touchend',end);sh.addEventListener('touchcancel',end);
}
function closeSheet(anim){
  document.body.style.overflow='';const sc=root.firstElementChild;if(!sc)return;
  const back=()=>{if(histPushed){histPushed=false;ignorePop=true;try{history.back()}catch(e){ignorePop=false}}};
  if(anim===false||!motion()){++sheetTok;root.innerHTML='';back();return}
  if(sc.classList.contains('closing'))return;
  const tok=++sheetTok,sh=sc.firstElementChild,from=sh.style.transform||'translateY(0)';
  sh.getAnimations().forEach(a=>a.cancel());sc.classList.add('closing');sc.classList.remove('drag');sc.style.setProperty('--k','0');
  sh.animate([{transform:from},{transform:'translateY(105%)'}],{duration:260,easing:'cubic-bezier(.4,0,.9,.6)',fill:'forwards'});
  back();setTimeout(()=>{if(tok===sheetTok)root.innerHTML=''},280);
}
addEventListener('popstate',()=>{if(ignorePop){ignorePop=false;return}histPushed=false;
  const d=document.getElementById('dsdlg');if(d&&d.open){d.close();return}
  if(fanOpen){setFan(false);return}
  if(root.firstElementChild)closeSheet()});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(fanOpen)setFan(false);else if(root.firstElementChild)closeSheet()});
const head=t=>`<div class="sheethead"><h2>${t}</h2><button type="button" class="icobtn" data-close aria-label="Schließen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;

/* Kleines Fenster für Eingaben (GitHub einrichten, App-Update) – wie in den anderen Boxen */
function dsForm(title,fields,onSave,o={}){
  let d=document.getElementById('dsdlg');
  if(!d){d=document.createElement('dialog');d.id='dsdlg';d.className='dsdlg';d.innerHTML='<form autocomplete="off"></form>';document.body.appendChild(d)}
  const f=d.querySelector('form');
  f.innerHTML=`<h2>${esc(title)}</h2>${o.html||''}${fields.map((x,i)=>`<label for="dsf${i}">${esc(x.l)}</label><input id="dsf${i}" name="${x.k}" type="${x.t||'text'}" value="${esc(x.v||'')}"${x.req?' required':''} autocomplete="${x.ac||'off'}" autocapitalize="off" spellcheck="false">`).join('')}
    <p class="ds-err" hidden></p><div class="dsrow"><button type="button" class="ds-btn" data-x="c">Abbrechen</button><button class="ds-btn pri">${esc(o.ok||'Speichern')}</button></div>`;
  const er=f.querySelector('.ds-err'),ok=f.querySelector('.ds-btn.pri');
  const fail=m=>{er.textContent=m;er.hidden=false;return false};
  f.querySelector('[data-x=c]').onclick=()=>d.close();
  f.onsubmit=async e=>{e.preventDefault();er.hidden=true;const v={};fields.forEach(x=>v[x.k]=f.elements[x.k].value);
    ok.disabled=true;const t=ok.textContent;ok.textContent='Prüfe …';
    try{const r=await onSave(v,fail);if(r!==false)d.close()}catch(x){fail(x&&x.message||'Das hat nicht geklappt.')}finally{ok.disabled=false;ok.textContent=t}};
  if(!d.open)d.showModal();setTimeout(()=>{const i=f.querySelector('input');if(i)i.focus()},50);
}

/* ---------- Ansichten ---------- */
const main=document.getElementById('main');
const TABS=['home','liste','auswertung'];
let tab='home';
const ICO={pump:'<path d="M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14"/><path d="M3 20h12M7 8h4"/><path d="M14 9h2l2 2v6a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
  cam:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>'};
const svg=(k,c='')=>`<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
function bkInfo(){const lb=db.meta.lastBackup;const g=ghCfg();
  return {ghErr:g?(ghStat.err||''):'',ghOk:!!(g&&ghStat.at&&!ghStat.err),own:db.fills.length>0,days:lb?daysAgo(lb):null,dirty:db.meta.dirty||0}}
function bkDot(){const b=document.getElementById('menuBtn');if(!b||!db)return;const s=DS.bkState(bkInfo());b.classList.add('ds-lockbtn');b.dataset.bk=s;
  b.title='Daten & Sicherung'+({ok:' · Gesichert',warn:' · Sicherung fällig',crit:' · Problem mit der Sicherung'}[s]||'')}
function fillRow(f,c,i){const x=c[f.id]||{};const d=parse(f.datum);
  return `<button type="button" class="row" data-fill="${f.id}" style="--j:${i||0}"><span class="date"><b>${d.getDate()}</b><span>${MON[d.getMonth()].slice(0,3)}</span></span>
    <span class="main"><span class="t">${nf(f.liter,2)} l${f.sorte?' · '+esc(f.sorte):''}</span><span class="s">${km(f.km)}${f.voll===false?' · teilweise':''}</span>
    ${f.station?`<span class="s stline">${badge(stOf(f),f.station,'sm')}${esc(f.station)}</span>`:''}
    ${f.waesche?`<span class="s">inkl. Autowäsche ${eur(f.waesche)}</span>`:''}
    ${x.verb!=null?`<span class="s">${nf(x.verb,1)} l/100 km auf ${km(x.seit)}</span>`:''}</span>
    <span class="ramt"><span class="amt num">${eur(fillCost(f))}</span>${f.ppl?`<small class="muted num">${nf(f.ppl,3)} €/l</small>`:''}${f.foto?`<small class="muted" aria-label="mit Foto">${svg('cam','mini-ic')}</small>`:''}</span></button>`}
let first=true;
function render(){
  if(!db)return;bkDot();
  document.querySelectorAll('nav.tabs [data-tab]').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false'));
  setInd(TABS.indexOf(tab));
  const s=stats();
  if(tab==='home')main.innerHTML=viewHome(s);else if(tab==='liste')main.innerHTML=viewList(s);else main.innerHTML=viewStats(s);
  main.querySelectorAll('[data-fill]').forEach(b=>b.onclick=()=>openDetail(b.dataset.fill));
  main.querySelectorAll('[data-svc]').forEach(b=>b.onclick=()=>openSvcDetail(b.dataset.svc));
  main.querySelectorAll('[data-due]').forEach(b=>b.onclick=()=>openSvcForm(null,b.dataset.due));
  const rm=main.querySelector('[data-bk]');if(rm)rm.onclick=()=>openMenu('gh');
  const nb=main.querySelector('[data-new]');if(nb)nb.onclick=()=>openForm(null,nb.dataset.new==='foto');
  const all=main.querySelector('[data-all]');if(all)all.onclick=()=>goTab('liste');
  countUps(first);first=false;fitFacts();setTimeout(fitFacts,1000);
}
/* Zahlen in den Kacheln verkleinern, bis sie hineinpassen */
function fitFacts(){main.querySelectorAll('.fact b').forEach(b=>{b.style.fontSize='';const max=b.parentElement.clientWidth-24;
  let fs=parseFloat(getComputedStyle(b).fontSize);while(b.scrollWidth>max&&fs>11){fs-=.5;b.style.fontSize=fs+'px'}})}
addEventListener('resize',()=>{clearTimeout(fitFacts.t);fitFacts.t=setTimeout(fitFacts,150)});
function viewHome(s){
  const recent=timeline().slice(0,5);
  if(!db.fills.length&&!db.services.length)return `<section class="view">
    <div class="summary"><div><div class="label">Willkommen</div><p style="margin:6px 0 0">Erfasse jede Tankung des Dienstwagens mit Quittungsfoto. Die MyTankBox rechnet Verbrauch und Kosten aus.</p></div>
    <div class="actions"><button type="button" class="btn primary" data-new="foto">Erste Tankung erfassen</button></div></div>
    ${ghCfg()?'':`<p class="hint">Neues Handy? Unter <b>Daten</b> → Datensicherung → „GitHub einrichten“ holst du deine Tankungen aus GitHub zurück.</p>`}</section>`;
  return `<section class="view">${DS.remindHtml(bkInfo(),'data-bk')}
    <div class="summary">
      <div><div class="label">Durchschnittsverbrauch</div><div class="bigcost"><span class="num"${s.avg!=null?` data-count="avg" data-v="${s.avg}" data-f="l1"`:''}>${s.avg!=null?nf(s.avg,1):'–'}</span><small>l/100 km${s.avg==null?' · ab zwei vollen Tankungen':''}</small></div></div>
      <div class="facts">
        <div class="fact"><b class="num" data-count="year" data-v="${s.year}" data-f="eur0">${eur0(s.year)}</b><span>Kosten ${new Date().getFullYear()}<br><small>${s.yearN} Tankung${s.yearN===1?'':'en'}${s.yearX?'<br>inkl. '+eur0(s.yearX)+' Extras':''}</small></span></div>
        <div class="fact"><b class="num"${s.per100!=null?` data-count="p100" data-v="${s.per100}" data-f="eur"`:''}>${s.per100!=null?eur(s.per100):'–'}</b><span>Sprit pro 100 km</span></div>
        <div class="fact"><b class="num"${s.kmNow!=null?` data-count="km" data-v="${s.kmNow}" data-f="n0"`:''}>${s.kmNow!=null?nf(s.kmNow,0):'–'}</b><span>km-Stand</span></div>
      </div></div>
    ${dueHtml()}
    <div><div class="sechead"><h2>Zuletzt</h2><button type="button" class="ghost" data-all>Alle ${allEntries().length}</button></div>
      <div class="list" style="margin-top:10px">${recent.map((f,i)=>entryRow(f,s.c,i)).join('')}</div></div>
  </section>`}
function viewList(s){
  const tl=timeline();
  if(!tl.length)return `<section class="view"><div class="list"><div class="empty">Noch keine Einträge.</div></div></section>`;
  const groups={};tl.forEach(f=>{(groups[f.datum.slice(0,7)]=groups[f.datum.slice(0,7)]||[]).push(f)});
  return `<section class="view">${Object.entries(groups).map(([ym,fs])=>{const [y,m]=ym.split('-').map(Number);
    const lit=fs.filter(f=>!f.typ).reduce((a,f)=>a+(+f.liter||0),0);
    return `<div><div class="sechead"><h2>${MON[m-1]} ${y}</h2><span class="count num">${eur(fs.reduce((a,f)=>a+cost(f),0))}${lit?' · '+nf(lit,1)+' l':''}</span></div>
      <div class="list" style="margin-top:10px">${fs.map((f,i)=>entryRow(f,s.c,i)).join('')}</div></div>`}).join('')}</section>`}
function viewStats(s){
  if(allEntries().length<2)return `<section class="view"><div class="list"><div class="empty">Auswertungen gibt es ab zwei Einträgen.</div></div></section>`;
  // Kosten der letzten 12 Monate
  const now=new Date(),months=[];for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push(iso(d).slice(0,7))}
  const mc=months.map(ym=>({ym,v:allEntries().filter(f=>f.datum.startsWith(ym)).reduce((a,f)=>a+cost(f),0)}));
  const mx=Math.max(1,...mc.map(x=>x.v));
  const fulls=byKm().filter(f=>s.c[f.id]&&s.c[f.id].verb!=null).slice(-10).reverse();
  const vmx=Math.max(1,...fulls.map(f=>s.c[f.id].verb));
  const pp=byDate().filter(f=>f.ppl).slice(0,10);
  return `<section class="view">
    <div class="summary"><div class="label">Kosten der letzten 12 Monate</div>
      <div class="bars">${mc.map(x=>{const [y,m]=x.ym.split('-').map(Number);return `<div class="bar"><span class="bl">${MON[m-1].slice(0,3)} ${String(y).slice(2)}</span><span class="track"><span class="fill" style="width:${(x.v/mx*100).toFixed(1)}%"></span></span><span class="num">${x.v?eur(x.v):'–'}</span></div>`}).join('')}</div>
      <p class="hint">Summe inkl. Wäsche und Service: ${eur(mc.reduce((a,x)=>a+x.v,0))}${s.kmYear?' · '+km(s.kmYear)+' gefahren in '+now.getFullYear():''}</p></div>
    ${breakdownHtml()}
    <div class="summary"><div class="label">Verbrauch je Tankung</div>
      ${fulls.length?`<div class="bars">${fulls.map(f=>{const v=s.c[f.id].verb;return `<div class="bar"><span class="bl">${fmtS(f.datum).slice(0,6)}</span><span class="track"><span class="fill" style="width:${(v/vmx*100).toFixed(1)}%${s.avg&&v>s.avg*1.2?';background:var(--warn)':''}"></span></span><span class="num">${nf(v,1)} l</span></div>`}).join('')}</div>
      <p class="hint">l/100 km zwischen zwei vollen Tankungen. Orange: über 20 % mehr als der Durchschnitt (${s.avg!=null?nf(s.avg,1):'–'} l).</p>`:'<p class="hint">Sobald zwei volle Tankungen da sind, steht hier der Verbrauch.</p>'}</div>
    ${pp.length?`<div class="summary"><div class="label">Bezahlter Preis pro Liter</div>
      <dl class="kv" style="margin:0">${pp.map(f=>`<dt>${fmtS(f.datum)}</dt><dd class="num">${nf(f.ppl,3)} €${f.station?' · '+esc(f.station):''}</dd>`).join('')}</dl></div>`:''}
  </section>`}


/* ---------- Detail ---------- */
async function openDetail(id){
  const f=db.fills.find(x=>x.id===id);if(!f)return;const x=calc()[f.id]||{};
  let url=null;if(f.foto){const b=await fotoGet(f.foto).catch(()=>null);if(b)url=URL.createObjectURL(b)}
  openSheet(head(fmtS(f.datum)+(f.zeit?' · '+esc(f.zeit):''))+`
    ${x.verb!=null?`<div class="hero h-ok tiltme"><span class="hl">Verbrauch</span><b class="num">${nf(x.verb,1)} l/100 km</b><span class="hs">auf ${km(x.seit)} seit der letzten vollen Tankung</span></div>`:''}
    ${url?`<img class="photo tiltme" src="${url}" alt="Quittung">`:''}
    <dl class="kv">
      <dt>Kilometerstand</dt><dd class="num">${km(f.km)}${x.dist!=null?` <span class="muted">(+${nf(x.dist,0)})</span>`:''}</dd>
      <dt>Getankt</dt><dd class="num">${nf(f.liter,2)} l${f.voll===false?' · teilweise':' · voll'}</dd>
      <dt>Kraftstoff-Betrag</dt><dd class="num">${eur(f.betrag)}</dd>
      ${f.waesche?`<dt>Autowäsche</dt><dd class="num">${eur(f.waesche)}</dd><dt>Quittung gesamt</dt><dd class="num"><b>${eur(fillCost(f))}</b></dd>`:''}
      <dt>Preis pro Liter</dt><dd class="num">${f.ppl?nf(f.ppl,3)+' €':'–'}</dd>
      <dt>Kraftstoff</dt><dd>${esc(f.sorte||'–')}</dd>
      <dt>Tankstelle</dt><dd>${f.station?`<button type="button" class="stlink" id="dSt">${badge(stOf(f),f.station,'sm')}<span>${esc(f.station)}${f.adresse?`<small class="muted">${esc(f.adresse)}</small>`:''}</span></button>`:'–'}</dd>
      ${f.notiz?`<dt>Notiz</dt><dd>${esc(f.notiz)}</dd>`:''}
    </dl>
    <div class="actions two"><button type="button" class="btn primary" id="dEdit">Bearbeiten</button><button type="button" class="btn danger" id="dDel">Löschen</button></div>`,
  s=>{s.querySelector('#dEdit').onclick=()=>openForm(f.id);
    const dst=s.querySelector('#dSt');if(dst)dst.onclick=()=>openStation(stationFor(f),()=>openDetail(f.id));
    s.querySelector('#dDel').onclick=async()=>{if(!confirm('Diese Tankung löschen? Das Foto wird auf diesem Handy ebenfalls entfernt.'))return;
      db.fills=db.fills.filter(y=>y.id!==f.id);if(f.foto)fotoDel(f.foto).catch(()=>{});await save();closeSheet();render();toast('Tankung gelöscht.')};
    const img=s.querySelector('.photo');if(img)img.onclick=()=>window.open(url,'_blank')});
}

/* ---------- Service: AdBlue, Reifen, Inspektion, TÜV, Panne ---------- */
const SVC={
  adblue:{n:'AdBlue',ic:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'},
  reifen:{n:'Reifenwechsel',ic:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M12 3.5v5.5M12 15v5.5M3.5 12H9M15 12h5.5"/>'},
  inspektion:{n:'Inspektion',ic:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'},
  tuev:{n:'TÜV / HU',ic:'<circle cx="12" cy="10" r="6"/><path d="M9.5 10l2 2 3.5-3.5M8.5 15.5L7 21l5-2 5 2-1.5-5.5"/>'},
  panne:{n:'Panne',ic:'<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.2"/>'},
  sonst:{n:'Sonstiges',ic:'<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8M12 8v8"/>'}};
const REIFEN=['Winterreifen drauf','Sommerreifen drauf','Ganzjahresreifen drauf','Neue Reifen'];
const svcIco=(t,c='')=>`<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(SVC[t]||SVC.sonst).ic}</svg>`;
const svcName=v=>v.typ==='sonst'&&v.titel?v.titel:(SVC[v.typ]||SVC.sonst).n;
const svcByDate=()=>db.services.slice().sort((a,b)=>b.datum.localeCompare(a.datum)||((b.km||0)-(a.km||0)));
const allEntries=()=>db.fills.concat(db.services);
const fillCost=f=>(+f.betrag||0)+(+f.waesche||0);
const cost=e=>e.typ?(+e.betrag||0):fillCost(e);
/* Gemeinsame Zeitleiste, neueste zuerst */
const timeline=()=>allEntries().slice().sort((a,b)=>(b.datum+(b.zeit||'~')).localeCompare(a.datum+(a.zeit||'~'))||((b.km||0)-(a.km||0)));
function svcDetail(v){
  if(v.typ==='adblue')return v.menge?nf(v.menge,1)+' l':'';
  if(v.typ==='reifen')return v.reifen||'';
  return v.typ==='sonst'?'':(v.titel||'');
}
const ymText=s=>{if(!s)return '';const [y,m]=s.split('-').map(Number);return MON[m-1]+' '+y};
function nextText(v){const a=[];
  if(v.typ==='tuev'&&v.next)a.push(ymText(v.next));
  if(v.typ==='inspektion'){if(v.next)a.push(fmtS(v.next));if(v.nextKm)a.push(km(v.nextKm))}
  return a.join(' oder ')}
function entryRow(e,c,i){return e.typ?svcRow(e,i):fillRow(e,c,i)}
function svcRow(v,i){const d=parse(v.datum),det=svcDetail(v);
  return `<button type="button" class="row svc" data-svc="${v.id}" style="--j:${i||0}"><span class="date sv">${svcIco(v.typ)}<span>${d.getDate()}. ${MON[d.getMonth()].slice(0,3)}</span></span>
    <span class="main"><span class="t">${esc(svcName(v))}${det?' · '+esc(det):''}</span><span class="s">${v.km?km(v.km):''}${v.km&&v.ort?' · ':''}${esc(v.ort||'')}</span>
    ${nextText(v)?`<span class="s">nächste fällig: ${esc(nextText(v))}</span>`:''}</span>
    <span class="ramt">${v.betrag?`<span class="amt num">${eur(v.betrag)}</span>`:'<small class="muted">ohne Kosten</small>'}${v.foto?`<small class="muted" aria-label="mit Foto">${svg('cam','mini-ic')}</small>`:''}</span></button>`}

/* Fällig: TÜV, Inspektion (Datum oder km), aktuelle Bereifung */
function dueHtml(){
  const last=t=>svcByDate().find(v=>v.typ===t);
  const kmNow=(()=>{const a=allEntries().map(e=>+e.km||0);return a.length?Math.max(...a):null})();
  const items=[];
  const tv=last('tuev');
  if(tv&&tv.next){const [y,m]=tv.next.split('-').map(Number);const end=new Date(y,m,0);const d=Math.round((end-T())/864e5);
    items.push({t:'tuev',l:'TÜV / HU',v:ymText(tv.next),lvl:d<0?'crit':d<=45?'warn':'',s:d<0?'überfällig':d<=45?'in '+d+' Tagen':''})}
  const ins=last('inspektion');
  if(ins&&(ins.next||ins.nextKm)){let lvl='',sub=[];
    if(ins.next){const d=daysAgo(ins.next)*-1;if(d<0)lvl='crit';else if(d<=30)lvl='warn';if(d<=30)sub.push(d<0?'Datum überschritten':'in '+d+' Tagen')}
    if(ins.nextKm&&kmNow!=null){const r=ins.nextKm-kmNow;if(r<0)lvl='crit';else if(r<=1500&&lvl!=='crit')lvl='warn';sub.push(r<0?km(-r)+' drüber':'noch '+km(r))}
    items.push({t:'inspektion',l:'Inspektion',v:nextText(ins),lvl,s:sub.join(' · ')})}
  const rf=last('reifen');
  if(rf&&rf.reifen&&rf.reifen!=='Neue Reifen'){const m=new Date().getMonth()+1;const sommer=rf.reifen.startsWith('Sommer'),winter=rf.reifen.startsWith('Winter');
    const hint=sommer&&(m>=10||m<=3)?'Zeit für Winterreifen?':winter&&m>=4&&m<=9?'Zeit für Sommerreifen?':'';
    items.push({t:'reifen',l:rf.reifen.replace(' drauf',''),v:'seit '+fmtS(rf.datum),lvl:hint?'warn':'',s:hint})}
  if(!items.length)return '';
  return `<div><div class="sechead"><h2>Fahrzeug</h2></div><div class="list" style="margin-top:10px">${items.map((x,i)=>`<button type="button" class="row due${x.lvl?' '+x.lvl:''}" data-due="${x.t}" style="--j:${i}">
    <span class="date sv">${svcIco(x.t)}</span><span class="main"><span class="t">${esc(x.l)}</span><span class="s">${x.t==='reifen'?esc(x.v):'fällig '+esc(x.v)}</span>
    ${x.s?`<span class="s"><span class="pill${x.lvl?' '+x.lvl:''}">${esc(x.s)}</span></span>`:''}</span></button>`).join('')}</div></div>`}

/* Kosten nach Art im laufenden Jahr */
function breakdownHtml(){
  const y=String(new Date().getFullYear());const parts={Kraftstoff:0,Autowäsche:0};
  db.fills.filter(f=>f.datum.startsWith(y)).forEach(f=>{parts.Kraftstoff+=+f.betrag||0;parts.Autowäsche+=+f.waesche||0});
  db.services.filter(v=>v.datum.startsWith(y)).forEach(v=>{const n=(SVC[v.typ]||SVC.sonst).n;parts[n]=(parts[n]||0)+(+v.betrag||0)});
  const rows=Object.entries(parts).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);if(!rows.length)return '';
  const mx=rows[0][1],tot=rows.reduce((a,[,v])=>a+v,0);
  return `<div class="summary"><div class="label">Kosten ${y} nach Art</div>
    <div class="bars">${rows.map(([k,v])=>`<div class="bar"><span class="bl">${esc(k)}</span><span class="track"><span class="fill" style="width:${(v/mx*100).toFixed(1)}%"></span></span><span class="num">${eur(v)}</span></div>`).join('')}</div>
    <p class="hint">Gesamt: ${eur(tot)}</p></div>`}

async function openSvcDetail(id){
  const v=db.services.find(x=>x.id===id);if(!v)return;
  let url=null;if(v.foto){const b=await fotoGet(v.foto).catch(()=>null);if(b)url=URL.createObjectURL(b)}
  const det=svcDetail(v),nx=nextText(v);
  openSheet(head(esc(svcName(v)))+`
    ${url?`<img class="photo tiltme" src="${url}" alt="Beleg">`:''}
    <dl class="kv">
      <dt>Datum</dt><dd>${fmtS(v.datum)}</dd>
      ${v.km?`<dt>Kilometerstand</dt><dd class="num">${km(v.km)}</dd>`:''}
      ${det?`<dt>${v.typ==='adblue'?'Menge':v.typ==='reifen'?'Bereifung':'Was'}</dt><dd>${esc(det)}</dd>`:''}
      <dt>Kosten</dt><dd class="num">${v.betrag?eur(v.betrag):'ohne Kosten'}</dd>
      ${v.ort?`<dt>Werkstatt / Ort</dt><dd>${esc(v.ort)}</dd>`:''}
      ${nx?`<dt>Nächste fällig</dt><dd>${esc(nx)}</dd>`:''}
      ${v.notiz?`<dt>Notiz</dt><dd>${esc(v.notiz)}</dd>`:''}
    </dl>
    <div class="actions two"><button type="button" class="btn primary" id="dEdit">Bearbeiten</button><button type="button" class="btn danger" id="dDel">Löschen</button></div>`,
  s=>{s.querySelector('#dEdit').onclick=()=>openSvcForm(v.id);
    s.querySelector('#dDel').onclick=async()=>{if(!confirm('Diesen Eintrag löschen?'))return;
      db.services=db.services.filter(y=>y.id!==v.id);if(v.foto)fotoDel(v.foto).catch(()=>{});await save();closeSheet();render();toast('Eintrag gelöscht.')};
    const img=s.querySelector('.photo');if(img)img.onclick=()=>window.open(url,'_blank')});
}

function openSvcForm(id,typ){
  const old=id?db.services.find(x=>x.id===id):null;
  const v=old?Object.assign({},old):{typ:typ&&SVC[typ]?typ:'adblue',datum:iso(new Date())};
  const kmNow=(()=>{const a=allEntries().map(e=>+e.km||0);return a.length?Math.max(...a):null})();
  let newFoto=null,fotoGone=false,previewUrl=null;
  const nv=(k,d)=>v[k]==null||v[k]===''||Number.isNaN(v[k])?'':nf(v[k],d).replace(/\./g,'');
  openSheet(head(old?svcName(v)+' bearbeiten':'Service eintragen')+`
    <form id="sf" novalidate>
      <div class="field"><span>Art</span><div class="svcpick" role="radiogroup">${Object.entries(SVC).map(([k,o])=>`<label class="sp"><input type="radio" name="typ" value="${k}"${k===v.typ?' checked':''}>${svcIco(k)}<span>${o.n}</span></label>`).join('')}</div></div>
      <label class="field" data-f="titel"><span>Was?</span><input name="titel" maxlength="60" value="${esc(v.titel||'')}" placeholder="z. B. Scheibenwischer, Ölstand"></label>
      <div class="grid2"><label class="field"><span>Datum</span><input name="datum" type="date" required value="${esc(v.datum)}"></label>
        <label class="field"><span>Kilometerstand</span><input name="km" inputmode="numeric" placeholder="${kmNow?'zuletzt '+nf(kmNow,0):'optional'}" value="${v.km||''}"></label></div>
      <div class="grid2"><label class="field" data-f="menge"><span>Menge (l)</span><input name="menge" inputmode="decimal" placeholder="z. B. 10" value="${nv('menge',1)}"></label>
        <label class="field" data-f="reifen"><span>Bereifung</span><select name="reifen">${REIFEN.map(x=>`<option${x===v.reifen?' selected':''}>${x}</option>`).join('')}</select></label>
        <label class="field"><span>Kosten (€)</span><input name="betrag" inputmode="decimal" placeholder="leer = ohne Kosten" value="${nv('betrag',2)}"></label></div>
      <label class="field"><span>Werkstatt / Ort</span><input name="ort" maxlength="80" value="${esc(v.ort||'')}" list="ortlist" placeholder="optional"></label>
      <datalist id="ortlist">${[...new Set(svcByDate().map(x=>x.ort).filter(Boolean))].slice(0,12).map(x=>`<option value="${esc(x)}">`).join('')}</datalist>
      <label class="field" data-f="nextm"><span>Nächster TÜV (Monat)</span><input name="nextm" type="month" value="${v.typ==='tuev'?esc(v.next||''):''}"></label>
      <div class="grid2" data-f="nexti"><label class="field"><span>Nächste Inspektion am</span><input name="nextd" type="date" value="${v.typ==='inspektion'?esc(v.next||''):''}"></label>
        <label class="field"><span>oder bei km</span><input name="nextkm" inputmode="numeric" placeholder="optional" value="${v.nextKm||''}"></label></div>
      <label class="field"><span>Notiz (optional)</span><input name="notiz" maxlength="200" value="${esc(v.notiz||'')}" placeholder=""></label>
      <div class="field"><span>Beleg / Foto (optional)</span>
        <div class="fotobox" id="sbox"></div>
        <div class="actions"><label class="btn">${svg('cam','bi')} Foto aufnehmen<input id="scam" type="file" accept="image/*" capture="environment" hidden></label>
          <label class="btn">Aus Galerie<input id="sgal" type="file" accept="image/*" hidden></label>
          <button type="button" class="btn" id="srm" hidden>Foto entfernen</button></div></div>
      <div class="actions two"><button type="button" class="btn" data-close>Abbrechen</button><button class="btn primary" id="ssave">Speichern</button></div>
    </form>`,
  s=>{
    const fm=s.querySelector('#sf'),box=s.querySelector('#sbox'),rm=s.querySelector('#srm');
    s.querySelector('[data-close]').onclick=()=>closeSheet();
    const NOTE={adblue:'',reifen:'',inspektion:'z. B. Ölwechsel, Bremsen',tuev:'z. B. ohne Mängel',panne:'Was ist passiert? Abschleppdienst?',sonst:''};
    const vis=()=>{const t=fm.elements.typ.value;
      const show={titel:t==='sonst'||t==='panne',menge:t==='adblue',reifen:t==='reifen',nextm:t==='tuev',nexti:t==='inspektion'};
      fm.querySelectorAll('[data-f]').forEach(x=>{x.hidden=!show[x.dataset.f]});
      fm.querySelector('[data-f=titel] span').textContent=t==='panne'?'Was war los?':'Was?';
      fm.elements.notiz.placeholder=NOTE[t]||'';
      s.querySelector('.sheethead h2').textContent=old?svcName({typ:t,titel:v.titel})+' bearbeiten':(SVC[t].n+' eintragen');
      // TÜV: Vorschlag in 2 Jahren
      sugg();
    };
    let autoNext=!fm.elements.nextm.value;
    const sugg=()=>{const el=fm.elements;if(el.typ.value!=='tuev'||!autoNext||!el.datum.value)return;const d=parse(el.datum.value);el.nextm.value=(d.getFullYear()+2)+'-'+String(d.getMonth()+1).padStart(2,'0')};
    fm.elements.nextm.addEventListener('input',()=>{autoNext=false});fm.elements.datum.addEventListener('change',sugg);fm.elements.datum.addEventListener('input',sugg);
    fm.addEventListener('change',e=>{if(e.target.name==='typ'){vis();buzz(4)}});vis();
    const showFoto=async()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;
      let b=newFoto;if(!b&&v.foto&&!fotoGone)b=await fotoGet(v.foto).catch(()=>null);
      if(b){previewUrl=URL.createObjectURL(b);box.innerHTML=`<img class="photo" src="${previewUrl}" alt="Beleg">`;rm.hidden=false}else{box.innerHTML='';rm.hidden=true}};
    showFoto();
    const pick=async inp=>{const file=inp.files[0];inp.value='';if(!file)return;box.innerHTML='<span class="muted">Foto wird vorbereitet …</span>';
      const b=await shrink(file);if(!b){toast('Dieses Bild lässt sich nicht lesen.');showFoto();return}newFoto=b;fotoGone=false;await showFoto();buzz(6)};
    s.querySelector('#scam').addEventListener('change',e=>pick(e.target));s.querySelector('#sgal').addEventListener('change',e=>pick(e.target));
    rm.onclick=()=>{newFoto=null;fotoGone=true;showFoto()};
    fm.onsubmit=async e=>{e.preventDefault();const el=fm.elements,t=el.typ.value;
      fm.querySelectorAll('.field.no').forEach(x=>x.classList.remove('no'));
      if(!/^\d{4}-\d{2}-\d{2}$/.test(el.datum.value)){el.datum.closest('.field').classList.add('no');toast('Bitte ein Datum eintragen.');return}
      if(t==='sonst'&&!el.titel.value.trim()){el.titel.closest('.field').classList.add('no');toast('Bitte kurz eintragen, was gemacht wurde.');return}
      const o={typ:t,datum:el.datum.value,km:Math.round(num(el.km.value))||null,betrag:num(el.betrag.value),ort:el.ort.value.trim(),notiz:el.notiz.value.trim()};
      if(t==='sonst'||t==='panne')o.titel=el.titel.value.trim();
      if(t==='adblue')o.menge=num(el.menge.value);
      if(t==='reifen')o.reifen=el.reifen.value;
      if(t==='tuev')o.next=el.nextm.value||null;
      if(t==='inspektion'){o.next=el.nextd.value||null;o.nextKm=Math.round(num(el.nextkm.value))||null}
      if(o.km&&kmNow&&o.km>kmNow+5000&&!fm.dataset.ok){fm.dataset.ok='1';toast('Der Kilometerstand liegt weit über dem letzten. Nochmal „Speichern“ tippen, wenn er stimmt.');buzz([20,40,20]);return}
      const rec=Object.assign(old?{id:old.id,created:old.created,foto:old.foto}:{id:uid(),created:Date.now()},o,{updated:Date.now()});
      Object.keys(rec).forEach(k=>{if(rec[k]==null||rec[k]===''||(typeof rec[k]==='number'&&Number.isNaN(rec[k])))delete rec[k]});
      if(newFoto){const fid=uid();await fotoPut(fid,newFoto);if(rec.foto)fotoDel(rec.foto).catch(()=>{});rec.foto=fid}
      else if(fotoGone&&rec.foto){fotoDel(rec.foto).catch(()=>{});delete rec.foto}
      if(old)db.services[db.services.findIndex(x=>x.id===old.id)]=rec;else db.services.push(rec);
      await save();DS.savedTick(s.querySelector('#ssave'));
      setTimeout(()=>{closeSheet();render();toast(svcName(rec)+' gespeichert.')},motion()?500:0)};
  });
}

/* ---------- Tankstellen merken: Adresse → Name ----------
   Gleiche Postleitzahl + ähnlicher Straßenname (Lesefehler und Hausnummer egal) = dieselbe Tankstelle */
function addrParts(a){const m=String(a||'').match(/^(.*?),?\s*(\d{5})\b/);return m?{strasse:m[1].trim(),plz:m[2]}:null}
function findStation(plz,strasse,raw){if(!plz||!window.TankOCR)return null;const k=TankOCR.streetKey(strasse);
  const inPlz=db.stationen.filter(st=>st.plz===plz);
  let best=null,bd=9;for(const st of inPlz){const d=k&&st.key?TankOCR.lev(k,st.key):(k||st.key?9:0);if(d<bd){bd=d;best=st}}
  if(best&&bd<=2)return best;
  // Straße unlesbar (z. B. „Bamler yet rasso ',3“): verlesene Zeile mit gemerkten Straßen vergleichen
  if(raw!==undefined&&inPlz.length){const rk=String(raw).toLowerCase().replace(/[^a-zäöüß]/g,'');
    if(inPlz.length===1&&(!k||!rk||sim(rk,inPlz[0].key)>=.4))return inPlz[0];
    let b2=null,bs=0;for(const st of inPlz){const v=sim(rk,st.key);if(v>bs){bs=v;b2=st}}if(b2&&bs>=.5)return b2}
  return null}
/* Ähnlichkeit 0..1 über gemeinsame Buchstabenpaare (robust gegen eingeschobene Fehlzeichen) */
function sim(a,b){if(!a||!b)return 0;const g=s=>{const m=new Map();for(let i=0;i<s.length-1;i++){const x=s.slice(i,i+2);m.set(x,(m.get(x)||0)+1)}return m};
  const A=g(a),B=g(b);let n=0;for(const [x,c] of A)n+=Math.min(c,B.get(x)||0);return 2*n/Math.max(1,(a.length-1)+(b.length-1))}
function rememberStation(name,adresse){if(!name)return;const a=addrParts(adresse);
  if(!a||!window.TankOCR){if(!db.stationen.some(x=>x.name===name))db.stationen.push({name});return}
  const k=TankOCR.streetKey(a.strasse),hit=findStation(a.plz,a.strasse);
  if(hit){hit.name=name;hit.adresse=adresse;hit.key=k}else{const byName=db.stationen.find(x=>x.name===name&&!x.plz);
    if(byName)Object.assign(byName,{plz:a.plz,key:k,adresse});else db.stationen.push({plz:a.plz,key:k,name,adresse})}}

/* ---------- Abzeichen & Bilder je Tankstelle ---------- */
const ST_COLORS=['#64748B','#B4530F','#2563EB','#0E7490','#15803D','#A16207','#B91C1C','#7C3AED','#BE185D','#334155'];
const hashC=s=>{let h=0;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))>>>0;return ST_COLORS[h%ST_COLORS.length]};
const stImg=new Map();
async function loadStImgs(){
  const want=new Set(db.stationen.map(s=>s.bild).concat(Object.values(db.meta.brandImgs||{})).filter(Boolean));
  for(const [id,u] of stImg)if(!want.has(id)){URL.revokeObjectURL(u);stImg.delete(id)}
  let added=false;for(const id of want){if(stImg.has(id))continue;const b=await fotoGet(id).catch(()=>null);if(b){stImg.set(id,URL.createObjectURL(b));added=true}}
  return added}
const stOf=f=>{if(!f||!f.station)return null;const a=addrParts(f.adresse);
  return (a&&findStation(a.plz,a.strasse))||db.stationen.find(s=>s.name===f.station)||null};
function badge(st,name,cls=''){const n=(st&&st.name)||name||'';if(!n)return '';
  const img=(st&&st.bild&&stImg.get(st.bild))||brandImgUrl(n)||(name&&name!==n?brandImgUrl(name):null);
  if(img)return `<img class="stb ${cls}" src="${img}" alt="">`;
  const ch=(n.match(/[A-Za-zÄÖÜäöü0-9]/)||['?'])[0].toUpperCase();
  return `<span class="stb ${cls}" style="--stc:${(st&&st.farbe)||hashC(n)}" aria-hidden="true">${esc(ch)}</span>`}
async function cropRound(file){const bmp=await createImageBitmap(file);const s=Math.min(bmp.width,bmp.height),c=document.createElement('canvas');c.width=c.height=256;
  c.getContext('2d').drawImage(bmp,(bmp.width-s)/2,(bmp.height-s)/2,s,s,0,0,256,256);return new Promise(r=>c.toBlob(b=>r(b),'image/jpeg',.85))}
function openStation(st,back){
  if(!st)return;let newImg=null,imgGone=false,prev=null;
  openSheet(head('Tankstelle')+`
    <form id="stf" novalidate>
      <div class="stprev" id="stprev"></div>
      <label class="field"><span>Name</span><input name="name" maxlength="80" required value="${esc(st.name||'')}"></label>
      <label class="field"><span>Adresse</span><input name="adresse" maxlength="120" value="${esc(st.adresse||'')}" placeholder="optional"></label>
      <div class="field"><span>Farbe des Abzeichens</span><div class="stcols" role="radiogroup">${ST_COLORS.map(c=>`<label class="stcol" style="--stc:${c}"><input type="radio" name="farbe" value="${c}"${(st.farbe||hashC(st.name))===c?' checked':''}><span></span></label>`).join('')}</div></div>
      <div class="field"><span>Eigenes Bild (optional)</span>
        <p class="hint" style="margin:0 0 8px">Zum Beispiel ein Foto vom Schild an der Tankstelle. Es wird rund zugeschnitten und ersetzt das Abzeichen.</p>
        <div class="actions"><label class="btn">${svg('cam','bi')} Foto aufnehmen<input id="stcam" type="file" accept="image/*" capture="environment" hidden></label>
          <label class="btn">Aus Galerie<input id="stgal" type="file" accept="image/*" hidden></label>
          <button type="button" class="btn" id="strm"${st.bild?'':' hidden'}>Bild entfernen</button></div></div>
      <div class="actions two"><button type="button" class="btn danger" id="stdel">Vergessen</button><button class="btn primary" id="stsave">Speichern</button></div>
    </form>`,
  s=>{const fm=s.querySelector('#stf'),pv=s.querySelector('#stprev'),rm=s.querySelector('#strm');
    const draw=()=>{const tmp={name:fm.elements.name.value.trim()||st.name,farbe:fm.elements.farbe.value,bild:null};
      if(prev)pv.innerHTML=`<img class="stb big" src="${prev}" alt="">`;
      else if(st.bild&&!imgGone&&stImg.get(st.bild))pv.innerHTML=`<img class="stb big" src="${stImg.get(st.bild)}" alt="">`;
      else pv.innerHTML=badge(tmp,tmp.name,'big');
      rm.hidden=!(prev||(st.bild&&!imgGone))};
    draw();fm.addEventListener('input',draw);fm.addEventListener('change',draw);
    const pick=async inp=>{const f=inp.files[0];inp.value='';if(!f)return;const b=await cropRound(f).catch(()=>null);if(!b){toast('Dieses Bild lässt sich nicht lesen.');return}
      newImg=b;imgGone=false;if(prev)URL.revokeObjectURL(prev);prev=URL.createObjectURL(b);draw();buzz(6)};
    s.querySelector('#stcam').addEventListener('change',e=>pick(e.target));s.querySelector('#stgal').addEventListener('change',e=>pick(e.target));
    rm.onclick=()=>{newImg=null;imgGone=true;if(prev)URL.revokeObjectURL(prev);prev=null;draw()};
    s.querySelector('#stdel').onclick=async()=>{if(!confirm('Diese Tankstelle vergessen? Deine Tankungen bleiben unverändert, nur Abzeichen, Bild und das automatische Erkennen fallen weg.'))return;
      db.stationen=db.stationen.filter(x=>x!==st);if(st.bild)fotoDel(st.bild).catch(()=>{});await save();await loadStImgs();closeSheet();render();toast('Tankstelle vergessen.')};
    fm.onsubmit=async e=>{e.preventDefault();const el=fm.elements,name=el.name.value.trim();if(!name){el.name.closest('.field').classList.add('no');return}
      const oldName=st.name,ad=el.adresse.value.trim(),a=addrParts(ad);
      st.name=name;st.farbe=el.farbe.value;st.adresse=ad||undefined;if(a){st.plz=a.plz;st.key=window.TankOCR?TankOCR.streetKey(a.strasse):''}
      if(newImg){const id=uid();await fotoPut(id,newImg);if(st.bild)fotoDel(st.bild).catch(()=>{});st.bild=id}
      else if(imgGone&&st.bild){fotoDel(st.bild).catch(()=>{});delete st.bild}
      // Umbenennen: Einträge mit altem Namen mitziehen
      let n=0;if(oldName&&oldName!==name)db.fills.forEach(f=>{if(f.station===oldName){f.station=name;n++}});
      await save();await loadStImgs();DS.savedTick(s.querySelector('#stsave'));
      setTimeout(()=>{closeSheet();render();toast(n?`Gespeichert · ${n} Tankung${n===1?'':'en'} umbenannt`:'Gespeichert.');if(back)setTimeout(back,motion()?350:0)},motion()?450:0)};
  });
}
/* Tankstelle zu einer Tankung finden oder anlegen */
function stationFor(f){let st=stOf(f);if(st)return st;if(!f.station)return null;
  const a=addrParts(f.adresse);st={name:f.station};if(f.adresse)st.adresse=f.adresse;if(a){st.plz=a.plz;st.key=window.TankOCR?TankOCR.streetKey(a.strasse):''}
  db.stationen.push(st);return st}
function stationsHtml(){
  const used=new Map();db.fills.forEach(f=>{const st=stOf(f);if(st)used.set(st,(used.get(st)||0)+1)});
  const list=db.stationen.slice().sort((a,b)=>(used.get(b)||0)-(used.get(a)||0)||a.name.localeCompare(b.name));
  if(!list.length)return '<p class="ds-hint">Noch keine Tankstellen gemerkt. Sie entstehen automatisch, wenn du eine Tankung mit Tankstelle speicherst.</p>';
  return `<div class="stlist">${list.map(st=>`<button type="button" class="strow" data-st="${db.stationen.indexOf(st)}">${badge(st)}<span><b>${esc(st.name)}</b><small>${esc(st.adresse||'ohne Adresse')} · ${used.get(st)||0}×</small></span></button>`).join('')}</div>`}


/* ---------- Tankstellen in der Nähe (OpenStreetMap / Overpass), gefiltert nach Shell-Card-Akzeptanz ----------
   Akzeptanz laut Shell-Übersicht „Partnerakzeptanzen der Shell Card“ (Stand August 2023), in den Einstellungen änderbar. */
const CARD_BRANDS=[
  {k:'shell',n:'Shell',re:/\bshell\b/i},
  {k:'esso',n:'Esso',re:/\besso\b/i},
  {k:'eni',n:'Agip / Eni',re:/\b(eni|agip)\b/i},
  {k:'avia',n:'AVIA',re:/\bavia\b/i},
  {k:'omv',n:'OMV',re:/\bomv\b/i},
  {k:'westfalen',n:'Westfalen',re:/\bwestfalen\b/i},
  {k:'orlen',n:'star / ORLEN',re:/\b(star|orlen)\b/i}];
const cardOn=()=>{const m=db.meta.cardBrands;return Array.isArray(m)?m:CARD_BRANDS.map(b=>b.k)};
const brandOf=t=>{const s=[t.brand,t.name,t.operator].filter(Boolean).join(' ');for(const b of CARD_BRANDS)if(b.re.test(s))return b;return null};
const distKm=(a,b,c,d)=>{const R=6371,r=x=>x*Math.PI/180,dl=r(c-a),dn=r(d-b);const h=Math.sin(dl/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const fmtDist=k=>k<1?Math.round(k*1000/10)*10+' m':nf(k,k<10?1:0)+' km';
let nearState={r:10,only:true,pos:null,list:null,err:'',busy:false};
function getPos(){
  const once=(hi,t)=>new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy}),rej,{enableHighAccuracy:hi,timeout:t,maximumAge:300000}));
  if(!navigator.geolocation)return Promise.reject(new Error('Dieses Gerät kann den Standort nicht bestimmen.'));
  // erst genau (GPS), sonst grob (Netz/WLAN) – drinnen klappt GPS oft nicht
  return once(true,10000).catch(e=>e&&e.code===1?Promise.reject(e):once(false,15000)).catch(e=>{
    throw new Error(e&&e.code===1?'Standortzugriff ist für die App gesperrt. Erlaube ihn: Chrome → ⋮ → Einstellungen → Website-Einstellungen → Standort, oder in den Android-Einstellungen der App.':'Standort konnte nicht bestimmt werden. Ist der Standort (GPS) am Handy eingeschaltet?')})}
/* Tankstellenliste: wird monatlich vom GitHub-Ablauf „Tankstellen aktualisieren“ aus OpenStreetMap erzeugt.
   Die Suche läuft komplett auf dem Handy – der Standort verlässt das Gerät nicht. */
let stP=null,shP;
/* Shell-Akzeptanzliste (importierte CSV aus der Shell-Card-Tankstellensuche), liegt nur auf diesem Handy */
function loadShell(){if(shP)return shP;shP=kvGet('shellListe').then(j=>j?JSON.parse(j):null).catch(()=>null);return shP}
async function importShellCsv(file){
  if(!window.TankStations)throw new Error('Import fehlt in diesem App-Stand.');
  const o=TankStations.parseShellCsv(await file.text());o.stand=iso(new Date());o.datei=file.name;
  await kvPut('shellListe',JSON.stringify(o));shP=Promise.resolve(o);db.meta.shellListe={n:o.n,stand:o.stand};await save(false,false);
  nearState.shell=null;return o}
function loadStations(){if(stP)return stP;
  stP=fetch('tankstellen.json',{cache:'no-cache'}).then(r=>{if(r.status===404)throw Object.assign(new Error('fehlt'),{missing:true});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
    .then(j=>{if(!j||!Array.isArray(j.s))throw new Error('ungültig');return j});
  stP.catch(()=>{stP=null});return stP}
function nearItems(){
  const {pos,list,shell,r}=nearState;if(!pos||(!list&&!shell))return [];
  const dLat=r/111,dLon=r/(111*Math.cos(pos.lat*Math.PI/180));
  const box=a=>Math.abs(a[0]-pos.lat)<=dLat&&Math.abs(a[1]-pos.lon)<=dLon;
  const out=[];
  if(shell){for(const a of shell.s){if(!box(a))continue;const [lat,lon,brand,addr,plz,city,fl,tel]=a,d=distKm(pos.lat,pos.lon,lat,lon);if(d>r)continue;
    out.push({id:'s'+lat+','+lon,lat,lon,d,src:'shell',brand:brand?{n:brand,re:new RegExp('\\b'+brand.replace(/[^\w]/g,'')+'\\b','i')}:null,name:brand||'Tankstelle',
      label:(brand||'Tankstelle')+' '+city,addr:[addr,[plz,city].filter(Boolean).join(' ')].filter(Boolean).join(', '),open:fl&1?'24/7':'',adblue:!!(fl&2),wash:!!(fl&4),tel,ok:true})}}
  // OpenStreetMap: mit Shell-Liste nur als Ergänzung (Filter aus), sonst wie bisher nach Marke
  if(list&&(!shell||!nearState.only)){for(const a of list){if(!box(a))continue;
    const [lat,lon,brand,name,str,hnr,plz,city,oh]=a,d=distKm(pos.lat,pos.lon,lat,lon);if(d>r)continue;
    if(shell&&out.some(x=>x.src==='shell'&&distKm(lat,lon,x.lat,x.lon)<.12))continue; // schon in der Shell-Liste
    const t={brand,name},b=brandOf(t),street=[str,hnr].filter(Boolean).join(' ');
    out.push({id:'o'+lat+','+lon,lat,lon,d,src:'osm',brand:b,name:brand||name||'Tankstelle',
      label:(brand&&name?(name.toLowerCase().includes(brand.toLowerCase())?name:brand+' · '+name):(brand||name))||'Tankstelle',
      addr:[street,[plz,city].filter(Boolean).join(' ')].filter(Boolean).join(', '),open:oh||'',ok:shell?false:!!(b&&cardOn().includes(b.k))})}}
  return out.sort((a,b)=>a.d-b.d)}
const viewSeg=()=>`<button type="button" data-view="liste" aria-pressed="${nearState.view!=='karte'}">Liste</button><button type="button" data-view="karte" aria-pressed="${nearState.view==='karte'}">Karte</button>`;
function nearHtml(){
  const st=nearState,items=nearItems(),all=st.only?items.filter(x=>x.ok):items,hidden=items.length-all.length,shown=all.slice(0,50);
  if(st.view==='karte')return `<div class="nearctl"><div class="seg two">${viewSeg()}</div></div>
    ${st.shell?`<div class="mapfull" id="nMap"></div><p class="hint">${nf(st.shell.n,0)} Stationen aus der Shell-Liste vom ${fmtS(st.shell.stand)}. Dein Standort: dunkler Punkt mit pulsierendem Ring. Punkt antippen für Details und Route. Farben: Shell gelb, Esso blau, Eni/Agip grün, Westfalen rot, Markant violett, andere grau.</p>`
      :'<div class="note">Für die Karte zuerst die Shell-Liste importieren: Daten → Tankstellen → „Shell-Liste importieren (CSV)“.</div>'}`;
  return `<div class="nearctl"><div class="seg two">${viewSeg()}</div>
      <div class="seg" role="radiogroup" aria-label="Umkreis">${[5,10,25].map(r=>`<button type="button" data-r="${r}" aria-pressed="${st.r===r}">${r} km</button>`).join('')}</div>
      <label class="check"><input type="checkbox" id="nOnly"${st.only?' checked':''}> nur mit Shell Card</label></div>
    ${st.busy?`<p class="hint">⏳ ${esc(st.step||'Suche …')}</p>`:st.err?`<div class="note">${esc(st.err)}${st.detail?`<br><small>${esc(st.detail)}</small>`:''}</div><div class="actions"><button type="button" class="btn" id="nRetry">Nochmal versuchen</button></div>`:!(st.list||st.shell)?'':
      shown.length?`<div class="list">${shown.map((x,i)=>{const known=db.stationen.find(s=>x.brand&&new RegExp(x.brand.re.source,'i').test(s.name)&&s.adresse&&x.addr&&TankOCR&&s.plz&&x.addr.includes(s.plz)&&TankOCR.lev(TankOCR.streetKey(x.addr.split(',')[0]),s.key)<=2);
        return `<div class="row near" role="button" tabindex="0" data-nid="${esc(x.id)}" style="--j:${i}">${badge(known,x.brand?x.brand.n.split(' ')[0]:x.name)}<span class="main"><span class="t">${esc(known?known.name:x.label)}</span>
          <span class="s">${esc(x.addr||'Adresse unbekannt')}</span>
          <span class="s">${x.ok?'<span class="pill ok">Shell Card</span> ':nearState.shell?'<span class="pill">nicht in Shell-Liste</span> ':x.brand?'':'<span class="pill">Akzeptanz unbekannt</span> '}${[x.open==='24/7'?'24 h':x.open?esc(x.open.length>30?x.open.slice(0,30)+'…':x.open):'',x.adblue?'AdBlue':'',x.wash?'Wäsche':''].filter(Boolean).join(' · ')}</span></span>
          <span class="ramt"><b class="num">${fmtDist(x.d)}</b><a class="ghost sm" data-route href="${routeUrl(x)}" target="_blank" rel="noopener noreferrer">Route</a></span></div>`}).join('')}</div>`
      :`<div class="list"><div class="empty">Keine passende Tankstelle im Umkreis von ${st.r} km.${hidden?' Größeren Umkreis wählen oder Filter ausschalten.':''}</div></div>`}
    ${(st.list||st.shell)&&!st.busy&&!st.err?`<p class="hint">${all.length>50?'Die 50 nächsten von '+all.length+' passenden. ':''}${all.length} von ${items.length} Tankstellen${hidden&&st.only?` · ${hidden} ohne Shell-Card-Akzeptanz ausgeblendet`:''}. ${st.shell?`Akzeptanz laut Shell-Liste vom ${fmtS(st.shell.stand)} (${nf(st.shell.n,0)} Stationen).`:'Akzeptanz nach Marke – genauer wird es mit der Shell-Liste (Daten → Tankstellen → Shell-Liste importieren).'}</p>`:''}
    <p class="hint">Die Suche läuft auf deinem Handy, dein Standort wird nicht gesendet.${st.list?` Ergänzend OpenStreetMap${st.stand?' vom '+fmtS(st.stand):''}, © OpenStreetMap-Mitwirkende (ODbL).`:''}</p>`}
const routeUrl=x=>`https://www.google.com/maps/dir/?api=1&amp;destination=${x.lat},${x.lon}`;
const geoUrl=x=>`geo:${x.lat},${x.lon}?q=${x.lat},${x.lon}(${encodeURIComponent(x.label)})`;
function openNearDetail(x){
  const d=.006,bbox=[x.lon-d*1.6,x.lat-d,x.lon+d*1.6,x.lat+d].map(v=>v.toFixed(5)).join(',');
  openSheet(head(esc(x.label))+`
    <div class="mapbox"><iframe title="Karte" loading="lazy" referrerpolicy="no-referrer" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${x.lat.toFixed(5)},${x.lon.toFixed(5)}"></iframe></div>
    <dl class="kv">
      <dt>Adresse</dt><dd>${esc(x.addr||'unbekannt')}</dd>
      <dt>Entfernung</dt><dd class="num">${fmtDist(x.d)} Luftlinie</dd>
      ${x.open?`<dt>Geöffnet</dt><dd>${x.open==='24/7'?'24 Stunden':esc(x.open)}</dd>`:''}
      <dt>Shell Card</dt><dd>${x.ok?'<span class="pill ok">wird angenommen</span>':nearState.shell?'nicht in der Shell-Liste':x.brand?'nicht in deiner Akzeptanzliste':'unbekannt (Marke fehlt in OpenStreetMap)'}</dd>
      ${x.adblue||x.wash?`<dt>Extras</dt><dd>${[x.adblue&&'AdBlue (Pkw)',x.wash&&'Waschanlage'].filter(Boolean).join(', ')}</dd>`:''}
      ${x.tel?`<dt>Telefon</dt><dd><a href="tel:${esc(x.tel.replace(/[^\d+]/g,''))}">${esc(x.tel)}</a></dd>`:''}
    </dl>
    <div class="actions"><a class="btn primary" href="${routeUrl(x)}" target="_blank" rel="noopener noreferrer">Route starten</a><a class="btn" href="${geoUrl(x)}">In Karten-App öffnen</a></div>
    <div class="actions"><button type="button" class="btn" id="nBack">‹ Zurück zur Liste</button></div>
    <p class="hint">Karte © OpenStreetMap-Mitwirkende.</p>`,
  s=>{s.querySelector('#nBack').onclick=()=>openNear(true)});
}
function openNear(keep){
  openSheet(head('Tankstellen in der Nähe')+'<div id="nearBody"></div>',async s=>{
    const body=s.querySelector('#nearBody');
    let map=null;
    const draw=()=>{if(map){map.remove();map=null}body.innerHTML=nearHtml();
      body.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{nearState.view=b.dataset.view;buzz(4);draw()});
      if(nearState.view==='karte'){const el=body.querySelector('#nMap');if(el)drawMap(el,nearState).then(m=>{map=m}).catch(e=>{el.outerHTML=`<div class="note">${esc(e.message)}</div>`});return}
      body.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{nearState.r=+b.dataset.r;buzz(4);search()});
      body.querySelector('#nOnly').onchange=e=>{nearState.only=e.target.checked;if(!nearState.only&&!nearState.list)search();else draw()};
      const rt=body.querySelector('#nRetry');if(rt)rt.onclick=()=>search();
      const items=nearItems();
      body.querySelectorAll('[data-nid]').forEach(r=>{const go=e=>{if(e.target.closest('[data-route]'))return;const x=items.find(i=>i.id===r.dataset.nid);if(x){buzz(4);openNearDetail(x)}};
        r.onclick=go;r.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go(e)}}})};
    const search=async()=>{const st=nearState;st.busy=true;st.err='';st.detail='';st.step='Standort wird bestimmt …';draw();
      try{st.pos=await getPos();}catch(e){st.busy=false;st.err=e.message;if(body.isConnected)draw();return}
      if(!st.shell)st.shell=await loadShell();
      if(!st.list&&(!st.shell||!st.only)){st.step='Tankstellenliste wird geladen …';if(body.isConnected)draw();
        try{const j=await loadStations();st.list=j.s;st.stand=j.stand}
        catch(e){if(!st.shell){st.err=e.missing?'Noch keine Tankstellenliste vorhanden.':navigator.onLine===false?'Keine Internetverbindung – die Tankstellenliste wurde noch nie geladen.':'Die Tankstellenliste konnte nicht geladen werden.';
          st.detail=e.missing?'Am einfachsten: Daten → Tankstellen → „Shell-Liste importieren“ mit der CSV von der Shell-Tankstellensuche.':(e.message||'')}}}
      st.busy=false;if(body.isConnected)draw()};
    draw();if(!(keep&&nearState.list))search();
  });
}
function cardBrandsHtml(){const on=cardOn(),sl=db.meta.shellListe;
  return `<div class="ds-lbl sep">Shell-Liste (Akzeptanz je Station)</div>
    <p class="ds-hint">${sl?`Importiert am ${fmtS(sl.stand)}: ${nf(sl.n,0)} Tankstellen, an denen die Shell Card angenommen wird. Für einen neuen Stand einfach erneut importieren.`:'Lade auf shell.de in der Tankstellensuche für Shell-Card-Kunden die CSV-Liste herunter und importiere sie hier. Dann zeigt „Tankstellen in der Nähe“ genau die Stationen, an denen die Karte angenommen wird.'}</p>
    <div class="ds-acts"><label class="ds-btn${sl?'':' pri'}">${sl?'Neue Shell-Liste importieren':'Shell-Liste importieren (CSV)'}<input id="shIn" type="file" accept=".csv,text/csv,text/comma-separated-values,application/vnd.ms-excel" hidden></label></div>
    ${sl?'':`<div class="ds-lbl sep">Ohne Shell-Liste: Akzeptanz nach Marke</div><p class="ds-hint">Für „Tankstellen in der Nähe“: An diesen Marken kannst du mit der Shell Card tanken (laut Shell-Übersicht, Stand 08/2023). Passe die Liste an, falls sich etwas ändert.</p>
    <div class="cbgrid">${CARD_BRANDS.map(b=>`<label class="check"><input type="checkbox" data-cb="${b.k}"${on.includes(b.k)?' checked':''}> ${b.n}</label>`).join('')}</div>`}`}

/* ---------- Bilder je Marke (vom Nutzer hinterlegt) ---------- */
const BRAND_LIST=['Shell','Esso','Eni','Agip','Westfalen','Markant','Aral','JET','TotalEnergies','AVIA','OMV','star','HEM','Raiffeisen'];
const bKey=b=>String(b||'').trim().toLowerCase().replace(/[^a-z0-9äöü]/g,'');
const brandImgs=()=>db.meta.brandImgs||(db.meta.brandImgs={});
/* Marke aus einem Namen wie „Esso Bergkamen“ erkennen (nur Marken mit Bild) */
function brandFromName(n){const s=String(n||'').toLowerCase();for(const k of Object.keys(brandImgs()))if(new RegExp('(^|[^a-zäöü])'+k+'([^a-zäöü]|$)').test(s))return k;return ''}
function brandImgUrl(brandOrName){const m=brandImgs();let k=bKey(brandOrName);if(!m[k])k=brandFromName(brandOrName);return k&&m[k]?stImg.get(m[k])||null:null}
function brandsHtml(){const m=brandImgs();const set=new Set(BRAND_LIST);
  (nearState.shell&&nearState.shell.s||[]).forEach(a=>{if(a[2])set.add(a[2])});
  return `<div class="ds-lbl sep">Bilder je Marke</div><p class="ds-hint">Hinterlege pro Marke ein Bild (z. B. ein Foto vom Schild). Die App zeigt es dann überall bei Tankstellen dieser Marke – in der Suche, auf der Karte und im Verlauf. Ein eigenes Bild einer gemerkten Tankstelle hat Vorrang.</p>
    <div class="brgrid">${[...set].map(b=>{const k=bKey(b),u=m[k]&&stImg.get(m[k]);return `<div class="brcell"><label class="brpick" title="${esc(b)}">${u?`<img class="stb" src="${u}" alt="">`:`<span class="stb" style="--stc:${hashC(b)}">${esc(b[0].toUpperCase())}</span>`}<input type="file" accept="image/*" data-brimg="${esc(k)}" hidden></label><small>${esc(b)}</small>${u?`<button type="button" class="linkbtn" data-brdel="${esc(k)}">entfernen</button>`:''}</div>`}).join('')}</div>`}
function bindBrands(s,reopen){
  s.querySelectorAll('[data-brimg]').forEach(inp=>inp.addEventListener('change',async()=>{const f=inp.files[0];inp.value='';if(!f)return;
    const b=await cropRound(f).catch(()=>null);if(!b){toast('Dieses Bild lässt sich nicht lesen.');return}
    const k=inp.dataset.brimg,m=brandImgs(),id=uid();await fotoPut(id,b);if(m[k])fotoDel(m[k]).catch(()=>{});m[k]=id;
    await save();await loadStImgs();render();buzz(6);toast('Bild gespeichert.');reopen()}));
  s.querySelectorAll('[data-brdel]').forEach(bt=>bt.onclick=async()=>{const k=bt.dataset.brdel,m=brandImgs();if(m[k])fotoDel(m[k]).catch(()=>{});delete m[k];await save();await loadStImgs();render();reopen()});
}

/* ---------- Karte der Shell-Liste (Leaflet + OpenStreetMap-Kacheln) ---------- */
const LEAFLET_JS='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',LEAFLET_CSS='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
let leafP=null;
function leaflet(){if(window.L)return Promise.resolve(window.L);if(leafP)return leafP;
  leafP=new Promise((res,rej)=>{const l=document.createElement('link');l.rel='stylesheet';l.href=LEAFLET_CSS;l.crossOrigin='anonymous';document.head.appendChild(l);
    const s=document.createElement('script');s.src=LEAFLET_JS;s.crossOrigin='anonymous';s.onload=()=>res(window.L);s.onerror=()=>{leafP=null;rej(new Error('Karte konnte nicht geladen werden (keine Verbindung?).'))};document.head.appendChild(s)});
  return leafP}
const BRAND_COLOR=b=>({shell:'#D9A400',esso:'#2563EB',eni:'#15803D',agip:'#15803D',westfalen:'#B91C1C',markant:'#7C3AED'})[bKey(b)]||'#64748B';
async function drawMap(el,st){
  const L=await leaflet();if(!el.isConnected)return;
  const c=st.pos||{lat:51.16,lon:10.45};
  const map=L.map(el,{preferCanvas:true,zoomControl:true,attributionControl:true}).setView([c.lat,c.lon],st.pos?12:6);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',
    attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);
  const items=st.shell?st.shell.s:[];
  const show=a=>{const [lat,lon,brand,addr,plz,city,fl,tel]=a;
    const x={id:'s'+lat+','+lon,lat,lon,d:st.pos?distKm(st.pos.lat,st.pos.lon,lat,lon):0,src:'shell',brand:brand?{n:brand}:null,name:brand||'Tankstelle',label:(brand||'Tankstelle')+' '+city,
      addr:[addr,[plz,city].filter(Boolean).join(' ')].filter(Boolean).join(', '),open:fl&1?'24/7':'',adblue:!!(fl&2),wash:!!(fl&4),tel,ok:true};openNearDetail(x)};
  for(const a of items){const m=L.circleMarker([a[0],a[1]],{radius:6,weight:1.5,color:'#fff',fillColor:BRAND_COLOR(a[2]),fillOpacity:.95}).addTo(map);
    m.bindTooltip(`${esc(a[2]||'Tankstelle')} · ${esc(a[3])}, ${esc(a[5])}`,{direction:'top'});m.on('click',()=>{buzz(4);show(a)})}
  if(st.pos){const me=[st.pos.lat,st.pos.lon];
    // Genauigkeit als heller Kreis, darüber ein eigener, pulsierender Standort-Punkt – anders als die runden Tankstellen-Punkte
    if(st.pos.acc&&st.pos.acc<3000)L.circle(me,{radius:st.pos.acc,weight:1,color:'#111827',opacity:.35,fillColor:'#111827',fillOpacity:.08,interactive:false}).addTo(map);
    L.marker(me,{icon:L.divIcon({className:'mepin',html:'<span class="mepulse"></span><span class="medot"></span>',iconSize:[44,44],iconAnchor:[22,22]}),zIndexOffset:1000,keyboard:false,interactive:false}).addTo(map);
    const b=document.createElement('button');b.type='button';b.className='mebtn';b.setAttribute('aria-label','Zu meinem Standort');b.title='Zu meinem Standort';
    b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';
    b.onclick=e=>{e.stopPropagation();buzz(4);map.setView(me,Math.max(map.getZoom(),13))};el.appendChild(b)}
  setTimeout(()=>map.invalidateSize(),250);
  return map}

/* ---------- Formular ---------- */
async function shrink(file){
  const bmp=await createImageBitmap(file).catch(()=>null);
  if(!bmp){return file.type==='image/jpeg'?file:null}
  const m=1800,sc=Math.min(1,m/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');
  c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  return new Promise(r=>c.toBlob(b=>r(b),'image/jpeg',.82))}
function openForm(id,withPhoto){
  const old=id?db.fills.find(x=>x.id===id):null;
  const last=byDate()[0];
  const now=new Date();
  const f=old?Object.assign({},old):{datum:iso(now),zeit:String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),
    sorte:last&&last.sorte||'Diesel',station:'',voll:true};
  let newFoto=null,fotoGone=false,previewUrl=null;
  const v=(k,d)=>f[k]==null||f[k]===''||Number.isNaN(f[k])?'':nf(f[k],d).replace(/\./g,'');
  openSheet(head(old?'Tankung bearbeiten':'Neue Tankung')+`
    <form id="ff" novalidate>
      <div class="field"><span>Quittung</span>
        <div class="fotobox" id="fbox">${f.foto?'<span class="muted">Foto vorhanden</span>':''}</div>
        <div class="actions"><label class="btn${old||f.foto?'':' primary'}">${svg('cam','bi')} ${f.foto?'Neues Foto':'Foto aufnehmen'}<input id="fcam" type="file" accept="image/*" capture="environment" hidden></label>
          <label class="btn">Aus Galerie<input id="fgal" type="file" accept="image/*" hidden></label>
          <button type="button" class="btn" id="frm"${f.foto?'':' hidden'}>Foto entfernen</button></div>
        <p class="hint" id="focr">Nach dem Foto liest die App die Quittung automatisch aus, inklusive Autowäsche und Kilometerstand.</p></div>
      <div class="grid2"><label class="field"><span>Datum</span><input name="datum" type="date" required value="${esc(f.datum)}"></label>
        <label class="field"><span>Uhrzeit</span><input name="zeit" type="time" value="${esc(f.zeit||'')}"></label></div>
      <label class="field"><span>Kilometerstand</span><input name="km" inputmode="numeric" required placeholder="${last?'zuletzt '+nf(last.km,0):'z. B. 48 250'}" value="${f.km!=null?f.km:''}"></label>
      <div class="grid2"><label class="field"><span>Liter</span><input name="liter" inputmode="decimal" required placeholder="45,12" value="${v('liter',2)}"></label>
        <label class="field"><span>Betrag Kraftstoff (€)</span><input name="betrag" inputmode="decimal" required placeholder="78,40" value="${v('betrag',2)}"></label></div>
      <div class="grid2"><label class="field"><span>Autowäsche (€)</span><input name="waesche" inputmode="decimal" placeholder="keine" value="${v('waesche',2)}"></label>
        <div class="field"><span>Quittung gesamt</span><output id="fsum" class="num sumout">–</output></div></div>
      <p class="hint" style="margin-top:-6px">Steht eine Wäsche mit auf der Quittung, bei „Betrag Kraftstoff“ nur den Sprit eintragen.</p>
      <div class="grid2"><label class="field"><span>Preis pro Liter (€)</span><input name="ppl" inputmode="decimal" placeholder="wird berechnet" value="${v('ppl',3)}"></label>
        <label class="field"><span>Kraftstoff</span><select name="sorte">${SORTEN.map(x=>`<option${x===f.sorte?' selected':''}>${x}</option>`).join('')}</select></label></div>
      <label class="field"><span>Tankstelle / Ort</span><input name="station" maxlength="80" value="${esc(f.station||'')}" placeholder="z. B. Aral Kamen" list="stlist"></label>
      <label class="field"><span>Adresse der Tankstelle</span><input name="adresse" maxlength="120" value="${esc(f.adresse||'')}" placeholder="wird von der Quittung gelesen"></label>
      <datalist id="stlist">${[...new Set(byDate().map(x=>x.station).filter(Boolean))].slice(0,12).map(x=>`<option value="${esc(x)}">`).join('')}</datalist>
      <label class="check"><input name="voll" type="checkbox"${f.voll===false?'':' checked'}> Vollgetankt <span class="muted">(nur bei Ausnahmen abwählen)</span></label>
      <label class="field"><span>Notiz (optional)</span><input name="notiz" maxlength="200" value="${esc(f.notiz||'')}"></label>
      <div class="note" id="fwarn" hidden></div>
      <div class="actions two"><button type="button" class="btn" data-close>Abbrechen</button><button class="btn primary" id="fsave">Speichern</button></div>
    </form>`,
  s=>{
    const fm=s.querySelector('#ff'),box=s.querySelector('#fbox'),warn=s.querySelector('#fwarn'),rm=s.querySelector('#frm');
    s.querySelector('[data-close]').onclick=()=>closeSheet();
    const showFoto=async()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;
      let b=newFoto;if(!b&&f.foto&&!fotoGone)b=await fotoGet(f.foto).catch(()=>null);
      if(b){previewUrl=URL.createObjectURL(b);box.innerHTML=`<img class="photo" src="${previewUrl}" alt="Quittung">`;rm.hidden=false}
      else{box.innerHTML='';rm.hidden=true}};
    showFoto();
    const pick=async inp=>{const file=inp.files[0];inp.value='';if(!file)return;box.innerHTML='<span class="muted">Foto wird vorbereitet …</span>';
      const b=await shrink(file);if(!b){toast('Dieses Bild lässt sich nicht lesen.');showFoto();return}newFoto=b;fotoGone=false;await showFoto();buzz(6);
      ocr(file)};
    /* Quittung auslesen: füllt nur Felder, die du noch nicht selbst geändert hast */
    const touched=new Set(),focr=s.querySelector('#focr');
    fm.addEventListener('input',e=>{if(e.isTrusted&&e.target.name)touched.add(e.target.name)});
    let ocrRun=0;
    const ocr=async file=>{if(!window.TankOCR){focr.textContent='Die Texterkennung fehlt in diesem App-Stand.';return}
      const run=++ocrRun;focr.className='hint ocrbusy';focr.textContent='Quittung wird gelesen …';
      fm.querySelectorAll('.ocr').forEach(x=>x.classList.remove('ocr'));
      let r;try{r=await TankOCR.read(file,(st,p)=>{if(run!==ocrRun)return;
          focr.textContent=/recogni/i.test(st)?`Quittung wird gelesen … ${Math.round(p*100)} %`:'Texterkennung wird vorbereitet …'})}
      catch(e){if(run!==ocrRun)return;focr.className='hint';
        focr.textContent=navigator.onLine===false||(e&&e.message==='offline')?'Für das erste Auslesen braucht die App einmal Internet (lädt die Texterkennung, ca. 10 MB). Danach geht es auch offline.':'Auslesen hat nicht geklappt. Bitte die Werte abtippen.';return}
      if(run!==ocrRun||!fm.isConnected)return;
      const el=fm.elements,isNew=!old,put=(k,val)=>{if(val==null||val===''||Number.isNaN(val))return false;const i=el[k];if(!i||touched.has(k))return false;
        if(i.value&&!(isNew&&(k==='datum'||k==='zeit'||k==='sorte')))return false;i.value=val;i.closest('.field,.check')?.classList.add('ocr');return true};
      const fx=(v,d)=>nf(v,d).replace(/\./g,'');const got=[];
      if(put('datum',r.datum))got.push(fmtS(r.datum));put('zeit',r.zeit);
      if(put('km',r.km))got.push(km(r.km));
      if(put('liter',r.liter&&fx(r.liter,2)))got.push(nf(r.liter,2)+' l');
      if(put('ppl',r.ppl&&fx(r.ppl,3)))got.push(nf(r.ppl,3)+' €/l');
      if(put('betrag',r.betrag&&fx(r.betrag,2)))got.push(eur(r.betrag));
      if(put('waesche',r.waesche&&fx(r.waesche,2)))got.push('Wäsche '+eur(r.waesche));
      if(r.sorte&&SORTEN.includes(r.sorte))put('sorte',r.sorte);
      const known=findStation(r.plz,r.strasse,r.strRaw||'');
      if(known){put('station',known.name);put('adresse',known.adresse);if(known.name)got.push(known.name+' (bekannt)')}
      else{put('station',r.station);if(put('adresse',r.adresse))got.push(r.adresse);else if(r.station)got.push(r.station)}
      live();buzz(got.length?[8,40,8]:[20,40,20]);
      const miss=[!r.km&&'Kilometerstand',!r.liter&&'Liter',!r.betrag&&'Betrag',r.plz&&!r.strasse&&!known&&'Straße (einmal eintragen, danach erkennt die App die Tankstelle)'].filter(Boolean);
      focr.className='hint '+(miss.length||!r.ok?'ocrwarn':'ocrok');
      focr.innerHTML=got.length?`<b>Erkannt:</b> ${esc(got.join(' · '))}.`+(miss.length?` <b>Nicht gefunden:</b> ${esc(miss.join(', '))} – bitte ergänzen.`:r.ok&&r.sumOk!==false?' Rechnung geht auf ✓ Bitte kurz prüfen.':' Bitte prüfen.')
        :'Auf dem Foto wurde nichts Brauchbares erkannt. Tipp: Quittung flach hinlegen, gerade von oben fotografieren, ohne Schatten.';
      focr.insertAdjacentHTML('beforeend',' <button type="button" class="linkbtn" id="ocrTxt">Erkannten Text anzeigen</button>');
      focr.querySelector('#ocrTxt').onclick=()=>{let d=document.getElementById('ocrdlg');
        if(!d){d=document.createElement('dialog');d.id='ocrdlg';d.className='dsdlg';document.body.appendChild(d)}
        d.innerHTML=`<h2>Erkannter Text</h2><p class="ds-dlg-intro">So hat die Texterkennung die Quittung gelesen. Wenn etwas nicht übernommen wird, schick einen Screenshot davon.</p><pre class="ocrpre">${esc(r.text||'')}</pre><div class="dsrow"><button type="button" class="ds-btn pri" id="ocrX">Schließen</button></div>`;
        d.querySelector('#ocrX').onclick=()=>d.close();d.showModal()};
      const first=fm.querySelector('.field.no, input:placeholder-shown[required]');if(miss.length&&first&&first.focus)first.focus()};
    s.querySelector('#fcam').addEventListener('change',e=>pick(e.target));s.querySelector('#fgal').addEventListener('change',e=>pick(e.target));
    rm.onclick=()=>{newFoto=null;fotoGone=true;showFoto()};
    const read=()=>{const e=fm.elements;const o={datum:e.datum.value,zeit:e.zeit.value,km:Math.round(num(e.km.value)),liter:num(e.liter.value),betrag:num(e.betrag.value),
      ppl:num(e.ppl.value),waesche:num(e.waesche.value),sorte:e.sorte.value,station:e.station.value.trim(),adresse:e.adresse.value.trim(),voll:e.voll.checked,notiz:e.notiz.value.trim()};
      if(!(o.ppl>0)&&o.liter>0&&o.betrag>0)o.ppl=Math.round(o.betrag/o.liter*1000)/1000;return o};
    const live=()=>{const o=read();const so=fm.querySelector('#fsum');if(so)so.textContent=o.betrag>0||o.waesche>0?eur((o.betrag||0)+(o.waesche||0)):'–';const ph=fm.elements.ppl;if(!ph.value)ph.placeholder=o.liter>0&&o.betrag>0?nf(o.betrag/o.liter,3)+' (berechnet)':'wird berechnet';
      const w=checks(o,old&&old.id);warn.hidden=!w.length;warn.innerHTML=w.map(esc).join('<br>')};
    fm.addEventListener('input',live);fm.addEventListener('change',live);if(old)live();
    if(withPhoto&&!old)setTimeout(()=>s.querySelector('#fcam').click(),motion()?450:50);
    fm.onsubmit=async e=>{e.preventDefault();const o=read();
      const bad=[];if(!/^\d{4}-\d{2}-\d{2}$/.test(o.datum))bad.push('datum');if(!(o.km>0))bad.push('km');if(!(o.liter>0))bad.push('liter');if(!(o.betrag>0))bad.push('betrag');
      fm.querySelectorAll('.field.no').forEach(x=>x.classList.remove('no'));
      if(bad.length){bad.forEach(k=>fm.elements[k].closest('.field').classList.add('no'));buzz([20,40,20]);toast('Bitte Datum, Kilometerstand, Liter und Betrag ausfüllen.');return}
      const w=checks(o,old&&old.id);
      if(w.length&&!fm.dataset.ok){fm.dataset.ok='1';warn.hidden=false;warn.innerHTML=w.map(esc).join('<br>')+'<br><b>Nochmal „Speichern“ tippen, um trotzdem zu speichern.</b>';buzz([20,40,20]);warn.scrollIntoView({block:'nearest',behavior:'smooth'});return}
      const rec=Object.assign(old||{id:uid(),created:Date.now()},o,{updated:Date.now()});
      if(newFoto){const fid=uid();await fotoPut(fid,newFoto);if(rec.foto)fotoDel(rec.foto).catch(()=>{});rec.foto=fid}
      else if(fotoGone&&rec.foto){fotoDel(rec.foto).catch(()=>{});rec.foto=null}
      if(!rec.ppl||Number.isNaN(rec.ppl))delete rec.ppl;
      if(!(rec.waesche>0))delete rec.waesche;
      if(!rec.adresse)delete rec.adresse;
      rememberStation(rec.station,rec.adresse);
      const first=!db.fills.length;if(!old)db.fills.push(rec);
      await save();DS.savedTick(s.querySelector('#fsave'));
      setTimeout(()=>{closeSheet();render();if(first)celebrate('Erste Tankung!');else{const x=calc()[rec.id];toast(x&&x.verb!=null?`Gespeichert · ${nf(x.verb,1)} l/100 km`:'Gespeichert.')}},motion()?500:0)};
  });
}

/* ---------- App-Update: Zip-Paket aus der App ins GitHub-Repo laden ----------
   Ein Ablauf im Repo (.github/workflows/paket.yml) entpackt das Paket, prüft Version und Cache,
   übernimmt die Dateien und veröffentlicht. */
let UPD='',updBusy=false,swReg=null;
const defaultRepo=()=>{const h=location.hostname;return h.endsWith('.github.io')?h.split('.')[0]+'/'+h:'jazm-tankbox/jazm-tankbox.github.io'};
const updCfg=()=>{const u=keys().upd;if(!u)return null;const [owner,repo]=u.repo.split('/');return {owner,repo,token:u.token}};
function setUpd(html){UPD=html;const el=document.getElementById('updStatus');if(el){el.innerHTML=html;el.hidden=!html}}
const updErr=e=>e&&e.status===401?'Der Zugangsschlüssel ist ungültig oder abgelaufen.':e&&e.status===403?'Keine Berechtigung. Der Schlüssel braucht „Contents: Read and write“ und „Actions: Read“ für dieses Repo.'
  :e&&e.status===404?'Repo nicht gefunden oder kein Zugriff.':e&&e.status===422?'GitHub hat die Datei abgelehnt (zu groß?).':'Keine Verbindung zu GitHub. Prüfe die Internetverbindung.';
function bindUpd(s){
  const ch=s.querySelector('#up_chg');
  if(ch)ch.onclick=()=>dsForm('App-Update verbinden',[{k:'repo',l:'Repo (Besitzer/Name)',req:true,v:keys().upd?keys().upd.repo:defaultRepo()},{k:'token',l:'Zugangsschlüssel (github_pat_…)',t:'password',req:true}],async(v,fail)=>{
    const repo=v.repo.trim().replace(/^https:\/\/github\.com\//,'').replace(/\/$/,''),token=v.token.trim();
    if(!/^[\w.-]+\/[\w.-]+$/.test(repo))return fail('Bitte das Repo im Format „Besitzer/Name“ eintragen.');
    try{const [owner,name]=repo.split('/');const info=await ghFetch({owner,repo:name,token},'GET','');
      if(!info)throw Object.assign(new Error(),{status:404});
      if(info.permissions&&info.permissions.push===false)return fail('Der Schlüssel darf in dieses Repo nicht schreiben. Setze „Contents“ auf „Read and write“.');
      const wf=await ghFetch({owner,repo:name,token},'GET','/contents/.github/workflows/paket.yml').catch(()=>null);
      setKeys({upd:{repo,token}});
      setUpd(wf?'✅ Verbunden. Du kannst jetzt Update-Pakete hochladen.':'⚠️ Verbunden, aber im Repo fehlt <b>.github/workflows/paket.yml</b>. Ohne diesen Ablauf werden Pakete nicht entpackt.');
      buzz(10);toast('GitHub verbunden ✓');openMenu('upd')}
    catch(x){return fail(updErr(x))}},
    {ok:'Prüfen & verbinden',html:'<p class="ds-dlg-intro">Dafür brauchst du einen eigenen Fine-grained-Zugangsschlüssel nur für das App-Repo mit den Rechten <b>Contents: Read and write</b> und <b>Actions: Read</b>. Er bleibt nur auf diesem Handy. Der Schlüssel der Datensicherung reicht dafür nicht.</p>'});
  const off=s.querySelector('#up_off');if(off)off.onclick=()=>{if(!confirm('GitHub-Verbindung für Updates entfernen? Den Schlüssel kannst du danach auf GitHub löschen.'))return;
    setKeys({upd:null});setUpd('');openMenu('upd');toast('App-Update getrennt.')};
  const inp=s.querySelector('#up_in');
  if(inp)inp.addEventListener('change',()=>{const f=inp.files[0];inp.value='';if(!f)return;
    if(!/\.zip$/i.test(f.name)){setUpd('❌ Bitte eine .zip-Datei wählen.');return}
    if(f.size>50e6){setUpd('❌ Das Paket ist größer als 50 MB.');return}
    if(confirm(`„${f.name}“ (${fmtSize(f.size)}) ins Repo hochladen und veröffentlichen?`))updUpload(f)});
}
async function updUpload(file){
  const g=updCfg();if(!g||updBusy)return;updBusy=true;
  const name=file.name.replace(/[^\w.\-]/g,'_');
  setUpd('⏳ Lade '+esc(name)+' hoch …');
  try{
    const old=await ghFetch(g,'GET','/contents/'+encodeURIComponent(name));
    const res=await ghFetch(g,'PUT','/contents/'+encodeURIComponent(name),{message:'Paket '+name+' (aus der MyTankBox)',content:toB64(await file.arrayBuffer()),branch:'main',...(old&&old.sha?{sha:old.sha}:{})});
    setUpd('⚙️ Hochgeladen – GitHub entpackt und prüft das Paket …');buzz(8);
    await updWatch(g,res.commit.sha);
  }catch(e){setUpd('❌ '+esc(updErr(e)))}
  updBusy=false;
}
async function updWatch(g,sha){
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const t0=Date.now();let run=null;
  while(Date.now()-t0<5*60e3){
    await wait(5000);
    try{const j=await ghFetch(g,'GET','/actions/runs?head_sha='+sha+'&per_page=5');run=(j&&j.workflow_runs&&j.workflow_runs[0])||run}catch(e){}
    if(run&&run.status==='completed')break;
  }
  const link=run&&/^https:\/\/github\.com\//.test(run.html_url||'')?` <a href="${esc(run.html_url)}" target="_blank" rel="noopener noreferrer">Details</a>`:'';
  if(!run){setUpd('⚠️ Kein Ablauf gefunden. Liegt <b>.github/workflows/paket.yml</b> im Repo, und hat der Schlüssel „Actions: Read“?');return}
  if(run.status!=='completed'){setUpd('⏳ Der Ablauf dauert länger als üblich.'+link);return}
  if(run.conclusion!=='success'){
    let msg='';try{const jobs=await ghFetch(g,'GET','/actions/runs/'+run.id+'/jobs');const id=jobs&&jobs.jobs&&jobs.jobs[0]&&jobs.jobs[0].id;
      if(id){const ann=await ghFetch(g,'GET','/check-runs/'+id+'/annotations')||[];msg=((ann.find(a=>a.annotation_level==='failure')||ann[0])||{}).message||''}}catch(e){}
    setUpd('❌ Paket abgelehnt'+(msg?': '+esc(msg.replace(/^MyTankBox:?\s*/,'')):'.')+link);buzz([30,50,30]);return;
  }
  setUpd('✅ Paket übernommen – warte auf die Veröffentlichung …'+link);
  const t1=Date.now();
  while(Date.now()-t1<5*60e3){
    await wait(10000);
    try{if(swReg){await swReg.update();if(swReg.waiting||swReg.installing){
      setUpd('🎉 Die neue Version ist online.<div class="ds-acts"><button type="button" class="ds-btn pri" id="up_now">Jetzt neu laden</button></div>');
      const b=document.getElementById('up_now');if(b)b.onclick=()=>{const w=swReg.waiting||swReg.installing;saving.then(()=>w&&w.postMessage('SKIP_WAITING'))};
      celebrate('Update online');return}}}catch(e){}
  }
  setUpd('✅ Paket übernommen. GitHub braucht noch etwas – die App meldet sich mit „Neue Version verfügbar“, sobald sie online ist.'+link);
}

/* ---------- Blatt „Daten & Sicherung“ – gleicher Aufbau wie in den anderen Boxen ---------- */
let menuAcc=null;
const MI={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',down:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 19h14"/>',
  pump:'<path d="M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14"/><path d="M3 20h12M7 8h4"/><path d="M14 9h2l2 2v6a1.5 1.5 0 0 0 3 0V8l-3-3"/>',pkg:'<path d="M21 8l-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',list:'<path d="M4 6h16M4 12h16M4 18h10"/>',sheet:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>'};
const mIco=k=>`<span class="ai"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${MI[k]}</svg></span>`;
const mChev=()=>`<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
const mAcc=(k,ic,t,sub,body,force)=>`<details class="acc" data-acc="${k}"${menuAcc===k||force?' open':''}><summary>${mIco(ic)}<span class="at"><b>${t}</b><small>${sub}</small></span>${mChev()}</summary><div class="accb">${body}</div></details>`;
function openMenu(open){
  if(open)menuAcc=open;
  const g=ghCfg(),lb=db.meta.lastBackup,u=keys().upd;
  openSheet(head('Daten & Sicherung')+`
    <div class="secline"><svg viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>
      Alle Daten bleiben auf diesem Handy${g?' und in deinem privaten GitHub-Repo':''}. Sonst wird nichts gesendet.</div>`
  +mAcc('gh','down','Datensicherung',(g?'GitHub '+(ghStat.err?'⚠️ Problem':'an'):'GitHub aus')+' · '+(lb?'zuletzt '+fmtS(lb):'noch keine'),`
    <div class="ds-lbl">Automatisch in GitHub</div>
    ${g?`<p class="ds-hint">Nach jeder Änderung landen alle Tankungen und Quittungsfotos in <b>${esc(g.owner)}/${esc(g.repo)}${g.dir?'/'+esc(g.dir):''}</b>. Jede Sicherung ist ein Commit, ältere Stände bleiben in der Versionsgeschichte.</p>
    <div class="ds-stat" id="ghStatus">${ghStatusText()}</div>
    ${ghStat.conflict?`<div class="ds-box crit">Im Repo liegt ein anderer Datenstand (z. B. von einem früheren Handy). Er bleibt in der Versionsgeschichte von GitHub erhalten, wenn du ihn ersetzt.<div class="ds-acts"><button type="button" class="ds-btn pri" id="ghPull">GitHub-Stand laden</button><button type="button" class="ds-btn dng" id="ghForce">Durch diesen ersetzen</button></div></div>`:''}
    <div class="ds-acts"><button type="button" class="ds-btn pri" id="ghNow">Jetzt sichern</button><button type="button" class="ds-btn" id="ghOff">Trennen</button></div>`
    :`<p class="ds-hint">Sichert alle Tankungen und Quittungsfotos nach jeder Änderung in ein <b>privates</b> GitHub-Repo – auch wenn Browserdaten gelöscht werden oder das Handy wechselt, bleibt alles erhalten. Liegt dort schon eine Sicherung, holt die App sie zurück.</p>
    <div class="ds-acts"><button type="button" class="ds-btn pri" id="ghSetup">GitHub einrichten</button></div>`}
    <div class="ds-lbl sep">Sicherungsdatei</div>
    <p class="ds-hint">Zusätzlich oder statt GitHub: eine Datei mit allen Tankungen und Fotos, die du selbst ablegst. ${lb?'Letzte Sicherung: '+fmtS(lb)+'.':'Bisher keine Sicherung.'}</p>
    <div class="ds-acts"><button type="button" class="ds-btn${g?'':' pri'}" id="bkGo">Sicherung erstellen</button><label class="ds-btn">Sicherung laden<input id="bkIn" type="file" accept=".tankbox,application/json" hidden></label></div>
    ${persisted===false?'<p class="ds-hint" style="margin-top:10px">Der Browser hat dauerhaften Speicher nicht zugesagt. Installiere die App auf dem Startbildschirm und sichere regelmäßig.</p>':''}`,!!(g&&(ghStat.conflict||ghStat.err)))
  +mAcc('exp','sheet','Export','Tabelle für Excel oder die Abrechnung',`
    <p class="ds-hint">Alle Tankungen, Wäschen und Service-Einträge als CSV-Datei mit Kilometerstand, Litern, Beträgen und Verbrauch. Öffnet sich direkt in Excel.</p>
    <div class="ds-acts"><button type="button" class="ds-btn" id="csvGo">Als CSV exportieren</button></div>`)
  +mAcc('upd','pkg','App-Update','Version '+APP_VERSION+' · '+(u?'GitHub verbunden':'nicht verbunden'),`
    ${u?`<p class="ds-hint">Verbunden mit <b>${esc(u.repo)}</b>. Lade hier das Zip-Paket einer neuen Version hoch – GitHub prüft die Versionsnummer und veröffentlicht es in 1–2 Minuten.</p>
    <div class="ds-acts"><label class="ds-btn pri"${updBusy?' aria-disabled="true"':''}>${updBusy?'Update läuft …':'Update-Zip hochladen'}<input id="up_in" type="file" accept=".zip,application/zip" hidden></label><button type="button" class="ds-btn" id="up_chg">Verbindung ändern</button><button type="button" class="ds-btn" id="up_off">Trennen</button></div>`
    :`<p class="ds-hint">Neue Versionen als Zip direkt aus der App veröffentlichen. Dafür brauchst du einen eigenen Zugangsschlüssel nur für das App-Repo.</p>
    <div class="ds-acts"><button type="button" class="ds-btn pri" id="up_chg">GitHub verbinden</button></div>`}
    <div id="updStatus" class="ds-box"${UPD?'':' hidden'}>${UPD}</div>`,!!UPD)
  +mAcc('stat','pump','Tankstellen',db.stationen.length+' gemerkt · Abzeichen & Bilder',`<p class="ds-hint">Tippe eine Tankstelle an, um Name, Farbe oder ein eigenes Bild (z. B. Foto vom Schild) festzulegen.</p>${stationsHtml()}${brandsHtml()}${cardBrandsHtml()}`)
  +mAcc('look','sun','Darstellung',({auto:'Automatisch',light:'Hell',dark:'Dunkel'})[DS.getTheme()]+' · hell oder dunkel',`<div class="ds-lbl">Hell oder dunkel</div>${DS.themeHtml()}`)
  +mAcc('eintr','list','Einträge',db.fills.length+' Tankung'+(db.fills.length===1?'':'en')+(db.services.length?' · '+db.services.length+' Service':''),`
    <p class="ds-hint">Löscht alle Tankungen und Fotos auf diesem Handy. In GitHub bleibt alles liegen. Das lässt sich nicht rückgängig machen.</p>
    <div class="ds-acts"><button type="button" class="ds-btn dng" id="del">Alle Einträge löschen</button></div>`)
  +`<div class="ds-lbl">Meine Boxen</div>${DS.boxesHtml()}<p class="ds-ver">MyTankBox · Version ${APP_VERSION}${IS_TEST?' · Test-App, eigener Speicher':''}</p>`,
  s=>{s.querySelectorAll('details.acc[data-acc]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open){menuAcc=d.dataset.acc;
       s.querySelectorAll('details.acc[open]').forEach(o=>{if(o!==d)o.open=false});buzz(4)}else if(menuAcc===d.dataset.acc)menuAcc=null}));
    const ghS=s.querySelector('#ghSetup');
    if(ghS)ghS.onclick=()=>dsForm('GitHub-Sicherung einrichten',[{k:'owner',l:'Konto / Organisation',req:true,v:'jazm-tankbox'},{k:'repo',l:'Privates Repo',req:true,v:'tankbox-daten'},{k:'dir',l:'Ordner im Repo (optional, z. B. tankbox)',v:''},{k:'token',l:'Zugangsschlüssel (github_pat_…)',t:'password',req:true}],async(v,fail)=>{
      const g={owner:v.owner.trim(),repo:v.repo.trim(),token:v.token.trim()};const dd=bkDir(v.dir);if(dd)g.dir=dd;
      if(!g.owner||!g.repo||!g.token)return fail('Bitte Konto, Repo und Zugangsschlüssel ausfüllen.');
      let remote=null;
      try{const info=await ghFetch(g,'GET','');
        if(!info)throw Object.assign(new Error(),{status:404});
        if(!info.private)return fail('Dieses Repo ist öffentlich. Aus Sicherheitsgründen sichert die MyTankBox nur in private Repos.');
        if(info.permissions&&info.permissions.push===false)return fail('Der Schlüssel darf in dieses Repo nicht schreiben. Setze „Contents“ auf „Read and write“.');
        const r=await ghRemote(g);try{remote=JSON.parse(r.json)}catch(e){}
      }catch(x){return fail(ghErrText(x))}
      setKeys({gh:g});setGhStat({err:'',at:0,conflict:false});
      // Neues Handy: Sicherung liegt schon im Repo, hier ist noch nichts → zurückholen
      if(remote&&remote.app==='tankbox'&&Array.isArray(remote.fills)&&remote.did!==db.did&&!db.fills.length){
        try{await ghRestore(g);setGhStat({at:Date.now(),err:''});closeSheet(false);render();celebrate('GitHub verbunden');toast(db.fills.length+' Tankungen aus GitHub geladen.')}
        catch(x){toast(x&&x.message||'Laden aus GitHub hat nicht geklappt.')}return}
      openMenu('gh');ghSync().then(()=>{if(!ghStat.err){celebrate('GitHub verbunden');toast('Automatische Sicherung ist aktiv ✓')}else openMenu('gh')})},
      {ok:'Verbinden & sichern',html:'<p class="ds-dlg-intro">Sichert alle Tankungen und Fotos nach jeder Änderung in ein <b>privates</b> GitHub-Repo. Zugangsschlüssel: nur für dieses Repo, mit <b>Contents: Read and write</b>. Er bleibt nur auf diesem Handy und kommt in keine Sicherung. Tipp: Für alle Boxen genügt ein Repo – trag je Box einen eigenen Ordner ein (z. B. tankbox) und nutze denselben Zugangsschlüssel.</p>'});
    const ghN=s.querySelector('#ghNow');if(ghN)ghN.onclick=async()=>{await ghSync();if(!ghStat.err){buzz(10);toast('Auf GitHub gesichert ✓')}};
    const ghP=s.querySelector('#ghPull');if(ghP)ghP.onclick=async()=>{
      if(!confirm('Die Tankungen auf diesem Handy durch den GitHub-Stand ersetzen?'))return;
      ghP.disabled=true;ghP.textContent='Lade von GitHub …';
      try{await saving;await ghRestore(ghCfg(),(n,t)=>{ghP.textContent=`Lade Fotos ${n}/${t} …`});setGhStat({err:'',conflict:false,at:Date.now()});closeSheet(false);render();toast(db.fills.length+' Tankungen aus GitHub geladen.')}
      catch(x){ghP.disabled=false;ghP.textContent='GitHub-Stand laden';toast(x&&x.status?ghErrText(x):(x&&x.message||'Das hat nicht geklappt.'))}};
    const ghF=s.querySelector('#ghForce');if(ghF)ghF.onclick=async()=>{if(!confirm('Den Stand im Repo durch diesen ersetzen? Der alte bleibt in der GitHub-Versionsgeschichte.'))return;await ghSync(true);openMenu('gh');if(!ghStat.err)celebrate('Gesichert')};
    const ghX=s.querySelector('#ghOff');if(ghX)ghX.onclick=()=>{if(!confirm('GitHub-Sicherung trennen? Im Repo bleibt alles liegen.'))return;
      setKeys({gh:null});setGhStat({err:'',at:0,conflict:false});openMenu('gh');toast('GitHub-Sicherung getrennt.')};
    bindUpd(s);
    bindBrands(s,()=>openMenu('stat'));
    const shIn=s.querySelector('#shIn');if(shIn)shIn.addEventListener('change',async()=>{const f=shIn.files[0];shIn.value='';if(!f)return;
      toast('Shell-Liste wird eingelesen …');try{const o=await importShellCsv(f);openMenu('stat');celebrate('Importiert');toast(nf(o.n,0)+' Tankstellen aus der Shell-Liste übernommen.')}catch(x){toast(x&&x.message||'Import hat nicht geklappt.')}});
    s.querySelectorAll('[data-cb]').forEach(c=>c.onchange=async()=>{db.meta.cardBrands=[...s.querySelectorAll('[data-cb]:checked')].map(x=>x.dataset.cb);await save();buzz(4)});
    s.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>openStation(db.stationen[+b.dataset.st],()=>openMenu('stat')));
    s.querySelector('#bkGo').onclick=async()=>{await exportBackup();if(root.firstElementChild)openMenu('gh')};
    const bi=s.querySelector('#bkIn');
    bi.addEventListener('change',async()=>{const file=bi.files[0];bi.value='';if(!file)return;
      let o;try{o=await readBackupFile(file)}catch(x){toast(x.message);return}
      if(confirm(`Die Tankungen auf diesem Handy werden durch die Sicherung ersetzt (${o.fills.length} Tankungen). Fortfahren?`))saving.then(()=>restoreBackup(o))});
    s.querySelector('#csvGo').onclick=async()=>{if(!allEntries().length){toast('Noch keine Einträge.');return}if(await exportCsv())toast('CSV exportiert.')};
    s.querySelector('#del').onclick=async()=>{if(!allEntries().length){toast('Es gibt nichts zu löschen.');return}
      if(!confirm('Wirklich alle '+allEntries().length+' Einträge und Fotos auf diesem Handy löschen?'))return;
      db.fills=[];db.services=[];db.did=uid();await fotoClear().catch(()=>{});await save();closeSheet(false);render();toast('Alle Einträge gelöscht.')};
  });
}

/* ================= Gesten & Bewegung – wie in der MyBelegBox ================= */
/* Zahlen hochzählen lassen */
let shown={};
const FMT={eur,eur0,l1:n=>nf(n,1),n0:n=>nf(n,0)};
function countUps(fromZero){
  main.querySelectorAll('[data-count]').forEach(el=>{
    const k=el.dataset.count,to=Number(el.dataset.v)||0,f=FMT[el.dataset.f]||(n=>String(Math.round(n)));
    const from=fromZero?(k==='km'?Math.max(0,to-800):0):(k in shown?shown[k]:to);shown[k]=to;
    if(!motion()||from===to){el.textContent=f(to);return}
    const t0=performance.now(),D=fromZero?900:650;el.textContent=f(from);
    const step=now=>{if(!el.isConnected)return;const p=Math.min(1,(now-t0)/D),e=1-Math.pow(1-p,3);
      el.textContent=f(p<1?from+(to-from)*e:to);if(p<1)requestAnimationFrame(step)};
    requestAnimationFrame(step)})
}
/* Tabs: Antippen oder Wischen */
const ind=document.querySelector('nav.tabs .ind');
function setInd(x,drag){if(!ind)return;ind.classList.toggle('drag',!!drag);ind.style.setProperty('--ti',String(x))}
let tabBusy=false;
function goTab(t,fromX){
  if(!db||tabBusy)return;
  const a=TABS.indexOf(tab),b=TABS.indexOf(t);
  if(a===b){window.scrollTo({top:0,behavior:motion()?'smooth':'auto'});return}
  const dir=b>a?1:-1;tab=t;setInd(b);buzz(6);
  if(fanOpen)setFan(false);
  if(!motion()){render();window.scrollTo(0,0);return}
  tabBusy=true;setTimeout(()=>{tabBusy=false},700);
  const W=main.clientWidth||innerWidth,x0=fromX||0,op=main.style.opacity||'1';
  main.style.transform='';main.style.opacity='';
  const out=main.animate([{transform:`translateX(${x0}px)`,opacity:op},{transform:`translateX(${-dir*W*.45}px)`,opacity:0}],
    {duration:fromX?150:120,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
  out.onfinish=()=>{window.scrollTo(0,0);render();out.cancel();
    main.animate([{transform:`translateX(${dir*W*.3}px)`,opacity:0},{transform:'none',opacity:1}],{duration:340,easing:'cubic-bezier(.2,.85,.25,1)'})
      .onfinish=()=>{tabBusy=false}};
}
document.querySelectorAll('nav.tabs [data-tab]').forEach(b=>b.onclick=()=>goTab(b.dataset.tab));

/* „Tanken“-Knopf als Fächer: mit Quittungsfoto oder ohne */
const fab=document.getElementById('fab'),fan=document.getElementById('fan');
let fanOpen=false;
function setFan(open){
  if(open===fanOpen)return;fanOpen=open;
  fab.classList.toggle('open',open);fab.setAttribute('aria-expanded',String(open));fab.setAttribute('aria-label',open?'Schließen':'Neue Tankung');
  if(open){fan.hidden=false;void fan.offsetWidth;fan.classList.add('show');buzz(6)}
  else{fan.classList.remove('show');setTimeout(()=>{if(!fanOpen)fan.hidden=true},motion()?260:0)}
}
fab.onclick=()=>setFan(!fanOpen);
fan.addEventListener('click',e=>{const b=e.target.closest('[data-neu]');setFan(false);if(!b)return;if(b.dataset.neu==='service')openSvcForm();else openForm(null,b.dataset.neu==='foto')});
let lastY=0;addEventListener('scroll',()=>{const y=window.scrollY;if(Math.abs(y-lastY)<8)return;
  fab.classList.toggle('shrunk',y>lastY&&y>120);lastY=y},{passive:true});

/* Wischen zwischen Tabs & Zum Aktualisieren ziehen */
const appEl=document.querySelector('.app'),ptr=document.getElementById('ptr');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let G=null,refreshing=false;
document.addEventListener('touchstart',e=>{G=null;
  if(e.touches.length!==1||!db||tabBusy||fanOpen||root.firstElementChild)return;
  const t=e.target;if(t.closest&&t.closest('nav.tabs,.fab,#fan,#updRoot,#toastRoot,dialog,input,select,textarea'))return;
  const p=e.touches[0];
  G={x:p.clientX,y:p.clientY,mode:null,dx:0,dy:0,v:0,lx:p.clientX,lt:performance.now(),W:appEl.clientWidth||innerWidth,idx:TABS.indexOf(tab),hit:false,edge:false};
},{passive:true});
document.addEventListener('touchmove',e=>{
  if(!G)return;const p=e.touches[0],dx=p.clientX-G.x,dy=p.clientY-G.y;
  if(!G.mode){
    if(Math.abs(dx)<10&&Math.abs(dy)<10)return;
    if(Math.abs(dx)>Math.abs(dy)*1.3)G.mode='h';
    else if(dy>0&&window.scrollY<=0&&!refreshing&&Math.abs(dy)>Math.abs(dx))G.mode='v';
    else{G=null;return}
  }
  if(e.cancelable)e.preventDefault();
  const now=performance.now(),dt=Math.max(1,now-G.lt);
  if(G.mode==='h'){
    G.v=.7*((p.clientX-G.lx)/dt)+.3*G.v;G.lx=p.clientX;G.lt=now;
    G.edge=(G.idx===0&&dx>0)||(G.idx===TABS.length-1&&dx<0);
    const x=G.edge?dx*.2:dx;G.dx=x;
    main.style.transform=`translateX(${x}px)`;main.style.opacity=String(1-Math.min(.35,Math.abs(x)/G.W*.5));
    setInd(G.edge?G.idx:G.idx-x/G.W,true);
    const over=!G.edge&&Math.abs(x)>G.W*.28;if(over!==G.hit){G.hit=over;if(over)buzz(5)}
  }else{
    const pull=Math.min(120,dy*.5);G.dy=pull;
    appEl.style.transform=`translateY(${pull}px)`;
    ptr.style.opacity=String(Math.min(1,pull/28));ptr.style.transform=`translateY(${pull-52}px) rotate(${Math.min(1,pull/72)*300}deg)`;
    const over=pull>=72;if(over!==G.hit){G.hit=over;ptr.classList.toggle('armed',over);if(over)buzz(8)}
  }
},{passive:false});
function gEnd(e){
  if(!G||!G.mode){G=null;return}const g=G;G=null;const ok=e.type==='touchend';
  if(g.mode==='h'){
    const go=ok&&!g.edge&&(Math.abs(g.dx)>g.W*.28||(Math.abs(g.v)>.45&&Math.sign(g.v)===Math.sign(g.dx)&&Math.abs(g.dx)>30));
    if(go){goTab(TABS[g.idx-Math.sign(g.dx)],g.dx);return}
    const from=main.style.transform,op=main.style.opacity;main.style.transform='';main.style.opacity='';setInd(g.idx);
    if(motion()&&from)main.animate([{transform:from,opacity:op||'1'},{transform:'none',opacity:1}],{duration:360,easing:'cubic-bezier(.2,.9,.3,1.15)'});
  }else{
    const from=appEl.style.transform;appEl.style.transform='';
    if(motion()&&from)appEl.animate([{transform:from},{transform:'none'}],{duration:400,easing:'cubic-bezier(.2,.9,.3,1.1)'});
    if(ok&&g.hit)refresh();else hidePtr();
  }
}
document.addEventListener('touchend',gEnd);document.addEventListener('touchcancel',gEnd);
function hidePtr(){
  const from=ptr.style.transform;ptr.style.transform='';ptr.style.opacity='';ptr.classList.remove('armed','spin');
  if(motion()&&from)ptr.animate([{transform:from,opacity:1},{transform:'translateY(-70px) scale(.5)',opacity:0}],{duration:260,easing:'ease-in'});
}
async function refresh(){
  refreshing=true;ptr.classList.add('armed','spin');ptr.style.transform='translateY(16px)';ptr.style.opacity='1';buzz(10);
  const t=Date.now();let upd=false;
  try{if(swReg){await swReg.update();upd=!!(swReg.waiting||swReg.installing)}}catch(x){}
  if(ghCfg()&&(db.meta.dirty||ghStat.err))ghSync();
  await new Promise(r=>setTimeout(r,Math.max(0,750-(Date.now()-t))));
  refreshing=false;hidePtr();if(!db)return;
  shown={};render();
  /* Neue Version: gleiche Rückfrage wie in den anderen Boxen */
  if(upd){if(confirm('Eine neue Version der MyTankBox ist da. Jetzt neu laden?')){const w=swReg.waiting||swReg.installing;
      const go=()=>saving.then(()=>w.postMessage('SKIP_WAITING'));if(w){if(w.state==='installed')go();else w.addEventListener('statechange',()=>{if(w.state==='installed')go()})}}}
  else toast('Alles aktuell. Werte sind neu berechnet.');
}

/* Kippen & Glanz über den Lagesensor */
let tgt=[0,0],cur=[0,0],base=null,traf=0,tiltOn=false;
addEventListener('deviceorientation',e=>{
  if(!db||!motion()||e.beta==null||e.gamma==null||document.hidden)return;
  const g=e.gamma,b=e.beta;
  if(!base)base=[g,b];
  base[0]+=(g-base[0])*.02;base[1]+=(b-base[1])*.02; // passt sich langsam an die Haltung an
  tgt=[clamp((g-base[0])/14,-1,1),clamp((b-base[1])/14,-1,1)];
  if(!tiltOn){tiltOn=true;document.documentElement.classList.add('tilt')}
  if(!traf)traf=requestAnimationFrame(tstep);
});
function tstep(){traf=0;
  cur[0]+=(tgt[0]-cur[0])*.16;cur[1]+=(tgt[1]-cur[1])*.16;
  const st=document.documentElement.style;
  st.setProperty('--tx',cur[0].toFixed(3));st.setProperty('--ty',cur[1].toFixed(3));st.setProperty('--gm',Math.min(1,Math.hypot(cur[0],cur[1])*1.5).toFixed(3));
  if(Math.abs(tgt[0]-cur[0])+Math.abs(tgt[1]-cur[1])>.004)traf=requestAnimationFrame(tstep);
}

/* ---------- Start ---------- */
document.getElementById('menuBtn').onclick=()=>openMenu();
document.getElementById('nearBtn').onclick=()=>{setFan(false);openNear()};
document.getElementById('menuBtn').addEventListener('click',()=>setFan(false));
if(IS_TEST){document.title='MyTankBox TEST';const h=document.querySelector('.brand h1');if(h)h.insertAdjacentHTML('beforeend',' <span class="testtag">TEST</span>')}
(async()=>{
  await load();await loadKeys();render();loadStImgs().then(a=>{if(a)render()});askPersist();
  if(new URLSearchParams(location.search).get('aktion')==='neu'){history.replaceState(null,'',location.pathname);openForm(null,true)}
  if(ghCfg()&&(db.meta.dirty||0)>0)ghQueue(1500);
})();

/* Service Worker: offline nutzbar, Hinweis bei neuer Version */
if('serviceWorker' in navigator){
  let reloading=false;const hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading||!hadController)return;reloading=true;location.reload()});
  navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>{swReg=reg;
    const offer=w=>{const r=document.getElementById('updRoot');
      r.innerHTML='<div class="ds-updbar" role="status"><span>Neue Version der MyTankBox ist da.</span><button type="button" class="ds-btn pri" id="updGo">Aktualisieren</button><button type="button" class="ds-x" id="updX" aria-label="Später">✕</button></div>';
      document.getElementById('updGo').onclick=()=>saving.then(()=>w.postMessage('SKIP_WAITING'));
      document.getElementById('updX').onclick=()=>{r.innerHTML=''}};
    if(reg.waiting&&navigator.serviceWorker.controller)offer(reg.waiting);
    reg.addEventListener('updatefound',()=>{const w=reg.installing;if(!w)return;
      w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)offer(w)})});
    setInterval(()=>reg.update().catch(()=>{}),60*60e3);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)reg.update().catch(()=>{})});
  }).catch(()=>{});
}
})();
