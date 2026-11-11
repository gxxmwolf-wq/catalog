/* RXDE V3.13.35 — integrated, one-window checkout. Does not alter product cards or admin copy. */
(function(){
'use strict';
function boot(){
 const R=window.RXDE, sheet=document.getElementById('orderSheet'), btn=document.getElementById('submitOrder');
 if(!R?.Cart||!sheet||!btn)return;
 const foot=sheet.querySelector('.sheet-footer');
 const buildLabel=document.getElementById('rxdeFooterVersion');
 if(buildLabel)buildLabel.textContent='v2 · 11.11.2026-16';
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
 const mailLink=document.createElement('a');
 mailLink.id='rxdeCheckoutMail13';mailLink.className='rxde-checkout-mail13';mailLink.href='mailto:med.zakaz.de@gmail.com';
 mailLink.textContent='Напишу письмо сам — без заполнения контактов';
 flow.querySelector('#rxdeCheckoutActions10').appendChild(mailLink);
 const flowCss=document.createElement('style');flowCss.id='rxdeCheckoutStyles10';
 flowCss.textContent=`
 /* Single checkout surface; never show an unrelated catalog behind the editor. */
 #rxdeCheckoutFlow10[hidden]{display:none!important}
 html body #rxdeCheckoutFlow10:not([hidden]){display:flex!important;position:fixed!important;inset:auto!important;left:0!important;right:0!important;top:var(--rxde-flow-top,0px)!important;height:var(--rxde-flow-height,100dvh)!important;z-index:2147483400!important;align-items:flex-start!important;justify-content:center!important;overflow-y:auto!important;overscroll-behavior:contain!important;background:#fff!important;box-sizing:border-box!important;padding:0!important}
 html body #rxdeCheckoutFlow10 .rxde-checkout-card10{display:flex!important;flex-direction:column!important;position:relative!important;box-sizing:border-box!important;width:min(100%,540px)!important;max-width:100%!important;height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important;margin:0 auto!important;padding:0!important;background:#fff!important;color:#254050!important;border:0!important;border-radius:0!important;box-shadow:none!important}
 html body #rxdeCheckoutFlow10 .rxde-checkout-back10{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;min-height:42px!important;width:100%!important;padding:8px 12px!important;background:#edf7fb!important;color:#24536a!important;border:0!important;border-bottom:1px solid #cbdde5!important;font:600 14px/1.2 system-ui,sans-serif!important;text-align:left!important;cursor:pointer!important}
 html body #rxdeCheckoutFlow10 .rxde-checkout-back10 small{font-size:11px!important;font-weight:500!important;white-space:nowrap!important}
 html body #rxdeCheckoutFlow10 h2{font:700 19px/1.15 system-ui,sans-serif!important;margin:0!important;padding:10px 13px 3px!important;color:#28536a!important}
 html body #rxdeCheckoutFlow10 .rxde-checkout-content10{display:block!important;flex:0 0 auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;padding:2px 13px 0!important}
 html body #rxdeCheckoutFlow10 #rxdeInlineCheckout{display:block!important;position:static!important;width:100%!important;max-height:none!important;height:auto!important;overflow:visible!important;padding:0!important;margin:0!important;border:0!important;box-shadow:none!important;background:transparent!important}
 html body #rxdeCheckoutFlow10 .rxde-contact-head{display:none!important}
 html body #rxdeCheckoutFlow10 .rxde-inline-fields{display:flex!important;flex-direction:column!important;gap:7px!important;width:100%!important;max-height:none!important;overflow:visible!important;padding:0!important}
 html body #rxdeCheckoutFlow10 .rxde-inline-pair{display:block!important;width:100%!important;margin:0!important;padding:0!important}
 html body #rxdeCheckoutFlow10 .rxde-inline-pair label{display:block!important;font:500 13px/1.25 system-ui,sans-serif!important;margin:0 0 3px!important;padding:0!important}
 html body #rxdeCheckoutFlow10 .rxde-inline-pair input{display:block!important;box-sizing:border-box!important;width:100%!important;max-width:none!important;height:38px!important;min-height:38px!important;padding:5px 10px!important;border-radius:9px!important;font:16px/1.2 system-ui,sans-serif!important}
 html body #rxdeCheckoutFlow10 .rxde-phone-apps{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:2px 12px!important;width:100%!important;margin:0!important;padding:0!important}
 html body #rxdeCheckoutFlow10 .rxde-phone-apps>span{flex-basis:100%!important;font:500 13px/1.25 system-ui,sans-serif!important;margin-bottom:1px!important}
 html body #rxdeCheckoutFlow10 .rxde-phone-apps label{display:inline-flex!important;align-items:center!important;gap:4px!important;font:13px/1.2 system-ui,sans-serif!important;margin:0!important;padding:2px 0!important;white-space:nowrap!important}
 html body #rxdeCheckoutFlow10 .rxde-phone-apps input{width:17px!important;height:17px!important;margin:0!important}
 html body #rxdeCheckoutFlow10 .rxde-inline-separator{display:none!important}
 html body #rxdeCheckoutFlow10 .rxde-contact-help{display:none!important}
 html body #rxdeCheckoutFlow10 .rxde-checkout-actions10{display:flex!important;flex-direction:column!important;flex:0 0 auto!important;box-sizing:border-box!important;gap:4px!important;padding:8px 13px max(8px,env(safe-area-inset-bottom))!important;border:0!important;background:#fff!important;position:static!important;margin:0!important}
 html body #rxdeCheckoutFlow10 #submitOrder{display:flex!important;position:static!important;box-sizing:border-box!important;width:100%!important;max-width:none!important;height:39px!important;min-height:39px!important;margin:0!important;padding:5px 10px!important;justify-content:center!important;align-items:center!important;visibility:visible!important;font:650 15px system-ui,sans-serif!important}
 html body #rxdeCheckoutFlow10 #submitOrder,
 html body #rxdeCheckoutFlow10 #submitOrder.rxde-inline-submit,
 html body #rxdeCheckoutFlow10 #submitOrder.rxde-contact-ready,
 html body #rxdeCheckoutFlow10 #submitOrder[aria-disabled="true"]{
   background:#2788c2!important;background-image:none!important;
   border:1px solid #237cac!important;color:#fff!important;
   opacity:1!important;box-shadow:0 3px 10px rgba(22,112,166,.16)!important;
   -webkit-text-fill-color:#fff!important;
 }
 html body #rxdeCheckoutFlow10 #submitOrder:focus-visible{outline:2px solid #145c8a!important;outline-offset:2px!important}
 html body #rxdeCheckoutFlow10 #submitOrder:disabled{background:#84b6d0!important;border-color:#84b6d0!important;opacity:1!important}
 html body #rxdeCheckoutFlow10 #submitOrder span{color:inherit!important;-webkit-text-fill-color:inherit!important}
 html body #rxdeCheckoutFlow10 #submitOrder .rxde-parcel-mark{display:none!important}
 html body #rxdeCheckoutFlow10 .rxde-checkout-mail13{display:block!important;margin:0 auto!important;padding:3px 2px!important;text-align:center!important;font:500 12px/1.25 system-ui,sans-serif!important;color:#22617b!important;text-decoration:underline!important;text-underline-offset:2px!important}
 html body #orderSheet #rxdeMobileContactsToggle{display:flex!important;align-items:center!important;justify-content:center!important;min-height:48px!important;width:100%!important;padding:8px 12px!important}
 html body #orderSheet .sheet-footer #submitOrder{display:none!important}
 html body #rxdeContactConfirm:not([hidden]){z-index:2147483450!important}
 html body #rxdeSendingOverlay:not([hidden]){z-index:2147483500!important}
 @media(min-width:761px){html body #rxdeCheckoutFlow10:not([hidden]){align-items:center!important;background:rgba(18,37,45,.70)!important}html body #rxdeCheckoutFlow10 .rxde-checkout-card10{border-radius:16px!important;box-shadow:0 15px 50px #11263140!important;max-height:calc(100% - 12px)!important;overflow-y:auto!important}}
 /* Mobile must have one opaque screen even when the visual viewport shrinks
    for the Android keyboard. The backing order/cart cannot peek through below it. */
 @media(max-width:760px){
   html body.rxde-checkout-active15::before{content:""!important;display:block!important;position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;background:#fff!important;z-index:2147483300!important;pointer-events:auto!important}
   html body #rxdeCheckoutFlow10:not([hidden]){background:#fff!important}
   html body #rxdeCheckoutFlow10 .rxde-checkout-content10{padding:9px 20px 0!important}
   html body #rxdeCheckoutFlow10 .rxde-inline-fields{gap:12px!important}
   html body #rxdeCheckoutFlow10 .rxde-inline-pair input{min-height:44px!important;height:44px!important;padding:8px 12px!important}
   html body #rxdeCheckoutFlow10 .rxde-checkout-actions10{padding:15px 20px max(15px,env(safe-area-inset-bottom))!important;gap:11px!important}
   html body #rxdeCheckoutFlow10 #submitOrder{min-height:44px!important;height:44px!important}
   html body #rxdeCheckoutFlow10.rxde-keyboard-compact14 .rxde-checkout-content10{padding:6px 17px 0!important}
   html body #rxdeCheckoutFlow10.rxde-keyboard-compact14 .rxde-inline-fields{gap:9px!important}
   html body #rxdeCheckoutFlow10.rxde-keyboard-compact14 .rxde-inline-pair input{min-height:40px!important;height:40px!important}
   html body #rxdeCheckoutFlow10.rxde-keyboard-compact14 .rxde-checkout-actions10{padding:10px 17px 13px!important;gap:8px!important}
   html body #rxdeCheckoutFlow10.rxde-keyboard-compact14 #submitOrder{min-height:40px!important;height:40px!important}
 }
 /* Keyboard-visible area can be short: no fixed footer, scroll the single outer surface. */
 html body #rxdeCheckoutFlow10.rxde-keyboard-compact14 h2{font-size:17px!important;padding-top:6px!important;padding-bottom:1px!important}
 html body #rxdeCheckoutFlow10.rxde-keyboard-compact14 .rxde-checkout-back10{min-height:34px!important;padding:5px 10px!important}
 html body #rxdeCheckoutFlow10.rxde-keyboard-compact14 .rxde-checkout-content10{padding:0 10px!important}
 html body #rxdeCheckoutFlow10.rxde-keyboard-compact14 .rxde-inline-fields{gap:4px!important}
 html body #rxdeCheckoutFlow10.rxde-keyboard-compact14 .rxde-inline-pair input{height:34px!important;min-height:34px!important}
 html body #rxdeCheckoutFlow10.rxde-keyboard-compact14 .rxde-checkout-actions10{padding:5px 10px!important;gap:2px!important}
 html body #rxdeCheckoutFlow10.rxde-keyboard-compact14 #submitOrder{height:35px!important;min-height:35px!important}
 `;
 document.head.appendChild(flowCss);
 function syncCheckoutViewport(){
   const v=window.visualViewport;
   if(v){flow.style.setProperty('--rxde-flow-height',Math.round(v.height)+'px');flow.style.setProperty('--rxde-flow-top',Math.round(v.offsetTop)+'px');flow.classList.toggle('rxde-keyboard-compact14',v.height<570);}
   else{flow.style.setProperty('--rxde-flow-height','100dvh');flow.style.setProperty('--rxde-flow-top','0px');flow.classList.remove('rxde-keyboard-compact14');}
 }
 const isCheckoutOpen=()=>!flow.hidden;
 function setMobileContacts(open){
   if(open){
     const t=R.Cart.totals();
     flow.querySelector('#rxdeCheckoutSummary10').textContent=t.positions+' поз. · '+t.packs+' уп. · '+R.Utils.money(t.rub)+' ₽';
     syncCheckoutViewport();
     flow.hidden=false;
     document.body.classList.add('rxde-checkout-active15');
     flow.classList.remove('rxde-editing11');
     contactToggle.setAttribute('aria-expanded','true');
     sheet.classList.remove('rxde-mobile-contacts-open');
   }else{
     flow.hidden=true;
     document.body.classList.remove('rxde-checkout-active15');
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
   requestAnimationFrame(()=>{if(flow.contains(event.target))event.target.scrollIntoView({block:'nearest',behavior:'instant'});});
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
 btn.innerHTML='<span class="rxde-parcel-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M5 10.5 16 5l11 5.5v12L16 28 5 22.5z"/><path d="M5 10.5 16 16l11-5.5M16 16v12M11 7.5l11 5.5"/><path d="M20 19h3m-1.5-1.5v3"/></svg></span><span>Проверить контакты →</span>';btn.classList.add('rxde-inline-submit');btn.removeAttribute('aria-hidden');btn.removeAttribute('tabindex');btn.disabled=false;btn.setAttribute('aria-disabled','true');
 document.getElementById('rxdeSendingClose').addEventListener('click',closeSending);
 // Direct email option is shown inside the checkout, beneath the main action.
 mailLink.addEventListener('click',event=>{
   const t=R.Cart.totals();
   if(!t.positions){event.preventDefault();R.Utils.toast?.('Сначала добавьте товары в корзину');return;}
   const receipt=R.Admin?.template?.(null,R.Store.get().cart,'');
   if(!receipt){event.preventDefault();R.Utils.toast?.('Не удалось подготовить текст заказа');return;}
   const subject='RXDE · Заказ клиента';
   mailLink.href='mailto:med.zakaz.de@gmail.com?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(receipt);
 });
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
