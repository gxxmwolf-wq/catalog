(()=>{
  const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pzn=v=>String(v??'').trim().toUpperCase().replace(/[^A-Z0-9]/g,''); const money=n=>Math.round(Number(n)||0).toLocaleString('ru-RU');
  const params=new URLSearchParams(location.search), current=pzn(params.get('pzn') || document.body.dataset.pzn);
  const row=(window.RXDE_LOCAL_DB||[]).find(x=>pzn(x.PZN)===current);
  const cfg=window.RXDE_CONFIG||{}, rates=window.RXDE_RATES||{}; const base=Number(rates.cbrRate)||Number(cfg.fallbackCbrRate)||100; let rate=Math.floor(base+(Number(cfg.rateMarkupRub)||0));
  // Match the main catalogue: use settings_1!C2 where available, retaining rates.js as fallback.
  function syncRate(){const id=String(cfg.googleRateSpreadsheetId||'').trim();if(!id)return;const cb='__rxdePageRate_'+Date.now()+Math.random().toString(36).slice(2);const sc=document.createElement('script');let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);sc.remove();try{delete window[cb]}catch(_){}};window[cb]=payload=>{const raw=payload?.table?.rows?.[0]?.c?.[0]?.v??payload?.table?.rows?.[0]?.c?.[0]?.f;const n=Number(String(raw??'').replace(',','.'));if(Number.isFinite(n)&&n>=20&&n<=300){rate=Math.floor(n+(Number(cfg.rateMarkupRub)||0));renderCommerce()}finish()};const u=new URL('https://docs.google.com/spreadsheets/d/'+encodeURIComponent(id)+'/gviz/tq');u.searchParams.set('sheet',cfg.googleRateSheet||'settings_1');u.searchParams.set('range',cfg.googleRateCell||'C2');u.searchParams.set('tqx','out:json;responseHandler:'+cb);u.searchParams.set('_',String(Date.now()));sc.src=u.href;sc.onerror=finish;const timer=setTimeout(finish,5000);document.head.appendChild(sc)}

  const CART_KEY='de_cart_v2';
  function load(){try{return JSON.parse(localStorage.getItem(CART_KEY)||'[]')}catch(_){return[]}}
  function save(a){localStorage.setItem(CART_KEY,JSON.stringify(a))}
  function qty(){return Number(load().find(x=>pzn(x.pzn)===current)?.qty||0)}
  function showCartHint(){
    let el=document.getElementById('rxdePageCartHint');if(!el){el=document.createElement('div');el.id='rxdePageCartHint';el.className='rxde-page-cart-hint';el.innerHTML='<strong>Позиция добавлена!</strong><span>Оформите заявку<br>или продолжите выбор.</span>';document.body.appendChild(el)}
    clearTimeout(el._hide);el.classList.add('shown');el._hide=setTimeout(()=>el.classList.remove('shown'),3500);
  }
  
function flyToCart(added,source){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const cart=document.querySelector('#openOrder');if(!cart)return;
  const a=source && typeof source.width==='number'?source:(source||document.querySelector('#pageQtySlot'))?.getBoundingClientRect();
  const b=cart.getBoundingClientRect();if(!a||!a.width||!b.width)return;
  const plane=document.createElement('img');
  plane.className='rxde-page-flying-plane';
  plane.alt='';
  plane.src='../../assets/ui/flight-airliner.png';
  document.body.appendChild(plane);
  const src={x:a.left+a.width*.5,y:a.top+a.height*.5},dst={x:b.left+b.width*.5,y:b.top+b.height*.52};
  const from=added?src:dst,to=added?dst:src;
  const dx=to.x-from.x,dy=to.y-from.y;
  const movingLeft=dx<0;
  let planeAngle=Math.atan2(dy,Math.abs(dx))*180/Math.PI;
  planeAngle=Math.max(-38,Math.min(38,planeAngle));
  const planeFlip=movingLeft?-1:1;
  const dist=Math.max(1,Math.hypot(dx,dy)),nx=-dy/dist,ny=dx/dist;
  const swayBase=Math.max(8,Math.min(22,dist*0.028)),liftBase=Math.max(6,Math.min(16,dist*0.032));
  const duration=matchMedia('(max-width:760px)').matches?(added?2050:1900):(added?2450:2250);
  const start=performance.now(),ease=t=>1-Math.pow(1-t,3);
  const step=now=>{
    const raw=Math.min(1,(now-start)/duration),t=ease(raw),wave=Math.sin(Math.PI*t),driftSign=added?1:-1;
    const sway=swayBase*wave*driftSign,lift=liftBase*wave;
    const x=from.x+dx*t+nx*sway,y=from.y+dy*t+ny*sway-lift;
    plane.style.left=x+'px';
    plane.style.top=y+'px';
    plane.style.transform=`translate(-50%,-50%) scaleX(${planeFlip}) rotate(${planeAngle}deg) scale(${(added?0.97:1.0)+(added?-0.10:-0.14)*t+0.03*wave})`;
    plane.style.opacity=raw<.9?'1':String(1-((raw-.9)/.1));
    if(raw<1)requestAnimationFrame(step);else plane.remove();
  };
  requestAnimationFrame(step);
}

  function setQty(n,source){const before=qty();const startRect=(source||document.querySelector('#pageQtySlot'))?.getBoundingClientRect();n=Math.max(0,Math.min(999,Number(n)||0));let a=load().filter(x=>pzn(x.pzn)!==current);if(n)a.push({pzn:current,qty:n});save(a);renderCommerce();if(n!==before){flyToCart(n>before,startRect);if(n>before)showCartHint()}}
  function rub(e){return Math.floor(((Number(e)||0)*rate)/100)*100}
  function rubFinal(e){return Math.floor(((Number(e)||0)*rate)/100)*100}
  function totals(){let packs=0,itemsRub=0;for(const it of load()){const r=(window.RXDE_LOCAL_DB||[]).find(x=>pzn(x.PZN)===pzn(it.pzn));if(!r)continue;const qty=Number(it.qty)||0;itemsRub+=rub(Number(r.Price)||0)*qty;packs+=qty}const pos=load().filter(x=>Number(x.qty)>0).length;const shipping=pos?50:0;return{pos,packs,rub:itemsRub+(pos?rub(shipping):0)}}
  function origin(){try{return JSON.parse(sessionStorage.getItem('rxde:productOrigin')||'null')}catch(_){return null}}
  function back(){const o=origin();if(o?.type==='order'){sessionStorage.removeItem('rxde:productOrigin');location.href='../../index.html?openOrder=1&focus='+encodeURIComponent(current);return}if(o?.url){sessionStorage.removeItem('rxde:productOrigin');sessionStorage.setItem('rxde:returnNow','1');location.href=o.url;return}location.href='../../index.html'}
  function familyTerm(){const name=String(row?.Name_DE||'').trim();return (name.split(/\s+/)[0]||name).replace(/[®™,:;]+$/g,'')}
  function family(){const term=familyTerm();if(!term)return;try{sessionStorage.setItem('rxde:productReturn',JSON.stringify({url:location.href,scrollY:scrollY,pzn:current}))}catch(_){}location.href='../../index.html?q='+encodeURIComponent(term)}
  function order(){location.href='../../index.html?openOrder=1&focus='+encodeURIComponent(current)}
  function renderCommerce(){if(!row)return;const q=qty(),eur=Number(row.Price)||0;$('#pagePrice').textContent=money(rub(eur))+' ₽';$('#pagePriceEur').textContent=money(eur)+' €';$('#lineTotal').textContent=money(rub(eur)*q)+' ₽';$('#lineTotalEur').textContent=money(eur*q)+' €';const slot=$('#pageQtySlot');if(slot){slot.innerHTML=q?`<div class="stepper"><button id="minus" type="button">−</button><input id="qty" type="number" min="0" max="999" value="${q}"><button id="plus" type="button">+</button></div>`:`<button id="addZero" type="button" class="page-add-zero">Добавить</button>`;if(q){$('#minus').onclick=e=>setQty(qty()-1,e.currentTarget);$('#plus').onclick=e=>setQty(qty()+1,e.currentTarget);$('#qty').onchange=e=>setQty(e.target.value)}else $('#addZero').onclick=e=>setQty(1,e.currentTarget)}$('#cartStatus').textContent=q?`${q} уп. · ${money(rub(eur)*q)} ₽`:'';const t=totals();$('#orderMeta').textContent=`${t.pos} поз. · ${t.packs} уп.`;$('#orderTotal').textContent=money(t.rub)+' ₽';{const r=$('#calcRate');if(r)r.textContent=rate+' ₽/€'}}
  if(!row){$('#title').textContent='Товар не найден';$('#facts').innerHTML=`<div class="generic-fact"><span>PZN</span><b>${esc(current||'—')}</b></div>`;return}
  document.title=`${row.Name_DE||current} | RXDE`; $('#title').textContent=row.Name_DE||current; $('#titleRu').textContent=row.Name_RU||''; $('#headSubtitle').textContent=`PZN ${current}`;
  if(String(row.R)==='1')$('#rxBadge').innerHTML='<span class="rx-badge">RX</span>';
  const facts=[...(String(row.PrimaryCategory||row.Category||'').toLowerCase().includes('витамин')?[]:[['МНН',row.Substance_DE||row.Substance_RU]]),['Форма',row.Form_DE||row.Form_RU],['Дозировка',row.Dosage],['Упаковка',row.Size],['Производитель',row.Hersteller],['Категория',row.PrimaryCategory||row.Category],['PZN',current]].filter(x=>x[1]);
  $('#facts').innerHTML=facts.map(([a,b])=>`<div class="generic-fact"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('');
  const img=new Image();img.id='productImage';img.alt=row.Name_DE||current;img.src=`img/${current}.jpg`;
  img.onload=()=>{$('#mediaMain').replaceChildren(img)};img.onerror=()=>{};
  // RXDE approved photo interaction: click packshot to enlarge, click anywhere to close.
  const mediaMain=$('#mediaMain');
  if(mediaMain){
    mediaMain.addEventListener('click',()=>{
      if(!img.complete||!img.naturalWidth)return;
      let viewer=document.querySelector('.page-photo-lightbox');
      if(!viewer){
        viewer=document.createElement('div');viewer.className='page-photo-lightbox';viewer.hidden=true;
        viewer.innerHTML='<button type="button" class="page-photo-lightbox-close" aria-label="Закрыть фото">×</button><div class="page-photo-lightbox-stage"><img alt=""></div>';
        document.body.appendChild(viewer);
        viewer.addEventListener('click',()=>{viewer.hidden=true;document.body.classList.remove('page-photo-lightbox-open')});
        document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!viewer.hidden){viewer.hidden=true;document.body.classList.remove('page-photo-lightbox-open')}});
      }
      const zoom=viewer.querySelector('.page-photo-lightbox-stage img');zoom.src=img.src;zoom.alt=img.alt;
      viewer.hidden=false;document.body.classList.add('page-photo-lightbox-open');
    });
  }
  // Optional verified PDF link lives at the bottom, after the product grid and leaflet.
  // The HTML builder creates this anchor only when the physical file is present.
  // Never let optional PDF affect cart, prices, share, navigation, or photo zoom.
  const pdfAnchor=$('#pdfLink');
  if(pdfAnchor && window.RXDE_AVAILABLE_PDFS?.includes(current)){
    pdfAnchor.hidden=false;
  }
  // V3.13.126: quick share without opening a modal; copied text remains clipboard-ready.
  document.addEventListener('click',async function rxdeQuickShare(e){
    const hit=e.target.closest('#shareProduct');if(!hit)return;
    e.preventDefault();e.stopImmediatePropagation();
    const r=row||{};const clean=v=>String(v??'').trim();
    const content=['RXDE · '+clean(r.Name_DE||current),'PZN '+current,
      'Цена: '+clean(r.Price||'—')+' €',
      ...(String(cfg.publicBaseUrl??'https://rxde.online/').trim()?['Карточка: '+String(cfg.publicBaseUrl??'https://rxde.online/').replace(/\/$/,'')+'/p/'+encodeURIComponent(current)+'/']:[])].join('\n');
    let copied=false;try{await navigator.clipboard.writeText(content);copied=true}catch(_){
      try{const ta=document.createElement('textarea');ta.value=content;document.body.appendChild(ta);ta.select();copied=document.execCommand('copy');ta.remove()}catch(__){}
    }
    let toast=document.getElementById('rxdeQuickShareToast');
    if(!toast){toast=document.createElement('div');toast.id='rxdeQuickShareToast';toast.setAttribute('role','status');document.body.appendChild(toast)}
    toast.textContent=copied?'Скопировано в буфер':'Не удалось скопировать';toast.classList.add('visible');
    clearTimeout(toast._t);toast._t=setTimeout(()=>toast.classList.remove('visible'),1700);
  },true);
  const shareButton=$('#shareProduct');if(shareButton)shareButton.onclick=async()=>{
    const eur=Number(row.Price)||0;
    const date=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());
    const message=['RXDE · '+(row.Name_DE||current),'Цены на '+date,'PZN '+current,
      'Цена за 1 упаковку: '+money(eur)+' € / '+money(rub(eur))+' ₽','',
      ...(String(cfg.publicBaseUrl??'https://rxde.online/').trim()?['Подробности: '+String(cfg.publicBaseUrl??'https://rxde.online/').replace(/\/$/,'')+'/p/'+encodeURIComponent(current)+'/']:[]),
      'Цена расчётная; наличие и окончательную стоимость уточнит менеджер.','',
      ...(String(cfg.publicBaseUrl??'https://rxde.online/').trim()?['Сайт: '+String(cfg.publicBaseUrl)]:[]),
      'Email: '+String(cfg.contactEmail||'med.zakaz.de@gmail.com')].join('\n');
    let overlay=document.getElementById('rxdeShareOverlay');
    if(!overlay){overlay=document.createElement('div');overlay.id='rxdeShareOverlay';overlay.className='rxde-share-overlay';
      overlay.innerHTML='<section class="rxde-share-dialog" role="dialog" aria-modal="true" aria-label="Поделиться товаром"><button class="rxde-share-close" aria-label="Закрыть">×</button><h2>Поделиться товаром</h2><textarea readonly aria-label="Текст товара для копирования"></textarea><button class="rxde-share-copy" type="button">Скопировать текст</button><div class="rxde-share-status" role="status"></div></section>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click',event=>{if(event.target===overlay||event.target.closest('.rxde-share-close'))overlay.hidden=true});
      document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!overlay.hidden)overlay.hidden=true});
      overlay.querySelector('.rxde-share-copy').addEventListener('click',async()=>{let ok=false;const box=overlay.querySelector('textarea');
        try{await navigator.clipboard.writeText(box.value);ok=true}catch(_){box.select();try{ok=document.execCommand('copy')}catch(_){}}
        overlay.querySelector('.rxde-share-status').textContent=ok?'✓ Скопировано в буфер обмена':'Выделите и скопируйте текст вручную';});
    }
    overlay.querySelector('textarea').value=message;overlay.querySelector('.rxde-share-status').textContent='';overlay.hidden=false;
    overlay.querySelector('textarea').focus();
  };
  const heart=$('#seoHeart');if(heart){const key='rxde:favorites:pzn:v1';const read=()=>{try{return new Set(JSON.parse(localStorage.getItem(key)||'[]'))}catch(_){return new Set()}};const sync=()=>{const active=read().has(current);heart.textContent=active?'♥':'♡';heart.classList.toggle('is-favorite',active);heart.setAttribute('aria-pressed',String(active));heart.setAttribute('aria-label',active?'Удалить из избранного':'Добавить в избранное')};heart.onclick=()=>{const s=read();s.has(current)?s.delete(current):s.add(current);localStorage.setItem(key,JSON.stringify([...s]));sync()};sync()}
  $('#back').onclick=back;$('#brandHome').onclick=()=>location.href='../../index.html';$('#familySearch').onclick=family;$('#openOrder').onclick=order;$('#cartStatus').onclick=()=>{if(qty()>0)order()};const titleEl=$('#title');if(titleEl){titleEl.classList.add('generic-title-back');titleEl.setAttribute('role','button');titleEl.setAttribute('tabindex','0');titleEl.setAttribute('title','Вернуться туда, откуда открыта карточка');titleEl.onclick=back;titleEl.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();back()}}}renderCommerce();syncRate();document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncRate()});
})();
