/* RXDE V3.13.35 — integrated, one-window checkout. Does not alter product cards or admin copy. */
(function(){
'use strict';
function boot(){
 const R=window.RXDE, sheet=document.getElementById('orderSheet'), btn=document.getElementById('submitOrder');
 if(!R?.Cart||!sheet||!btn)return;
 const foot=sheet.querySelector('.sheet-footer');
 const buildLabel=document.getElementById('rxdeFooterVersion');
 if(buildLabel)buildLabel.textContent='v2 · 11.11.2026-12';
 const area=document.createElement('section');area.id='rxdeInlineCheckout';area.className='rxde-inline-checkout';
 area.innerHTML=`<div class="rxde-contact-head">Контакты для заказа</div>
 <div id="rxdeInlineFields" class="rxde-inline-fields">
  <div class="rxde-inline-pair rxde-phone-main"><label for="rxdePrimaryValue">Телефон или ник</label><input id="rxdePrimaryValue" type="text" autocomplete="off" inputmode="text" placeholder="+7 999 123-45-67 или @username" maxlength="50" aria-label="Телефон или ник, для ника поддерживается Telegram"></div>
  <div class="rxde-phone-apps"><span>Где вам написать?</span><label><input type="checkbox" value="Telegram">Telegram</label><label><input type="checkbox" value="WhatsApp">WhatsApp</label><label><input type="checkbox" value="MAX">MAX</label></div>
  <div class="rxde-inline-pair rxde-email-main" id="rxdeExtraFields"><label for="rxdeExtraValue">Email для счёта и связи</label><input id="rxdeExtraValue" type="email" autocomplete="email" placeholder="name@example.com" maxlength="180" aria-label="Email для счёта и связи"></div>
  <p id="rxdeInlineError" class="rxde-inline-error" role="status" hidden></p>
 </div><p class="rxde-contact-help">Для связи укажите номер телефона, Telegram @username и/или email. Для доставки адрес и телефон уточним отдельно.</p>`;
 // Two real mutually exclusive steps: cart -> contact sheet. Existing fields
 // and submit button are moved, not cloned, keeping all validation/send handlers.
 const contactToggle=document.createElement('button');
 contactToggle.type='button';contactToggle.id='rxdeMobileContactsToggle';
 contactToggle.className='rxde-mobile-contacts-toggle';
 contactToggle.textContent='Оформить заказ →';
 foot.insertBefore(contactToggle,btn);
 const flow=document.createElement('div');
 flow.id='rxdeCheckoutFlow10';flow.hidden=true;
 flow.innerHTML='<section class="rxde-checkout-card10" role="dialog" aria-modal="true" aria-label="Оформление заказа"><button type="button" id="rxdeCheckoutBack10" class="rxde-checkout-back10">← Проверить состав заказа <small id="rxdeCheckoutSummary10"></small></button><h2>Контакты для заказа</h2><div id="rxdeCheckoutContent10" class="rxde-checkout-content10"></div><div class="rxde-checkout-actions10" id="rxdeCheckoutActions10"></div></section>';
 document.body.appendChild(flow);
 flow.querySelector('#rxdeCheckoutContent10').appendChild(area);
 flow.querySelector('#rxdeCheckoutActions10').appendChild(btn);
 const flowCss=document.createElement('style');flowCss.id='rxdeCheckoutStyles10';
 flowCss.textContent=`
 #rxdeCheckoutFlow10[hidden]{display:none!important}
 html body #rxdeCheckoutFlow10:not([hidden]){display:flex!important;position:fixed!important;left:0!important;right:0!important;bottom:auto!important;top:var(--rxde-flow-top,0px)!important;height:var(--rxde-flow-height,100dvh)!important;z-index:2147483400!important;align-items:flex-end!important;justify-content:center!important;background:rgba(20,40,50,.58)!important;box-sizing:border-box!important}
 html body #rxdeCheckoutFlow10 .rxde-checkout-card10{display:flex!important;flex-direction:column!important;position:relative!important;box-sizing:border-box!important;width:min(100%,540px)!important;height:90%!important;max-height:90%!important;min-height:0!important;overflow:hidden!important;margin:0!important;background:#fff!important;color:#254050!important;border-radius:18px 18px 0 0!important;box-shadow:0 12px 36px #14263144!important}
 html body #rxdeCheckoutFlow10 .rxde-checkout-back10{display:flex!important;flex:0 0 auto!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;min-height:54px!important;width:100%!important;padding:11px 15px!important;background:#edf7fb!important;color:#24536a!important;border:0!important;border-bottom:1px solid #cbdde5!important;font:600 15px system-ui,sans-serif!important;text-align:left!important;cursor:pointer!important}
 html body #rxdeCheckoutFlow10 .rxde-checkout-back10 small{font-size:12px!important;font-weight:500!important;white-space:nowrap!important}
 html body #rxdeCheckoutFlow10 h2{font:700 20px/1.25 system-ui,sans-serif!important;margin:0!important;padding:14px 16px 8px!important;color:#28536a!important;flex:0 0 auto!important}
 html body #rxdeCheckoutFlow10 .rxde-checkout-content10{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain!important;padding:5px 16px 12px!important}
 html body #rxdeCheckoutFlow10 #rxdeInlineCheckout{display:block!important;position:static!important;width:100%!important;max-height:none!important;height:auto!important;overflow:visible!important;padding:0!important;margin:0!important;border:0!important;box-shadow:none!important;background:transparent!important}
 html body #rxdeCheckoutFlow10 .rxde-contact-head{display:none!important}
 html body #rxdeCheckoutFlow10 .rxde-inline-fields{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:10px!important;width:100%!important;max-height:none!important;overflow:visible!important}
 html body #rxdeCheckoutFlow10 .rxde-inline-pair{display:block!important;width:100%!important;margin:0!important;padding:0!important}
 html body #rxdeCheckoutFlow10 .rxde-inline-pair label{display:block!important;font-size:14px!important;line-height:1.35!important;margin-bottom:5px!important}
 html body #rxdeCheckoutFlow10 .rxde-inline-pair input{display:block!important;box-sizing:border-box!important;width:100%!important;max-width:none!important;height:48px!important;min-height:48px!important;padding:9px 12px!important;font:16px system-ui,sans-serif!important}
 html body #rxdeCheckoutFlow10 .rxde-phone-apps{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:9px 16px!important;width:100%!important;margin:0!important;padding:3px 0!important}
 html body #rxdeCheckoutFlow10 .rxde-phone-apps>span{flex-basis:100%!important;font-size:14px!important}
 html body #rxdeCheckoutFlow10 .rxde-phone-apps label{display:inline-flex!important;align-items:center!important;gap:5px!important;font-size:14px!important}
 html body #rxdeCheckoutFlow10 .rxde-inline-separator{display:none!important}
 html body #rxdeCheckoutFlow10 .rxde-contact-help{font-size:12px!important;line-height:1.4!important;margin:8px 0!important}
 html body #rxdeCheckoutFlow10 .rxde-checkout-actions10{flex:0 0 auto!important;box-sizing:border-box!important;padding:10px 16px max(10px,env(safe-area-inset-bottom))!important;border-top:1px solid #d5e3ea!important;background:#fff!important}
 html body #rxdeCheckoutFlow10 #submitOrder{display:flex!important;position:static!important;box-sizing:border-box!important;width:100%!important;max-width:none!important;height:50px!important;min-height:50px!important;margin:0!important;padding:8px 14px!important;justify-content:center!important;visibility:visible!important}
 /* While an on-screen keyboard is active, make the WHOLE form scroll normally.
    CTA must follow messenger choices and email, never cover the next field. */
 @media(max-width:760px){
   html body #rxdeCheckoutFlow10.rxde-editing11 .rxde-checkout-card10{overflow-y:auto!important;overscroll-behavior:contain!important}
   html body #rxdeCheckoutFlow10.rxde-editing11 .rxde-checkout-back10{position:sticky!important;top:0!important;z-index:3!important}
   html body #rxdeCheckoutFlow10.rxde-editing11 h2{flex:0 0 auto!important}
   html body #rxdeCheckoutFlow10.rxde-editing11 .rxde-checkout-content10{flex:0 0 auto!important;min-height:auto!important;overflow:visible!important}
   html body #rxdeCheckoutFlow10.rxde-editing11 .rxde-checkout-actions10{flex:0 0 auto!important;position:static!important;margin-top:6px!important}
 }

 html body #rxdeContactConfirm:not([hidden]){z-index:2147483450!important}
 html body #rxdeSendingOverlay:not([hidden]){z-index:2147483500!important}
 html body #orderSheet #rxdeMobileContactsToggle{display:flex!important;align-items:center!important;justify-content:center!important;min-height:48px!important;width:100%!important;padding:8px 12px!important}
 html body #orderSheet .sheet-footer #submitOrder{display:none!important}
 @media(min-width:761px){html body #rxdeCheckoutFlow10:not([hidden]){align-items:center!important}html body #rxdeCheckoutFlow10 .rxde-checkout-card10{height:min(90%,650px)!important;max-height:min(90%,650px)!important;border-radius:18px!important}}
 `;
 document.head.appendChild(flowCss);
 function syncCheckoutViewport(){
   const v=window.visualViewport;
   if(v){flow.style.setProperty('--rxde-flow-height',Math.round(v.height)+'px');flow.style.setProperty('--rxde-flow-top',Math.round(v.offsetTop)+'px');}
   else{flow.style.setProperty('--rxde-flow-height','100dvh');flow.style.setProperty('--rxde-flow-top','0px');}
 }
 const isCheckoutOpen=()=>!flow.hidden;
 function setMobileContacts(open){
   if(open){
     const t=R.Cart.totals();
     flow.querySelector('#rxdeCheckoutSummary10').textContent=t.positions+' поз. · '+t.packs+' уп. · '+R.Utils.money(t.rub)+' ₽';
     syncCheckoutViewport();
     flow.hidden=false;
     flow.classList.remove('rxde-editing11');
     contactToggle.setAttribute('aria-expanded','true');
     sheet.classList.remove('rxde-mobile-contacts-open');
   }else{
     flow.hidden=true;
     flow.classList.remove('rxde-editing11');
     contactToggle.setAttribute('aria-expanded','false');
     document.activeElement?.blur?.();
   }
 }
 contactToggle.addEventListener('click',()=>setMobileContacts(true));
 flow.querySelector('#rxdeCheckoutBack10').addEventListener('click',()=>{if(!busy)setMobileContacts(false)});
 sheet.addEventListener('rxde:focus-product',()=>setMobileContacts(false));
 window.visualViewport?.addEventListener('resize',()=>{if(isCheckoutOpen())syncCheckoutViewport()},{passive:true});
 window.visualViewport?.addEventListener('scroll',()=>{if(isCheckoutOpen())syncCheckoutViewport()},{passive:true});
 // Expose only a close method for successful receipt/other navigation.
 window.RXDE_CHECKOUT_FLOW10={close:()=>setMobileContacts(false)};
 // Focus rather than viewport heuristics also works with Samsung/Android keyboard modes.
 let focusRelease11=0;
 flow.addEventListener('focusin',event=>{
   if(!event.target.matches('input,textarea'))return;
   clearTimeout(focusRelease11);
   if(window.matchMedia('(max-width:760px)').matches)flow.classList.add('rxde-editing11');
 });
 flow.addEventListener('focusout',()=>{
   clearTimeout(focusRelease11);
   focusRelease11=setTimeout(()=>{
     if(!flow.contains(document.activeElement)||!document.activeElement.matches('input,textarea'))flow.classList.remove('rxde-editing11');
   },220);
 });

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
 btn.innerHTML='<span class="rxde-parcel-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M5 10.5 16 5l11 5.5v12L16 28 5 22.5z"/><path d="M5 10.5 16 16l11-5.5M16 16v12M11 7.5l11 5.5"/><path d="M20 19h3m-1.5-1.5v3"/></svg></span><span>Проверить контакты →</span>';btn.classList.add('rxde-inline-submit');btn.disabled=false;btn.setAttribute('aria-disabled','true');
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
      // Reinitialise the catalogue cleanly after confirmed delivery.
      // Avoid stale mobile-mode locks and hidden product lists.
      location.replace(location.pathname);
    };
    setMobileContacts(false);
    $('orderBackdrop').hidden=true;R.Store.set({orderOpen:false});document.body.style.overflow='';done.hidden=false;
    error.hidden=true;closeSending();
  }catch(err){prepareFallback();sending.dataset.status='error';sendingStatus.textContent='Отправка не удалась';sendingDetail.textContent='Напишите нам напрямую — обязательно свяжемся с вами.';document.getElementById('rxdeSendingClose').hidden=false;error.classList.remove('neutral');error.textContent='Напишите нам напрямую по ссылке.';error.hidden=false;}
  finally{busy=false;btn.innerHTML='<span class="rxde-parcel-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M5 10.5 16 5l11 5.5v12L16 28 5 22.5z"/><path d="M5 10.5 16 16l11-5.5M16 16v12M11 7.5l11 5.5"/><path d="M20 19h3m-1.5-1.5v3"/></svg></span><span>Проверить контакты →</span>';contactSummary();}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true});else setTimeout(boot,0);
})();
