(function(){
  const KEY='de_cart_v2';
  const q=s=>document.querySelector(s);
  const num=v=>{const n=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(n)?n:0};
  const pzn=v=>String(v??'').trim().padStart(8,'0');
  const money=n=>Math.round(num(n)).toLocaleString('ru-RU');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const haptic=kind=>{try{navigator.vibrate?.(kind==='remove'?[18]:kind==='add'?[10]:[6])}catch(_){}};
  const cfg=window.RXDE_CONFIG||{},rates=window.RXDE_RATES||{};
  // Keep product pages on the exact same pricing source as the main catalog.
  // Google Sheet settings_1!C2 is primary; rates.js is only an offline/failure fallback.
  let rate=Math.floor((num(rates.cbrRate)||num(cfg.fallbackCbrRate)||100)+(num(cfg.rateMarkupRub)||0));
  let rateSource=String(rates.source||'fallback').toUpperCase();
  const shipping=num(cfg.shippingEur)||50;
  const current=pzn(document.body.dataset.pzn);
  const rows=Array.isArray(window.RXDE_LOCAL_DB)?window.RXDE_LOCAL_DB:[];
  const db=new Map(rows.map(x=>[pzn(x.PZN),x]));
  const currentRow=db.get(current);
  const NAV_KEY='rxde:navigationTrail:v1';
  const RECENT_KEY='rxde:recentVisits:v2';
  function navLoad(){try{const x=JSON.parse(sessionStorage.getItem(NAV_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
  function navSave(a){try{sessionStorage.setItem(NAV_KEY,JSON.stringify(a.slice(-8)))}catch(_){}}
  function recentLoad(){try{const x=JSON.parse(sessionStorage.getItem(RECENT_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
  function recentSave(a){try{sessionStorage.setItem(RECENT_KEY,JSON.stringify(a.slice(-14)))}catch(_){}}
  function entrySig(x){if(!x)return'';const st=x.state||{};return [x.kind||'',x.label||'',x.url||'',st.query||'',st.category||'',st.subcategory||'',(st.expanded||[]).join(',')].join('|')}
  function recentRecord(entry){if(!entry)return;const a=recentLoad(),sig=entrySig(entry);for(let i=a.length-1;i>=0;i--){if(entrySig(a[i])===sig)a.splice(i,1)}a.push(entry);recentSave(a)}
  function currentEntry(){return{kind:'page',label:String(currentRow?.Name_DE||'Товар'),url:location.href,scrollY:window.scrollY||0}}
  function navPushCurrent(){const a=navLoad(),e=currentEntry(),last=a[a.length-1];if(!(last&&last.kind===e.kind&&last.url===e.url))a.push(e);navSave(a)}
  function navGo(x){if(!x)return;if((x.kind==='catalog'||x.kind==='product-inline')&&x.state){try{sessionStorage.setItem('rxde:navRestore',JSON.stringify(x))}catch(_){}location.href='../../index.html';return}if(x.url)location.href=x.url}
  function renderProductFlow(){
    const a=navLoad(),prev=a[a.length-1],back=q('#productFlowBack'),lab=q('#productFlowBackLabel'),menu=q('#productFlowHistoryMenu'),trail=q('#productMobileRecentTrail');
    const realCats=[currentRow?.PrimaryCategory,currentRow?.Category].map(x=>String(x||'').trim()).filter(Boolean);
    const prevState=prev?.state||{};
    const prevCategory=String(prevState.subcategory||prevState.category||'').trim();
    const prevIsSearch=Boolean(String(prevState.query||'').trim()) || String(prev?.label||'').startsWith('Поиск');
    const prevMatchesProduct=!prevCategory || realCats.includes(prevCategory) || prevIsSearch || prev?.kind==='page' || prev?.kind==='product-inline';
    if(lab)lab.textContent=(window.matchMedia?.('(max-width:760px)').matches&&sessionStorage.getItem('rxde:catalogReturn'))?'К товару в списке':((prev&&prevMatchesProduct)?(prev.label||'К результатам поиска'):'К каталогу');
    if(back)back.disabled=!prev&&!sessionStorage.getItem('rxde:catalogReturn');
    const visits=recentLoad(),currentLabel=String(currentRow?.Name_DE||'Товар'),current=currentEntry(),currentSig=entrySig(current);
    const candidates=visits.filter(x=>entrySig(x)!==currentSig);
    if(trail){
      const rr=candidates.slice(-3);
      trail.innerHTML=`<span class="recent-clock-mark">◷</span>${rr.map(x=>{const idx=visits.indexOf(x),mark=x.kind==='page'?'↗':x.kind==='product-inline'?'▣':'';return `<button type="button" data-product-recent-index="${idx}">${mark?`<span class="recent-kind-mark">${mark}</span>`:''}${esc(x.label)}</button>`}).join('<span class="recent-sep">›</span>')}<button type="button" class="recent-more" data-product-mobile-more>…</button>`;
    }
    if(menu){
      const recent=candidates.slice(-7).reverse();
      const icon=x=>x.kind==='page'?'↗':x.kind==='product-inline'?'▣':String(x.label||'').startsWith('Поиск')?'⌕':x.label==='Главная'?'⌂':'•';
      const now=`<div class="flow-history-head"><span>Сейчас</span><strong>${esc(currentLabel)}</strong></div>`;
      const rows=recent.length?recent.map(x=>{const idx=visits.indexOf(x);return `<button type="button" data-product-recent-menu="${idx}"><span class="history-kind">${icon(x)}</span><span class="history-copy"><strong>${esc(x.label)}</strong><small>${x.kind==='product-inline'?'раскрытый товар':x.kind==='page'?'полная карточка':'недавний переход'}</small></span></button>`}).join(''):'<span class="history-empty">История пока пуста</span>';
      menu.innerHTML=now+`<div class="flow-history-list">${rows}</div>`;
    }
  }

  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
  function save(c){localStorage.setItem(KEY,JSON.stringify(c))}
  function currentQty(){return load().find(x=>pzn(x.pzn)===current)?.qty||0}
  function rub(eur){return Math.floor((num(eur)*rate)/100)*100}
  function flightLayer(){
    let layer=q('#rx-product-flight-layer');
    if(layer)return layer;
    layer=document.createElement('div');layer.id='rx-product-flight-layer';layer.setAttribute('aria-hidden','true');document.body.appendChild(layer);return layer;
  }
  
function flyPagePlane(direction='up',source=null){
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const fromNode=source||q('#pageQtyStepper')||q('.stepper')||q('#addZero'),dock=q('#openOrder');
  if(!fromNode||!dock)return;
  const a=fromNode.getBoundingClientRect(),b=dock.getBoundingClientRect();
  if(!a.width||!b.width)return;
  const src={x:a.left+a.width*.5,y:a.top+a.height*.5},dst={x:b.left+b.width*.5,y:b.top+b.height*.52};
  const from=direction==='down'?dst:src,to=direction==='down'?src:dst;
  const dx=to.x-from.x,dy=to.y-from.y;
  const plane=document.createElement('span');
  plane.className='product-page-plane';
  plane.innerHTML='<img src="../../assets/ui/flight-airliner.png" alt="" aria-hidden="true">';
  flightLayer().appendChild(plane);
  const movingLeft=dx<0;
  let planeAngle=Math.atan2(dy,Math.abs(dx))*180/Math.PI;
  planeAngle=Math.max(-38,Math.min(38,planeAngle));
  const planeFlip=movingLeft?-1:1;
  const dist=Math.max(1,Math.hypot(dx,dy));
  const nx=-dy/dist,ny=dx/dist;
  const swayBase=Math.max(8,Math.min(22,dist*0.028));
  const liftBase=Math.max(6,Math.min(16,dist*0.032));
  const duration=window.matchMedia?.('(max-width:760px)').matches?(direction==='down'?1900:2050):(direction==='down'?2250:2450);
  const start=performance.now();
  const ease=t=>1-Math.pow(1-t,3);
  const frame=now=>{
    const raw=Math.min(1,(now-start)/duration);
    const t=ease(raw);
    const wave=Math.sin(Math.PI*t);
    const driftSign=direction==='down'?-1:1;
    const sway=swayBase*wave*driftSign;
    const lift=liftBase*wave;
    const x=from.x + dx*t + nx*sway;
    const y=from.y + dy*t + ny*sway - lift;
    const scale=(direction==='down'?1.0:.97) + (direction==='down'?-0.14:-0.10)*t + 0.03*wave;
    const opacity=raw<.90?1:1-((raw-.90)/.10);
    plane.style.left=`${x}px`;
    plane.style.top=`${y}px`;
    plane.style.transform=`translate(-50%,-50%) scaleX(${planeFlip}) rotate(${planeAngle}deg) scale(${scale})`;
    plane.style.opacity=String(Math.max(0,opacity));
    if(raw<1)requestAnimationFrame(frame);else plane.remove();
  };
  requestAnimationFrame(frame);
}

  function setQty(v,source=null){
    const before=currentQty();
    v=Math.max(0,Math.min(999,parseInt(v,10)||0));
    let c=load().filter(x=>pzn(x.pzn)!==current);
    if(v)c.push({pzn:current,qty:v});
    save(c);render();pulseOrder();if(v!==before){flyPagePlane(v>before?'up':'down',source);haptic(v>before?'add':'remove')}
  }
  function totals(){
    const cart=load().filter(x=>Number(x.qty)>0);let packs=0,eur=0,itemsRub=0;
    for(const it of cart){const r=db.get(pzn(it.pzn));if(!r)continue;const n=Math.max(0,parseInt(it.qty,10)||0),unitEur=num(r.Price);packs+=n;eur+=unitEur*n;itemsRub+=rub(unitEur)*n}
    const shippingRub=packs?rub(shipping):0;if(packs)eur+=shipping;
    return{cart,pos:cart.length,packs,eur,rub:itemsRub+shippingRub};
  }
  function orderPreview(t){
    if(!t.pos)return'<div class="preview-empty">Заказ пока пуст</div>';
    const lines=t.cart.slice(0,3).map(it=>{const r=db.get(pzn(it.pzn));if(!r)return'';return `<div class="preview-row"><span>${esc(r.Name_DE||it.pzn)} ×${it.qty}</span><b>${money(rub(num(r.Price))*it.qty)} ₽</b></div>`}).join('');
    const more=t.pos>3?`<div class="preview-row"><span>Ещё ${t.pos-3} поз.</span><b></b></div>`:'';
    return `${lines}${more}<div class="preview-total"><span>${t.pos} поз. · ${t.packs} уп.</span><b>${money(t.rub)} ₽</b></div>`;
  }
  function render(){
    const n=currentQty(),t=totals(),eur=num(currentRow?.Price),unitRub=rub(eur),lineEur=eur*n,lineRub=unitRub*n;
    if(q('#qty'))q('#qty').value=n;
    if(q('#minus'))q('#minus').disabled=n<=0;
    if(q('#pagePrice'))q('#pagePrice').textContent=`${money(rub(eur))} ₽`;
    if(q('#pagePriceEur'))q('#pagePriceEur').textContent=`${money(eur)} €`;
    if(q('#lineTotal'))q('#lineTotal').textContent=n?`${money(lineRub)} ₽`:'0 ₽';
    if(q('#lineTotalEur'))q('#lineTotalEur').textContent=n?`${money(lineEur)} €`:'0 €';
    const mark=q('#qtyMark');if(mark){mark.hidden=!n;mark.textContent=n?`×${n}`:'';}
    const status=q('#cartStatus'),statusText=q('#cartStatusText');if(status){status.classList.toggle('empty',!n);status.disabled=!n;}if(statusText)statusText.innerHTML=n?`${n} уп. · ${money(lineRub)} ₽`:'&nbsp;';
    const orderDock=q('#openOrder');
    if(orderDock)orderDock.classList.toggle('contact-ready',!t.pos);
    if(q('#orderMeta'))q('#orderMeta').textContent=`${t.pos} поз. · ${t.packs} уп.`;
    if(q('#orderTotal'))q('#orderTotal').textContent=`${money(t.rub)} ₽`;
    if(q('#orderPreview'))q('#orderPreview').innerHTML='';
    if(q('#calcRate'))q('#calcRate').textContent=`${rate} ₽/€`;
    document.querySelectorAll('[data-related-pzn]').forEach(a=>{const r=db.get(pzn(a.dataset.relatedPzn));if(!r)return;const e=num(r.Price);const pr=a.querySelector('.related-price');if(pr){pr.querySelectorAll('.related-unit,.related-better').forEach(x=>x.remove());pr.querySelector('strong').textContent=`${money(rub(e))} ₽`;pr.querySelector('span').textContent=`${money(e)} €`;const pack=parseInt(String(r.Size||'').match(/\d+/)?.[0]||'0',10);const curPack=parseInt(String(currentRow?.Size||'').match(/\d+/)?.[0]||'0',10);const sameDose=String(r.Dosage||'').replace(/\s+/g,'').toLowerCase()===String(currentRow?.Dosage||'').replace(/\s+/g,'').toLowerCase();if(pack&&sameDose){const per=Math.round(rub(e)/pack);const unit=document.createElement('small');unit.className='related-unit';unit.textContent=`${money(per)} ₽ / ед.`;pr.appendChild(unit);if(curPack&&rub(e)/pack < rub(num(currentRow?.Price))/curPack){const b=document.createElement('small');b.className='related-better';b.textContent='выгоднее за единицу';pr.appendChild(b);}}}});
  }
  let rateCheckBusy=false,rateCheckLast=0;
  const RATE_CHECK_MS=Number(cfg.googleRateRefreshMs)||6*60*60*1000;

  function loadGoogleRate(){
    const id=String(cfg.googleRateSpreadsheetId||'').trim();
    const sheet=String(cfg.googleRateSheet||'settings_1').trim();
    const cell=String(cfg.googleRateCell||'C2').trim();
    if(!id)return Promise.reject(new Error('google-rate-not-configured'));
    return new Promise((resolve,reject)=>{
      const cb='__rxdeProductGoogleRate_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const sc=document.createElement('script');
      let done=false;
      const finish=(err,val)=>{
        if(done)return; done=true; clearTimeout(timeout);
        try{delete window[cb]}catch(_){window[cb]=undefined}
        sc.remove(); err?reject(err):resolve(val);
      };
      window[cb]=payload=>{
        try{
          const raw=payload?.table?.rows?.[0]?.c?.[0]?.v ?? payload?.table?.rows?.[0]?.c?.[0]?.f;
          const base=Number(String(raw??'').replace(',','.'));
          if(!Number.isFinite(base)||base<20||base>300)throw new Error('invalid-google-rate');
          finish(null,base);
        }catch(e){finish(e)}
      };
      const u=new URL(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq`);
      u.searchParams.set('sheet',sheet);
      u.searchParams.set('range',cell);
      u.searchParams.set('tqx',`out:json;responseHandler:${cb}`);
      u.searchParams.set('_',String(Date.now()));
      sc.src=u.href; sc.async=true; sc.referrerPolicy='no-referrer';
      sc.onerror=()=>finish(new Error('google-rate-load-failed'));
      const timeout=setTimeout(()=>finish(new Error('google-rate-timeout')),5000);
      document.head.appendChild(sc);
    });
  }

  function loadRatesJsFallback(){
    return new Promise((resolve,reject)=>{
      const prev=window.RXDE_RATES,sc=document.createElement('script'),u=new URL('../../rates.js',document.baseURI);
      u.searchParams.set('rxde_rate_check',String(Date.now())); sc.src=u.href; sc.async=true;
      sc.onload=()=>{sc.remove();const rr=window.RXDE_RATES||prev||{};const base=num(rr.cbrRate);base?resolve(base):reject(new Error('rate-fallback-empty'))};
      sc.onerror=()=>{sc.remove();window.RXDE_RATES=prev;reject(new Error('rate-fallback-load-failed'))};
      document.head.appendChild(sc);
    });
  }

  async function refreshRate(force=false){
    const now=Date.now();if(rateCheckBusy||(!force&&now-rateCheckLast<45_000))return false;
    rateCheckBusy=true; rateCheckLast=now;
    try{
      let base;
      try{base=await loadGoogleRate(); rateSource='GOOGLE'}
      catch(_){base=await loadRatesJsFallback(); rateSource='RATES_JS'}
      const next=Math.floor(base+(num(cfg.rateMarkupRub)||0));
      const changed=next!==rate; rate=next; render(); if(changed)haptic('tick');
      return true;
    }catch(_){return false}
    finally{rateCheckBusy=false}
  }
  // Refresh immediately on product-page load so it never intentionally runs from a stale snapshot.
  refreshRate(true);
  setInterval(()=>refreshRate(false),RATE_CHECK_MS);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && Date.now()-rateCheckLast>=RATE_CHECK_MS)refreshRate(false)});
  window.addEventListener('focus',()=>{if(Date.now()-rateCheckLast>=RATE_CHECK_MS)refreshRate(false)},{passive:true});

  function rememberProductReturn(){
    try{sessionStorage.setItem('rxde:productReturn',JSON.stringify({url:location.href,scrollY:scrollY}))}catch(_){}
  }
  function goHome(){location.href='../../index.html'}
  function goSearch(){
    try{const o=JSON.parse(sessionStorage.getItem('rxde:productOrigin')||'null');if(o?.type==='order'){sessionStorage.removeItem('rxde:productOrigin');location.href='../../index.html?openOrder=1&focus='+encodeURIComponent(o.pzn||current);return}if(o?.url){sessionStorage.removeItem('rxde:productOrigin');sessionStorage.setItem('rxde:returnNow','1');location.href=o.url;return}}catch(_){}
    const a=navLoad(),x=a.pop();if(x){navSave(a);navGo(x);return}
    try{const r=JSON.parse(sessionStorage.getItem('rxde:catalogReturn')||'null');if(r?.url){sessionStorage.setItem('rxde:returnNow','1');location.href=r.url;return}}catch(_){}
    location.href='../../index.html';
  }
  function goOrder(){rememberProductReturn();location.href='../../index.html?openOrder=1'}
  function pulseOrder(){const el=q('#openOrder');if(!el)return;el.animate([{transform:'scale(1)'},{transform:'scale(.97)'},{transform:'scale(1)'}],{duration:190,easing:'ease-out'}).catch?.(()=>{})}


  function familySearchTerm(){
    const name=String(currentRow?.Name||currentRow?.name||q('h1')?.textContent||'').replace(/\bRX\b/g,'').trim();
    const token=(name.split(/\s+/)[0]||'').replace(/[®™,:;]+$/g,'').trim();
    return token||name;
  }
  function goFamilySearch(){
    const term=familySearchTerm();
    if(!term)return;
    try{sessionStorage.setItem('rxde:productReturn',JSON.stringify({url:location.href,scrollY:scrollY,pzn:current}))}catch(_){}
    location.href='../../index.html?q='+encodeURIComponent(term);
  }
  const heading=q('.product-heading-main');
  if(heading && !q('#pageFamilySearch')){
    const b=document.createElement('button');
    b.type='button';b.id='pageFamilySearch';b.className='page-family-search';b.setAttribute('aria-label','Найти варианты по названию');b.title='Найти варианты по названию; повторное нажатие в поиске возвращает назад';b.textContent='⌕';
    heading.appendChild(b);b.addEventListener('click',goFamilySearch);
  }

  q('#minus')?.addEventListener('click',e=>setQty(currentQty()-1,e.currentTarget));
  q('#plus')?.addEventListener('click',e=>setQty(currentQty()+1,e.currentTarget));
  q('#qty')?.addEventListener('change',e=>setQty(e.target.value,e.currentTarget));
  q('#back')?.addEventListener('click',goSearch);
  q('#brandHome')?.addEventListener('click',goHome);
  q('#openOrder')?.addEventListener('click',()=>{refreshRate(true).finally(goOrder)});
  q('#cartStatus')?.addEventListener('click',()=>{if(currentQty()>0)refreshRate(true).finally(goOrder)});
  q('#productImage')?.addEventListener('error',e=>e.currentTarget.closest('.media-main')?.classList.add('image-failed'));

  // v1.190 — the full page is an information page: show every official-info section
  // immediately. The text remains real DOM content and can still be collapsed manually.
  document.querySelectorAll('.info-list details.info-section').forEach(d=>{d.open=true});

  // Same photo behaviour as the catalog: click the main packshot to inspect it centered.
  const pageImage=q('#productImage');
  if(pageImage){
    const openImage=()=>{
      if(!pageImage.src || pageImage.closest('.media-main')?.classList.contains('image-failed'))return;
      let lb=document.querySelector('.page-photo-lightbox');
      if(!lb){
        lb=document.createElement('div');
        lb.className='page-photo-lightbox';
        lb.hidden=true;
        lb.innerHTML='<button class="page-photo-lightbox-close" type="button" aria-label="Закрыть фото">×</button><div class="page-photo-lightbox-stage"><img alt=""></div>';
        document.body.appendChild(lb);
        const close=()=>{lb.hidden=true;document.body.classList.remove('page-photo-lightbox-open')};
        lb.addEventListener('click',e=>{if(e.target===lb || e.target.closest('.page-photo-lightbox-close'))close()});
        document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!lb.hidden)close()});
      }
      const im=lb.querySelector('img');im.src=pageImage.src;im.alt=pageImage.alt||'';
      lb.hidden=false;document.body.classList.add('page-photo-lightbox-open');
    };
    pageImage.addEventListener('click',openImage);
    pageImage.closest('.media-main')?.addEventListener('click',e=>{if(e.target===pageImage)return;openImage()});
  }
  q('#pagePznCopy')?.addEventListener('click',async()=>{const text=current;try{await navigator.clipboard.writeText(text)}catch(_){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}haptic('tick');const b=q('#pagePznCopy');if(b){const old=b.textContent;b.textContent='✓';setTimeout(()=>b.textContent=old,900)}});
  q('#productFlowBack')?.addEventListener('click',goSearch);
  const fullHeading=q('.product-heading-main h1');
  if(fullHeading){
    fullHeading.classList.add('product-title-back');
    fullHeading.setAttribute('role','button');
    fullHeading.setAttribute('tabindex','0');
    fullHeading.setAttribute('title','Вернуться туда, откуда открыта карточка');
    fullHeading.addEventListener('click',goSearch);
    fullHeading.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();goSearch()}});
  }
  q('#productFlowHistoryToggle')?.addEventListener('click',()=>{const m=q('#productFlowHistoryMenu'),b=q('#productFlowHistoryToggle');if(!m)return;const open=m.hidden;m.hidden=!open;b?.setAttribute('aria-expanded',String(open))});
  {const b=q('#productFlowHistoryToggle'),m=q('#productFlowHistoryMenu');if(b&&m){let timer=0;const hoverCapable=()=>window.matchMedia?.('(hover:hover) and (pointer:fine)').matches;const open=()=>{clearTimeout(timer);m.hidden=false;b.setAttribute('aria-expanded','true')};const close=()=>{clearTimeout(timer);timer=setTimeout(()=>{m.hidden=true;b.setAttribute('aria-expanded','false')},180)};b.addEventListener('mouseenter',()=>{if(hoverCapable())timer=setTimeout(open,140)});b.addEventListener('mouseleave',()=>{if(hoverCapable())close()});m.addEventListener('mouseenter',()=>{if(hoverCapable())open()});m.addEventListener('mouseleave',()=>{if(hoverCapable())close()})}}
  q('#productMobileRecentTrail')?.addEventListener('click',e=>{if(e.target.closest('[data-product-mobile-more]')){const m=q('#productFlowHistoryMenu'),b=q('#productFlowHistoryToggle');if(m){const open=m.hidden;m.hidden=!open;b?.setAttribute('aria-expanded',String(open))}return}const b=e.target.closest('[data-product-recent-index]');if(!b)return;const visits=recentLoad(),x=visits[Number(b.dataset.productRecentIndex)];if(x)navGo(x)});
  q('#productFlowHistoryMenu')?.addEventListener('click',e=>{const b=e.target.closest('[data-product-recent-menu]');if(!b)return;const visits=recentLoad(),x=visits[Number(b.dataset.productRecentMenu)];if(x)navGo(x)});
  document.querySelectorAll('[data-related-pzn]').forEach(a=>{
    const rp=pzn(a.dataset.relatedPzn),pages=window.RXDE_PRODUCT_PAGES||{},target=pages[rp];
    if(target){
      a.href='../../'+String(target).replace(/^\/+/, '');
      a.title='Открыть полную карточку товара';
    }
    a.addEventListener('click',()=>{navPushCurrent();recentRecord(currentEntry())});
  });
  recentRecord(currentEntry());
  renderProductFlow();
  render();
})();

/* v0.54 — pin product navigation directly below the sticky product header. */
(()=>{
  const root=document.documentElement;
  const header=document.querySelector('.product-head');
  if(!header)return;
  const sync=()=>root.style.setProperty('--rxde-product-head-h',`${Math.ceil(header.getBoundingClientRect().height)}px`);
  sync();
  window.addEventListener('resize',sync,{passive:true});
  window.addEventListener('orientationchange',sync,{passive:true});
  if('ResizeObserver' in window)new ResizeObserver(sync).observe(header);
  requestAnimationFrame(sync);
})();
