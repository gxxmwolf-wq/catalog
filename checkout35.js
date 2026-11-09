/* RXDE V3.13.35 — integrated, one-window checkout. Does not alter product cards or admin copy. */
(function(){
'use strict';
function boot(){
 const R=window.RXDE, sheet=document.getElementById('orderSheet'), btn=document.getElementById('submitOrder');
 if(!R?.Cart||!sheet||!btn)return;
 const foot=sheet.querySelector('.sheet-footer');
 const area=document.createElement('section');area.id='rxdeInlineCheckout';area.className='rxde-inline-checkout';
 area.innerHTML=`<div class="rxde-contact-head">Контакты для заказа</div>
 <div id="rxdeInlineFields" class="rxde-inline-fields">
  <div class="rxde-inline-pair rxde-phone-main"><label for="rxdePrimaryValue">Телефон или ник</label><input id="rxdePrimaryValue" type="text" autocomplete="off" inputmode="text" placeholder="+7 999 123-45-67 или @username" maxlength="50" aria-label="Телефон или ник, для ника поддерживается Telegram"></div>
  <div class="rxde-inline-separator">и/или</div>
  <div class="rxde-inline-pair rxde-email-main" id="rxdeExtraFields"><label for="rxdeExtraValue">Email для счёта</label><input id="rxdeExtraValue" type="email" autocomplete="email" placeholder="name@example.com" maxlength="180" aria-label="Email для счёта"></div>
  <div class="rxde-phone-apps"><span>Мессенджеры:</span><label><input type="checkbox" value="Telegram">Telegram</label><label><input type="checkbox" value="WhatsApp">WhatsApp</label><label><input type="checkbox" value="MAX">MAX</label></div>
  <p id="rxdeInlineError" class="rxde-inline-error" role="status" hidden></p>
 </div><p class="rxde-contact-help">Для связи укажите номер телефона, Telegram @username и/или email. Для доставки адрес и телефон уточним отдельно.</p>`;
 foot.insertBefore(area,btn);
 // Mobile-first contacts drawer. The order list stays in view until explicitly opened.
 const contactToggle=document.createElement('button');
 contactToggle.type='button';contactToggle.id='rxdeMobileContactsToggle';
 contactToggle.className='rxde-mobile-contacts-toggle';
 contactToggle.setAttribute('aria-controls','rxdeInlineCheckout');
 contactToggle.setAttribute('aria-expanded','false');
 contactToggle.innerHTML='<span class="rxde-mobile-contacts-title">Контакты для заказа</span><span class="rxde-mobile-contacts-action">Показать контакты <span aria-hidden="true">▾</span></span>';
 foot.insertBefore(contactToggle,area);
 function setMobileContacts(open){
   sheet.classList.toggle('rxde-mobile-contacts-open',!!open);
   contactToggle.setAttribute('aria-expanded',open?'true':'false');
   sheet.classList.toggle('rxde-contacts-collapsed',!open);
   contactToggle.querySelector('.rxde-mobile-contacts-action').innerHTML=open?'Скрыть <span aria-hidden="true">▴</span>':'Оформить заказ <span aria-hidden="true">▾</span>';
 }
 // Contact and submit actions share one compact row; no duplicated guidance.
 contactToggle.querySelector('.rxde-mobile-contacts-title').textContent='Контакты для заказа';
 contactToggle.querySelector('.rxde-mobile-contacts-action').innerHTML='Оформить заказ <span aria-hidden="true">▾</span>';
 contactToggle.addEventListener('click',()=>{
   const opening=!sheet.classList.contains('rxde-mobile-contacts-open');
   setMobileContacts(opening);
   if(opening){
     // Focus during the user gesture so the mobile keyboard opens as expected.
     // Keep the form readable first; do not summon the mobile keyboard automatically.
   }
 });
 // When a card is targeted, return to the generous list viewport.
 sheet.addEventListener('rxde:focus-product',()=>setMobileContacts(false));

 const $=id=>document.getElementById(id);
 const primary=$('rxdePrimaryValue'), method={value:'phone'}, additional=$('rxdeExtraValue'), extraMethod={value:'email'};
 const fields=$('rxdeInlineFields'),error=$('rxdeInlineError'),receiptEmail={get value(){return extraMethod.value==='email'?additional.value:''},set value(v){if(extraMethod.value==='email')additional.value=v}};
 const confirmOverlay=document.createElement('div');
 confirmOverlay.id='rxdeContactConfirm';confirmOverlay.className='rxde-confirm-overlay';confirmOverlay.hidden=true;
 confirmOverlay.innerHTML=`<div class="rxde-confirm-card" role="dialog" aria-modal="true" aria-labelledby="rxdeConfirmTitle">
 <h2 id="rxdeConfirmTitle">Проверьте ваши контакты</h2>
 <p>Мы свяжемся с ВАМИ по указанным контактам. Проверьте, пожалуйста, всё ли верно.</p>
 <label class="rxde-confirm-label" for="rxdeConfirmPhoneInput">ТЕЛЕФОН ИЛИ НИК</label>
 <input id="rxdeConfirmPhoneInput" class="rxde-confirm-input" type="text" autocomplete="off" placeholder="Номер или @username">
 <div class="rxde-confirm-apps"><span>Мессенджеры:</span><label><input type="checkbox" value="Telegram"> Telegram</label><label><input type="checkbox" value="WhatsApp"> WhatsApp</label><label><input type="checkbox" value="MAX"> MAX</label></div>
 <label class="rxde-confirm-label" for="rxdeConfirmEmailInput">EMAIL ДЛЯ КОПИИ СЧЁТА</label>
 <input id="rxdeConfirmEmailInput" class="rxde-confirm-input" type="email" autocomplete="email" placeholder="name@example.com">
 <p class="rxde-confirm-note">Проверьте оба контакта и галочки. Их можно исправить прямо здесь.</p>
 <p id="rxdeConfirmError" class="rxde-confirm-error" hidden></p>
 <div class="rxde-confirm-actions"><button type="button" id="rxdeConfirmBack">Назад</button><button type="button" id="rxdeConfirmOk">ОК</button></div>
 </div>`;
 document.body.appendChild(confirmOverlay);
 let confirmed=false;
 // Keep focus inside the contact panel while a mobile keyboard opens or closes.
 const focusGuard=()=>{window.__rxdeContactEditingUntil=Date.now()+1100};
 area.addEventListener('focusin',focusGuard);
 area.addEventListener('input',focusGuard);
 area.addEventListener('focusout',focusGuard);
 area.addEventListener('keydown',e=>{if(e.key==='Escape'&&e.target.matches('input,textarea')){e.preventDefault();e.stopPropagation();e.target.blur();focusGuard()}});
 const contactValue=kind=>kind==='phone'?primary.value.trim():extraMethod.value===kind?additional.value.trim():'';
 function putContact(kind,value){
   if(kind==='phone'){primary.value=value;syncAppChecks();return true;}
   if(kind==='email'&&value){extraMethod.value='email';additional.value=value;updateHint(additional,extraMethod);return true;}
   if(kind==='email'&&!value)return true;
   const a=extraMethod.value===kind?additional:null;
   if(a){a.value=value;return true}
   if(!value)return true;
   const free=!additional.value.trim()?{sel:extraMethod,input:additional}:null;
   if(!free)return false;
   free.sel.value=kind;free.input.value=value;updateHint(free.input,free.sel);return true;
 }
 const confirmApps=[...confirmOverlay.querySelectorAll('.rxde-confirm-apps input')];
 function syncConfirmChecks(){for(const c of confirmApps)c.disabled=false}
 function openConfirmation(){
   $('rxdeConfirmPhoneInput').value=primary.value.trim();$('rxdeConfirmEmailInput').value=additional.value.trim();
   confirmApps.forEach(c=>c.checked=appChecks.some(a=>a.value===c.value&&a.checked));
   syncConfirmChecks();$('rxdeConfirmError').hidden=true;confirmOverlay.hidden=false;document.body.classList.add('rxde-confirm-locked');
 }
 function closeConfirmation(){confirmOverlay.hidden=true;document.body.classList.remove('rxde-confirm-locked')}
 $('rxdeConfirmPhoneInput').addEventListener('input',syncConfirmChecks);
 $('rxdeConfirmBack').onclick=closeConfirmation;
 $('rxdeConfirmOk').onclick=()=>{
   const ph=$('rxdeConfirmPhoneInput').value.trim(),em=$('rxdeConfirmEmailInput').value.trim();
   const fail=message=>{const el=$('rxdeConfirmError');el.textContent=message;el.hidden=false};
   
   if(em&&!valid('email',em))return fail('Проверьте адрес электронной почты.');
   if(!ph&&!em)return fail('Укажите телефон, ник или email.');
   if(!putContact('phone',ph))return fail('Не удалось обновить номер телефона.');
   additional.value=em;
   for(const c of appChecks)c.checked=!!ph&&!c.disabled&&confirmApps.some(a=>a.value===c.value&&a.checked);
   pendingPayload=null;contactSummary();closeConfirmation();confirmed=true;btn.click();
 };
 const sending=document.getElementById('rxdeSendingOverlay');
 const sendingStatus=document.getElementById('rxdeSendingStatus');
 const sendingDetail=document.getElementById('rxdeSendingDetail');
 const closeSending=()=>{sending.hidden=true;document.body.classList.remove('rxde-send-locked')};
 // Independent manual recovery if server acknowledgement cannot be verified.
 const fallbackActions=document.createElement('div');fallbackActions.id='rxdeManualFallback';fallbackActions.className='rxde-manual-fallback';fallbackActions.hidden=true;
 fallbackActions.innerHTML='<a id="rxdeFallbackEmail" class="rxde-fallback-mail" href="mailto:med.zakaz.de@gmail.com">Написать письмо напрямую</a>';
 document.getElementById('rxdeSendingClose').insertAdjacentElement('beforebegin',fallbackActions);
 let fallbackText='';
 function manualText(){
  const receipt=pendingPayload?.receiptText||R.Admin.template(null,R.Store.get().cart,'');
  const phoneNow=pendingPayload?.phone||primary.value.trim();
  const emailNow=pendingPayload?.email||additional.value.trim();
  const appsNow=pendingPayload?.messengers?.map(x=>x.name).join(', ')||[...area.querySelectorAll('.rxde-phone-apps input:checked')].map(x=>x.value).join(', ');
  const id=pendingPayload?._receiptId||'';
  return receipt+'\n\n— Контакты клиента —\nТелефон: '+(phoneNow||'не указан')+'\nEmail: '+(emailNow||'не указан')+'\nМессенджеры: '+(appsNow||'не выбраны')+(id&&!receipt.startsWith('Номер заявки:')?'\nНомер заявки: '+id:'');
 }
 function prepareFallback(){
  fallbackText=manualText();
  const id=pendingPayload?._receiptId||'заказ';
  document.getElementById('rxdeFallbackEmail').href='mailto:med.zakaz.de@gmail.com?subject='+encodeURIComponent('RXDE · Заказ '+id)+'&body='+encodeURIComponent(fallbackText);
  fallbackActions.hidden=false;
 }
 let busy=false; let pendingPayload=null;
 const contactPlaceholder=m=>m==='phone'?'+7 999 123-45-67':m==='email'?'name@example.com':m==='Telegram'?'@username или ссылка':'Номер или ссылка на профиль';
 function updateHint(input,sel){input.placeholder=contactPlaceholder(sel.value);input.type=sel.value==='email'?'email':'text'}
 function valid(m,v){v=String(v||'').trim();if(!v)return false;if(m==='email')return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);return true}
 function contactSummary(){const ok=(valid('phone',primary.value.trim())||valid('telegram',primary.value.trim()))||valid(extraMethod.value,additional.value.trim());btn.classList.toggle('rxde-contact-ready',ok);btn.disabled=!!busy;btn.setAttribute('aria-disabled',ok?'false':'true');btn.title=ok?'Отправить заявку':'Нажмите, чтобы указать контакты';return ok}
 const appChecks=[...area.querySelectorAll('.rxde-phone-apps input')];function syncAppChecks(){for(const c of appChecks)c.disabled=false}
 primary.addEventListener('input',()=>{error.hidden=true;pendingPayload=null;syncAppChecks();contactSummary()});
 additional.addEventListener('input',()=>{error.hidden=true;pendingPayload=null;contactSummary()});

 updateHint(additional,extraMethod);syncAppChecks();contactSummary();
 btn.innerHTML='<span class="rxde-parcel-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M5 10.5 16 5l11 5.5v12L16 28 5 22.5z"/><path d="M5 10.5 16 16l11-5.5M16 16v12M11 7.5l11 5.5"/><path d="M20 19h3m-1.5-1.5v3"/></svg></span><span>Отправить менеджеру</span>';btn.classList.add('rxde-inline-submit');btn.disabled=false;btn.setAttribute('aria-disabled','true');
 document.getElementById('rxdeSendingClose').addEventListener('click',closeSending);
 const direct=document.createElement('a');direct.className='rxde-inline-direct';direct.href='mailto:med.zakaz.de@gmail.com';direct.textContent='Задать вопрос по email';direct.title='Вопрос или обращение без оформления заявки';foot.appendChild(direct);
 btn.onclick=async()=>{
  if(busy)return;
   if(!contactSummary()){setMobileContacts(true);requestAnimationFrame(()=>primary.focus({preventScroll:true}));return;}
   const t=R.Cart.totals();
  if(!t.positions){R.Utils.toast?.('Сначала положите товар в корзину');return}
  const v=primary.value.trim(),m=method.value,extraOn=true,v2=additional.value.trim(),m2=extraMethod.value;
  if(!v&&!valid(m2,v2)){error.classList.remove('neutral');error.hidden=false;error.textContent=(v||v2)?'Проверьте контакт.':'Укажите телефон, ник или email.';area.classList.remove('rxde-attention');void area.offsetWidth;area.classList.add('rxde-attention');primary.focus({preventScroll:true});return}
  
  if(v2&&!valid(m2,v2)){error.hidden=false;error.textContent='Проверьте адрес электронной почты.';additional.focus({preventScroll:true});return}
  if(receiptEmail.value.trim()&&!valid('email',receiptEmail.value.trim())){error.hidden=false;error.textContent='Проверьте email для копии счёта.';additional.focus({preventScroll:true});return}
  if(!window.RXDE_DELIVERY?.isConfigured()){error.hidden=false;error.textContent='Приём заявок пока не подключён. Можно написать письмо самостоятельно.';return}
  const entries=[];if(v)entries.push({method:'phone',value:v});if(v2)entries.push({method:m2,value:v2});
  const phone=entries.find(x=>x.method==='phone')?.value||'';
  const email=entries.find(x=>x.method==='email')?.value||'';
  const phoneApps=v?[...area.querySelectorAll('.rxde-phone-apps input:checked')].map(x=>x.value):[];
  const telegramNick=v;
  const messengers=phoneApps.map(name=>({name,contact:v}));
  const items=R.Store.get().cart.map(it=>{const p=R.Products.byPzn.get(it.pzn);return {pzn:it.pzn,qty:it.qty,eur:p?.eur||0,name:p?.name||''}});
  if(!confirmed){openConfirmation();return;}confirmed=false;
  busy=true;btn.disabled=true;
  fallbackActions.hidden=true;sending.dataset.status='pending';sending.hidden=false;document.body.classList.add('rxde-send-locked');
  sendingStatus.textContent='Отправляем заявку';
  sendingDetail.textContent='Сохраняем заказ и проверяем запись в Google Таблице. Не закрывайте страницу.';
  error.hidden=true;
  document.getElementById('rxdeSendingClose').hidden=true;
  try{
    await R.RateGuard?.refresh({reason:'submit',force:true,notifyError:false});
    const totals=R.Cart.totals(),rate=R.Store.get().rate;
    // One canonical receipt: exactly the same template used by the secret/admin copy field.
    // It includes manufacturer, PZN, fixed prices, shipping, arithmetic and public cart link.
    const receiptText=R.Admin.template(null,R.Store.get().cart,'');
    if(!receiptText || !receiptText.includes('Тариф почты из Европы'))throw new Error('Не удалось сформировать текстовый счёт');
    if(!pendingPayload)pendingPayload={type:'order',phone,email,messengers,messenger:messengers.map(x=>x.name).join(', '),messengerContact:messengers.map(x=>x.name+': '+x.contact).join(' | '),receiptText,question:'',items,positions:totals.positions,packs:totals.packs,totalEur:totals.eur,totalRub:totals.rub,rate,source:location.href.slice(0,200)};
    sendingStatus.textContent='Ожидаем подтверждение';
    sendingDetail.textContent='Это может занять некоторое время: сервер сохраняет заявку, затем сайт сверяет её номер. Повторно нажимать не нужно.';
    const result=await window.RXDE_DELIVERY.send(pendingPayload);
    pendingPayload=null;
    const done=$('orderAcceptedBackdrop');$('orderAcceptedId').textContent='Номер заявки: '+result.id;
    $('acceptedEmailChoice').hidden=true;$('acceptedEmailStatus').textContent='';
    $('acceptedOk').textContent='Вернуться в каталог';$('acceptedOk').onclick=()=>{
      done.hidden=true;
      // Return to the product grid without losing the already confirmed order.
      R.Store.set({orderOpen:false});
      document.body.style.overflow='';
      const search=document.querySelector('#searchInput');
      // Clear only the category selection if it is empty; keep the user's browsing context.
      const grid=document.querySelector('#catalogGrid, #productsGrid, #productGrid, .products-grid, .catalog-products, #catalogResults, #catalog') || document.querySelector('.catalog-hero');
      if(grid){const top=grid.getBoundingClientRect().top+window.scrollY-140;window.scrollTo({top:Math.max(0,top),behavior:'auto'});}
      else window.scrollTo({top:0,behavior:'auto'});
      window.dispatchEvent(new Event('resize'));
    };
    $('orderBackdrop').hidden=true;R.Store.set({orderOpen:false});document.body.style.overflow='';done.hidden=false;
    error.hidden=true;closeSending();
  }catch(err){prepareFallback();sending.dataset.status='error';sendingStatus.textContent='Отправка не удалась';sendingDetail.textContent='Напишите нам напрямую — обязательно свяжемся с вами.';document.getElementById('rxdeSendingClose').hidden=false;error.classList.remove('neutral');error.textContent='Напишите нам напрямую по ссылке.';error.hidden=false;}
  finally{busy=false;btn.innerHTML='<span class="rxde-parcel-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M5 10.5 16 5l11 5.5v12L16 28 5 22.5z"/><path d="M5 10.5 16 16l11-5.5M16 16v12M11 7.5l11 5.5"/><path d="M20 19h3m-1.5-1.5v3"/></svg></span><span>Отправить менеджеру</span>';contactSummary();}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
