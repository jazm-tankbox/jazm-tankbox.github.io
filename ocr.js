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


/* ---------- Marke unscharf erkennen ---------- */
const BRANDLIST=[['Aral','ARAL'],['Shell','SHELL'],['Esso','ESSO'],['JET','JET'],['TotalEnergies','TOTAL'],['Avia','AVIA'],['Star','STAR'],['Agip','AGIP'],
  ['Eni','ENI'],['Westfalen','WESTFALEN'],['HEM','HEM'],['Q1','Q1'],['Raiffeisen','RAIFFEISEN'],['OMV','OMV'],['bft','BFT'],['Tamoil','TAMOIL'],['Orlen','ORLEN'],
  ['Hoyer','HOYER'],['Classic','CLASSIC'],['Globus','GLOBUS'],['Supermarkt-Tankstelle','SUPERMARKT']];
function lev(a,b){const m=a.length,n=b.length;if(Math.abs(m-n)>2)return 9;let p=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]}
const deDigit=t=>t.toUpperCase().replace(/5/g,'S').replace(/0/g,'O').replace(/1/g,'I').replace(/3/g,'E').replace(/8/g,'B').replace(/4/g,'A').replace(/[^A-ZÄÖÜ]/g,'');
function matchBrand(tok,loose){const t=deDigit(tok);if(t.length<2)return '';
  for(const [n,k] of BRANDLIST){if(t===k)return n}
  for(const [n,k] of BRANDLIST){if(k.length>=4&&t.length>=5&&t.startsWith(k))return n}
  for(const [n,k] of BRANDLIST){if(k.length>=4&&t.length>=(loose?3:4)&&lev(t,k)<=1)return n}
  // Anfangsbuchstabe falsch gelesen (E→I wie „1550“ für ESSO)
  for(const [n,k] of BRANDLIST){if(k.length>=4&&t.length===k.length&&t.slice(1)===k.slice(1))return n}
  return ''}
function findBrand(lines){
  const STAT=/\bs\s?t\s?a\s?t\s?[il1t!]?\s?[io0]\s?n\b|\btankstelle\b/i;
  const clean=l=>l.replace(/euro\s?shell|shell\s?(card|flot)|dkv|uta\b|routex|aral\s?card/ig,' ');
  // 1) „X Station“ (auch verlesen wie „ESS Stat ton“), 2) Kopfzeilen, 3) „X Deutschland GmbH“ im Kleingedruckten
  for(const l of lines.map(clean)){const m=l.match(new RegExp('([A-Za-z0-9]{2,12})\\s+(?:'+STAT.source+')','i'));if(m){const b=matchBrand(m[1],true);if(b)return b}}
  for(const l of lines.slice(0,8).map(clean)){for(const tok of l.replace(new RegExp(STAT.source,'ig'),' ').replace(/\bstat\b/ig,' ').split(/[\s,.:;()/]+/)){const b=matchBrand(tok);if(b&&tok.length<=16)return b}}
  for(const l of lines.map(clean)){const m=l.match(/([A-Za-z0-9]{2,12})\s+(?:deutschland|germany)\s+g\w{2,3}h/i);if(m){const b=matchBrand(m[1],true);if(b)return b}}
  return ''}
const streetKey=s=>String(s||'').toLowerCase().replace(/stra(ss|ß)e|str\.?/g,'str').replace(/\d.*$/,'').replace(/[^a-zäöüß]/g,'');

/* ---------- Werte aus dem Text ziehen ---------- */
const N=s=>{const m=String(s).replace(/\s/g,'').replace(/[Oo]/g,'0').match(/(\d{1,5})[,.](\d{1,3})/);return m?parseFloat(m[1]+'.'+m[2]):NaN};
// Beträge: Zahl mit genau 2 Nachkommastellen, nicht Teil von Datum/Uhrzeit
const AMT=/(?<![\d.,:])(\d{1,4})\s?[,.]\s?(\d{2})(?![\d.,:])/g;
const amts=l=>[...l.matchAll(AMT)].map(m=>parseFloat(m[1]+'.'+m[2]));
const lastAmt=l=>{const a=amts(l);return a.length?a[a.length-1]:NaN};
function parse(text){
  // „l“ wird oft als „]“ gelesen: hinter Buchstaben (Diese] → Diesel) und als Einheit hinter Litern (56,92] → 56,92 l)
  const lines=String(text||'').split(/\r?\n/).map(l=>l.replace(/(\d[,.]\d{2})\s?\|/g,'$1 l').replace(/[|]/g,' ').replace(/([A-Za-zäöüß])\](?=\s|$|[.,])/g,'$1l').replace(/(\d[,.]\d{2})\s?[\]\[](?=\s|$|\*)/g,'$1 l').replace(/\s+/g,' ').trim()).filter(Boolean);
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
  // Lieferschein (Tankkarte): Zapfpunkt-Zeile „Zp 03  56,92 l“, Liter mit „1“ statt „l“ am Ende
  if(!r.liter)for(const l of lines){const m=l.match(/\bz[pf]\s?\d{1,2}\b.*?(\d{1,3})\s?[,.]\s?(\d{2})(?:\s?[l1iI]\b|\s|$)/i);if(m){const v=parseFloat(m[1]+'.'+m[2]);if(v>=1&&v<=200){r.liter=v;break}}}
  // Lieferschein: Liter stehen in der Zeile nach der Kraftstoffsorte („*000005 Diesel FuelSave“ → „*Zp 03  56,92 l“)
  if(!r.liter)for(let i=0;i<lines.length-1;i++){if(!/diesel|super|benzin|e10|e5|v-?power|ultimate|excellium|fuelsave|premium/i.test(lines[i]))continue;
    for(const l of lines.slice(i,i+3)){if(/eur|€|\/\s?[l1i]\b|summe|betrag/i.test(l))continue;const m=l.match(/(?<![\d,.])(\d{1,3})\s?[,.]\s?(\d{2})(?![\d,.])/);if(m){const v=parseFloat(m[1]+'.'+m[2]);if(v>=3&&v<=200){r.liter=v;break}}}
    if(r.liter)break}
  // zuletzt: Zahl mit 2 Nachkommastellen und einem „l“-ähnlichen Zeichen dahinter (l, 1, I, ], „1]“)
  if(!r.liter)for(const l of lines){if(/eur|€|\/\s?[l1i]/i.test(l))continue;const m=l.match(/(?<![\d,.])(\d{1,3})\s?[,.]\s?(\d{2})\s?(?:[l1iI\]\[|]{1,2})(?=\s|$|[*+x])/);if(m){const v=parseFloat(m[1]+'.'+m[2]);if(v>=3&&v<=200){r.liter=v;break}}}
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
  /* Tankstelle: Marke (auch unscharf, z. B. „E5S0“ = Esso) + Adresse */
  const brand=findBrand(lines);
  let ort='',plz='',strasse='';
  const SUF="(?:[Ss]tra(?:ss|ß|s)[eoa0]|[Ss]tr\\.?|[Ww]eg|[Aa]llee|[Pp]latz|[Rr]ing|[Dd]amm|[Cc]haussee|[Gg]asse|[Uu]fer|[Mm]arkt|[Hh]of|[Pp]fad|[Ll]andstr\\w*)";
  const STREET=new RegExp("((?:[A-ZÄÖÜ][a-zäöüß]*\\.?[\\s-]){0,3}[A-ZÄÖÜ]?[a-zäöüß-]*"+SUF+")\\s*(\\d{1,4}\\s?[a-z]?\\b(?:\\s?-\\s?\\d{1,4})?)?");
  const fixStreet=(n,h)=>(n.replace(/stra(?:ss|s)[eoa0]$/i,'straße').replace(/\s+/g,' ').trim()+(h?' '+h.replace(/\s/g,''):'')).trim();
  const digitsFix=t=>t.replace(/[Oo]/g,'0').replace(/[lI|]/g,'1');
  for(let i=0;i<Math.min(lines.length,25);i++){
    const L=lines[i].replace(/\b[DO0]\s?-\s?(?=\d{5})/,'');
    const m=L.match(/(?:^|[\s,])([0-9OolI]{5})\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\-]+(?:[ -][A-ZÄÖÜa-zäöüß(][A-Za-zÄÖÜäöüß.\-)]*){0,3})/);
    if(!m||(m[1].match(/\d/g)||[]).length<3)continue;
    const pz=digitsFix(m[1]);if(!/^\d{5}$/.test(pz)||pz<'01000')continue;
    plz=pz;ort=m[2].replace(/\s+(?:Tel|Fax|Telefon|St\.?-?Nr|USt|www)\b.*$/i,'').replace(/[.,\-\s]+$/,'').trim();
    r.strRaw=(L.slice(0,m.index).trim()||lines[i-1]||'');
    // Straße: gleiche Zeile vor der PLZ, sonst bis zu 4 Zeilen darüber
    const before=L.slice(0,m.index).trim();const cand=before?[before]:[];
    for(let j=i-1;j>=Math.max(0,i-4);j--)cand.push(lines[j]);
    for(const c of cand){const sm=c.match(STREET);if(sm&&sm[1].replace(/[^A-Za-zäöüß]/g,'').length>=4){strasse=fixStreet(sm[1],sm[2]);break}}
    // ohne Straßen-Wort: „Am Kreuz 3“ direkt über der PLZ
    if(!strasse)for(const c of cand.slice(before?1:0,before?2:1)){const sm=c&&c.match(/^([A-ZÄÖÜ][A-Za-zäöüß.\- ]{2,40}?)\s(\d{1,4}\s?[a-z]?)$/);if(sm&&!/tel|fax|station|gmbh/i.test(sm[1])){strasse=fixStreet(sm[1],sm[2]);break}}
    break}
  if(brand)r.marke=brand;
  if(plz){r.plz=plz;r.ort=ort;if(strasse)r.strasse=strasse;r.adresse=[strasse,plz+' '+ort].filter(Boolean).join(', ')}
  if(brand||ort)r.station=[brand,ort].filter(Boolean).join(' ');
  /* Prüfstatus */
  r.ok=!!(r.liter&&r.ppl&&r.betrag&&near(r.liter*r.ppl,r.betrag,.06));
  // Lieferschein der Tankkarte: ohne Preise, Abrechnung später über die Karte
  if(!r.betrag&&lines.some(l=>/lieferschein/i.test(l)))r.lieferschein=true;
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
async function loadBmp(file){try{return await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){return await createImageBitmap(file)}}
/* Aufbereitung, sparsam im Speicher (Handys liefern bei zu großen Bildern sonst stillschweigend ein leeres Bild):
   höchstens ca. 9 Mio. Pixel, Hintergrund auf 1/4 verkleinert berechnen.
   opt.rot: Drehung in Grad, opt.plain: nur Graustufen (Tesseract binarisiert selbst). Liefert {canvas, info}. */
function prepare(bmp,opt={}){
  const rot=opt.rot||0,sw=rot%180?bmp.height:bmp.width,sh=rot%180?bmp.width:bmp.height;
  let sc=Math.min(3,Math.max(1,2400/sw));if(sw*sc*sh*sc>9e6)sc=Math.sqrt(9e6/(sw*sh));
  const w=Math.max(1,Math.round(sw*sc)),h=Math.max(1,Math.round(sh*sc));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});
  x.fillStyle='#fff';x.fillRect(0,0,w,h);x.imageSmoothingQuality='high';
  x.save();x.translate(w/2,h/2);x.rotate(rot*Math.PI/180);const dw=bmp.width*sc,dh=bmp.height*sc;x.drawImage(bmp,-dw/2,-dh/2,dw,dh);x.restore();
  const id=x.getImageData(0,0,w,h),d=id.data,n=w*h;
  const gr=new Uint8ClampedArray(n);let mn=255,mx=0,sum=0;
  for(let i=0,p=0;i<n;i++,p+=4){const v=(77*d[p]+150*d[p+1]+29*d[p+2])>>8;gr[i]=v;sum+=v;if(v<mn)mn=v;if(v>mx)mx=v}
  const info={w,h,rot,plain:!!opt.plain,mean:Math.round(sum/n),range:mx-mn,src:bmp.width+'×'+bmp.height};
  if(info.range<20){info.blank=true;return {canvas:c,info}} // Bild leer/einfarbig → Aufbereitung sinnlos
  let black=0;
  if(opt.plain){const hs=new Uint32Array(256);for(let i=0;i<n;i++)hs[gr[i]]++;let lo=0,hi=255,acc=0;
    for(let t=0;t<256;t++){acc+=hs[t];if(acc>=n*.01){lo=t;break}}acc=0;for(let t=255;t>=0;t--){acc+=hs[t];if(acc>=n*.01){hi=t;break}}
    const f=255/Math.max(1,hi-lo);for(let i=0,p=0;i<n;i++,p+=4){const v=(gr[i]-lo)*f;d[p]=d[p+1]=d[p+2]=v;d[p+3]=255}}
  else{const k=4,bw=Math.ceil(w/k),bh=Math.ceil(h/k),small=new Float32Array(bw*bh);
    for(let yy=0;yy<bh;yy++)for(let xx=0;xx<bw;xx++){let s=0,m=0;for(let j=0;j<k;j++){const y=yy*k+j;if(y>=h)break;for(let i2=0;i2<k;i2++){const xq=xx*k+i2;if(xq>=w)break;s+=gr[y*w+xq];m++}}small[yy*bw+xx]=s/m}
    const bg=boxBlur(small,bw,bh,Math.max(2,Math.round(bw/120)));
    // Verhältnis Pixel/Hintergrund (Papier ≈ 255, Schrift dunkler) – Schwelle ans Bild anpassen:
    // bei flauen, unscharfen Fotos liegt die Schrift nur knapp unter dem Papier
    const rat=new Uint8ClampedArray(n),hist=new Uint32Array(256);
    for(let y=0;y<h;y++){const by=Math.min(bh-1,y/k|0)*bw;for(let xq=0;xq<w;xq++){const i=y*w+xq;const v=gr[i]/(bg[by+Math.min(bw-1,xq/k|0)]+1)*255;rat[i]=v;hist[rat[i]]++}}
    let thr=200,acc=0;for(let t=0;t<=thr;t++)acc+=hist[t];
    if(acc<n*.03){acc=0;for(let t=0;t<256;t++){acc+=hist[t];if(acc>=n*.06){thr=Math.min(242,Math.max(200,t));break}}}
    info.thr=thr;
    for(let i=0,p=0;i<n;i++,p+=4){const v=rat[i]>thr?255:0;if(!v)black++;d[p]=d[p+1]=d[p+2]=v;d[p+3]=255}
    info.black=Math.round(black/n*1000)/10}
  x.putImageData(id,0,0);return {canvas:c,info}}
/* Wie brauchbar ist ein Ergebnis? Gefundene Werte + echte Wörter */
function quality(r){const words=(String(r.text||'').match(/[A-Za-zÄÖÜäöüß]{4,}/g)||[]).filter(t=>/[aeiouäöüy]/i.test(t)).length;
  return (r.datum?3:0)+(r.liter?3:0)+(r.betrag?3:0)+(r.km?2:0)+(r.plz?2:0)+Math.min(10,words/3)}

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
  const [w,bmp]=await Promise.all([worker(),loadBmp(file)]);
  // Versuche nacheinander, bis das Ergebnis brauchbar ist: aufbereitet → Graustufen → gedreht
  const tries=[{},{plain:true},{rot:90},{rot:270}];let best=null;const log=[];
  try{for(let t=0;t<tries.length;t++){
      if(t&&progress)progress('retry',t/tries.length);
      const {canvas,info}=prepare(bmp,tries[t]);if(info.blank){log.push(info);continue}
      const {data}=await w.recognize(canvas);const r=parse(data.text);r.text=data.text;r.q=quality(r);info.q=Math.round(r.q*10)/10;log.push(info);
      if(!best||r.q>best.q){best=r;best.img=canvas}
      if(best.q>=8)break}}
  finally{onProg=null}
  if(!best){best=parse('');best.text='';best.q=0}
  best.diag=log.map(i=>`${i.rot?i.rot+'° ':''}${i.plain?'grau ':''}${i.w}×${i.h}${i.blank?' LEER (Bild einfarbig, Helligkeit '+i.mean+')':' · Kontrast '+i.range+(i.black!=null?' · '+i.black+' % schwarz (Schwelle '+i.thr+')':'')+(i.src?' · Foto '+i.src:'')+' · Güte '+i.q}`).join('\n');
  return best}
/* ---------- Kilometerstand vom Tacho (vor dem Tanken) ----------
   Tacho-Anzeigen sind oft helle Ziffern auf dunklem Grund: Graustufen, Kontrast strecken, bei dunklem Bild umkehren.
   Nur Ziffern erlauben; danach die Einstellungen für Quittungen wiederherstellen. */
function prepKm(bmp,mode){ // mode: 0 = Graustufen, 1 = Schwelle, 2 = weichzeichnen + Schwelle (verbindet Segmentziffern)
  const sc=Math.min(4,Math.max(1,1800/bmp.width),bmp.width>2400?2400/bmp.width:9);
  const w=Math.round(bmp.width*sc),h=Math.round(bmp.height*sc);
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});
  x.imageSmoothingQuality='high';x.drawImage(bmp,0,0,w,h);
  const id=x.getImageData(0,0,w,h),d=id.data,n=w*h,hist=new Uint32Array(256);let gr=new Float32Array(n);
  for(let i=0,p=0;i<n;i++,p+=4){const v=.299*d[p]+.587*d[p+1]+.114*d[p+2];gr[i]=v;hist[v|0]++}
  const pct=q=>{let a=0;for(let i=0;i<256;i++){a+=hist[i];if(a>=n*q)return i}return 255};
  const lo=pct(.02),hi=Math.max(lo+1,pct(.98)),med=pct(.5);
  const inv=med<(lo+hi)/2; // überwiegend dunkel → helle Ziffern auf dunklem Grund → umkehren
  for(let i=0;i<n;i++){let v=(gr[i]-lo)/(hi-lo)*255;v=v<0?0:v>255?255:v;gr[i]=inv?255-v:v}
  if(mode===2)gr=boxBlur(gr,w,h,Math.max(2,Math.round(w/400)));
  const bg=mode?boxBlur(gr,w,h,Math.max(10,Math.round(w/25))):null;
  for(let i=0,p=0;i<n;i++,p+=4){const v=mode?(gr[i]<bg[i]*.8?0:255):gr[i];d[p]=d[p+1]=d[p+2]=v;d[p+3]=255}
  x.putImageData(id,0,0);return c}
function kmCands(data,min){
  const lines=data.lines&&data.lines.length?data.lines.map(l=>({t:l.text,h:l.bbox?l.bbox.y1-l.bbox.y0:0})):String(data.text||'').split('\n').map(t=>({t,h:0}));
  const maxH=Math.max(1,...lines.map(l=>l.h));const out=new Map();
  for(const l of lines){const t=String(l.t||'').replace(/[^\d ]/g,' ');
    for(const m of t.matchAll(/\d{1,3}(?: \d{3})+|\d+/g)){const raw=m[0].replace(/ /g,'');
      if(raw.length<(min>0?4:3)||raw.length>7)continue;const v=+raw;if(!(v>0))continue;
      let sc=l.h/maxH; // große Ziffern bevorzugen
      if(min>0){if(v>=min&&v<=min+6000)sc+=3-(v-min)/6000;else if(v>=min-30&&v<min)sc+=1.2;else if(v>min+6000&&v<min+40000)sc+=.4;else sc-=1}
      else sc+=raw.length>=5&&raw.length<=6?1:0;
      if(!out.has(v)||out.get(v)<sc)out.set(v,sc)}}
  return [...out.entries()].sort((a,b)=>b[1]-a[1]).map(([v,s])=>({v,s}))}
/* Eigene Worker nur für Ziffern (die Einstellungen für Quittungen bleiben unberührt):
   'deu' für Tachos mit normaler Schrift (TFT-Display), '7seg' für Leuchtsegment-Ziffern.
   7seg: tessdata_ssd von Shreeshrii (Apache-2.0), wird nur bei Bedarf geladen (ca. 11 MB, danach im Cache).
   Welche Variante beim Wagen funktioniert hat, merkt sich die App und probiert sie beim nächsten Mal zuerst. */
const SEG_PATH='https://cdn.jsdelivr.net/gh/Shreeshrii/tessdata_ssd@e493a10a4bf81632506cf24ba99d83854afff9f6';
const kmW={},kmT={};
function kmWorker(lang){if(kmW[lang])return kmW[lang];
  kmW[lang]=(async()=>{const T=await lib();let last;
    const paths=lang==='7seg'?[SEG_PATH]:LANGS;
    for(const langPath of paths){try{
      const w=await T.createWorker(lang,1,Object.assign({},OPTS,{langPath},lang==='7seg'?{gzip:false}:{}));
      await w.setParameters({tessedit_char_whitelist:'0123456789'});return w}catch(e){last=e}}
    throw last||new Error('offline')})();
  kmW[lang].catch(()=>{kmW[lang]=null});return kmW[lang]}
function kmIdle(lang){clearTimeout(kmT[lang]);kmT[lang]=setTimeout(async()=>{const p=kmW[lang];kmW[lang]=null;if(p){try{(await p).terminate()}catch(e){}}},90000)}
const PASSES={deu:[['6',1],['11',2],['7',2]],'7seg':[['7',2],['6',2],['11',1]]};
const prefKey='tankbox-kmocr';
async function readKm(file,opt={}){
  const bmp=await loadBmp(file);const min=+opt.min||0,good=min>0?3:1.6;let text='',best=[],used='',err=null;
  let pref='deu';try{pref=localStorage.getItem(prefKey)||'deu'}catch(e){}
  const order=pref==='7seg'?['7seg','deu']:['deu','7seg'];
  for(const lang of order){let w;
    try{opt.progress&&opt.progress(lang);w=await kmWorker(lang)}catch(e){err=e;continue}
    try{for(const [psm,mode] of PASSES[lang]){
        await w.setParameters({tessedit_pageseg_mode:psm});
        const {data}=await w.recognize(prepKm(bmp,mode));text+=(text?'\n':'')+'['+lang+'/'+psm+'] '+((data.text||'').trim().replace(/\s*\n\s*/g,' / ')||'–');
        kmCands(data,min).forEach(x=>{const o=best.find(y=>y.v===x.v);if(o)o.s=Math.max(o.s,x.s)+.3;else best.push(x);x.lang=x.lang||lang});
        best.sort((a,b)=>b.s-a.s);if(best[0]&&best[0].s>=good){used=lang;break}}}
    catch(e){err=e}finally{kmIdle(lang)}
    if(used)break}
  if(used){try{localStorage.setItem(prefKey,used)}catch(e){}}
  if(!best.length&&err&&!text)throw err;
  return {km:best[0]&&best[0].s>0?best[0].v:null,cands:best.filter(x=>x.s>0).slice(0,3).map(x=>x.v),text}}
g.TankOCR={read,readKm,kmCands,prepKm,quality,loadBmp,parse,prepare,lev,streetKey,warm:()=>worker().catch(()=>{})};
})(typeof window!=='undefined'?window:globalThis);
