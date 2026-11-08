(function(){
'use strict';
const APP_VERSION='0.2.0.1';
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
const empty=()=>({v:1,did:uid(),fills:[],meta:{}});
const dbOk=o=>!!(o&&Array.isArray(o.fills));
async function load(){
  let a=null,b=null;
  try{a=JSON.parse(localStorage.getItem(KEY))}catch(e){}
  try{const m=await kvGet('daten');b=m?JSON.parse(m):null}catch(e){}
  const ta=dbOk(a)?a.saved||0:-1,tb=dbOk(b)?b.saved||0:-1;
  db=ta<0&&tb<0?empty():tb>ta?b:a;
  if(!db.did)db.did=uid();db.meta=db.meta||{};
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
  const kmAll=s.length>1?s[s.length-1].km-s[0].km:0;
  const costAll=s.length>1?s.slice(1).reduce((t,f)=>t+(+f.betrag||0),0):0;
  return {c,avg:dist>0?lit/dist*100:null,year:sum(yearF),yearN:yearF.length,month:sum(monF),monthN:monF.length,
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
const payload=()=>JSON.stringify({app:'tankbox',format:1,version:APP_VERSION,did:db.did,fills:byDate()},null,1);
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
    const ids=db.fills.map(f=>f.foto).filter(Boolean);
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
  const need=o.fills.map(f=>f.foto).filter(Boolean);let n=0;
  for(const id of need){onStep&&onStep(++n,need.length);if(await fotoGet(id).catch(()=>null))continue;
    const b=await ghFetch(g,'GET','/contents/fotos/'+encodeURIComponent(id)+'.jpg',null,true).catch(()=>null);
    if(b)await fotoPut(id,new Blob([b],{type:'image/jpeg'}))}
  db={v:1,did:o.did||uid(),fills:o.fills,meta:Object.assign({},db.meta,{dirty:0,lastBackup:iso(new Date())})};
  await save(false);
}

/* ---------- Sicherungsdatei (zusätzlich oder statt GitHub) ---------- */
async function exportBackup(){
  const fotos={};for(const f of db.fills){if(!f.foto)continue;const b=await fotoGet(f.foto).catch(()=>null);if(b)fotos[f.foto]=toB64(await b.arrayBuffer())}
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
  db={v:1,did:o.did||uid(),fills:o.fills,meta:Object.assign({},db.meta,{dirty:0,lastBackup:iso(new Date())})};
  await save(false);closeSheet(false);render();celebrate('Wiederhergestellt');toast(o.fills.length+' Tankungen geladen.')}
async function deliverFile(name,text,type){
  const blob=new Blob([text],{type});
  try{const file=new File([blob],name,{type});if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return true}}
  catch(e){if(e&&e.name==='AbortError')return false}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);return true}
function exportCsv(){
  const c=calc(),q=v=>'"'+String(v??'').replace(/"/g,'""')+'"',n=(v,d)=>v==null||v===''||isNaN(v)?'':Number(v).toFixed(d).replace('.',',');
  const rows=[['Datum','Uhrzeit','Kilometerstand','Liter','Preis pro Liter','Betrag','Kraftstoff','Tankstelle','Volltank','Gefahrene km','Verbrauch l/100km','Notiz'].map(q).join(';')];
  byKm().forEach(f=>{const x=c[f.id]||{};rows.push([q(fmtS(f.datum)),q(f.zeit||''),n(f.km,0),n(f.liter,2),n(f.ppl,3),n(f.betrag,2),q(f.sorte||''),q(f.station||''),q(f.voll===false?'nein':'ja'),n(x.dist,0),n(x.verb,2),q(f.notiz||'')].join(';'))});
  return deliverFile('tankungen-'+iso(new Date())+'.csv','﻿'+rows.join('\r\n'),'text/csv')}

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
  sh.addEventListener('touchstart',e=>{if(e.touches.length!==1){mode='x';return}const t=e.touches[0];y0=ly=t.clientY;x0=t.clientX;lt=performance.now();dy=0;v=0;mode=null;hit=false},{passive:true});
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
    <span class="main"><span class="t">${nf(f.liter,2)} l${f.sorte?' · '+esc(f.sorte):''}</span><span class="s">${km(f.km)}${f.station?' · '+esc(f.station):''}${f.voll===false?' · teilweise':''}</span>
    ${x.verb!=null?`<span class="s">${nf(x.verb,1)} l/100 km auf ${km(x.seit)}</span>`:''}</span>
    <span class="ramt"><span class="amt num">${eur(f.betrag)}</span>${f.ppl?`<small class="muted num">${nf(f.ppl,3)} €/l</small>`:''}${f.foto?`<small class="muted" aria-label="mit Foto">${svg('cam','mini-ic')}</small>`:''}</span></button>`}
let first=true;
function render(){
  if(!db)return;bkDot();
  document.querySelectorAll('nav.tabs [data-tab]').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===tab?'page':'false'));
  setInd(TABS.indexOf(tab));
  const s=stats();
  if(tab==='home')main.innerHTML=viewHome(s);else if(tab==='liste')main.innerHTML=viewList(s);else main.innerHTML=viewStats(s);
  main.querySelectorAll('[data-fill]').forEach(b=>b.onclick=()=>openDetail(b.dataset.fill));
  const rm=main.querySelector('[data-bk]');if(rm)rm.onclick=()=>openMenu('gh');
  const nb=main.querySelector('[data-new]');if(nb)nb.onclick=()=>openForm(null,nb.dataset.new==='foto');
  const all=main.querySelector('[data-all]');if(all)all.onclick=()=>goTab('liste');
  countUps(first);first=false;
}
function viewHome(s){
  const recent=byDate().slice(0,4);
  if(!db.fills.length)return `<section class="view">
    <div class="summary"><div><div class="label">Willkommen</div><p style="margin:6px 0 0">Erfasse jede Tankung des Dienstwagens mit Quittungsfoto. Die MyTankBox rechnet Verbrauch und Kosten aus.</p></div>
    <div class="actions"><button type="button" class="btn primary" data-new="foto">Erste Tankung erfassen</button></div></div>
    ${ghCfg()?'':`<p class="hint">Neues Handy? Unter <b>Daten</b> → Datensicherung → „GitHub einrichten“ holst du deine Tankungen aus GitHub zurück.</p>`}</section>`;
  return `<section class="view">${DS.remindHtml(bkInfo(),'data-bk')}
    <div class="summary">
      <div><div class="label">Durchschnittsverbrauch</div><div class="bigcost"><span class="num"${s.avg!=null?` data-count="avg" data-v="${s.avg}" data-f="l1"`:''}>${s.avg!=null?nf(s.avg,1):'–'}</span><small>l/100 km${s.avg==null?' · ab zwei vollen Tankungen':''}</small></div></div>
      <div class="facts">
        <div class="fact"><b class="num" data-count="year" data-v="${s.year}" data-f="eur0">${eur0(s.year)}</b><span>Kosten ${new Date().getFullYear()}<br><small>${s.yearN} Tankung${s.yearN===1?'':'en'}</small></span></div>
        <div class="fact"><b class="num"${s.per100!=null?` data-count="p100" data-v="${s.per100}" data-f="eur"`:''}>${s.per100!=null?eur(s.per100):'–'}</b><span>pro 100 km</span></div>
        <div class="fact"><b class="num"${s.kmNow!=null?` data-count="km" data-v="${s.kmNow}" data-f="n0"`:''}>${s.kmNow!=null?nf(s.kmNow,0):'–'}</b><span>km-Stand</span></div>
      </div></div>
    <div><div class="sechead"><h2>Letzte Tankungen</h2><button type="button" class="ghost" data-all>Alle ${db.fills.length}</button></div>
      <div class="list" style="margin-top:10px">${recent.map((f,i)=>fillRow(f,s.c,i)).join('')}</div></div>
  </section>`}
function viewList(s){
  if(!db.fills.length)return `<section class="view"><div class="list"><div class="empty">Noch keine Tankungen.</div></div></section>`;
  const groups={};byDate().forEach(f=>{(groups[f.datum.slice(0,7)]=groups[f.datum.slice(0,7)]||[]).push(f)});
  return `<section class="view">${Object.entries(groups).map(([ym,fs])=>{const [y,m]=ym.split('-').map(Number);
    return `<div><div class="sechead"><h2>${MON[m-1]} ${y}</h2><span class="count num">${eur(fs.reduce((a,f)=>a+(+f.betrag||0),0))} · ${nf(fs.reduce((a,f)=>a+(+f.liter||0),0),1)} l</span></div>
      <div class="list" style="margin-top:10px">${fs.map((f,i)=>fillRow(f,s.c,i)).join('')}</div></div>`}).join('')}</section>`}
function viewStats(s){
  if(db.fills.length<2)return `<section class="view"><div class="list"><div class="empty">Auswertungen gibt es ab zwei Tankungen.</div></div></section>`;
  // Kosten der letzten 12 Monate
  const now=new Date(),months=[];for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push(iso(d).slice(0,7))}
  const mc=months.map(ym=>({ym,v:db.fills.filter(f=>f.datum.startsWith(ym)).reduce((a,f)=>a+(+f.betrag||0),0)}));
  const mx=Math.max(1,...mc.map(x=>x.v));
  const fulls=byKm().filter(f=>s.c[f.id]&&s.c[f.id].verb!=null).slice(-10).reverse();
  const vmx=Math.max(1,...fulls.map(f=>s.c[f.id].verb));
  const pp=byDate().filter(f=>f.ppl).slice(0,10);
  return `<section class="view">
    <div class="summary"><div class="label">Kosten der letzten 12 Monate</div>
      <div class="bars">${mc.map(x=>{const [y,m]=x.ym.split('-').map(Number);return `<div class="bar"><span class="bl">${MON[m-1].slice(0,3)} ${String(y).slice(2)}</span><span class="track"><span class="fill" style="width:${(x.v/mx*100).toFixed(1)}%"></span></span><span class="num">${x.v?eur(x.v):'–'}</span></div>`}).join('')}</div>
      <p class="hint">Summe: ${eur(mc.reduce((a,x)=>a+x.v,0))}${s.kmYear?' · '+km(s.kmYear)+' gefahren in '+now.getFullYear():''}</p></div>
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
      <dt>Betrag</dt><dd class="num">${eur(f.betrag)}</dd>
      <dt>Preis pro Liter</dt><dd class="num">${f.ppl?nf(f.ppl,3)+' €':'–'}</dd>
      <dt>Kraftstoff</dt><dd>${esc(f.sorte||'–')}</dd>
      <dt>Tankstelle</dt><dd>${esc(f.station||'–')}</dd>
      ${f.notiz?`<dt>Notiz</dt><dd>${esc(f.notiz)}</dd>`:''}
    </dl>
    <div class="actions two"><button type="button" class="btn primary" id="dEdit">Bearbeiten</button><button type="button" class="btn danger" id="dDel">Löschen</button></div>`,
  s=>{s.querySelector('#dEdit').onclick=()=>openForm(f.id);
    s.querySelector('#dDel').onclick=async()=>{if(!confirm('Diese Tankung löschen? Das Foto wird auf diesem Handy ebenfalls entfernt.'))return;
      db.fills=db.fills.filter(y=>y.id!==f.id);if(f.foto)fotoDel(f.foto).catch(()=>{});await save();closeSheet();render();toast('Tankung gelöscht.')};
    const img=s.querySelector('.photo');if(img)img.onclick=()=>window.open(url,'_blank')});
}

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
        <p class="hint">Automatisches Auslesen kommt mit dem nächsten Update. Bis dahin die Werte von der Quittung abtippen.</p></div>
      <div class="grid2"><label class="field"><span>Datum</span><input name="datum" type="date" required value="${esc(f.datum)}"></label>
        <label class="field"><span>Uhrzeit</span><input name="zeit" type="time" value="${esc(f.zeit||'')}"></label></div>
      <label class="field"><span>Kilometerstand</span><input name="km" inputmode="numeric" required placeholder="${last?'zuletzt '+nf(last.km,0):'z. B. 48 250'}" value="${f.km!=null?f.km:''}"></label>
      <div class="grid2"><label class="field"><span>Liter</span><input name="liter" inputmode="decimal" required placeholder="45,12" value="${v('liter',2)}"></label>
        <label class="field"><span>Betrag (€)</span><input name="betrag" inputmode="decimal" required placeholder="78,40" value="${v('betrag',2)}"></label></div>
      <div class="grid2"><label class="field"><span>Preis pro Liter (€)</span><input name="ppl" inputmode="decimal" placeholder="wird berechnet" value="${v('ppl',3)}"></label>
        <label class="field"><span>Kraftstoff</span><select name="sorte">${SORTEN.map(x=>`<option${x===f.sorte?' selected':''}>${x}</option>`).join('')}</select></label></div>
      <label class="field"><span>Tankstelle / Ort</span><input name="station" maxlength="80" value="${esc(f.station||'')}" placeholder="z. B. Aral Kamen" list="stlist"></label>
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
      const k=fm.elements.km;if(!k.value)k.focus()};
    s.querySelector('#fcam').addEventListener('change',e=>pick(e.target));s.querySelector('#fgal').addEventListener('change',e=>pick(e.target));
    rm.onclick=()=>{newFoto=null;fotoGone=true;showFoto()};
    const read=()=>{const e=fm.elements;const o={datum:e.datum.value,zeit:e.zeit.value,km:Math.round(num(e.km.value)),liter:num(e.liter.value),betrag:num(e.betrag.value),
      ppl:num(e.ppl.value),sorte:e.sorte.value,station:e.station.value.trim(),voll:e.voll.checked,notiz:e.notiz.value.trim()};
      if(!(o.ppl>0)&&o.liter>0&&o.betrag>0)o.ppl=Math.round(o.betrag/o.liter*1000)/1000;return o};
    const live=()=>{const o=read();const ph=fm.elements.ppl;if(!ph.value)ph.placeholder=o.liter>0&&o.betrag>0?nf(o.betrag/o.liter,3)+' (berechnet)':'wird berechnet';
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
  pkg:'<path d="M21 8l-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',list:'<path d="M4 6h16M4 12h16M4 18h10"/>',sheet:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>'};
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
    <p class="ds-hint">Alle Tankungen als CSV-Datei mit Kilometerstand, Litern, Beträgen und Verbrauch. Öffnet sich direkt in Excel.</p>
    <div class="ds-acts"><button type="button" class="ds-btn" id="csvGo">Als CSV exportieren</button></div>`)
  +mAcc('upd','pkg','App-Update','Version '+APP_VERSION+' · '+(u?'GitHub verbunden':'nicht verbunden'),`
    ${u?`<p class="ds-hint">Verbunden mit <b>${esc(u.repo)}</b>. Lade hier das Zip-Paket einer neuen Version hoch – GitHub prüft die Versionsnummer und veröffentlicht es in 1–2 Minuten.</p>
    <div class="ds-acts"><label class="ds-btn pri"${updBusy?' aria-disabled="true"':''}>${updBusy?'Update läuft …':'Update-Zip hochladen'}<input id="up_in" type="file" accept=".zip,application/zip" hidden></label><button type="button" class="ds-btn" id="up_chg">Verbindung ändern</button><button type="button" class="ds-btn" id="up_off">Trennen</button></div>`
    :`<p class="ds-hint">Neue Versionen als Zip direkt aus der App veröffentlichen. Dafür brauchst du einen eigenen Zugangsschlüssel nur für das App-Repo.</p>
    <div class="ds-acts"><button type="button" class="ds-btn pri" id="up_chg">GitHub verbinden</button></div>`}
    <div id="updStatus" class="ds-box"${UPD?'':' hidden'}>${UPD}</div>`,!!UPD)
  +mAcc('look','sun','Darstellung',({auto:'Automatisch',light:'Hell',dark:'Dunkel'})[DS.getTheme()]+' · hell oder dunkel',`<div class="ds-lbl">Hell oder dunkel</div>${DS.themeHtml()}`)
  +mAcc('eintr','list','Einträge',db.fills.length+' Tankung'+(db.fills.length===1?'':'en'),`
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
    s.querySelector('#bkGo').onclick=async()=>{await exportBackup();if(root.firstElementChild)openMenu('gh')};
    const bi=s.querySelector('#bkIn');
    bi.addEventListener('change',async()=>{const file=bi.files[0];bi.value='';if(!file)return;
      let o;try{o=await readBackupFile(file)}catch(x){toast(x.message);return}
      if(confirm(`Die Tankungen auf diesem Handy werden durch die Sicherung ersetzt (${o.fills.length} Tankungen). Fortfahren?`))saving.then(()=>restoreBackup(o))});
    s.querySelector('#csvGo').onclick=async()=>{if(!db.fills.length){toast('Noch keine Tankungen.');return}if(await exportCsv())toast('CSV exportiert.')};
    s.querySelector('#del').onclick=async()=>{if(!db.fills.length){toast('Es gibt nichts zu löschen.');return}
      if(!confirm('Wirklich alle '+db.fills.length+' Tankungen und Fotos auf diesem Handy löschen?'))return;
      db.fills=[];db.did=uid();await fotoClear().catch(()=>{});await save();closeSheet(false);render();toast('Alle Einträge gelöscht.')};
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
fan.addEventListener('click',e=>{const b=e.target.closest('[data-neu]');setFan(false);if(!b)return;openForm(null,b.dataset.neu==='foto')});
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
document.getElementById('menuBtn').addEventListener('click',()=>setFan(false));
if(IS_TEST){document.title='MyTankBox TEST';const h=document.querySelector('.brand h1');if(h)h.insertAdjacentHTML('beforeend',' <span class="testtag">TEST</span>')}
(async()=>{
  await load();await loadKeys();render();askPersist();
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
