/* RXDE LIVE DATABASE — only db.csv is authoritative; no frozen db_local.js. */
(()=>{
'use strict';
const isGeneric=new URL(document.currentScript.src).searchParams.get('mode')==='generic';
const error=(message)=>{
 console.error('[RXDE database]',message);
 let box=document.createElement('div');box.setAttribute('role','alert');
 box.style.cssText='position:fixed;z-index:2147483646;top:0;left:0;right:0;background:#ffe7e6;color:#8b211b;padding:14px;font:600 14px Arial;text-align:center';
 box.textContent='Не удалось загрузить актуальную базу db.csv. Цены и каталог временно недоступны. Обновите страницу.';
 document.body.appendChild(box);
};
function parseCSV(text){
 text=String(text||'').replace(/^\uFEFF/,'');let result=[],row=[],field='',inQuotes=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(inQuotes){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')inQuotes=false;else field+=c;continue}
  if(c==='"'){inQuotes=true;continue}
  if(c===','){row.push(field);field='';continue}
  if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>x!==''))result.push(row);row=[];continue}
  field+=c;
 }
 if(inQuotes)throw new Error('Unclosed quote in CSV');
 if(field||row.length){row.push(field);result.push(row)}
 const headers=(result.shift()||[]).map(x=>x.trim());
 if(!headers.includes('PZN')||!headers.includes('Price')||!headers.includes('Name_DE'))throw new Error('Unexpected CSV column headers');
 return result.map(cols=>Object.fromEntries(headers.map((h,i)=>[h,cols[i]||'']))).filter(r=>r.PZN && r.Name_DE);
}
const catRules=[
    ['Товары для животных', /ветеринар|животн|hund|katze|pet\b|tierarzt/i],
    ['Уход за полостью рта', /стоматолог|полост[ьи] рта|зуб|дес[её]н|mundsp[üu]l|zahnpast|dent/i],
    ['Глаза', /глаз|офтальм|eye|augen|ophtalm/i],
    ['Аллергия', /аллерг|антигистамин|heuschnupfen/i],
    ['Детские товары', /детск|младен|ребен|baby|kindern|kinder\b/i],
    ['Волосы и кожа головы', /волос|кож[иа] головы|шампун|haare|shampoo/i],
    ['Пищеварение', /пищевар|желуд|кишеч|запор|колит|гастрит|печен|метеоризм|darm|magen/i],
    ['Боль, мышцы и суставы', /сустав|артрит|артроз|ревмат|мышц|спин[аы]|обезбол|schmerz|gelenk/i],
    ['Простуда и дыхание', /простуд|кашел|бронх|астм|дыхани|грипп|husten|erk[aä]lt/i],
    ['Кожа и заживление', /дермат|кож[иае] |крем|маз[ьи]|ран[аы]|ожог|haut|wund|pflaster/i],
    ['Уход и косметика', /космет|уход|гигиен|beauty|pflege|parf[üu]m/i],
    ['Витамины и минералы', /витамин|минерал|магни|цинк|кальци|омега|omega|nahrungserg|vitamin/i]
];
function primaryCategory(r){
 if(r.PrimaryCategory)return String(r.PrimaryCategory).trim();
 const cat=String(r.Category||'').normalize('NFKC').toLowerCase().replace(/ё/g,'е');
 for(const [name,rx] of catRules)if(rx.test(cat))return name;
 const title=(String(r.Name_DE||'')+' '+String(r.Name_RU||'')).normalize('NFKC').toLowerCase().replace(/ё/g,'е');
 for(const [name,rx] of [
 ['Витамины и минералы',/vitamin|витамин|omega[ -]?3|омега[ -]?3|magnesium|магний/i],
 ['Глаза',/augentropfen|глазные капли/i],
 ['Уход за полостью рта',/zahnpasta|зубная паста/i],
 ['Товары для животных',/\bvet\b|ветеринар/i]
 ])if(rx.test(title))return name;
 return 'Другие препараты';
}
function loadScript(file){return new Promise((yes,no)=>{
 let script=document.createElement('script');script.src=file+'?v=20261112-24';
 script.onload=()=>yes();script.onerror=()=>no(new Error('Cannot load '+file));document.body.appendChild(script);
})}
async function start(){
 try{
  const url=new URL(isGeneric?'db.csv':'db.csv',document.baseURI);
  url.searchParams.set('_',String(Math.floor(Date.now()/300000)));
  const res=await fetch(url.href,{cache:'no-store'});
  if(!res.ok)throw new Error('db.csv HTTP '+res.status);
  const rows=parseCSV(await res.text());if(!rows.length)throw new Error('db.csv is empty');
  rows.forEach(r=>r.PrimaryCategory=primaryCategory(r));
  window.RXDE_LOCAL_DB=rows;
  await loadScript('product-pages.js');
  if(isGeneric) await loadScript('product-generic.js');
  else for(const file of ['delivery.js','app.js','checkout35.js'])await loadScript(file);
  console.info('[RXDE] db.csv loaded',rows.length,'products');
 }catch(e){error(e.message||String(e))}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
