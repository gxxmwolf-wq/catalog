/* RXDE independent delivery: POST to GAS; verify storage by read-only JSONP status query. */
(function(){
  const EMAIL='med.zakaz.de@gmail.com';
  const endpoint=()=>String(window.RXDE_CONFIG?.googleOrdersWebAppUrl||'').trim();
  const valid=()=>/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec(?:\?.*)?$/.test(endpoint());
  // Moscow time; rate is frozen at submission. Code uses cryptographic randomness.
  const makeId=(rate,at=new Date())=>{
    const date=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
    const part=k=>date.find(p=>p.type===k)?.value||'00';
    const rand=new Uint32Array(1);crypto.getRandomValues(rand);
    const code=(rand[0]%1679616).toString(36).toUpperCase().padStart(4,'0');
    return 'RX-'+part('year')+part('month')+part('day')+'-'+part('hour')+part('minute')+'-'+Math.round(Number(rate)||0)+'-'+code;
  };
  const validId=id=>/^(?:RX-[A-Z0-9]+-[A-Z0-9]{12,14}|RX-\d{6}-\d{4}-\d{2,4}-[A-Z0-9]{4})$/.test(id);
  async function statusOnce(id){
    return new Promise((resolve,reject)=>{
      const cb='__rxdeReceipt_'+Math.random().toString(36).slice(2), script=document.createElement('script');
      let finished=false;
      const finish=(err,val)=>{if(finished)return;finished=true;clearTimeout(timer);delete window[cb];script.remove();err?reject(err):resolve(val)};
      window[cb]=data=>finish(null,data);
      script.onerror=()=>finish(new Error('status-unreachable'));
      const u=new URL(endpoint());u.searchParams.set('receipt',id);u.searchParams.set('callback',cb);u.searchParams.set('_',Date.now().toString());
      script.src=u.toString();script.async=true;script.referrerPolicy='no-referrer';
      const timer=setTimeout(()=>finish(new Error('status-timeout')),9500);document.head.appendChild(script);
    });
  }
  const stamp=at=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(at)+' МСК';
  const origin=()=>{try{return location.hostname||'локальный просмотр';}catch(_){return 'не определён';}};
  async function send(payload){
    if(!valid())throw new Error('not-configured');
    if(!navigator.onLine)throw new Error('offline');
    const at=payload._submissionAt?new Date(payload._submissionAt):new Date();
    if(!payload._submissionAt)payload._submissionAt=at.toISOString();
    if(!payload.sourceHost)payload.sourceHost=origin();
    let id=payload._receiptId;
    if(!id){
      // Resolve known collisions before POST; preserve one ID for retries.
      for(let i=0;i<8;i++){
        id=makeId(payload.rate,at);
        try{const state=await statusOnce(id);if(state?.saved)continue;}catch(_){/* network errors should not block sending */}
        break;
      }
    }
    payload._receiptId=id;
    // Frozen order details must be identical for a retry of the same ID.
    if(!payload._receiptWithMeta){
      // Standalone copy keeps its metadata; submitted receipt has exactly one header.
      const bodyReceipt=String(payload.receiptText||'').split('\n').filter(line=>!/^\s*(?:дата|сайт)\s*:/i.test(line)).join('\n').trim();
      payload.receiptText='Номер заявки: '+id+'\nДата и время: ['+stamp(at)+']\nСайт заявки: '+payload.sourceHost+'\n\n'+bodyReceipt;
      payload._receiptWithMeta=true;
    }
    const { _receiptId, _receiptWithMeta, _submissionAt, ...publicPayload }=payload;
    const body=JSON.stringify({schema:1,id,submittedAt:at.toISOString(),...publicPayload});
    await fetch(endpoint(),{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body,redirect:'follow',cache:'no-store'});
    // no-cors cannot prove delivery. Read-only status exposes only a random receipt id, no customer data.
    for(let i=0;i<5;i++){
      if(i)await new Promise(r=>setTimeout(r,1000));
      try {const s=await statusOnce(id);if(s?.saved===true&&s.id===id)return {id,mailStatus:s.mailStatus||'queued',clientMailStatus:s.clientMailStatus||'queued'};}catch(_){/* retry */}
    }
    throw new Error('unconfirmed: '+id);
  }
  async function addClientEmail(id,email){
    if(!valid()||!validId(id))throw new Error('bad-receipt');
    await fetch(endpoint(),{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({schema:1,action:'add-client-email',id,email}),redirect:'follow',cache:'no-store'});
    for(let i=0;i<5;i++){
      if(i)await new Promise(r=>setTimeout(r,1000*i));
      try{const state=await statusOnce(id);if(state?.saved&&state.emailProvided===true)return state;}catch(_){}
    }
    throw new Error('unconfirmed-email');
  }
  window.RXDE_DELIVERY={send,addClientEmail,isConfigured:valid,email:EMAIL};
})();
