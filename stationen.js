/* MyTankBox – Shell-Akzeptanzliste (CSV aus der Shell-Card-Tankstellensuche) einlesen.
   Ergebnis kompakt: [lat, lon, Marke, Straße+Nr., PLZ, Ort, Merkmale, Telefon]
   Merkmale (Bits): 1 = 24 h geöffnet, 2 = AdBlue (Pkw), 4 = Waschanlage */
(function(g){
'use strict';
/* CSV-Zeilen mit Anführungszeichen und Kommas in Feldern */
function rows(text){
  const out=[];let row=[],f='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c;continue}
    if(c==='"')q=true;else if(c===','){row.push(f);f=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(f);f='';if(row.length>1||row[0])out.push(row);row=[]}
    else f+=c}
  if(f||row.length){row.push(f);out.push(row)}
  return out}
const BRAND={shell:'Shell',esso:'Esso',eni:'Eni',agip:'Agip',westfalen:'Westfalen',markant:'Markant',svg:'SVG',hit:'HIT',t:'T',omv:'OMV',avia:'AVIA',star:'star',orlen:'ORLEN'};
const nice=s=>String(s||'').trim().toLowerCase().replace(/(^|[\s\-\/(])([a-zäöüß])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\bStr\b\.?/g,'Str.').replace(/([a-zäöüß])str\b\.?/g,'$1str.').replace(/Str\.\./g,'Str.');
const brandName=b=>{const k=String(b||'').trim().toLowerCase();return k?(BRAND[k]||b.trim()):''};
function parseShellCsv(text){
  if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
  const r=rows(text);if(r.length<2)throw new Error('Die Datei ist leer.');
  const h=r[0].map(x=>x.trim().toLowerCase());const ix=n=>h.indexOf(n);
  const I={lat:ix('gps latitude'),lon:ix('gps longitude'),addr:ix('address'),city:ix('city'),plz:ix('post code'),brand:ix('brand'),name:ix('name'),tel:ix('telephone'),
    h24:ix('twenty four hour'),adb:ix('adblue car'),wash:[ix('car wash'),ix('carwash')].filter(x=>x>=0)};
  if(I.lat<0||I.lon<0||I.addr<0)throw new Error('Das ist nicht die CSV aus der Shell-Tankstellensuche (Spalten „GPS Latitude“, „GPS Longitude“, „Address“ fehlen).');
  const T=v=>String(v||'').trim().toUpperCase()==='TRUE';
  const s=[],seen=new Set();
  for(let i=1;i<r.length;i++){const x=r[i];const lat=parseFloat(x[I.lat]),lon=parseFloat(x[I.lon]);
    if(!(lat>40&&lat<60&&lon>0&&lon<20))continue; // nur plausible Koordinaten (Mitteleuropa)
    const key=lat.toFixed(4)+','+lon.toFixed(4);if(seen.has(key))continue;seen.add(key);
    const fl=(I.h24>=0&&T(x[I.h24])?1:0)|(I.adb>=0&&T(x[I.adb])?2:0)|(I.wash.some(j=>T(x[j]))?4:0);
    s.push([Math.round(lat*1e5)/1e5,Math.round(lon*1e5)/1e5,brandName(I.brand>=0?x[I.brand]:''),nice(x[I.addr]),String(I.plz>=0?x[I.plz]:'').trim(),nice(I.city>=0?x[I.city]:''),fl,String(I.tel>=0?x[I.tel]:'').trim()])}
  if(s.length<50)throw new Error('In der Datei wurden kaum Tankstellen gefunden ('+s.length+').');
  return {n:s.length,s}}
g.TankStations={parseShellCsv};
})(typeof window!=='undefined'?window:globalThis);
