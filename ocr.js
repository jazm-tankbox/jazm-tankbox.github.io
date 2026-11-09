/* MyTankBox – Quittung auslesen.
   Erkennung: Tesseract.js (kostenlos, läuft im Browser). Bild und Text verlassen das Handy nicht,
   aus dem Internet kommen nur einmalig die Erkennungsdateien, danach liegen sie im Speicher.
   Dieses Modul enthält: Bildaufbereitung (Hintergrund ausgleichen, Schwelle) und das Herausziehen der Werte. */
(function(g){
'use strict';
const TJS='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js';
const OPTS={workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/worker.min.js',
  corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0'};
const LANGS=['https://cdn.jsdelivr.net/npm/@tesseract.js-data/deu@1.0.0/4.0.0_best_int','https://tessdata.projectnaptha.com/4.0.0'];

/* ---------- Werte aus dem Text ziehen ---------- */
const N=s=>{const m=String(s).replace(/\s/g,'').replace(/[Oo]/g,'0').match(/(\d{1,5})[,.](\d{1,3})/);return m?parseFloat(m[1]+'.'+m[2]):NaN};
// Beträge: Zahl mit genau 2 Nachkommastellen, nicht Teil von Datum/Uhrzeit
const AMT=/(?<![\d.,:])(\d{1,4})\s?[,.]\s?(\d{2})(?![\d.,:])/g;
const amts=l=>[...l.matchAll(AMT)].map(m=>parseFloat(m[1]+'.'+m[2]));
const lastAmt=l=>{const a=amts(l);return a.length?a[a.length-1]:NaN};
const BRANDS=[['Aral',/\bara[l1i]\b/i],['Shell',/\bshe[l1i]{2}\b/i],['Esso',/\be[s5]{2}[o0]\b/i],['JET',/\bjet\b/i],['TotalEnergies',/\btotal/i],
  ['Avia',/\bavia\b/i],['Star',/\bstar\b/i],['Agip',/\bagip\b/i],['Eni',/\beni\b/i],['Westfalen',/westfalen/i],['HEM',/\bhem\b/i],['Q1',/\bq1\b/i],
  ['Raiffeisen',/raiffeisen/i],['OMV',/\bomv\b/i],['bft',/\bbft\b/i],['Tamoil',/tamoil/i],['Orlen',/orlen/i],['Hoyer',/hoyer/i],['Classic',/\bclassic\b/i]];
function parse(text){
  const lines=String(text||'').split(/\r?\n/).map(l=>l.replace(/[|]/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean);
  const r={},why={};
  /* Datum & Uhrzeit: erstes plausibles Datum */
  for(const l of lines){const m=l.match(/(?<!\d)([0-3]?\d)\s?[.,]\s?([01]?\d)\s?[.,]\s?(20\d\d|\d\d)(?!\d)/);
    if(m){const d=+m[1],mo=+m[2];let y=+m[3];if(y<100)y+=2000;if(d>=1&&d<=31&&mo>=1&&mo<=12&&y>=2000&&y<=2099){
      r.datum=y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');const t=l.slice(m.index+m[0].length).match(/(?<!\d)([0-2]?\d)[:.]([0-5]\d)(?!\d{2,})/);
      if(t&&+t[1]<24)r.zeit=t[1].padStart(2,'0')+':'+t[2];break}}}
  if(r.datum&&!r.zeit)for(const l of lines){const t=l.match(/uhr\w*[:\s]+([0-2]?\d)[:.]([0-5]\d)/i);if(t&&+t[1]<24){r.zeit=t[1].padStart(2,'0')+':'+t[2];break}}
  /* Kilometerstand */
  for(const l of lines){const m=l.match(/\b(?:km|kilometer\w*|km-?stand|tacho\w*)\b\s*[:.=]?\s*(\d[\d .]{2,8}\d)\b/i);
    if(m){const v=parseInt(m[1].replace(/[ .]/g,''),10);if(v>=100&&v<=2e6){r.km=v;break}}}
  /* Liter & Preis pro Liter: Zeile mit „EUR/l“, „€/l“ oder „/l“ */
  for(const l of lines){if(!/(eur|€)\s?\/|\/\s?[l1i\]]\b|preis\s?\/?\s?l/i.test(l))continue;
    const nums=[...l.matchAll(/(\d{1,4})\s?[,.]\s?(\d{2,3})/g)].map(m=>({i:m[1],d:m[2],v:parseFloat(m[1]+'.'+m[2])}));
    const p=nums.find(x=>x.d.length===3&&x.v>=.8&&x.v<=3.5);if(p)r.ppl=p.v;
    // Liter: 2 Nachkommastellen; „57,311“ = 57,31 + „l“ als 1 gelesen
    const li=nums.find(x=>x!==p&&x.v>=1&&x.v<=200&&(x.d.length===2||(x.d.length===3&&/[1l]$/.test(x.d))));
    if(li)r.liter=parseFloat(li.i+'.'+li.d.slice(0,2));
    if(r.ppl||r.liter)break}
  if(!r.liter)for(const l of lines){const m=l.match(/(\d{1,3})\s?[,.]\s?(\d{2})\s?(?:l|ltr|liter)\b/i);if(m){r.liter=parseFloat(m[1]+'.'+m[2]);break}}
  /* Kraftstoff + Betrag */
  const FUEL=[['Premium-Diesel',/(ultimate|v-?power|excellium|supreme|premium|ultra)\s?diese/i],['Diesel',/diese[l1i\]]?/i],['Super Plus',/super\s?(plus|\+|98|100)/i],
    ['Super E10',/e\s?10/i],['Super E5',/super|e\s?5\b|benzin|95/i],['LPG',/\blpg|autogas/i]];
  for(const l of lines){if(/(eur|€)\s?\//i.test(l))continue;
    for(const [n,re] of FUEL){if(re.test(l)&&!/w.?sche|wasch/i.test(l)){const a=lastAmt(l);if(!r.sorte)r.sorte=n;if(a>0&&!r.betrag){r.betrag=a;why.betrag='Zeile'}break}}
    if(r.betrag)break}
  /* Autowäsche */
  for(const l of lines){if(/w\W?a\W?s\W?c\W?h|w.sche|car\s?wash|wäsch/i.test(l)&&!/geb.hr|pfand/i.test(l)){const a=lastAmt(l);if(a>0&&a<100){r.waesche=a;break}}}
  /* Gesamtbetrag (größter Betrag in Summen-Zeilen) */
  let tot=NaN;for(const l of lines){if(/[gq]e?s[ae]m|summe|total|zu\s?zahlen|betra[gq]|bar\b|karte\s?eur/i.test(l)&&!/netto|mwst|ust|steuer/i.test(l)){const a=lastAmt(l);if(a>0&&!(a<=tot))tot=a}}
  if(tot>0)r.gesamt=tot;
  /* Gegenproben und Lücken füllen */
  const near=(a,b,t)=>Math.abs(a-b)<=t;
  if(r.liter&&r.ppl){const calc=Math.round(r.liter*r.ppl*100)/100;
    if(!r.betrag)r.betrag=calc;else if(!near(calc,r.betrag,.06)&&r.gesamt&&near(calc,r.gesamt-(r.waesche||0),.06))r.betrag=calc}
  if(!r.betrag&&r.gesamt)r.betrag=Math.round((r.gesamt-(r.waesche||0))*100)/100;
  if(r.betrag&&r.ppl&&!r.liter)r.liter=Math.round(r.betrag/r.ppl*100)/100;
  if(r.betrag&&r.liter&&!r.ppl)r.ppl=Math.round(r.betrag/r.liter*1000)/1000;
  // Wäsche falsch gelesen (z. B. 12,3 statt 12,90)? Gesamt − Kraftstoff gewinnt, wenn plausibel
  if(r.gesamt&&r.betrag&&r.waesche&&!near(r.betrag+r.waesche,r.gesamt,.02)){const d=Math.round((r.gesamt-r.betrag)*100)/100;if(d>0&&d<100)r.waesche=d}
  if(r.gesamt&&r.betrag&&!r.waesche&&r.gesamt-r.betrag>=3&&r.gesamt-r.betrag<=40&&lines.some(l=>/wasch|w.sche/i.test(l)))r.waesche=Math.round((r.gesamt-r.betrag)*100)/100;
  /* Tankstelle: Marke in den ersten Zeilen + Ort aus der Postleitzahl */
  const headL=lines.slice(0,18);let brand='';for(const [n,re] of BRANDS){if(headL.some(l=>re.test(l))){brand=n;break}}
  let ort='';for(const l of headL){const m=l.match(/\b\d{5}\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\- ]{2,30})/);if(m){ort=m[1].trim().replace(/\s+\d.*$/,'');break}}
  if(brand||ort)r.station=[brand,ort].filter(Boolean).join(' ');
  /* Prüfstatus */
  r.ok=!!(r.liter&&r.ppl&&r.betrag&&near(r.liter*r.ppl,r.betrag,.06));
  if(r.gesamt&&r.betrag)r.sumOk=near(r.betrag+(r.waesche||0),r.gesamt,.02);
  return r;
}

/* ---------- Bild aufbereiten: Graustufen, Hintergrund ausgleichen, Schwelle ---------- */
function boxBlur(src,w,h,rad){ // separabler Kastenfilter, zweimal = annähernd Gauß
  const tmp=new Float32Array(w*h),out=new Float32Array(w*h);
  const pass=(a,b,W,H,stepI,stepJ)=>{for(let j=0;j<H;j++){let s=0;const o=j*stepJ;const n=2*rad+1;
    for(let k=-rad;k<=rad;k++)s+=a[o+Math.min(W-1,Math.max(0,k))*stepI];
    for(let i=0;i<W;i++){b[o+i*stepI]=s/n;const add=Math.min(W-1,i+rad+1),sub=Math.max(0,i-rad);s+=a[o+add*stepI]-a[o+sub*stepI]}}};
  pass(src,tmp,w,h,1,w);pass(tmp,out,h,w,w,1);pass(out,tmp,w,h,1,w);pass(tmp,out,h,w,w,1);return out}
async function prepare(file){
  const bmp=await createImageBitmap(file);
  // Ziel: Bildbreite um 2400–3000 px (wie im Test), sehr große Fotos nicht noch größer machen
  const sc=Math.min(3,Math.max(1,2600/bmp.width),4000*4000/(bmp.width*bmp.height)<1?Math.sqrt(16e6/(bmp.width*bmp.height)):9);
  const w=Math.round(bmp.width*sc),h=Math.round(bmp.height*sc);
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});
  x.imageSmoothingQuality='high';x.drawImage(bmp,0,0,w,h);
  const id=x.getImageData(0,0,w,h),d=id.data,gr=new Float32Array(w*h);
  for(let i=0,p=0;i<gr.length;i++,p+=4)gr[i]=.299*d[p]+.587*d[p+1]+.114*d[p+2];
  const bg=boxBlur(gr,w,h,Math.max(8,Math.round(w/120)));
  for(let i=0,p=0;i<gr.length;i++,p+=4){const v=gr[i]/(bg[i]+1)*255>200?255:0;d[p]=d[p+1]=d[p+2]=v;d[p+3]=255}
  x.putImageData(id,0,0);return c}

/* ---------- Erkennung ---------- */
let libP=null,workerP=null;
function lib(){if(g.Tesseract)return Promise.resolve(g.Tesseract);if(libP)return libP;
  libP=new Promise((res,rej)=>{const s=document.createElement('script');s.src=TJS;s.crossOrigin='anonymous';s.onload=()=>res(g.Tesseract);
    s.onerror=()=>{libP=null;rej(new Error('offline'))};document.head.appendChild(s)});return libP}
let onProg=null;
async function worker(){if(workerP)return workerP;
  workerP=(async()=>{const T=await lib();let last;
    for(const langPath of LANGS){try{
      const w=await T.createWorker('deu',1,Object.assign({},OPTS,{langPath,logger:m=>{if(onProg&&m&&typeof m.progress==='number')onProg(m.status,m.progress)}}));
      await w.setParameters({tessedit_pageseg_mode:'4',preserve_interword_spaces:'1'});return w}catch(e){last=e}}
    throw last||new Error('offline')})();
  workerP.catch(()=>{workerP=null});return workerP}
async function read(file,progress){
  onProg=progress||null;
  const [w,canvas]=await Promise.all([worker(),prepare(file)]);
  const {data}=await w.recognize(canvas);
  onProg=null;const r=parse(data.text);r.text=data.text;return r}
g.TankOCR={read,parse,prepare,warm:()=>worker().catch(()=>{})};
})(typeof window!=='undefined'?window:globalThis);
