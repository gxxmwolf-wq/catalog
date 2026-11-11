try{if('scrollRestoration' in history)history.scrollRestoration='manual'}catch(_){}
(function(R){
  const cfg=window.RXDE_CONFIG||{};
  const rates=window.RXDE_RATES||{};
  const U = R.Utils = {};

  U.num = v => { const n=parseFloat(String(v??'').replace(',','.')); return Number.isFinite(n)?n:0; };
  const cbr=U.num(rates.cbrRate)||U.num(cfg.fallbackCbrRate)||100.2998;
  const markup=U.num(cfg.rateMarkupRub);
  const calc=Math.floor(cbr+markup);

  const C = R.Constants = {
    PUBLIC_BASE_URL:cfg.publicBaseUrl === undefined ? 'https://rxde.online/' : String(cfg.publicBaseUrl).trim(),
    RATE_MARKUP_RUB:markup,
    DEFAULT_CBR_RATE:cbr,
    DEFAULT_RATE:calc,
    RATE_SOURCE:String(rates.source||'fallback'),
    RATE_EFFECTIVE_DATE:String(rates.effectiveDate||''),
    RATE_FETCHED_AT:String(rates.fetchedAt||''),
    RATE_STALE:Boolean(rates.stale),
    SHIPPING_EUR:U.num(cfg.shippingEur)||50,
    PAGE_SIZE:20,
    CART_KEY:'de_cart_v2'
  };

  U.pzn = v => String(v ?? '').trim().padStart(8,'0');
  // EUR is the accounting basis. RUB display is an exact whole-ruble equivalent; only the final order payment is rounded down to 100 ₽.
  U.rub = (eur, rate) => Math.floor((U.num(eur)*U.num(rate))/100)*100;
  U.rubFinal = (eur, rate) => Math.floor((U.num(eur)*U.num(rate))/100)*100;
  U.money = n => Math.round(U.num(n)).toLocaleString('ru-RU');
  U.escape = v => String(v??'').replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  U.norm = v => String(v??'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,' ').trim();
  U.debounce = (fn,ms=80)=>{let t; return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};
  U.soundEnabled = ()=> localStorage.getItem('rxde:sound')!=='0';
  U.setSoundEnabled = on => localStorage.setItem('rxde:sound',on?'1':'0');
  U.haptic = kind => { try { if(!navigator.vibrate)return; navigator.vibrate(kind==='remove'?[18]:kind==='add'?[10]:[6]); } catch(_){} };
  U.ensureAudio = async()=>{try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return null;R._audio=R._audio||new A();if(R._audio.state==='suspended')await R._audio.resume();return R._audio}catch(_){return null}};
  U.sound = kind => { U.haptic(kind); if(!U.soundEnabled())return; U.ensureAudio().then(c=>{if(!c)return;try{const n=c.currentTime;const tone=(f,at,d=.05,v=.012,type='sine')=>{const g=c.createGain(),o=c.createOscillator();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.0001,n+at);g.gain.exponentialRampToValueAtTime(v,n+at+.004);g.gain.exponentialRampToValueAtTime(.0001,n+at+d);o.connect(g);g.connect(c.destination);o.start(n+at);o.stop(n+at+d+.01)};if(kind==='add'){const len=Math.max(1,Math.floor(c.sampleRate*.07)),buf=c.createBuffer(1,len,c.sampleRate),data=buf.getChannelData(0);for(let i=0;i<len;i++){const env=Math.pow(1-i/len,2.8);data[i]=(Math.random()*2-1)*env*.18}const src=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain();filter.type='highpass';filter.frequency.value=900;g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(.025,n+.005);g.gain.exponentialRampToValueAtTime(.0001,n+.075);src.buffer=buf;src.connect(filter);filter.connect(g);g.connect(c.destination);src.start(n);src.stop(n+.08);tone(760,.025,.045,.006,'sine')}else if(kind==='remove'){const len=Math.max(1,Math.floor(c.sampleRate*.095)),buf=c.createBuffer(1,len,c.sampleRate),data=buf.getChannelData(0);for(let i=0;i<len;i++){const env=Math.pow(1-i/len,2.1);data[i]=(Math.random()*2-1)*env*.30}const src=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain();filter.type='bandpass';filter.frequency.value=1250;filter.Q.value=.65;g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(.055,n+.006);g.gain.exponentialRampToValueAtTime(.0001,n+.10);src.buffer=buf;src.connect(filter);filter.connect(g);g.connect(c.destination);src.start(n);src.stop(n+.105);tone(240,.025,.045,.004,'triangle')}else if(kind==='down')tone(520,0,.035,.006);else if(kind==='tick')tone(650,0,.03,.005);else tone(720,0,.04,.007)}catch(_){}}); };
  U.beep = up => U.sound(up?'add':'remove');
  U.toast = text => { const el=document.getElementById('toast'); if(!el)return; el.textContent=text;el.hidden=false;clearTimeout(U._tt);U._tt=setTimeout(()=>el.hidden=true,1800); };
})(window.RXDE = window.RXDE || {});


(function(R){
  const listeners=new Set();
  const state=R.state={query:'',category:'Витамины и минералы',subcategory:'',cart:[],rate:R.Constants.DEFAULT_RATE,cbrRate:R.Constants.DEFAULT_CBR_RATE,rateSource:(String(R.Constants.RATE_SOURCE||'').toUpperCase().includes('GOOGLE')?'G':'B'),orderOpen:false,home:false,mobileMode:'search',mobileSearchScope:'category',searchScrollCategory:0,searchScrollGlobal:0,compact:false,expanded:new Set(),orderExpanded:new Set(),limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:20,pendingDelete:null};
  // v0.87: shared ephemeral viewed-state. Memory-only: refresh clears it.
  R.ViewedProducts=R.ViewedProducts||new Set();
  R.Store={
    get:()=>state,
    set(patch){Object.assign(state,patch);listeners.forEach(fn=>fn(state));},
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},
    emit(){listeners.forEach(fn=>fn(state))}
  };
})(window.RXDE);


/* v0.63 — live rate guard. Refresh only rates.js, never reload the working page. */
(function(R){
  const CHECK_MS=Number(window.RXDE_CONFIG?.googleRateRefreshMs)||6*60*60*1000;
  const STALE_CHECK_MS=60*60*1000;
  let timer=0,checking=false,lastAttempt=0,lastSuccess=0;
  const U=R.Utils,S=R.Store,C=R.Constants;

  function calendarPulse(){
    const cal=document.getElementById('flipDate');
    if(!cal)return;
    cal.classList.remove('is-flipping','rate-check-flip');
    void cal.offsetWidth;
    cal.classList.add('rate-check-flip');
    setTimeout(()=>cal.classList.remove('rate-check-flip'),520);
  }

  function loadFreshRates(){
    return new Promise((resolve,reject)=>{
      const prev=window.RXDE_RATES;
      const script=document.createElement('script');
      const url=new URL('rates.js',document.baseURI);
      url.searchParams.set('rxde_rate_check',String(Date.now()));
      script.src=url.href;
      script.async=true;
      script.onload=()=>{script.remove();resolve(window.RXDE_RATES||prev||{})};
      script.onerror=()=>{script.remove();window.RXDE_RATES=prev;reject(new Error('rate-load-failed'))};
      document.head.appendChild(script);
    });
  }

  function loadGoogleRate(){
    const cfg=window.RXDE_CONFIG||{};
    const id=String(cfg.googleRateSpreadsheetId||'').trim();
    const sheet=String(cfg.googleRateSheet||'settings_1').trim();
    const cell=String(cfg.googleRateCell||'C2').trim();
    if(!id)return Promise.reject(new Error('google-rate-not-configured'));
    return new Promise((resolve,reject)=>{
      const cb='__rxdeGoogleRate_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      let done=false;
      const finish=(err,val)=>{
        if(done)return;done=true;
        clearTimeout(timer);
        try{delete window[cb]}catch(_){window[cb]=undefined}
        script.remove();
        err?reject(err):resolve(val);
      };
      window[cb]=payload=>{
        try{
          const raw=payload?.table?.rows?.[0]?.c?.[0]?.v ?? payload?.table?.rows?.[0]?.c?.[0]?.f;
          const rate=Number(String(raw??'').replace(',','.'));
          if(!Number.isFinite(rate)||rate<20||rate>300)throw new Error('invalid-google-rate');
          const now=new Date();
          resolveRate={
            source:'GOOGLE',currency:'EUR',cbrRate:rate,
            effectiveDate:now.toISOString().slice(0,10),fetchedAt:now.toISOString(),stale:false
          };
          finish(null,resolveRate);
        }catch(e){finish(e)}
      };
      const url=new URL(`https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq`);
      url.searchParams.set('sheet',sheet);
      url.searchParams.set('range',cell);
      url.searchParams.set('tqx',`out:json;responseHandler:${cb}`);
      url.searchParams.set('_',String(Date.now()));
      script.src=url.href;
      script.async=true;
      script.referrerPolicy='no-referrer';
      script.onerror=()=>finish(new Error('google-rate-load-failed'));
      const timer=setTimeout(()=>finish(new Error('google-rate-timeout')),5000);
      document.head.appendChild(script);
    });
  }

  async function refresh(opts={}){
    const force=Boolean(opts.force),notifyError=Boolean(opts.notifyError);
    if(checking)return false;
    const now=Date.now();
    if(!force){
      const minAge=(opts.reason==='order'||opts.reason==='visible'||opts.reason==='focus')?STALE_CHECK_MS:45_000;
      if(now-lastAttempt<minAge)return false;
    }
    checking=true;lastAttempt=now;
    const beforeRate=Math.floor(S.get().rate),beforeCbr=S.get().cbrRate;
    try{
      let rates,sourceCode='G';
      try{
        rates=await loadGoogleRate();
      }catch(_googleErr){
        sourceCode='B';
        rates=await loadFreshRates();
      }
      const cbr=U.num(rates.cbrRate);
      if(!cbr)throw new Error('invalid-rate');
      const calc=Math.floor(cbr+C.RATE_MARKUP_RUB);
      C.DEFAULT_CBR_RATE=cbr;C.DEFAULT_RATE=calc;
      C.RATE_SOURCE=String(rates.source||(sourceCode==='G'?'GOOGLE':'BACKUP'));
      C.RATE_EFFECTIVE_DATE=String(rates.effectiveDate||'');
      C.RATE_FETCHED_AT=String(rates.fetchedAt||'');
      C.RATE_STALE=Boolean(rates.stale);
      lastSuccess=Date.now();
      const changedRate=calc!==beforeRate || Math.abs(cbr-beforeCbr)>.00001 || S.get().rateSource!==sourceCode;
      S.set({cbrRate:cbr,rate:calc,rateSource:sourceCode});
      R.UI?.refreshRateDisplay?.(changedRate);
      if(changedRate)calendarPulse();
      // Automatic exchange-rate updates stay silent; totals and visible rate still refresh.
      if(opts.reason==='manual') U.toast('Курс проверен — без изменений');
      return true;
    }catch(err){
      if(notifyError)U.toast('Не удалось обновить курс · используется последнее значение');
      return false;
    }finally{checking=false}
  }

  function init(){
    clearInterval(timer);
    refresh({reason:'startup',force:true});
    timer=setInterval(()=>refresh({reason:'timer'}),CHECK_MS);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden && Date.now()-lastAttempt>=STALE_CHECK_MS)refresh({reason:'visible'})});
    window.addEventListener('focus',()=>{if(Date.now()-lastAttempt>=STALE_CHECK_MS)refresh({reason:'focus'})},{passive:true});
    window.addEventListener('online',()=>refresh({reason:'online',force:true}),{passive:true});
  }
  R.RateGuard={init,refresh,get lastSuccess(){return lastSuccess},CHECK_MS};
})(window.RXDE);


(function(R){
  const U=R.Utils;
  function product(row){
    const pzn=U.pzn(row.PZN); const eur=U.num(row.Price);
    return {
      pzn, rx:String(row.R||'').trim()==='1', name:String(row.Name_DE||row.Name_RU||pzn).trim(), nameRu:String(row.Name_RU||'').trim(),
      form:String(row.Form_DE||row.Form_RU||'').trim(), maker:String(row.Hersteller||'').trim(), substance:String(row.Substance_DE||row.Substance_RU||'').trim(),
      dosage:String(row.Dosage||'').trim(), size:String(row.Size||'').trim(),
      category:String(row.PrimaryCategory||'').trim(), legacyCategory:String(row.Category||'').trim(),
      tags:Array.isArray(row.Tags)?row.Tags.map(x=>String(x||'').trim()).filter(Boolean):String(row.Tags||'').split(/[;,|]/).map(x=>x.trim()).filter(Boolean),
      subcategory:String(row.Subcategory||row.Category_Subcategory||row.Subcategory_RU||'').trim(), eur,
      pdf:String(row.PDF||'').trim(), image:String(row._Image||row.Image||'').trim(), raw:row
    };
  }
  const rows=Array.isArray(window.RXDE_LOCAL_DB)?window.RXDE_LOCAL_DB:[];
  const products=rows.map(product).filter(p=>p.pzn && p.name && !p.name.startsWith('❌'));
  const byPzn=new Map(products.map(p=>[p.pzn,p]));
  const searchable=products.map(p=>({p,text:U.norm([p.pzn,p.name,p.nameRu,p.substance,p.form,p.maker,p.dosage,p.size,p.legacyCategory,...p.tags].join(' '))}));
  const catCount=new Map();products.forEach(p=>{if(p.category)catCount.set(p.category,(catCount.get(p.category)||0)+1)});
  const categories=[...catCount].sort((a,b)=>b[1]-a[1]);
  function subcategories(category){
    const map=new Map();
    products.forEach(p=>{if(p.category===category&&p.subcategory)map.set(p.subcategory,(map.get(p.subcategory)||0)+1)});
    return [...map].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  }
  const mainOrder=['Витамины и минералы','Уход и косметика','Пищеварение','Боль, мышцы и суставы','Глаза','Простуда и дыхание','Детские товары','Волосы и кожа головы','Кожа и заживление','Товары для животных','Аллергия','Уход за полостью рта','Другие препараты'];
  const orderedCategories=mainOrder.map(name=>[name,catCount.get(name)||0]).filter(x=>x[1]>0);
  R.Products={all:products,byPzn,searchable,categories:orderedCategories,subcategories,mainCategories:mainOrder};
})(window.RXDE);


(function(R){
  const GROUPS=[
    ['granules','Гранулы',/granulat|granules?|beutelgranulat/i],
    ['tablet','Таблетки',/(?:film|kau|lutsch|sublingual|überzogene|ueberzogene|magensaftresistent|retard(?:tablett|tabl)|tablett)/i],
    ['capsule','Капсулы',/(?:hart|weich|retard[- ]?)?kapsel|kps\.?/i],
    ['suppository','Свечи',/suppositor|zäpf|zaepf/i],
    ['enema','Клизмы',/klys|klistier|einlauf/i],
    ['foam','Пена',/schaum/i],
    ['suspension','Суспензия',/suspension/i],
    ['drops','Капли',/tropfen|einzeldosispipetten/i],
    ['spray','Спрей',/spray|aerosol/i],
    ['cream','Крем',/creme/i],
    ['gel','Гель',/gel/i],
    ['ointment','Мазь',/salbe/i],
    ['injection','Инъекции',/injekt|ampullen?/i],
    ['patch','Пластыри',/pflaster/i],
    ['powder','Порошок',/pulver/i],
    ['solution','Раствор',/lösung|loesung/i]
  ];
  const INFO=Object.fromEntries(GROUPS.map(([key,label])=>[key,{key,label}]));
  INFO.other={key:'other',label:'Другое'};
  function kind(form){const text=String(form||'').trim();if(!text)return'other';for(const [key,,re] of GROUPS)if(re.test(text))return key;return'other'}
  function info(form){const key=kind(form);return INFO[key]||INFO.other}
  function badge(p){const x=info(p?.form);return `<button type="button" class="form-badge form-${x.key}" data-card-form-filter="${x.key}" aria-label="Фильтр по форме выпуска: ${R.Utils.escape(p?.form||x.label)}" title="Фильтр по форме выпуска: ${R.Utils.escape(p?.form||x.label)}">${R.Utils.escape(x.label)}</button>`}
  R.Forms={GROUPS,INFO,kind,info,badge};
})(window.RXDE);


(function(R){
  const U=R.Utils,P=R.Products;

  const RU='йцукенгшщзхъфывапролджэячсмитьбю';
  const EN='qwertyuiop[]asdfghjkl;\'zxcvbnm,.';
  const ruToEn=new Map([...RU].map((c,i)=>[c,EN[i]]));
  const enToRu=new Map([...EN].map((c,i)=>[c,RU[i]]));

  const translit={
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y',
    'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
    'х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };

  function swapLayout(s,map){
    return String(s||'').toLowerCase().split('').map(c=>map.get(c)||c).join('');
  }
  function translitRu(s){
    return String(s||'').toLowerCase().split('').map(c=>translit[c]??c).join('');
  }
  function variants(query){
    const raw=String(query||'').trim().toLowerCase();
    const out=new Set([raw,U.norm(raw)]);
    out.add(U.norm(swapLayout(raw,ruToEn)));
    out.add(U.norm(swapLayout(raw,enToRu)));
    out.add(U.norm(translitRu(raw)));
    return [...out].filter(Boolean);
  }

  function editDistance(a,b,max=2){
    a=String(a||'');b=String(b||'');
    if(a===b)return 0;
    if(Math.abs(a.length-b.length)>max)return max+1;
    const n=a.length,m=b.length;
    const d=Array.from({length:n+1},()=>Array(m+1).fill(0));
    for(let i=0;i<=n;i++)d[i][0]=i;
    for(let j=0;j<=m;j++)d[0][j]=j;
    for(let i=1;i<=n;i++){
      let rowMin=max+1;
      for(let j=1;j<=m;j++){
        const cost=a[i-1]===b[j-1]?0:1;
        let v=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);
        if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,d[i-2][j-2]+1);
        d[i][j]=v;rowMin=Math.min(rowMin,v);
      }
      if(rowMin>max)return max+1;
    }
    return d[n][m];
  }
  function fuzzyScore(item,qs){
    let best=0;
    const fields=[U.norm(item.p.name),U.norm(item.p.nameRu)].filter(Boolean);
    const words=fields.flatMap(x=>x.split(' ').filter(Boolean));
    for(const q of qs){
      if(!q || /^\d+$/.test(q) || q.length<4)continue;
      const lim=q.length>=8?2:1;
      for(const w of words){
        if(Math.abs(w.length-q.length)>lim)continue;
        const d=editDistance(w,q,lim);
        if(d<=lim)best=Math.max(best,90-d*18+(w.startsWith(q.slice(0,2))?8:0));
      }
    }
    return best;
  }

  function score(item,q){
    if(!q)return 1;
    const p=item.p,t=item.text;let s=0;
    const name=U.norm(p.name),ru=U.norm(p.nameRu);
    if(p.pzn===q.replace(/\s/g,''))s+=1200;
    if(name===q||ru===q)s+=700;
    if(name.startsWith(q))s+=420;
    if(ru.startsWith(q))s+=390;
    if(name.includes(q)||ru.includes(q))s+=220;
    if(t.includes(q))s+=100;
    const parts=q.split(' ').filter(Boolean);
    for(const x of parts)if(t.includes(x))s+=18;
    return s;
  }

  function global(query){
    const qs=variants(query);
    if(!qs.length)return [];

    const ranked=[];
    for(const item of P.searchable){
      let best=0;
      const name=U.norm(item.p.name),ru=U.norm(item.p.nameRu),pzn=U.norm(item.p.pzn);
      for(const q of qs){
        let allowed=false;
        // Short input is strict: name / RU name / PZN only.
        if(q.length<=2){
          allowed=name.startsWith(q)||ru.startsWith(q)||pzn.startsWith(q);
        }else if(q.length===3){
          allowed=name.includes(q)||ru.includes(q)||pzn.startsWith(q);
        }else{
          allowed=item.text.includes(q)||name.includes(q)||ru.includes(q)||pzn.includes(q);
        }
        if(allowed)best=Math.max(best,score(item,q));
      }
      if(best>0)ranked.push({p:item.p,s:best,fuzzy:false});
    }
    if(ranked.length){
      return ranked.sort((a,b)=>b.s-a.s||a.p.name.localeCompare(b.p.name)).map(x=>x.p);
    }

    // Fuzzy fallback only when ordinary search found nothing.
    // Never fuzzy-match numeric/PZN queries: a wrong medicine code must not silently map to another product.
    const fuzzy=[];
    for(const item of P.searchable){
      const fs=fuzzyScore(item,qs);
      if(fs>0)fuzzy.push({p:item.p,s:fs});
    }
    return fuzzy.sort((a,b)=>b.s-a.s||a.p.name.localeCompare(b.p.name)).slice(0,40).map(x=>x.p);
  }

  function browse(category,subcategory){
    return P.searchable
      .filter(x=>(!category||x.p.category===category)&&(!subcategory||x.p.subcategory===subcategory))
      .map(x=>x.p)
      .sort((a,b)=>a.name.localeCompare(b.name));
  }

  function split(query,category,subcategory){
    const all=global(query);
    if(!category)return{primary:all,secondary:[],all};
    const primary=[],secondary=[];
    for(const p of all)((p.category===category&&(!subcategory||p.subcategory===subcategory))?primary:secondary).push(p);
    return{primary,secondary,all};
  }

  function suggestions(query,limit=8){
    const q=String(query||'').trim();
    if(q.length<1)return[];
    return global(q).slice(0,limit);
  }

  R.Search={
    global,browse,split,suggestions,variants,
    run(query,category,subcategory){return query?global(query):browse(category,subcategory)},
    topCategories(limit=8){return P.categories.slice(0,limit)}
  };
})(window.RXDE);


(function(R){
  const U=R.Utils,S=R.Store,C=R.Constants,P=R.Products;
  function normalize(raw){ if(!Array.isArray(raw))return[]; const out=[]; for(const it of raw){const pzn=U.pzn(it.pzn??it.PZN??it.id); const qty=Math.max(0,Math.min(999,parseInt(it.qty??it.quantity??1,10)||0)); if(pzn&&qty&&P.byPzn.has(pzn))out.push({pzn,qty});} return out; }
  function load(){try{return normalize(JSON.parse(localStorage.getItem(C.CART_KEY)||'[]'))}catch(_){return[]}}
  function save(){localStorage.setItem(C.CART_KEY,JSON.stringify(S.get().cart));if(!S.get().cart.length)R.Admin?.clearPrivateClient?.()}
  function index(pzn){return S.get().cart.findIndex(x=>x.pzn===U.pzn(pzn))}
  function qty(pzn){const i=index(pzn);return i<0?0:S.get().cart[i].qty}
  function setQty(pzn,q){pzn=U.pzn(pzn);q=Math.max(0,Math.min(999,parseInt(q,10)||0));const cart=[...S.get().cart];const i=cart.findIndex(x=>x.pzn===pzn);if(q===0){if(i>=0)cart.splice(i,1)}else if(i>=0)cart[i]={...cart[i],qty:q};else if(P.byPzn.has(pzn))cart.push({pzn,qty:q});S.set({cart});R.OrderExpiry?.prune(cart);save();}
  function totals(){let eur=0,packs=0,itemsRub=0;const rate=S.get().rate;for(const it of S.get().cart){const p=P.byPzn.get(it.pzn);if(!p)continue;eur+=p.eur*it.qty;packs+=it.qty;itemsRub+=U.rub(p.eur,rate)*it.qty}const shipping=packs?(R.Admin?.cartShippingEur?.()??C.SHIPPING_EUR):0,totalEur=eur+shipping,shippingRub=packs?U.rub(shipping,rate):0,totalRub=U.rubFinal(totalEur,rate);return{positions:S.get().cart.length,packs,itemsEur:eur,shippingEur:shipping,shippingRub,eur:totalEur,rubExact:totalRub,rub:totalRub}}
  function move(pzn,toIndex){const cart=[...S.get().cart];const i=cart.findIndex(x=>x.pzn===U.pzn(pzn));if(i<0)return;const [x]=cart.splice(i,1);cart.splice(Math.max(0,Math.min(cart.length,toIndex)),0,x);S.set({cart});save();}
  function fromUrl(){
    try{
      const raw=new URLSearchParams(location.search).get('c');
      if(!raw)return null;
      const out=[];
      raw.split(',').forEach(part=>{
        const [rp,rq]=part.split(':');const pzn=U.pzn(rp),q=Math.max(1,Math.min(999,parseInt(rq||'1',10)||1));
        if(P.byPzn.has(pzn))out.push({pzn,qty:q});
      });
      return out.length?out:null;
    }catch(_){return null}
  }
  function showRestoredLinkNotice(){
    const url=new URLSearchParams(location.search);if(!url.get('c'))return;
    const date=url.get('d')||'';
    const missing=[...new Set(url.get('c').split(',').map(x=>U.pzn(x.split(':')[0])).filter(x=>x&&!P.byPzn.has(x)))];
    const notice=document.createElement('aside');notice.className='rxde-restored-link-notice';notice.setAttribute('role','status');
    const title=document.createElement('strong');title.textContent='Заказ восстановлен'+(/^\d{2}\.\d{2}\.\d{4}$/.test(date)?' · '+date:'');notice.appendChild(title);
    const note=document.createElement('span');note.textContent='Цены пересчитаны по текущему каталогу и курсу.';notice.appendChild(note);
    if(missing.length){const warning=document.createElement('span');warning.className='rxde-restored-missing';warning.textContent='Не найдены в каталоге: '+missing.join(', ')+'. Уточните наличие этих позиций у менеджера.';notice.appendChild(warning)}
    const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Закрыть уведомление');close.onclick=()=>notice.remove();notice.appendChild(close);
    document.body.appendChild(notice);setTimeout(()=>{if(notice.isConnected)notice.remove()},15000);
  }
  R.Cart={init(){const linked=fromUrl();S.set({cart:linked||load()});if(linked)save();if(new URLSearchParams(location.search).has('c'))setTimeout(showRestoredLinkNotice,500)},qty,setQty,totals,move,save};
})(window.RXDE);


(function(R){
  const F=R.UIFormat={};

  F.copyableCore=(p,U,opts={})=>{
    const compact=!!opts.compact;
    const substance=p.substance?`<div class="copy-line copy-substance"><b>МНН:</b> ${U.escape(p.substance)}</div>`:'';
    const form=p.form?`<div class="copy-line"><span>Form:</span> ${U.escape(p.form)}</div>`:'';
    const maker=p.maker?`<div class="copy-line"><span>Hersteller:</span> ${U.escape(p.maker)}</div>`:'';
    const pzn=`<div class="copy-line copy-pzn"><span>PZN:</span> ${U.escape(p.pzn)}</div>`;
    return `<div class="copyable-product-core ${compact?'is-compact':''}">${substance}${form}${maker}${pzn}</div>`;
  };

  F.propertyText=(p,U)=>{
    const a=[];
    if(p.dosage)a.push(`Dosierung: ${U.escape(p.dosage)}`);
    if(p.size)a.push(`Packungsgröße: ${U.escape(p.size)}`);
    return a.length?`<div class="property-text-line">${a.join('<span class="property-sep"> · </span>')}</div>`:'';
  };

  F.links=(p,U,page,order=false)=>{
    const links=[];
    if(p.pdf==='1' && window.RXDE_AVAILABLE_PDFS?.includes(U.pzn(p.pzn)))links.push(`<a class="product-text-link" href="PDF/D${U.escape(p.pzn)}-bp.pdf" target="_blank">PDF (DE)</a>`);
    return links.length?`<div class="product-text-links">${links.join('<span class="text-link-sep">·</span>')}</div>`:'';
  };

  /* Kept for compatibility with older callers; now returns plain text, no chips/icons. */
  F.meta=(p,U)=>F.copyableCore(p,U);
  F.details=(p,U)=>F.propertyText(p,U);
})(window.RXDE);


(function(R){
  const V=R.UISearchView={},Forms=R.Forms;
  V.suggestionRow=(p,{U,S,Cart})=>{
    const rub=U.rub(p.eur,S.get().rate),q=Cart.qty(p.pzn),sumR=U.rub(p.eur,S.get().rate)*q;
    const familyToken=(String(p.name||'').trim().split(/\s+/)[0]||'').replace(/[®™,:;]+$/g,'').trim();
    const familyActive=familyToken&&U.norm(S.get().query||'')===U.norm(familyToken);
    const pages=window.RXDE_PRODUCT_PAGES||{};
    const page=pages[U.pzn(p.pzn)]?`p/${encodeURIComponent(U.pzn(p.pzn))}/`:`product.html?pzn=${encodeURIComponent(U.pzn(p.pzn))}`;
    const image=p.image||`img/${U.pzn(p.pzn)}.jpg`;
    return `<div class="suggest-row suggest-row-copyable suggest-row-with-photo ${q?'selected':''}" data-suggest-pzn="${p.pzn}">
      <div class="suggest-photo" data-suggest-photo="${p.pzn}" title="Открыть большое фото">
        <img src="${U.escape(image)}" alt="${U.escape(p.name)}" onerror="this.outerHTML='<span class=&quot;image-fallback rxde-placeholder&quot; aria-label=&quot;Фото товара отсутствует&quot;><span class=&quot;rxde-placeholder-mark&quot;><b>Rx</b><em>De</em></span></span>'">
      </div>
      <div class="suggest-main suggest-copy-zone">
        <div class="suggest-title-line"><a class="suggest-title suggest-title-open" href="${U.escape(page)}" data-suggest-title-open="${p.pzn}">${U.escape(p.name)}</a>${p.rx?'<span class="rx-badge" title="RX — требуется предоставить рецепт. Условия отпуска уточняются перед закупкой.">RX</span>':''}<button class="family-search-button suggest-family-search ${familyActive?'family-return':''}" type="button" data-family-search="${p.pzn}" aria-label="${familyActive?'Вернуться к предыдущему экрану':`Искать варианты ${U.escape(p.name)}`}" title="${familyActive?'Нажмите ещё раз — вернуться назад':'Найти варианты по названию'}"><svg class="system-search-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.25"></circle><path d="M12.4 12.4L17 17"></path></svg></button></div>
        <div class="copy-line copy-substance suggest-mnn"><b>МНН:</b> ${U.escape(p.substance||'—')}</div>
        ${p.form?`<div class="copy-line"><span>Form:</span> ${U.escape(p.form)}</div>`:''}
        ${p.maker?`<div class="copy-line"><span>Hersteller:</span> ${U.escape(p.maker)}</div>`:''}
        <div class="copy-line copy-pzn"><span>PZN:</span> ${U.escape(p.pzn)}</div>
      </div>
      <div class="suggest-side">
        <span class="suggest-price"><b>${U.money(rub)} ₽</b><small>${U.money(p.eur)} €</small></span>
        ${q?`<div class="suggest-stepper" aria-label="Количество">
          <button type="button" data-suggest-delta="-1" data-pzn="${p.pzn}">−</button>
          <b>${q}</b>
          <button type="button" data-suggest-delta="1" data-pzn="${p.pzn}">+</button>
        </div>`:`<button type="button" class="suggest-add-zero" data-suggest-delta="1" data-pzn="${p.pzn}">Добавить</button>`}
      </div>
      <div class="suggest-picked ${q?'selected':''}" data-suggest-picked="${p.pzn}">${q?`${q} уп. · ${U.money(sumR)} ₽`:''}</div>
    </div>`;
  };
})(window.RXDE);


(function(R){
  const KEY='rxde:orderExpiry:v1';
  let data={};try{data=JSON.parse(sessionStorage.getItem(KEY)||'{}')||{}}catch(_){data={}}
  const store=()=>{try{sessionStorage.setItem(KEY,JSON.stringify(data))}catch(_){}};
  function expiryMonthLabel(months){
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit'}).formatToParts(new Date());
    const year=Number(parts.find(x=>x.type==='year').value),month=Number(parts.find(x=>x.type==='month').value);
    const date=new Date(Date.UTC(year,month-1+Number(months),1));
    return String(date.getUTCMonth()+1).padStart(2,'0')+'/'+date.getUTCFullYear();
  }
  R.expiryMonthLabel=expiryMonthLabel;
  R.OrderExpiry={
    get(pzn){return data[String(pzn)]||null},
    set(pzn,value){if(value&&((value.mode==='months'&&Number(value.months)>0)||(value.mode==='date'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value.date))||String(value.comment||'').trim()))data[String(pzn)]=value;else delete data[String(pzn)];store()},
    remove(pzn){delete data[String(pzn)];store()},
    prune(cart){const keep=new Set(cart.map(x=>String(x.pzn)));for(const k of Object.keys(data))if(!keep.has(k))delete data[k];store()},
    line(pzn){const x=data[String(pzn)];if(!x)return '';const expiry=x.months>0?(x.mode==='date'?'!! срок годности не ранее '+x.date.slice(5,7)+'/'+x.date.slice(0,4):'!! срок годности от '+x.months+' мес. ('+expiryMonthLabel(x.months)+')'):'';return [expiry,x.comment?'Пожелание по упаковке: '+x.comment:''].filter(Boolean).join('\n')}
  };
})(window.RXDE);

(function(R){
  const V=R.UIOrderView={};


  V.compactLine=(it,i,{U,S,P})=>{
    const p=P.byPzn.get(it.pzn);if(!p)return'';
    const unitR=U.rub(p.eur,S.get().rate),sumE=p.eur*it.qty,sumR=unitR*it.qty;
    const familyToken=(String(p.name||'').trim().split(/\s+/)[0]||'').replace(/[®™,:;]+$/g,'').trim();
    const familyActive=familyToken&&U.norm(S.get().query||'')===U.norm(familyToken);
    const pages=window.RXDE_PRODUCT_PAGES||{}, page=typeof pages[p.pzn]==='string'?pages[p.pzn]:(pages[p.pzn]===true?`p/${p.pzn}/`:'');
    const image=p.image||`img/${U.pzn(p.pzn)}.jpg`;
    const cartDisplayName=String(p.name||'').replace(/^\s*\[(?:rx|рх)\]\s*/i,'').trim();
    return `<div class="order-product-row order-static-card" data-pzn="${p.pzn}">
      <div class="order-thumb">
        <span class="order-num-badge" draggable="true" data-drag-pzn="${p.pzn}" aria-label="Переместить позицию ${String(i+1).padStart(2,'0')}" title="Перетащите за номер, чтобы изменить порядок">${String(i+1).padStart(2,'0')}</span>
        <img src="${U.escape(image)}" alt="${U.escape(p.name)}" onerror="this.outerHTML='<span class=&quot;image-fallback rxde-placeholder order-rxde-placeholder&quot; aria-label=&quot;Фото товара отсутствует&quot;><span class=&quot;rxde-placeholder-mark&quot;><b>Rx</b><em>De</em></span></span>'">
      </div>
      <div class="order-product-info copyable-card-info">
        <div class="order-title-line"><button type="button" class="order-expand-title selectable-title order-title-open" data-order-title-open="${p.pzn}">${U.escape(cartDisplayName)}${(p.rx||/^\s*\[(?:rx|рх)\]/i.test(p.name))?'<span class="rxde-cart-rx-text" title="Рецептурный препарат"> [Rx]</span>':''}</button><button class="order-family-search ${familyActive?'family-return':''}" type="button" data-order-family-search="${p.pzn}" aria-label="${familyActive?'Вернуться к предыдущему экрану':`Найти другие варианты ${U.escape(p.name)}`}" title="${familyActive?'Нажмите ещё раз — вернуться назад':'Найти варианты по названию'}"><svg class="system-search-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.25"></circle><path d="M12.4 12.4L17 17"></path></svg></button></div>
        ${R.UIFormat.copyableCore(p,U,{compact:true})}
        <div class="rxde-expiry-tools"><button type="button" class="rxde-expiry-toggle" title="Запросить партию с увеличенным сроком годности" data-expiry-toggle="${p.pzn}">Пожелание по сроку / упаковке</button>${R.OrderExpiry?.get(p.pzn)?`<span class="rxde-expiry-pill">${U.escape(R.OrderExpiry.line(p.pzn))}</span>`:''}</div>
        <div class="rxde-expiry-editor" data-expiry-editor="${p.pzn}" hidden>
          <div class="rxde-expiry-sheet-head"><h2 class="rxde-expiry-heading">Срок годности</h2></div>
          <div class="rxde-expiry-sheet-content">
            <p class="rxde-expiry-explainer">Ищем партию с увеличенным сроком годности. Обычно 6–12 мес.; поиск может занять больше времени.</p>
            <label class="rxde-expiry-months-row" for="rxde-expiry-months-${p.pzn}"><span>Не менее</span>
              <input id="rxde-expiry-months-${p.pzn}" type="number" inputmode="numeric" data-expiry-months min="1" max="120" value="${R.OrderExpiry?.get(p.pzn)?.months||12}" aria-label="Минимальный срок годности в месяцах"> <span>мес.</span>
            </label>
            <p class="rxde-expiry-date-preview">Ориентир: от <strong data-expiry-preview>${R.expiryMonthLabel(R.OrderExpiry?.get(p.pzn)?.months||12)}</strong></p>
            <label class="rxde-item-comment-label">Комментарий <small>(необязательно)</small><textarea data-expiry-comment maxlength="160" rows="2" placeholder="Например: упаковка с синей полосой">${U.escape(R.OrderExpiry?.get(p.pzn)?.comment||'')}</textarea></label>
          </div>
          <div class="rxde-expiry-sheet-actions"><button type="button" data-expiry-cancel>Отмена</button><button type="button" data-expiry-save="${p.pzn}">Сохранить</button></div>
          ${R.OrderExpiry?.get(p.pzn)?`<button type="button" class="rxde-expiry-remove" data-expiry-clear="${p.pzn}">Убрать требование</button>`:''}
        </div>
      </div>
      <div class="order-unit-price"><small>за упаковку</small><strong>${U.money(unitR)} ₽</strong><span>${U.money(p.eur)} €</span></div>
      <div class="order-qty qty-stepper">
        <button data-order-delta="-1" data-pzn="${p.pzn}" type="button">−</button>
        <input data-order-qty="${p.pzn}" type="number" value="${it.qty}" min="0" max="999">
        <button data-order-delta="1" data-pzn="${p.pzn}" type="button">+</button>
      </div>
      <div class="order-line-total"><strong>${U.money(sumR)} ₽</strong><span>${U.money(sumE)} €</span></div>
      <button class="compact-delete" data-order-delete="${p.pzn}" type="button" aria-label="Удалить ${U.escape(p.name)} из заказа" title="Удалить товар">×</button>
    </div>`;
  };

  V.logisticsLine=({U,S,Cart},compact=false)=>{
    const t=Cart.totals();
    if(!t.positions)return'';
    const rub=U.rub(t.shippingEur,S.get().rate);
    if(compact){
      return `<div class="compact-logistics-line">
        <span class="logistics-mark">DHL</span>
        <span class="compact-logistics-copy"><b>Почта DHL · до 5 кг</b><small>из Германии · обязательный тариф</small></span>
        <span class="compact-logistics-eur">${U.money(rub)} ₽</span>
        <strong class="compact-logistics-rub">${U.money(t.shippingEur)} €</strong>
      </div>`;
    }
    return `<div class="order-line logistics-line">
      <span class="order-num">—</span>
      <div class="logistics-mark">DHL</div>
      <div class="product-main"><div class="product-title-line"><span class="product-title">Почта DHL · до 5 кг</span></div><div class="product-meta">из Германии · обязательный тариф</div></div>
      <div class="product-price"><small>тариф</small><strong>${U.money(rub)} ₽</strong><span>${U.money(t.shippingEur)} €</span></div>
      <div></div>
      <div class="product-total"><strong>${U.money(rub)} ₽</strong><span>${U.money(t.shippingEur)} €</span></div>
      <div></div>
    </div>`;
  };

  V.miniReceipt=({U,S,P,Cart})=>{
    const t=Cart.totals(),rate=S.get().rate;
    let h=S.get().cart.map((it,i)=>{
      const p=P.byPzn.get(it.pzn);if(!p)return'';
      const sumE=p.eur*it.qty,unitR=U.rub(p.eur,rate),sumR=unitR*it.qty;
      const attrs=[p.form,p.maker,`PZN ${p.pzn}`].filter(Boolean).map(U.escape).join(' · ');
      return `<div class="presend-row">
        <em class="presend-num">${String(i+1).padStart(2,'0')}.</em>
        <div class="presend-copy">
          <div class="presend-name">${U.escape(p.name)}</div>
          <div class="presend-meta">${attrs}</div>
          <div class="presend-price"><b>${U.money(p.eur)} €/уп.</b><span class="presend-rub-hint">${U.money(unitR)} ₽/уп.</span></div>
        </div>
        <div class="presend-qty">× ${it.qty}<small>${it.qty} уп.</small></div>
        <strong class="presend-sum"><span>${U.money(sumE)} €</span><small>${U.money(sumR)} ₽</small></strong>
      </div>`;
    }).join('');
    if(t.positions){
      const sr=U.rub(t.shippingEur,rate);
      h+=`<div class="presend-row presend-logistics">
        <em class="presend-num presend-num-logistics" aria-hidden="true"></em>
        <div class="presend-copy">
          <div class="presend-name">Почта DHL · до 5 кг</div>
          <div class="presend-meta">из Германии · обязательный тариф</div>
          <div class="presend-price"><b>${U.money(t.shippingEur)} €</b><span class="presend-rub-hint">${U.money(sr)} ₽</span></div>
        </div>
        <div class="presend-qty"><small>тариф</small></div>
        <strong class="presend-sum"><span>${U.money(t.shippingEur)} €</span><small>${U.money(sr)} ₽</small></strong>
      </div>`;
    }
    h+=`<div class="presend-total"><span><b>${t.positions} поз.</b><b>${t.packs} уп.</b><small>${U.money(t.eur)} € · курс ${rate.toFixed(2)} ₽/€</small></span><strong>${U.money(t.rub)} ₽</strong></div>`;
    return h;
  };
})(window.RXDE);


(function(R){
  let frozenPageY=0;
  const M=R.UIMobile={};
  M.isMobile=()=>document.documentElement.classList.contains('rxde-mobile-ui')||window.matchMedia('(max-width:760px)').matches;
  M.blurSearch=input=>{if(document.activeElement===input)input.blur()};
  M.freezePage=()=>{
    if(document.body.classList.contains('page-frozen'))return;
    frozenPageY=window.scrollY||document.documentElement.scrollTop||0;
    document.body.style.top=`-${frozenPageY}px`;
    document.body.classList.add('page-frozen');
  };
  M.unfreezePage=(restore=true)=>{
    if(!document.body.classList.contains('page-frozen'))return;
    document.body.classList.remove('page-frozen');
    document.body.style.top='';
    if(restore)window.scrollTo({top:frozenPageY,behavior:'auto'});
  };
})(window.RXDE);


(function(R){
  const U=R.Utils,S=R.Store,P=R.Products,Q=R.Search,Cart=R.Cart,Forms=R.Forms;
  const Format=R.UIFormat,SearchView=R.UISearchView,OrderView=R.UIOrderView,Mobile=R.UIMobile;
  const el={}; let filtered=[]; let activeFormFilter=''; let activeFormFilters=new Set(); let activeFormKey=''; let formFilterEngaged=false; let formCompareAnchorPzn=''; let formCompareReturnY=0; let formCompareSourceKey=''; let formChooser=null; let catalogSort='catalog'; let nameSortDir=''; let priceSortDir=''; let sortPrimary=''; let activeDoseFilter=''; let activeDoseKey=''; let formBadgeReturnContext=null; const deleteJobs=new Map(); let dragPzn=null; let lastClearedCart=null; let restoringClearedCart=false;
  const navBridge={fromOrder:false,pzn:'',orderScrollTop:0,searchSnapshot:null,searchScrollY:0};
  const NAV_KEY='rxde:navigationTrail:v1';
  const RECENT_KEY='rxde:recentVisits:v2';
  function navLoad(){try{const x=JSON.parse(sessionStorage.getItem(NAV_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
  function navSave(a){try{sessionStorage.setItem(NAV_KEY,JSON.stringify(a.slice(-8)))}catch(_){}}
  function recentLoad(){try{const x=JSON.parse(sessionStorage.getItem(RECENT_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
  function recentSave(a){try{sessionStorage.setItem(RECENT_KEY,JSON.stringify(a.slice(-14)))}catch(_){}}
  function entrySig(x){if(!x)return'';const st=x.state||{};return [x.kind||'',x.label||'',x.url||'',st.query||'',st.category||'',st.subcategory||'',(st.expanded||[]).join(',')].join('|')}
  function recentRecord(entry){if(!entry)return;const a=recentLoad(),sig=entrySig(entry);for(let i=a.length-1;i>=0;i--){if(entrySig(a[i])===sig)a.splice(i,1)}a.push(entry);recentSave(a);if(el.flowNav)renderFlowNav()}
  function navCurrentLabel(){const st=S.get();if(st.query)return `Поиск «${st.query}»`;if(st.subcategory)return st.subcategory;if(st.category)return st.category;if(st.home)return'Главная';return'Весь каталог'}
  function navSnapshot(label=navCurrentLabel()){
    const st=S.get();return{kind:'catalog',label,url:location.pathname+location.search,scrollY:window.scrollY||0,state:{home:!!st.home,query:st.query||'',category:st.category||'',subcategory:st.subcategory||'',mobileSearchScope:st.mobileSearchScope||'global',searchScrollCategory:st.searchScrollCategory||0,searchScrollGlobal:st.searchScrollGlobal||0,limit:st.limit||R.Constants.PAGE_SIZE,categoryLimit:st.categoryLimit||20,globalLimit:st.globalLimit||20,expanded:Array.from(st.expanded||[])}};
  }
  function navPush(entry=navSnapshot()){
    const a=navLoad(),last=a[a.length-1];
    if(last&&last.kind===entry.kind&&last.label===entry.label&&last.url===entry.url){a[a.length-1]=entry}else a.push(entry);
    navSave(a);renderFlowNav();
  }
  function navGo(entry,consume=false){if(!entry)return;if(consume){const a=navLoad();a.pop();navSave(a)}
    // Both ordinary catalogue states and an expanded inline product are states of the SAME catalogue page.
    // Never reload index.html for product-inline: a reload loses the saved category/search/scroll context.
    if(entry.kind==='catalog'||entry.kind==='product-inline'){
      const st=entry.state||{};
      S.set({...st,home:!!st.home,expanded:new Set(st.expanded||[])});
      el.searchInput.value=st.query||'';
      renderProducts();renderSearchScope();hideSuggestions();
      requestAnimationFrame(()=>window.scrollTo({top:Number(entry.scrollY)||0,behavior:'auto'}));
      renderFlowNav();
      return;
    }
    if(entry.url)location.href=entry.url;
  }
  function renderFlowNav(){
    if(!el.flowNav)return;const st=S.get(),a=navLoad(),prev=a[a.length-1];
    const current=navCurrentLabel();
    // v0.82: the search is always global; the active notebook tab is only a priority/context.
    if(el.searchInput){
      const cat=String(st.category||'').trim();
      el.searchInput.placeholder=cat
        ? `Название, вещество или PZN · приоритет: ${cat}`
        : 'Название, действующее вещество или PZN · вся база';
      el.searchInput.title=cat
        ? 'Поиск по всему каталогу RXDE, независимо от выбранной категории.'
        : 'Поиск по всей базе RXDE';
    }
    // Navigation is structural: as soon as the user leaves Home, always show where they are.
    // History may still be empty on the very first transition, but breadcrumbs must not disappear.
    // The context bar is a permanent part of RXDE. It must not disappear on Home.
    el.flowNav.hidden=false;
    // On a first-level category the breadcrumb already gives the way home; a second "← Главная" is redundant.
    const firstLevelBrowse=!st.home&&!st.query&&!st.subcategory&&Boolean(st.category);
    if(el.flowBack){
      // v0.82: the permanent notebook bar has one geometry in every state.
      // Back navigation lives in breadcrumbs/history; the variable-width previous-screen button is not rendered here.
      el.flowBack.hidden=true;
      el.flowBack.disabled=!prev;
      el.flowBackLabel.textContent=prev?prev.label:'Главная';
    }
    if(el.flowCrumbs){
      if(st.home){
        el.flowCrumbs.innerHTML='<strong class="crumb-current" aria-current="page">Главная</strong>';
      }else{
        el.flowCrumbs.innerHTML=`<button type="button" data-flow-home title="Вернуться на главную">Главная</button><span class="crumb-sep">/</span><strong class="crumb-current" aria-current="page">${U.escape(current)}</strong>`;
      }
    }
    if(el.flowContextMeta){
      let count=0;
      if(st.query){
        const g=Q.split(st.query,st.category,st.subcategory);
        count=g.all.length; // Searching always uses the complete catalogue.
      }else count=Q.browse(st.category,st.subcategory).length;
      el.flowContextMeta.textContent=`${count} ${count%10===1&&count%100!==11?'товар':(count%10>=2&&count%10<=4&&(count%100<10||count%100>=20)?'товара':'товаров')}`;
    }
    if(el.flowHistoryCount)el.flowHistoryCount.textContent='';
    const visits=recentLoad();
    const currentEntry=navSnapshot(current);
    const currentSig=entrySig(currentEntry);
    const candidates=[...visits].filter(x=>entrySig(x)!==currentSig);
    if(el.mobileRecentTrail){
      const recentButton=`<button type="button" class="recent-more recent-more-labeled" data-mobile-history-more aria-label="Показать всю историю"><span aria-hidden="true">◷</span> Недавние</button>`;
      if(firstLevelBrowse){
        el.mobileRecentTrail.innerHTML=`<button type="button" data-mobile-flow-home class="mobile-struct-home">Главная</button><span class="recent-sep">›</span><strong class="mobile-struct-current">${U.escape(current)}</strong>${recentButton}`;
      }else{
        const recent=candidates.slice(-2);
        const items=recent.map((x,i)=>{const idx=visits.indexOf(x);const mark=x.kind==='page'?'↗':x.kind==='product-inline'?'▣':'';return `<button type="button" data-mobile-recent-index="${idx}" title="Вернуться: ${U.escape(x.label)}">${mark?`<span class="recent-kind-mark">${mark}</span>`:''}${U.escape(x.label)}</button>`}).join('<span class="recent-sep">›</span>');
        el.mobileRecentTrail.innerHTML=`${items||'<span class="recent-empty-inline">Текущий экран</span>'}${recentButton}`;
      }
    }
    if(el.flowHistoryMenu){
      const recent=candidates.slice(-7).reverse();
      const icon=x=>x.kind==='page'?'↗':(x.kind==='product-inline'?'▣':(String(x.label||'').startsWith('Поиск')?'⌕':(x.label==='Главная'?'⌂':'•')));
      const now=`<div class="flow-history-head"><span>Сейчас</span><strong>${U.escape(current)}</strong></div>`;
      const rows=recent.length?recent.map(x=>{const idx=visits.indexOf(x);return `<button type="button" class="${(x.kind==='product-inline'||x.kind==='page')?'history-product':''}" data-recent-index="${idx}"><span class="history-kind">${icon(x)}</span><span class="history-copy"><strong>${U.escape(x.label)}</strong><small>${x.kind==='product-inline'?'раскрытый товар':x.kind==='page'?'полная карточка':'недавний переход'}</small></span></button>`}).join(''):'<span class="history-empty">История пока пуста</span>';
      el.flowHistoryMenu.innerHTML=now+`<div class="flow-history-list">${rows}</div>`;
    }
    if(el.orderFlowNav){el.orderFlowNav.hidden=!S.get().orderOpen;el.orderFlowBackLabel.textContent=current}
    el.flowNav.classList.remove('nav-booting');
  }
  function refs(){['searchInput','clearSearch','searchSuggest','searchScopeButton','searchScopeLabel','searchScopeMenu','categoryStrip','contextLine','subcategoryStrip','formFilterStrip','doseFilterStrip','productList','loadMore','headerCalcRate','headerCbrRate','headerCbrDate','rateSourceBadge','flipDate','flipMonth','flipDay','flipYear','desktopOrderDock','desktopOrderMeta','desktopOrderTotal','quickOrderDock','quickOrderMeta','quickOrderTotal','searchWrap','orderBackdrop','orderSheet','closeOrder','addOrderProduct','clearOrder','rateValue','orderLines','orderPositions','orderTotalRub','orderTotalEur','orderHeaderStatus','orderHeaderMeta','orderHeaderTotal','submitOrder','confirmBackdrop','closeConfirm','miniReceipt','phoneInput','preinvoiceQuestion','confirmSubmit','questionBackdrop','closeQuestion','questionText','sendQuestion','brandHome','orderBrandHome','soundToggle','flowNav','flowBack','flowBackLabel','flowCrumbs','flowHistoryToggle','flowHistoryMenu','flowHistoryCount','flowContextMeta','mobileRecentTrail','mobileRateSummary','orderFlowNav','orderFlowBack','orderFlowBackLabel','homeView','homeCategories','homeOpenCatalog','footerQuestion','catalogHero','catalogToolbar','catalogCount','formFilterToggle','catalogFormSelect','catalogSortControl'].forEach(id=>el[id]=document.getElementById(id));}
  function pageUrl(pzn){pzn=U.pzn(pzn);const m=window.RXDE_PRODUCT_PAGES||{};return m[pzn]?`p/${encodeURIComponent(pzn)}/`:`product.html?pzn=${encodeURIComponent(pzn)}`}
  function imageSrc(p){return p.image||`img/${U.pzn(p.pzn)}.jpg`}
  function meta(p){return Format.meta(p,U)}
  function details(p){return Format.details(p,U)}
  function hideSuggestions(){
    if(!el.searchSuggest)return;
    el.searchSuggest.hidden=true;
    el.searchSuggest.innerHTML='';
  }

  function suggestionRow(p){return SearchView.suggestionRow(p,{U,S,Cart})}

  function openMissingProductQuestion(){
    const query=String(el.searchInput?.value||S.get().query||'').trim();
    const field=el.questionText||document.getElementById('questionText');
    if(field && !field.value.trim() && query)field.value=`Здравствуйте! Не нашёл в каталоге: ${query}. Можно заказать?`;
    hideSuggestions();
    blurSearch();
    if(!el.questionBackdrop)return;
    el.questionBackdrop.hidden=false;
    if(isMobile())setMobileMode('question');
    setTimeout(()=>field?.focus({preventScroll:true}),60);
  }
  document.addEventListener('click',e=>{
    if(!e.target.closest?.('[data-rxde-no-results-contact]'))return;
    e.preventDefault();e.stopImmediatePropagation();
    openMissingProductQuestion();
  },true);

  function renderSuggestions(){
    if(!el.searchSuggest)return;
    const q=el.searchInput.value.trim();
    if(document.activeElement!==el.searchInput || q.length<1){hideSuggestions();return}

    const all=Q.global(q);
    if(!all.length){
      el.searchSuggest.innerHTML=`<div class="suggest-empty rxde-empty-search">Ничего не найдено в каталоге.<button type="button" class="rxde-empty-contact" data-rxde-no-results-contact>Напишите нам →</button></div>`;
      el.searchSuggest.hidden=false;
      return;
    }

    const suggestionLimit=isMobile()?8:8;
    const shown=all.slice(0,suggestionLimit);
    let html=shown.map(suggestionRow).join('');
    if(all.length>suggestionLimit){
      html+=`<button class="suggest-show-all" type="button" data-suggest-all>Показать все ${all.length} результатов →</button>`;
    }
    el.searchSuggest.innerHTML=html;
    el.searchSuggest.hidden=false;
  }

  function ensurePhotoZoom(host){
    const expandedHost=host?.closest?.('.product-row.expanded,.order-product-row.order-expanded');
    if(!host||innerWidth<=760||!expandedHost)return null;
    const img=host.querySelector('img');
    if(!img||!img.complete||!img.naturalWidth||!img.naturalHeight)return null;
    let lens=host.querySelector('.photo-zoom-lens');
    if(!lens){
      lens=document.createElement('span');
      lens.className='photo-zoom-lens';
      lens.setAttribute('aria-hidden','true');

      const outer=document.createElement('canvas');
      outer.className='photo-zoom-canvas photo-zoom-outer';
      outer.width=500; outer.height=500;

      const inner=document.createElement('canvas');
      inner.className='photo-zoom-canvas photo-zoom-inner';
      inner.width=500; inner.height=500;

      lens.appendChild(outer);
      lens.appendChild(inner);
      host.appendChild(lens);
    }
    lens.hidden=false;
    return lens;
  }

  function drawZoomCrop(canvas,img,sx,sy,zoom){
    const ctx=canvas?.getContext('2d');
    if(!ctx)return;
    const srcW=img.naturalWidth/zoom;
    const srcH=img.naturalHeight/zoom;
    let srcX=sx-srcW/2;
    let srcY=sy-srcH/2;
    srcX=Math.max(0,Math.min(img.naturalWidth-srcW,srcX));
    srcY=Math.max(0,Math.min(img.naturalHeight-srcH,srcY));
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,srcX,srcY,srcW,srcH,0,0,canvas.width,canvas.height);
  }

  function movePhotoZoom(host,e){
    const lens=ensurePhotoZoom(host),img=host?.querySelector('img');
    if(!lens||!img)return;

    const hostRect=host.getBoundingClientRect();
    const imgRect=img.getBoundingClientRect();

    const dx=Math.max(0,Math.min(imgRect.width,e.clientX-imgRect.left));
    const dy=Math.max(0,Math.min(imgRect.height,e.clientY-imgRect.top));

    lens.style.left=`${e.clientX-hostRect.left}px`;
    lens.style.top=`${e.clientY-hostRect.top}px`;

    const sx=dx/imgRect.width*img.naturalWidth;
    const sy=dy/imgRect.height*img.naturalHeight;

    /* Outer ring gives context at half the inner magnification.
       Inner lens (2/3 diameter) preserves the current 4.6x detail zoom. */
    drawZoomCrop(lens.querySelector('.photo-zoom-outer'),img,sx,sy,1.7);
    drawZoomCrop(lens.querySelector('.photo-zoom-inner'),img,sx,sy,4.6);
  }

  function hidePhotoZoom(host){
    const lens=host?.querySelector('.photo-zoom-lens');
    if(lens)lens.hidden=true;
  }

  function ensureProductLightbox(){
    let box=document.getElementById('product-photo-lightbox');
    if(box)return box;

    box=document.createElement('div');
    box.id='product-photo-lightbox';
    box.className='product-photo-lightbox';
    box.hidden=true;
    box.innerHTML=`<div class="product-photo-lightbox-stage" role="dialog" aria-modal="true" aria-label="Фото товара">
      <button type="button" class="product-photo-lightbox-close" aria-label="Закрыть фото" title="Закрыть">×</button>
      <img alt="">
    </div>`;
    document.body.appendChild(box);

    const close=()=>{
      const snap=box._quickSearchSnapshot||null;

      box.hidden=true;
      document.documentElement.classList.remove('product-lightbox-open');
      document.body.classList.remove('quick-search-photo-open');
      const img=box.querySelector('img');
      if(img){img.removeAttribute('src');img.alt='';}

      if(snap && el.searchSuggest && el.searchInput){
        /* Restore the already-rendered screen exactly; no search/navigation/render call. */
        if(el.searchSuggest.innerHTML!==snap.html)el.searchSuggest.innerHTML=snap.html;
        el.searchSuggest.hidden=snap.hidden;
        el.searchSuggest.scrollTop=snap.scrollTop;
        if(el.searchInput.value!==snap.query)el.searchInput.value=snap.query;
        try{
          if(snap.selectionStart!=null)el.searchInput.setSelectionRange(snap.selectionStart,snap.selectionEnd??snap.selectionStart);
        }catch(_){}
      }

      box._quickSearchSnapshot=null;
      delete box.dataset.restoreQuickSearch;
    };
    box._rxdeClose=close;
    box.addEventListener('pointerdown',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
    },true);
    box.addEventListener('click',e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      if(e.target===box||e.target.closest('.product-photo-lightbox-close'))close();
    },true);
    return box;
  }

  function openProductLightbox(img){
    if(!img?.src)return;
    const box=ensureProductLightbox();
    const large=box.querySelector('img');

    const fromQuickSearch=!!img.closest?.('.suggest-row');
    if(fromQuickSearch){
      box._quickSearchSnapshot={
        html:el.searchSuggest?.innerHTML||'',
        scrollTop:el.searchSuggest?.scrollTop||0,
        hidden:!!el.searchSuggest?.hidden,
        query:el.searchInput?.value||'',
        selectionStart:el.searchInput?.selectionStart,
        selectionEnd:el.searchInput?.selectionEnd
      };
      box.dataset.restoreQuickSearch='1';
      document.body.classList.add('quick-search-photo-open');
    }else{
      box._quickSearchSnapshot=null;
      document.body.classList.remove('quick-search-photo-open');
      delete box.dataset.restoreQuickSearch;
    }

    large.src=img.currentSrc||img.src;
    large.alt=img.alt||'Фото товара';
    box.hidden=false;
    document.documentElement.classList.add('product-lightbox-open');
  }

  function expandedPhotoFromTarget(target){
    if(!target?.closest)return null;
    if(target.closest('.form-badge,[data-card-form-filter]'))return null;
    const direct=target.closest('.product-row .product-photo img,.mnq-photo.product-photo img,.order-product-row .order-thumb img,.suggest-row .suggest-photo img');
    if(direct)return direct;
    const host=target.closest('.product-row .product-photo,.mnq-photo.product-photo,.order-product-row .order-thumb,.suggest-row .suggest-photo');
    return host?.querySelector?.('img')||null;
  }

  async function copyPzn(value){
    const text=U.pzn(value);
    try{await navigator.clipboard.writeText(text);U.toast(`PZN ${text} скопирован`);U.haptic?.('tick');return}catch(_){}
    try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();U.toast(`PZN ${text} скопирован`);U.haptic?.('tick')}catch(_){U.toast(`PZN ${text}`)}
  }

  function showRxNotice(){U.toast('RX: требуется предоставить рецепт. Условия отпуска уточняются перед закупкой.');}

  function quickViewNumber(value){
    const m=String(value||'').replace(',','.').match(/(\d+(?:\.\d+)?)/);
    return m?Number(m[1]):Number.NaN;
  }
  function quickViewFamilyProducts(product,max=50){
    if(!product)return[];
    const brand=U.norm(String(product.name||'').split(/\s+/)[0]||'');
    const subst=U.norm(product.substance||'');
    const maker=U.norm(product.maker||'');
    const cat=String(product.category||'');
    const currentForm=Forms.kind(product.form);
    const currentDose=quickViewNumber(product.dosage);
    const currentSize=quickViewNumber(product.size);

    return P.all
      .map(x=>{
        const xb=U.norm(String(x.name||'').split(/\s+/)[0]||'');
        let family=0;
        if(brand&&xb===brand)family+=150;
        if(subst&&U.norm(x.substance||'')===subst)family+=100;
        if(maker&&U.norm(x.maker||'')===maker)family+=28;
        if(cat&&x.category===cat)family+=10;
        if(brand&&U.norm(x.name||'').includes(brand))family+=8;

        const sameForm=Forms.kind(x.form)===currentForm?0:1;
        const dose=quickViewNumber(x.dosage);
        const size=quickViewNumber(x.size);
        const doseDistance=Number.isFinite(currentDose)&&Number.isFinite(dose)?Math.abs(currentDose-dose):999999;
        const sizeDistance=Number.isFinite(currentSize)&&Number.isFinite(size)?Math.abs(currentSize-size):999999;
        return {p:x,family,sameForm,doseDistance,sizeDistance};
      })
      .filter(x=>x.family>=100)
      .sort((a,b)=>
        a.sameForm-b.sameForm ||
        a.doseDistance-b.doseDistance ||
        a.sizeDistance-b.sizeDistance ||
        b.family-a.family ||
        a.p.name.localeCompare(b.p.name)
      )
      .slice(0,max)
      .map(x=>x.p);
  }
  function quickViewFormKinds(items){
    const map=new Map();
    for(const p of items){
      const key=Forms.kind(p.form);
      map.set(key,(map.get(key)||0)+1);
    }
    return FORM_FILTER_ORDER.filter(k=>(map.get(k)||0)>0).map(k=>[k,map.get(k)]);
  }

  function compareContextKey(st){return [st.home?'1':'0',U.norm(st.query),st.category||'',st.subcategory||''].join('|')}
  function compareFamilyProducts(product){
    if(!product)return[];
    const family=quickViewFamilyProducts(product,120);
    const dose=U.norm(product.dosage||'');
    if(!dose)return family;
    const sameDose=family.filter(x=>U.norm(x.dosage||'')===dose);
    // Prefer exact dosage, but never produce a dead-end if the source data uses
    // inconsistent dosage formatting for the same medicine family.
    return sameDose.length>=2?sameDose:family;
  }
  function ensureFormChooser(){
    if(formChooser&&document.body.contains(formChooser))return formChooser;
    formChooser=document.createElement('div');
    formChooser.className='form-chooser-popover';
    formChooser.hidden=true;
    document.body.appendChild(formChooser);
    return formChooser;
  }
  function closeFormChooser(){if(formChooser)formChooser.hidden=true}
  function showFormChooser(product,badge){
    const family=compareFamilyProducts(product);
    const kinds=quickViewFormKinds(family);
    if(!kinds.length)return;
    const pop=ensureFormChooser();
    const dose=product.dosage?` · ${U.escape(product.dosage)}`:'';
    pop.innerHTML=`<div class="form-chooser-head"><strong>Сравнить формы</strong><span>${U.escape(product.name)}${dose}</span><button type="button" data-form-chooser-close aria-label="Закрыть">×</button></div><div class="form-chooser-actions"><button type="button" class="form-choice all" data-form-choice="">Все формы <b>${family.length}</b></button>${kinds.map(([k,count])=>{const inf=Forms.INFO[k]||Forms.INFO.other;return `<button type="button" class="form-choice form-${k}" data-form-choice="${k}">${U.escape(inf.label)} <b>${count}</b></button>`}).join('')}</div><div class="form-chooser-note">Только варианты этого препарата${product.dosage?' в той же дозировке':''}</div>`;
    const r=badge.getBoundingClientRect();
    pop.hidden=false;
    const w=Math.min(420,Math.max(280,window.innerWidth-20));
    pop.style.width=`${w}px`;
    const pr=pop.getBoundingClientRect();
    let left=Math.min(window.innerWidth-pr.width-10,Math.max(10,r.left));
    let top=r.bottom+8;
    if(top+pr.height>window.innerHeight-10)top=Math.max(10,r.top-pr.height-8);
    pop.style.left=`${left}px`;pop.style.top=`${top}px`;
    pop.dataset.anchorPzn=product.pzn;
  }
  function enterFormCompare(pzn,kind=''){
    const product=P.byPzn.get(U.pzn(pzn));if(!product)return;
    formCompareReturnY=window.scrollY||0;
    formCompareAnchorPzn=product.pzn;
    formCompareSourceKey=compareContextKey(S.get());
    formFilterEngaged=true;
    activeFormKey='compare:'+product.pzn;
    activeFormFilter=kind||'';
    closeFormChooser();
    S.set({limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:R.Constants.PAGE_SIZE,expanded:new Set()});
    renderProducts();
    scrollResultsTop();
  }
  function leaveFormCompare(){
    const y=formCompareReturnY||0;
    formCompareAnchorPzn='';formCompareSourceKey='';activeFormFilter='';activeFormFilters.clear();activeFormKey='';formFilterEngaged=false;
    closeFormChooser();
    renderProducts();
    requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'auto'})));
  }
  function captureFormBadgeReturnContext(pzn){
    const st=S.get();
    formBadgeReturnContext={
      pzn:U.pzn(pzn||''),
      scrollY:window.scrollY||0,
      catalogSort,nameSortDir,priceSortDir,sortPrimary,
      state:{
        home:!!st.home,query:st.query||'',category:st.category||'',subcategory:st.subcategory||'',
        mobileSearchScope:st.mobileSearchScope||'category',searchScrollCategory:st.searchScrollCategory||0,
        searchScrollGlobal:st.searchScrollGlobal||0,limit:st.limit||R.Constants.PAGE_SIZE,
        categoryLimit:st.categoryLimit||20,globalLimit:st.globalLimit||20,expanded:Array.from(st.expanded||[])
      }
    };
  }
  function clearFormBadgeReturnContext(){formBadgeReturnContext=null}
  function restoreFormBadgeReturnContext(){
    const ctx=formBadgeReturnContext;if(!ctx)return false;
    formBadgeReturnContext=null;
    activeFormFilters.clear();activeFormFilter='';activeFormKey='';formFilterEngaged=false;
    catalogSort=ctx.catalogSort||'catalog'; nameSortDir=ctx.nameSortDir||''; priceSortDir=ctx.priceSortDir||''; sortPrimary=ctx.sortPrimary||'';
    const saved=ctx.state||{};
    S.set({...saved,expanded:new Set(saved.expanded||[])});
    if(el.searchInput)el.searchInput.value=saved.query||'';
    hideSuggestions();
    renderProducts();renderSearchScope();renderFlowNav();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      window.scrollTo({top:Number(ctx.scrollY)||0,behavior:'auto'});
      const card=ctx.pzn?document.querySelector(`.static-product-card[data-pzn="${CSS.escape(ctx.pzn)}"]`):null;
      if(card){
        card.classList.remove('form-return-flash');
        void card.offsetWidth;
        card.classList.add('form-return-flash');
        setTimeout(()=>card.classList.remove('form-return-flash'),1300);
      }
    }));
    return true;
  }
  function syncQuickRelatedScrollCues(){
    const host=document.getElementById('productQuickRelated');
    const rail=host?.querySelector('.pq-related-rail-list');
    if(!host||!rail)return;
    const max=Math.max(0,rail.scrollHeight-rail.clientHeight);
    const canScroll=max>6;
    const above=canScroll&&rail.scrollTop>8;
    const below=canScroll&&rail.scrollTop<max-8;
    host.classList.toggle('has-scroll-above',above);
    host.classList.toggle('has-scroll-below',below);
    host.classList.toggle('has-scroll',canScroll);
  }

  function syncQuickRelatedRailGeometry(){
    const host=document.getElementById('productQuickRelated');
    const sheet=document.querySelector('.product-quick-sheet');
    if(!host||host.hidden||!sheet)return;
    if(innerWidth<=900){
      host.style.removeProperty('top');
      host.style.removeProperty('left');
      host.style.removeProperty('height');
      host.style.removeProperty('bottom');
      host.style.removeProperty('width');
      host.style.removeProperty('transform');
      return;
    }

    const r=sheet.getBoundingClientRect();
    const dock=document.getElementById('quickOrderDock');
    const dr=dock?.getBoundingClientRect?.();

    // Use more of the free right-side overlay space instead of limiting the
    // related rail to the exact visual bounds of the main card.
    const overlayPad=18;
    const gap=18;
    const left=Math.round(r.right+gap);

    // Give related cards more readable horizontal space.
    const availableWidth=Math.max(300,Math.round(innerWidth-left-overlayPad));
    const width=Math.min(468,availableWidth);

    // Let the rail extend higher and lower than the main card when space allows,
    // while still staying below the visible order dock and above the overlay edge.
    const minTop=(dr&&dr.height)?Math.round(dr.bottom+10):overlayPad;
    const maxBottom=Math.round(innerHeight-overlayPad);
    const maxHeight=Math.max(220,maxBottom-minTop);
    const desiredHeight=Math.min(maxHeight,Math.max(Math.round(r.height+160),520));

    let top=Math.round((r.top+r.bottom-desiredHeight)/2);
    top=Math.max(minTop,top);

    let bottom=top+desiredHeight;
    if(bottom>maxBottom){
      bottom=maxBottom;
      top=Math.max(minTop,bottom-desiredHeight);
    }
    const height=Math.max(220,bottom-top);

    host.style.setProperty('top',`${top}px`,'important');
    host.style.setProperty('left',`${left}px`,'important');
    host.style.setProperty('width',`${width}px`,'important');
    host.style.setProperty('height',`${height}px`,'important');
    host.style.setProperty('bottom','auto','important');
    host.style.setProperty('transform','none','important');
    requestAnimationFrame(syncQuickRelatedScrollCues);
  }

  function animateQuickViewSwap(targetCard,newPzn){
    const sheet=document.querySelector('.product-quick-sheet');
    const card=targetCard?.closest?.('.pq-float-related')||targetCard;
    const body=document.getElementById('productQuickBody');
    if(!sheet||!card||!body){
      renderQuickView(newPzn,{replace:true,preserveRelatedFilter:true});
      return;
    }

    // Always kill leftovers from an interrupted previous swap first.
    document.querySelectorAll('.pq-swap-stage').forEach(x=>x.remove());
    document.querySelectorAll('.pq-swap-real-hidden').forEach(x=>x.classList.remove('pq-swap-real-hidden'));
    sheet.classList.remove('pq-calm-swap','pq-calm-swap-out','pq-calm-swap-in','pq-swap-arrived');

    if(matchMedia?.('(prefers-reduced-motion: reduce)').matches){
      renderQuickView(newPzn,{replace:true,preserveRelatedFilter:true});
      U.sound?.('tick');
      return;
    }

    const sheetRect=sheet.getBoundingClientRect();
    const cardRect=card.getBoundingClientRect();
    if(!sheetRect.width||!cardRect.width){
      renderQuickView(newPzn,{replace:true,preserveRelatedFilter:true});
      return;
    }

    const overlay=document.createElement('div');
    overlay.className='pq-swap-stage';
    overlay.setAttribute('aria-hidden','true');

    const mainGhost=sheet.cloneNode(true);
    mainGhost.className='pq-swap-main-ghost';
    mainGhost.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));
    mainGhost.querySelectorAll('button,input,a').forEach(x=>x.setAttribute('tabindex','-1'));
    // Never duplicate the floating cart inside the animated clone.
    mainGhost.querySelectorAll('.quick-order-dock,.desktop-order-dock').forEach(x=>x.remove());

    const relatedGhost=card.cloneNode(true);
    relatedGhost.className='pq-swap-related-ghost';
    relatedGhost.removeAttribute('data-pq-related-open');
    relatedGhost.querySelectorAll('[id]').forEach(x=>x.removeAttribute('id'));

    const badge=document.createElement('div');
    badge.className='pq-swap-badge';
    badge.innerHTML='<span>⇄</span>';

    const setRect=(node,r)=>{
      node.style.left=`${r.left}px`;
      node.style.top=`${r.top}px`;
      node.style.width=`${r.width}px`;
      node.style.height=`${r.height}px`;
    };
    setRect(mainGhost,sheetRect);
    setRect(relatedGhost,cardRect);

    overlay.append(mainGhost,relatedGhost,badge);
    document.body.appendChild(overlay);

    sheet.classList.add('pq-swap-real-hidden');
    card.classList.add('pq-swap-real-hidden');

    let midX=(sheetRect.right+cardRect.left)/2;
    let midY=(sheetRect.top+sheetRect.bottom)/2;
    if(innerWidth<=760){
      const sheetCx=sheetRect.left+sheetRect.width/2;
      const cardCx=cardRect.left+cardRect.width/2;
      if(cardRect.top>=sheetRect.bottom){
        midX=(sheetCx+cardCx)/2;
        midY=(sheetRect.bottom+cardRect.top)/2;
      }else if(cardRect.bottom<=sheetRect.top){
        midX=(sheetCx+cardCx)/2;
        midY=(cardRect.bottom+sheetRect.top)/2;
      }else{
        const gapRight=cardRect.left-sheetRect.right;
        const gapLeft=sheetRect.left-cardRect.right;
        midY=(Math.max(sheetRect.top,cardRect.top)+Math.min(sheetRect.bottom,cardRect.bottom))/2;
        if(gapRight>=gapLeft)midX=(sheetRect.right+cardRect.left)/2;
        else midX=(cardRect.right+sheetRect.left)/2;
      }
    }
    badge.style.left=`${midX}px`;
    badge.style.top=`${midY}px`;

    U.sound?.('tick');

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      mainGhost.classList.add('to-related');
      relatedGhost.classList.add('to-main');
      setRect(mainGhost,cardRect);
      setRect(relatedGhost,sheetRect);
      badge.classList.add('show');
    }));

    const finish=()=>{
      sheet.classList.remove('pq-swap-real-hidden','pq-calm-swap','pq-calm-swap-out','pq-calm-swap-in');
      card.classList.remove('pq-swap-real-hidden');
      renderQuickView(newPzn,{replace:true,preserveRelatedFilter:true});
      const fresh=document.querySelector('.product-quick-sheet');
      fresh?.classList.remove('pq-swap-real-hidden','pq-swap-out','pq-swap-in','pq-calm-swap','pq-calm-swap-out','pq-calm-swap-in');
      fresh?.classList.add('pq-swap-arrived');
      const rail=document.querySelector('#productQuickRelated .pq-related-rail-list');
      if(rail)rail.scrollTop=0;
      const title=fresh?.querySelector('h2');
      if(title){title.setAttribute('tabindex','-1');try{title.focus({preventScroll:true});}catch(_e){}}
      U.sound?.('add');
      setTimeout(()=>{
        fresh?.classList.remove('pq-swap-arrived');
        overlay.remove();
      },420);
    };
    setTimeout(finish,560);
  }

  let quickViewPzn='';
  let quickViewHistoryMute=false;
  let quickViewFormFilter='';
  let quickViewPreviousContext=null;
  let quickViewSourceRow=null;
  function setQuickViewSource(pzn){
    if(quickViewSourceRow&&quickViewSourceRow.isConnected)quickViewSourceRow.classList.remove('quickview-source-hidden');
    quickViewSourceRow=document.querySelector(`.product-row[data-pzn="${U.pzn(pzn)}"], .order-product-row[data-pzn="${U.pzn(pzn)}"], .order-line[data-pzn="${U.pzn(pzn)}"]`);
    if(quickViewSourceRow)quickViewSourceRow.classList.add('quickview-source-hidden');
  }
  function syncQuickViewUrl(pzn,replace=false){
    if(quickViewHistoryMute)return;
    const url=new URL(location.href);
    const current=U.pzn(url.searchParams.get('product')||'');
    if(current===pzn)return;
    url.searchParams.set('product',pzn);
    const state={...(history.state||{}),rxdeQuickView:pzn};
    (replace?history.replaceState:history.pushState).call(history,state,'',url);
  }
  function showGooseCancel(){
    document.querySelector('.rxde-goose-cancel')?.remove();
    const toast=document.createElement('div');
    toast.className='rxde-goose-cancel';
    toast.setAttribute('aria-hidden','true');
    toast.innerHTML=`<div class="rxde-running-goose-scene">
      <div class="rxde-goose-bubble">Галя, у нас отмена!</div>
      <svg class="rxde-goose" viewBox="0 0 120 108" aria-hidden="true">
        <path d="M73 95c-25 0-43-16-43-39 0-18 10-30 26-35 5-2 9-5 11-10 2-5 7-8 13-8 9 0 16 7 16 16 0 7-4 12-10 15 8 9 13 20 13 32 0 19-10 29-26 29z"
          fill="#fff" stroke="#183f5c" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M93 18l20 6-19 8" fill="#f5a623" stroke="#183f5c" stroke-width="2.1" stroke-linejoin="round"/>
        <circle cx="82" cy="15" r="2.4" fill="#183f5c"/>
        <!-- wings/hands on head -->
        <path d="M53 52c7-15 14-25 25-31" fill="none" stroke="#183f5c" stroke-width="3" stroke-linecap="round"/>
        <path d="M74 55c1-14 3-24 7-34" fill="none" stroke="#183f5c" stroke-width="3" stroke-linecap="round"/>
        <path d="M50 94l-9 10M76 95l8 10" stroke="#f5a623" stroke-width="3" stroke-linecap="round"/>
        <path d="M34 83c9 6 20 9 31 9" fill="none" stroke="#e94f4f" stroke-width="3.2" stroke-linecap="round"/>
      </svg>
    </div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(()=>toast.classList.add('show'));
    setTimeout(()=>toast.classList.add('leave'),3300);
    setTimeout(()=>toast.remove(),3900);
  }

  function rememberQuickViewContext(nextPzn){
    const current=P.byPzn.get(quickViewPzn);
    const next=P.byPzn.get(U.pzn(nextPzn));
    if(!current||!next||current.pzn===next.pzn)return;
    quickViewPreviousContext={
      pzn:current.pzn,
      filter:quickViewFormFilter||'',
      formKey:Forms.kind(current.form),
      formLabel:(Forms.INFO[Forms.kind(current.form)]||Forms.INFO.other).label
    };
    if(quickViewFormFilter && Forms.kind(next.form)!==quickViewFormFilter){
      quickViewFormFilter=Forms.kind(next.form);
    }
  }

  function renderQuickView(pzn,opts={}){
    pzn=U.pzn(pzn);const p=P.byPzn.get(pzn);if(!p)return;
    if(isMobile()){
      const direct=pageUrl(pzn);
      if(direct){
        try{sessionStorage.setItem('rxde:catalogReturn',JSON.stringify({url:location.href,scrollY:window.scrollY,state:{query:S.get().query,category:S.get().category,subcategory:S.get().subcategory,mobileSearchScope:S.get().mobileSearchScope,searchScrollCategory:S.get().searchScrollCategory,searchScrollGlobal:S.get().searchScrollGlobal,limit:S.get().limit,categoryLimit:S.get().categoryLimit,globalLimit:S.get().globalLimit}}))}catch(_e){}
        location.href=direct;
      }
      return;
    }
    if(opts.history!==false)syncQuickViewUrl(pzn,Boolean(opts.replace));
    const backdrop=document.getElementById('productQuickBackdrop');
    const body=document.getElementById('productQuickBody');
    const quickSheet=backdrop?.querySelector('.product-quick-sheet');
    quickSheet?.classList.remove('pq-swap-real-hidden','pq-calm-swap','pq-calm-swap-out');
    if(!backdrop||!body)return;
    quickViewPzn=pzn;
    setQuickViewSource(pzn);
    const st=S.get(),q=Cart.qty(pzn),rub=U.rub(p.eur,st.rate),sumE=p.eur*q,sumR=U.rub(p.eur,st.rate)*q;
    const image=imageSrc(p);
    const family=quickViewFamilyProducts(p,50);
    const relatedHost=document.getElementById('productQuickRelated');
    if(!opts.preserveRelatedFilter)quickViewFormFilter='';
    const formKinds=quickViewFormKinds(family);
    if(quickViewFormFilter&&!formKinds.some(([k])=>k===quickViewFormFilter))quickViewFormFilter='';
    const filteredFamily=(quickViewFormFilter?family.filter(r=>Forms.kind(r.form)===quickViewFormFilter):family)
      .filter(r=>r.pzn!==pzn);

    if(isMobile()){
      const page=pageUrl(p.pzn);
      if(relatedHost){
        const relatedCount=Math.max(0,family.length-1);
        relatedHost.hidden=relatedCount<=0;
        relatedHost.classList.remove('mobile-related-collapsed');
        relatedHost.innerHTML=relatedCount?`<button type="button" class="mn-related-search" data-pq-related-search="${p.pzn}"><span>Похожие варианты</span><b>${relatedCount}</b><i>→</i></button>`:'';
      }
      body.innerHTML=`<div class="mnq-card">
        <button type="button" class="mnq-photo product-photo" title="Открыть фото">${image?`<img src="${U.escape(image)}" alt="${U.escape(p.name)}">`:'<span class="rxde-placeholder"><span class="rxde-placeholder-mark"><b>Rx</b><em>De</em></span></span>'}</button>
        <div class="mnq-info">
          <div class="mnq-title-row"><h2>${U.escape(p.name)}</h2><button type="button" class="rxde-share-product" data-pq-share="${p.pzn}" title="Скопировать товар и цену" aria-label="Поделиться товаром ${U.escape(p.name)}"><svg class="rxde-share-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.5M8.3 13.2l7.4 4.5"/></svg></button>${p.rx?'<span class="rx-badge">RX</span>':''}</div>
          <div class="mnq-properties">
            ${p.substance?`<div><b>МНН</b><span>${U.escape(p.substance)}</span></div>`:''}
            ${p.form?`<div><b>Form</b><span>${U.escape(p.form)}${p.dosage?` · ${U.escape(p.dosage)}`:''}</span></div>`:''}
            ${p.maker?`<div><b>Hersteller</b><span>${U.escape(p.maker)}</span></div>`:''}
            <div><b>PZN</b><span>${U.escape(p.pzn)}</span></div>
          </div>
          ${page?`<a class="mnq-full" href="${U.escape(page)}" data-pq-full-open="${p.pzn}">Полная информация <b>→</b></a>`:''}
        </div>
        <div class="mnq-commerce">
          <div class="mnq-price"><strong>${U.money(rub)} ₽</strong><small>${U.money(p.eur)} €</small></div>
          ${q?`<div class="qty-stepper mnq-stepper"><button type="button" data-pq-delta="-1">−</button><input id="pqQty" type="number" value="${q}" min="0" max="999"><button type="button" data-pq-delta="1">+</button></div>`:`<button type="button" class="pq-add-zero" data-pq-delta="1">Добавить</button>`}
        </div>
        <div class="mnq-picked ${q?'selected':''}" data-pq-picked>${q?`${q} уп. · ${U.money(sumR)} ₽`:''}</div>
      </div>`;
      document.body.classList.add('quickview-open');
      backdrop.hidden=false;
      backdrop.setAttribute('aria-hidden','false');
      return;
    }

    if(relatedHost){
      const oldRail=relatedHost.querySelector('.pq-related-rail-list');
      const oldScroll=opts.preserveRelatedScroll&&oldRail?oldRail.scrollTop:0;
      const filterHtml=formKinds.length>1
        ? `<div class="pq-related-form-strip">
            <button type="button" class="${!quickViewFormFilter?'active':''}" data-pq-form-filter="">Все <b>${Math.max(0,family.length-1)}</b></button>
            ${formKinds.map(([k,count])=>{
              const inf=Forms.INFO[k]||Forms.INFO.other;
              return `<button type="button" class="${quickViewFormFilter===k?'active':''}" data-pq-form-filter="${k}">${U.escape(inf.label)} <b>${count}</b></button>`;
            }).join('')}
          </div>`
        : '';

      relatedHost.innerHTML=family.length>1?`
        <div class="pq-related-rail-head">
          <button type="button" class="pq-related-toggle" data-pq-related-toggle aria-expanded="false"><strong>Похожие варианты · ${filteredFamily.length}</strong><span aria-hidden="true">⌄</span></button>
        </div>
        ${filterHtml}
        <div class="pq-related-rail-list">
          ${filteredFamily.map(r=>{
            const rr=U.rub(r.eur,st.rate),rq=Cart.qty(r.pzn),ri=imageSrc(r),sumRelR=U.rub(r.eur,st.rate)*rq;
            return `<article class="pq-float-related ${r.pzn===pzn?'active-product':''} ${rq?'selected':''}" data-pq-related-open="${r.pzn}" tabindex="0">
              <div class="pq-float-related-thumb">${ri?`<img src="${U.escape(ri)}" alt="" onerror="this.style.display='none';this.parentElement.classList.add('image-missing')">`:'<span class="rxde-placeholder"><span class="rxde-placeholder-mark"><b>Rx</b><em>De</em></span></span>'}</div>
              <div class="pq-float-related-info">
                <strong>${U.escape(r.name)}</strong>
                <span class="pq-related-meta"><b>МНН:</b> ${U.escape(r.substance||'—')}</span>
                <span class="pq-related-meta"><b>Form:</b> ${U.escape(r.form||'—')}${r.dosage?` · ${U.escape(r.dosage)}`:''}</span>
                <span class="pq-related-meta"><b>Hersteller:</b> ${U.escape(r.maker||'—')}${r.size?` · ${U.escape(r.size)}`:''}</span>
                <span class="pq-related-meta"><b>PZN:</b> ${U.escape(r.pzn)}</span>
              </div>
              <div class="pq-float-related-footer">
                <div class="pq-float-related-controls">
                  <span class="pq-float-related-price"><b>${U.money(rr)} ₽</b><small>${U.money(r.eur)} €</small></span>
                  ${rq?`<div class="suggest-stepper pq-related-stepper" aria-label="Количество">
                    <button type="button" data-pq-related-delta="-1" data-pzn="${r.pzn}">−</button>
                    <b>${rq}</b>
                    <button type="button" data-pq-related-delta="1" data-pzn="${r.pzn}">+</button>
                  </div>`:`<button type="button" class="pq-related-add-zero" data-pq-related-delta="1" data-pzn="${r.pzn}">Добавить</button>`}
                </div>
                <div class="pq-float-related-picked ${rq?'selected':''}" data-pq-related-picked="${r.pzn}">${rq?`${rq} уп. · ${U.money(sumRelR)} ₽`:''}</div>
              </div>
            </article>`;
          }).join('') || '<div class="pq-related-empty">Нет вариантов этой формы</div>'}
        </div>
        <button class="pq-scroll-cue pq-scroll-cue-up" type="button" data-pq-scroll-cue="-1" aria-label="Есть варианты выше"><span>⌃</span></button>
        <button class="pq-scroll-cue pq-scroll-cue-down" type="button" data-pq-scroll-cue="1" aria-label="Есть варианты ниже"><span>⌄</span></button>`:'';
      relatedHost.hidden=family.length<=1;
      if(isMobile() && !relatedHost.hidden) relatedHost.classList.add('mobile-related-collapsed');
      const newRail=relatedHost.querySelector('.pq-related-rail-list');
      if(newRail){
        newRail.scrollTop=oldScroll;
        newRail.onscroll=()=>syncQuickRelatedScrollCues();
        requestAnimationFrame(syncQuickRelatedScrollCues);
      }
    }
    body.innerHTML=`<div class="pq-photo ${pageUrl(p.pzn)?'has-full-page':''}" ${pageUrl(p.pzn)?`data-pq-full-open="${p.pzn}" role="link" tabindex="0" title="Открыть полную карточку товара"`:''}>${image?`<img src="${U.escape(image)}" alt="${U.escape(p.name)}">`:'<span class="rxde-placeholder"><span class="rxde-placeholder-mark"><b>Rx</b><em>De</em></span></span>'}</div>
      <div class="pq-main">
        <div class="pq-title-row">${pageUrl(p.pzn)?`<a class="pq-title-full-link" href="${U.escape(pageUrl(p.pzn))}" data-pq-full-open="${p.pzn}" title="Открыть полную карточку товара"><h2>${U.escape(p.name)}</h2></a>`:`<h2>${U.escape(p.name)}</h2>`}${p.rx?'<span class="rx-badge">RX</span>':''}<button type="button" class="rxde-share-product" data-pq-share="${p.pzn}" title="Скопировать товар и цену" aria-label="Поделиться товаром ${U.escape(p.name)}"><svg class="rxde-share-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.5M8.3 13.2l7.4 4.5"/></svg></button><button type="button" class="family-search-button pq-family-search" data-family-search="${p.pzn}" aria-label="Искать варианты ${U.escape(p.name)}" title="Найти варианты по названию"><svg class="system-search-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.25"></circle><path d="M12.4 12.4L17 17"></path></svg></button><button type="button" class="form-badge pq-main-form-jump form-${Forms.kind(p.form)}" data-pq-jump-form="${Forms.kind(p.form)}" title="Открыть на главной результаты с фильтром по этой форме">${U.escape((Forms.INFO[Forms.kind(p.form)]||Forms.INFO.other).label)}</button></div>
        ${quickViewPreviousContext?`<button type="button" class="pq-prev-context" data-pq-prev-context="${U.escape(quickViewPreviousContext.pzn)}">← из ${U.escape(quickViewPreviousContext.formLabel)}</button>`:''}
        <div class="pq-meta">${Format.copyableCore(p,U)}${Format.propertyText(p,U)}</div>
        <div class="pq-actions">${Format.links(p,U,pageUrl(p.pzn),false)}${pageUrl(p.pzn)?`<a class="pq-full-open" href="${U.escape(pageUrl(p.pzn))}" data-pq-full-open="${p.pzn}"><span>Подробная карточка товара</span><b>Открыть →</b></a>`:''}</div>
      </div>
      <div class="pq-footer">
        <div class="pq-bottom">
          <div class="pq-price"><strong>${U.money(rub)} ₽</strong><span>${U.money(p.eur)} €</span></div>
          ${q?`<div class="qty-stepper pq-stepper"><button type="button" data-pq-delta="-1">−</button><input id="pqQty" type="number" value="${q}" min="0" max="999"><button type="button" data-pq-delta="1">+</button></div>`:`<button type="button" class="pq-add-zero" data-pq-delta="1">Добавить</button>`}
        </div>
        <div class="pq-picked ${q?'selected':''}" data-pq-picked>${q?`${q} уп. · ${U.money(sumR)} ₽`:''}</div>
      </div>`;
    document.body.classList.add('quickview-open');
    backdrop.hidden=false;
    backdrop.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>requestAnimationFrame(syncQuickRelatedRailGeometry));
  }
  function closeQuickView(opts={}){
    const b=document.getElementById('productQuickBackdrop');
    if(b){b.hidden=true;b.setAttribute('aria-hidden','true')}
    document.body.classList.remove('quickview-open');
    const relatedHost=document.getElementById('productQuickRelated');
    if(relatedHost){relatedHost.hidden=true;requestAnimationFrame(()=>{if(!quickViewPzn)relatedHost.innerHTML=''})}
    if(quickViewSourceRow&&quickViewSourceRow.isConnected)quickViewSourceRow.classList.remove('quickview-source-hidden');
    quickViewSourceRow=null;
    quickViewPzn='';
    quickViewFormFilter='';
    quickViewPreviousContext=null;
    if(opts.history===false)return;
    const url=new URL(location.href);
    if(url.searchParams.has('product')){
      url.searchParams.delete('product');
      history.replaceState({...history.state,rxdeQuickView:null},'',url);
    }
  }
  function syncQuickViewFromLocation(){
    const pzn=U.pzn(new URL(location.href).searchParams.get('product')||'');
    quickViewHistoryMute=true;
    if(pzn&&P.byPzn.has(pzn)){history.replaceState(history.state||{},'',location.pathname+location.search.replace(/([?&])product=[^&]*&?/,'$1').replace(/[?&]$/,''));openFullProduct(pzn,'catalog')}
    else closeQuickView({history:false});
    quickViewHistoryMute=false;
  }

  function saveFullProductOrigin(pzn,origin='catalog',sourceCard=null){
    const st=S.get();
    const payload={type:origin,pzn:U.pzn(pzn),url:location.href,scrollY:window.scrollY||0,orderScrollTop:el.orderLines?.scrollTop||0,focusPzn:U.pzn(pzn),cardViewportTop:sourceCard?.getBoundingClientRect?.().top??null,state:{home:!!st.home,query:st.query||'',category:st.category||'',subcategory:st.subcategory||'',mobileSearchScope:st.mobileSearchScope||'global',searchScrollCategory:st.searchScrollCategory||0,searchScrollGlobal:st.searchScrollGlobal||0,limit:st.limit||R.Constants.PAGE_SIZE,categoryLimit:st.categoryLimit||20,globalLimit:st.globalLimit||20}};
    try{sessionStorage.setItem('rxde:productOrigin',JSON.stringify(payload));sessionStorage.setItem('rxde:catalogReturn',JSON.stringify(payload))}catch(_){}
  }
  function openFullProduct(pzn,origin='catalog',sourceCard=null){
    pzn=U.pzn(pzn);if(!pzn)return;
    hideSuggestions();
    saveFullProductOrigin(pzn,origin,sourceCard);
    const href=pageUrl(pzn);
    if(href)location.href=href;
  }
  function openSuggestedProduct(pzn){
    openFullProduct(pzn,'catalog');
  }

  function mobileNativeRow(p){
    const st=S.get(),q=Cart.qty(p.pzn),rub=U.rub(p.eur,st.rate),image=imageSrc(p),page=pageUrl(p.pzn);
    const action=q
      ? `<button type="button" class="mn-action in-cart" data-order-jump="${p.pzn}" aria-label="В заказе ${q} упаковок. Открыть корзину"><span>✓</span><b>${q}</b></button>`
      : `<button type="button" class="mn-action mn-action-add" data-delta="1" data-pzn="${p.pzn}" aria-label="Добавить одну упаковку">Добавить</button>`;
    const title=page
      ? `<a class="mn-title" href="${U.escape(page)}" data-mobile-full="${p.pzn}" title="Полная информация о товаре">${U.escape(p.name)}</a>`
      : `<span class="mn-title">${U.escape(p.name)}</span>`;
    const line2=[p.substance||'', p.form||'', p.dosage||''].filter(Boolean).join(' · ');
    const line3=p.maker||'';
    return `<article class="mn-product mn-product-v4 ${q?'selected':''}" data-pzn="${p.pzn}" data-qty="${q}">
      <button type="button" class="mn-photo product-photo" title="Открыть фото" aria-label="Открыть фото ${U.escape(p.name)}">${image?`<img src="${U.escape(image)}" alt="${U.escape(p.name)}" onerror="this.style.display='none';this.parentElement.classList.add('image-missing')">`:'<span class="rxde-placeholder"><span class="rxde-placeholder-mark"><b>Rx</b><em>De</em></span></span>'}</button>
      <div class="mn-copy">
        <div class="mn-line mn-line-name">${title}${p.rx?'<span class="rx-badge mn-rx">RX</span>':''}</div>
        <div class="mn-line mn-line-med" title="${U.escape(line2)}">${U.escape(line2||'—')}</div>
        <div class="mn-line mn-line-maker" title="${U.escape(line3)}">${U.escape(line3||'—')}</div>
        <div class="mn-line mn-line-pzn">PZN ${U.escape(p.pzn)}${p.size?` · ${U.escape(p.size)}`:''}</div>
      </div>
      <div class="mn-commerce">
        <div class="mn-price"><strong>${U.money(rub)} ₽</strong><small>${U.money(p.eur)} €</small></div>
        <div class="mn-action-slot">${action}</div>
      </div>
    </article>`;
  }

  // V3.13.5 — favorites stored locally by PZN; no server or account.
  const FAV_KEY='rxde:favorites:pzn:v1';
  let favSet=new Set();
  try{favSet=new Set(JSON.parse(localStorage.getItem(FAV_KEY)||'[]').map(U.pzn))}catch(_){}
  let favoritesOnly=false;
  const persistFavorites=()=>{try{localStorage.setItem(FAV_KEY,JSON.stringify([...favSet]))}catch(_){}};
  function syncFavoritesUI(){
    document.querySelectorAll('[data-favorite-pzn]').forEach(b=>{const chosen=favSet.has(U.pzn(b.dataset.favoritePzn));b.classList.toggle('is-favorite',chosen);b.setAttribute('aria-pressed',String(chosen));b.setAttribute('aria-label',chosen?'Убрать из любимого':'Добавить в любимое')});
    document.querySelectorAll('.rxde-fav-count').forEach(b=>{const n=favSet.size;b.textContent=n;b.hidden=!n});
    document.querySelectorAll('[data-favorites-open]').forEach(b=>{b.classList.toggle('is-active',favoritesOnly);b.setAttribute('aria-pressed',String(favoritesOnly))});
  }
  function favoriteHeart(pzn){return `<button type="button" class="rxde-card-heart" data-favorite-pzn="${U.escape(pzn)}" aria-label="Добавить в любимое" aria-pressed="false" title="Любимое"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3l-1.1-1C5.1 14 2 11.2 2 7.8 2 5 4.2 3 7 3c1.8 0 3.5.8 5 2.3C13.5 3.8 15.2 3 17 3c2.8 0 5 2 5 4.8 0 3.4-3.1 6.2-8.9 11.5l-1.1 1z"/></svg></button>`}
  function resetFavoritesFilters(){
    // Favorites is a self-contained view: the previous catalog's filters must not leak into it.
    activeFormFilter='';activeFormFilters.clear();activeFormKey='';formFilterEngaged=false;
    activeDoseFilter='';activeDoseKey='';
    formCompareAnchorPzn='';formCompareSourceKey='';formBadgeReturnContext=null;
    closeFormChooser();
    nameSortDir='';priceSortDir='';sortPrimary='';
    if(el.searchInput)el.searchInput.value='';
    hideSuggestions();
    S.set({home:false,query:'',subcategory:'',category:'',limit:Math.max(R.Constants.PAGE_SIZE,favSet.size),categoryLimit:20,globalLimit:20,expanded:new Set()});
  }
  R.Favorites={get:()=>[...favSet],is:pzn=>favSet.has(U.pzn(pzn)),open:()=>{
    favoritesOnly=!favoritesOnly;
    resetFavoritesFilters();
    renderProducts();syncFavoritesUI();scrollResultsTop();
  },close:()=>{if(favoritesOnly){favoritesOnly=false;resetFavoritesFilters();renderProducts();syncFavoritesUI()}}};
  document.addEventListener('click',e=>{
    const h=e.target.closest('[data-favorite-pzn]');
    if(h){
      e.preventDefault();e.stopPropagation();
      const k=U.pzn(h.dataset.favoritePzn),wasFavorite=favSet.has(k);
      wasFavorite?favSet.delete(k):favSet.add(k);
      persistFavorites();syncFavoritesUI();
      if(favoritesOnly){
        const card=h.closest('#productList .product-row,#productList article[data-pzn]');
        if(wasFavorite&&card){
          card.classList.add('rxde-favorite-removing');
          setTimeout(()=>{if(favoritesOnly)renderProducts()},190);
        }else renderProducts();
      }
      return;
    }
    if(e.target.closest('[data-favorites-open]')){e.preventDefault();R.Favorites.open()}
  },true);
  function row(p){
    const st=S.get(),q=Cart.qty(p.pzn),rub=U.rub(p.eur,st.rate),sumE=p.eur*q,sumR=U.rub(p.eur,st.rate)*q,image=imageSrc(p),hasImage=Boolean(image);
    const familyToken=(String(p.name||'').trim().split(/\s+/)[0]||'').replace(/[®™,:;]+$/g,'').trim();
    const familyActive=familyToken&&U.norm(st.query||'')===U.norm(familyToken);
    const page=pageUrl(p.pzn);
    const mobileMeta=[p.substance?`МНН: ${p.substance}`:'',p.form?`Form: ${p.form}${p.dosage?` · ${p.dosage}`:''}`:'',p.maker?`Hersteller: ${p.maker}`:'',`PZN: ${p.pzn}`].filter(Boolean).join(' · ');
    const mobileAction=q
      ? `<button type="button" class="m-product-add in-cart" data-order-jump="${p.pzn}" aria-label="В заказе ${q} упаковок. Открыть корзину">✓ ×${q}</button>`
      : `<button type="button" class="m-product-add m-product-add-zero" data-delta="1" data-pzn="${p.pzn}" aria-label="Добавить одну упаковку">Добавить</button>`;
    return `<article class="product-row static-product-card r2-card ${q?'selected':''} ${hasImage?'has-expand-image':'no-expand-image'}" data-pzn="${p.pzn}" data-qty="${q}" style="height:var(--rxde-card-h-v250)!important;min-height:var(--rxde-card-h-v250)!important;max-height:var(--rxde-card-h-v250)!important;block-size:var(--rxde-card-h-v250)!important;min-block-size:var(--rxde-card-h-v250)!important;max-block-size:var(--rxde-card-h-v250)!important;align-self:start!important;overflow:hidden!important;grid-template-rows:var(--rxde-card-photo-v250) var(--rxde-card-info-v250) calc(var(--rxde-card-commerce-v250) + var(--rxde-card-picked-v250))!important;">
      <button type="button" class="rxde-card-sum-badge ${q>=1?'is-visible':''}" data-order-jump="${p.pzn}" aria-label="Итого ${U.money(sumR)} рублей за ${q} упаковок. Открыть позицию в листе заказа" title="Перейти к товару в листе заказа">${q>=1?`${U.money(sumR)} ₽`:''}</button>
      <div class="m-product-row" aria-label="${U.escape(p.name)}">
        <div class="m-product-photo product-photo">${image?`<img src="${U.escape(image)}" alt="${U.escape(p.name)}" onerror="this.style.display='none';this.parentElement.classList.add('image-missing')">`:'<span class="rxde-placeholder"><span class="rxde-placeholder-mark"><b>Rx</b><em>De</em></span></span>'}</div>
        <div class="m-product-title"><span>${U.escape(p.name)}</span>${p.rx?'<span class="rx-badge">RX</span>':''}</div>
        <div class="m-product-price"><strong>${U.money(rub)} ₽</strong><small>${U.money(p.eur)} €</small></div>
        <div class="m-product-meta">${U.escape(mobileMeta)}</div>
        <div class="m-product-action">${mobileAction}</div>
      </div>
      <div class="product-photo r2-photo" style="height:var(--rxde-card-photo-v250)!important;min-height:var(--rxde-card-photo-v250)!important;max-height:var(--rxde-card-photo-v250)!important;">
        <img src="${U.escape(image)}" alt="${U.escape(p.name)}" onerror="this.outerHTML='<span class=&quot;image-fallback rxde-placeholder&quot; aria-label=&quot;Фото товара отсутствует&quot;><span class=&quot;rxde-placeholder-mark&quot;><b>Rx</b><em>De</em></span></span>'">
        ${Forms.badge(p)}
        ${favoriteHeart(p.pzn)}
      </div>
      <div class="r2-info" style="height:var(--rxde-card-info-v250)!important;min-height:var(--rxde-card-info-v250)!important;max-height:var(--rxde-card-info-v250)!important;">
        <div class="r2-line r2-title"><a class="r2-title-open" href="${U.escape(pageUrl(p.pzn))}" data-card-title-open="${p.pzn}" aria-label="Открыть карточку ${U.escape(p.name)}"><span class="r2-title-text">${U.escape(String(p.name||'').replace(/^\s*\[(?:rx|рх)\]\s*/i,'').trim())}</span></a>${p.rx?'<span class="rx-badge" title="RX — требуется предоставить рецепт. Условия отпуска уточняются перед закупкой.">RX</span>':''}<button class="family-search-button card-family-search ${familyActive?'family-return':''}" type="button" data-family-search="${p.pzn}" aria-label="${familyActive?'Вернуться к предыдущему экрану':`Искать варианты ${U.escape(p.name)}`}" title="${familyActive?'Нажмите ещё раз — вернуться назад':'Найти варианты по названию'}"><svg class="system-search-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="8.5" cy="8.5" r="5.25"></circle><path d="M12.4 12.4L17 17"></path></svg></button></div>
        <div class="r2-line"><b>МНН:</b><span>${U.escape(p.substance||'')}</span></div>
        <div class="r2-line"><b>Form:</b><span>${U.escape(p.form||'')}${p.dosage?` · ${U.escape(p.dosage)}`:''}</span></div>
        <div class="r2-line"><b>Hersteller:</b><span>${U.escape(p.maker||'')}${p.size?` · ${U.escape(p.size)}`:''}</span></div>
        <div class="r2-line"><b>PZN:</b><span>${U.escape(p.pzn)}${p.size?` · ${U.escape(p.size)}`:''}</span></div>
      </div>
      <div class="r2-footer" style="height:calc(var(--rxde-card-commerce-v250) + var(--rxde-card-picked-v250))!important;min-height:calc(var(--rxde-card-commerce-v250) + var(--rxde-card-picked-v250))!important;max-height:calc(var(--rxde-card-commerce-v250) + var(--rxde-card-picked-v250))!important;">
        <div class="r2-bottom" style="height:var(--rxde-card-commerce-v250)!important;min-height:var(--rxde-card-commerce-v250)!important;max-height:var(--rxde-card-commerce-v250)!important;">
          <div class="r2-cell r2-unit" aria-label="Цена за упаковку"><strong>${U.money(rub)} ₽</strong><span>${U.money(p.eur)} €</span></div>
          <div class="r2-cell r2-qty-cell">${q?`<div class="r2-qty" aria-label="Количество"><button type="button" data-delta="-1" data-pzn="${p.pzn}">−</button><input data-qty="${p.pzn}" type="number" value="${q}" min="0" max="999"><button type="button" data-delta="1" data-pzn="${p.pzn}">+</button></div>`:`<button type="button" class="r2-add-zero" data-delta="1" data-pzn="${p.pzn}" aria-label="Добавить одну упаковку">Добавить</button>`}</div>
        </div>
        <div class="r2-picked ${q>=1?'selected':''}" data-card-picked="${p.pzn}">${q>=1?`<span class="r2-picked-sum">${U.money(sumR)} ₽</span>`:''}</div>
      </div>
    </article>`;
  }

  function currentSearchScopeLabel(){
    const st=S.get();
    return U.norm(st.query)?'Весь каталог':(st.subcategory||st.category||'Весь каталог');
  }
  function renderSearchScope(){
    if(!el.searchScopeButton||!el.searchScopeMenu)return;
    const st=S.get(),label=currentSearchScopeLabel();
    if(el.searchScopeLabel)el.searchScopeLabel.textContent=label;
    const globalSelected=Boolean(U.norm(st.query))||(!st.category&&!st.subcategory);
    const items=[`<button type="button" class="scope-option ${globalSelected?'active':''}" data-scope-global><strong>Весь каталог</strong><small>${P.all.length} товаров</small></button>`];
    for(const [name,count] of P.categories){
      const active=!globalSelected && name===(st.subcategory||st.category);
      items.push(`<button type="button" class="scope-option ${active?'active':''}" data-scope-category="${U.escape(name)}"><strong>${U.escape(name)}</strong><small>${count} товаров</small></button>`);
    }
    el.searchScopeMenu.innerHTML=items.join('');
  }
  function closeSearchScope(){if(!el.searchScopeMenu)return;el.searchScopeMenu.hidden=true;el.searchScopeButton?.setAttribute('aria-expanded','false');el.searchScopeButton?.classList.remove('open')}
  function setSearchScopeGlobal(){
    const st=S.get();
    S.set({home:false,query:'',category:'',subcategory:'',mobileSearchScope:'global',limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:R.Constants.PAGE_SIZE,expanded:new Set()});
    if(el.searchInput)el.searchInput.value='';
    renderProducts();renderSearchScope();closeSearchScope();recentRecord(navSnapshot('Весь каталог'));requestAnimationFrame(scrollResultsTop);
  }
  function setSearchScopeCategory(cat){
    if(!cat)return;
    S.set({home:false,query:'',category:cat,subcategory:'',mobileSearchScope:'category',limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:20,expanded:new Set()});
    if(el.searchInput)el.searchInput.value='';
    renderProducts();renderSearchScope();closeSearchScope();recentRecord(navSnapshot(cat));requestAnimationFrame(scrollResultsTop);
  }

  const NOTEBOOK_CATEGORY_TABS=[
    ['Витамины и минералы','Витамины'],
    ['Уход и косметика','Уход'],
    ['Пищеварение','Пищеварение'],
    ['Боль, мышцы и суставы','Суставы'],
    ['Глаза','Глаза'],
    ['Простуда и дыхание','Дыхание'],
    ['Детские товары','Детям'],
    ['Волосы и кожа головы','Волосы'],
    ['Кожа и заживление','Кожа'],
    ['Товары для животных','Животным'],
    ['Аллергия','Аллергия'],
    ['Уход за полостью рта','Полость рта'],
    ['', 'Все']
  ];
  function renderCategories(){
    if(!el.categoryStrip)return;
    const st=S.get();
    const active=U.norm(st.query)?'':(st.category||'');
    el.categoryStrip.innerHTML=NOTEBOOK_CATEGORY_TABS.map(([name,label])=>{
      const hero=CATALOG_HERO[name||'']||CATALOG_HERO[''];
      return `<button class="category-chip notebook-index-tab ${active===name?'active':''}" ${name?`data-category="${U.escape(name)}"`:'data-category-clear'} type="button" title="${U.escape(name||'Весь каталог')}" style="--tab-image:url('${hero.img}')"><span>${U.escape(label)}</span></button>`;
    }).join('');
    requestAnimationFrame(()=>{
      const a=el.categoryStrip?.querySelector('.notebook-index-tab.active');
      if(a)a.scrollIntoView({behavior:'auto',block:'nearest',inline:'center'});
    });
  }

  function renderSubcategories(){
    const st=S.get();
    if(!el.subcategoryStrip)return;
    if(!st.category){el.subcategoryStrip.hidden=true;el.subcategoryStrip.innerHTML='';return}

    const list=P.subcategories(st.category);
    // Do not create UI noise unless there is a genuinely useful split.
    if(list.length<2){
      el.subcategoryStrip.hidden=true;el.subcategoryStrip.innerHTML='';
      if(st.subcategory)S.set({subcategory:''});
      return;
    }

    const total=list.reduce((a,x)=>a+x[1],0);
    el.subcategoryStrip.innerHTML=
      `<span class="subcategory-label">Уточнить:</span>`+
      `<button class="subcategory-chip ${!st.subcategory?'active':''}" type="button" data-subcategory-clear>Все · ${total}</button>`+
      list.map(([name,count])=>`<button class="subcategory-chip ${st.subcategory===name?'active':''}" type="button" data-subcategory="${U.escape(name)}">${U.escape(name)} · ${count}</button>`).join('');
    el.subcategoryStrip.hidden=false;
  }

  const FORM_FILTER_ORDER=['tablet','capsule','granules','suppository','enema','foam','suspension','drops','spray','cream','gel','ointment','injection','patch','powder','solution','other'];
  function formFilterKey(st){return [U.norm(st.query),st.category||'',st.subcategory||''].join('|')}
  function formStats(items){const map=new Map();for(const p of items){const k=Forms.kind(p.form);map.set(k,(map.get(k)||0)+1)}return map}
  function renderFormFilters(items){
    if(!el.formFilterStrip)return;
    const st=S.get(),hasQuery=Boolean(U.norm(st.query)),key=formFilterKey(st);

    // A new text search may offer form filters once. If the user presses
    // “Сбросить”, the whole filter capsule stays hidden until the query changes.
    if(key!==activeFormKey){
      activeFormKey=key;
      activeFormFilter='';
      activeFormFilters.clear();
      if(hasQuery)formFilterEngaged=true;
    }

    // Ordinary browsing stays clean until a form badge is tapped. Text-search
    // filters can also be dismissed completely without affecting the search.
    if(st.home || !formFilterEngaged){
      activeFormFilter='';
      if(st.home)activeFormFilters.clear();
      if(st.home){activeFormKey='';formFilterEngaged=false;}
      el.formFilterStrip.hidden=true;
      el.formFilterStrip.setAttribute('hidden','');
      el.formFilterStrip.style.display='none';
      el.formFilterStrip.innerHTML='';
      return;
    }

    const stats=formStats(items),useful=FORM_FILTER_ORDER.filter(k=>(stats.get(k)||0)>0);
    for(const k of Array.from(activeFormFilters))if(!stats.has(k))activeFormFilters.delete(k);
    if(!useful.length){
      activeFormFilters.clear();
      el.formFilterStrip.hidden=true;
      el.formFilterStrip.setAttribute('hidden','');
      el.formFilterStrip.style.display='none';
      el.formFilterStrip.innerHTML='';
      return;
    }

    formFilterEngaged=true;
    const total=items.length;
    const chips=[];
    chips.push(`<button type="button" class="form-filter-chip form-filter-all ${!activeFormFilters.size?'active':''}" data-form-filter="" aria-pressed="${!activeFormFilters.size?'true':'false'}"><i aria-hidden="true">${!activeFormFilters.size?'✓':'•'}</i><span>Сбросить</span></button>`);
    for(const k of useful){
      const inf=Forms.INFO[k]||Forms.INFO.other,active=activeFormFilters.has(k);
      chips.push(`<button type="button" class="form-filter-chip form-${k} ${active?'active':''}" data-form-filter="${k}" aria-pressed="${active?'true':'false'}"><i aria-hidden="true">${active?'✓':'□'}</i><span>${U.escape(inf.label)}</span></button>`);
    }
    el.formFilterStrip.innerHTML=`<div class="form-filter-scroll">${chips.join('')}</div>`;
    el.formFilterStrip.removeAttribute('hidden');
    el.formFilterStrip.hidden=false;
    el.formFilterStrip.style.display='flex';
  }
  function applyFormFilter(items){return activeFormFilters.size?items.filter(p=>activeFormFilters.has(Forms.kind(p.form))):items}

  function syncCatalogFormSelect(items){
    if(!el.catalogFormSelect)return;
    const st=S.get(),key=formCompareAnchorPzn?('compare:'+formCompareAnchorPzn):formFilterKey(st);
    if(key!==activeFormKey){activeFormKey=key;activeFormFilter='';activeFormFilters.clear()}
    const stats=formStats(items);
    const useful=FORM_FILTER_ORDER.filter(k=>(stats.get(k)||0)>0);
    if(activeFormFilter&&!stats.has(activeFormFilter))activeFormFilter='';
    const opts=['<option value="">Все формы</option>'];
    for(const k of useful){
      const inf=Forms.INFO[k]||Forms.INFO.other;
      opts.push(`<option value="${k}">${U.escape(inf.label)} · ${stats.get(k)}</option>`);
    }
    el.catalogFormSelect.innerHTML=opts.join('');
    el.catalogFormSelect.value=activeFormFilters.size===1?Array.from(activeFormFilters)[0]:'';
    el.catalogFormSelect.disabled=useful.length<2;
    const wrap=el.catalogFormSelect.closest('.catalog-form-select');
    if(wrap)wrap.classList.toggle('is-disabled',useful.length<2);
  }

  function resultSection(title,subtitle,items,limit,kind){
    const shown=items.slice(0,limit);
    const more=items.length-shown.length;
    return `<section class="search-result-group ${kind}">
      <header class="search-group-head">
        <div><strong>${U.escape(title)}</strong>${subtitle?`<span>${U.escape(subtitle)}</span>`:''}</div>
        <em>${items.length} ${U.pluralProducts?U.pluralProducts(items.length):'товаров'}</em>
      </header>
      <div class="search-group-list">${shown.length?shown.map(row).join(''):`<div class="search-group-empty">Совпадений нет</div>`}</div>
      ${more>0?`<button class="search-more" type="button" data-search-more="${kind}">Показать ещё ${Math.min(more,limit)}</button>`:''}
    </section>`;
  }

  function runLocalCatalogAction(action){
    const y=window.scrollY||0;
    document.dispatchEvent(new CustomEvent('rxde:local-control',{detail:{phase:'start',scrollY:y}}));
    action();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      window.scrollTo({top:y,behavior:'auto'});
      document.dispatchEvent(new CustomEvent('rxde:local-control',{detail:{phase:'end',scrollY:window.scrollY||0}}));
    }));
  }

  function scrollResultsTop(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      // Search should land on the RESULTS HEADER, not on the first card.
      // This keeps the count, form filters and the complete first row visible.
      const target=el.catalogToolbar||el.productList||el.contextLine;
      if(!target)return;
      const sticky=document.getElementById('stickyStack');
      const stickyBottom=sticky?Math.max(0,sticky.getBoundingClientRect().bottom):0;
      const targetDocTop=target.getBoundingClientRect().top+window.scrollY;
      const top=targetDocTop-stickyBottom-10;
      window.scrollTo({top:Math.max(0,top),behavior:'auto'});
    }));
  }

  function scrollCategoryFirstRow(){
    // The category capsule can be fixed/ported outside the normal document flow.
    // Measure an actual product row instead; no stale, fixed-position hero offsets.
    const jump=()=>{
      const first=el.productList?.querySelector('.product-row') ||
                  el.productList?.querySelector('.static-product-card') ||
                  el.productList?.firstElementChild;
      const target=first || el.catalogToolbar || el.productList;
      if(!target)return;
      const stack=document.getElementById('stickyStack');
      const stackRect=stack?.getBoundingClientRect();
      const stackBottom=stackRect && stackRect.height>0 ? Math.max(0,stackRect.bottom):0;
      // Make the FIRST card fully visible below the sticky navigation.
      const top=Math.max(0,window.scrollY+target.getBoundingClientRect().top-stackBottom-12);
      window.scrollTo({top,behavior:'auto'});
    };
    requestAnimationFrame(()=>requestAnimationFrame(jump));
  }

  function scrollCatalogHeroTop(){
    // Both category tabs and the category heading return to the first card.
    scrollCategoryFirstRow();
  }

  const CATALOG_HERO={
    '':{title:'Весь каталог',slogan:'Быстрый поиск и заказ по всей базе RXDE',img:'assets/categories/medical.webp',tone:'all'},
    'Витамины и минералы':{title:'Витамины и минералы',slogan:'Больше энергии для каждого дня',img:'assets/categories/vitamins.webp',tone:'vitamins'},
    'Уход и косметика':{title:'Уход и косметика',slogan:'Естественная красота и уход в каждом дне',img:'assets/categories/cosmetics.webp',tone:'care'},
    'Пищеварение':{title:'Пищеварение',slogan:'Лёгкость и комфорт изнутри',img:'assets/categories/digestion.webp',tone:'digestion'},
    'Боль, мышцы и суставы':{title:'Боль, мышцы и суставы',slogan:'Движение без ограничений',img:'assets/categories/joints.webp',tone:'joints'},
    'Глаза':{title:'Глаза',slogan:'Яркий взгляд на важное',img:'assets/categories/eyes.webp',tone:'eyes'},
    'Простуда и дыхание':{title:'Простуда и дыхание',slogan:'Свободное дыхание в любое время года',img:'assets/categories/respiratory.webp',tone:'breath'},
    'Детские товары':{title:'Детские товары',slogan:'Забота о самом дорогом',img:'assets/categories/children.webp',tone:'kids'},
    'Волосы и кожа головы':{title:'Волосы и кожа головы',slogan:'Сила и здоровье с естественной заботой',img:'assets/categories/hair.webp',tone:'hair'},
    'Кожа и заживление':{title:'Кожа и заживление',slogan:'Комфорт и восстановление каждый день',img:'assets/categories/skin.webp',tone:'skin'},
    'Товары для животных':{title:'Животным',slogan:'Здоровье и радость для ваших питомцев',img:'assets/categories/pets.webp',tone:'pets'},
    'Аллергия':{title:'Аллергия',slogan:'Больше комфорта в любой сезон',img:'assets/categories/allergy.webp',tone:'allergy'},
    'Другие препараты':{title:'Другие препараты',slogan:'Специализированные товары и препараты',img:'assets/categories/medical.webp',tone:'all'},
    'Уход за полостью рта':{title:'Полость рта',slogan:'Свежесть и уверенность каждый день',img:'assets/categories/mouth.webp',tone:'mouth'}
  };

  function syncSortControls(){
    document.querySelectorAll('[data-sort-toggle]').forEach(btn=>{
      const axis=btn.dataset.sortToggle||'';
      const dir=axis==='name'?nameSortDir:axis==='price'?priceSortDir:'';
      const active=!!dir;
      btn.classList.toggle('active',active);
      btn.classList.toggle('primary-sort',active&&sortPrimary===axis);
      btn.setAttribute('aria-pressed',active?'true':'false');
      if(axis==='name'){
        let label='';
        if(dir==='asc') label='<span class="sort-label">A–Z</span><span class="sort-arrow single vertical">↓</span>';
        else if(dir==='desc') label='<span class="sort-label">A–Z</span><span class="sort-arrow single vertical">↑</span>';
        else label='<span class="sort-label">A–Z</span><span class="sort-arrow-pair opposing" aria-hidden="true"><i>↑</i><i>↓</i></span>';
        btn.innerHTML=label;
        btn.title=dir==='asc'?'По названию: A → Z':dir==='desc'?'По названию: Z → A':'По названию: без сортировки';
      }else if(axis==='price'){
        let label='';
        if(dir==='desc') label='<span class="sort-label">₽</span><span class="sort-arrow single vertical">↓</span>';
        else if(dir==='asc') label='<span class="sort-label">₽</span><span class="sort-arrow single vertical">↑</span>';
        else label='<span class="sort-label">₽</span><span class="sort-arrow-pair opposing" aria-hidden="true"><i>↑</i><i>↓</i></span>';
        btn.innerHTML=label;
        btn.title=dir==='desc'?'По цене: от большей к меньшей':dir==='asc'?'По цене: от меньшей к большей':'По цене: без сортировки';
      }
    });
  }

  function sortCatalogItems(items){
    const a=items.map((item,index)=>({item,index}));
    const cmpName=(x,y)=>{
      const v=String(x.item.name||'').localeCompare(String(y.item.name||''),'ru',{sensitivity:'base',numeric:true});
      return nameSortDir==='desc'?-v:v;
    };
    const cmpPrice=(x,y)=>{
      const v=(Number(x.item.eur)||0)-(Number(y.item.eur)||0);
      return priceSortDir==='desc'?-v:v;
    };
    const criteria=[];
    if(sortPrimary==='price'){
      if(priceSortDir)criteria.push(cmpPrice);
      if(nameSortDir)criteria.push(cmpName);
    }else{
      if(nameSortDir)criteria.push(cmpName);
      if(priceSortDir)criteria.push(cmpPrice);
    }
    if(!criteria.length)return items.slice();
    a.sort((x,y)=>{
      for(const cmp of criteria){const v=cmp(x,y);if(v)return v}
      return x.index-y.index;
    });
    return a.map(x=>x.item);
  }


  function shareFeedback(button,ok,label){
    if(ok){try{navigator.vibrate?.(24)}catch(_){}}
    if(button){
      button.classList.toggle('rxde-share-confirmed',!!ok);
      button.classList.toggle('rxde-share-failed',!ok);
      if(!button.dataset.rxdeOriginalLabel)button.dataset.rxdeOriginalLabel=button.getAttribute('aria-label')||'Поделиться';
      button.setAttribute('aria-label',ok?'Скопировано в буфер':'Ошибка копирования');
      if(button._rxdeShareTimer)clearTimeout(button._rxdeShareTimer);
      button._rxdeShareTimer=setTimeout(()=>{
        button.classList.remove('rxde-share-confirmed','rxde-share-failed');
        button.setAttribute('aria-label',button.dataset.rxdeOriginalLabel||'Поделиться');
      },1700);
    }
    let toast=document.getElementById('rxdeShareFeedback');
    if(!toast){toast=document.createElement('div');toast.id='rxdeShareFeedback';toast.className='rxde-share-feedback';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');document.body.appendChild(toast)}
    toast.textContent=(ok?'✓  Скопировано':'Не удалось скопировать')+(ok&&label?' · '+label:'');
    toast.classList.toggle('is-error',!ok);toast.classList.add('visible');
    if(toast._rxdeTimer)clearTimeout(toast._rxdeTimer);
    toast._rxdeTimer=setTimeout(()=>toast.classList.remove('visible'),1900);
  }
  async function copyRxdeShare(text, success, button){
    let copied=false;
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);copied=true}}catch(_){}
    if(!copied){
      try{const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(ta);ta.select();copied=document.execCommand('copy');ta.remove()}catch(_){}
    }
    shareFeedback(button,copied,success);
    return copied;
  }
  function rxdeContactFooter(){
    const cfg=window.RXDE_CONFIG||{};
    const site=String(R.Constants.PUBLIC_BASE_URL||'');
    const email=String(cfg.contactEmail||'med.zakaz.de@gmail.com');
    return (site?'Сайт: '+site+'\n':'')+'Email: '+email;
  }
  function sharePriceDate(){
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(new Date());
    const part=k=>parts.find(p=>p.type===k)?.value||'';
    return part('day')+'.'+part('month')+'.'+part('year');
  }
  function singleShareText(p){
    const rate=Number(S.get().rate)||0,eur=Number(p.eur)||0;
    const rub=U.rubFinal?U.rubFinal(eur,rate):Math.floor(eur*rate/100)*100;
    return ['RXDE · '+p.name,'Цены на '+sharePriceDate(),'PZN '+p.pzn,'Цена за 1 упаковку: '+U.money(eur)+' € / '+U.money(rub)+' ₽',
      '',...(R.Constants.PUBLIC_BASE_URL?['Подробности: '+R.Constants.PUBLIC_BASE_URL.replace(/\/$/,'')+'/'+(window.RXDE_PRODUCT_PAGES?.[p.pzn]?'p/'+encodeURIComponent(p.pzn)+'/':'product.html?pzn='+encodeURIComponent(p.pzn))]:[]),
      'Цена расчётная; наличие и окончательную стоимость уточнит менеджер.','',''+rxdeContactFooter()].join('\n');
  }
  function shareSingleProduct(pzn,button){
    const p=Products.byPzn?.(pzn);
    if(!p){U.toast('Товар не найден');return}
    copyRxdeShare(singleShareText(p),'товар',button);
  }

  // Share filtered search results at current rate, never the stale price from source message.
  async function shareCurrentSearch(){
    const st=S.get(),query=String(st.query||el.searchInput?.value||'').trim();
    if(!query){U.toast('Сначала выполните поиск');return}
    const list=filtered.slice(0,40);
    if(!list.length){U.toast('Нет результатов для копирования');return}
    const rate=Number(S.get().rate)||0;
    const lines=['RXDE · Результаты поиска: '+query,'Цены на '+sharePriceDate(),'Цены за 1 упаковку · расчётный курс '+rate.toFixed(2)+' ₽/€',''];
    for(const p of list){
      const eur=Number(p.eur)||0;
      const rub=U.rubFinal?U.rubFinal(eur,rate):Math.floor(eur*rate/100)*100;
      lines.push('• '+p.name+' · PZN '+p.pzn+' — '+U.money(eur)+' € / '+U.money(rub)+' ₽');
    }
    if(filtered.length>list.length)lines.push('…ещё '+(filtered.length-list.length)+' позиций — уточните запрос');
    const site=String(R.Constants.PUBLIC_BASE_URL||'');
    const searchLink=site?site.replace(/\/$/,'')+'/?q='+encodeURIComponent(query):'';
    lines.push('','Цены расчётные, наличие и итог подтверждает менеджер.','',...(searchLink?['Сайт: '+searchLink]:[]),'Email: '+String((window.RXDE_CONFIG||{}).contactEmail||'med.zakaz.de@gmail.com'));
    const txt=lines.join('\n');
    await copyRxdeShare(txt,list.length+' поз.',document.getElementById('rxdeShareSearch'));
  }

  function renderCatalogHero(count){
    if(!el.catalogHero)return;
    const st=S.get(),query=String(st.query||'').trim();
    const hero=query?{...CATALOG_HERO[''],title:'Все'}:(CATALOG_HERO[st.category||'']||CATALOG_HERO['']);
    const toolbar=el.catalogToolbar;
    const workspace=document.querySelector('.workspace');
    const context=el.contextLine;
    const sortLabel=el.catalogSortControl||document.getElementById('catalogSortControl');
    const countZone=toolbar?.querySelector?.('.catalog-count-zone');

    if(toolbar&&workspace&&toolbar.parentElement!==workspace){
      workspace.insertBefore(toolbar,context||el.subcategoryStrip||el.productList);
    }

    if(el.catalogCount)el.catalogCount.textContent=`${count} ${U.pluralProducts?U.pluralProducts(count):'товаров'}`;
    syncSortControls();

    el.catalogHero.className=`catalog-hero tone-${hero.tone}`;
    el.catalogHero.style.setProperty('--hero-image',`url("${hero.img}")`);
    document.documentElement.style.setProperty('--rxde-category-image',`url("${hero.img}")`);
    document.documentElement.setAttribute('data-category-tone',hero.tone||'all');
    el.catalogHero.innerHTML=`<div class="catalog-hero-center"><div class="catalog-filter-pill" id="catalogFilterPill"></div><div class="catalog-hero-pill"><h1>${U.escape(hero.title)}</h1><div class="catalog-hero-meta" id="catalogHeroMeta"></div></div></div>`;
    const meta=el.catalogHero.querySelector('#catalogHeroMeta');
    const filterPill=el.catalogHero.querySelector('#catalogFilterPill');
    if(meta&&el.catalogCount)meta.appendChild(el.catalogCount);
    if(meta&&sortLabel)meta.appendChild(sortLabel);
    let shareBtn=meta?.querySelector('#rxdeShareSearch');
    if(meta){
      if(query){
        if(!shareBtn){shareBtn=document.createElement('button');shareBtn.type='button';shareBtn.id='rxdeShareSearch';shareBtn.className='rxde-share-search';shareBtn.innerHTML='<svg class="rxde-share-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.5M8.3 13.2l7.4 4.5"/></svg><span>Поделиться</span>';shareBtn.setAttribute('aria-label','Поделиться результатами поиска');shareBtn.title='Скопировать названия, PZN и цены';shareBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();shareCurrentSearch()});}
        meta.appendChild(shareBtn);
      }else shareBtn?.remove();
    }
    if(filterPill&&el.formFilterStrip)filterPill.appendChild(el.formFilterStrip);
    const formScroller=filterPill?.querySelector?.('.form-filter-scroll');
    const hasFormCapsule=!!(formScroller && el.formFilterStrip && !el.formFilterStrip.hidden && el.formFilterStrip.innerHTML.trim());
    el.catalogHero.classList.toggle('has-form-filters',hasFormCapsule);
    if(formScroller){
      const updateOverflowCue=()=>{
        const overflow=formScroller.scrollWidth>formScroller.clientWidth+4;
        const atStart=formScroller.scrollLeft<=4;
        const atEnd=formScroller.scrollLeft+formScroller.clientWidth>=formScroller.scrollWidth-4;
        filterPill.classList.toggle('has-horizontal-overflow',overflow);
        filterPill.classList.toggle('at-scroll-start',atStart);
        filterPill.classList.toggle('at-scroll-end',atEnd);
      };
      formScroller.addEventListener('scroll',updateOverflowCue,{passive:true});
      requestAnimationFrame(updateOverflowCue);
    }
    el.catalogHero.hidden=false;
  }

  function syncHome(){
    const st=S.get(),home=Boolean(st.home);
    document.body.classList.toggle('home-mode',home);
    if(el.homeView)el.homeView.hidden=true;
    if(el.contextLine){el.contextLine.hidden=true;el.contextLine.style.display='none'}
    if(el.productList){el.productList.hidden=false;el.productList.style.display=''}
    if(el.categoryStrip)el.categoryStrip.classList.remove('home-hidden');
    if(home&&el.subcategoryStrip)el.subcategoryStrip.hidden=true;
  }

  function doseLabel(p){
    // Dosage filter is safety-sensitive: use only explicit structured DB data.
    // Never guess a dosage from the product name.
    const raw=String(p?.dosage||'').trim();
    return raw?raw.replace(/\s+/g,' '):'';
  }
  function doseFamilyToken(p){return U.norm(orderFamilySearchTerm(p?.pzn||''));}
  function doseContextKey(st){return U.norm(st.query||'')+'|'+(st.category||'')+'|'+(st.subcategory||'')}
  function renderDoseFilters(items){
    if(!el.doseFilterStrip)return;
    const st=S.get(),query=U.norm(st.query||''),key=doseContextKey(st);
    if(key!==activeDoseKey){activeDoseKey=key;activeDoseFilter=''}
    const queryToken=(query.split(/\s+/)[0]||'');
    const sameFamily=items.filter(p=>doseFamilyToken(p)===queryToken);
    const source=sameFamily.length>=2?sameFamily:[];
    const counts=new Map();
    for(const p of source){const d=doseLabel(p);if(d)counts.set(d,(counts.get(d)||0)+1)}
    const doses=[...counts.entries()].sort((a,b)=>{
      const na=parseFloat(String(a[0]).replace(',','.')); const nb=parseFloat(String(b[0]).replace(',','.'));
      if(Number.isFinite(na)&&Number.isFinite(nb)&&na!==nb)return na-nb;
      return a[0].localeCompare(b[0],'ru');
    });
    if(!query || doses.length<2){activeDoseFilter='';el.doseFilterStrip.hidden=true;el.doseFilterStrip.innerHTML='';return}
    if(activeDoseFilter&&!counts.has(activeDoseFilter))activeDoseFilter='';
    el.doseFilterStrip.innerHTML=`<span class="dose-filter-label">Дозировка:</span><button type="button" class="dose-chip ${!activeDoseFilter?'active':''}" data-dose-filter="">Сбросить</button>${doses.map(([d,c])=>`<button type="button" class="dose-chip ${activeDoseFilter===d?'active':''}" data-dose-filter="${U.escape(d)}">${U.escape(d)}${c>1?` <b>${c}</b>`:''}</button>`).join('')}`;
    el.doseFilterStrip.hidden=false;
  }
  function applyDoseFilter(items){return activeDoseFilter?items.filter(p=>doseLabel(p)===activeDoseFilter):items}

  function renderProducts(){
    const st=S.get(),hasQuery=Boolean(U.norm(st.query));
    if(formCompareAnchorPzn&&formCompareSourceKey&&compareContextKey(st)!==formCompareSourceKey){
      formCompareAnchorPzn='';formCompareSourceKey='';activeFormFilter='';activeFormFilters.clear();activeFormKey='';formFilterEngaged=false;closeFormChooser();
    }
    syncHome();
    renderCategories();renderSearchScope();
    if(!st.home)renderSubcategories();else if(el.subcategoryStrip){el.subcategoryStrip.hidden=true;el.subcategoryStrip.innerHTML=''}

    let items=[];
    if(st.home){
      if(el.formFilterStrip){el.formFilterStrip.hidden=true;el.formFilterStrip.innerHTML=''}
      items=P.all.slice();
    }else if(!hasQuery){
      items=Q.browse(st.category,st.subcategory);
    }else{
      const rawGroups=Q.split(st.query,'','');
      items=rawGroups.all;
    }

    if(favoritesOnly)items=P.all.filter(p=>favSet.has(U.pzn(p.pzn)));
    let filterableItems=items.slice();
    renderDoseFilters(filterableItems);
    filterableItems=applyDoseFilter(filterableItems);
    renderFormFilters(filterableItems);
    syncCatalogFormSelect(filterableItems);
    items=applyFormFilter(filterableItems);
    filtered=sortCatalogItems(items);
    const autoExpandForms=activeFormFilters.size>=3;
    const visible=autoExpandForms?filtered:filtered.slice(0,st.limit);
    el.productList.classList.toggle('search-grid-mode',hasQuery);
    el.productList.innerHTML=visible.map(row).join('')||(hasQuery?'<div class="search-group-empty standalone rxde-empty-search">Ничего не найдено в каталоге.<button type="button" class="rxde-empty-contact" data-rxde-no-results-contact>Напишите нам →</button></div>':'<div class="search-group-empty standalone">В этой категории пока нет товаров.</div>');
    el.loadMore.hidden=autoExpandForms||filtered.length<=visible.length;
    renderCatalogHero(filtered.length);
    if(el.catalogCount&&activeFormFilters.size){const total=filterableItems.length;el.catalogCount.textContent=`${filtered.length} из ${total} ${U.pluralProducts?U.pluralProducts(total):'товаров'}`;}
    if(el.catalogToolbar)el.catalogToolbar.hidden=false;
    renderFlowNav();
    syncFavoritesUI();
    if(favoritesOnly){const heading=el.catalogHero?.querySelector('h1');if(heading)heading.textContent='Любимое'}
  }

  function compactLine(it,i){return OrderView.compactLine(it,i,{U,S,P})}
  function renderOrder(){
    const st=S.get(),t=Cart.totals();
    el.rateValue.textContent=st.rate.toFixed(2);
    const items=st.cart.map(compactLine).join('');
    const logistics=OrderView.logisticsLine({U,S,Cart},true);
    el.orderLines.innerHTML=items+(t.positions?`<div class="rxde-shipping-at-end" aria-label="Почта DHL"><span><b>Почта DHL · до 5 кг</b><small>12–25 дней</small></span><span class="rxde-shipping-price"><b>${U.money(t.shippingEur)} €</b><small>${U.money(t.shippingEur*st.rate)} ₽</small></span></div>`:'');
    const headline=document.getElementById('rxdeOrderRateHeadline');if(headline)headline.textContent=st.rate.toFixed(2);
    const dhlFixed=document.getElementById('rxdeDhlFixed');
    if(dhlFixed){
      dhlFixed.hidden=true;
      dhlFixed.innerHTML=t.positions?`<span class="rxde-dhl-name"><b>Почта DHL · до 5 кг</b><small>Обязательная доставка · 12–25 дней</small></span><span class="rxde-dhl-price"><b>${U.money(t.shippingEur)} €</b><small>${U.money(t.shippingRub)} ₽</small></span>`:'';
    }
    if(!st.cart.length)el.orderLines.innerHTML='<div class="order-empty contact-empty"><b>Заказ пока пуст — это не мешает написать нам.</b><span>Задайте вопрос по товару, оплате, срокам или доставке. Менеджер сначала ответит, ничего автоматически не оформляется.</span></div>';
    if(el.addOrderProduct){
      el.addOrderProduct.textContent='+ Добавить товар';
      el.addOrderProduct.title='Вернуться к поиску и добавить ещё позицию';
    }
    // Checkout35 owns this button; renderOrder must never restore the retired label/icon.
    if(el.submitOrder && !el.submitOrder.closest('#rxdeCheckoutFlow10')){
      el.submitOrder.textContent='Проверить контакты →';
    }
    el.orderPositions.textContent=`${t.positions} поз. · ${t.packs} уп.`;
    el.orderTotalRub.textContent=`${U.money(t.rub)} ₽`;
    el.orderTotalEur.hidden=false;
    el.orderTotalEur.textContent=`${U.money(t.eur)} € · курс ${st.rate.toFixed(2)} ₽/€`;
    el.orderTotalEur.title=`Сумма в евро и актуальный расчётный курс`;
    if(el.orderHeaderMeta)el.orderHeaderMeta.textContent=`${t.positions} поз. · ${t.packs} уп.`;
    if(el.orderHeaderTotal)el.orderHeaderTotal.textContent=`${U.money(t.rub)} ₽`;
    renderOrderStatus();
    syncRestoreReceiptButton();
  }
  function orderDockPreview(){
    const st=S.get();
    if(!st.cart.length){
      return `<div class="dock-preview-empty">Лист заказа пока пуст</div>`;
    }
    const lines=st.cart.slice(0,3).map(it=>{
      const p=P.byPzn.get(it.pzn);if(!p)return'';
      const unit=U.rub(p.eur,st.rate),sum=unit*it.qty;
      return `<div class="dock-preview-line">
        <span>${U.escape(p.name)}</span>
        <small>${U.money(unit)} ₽ × ${it.qty}</small>
        <b>${U.money(sum)} ₽</b>
      </div>`;
    }).join('');
    const more=st.cart.length>3?`<div class="dock-preview-more">+ ещё ${st.cart.length-3} поз.</div>`:'';
    const t=Cart.totals();
    return `${lines}${more}<div class="dock-preview-total"><span>${t.positions} поз. · ${t.packs} уп.</span><b>${U.money(t.rub)} ₽</b></div>`;
  }

  let orderAddHintTimer=0;
  function showOrderAddHint(isQuantityIncrease=false){
    let hint=document.getElementById('rxdeOrderAddHint77');
    if(!hint){
      hint=document.createElement('div');
      hint.id='rxdeOrderAddHint77';
      hint.className='rxde-order-add-hint77';
      hint.innerHTML='<strong>Позиция добавлена!</strong><span>Оформите заявку</span><span>или продолжите выбор.</span>';
      hint.setAttribute('role','status');
      document.body.appendChild(hint);
    }
    hint.querySelector('strong').textContent=isQuantityIncrease?'Количество увеличено!':'Позиция добавлена!';
    // Show the existing lightweight cart peek only if the actual dock has scrolled away.
    // No header reveal or page reflow; keep the peek visible for the whole notice.
    window.RXDEShowCartPeek?.('up', 3500);
    const actual=el.desktopOrderDock;
    const peek=document.getElementById('rxdeTransientCartPeek');
    const peekVisible=peek?.classList.contains('visible');
    const dock=peekVisible?peek:actual;
    const box=dock?.getBoundingClientRect();
    // Both the normal dock and its floating replacement use the same under-dock notice.
    // Avoid overlapping the clickable cart and never shift the catalogue layout.
    const right=box?Math.max(8,innerWidth-box.right):12;
    const top=box?Math.min(innerHeight-70,Math.max(12,box.bottom+5)):80;
    hint.style.right=right+'px';
    hint.style.top=top+'px';
    hint.classList.remove('rxde-hide');
    void hint.offsetWidth;
    hint.classList.add('rxde-visible');
    clearTimeout(orderAddHintTimer);
    orderAddHintTimer=setTimeout(()=>{hint.classList.remove('rxde-visible');hint.classList.add('rxde-hide')},3500);
  }

  let orderStatusSeq=0;
  let orderStatusAppliedSeq=0;
  function renderOrderStatus(snapshot=null,seq=null){
    const t=snapshot||Cart.totals();
    if(seq!==null){
      if(seq<orderStatusAppliedSeq)return;
      orderStatusAppliedSeq=seq;
    }
    const has=Boolean(t.positions);
    for(const dock of [el.desktopOrderDock,el.quickOrderDock]){
      if(!dock)continue;
      const title=dock.querySelector('.rxde-dock-title');
      if(title)title.textContent=has?'Оформить заказ':'Лист заказа';
      dock.setAttribute('aria-label',has?`Оформить заказ, ${t.packs} упаковок, ${U.money(t.rub)} рублей`:'Открыть пустой лист заказа');
      dock.title=has?'Оформить заказ':'Лист заказа пуст';
    }

    if(el.desktopOrderDock){
      el.desktopOrderDock.classList.toggle('has-order',has);
      el.desktopOrderDock.classList.toggle('contact-ready',!has);
      if(el.desktopOrderMeta)el.desktopOrderMeta.textContent=`${t.positions} поз. · ${t.packs} уп.`;
      if(el.desktopOrderTotal)el.desktopOrderTotal.textContent=`${U.money(t.rub)} ₽`;
    }
    if(el.quickOrderDock){
      el.quickOrderDock.classList.toggle('has-order',has);
      el.quickOrderDock.classList.toggle('contact-ready',!has);
      if(el.quickOrderMeta)el.quickOrderMeta.textContent=`${t.positions} поз. · ${t.packs} уп.`;
      if(el.quickOrderTotal)el.quickOrderTotal.textContent=`${U.money(t.rub)} ₽`;
    }
  }
  function phoneDigits(value){return String(value||'').replace(/\D/g,'');}
  function unifiedPhoneMode(){return !!document.getElementById('rxdeUnifiedPhone')?.checked;}
  function selectedMessengers(){
    const common=String(document.getElementById('phoneInput')?.value||'').trim();
    return ['MAX','Viber','Telegram','WhatsApp']
      .filter(name=>document.getElementById('rxdeUse'+name)?.checked)
      .map(name=>({name,contact:unifiedPhoneMode()?common:String(document.getElementById('rxdeContact'+name)?.value||'').trim()}));
  }
  function validatePhone(show=true){
    const phone=String(el.phoneInput?.value||'').trim();
    const emailInput=document.getElementById('orderContactEmail');
    const email=String(emailInput?.value||'').trim();
    const messengers=selectedMessengers();
    const selectedPhone=!!document.getElementById('rxdeUsePhone')?.checked;
    const selectedEmail=!!document.getElementById('rxdeUseEmail')?.checked;
    const unified=unifiedPhoneMode();
    const phoneOk=!(selectedPhone||unified)||!phone||phone.length>=2;
    const emailOk=!selectedEmail||!email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const missing=messengers.some(m=>!m.contact);
    const hasContact=Boolean(((selectedPhone||unified)&&phone)||(selectedEmail&&email)||messengers.some(m=>m.contact));
    const ok=hasContact&&phoneOk&&emailOk&&!missing;
    el.phoneInput?.classList.toggle('is-invalid',(selectedPhone||unified)&&!!phone&&!phoneOk);
    emailInput?.classList.toggle('is-invalid',selectedEmail&&!!email&&!emailOk);
    let msg=el.confirmBackdrop?.querySelector('.rxde-contact-error');
    if(!msg&&show){msg=document.createElement('p');msg.className='rxde-contact-error';document.getElementById('confirmSubmit')?.insertAdjacentElement('beforebegin',msg);}
    if(msg)msg.textContent=ok?'':(!phoneOk?'Проверьте номер.':!emailOk?'Проверьте email.':missing?(unified?'Укажите единый номер для выбранных мессенджеров.':'Укажите контакт выбранного мессенджера.'):'Укажите хотя бы один контакт.');
    return ok;
  }
  function updateConfirmSubmitState(){
    const btn=el.confirmSubmit;
    if(!btn)return;
    if(btn.dataset.busy==='1')return;
    const ready=validatePhone(false);
    btn.disabled=false;
    btn.classList.toggle('is-ready',ready);
    btn.classList.toggle('is-disabled',!ready);
    btn.setAttribute('aria-disabled', ready ? 'false' : 'true');
    btn.title=ready?'':'Заполните хотя бы один контакт';
  }
  function optionalEmail(id){
    const input=document.getElementById(id);const email=String(input?.value||'').trim();
    if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){input?.focus();U.toast?.('Проверьте email');throw new Error('invalid-email')}
    return email;
  }
  function showLocalSendStatus(){
    const card=el.confirmBackdrop?.querySelector('.confirm-card');if(!card)return;
    let box=card.querySelector('.confirm-local-status');
    if(!box){box=document.createElement('div');box.className='confirm-local-status';el.confirmSubmit?.insertAdjacentElement('afterend',box);}
    box.textContent=navigator.onLine
      ? 'Тестовый режим: данные проверены. Реальная отправка менеджеру будет подключена на этапе интеграции.'
      : 'Вы офлайн: данные проверены и остаются на экране, но для реальной отправки менеджеру понадобится интернет.';
  }

  function freezePage(){return Mobile.freezePage()}

  function unfreezePage(restore=true){return Mobile.unfreezePage(restore)}

  function isMobile(){return Mobile.isMobile()}

  function blurSearch(){return Mobile.blurSearch(el.searchInput)}

  function setMobileMode(mode){
    S.set({mobileMode:mode});
    document.body.dataset.mobileMode=mode;
    blurSearch();

    const lock = mode!=='search';
    document.body.classList.toggle('mobile-locked',lock);

    if(lock)freezePage();
    else unfreezePage(true);

    if(mode==='search'){
      if(el.orderBackdrop)el.orderBackdrop.hidden=true;
      if(el.confirmBackdrop)el.confirmBackdrop.hidden=true;
      if(el.questionBackdrop)el.questionBackdrop.hidden=true;
    }
  }

  function restoreSearchMode(){
    setMobileMode('search');
    document.body.style.overflow='';
  }

  function snapshotSearchState(){
    const st=S.get();
    return {
      query:st.query,category:st.category,subcategory:st.subcategory,
      mobileSearchScope:st.mobileSearchScope,
      searchScrollCategory:st.searchScrollCategory,
      searchScrollGlobal:st.searchScrollGlobal,
      limit:st.limit,categoryLimit:st.categoryLimit,globalLimit:st.globalLimit
    };
  }

  function orderFamilySearchTerm(pzn){
    const p=P.byPzn.get(U.pzn(pzn));
    if(!p)return'';
    const name=String(p.name||'').trim();
    if(!name)return'';
    // Same family rule used by related products: brand / first meaningful name token.
    const token=(name.split(/\s+/)[0]||'').replace(/[®™,:;]+$/g,'').trim();
    return token||name;
  }

  function restoreFamilySearchIfSame(pzn){
    pzn=U.pzn(pzn);
    if(!pzn)return false;
    const query=orderFamilySearchTerm(pzn);
    if(!query||U.norm(S.get().query)!==U.norm(query))return false;

    if(navBridge.fromOrder&&U.pzn(navBridge.pzn)===pzn){
      returnToOrder(pzn);
      return true;
    }
    try{
      const pr=JSON.parse(sessionStorage.getItem('rxde:productReturn')||'null');
      if(pr?.url&&U.pzn(pr.pzn)===pzn){
        sessionStorage.removeItem('rxde:productReturn');
        location.href=pr.url;
        return true;
      }
    }catch(_e){}
    if(formBadgeReturnContext&&U.pzn(formBadgeReturnContext.pzn)===pzn){
      restoreFormBadgeReturnContext();
      return true;
    }
    return false;
  }

  function jumpOrderToFamily(pzn){
    pzn=U.pzn(pzn);
    if(restoreFamilySearchIfSame(pzn))return;
    const query=orderFamilySearchTerm(pzn);
    if(!query)return;

    navBridge.fromOrder=true;
    navBridge.pzn=pzn;
    navBridge.orderScrollTop=el.orderLines?.scrollTop||0;
    navBridge.searchSnapshot=snapshotSearchState();
    navBridge.searchScrollY=window.scrollY||0;

    formFilterEngaged=false;
    activeFormFilter='';

    S.set({
      orderOpen:false,
      home:false,
      query,
      category:'',
      subcategory:'',
      mobileSearchScope:'global',
      limit:R.Constants.PAGE_SIZE,
      categoryLimit:8,
      globalLimit:R.Constants.PAGE_SIZE,
      expanded:new Set()
    });
    el.orderBackdrop.hidden=true;
    el.orderSheet?.classList.remove('manager-target-active');
    document.body.style.overflow='';
    if(isMobile())restoreSearchMode();

    el.searchInput.value=query;
    hideSuggestions();
    renderProducts();
    renderSearchScope();
    renderFlowNav();
    requestAnimationFrame(scrollResultsTop);
  }

  function jumpOrderToProduct(pzn){
    pzn=U.pzn(pzn);
    navBridge.fromOrder=true;
    navBridge.pzn=pzn;
    navBridge.orderScrollTop=el.orderLines?.scrollTop||0;
    navBridge.searchSnapshot=snapshotSearchState();
    navBridge.searchScrollY=window.scrollY||0;

    S.set({
      orderOpen:false,
      query:pzn,
      category:'',
      subcategory:'',
      mobileSearchScope:'global',
      limit:R.Constants.PAGE_SIZE,
      categoryLimit:6,
      globalLimit:6,
      expanded:new Set([pzn])
    });
    el.orderBackdrop.hidden=true;
    el.orderSheet?.classList.remove('manager-target-active');
    document.body.style.overflow='';
    if(isMobile())restoreSearchMode();

    el.searchInput.value=pzn;
    renderProducts();

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const card=el.productList.querySelector(`.product-row[data-pzn="${pzn}"]`);
      card?.scrollIntoView({behavior:'smooth',block:'center'});
      card?.classList.remove('bridge-highlight-v155'); if(card){void card.offsetWidth;card.classList.add('bridge-highlight-v155')}
      setTimeout(()=>card?.classList.remove('bridge-highlight-v155'),1500);
    }));
  }

  function returnToOrder(pzn){
    pzn=U.pzn(pzn||navBridge.pzn);
    openOrder(pzn);
    setTimeout(()=>{
      if(el.orderLines)el.orderLines.scrollTop=navBridge.orderScrollTop||0;
      const row=el.orderLines?.querySelector(`[data-pzn="${pzn}"]`);
      row?.classList.add('bridge-highlight');
      setTimeout(()=>row?.classList.remove('bridge-highlight'),900);
    },100);
  }

  function leaveBridgeIfNeeded(){
    if(!navBridge.fromOrder)return;
    navBridge.fromOrder=false;
    navBridge.pzn='';
  }

  function pulseOrderTarget(pzn){
    pzn=U.pzn(pzn);if(!pzn)return;
    const run=()=>{
      const x=el.orderLines?.querySelector(`.order-product-row[data-pzn="${pzn}"],.order-line[data-pzn="${pzn}"]`);
      if(!x)return false;
      x.scrollIntoView({behavior:'smooth',block:'center'});
      x.classList.remove('bridge-highlight-order-v155','bridge-highlight','order-target-pulse-v176');
      void x.offsetWidth;
      x.classList.add('order-target-pulse-v176');
      setTimeout(()=>x.classList.remove('order-target-pulse-v176'),2200);
      return true;
    };
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!run())setTimeout(run,120)}));
  }
  function pulseManagerSubmit(){
    if(!el.submitOrder)return;
    el.submitOrder.classList.remove('manager-entry-pulse');
    void el.submitOrder.offsetWidth;
    el.submitOrder.classList.add('manager-entry-pulse');
    setTimeout(()=>el.submitOrder?.classList.remove('manager-entry-pulse'),1500);
  }
  function animateManagerGuidePointer(){
    if(!el.orderHeaderStatus||!el.submitOrder)return;
    const from=el.orderHeaderStatus.getBoundingClientRect();
    const to=el.submitOrder.getBoundingClientRect();
    const guide=document.createElement('div');
    guide.className='manager-guide-pointer';
    guide.innerHTML='<svg viewBox="0 0 30 36" aria-hidden="true"><path d="M4 2v27l7-7 5 12 5-2-5-12h10z"/></svg>';
    guide.style.left=`${from.left+from.width*.5}px`;
    guide.style.top=`${from.top+from.height*.55}px`;
    document.body.appendChild(guide);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      guide.style.left=`${to.left+to.width*.55}px`;
      guide.style.top=`${to.top+to.height*.45}px`;
      guide.classList.add('go');
    }));
    setTimeout(()=>guide.remove(),900);
  }

  function bindOrderHeaderPulse(){
    if(!el.orderHeaderStatus||el.orderHeaderStatus.dataset.managerBound==='1')return;
    el.orderHeaderStatus.dataset.managerBound='1';
    let guidedLock=false;
    let guidedTimer=0;
    let lastGuideTs=0;
    const targetOn=()=>{
      el.orderSheet?.classList.add('manager-target-active');
      pulseManagerSubmit();
    };
    const targetOff=()=>{
      if(guidedLock)return;
      el.orderSheet?.classList.remove('manager-target-active');
    };
    const runGuide=()=>{
      guidedLock=true;
      clearTimeout(guidedTimer);
      el.orderSheet?.classList.add('manager-target-active','manager-target-clicked');
      animateManagerGuidePointer();
      el.submitOrder?.scrollIntoView({behavior:'smooth',block:'nearest'});
      try{el.submitOrder?.focus({preventScroll:true});}catch(_e){}
      pulseManagerSubmit();
      setTimeout(()=>pulseManagerSubmit(),520);
      setTimeout(()=>pulseManagerSubmit(),1040);
      guidedTimer=setTimeout(()=>{
        guidedLock=false;
        el.orderSheet?.classList.remove('manager-target-active','manager-target-clicked');
      },2600);
    };
    const guidedClick=(evt)=>{
      if(evt?.type==='pointerup' && evt.pointerType==='mouse')return;
      const now=Date.now();
      if(now-lastGuideTs<420)return;
      lastGuideTs=now;
      runGuide();
    };
    el.orderHeaderStatus.addEventListener('mouseenter',targetOn);
    el.orderHeaderStatus.addEventListener('focus',targetOn);
    el.orderHeaderStatus.addEventListener('mouseleave',targetOff);
    el.orderHeaderStatus.addEventListener('blur',targetOff);
    el.orderHeaderStatus.addEventListener('pointerup',guidedClick,{passive:true});
    el.orderHeaderStatus.addEventListener('click',guidedClick);
    el.orderHeaderStatus.setAttribute('title','Показать следующий шаг для отправки менеджеру');
    el.orderHeaderStatus.setAttribute('role','button');
    el.orderHeaderStatus.setAttribute('tabindex','0');
    el.orderHeaderStatus.addEventListener('keydown',e=>{
      if(e.key==='Enter' || e.key===' '){e.preventDefault();guidedClick(e);}
    });
  }
  function openOrder(pzn,fromDock=false){
    R.RateGuard?.refresh({reason:'order'});
    blurSearch();
    S.set({orderOpen:true});
    if(isMobile())setMobileMode('order');
    el.orderBackdrop.hidden=false;
    renderOrder();renderFlowNav();
    bindOrderHeaderPulse();
    if(!isMobile())document.body.style.overflow='hidden';
    if(pzn)setTimeout(()=>pulseOrderTarget(pzn),80);
    if(fromDock)setTimeout(pulseManagerSubmit,140);
  }
  function closeOrder(){
    S.set({orderOpen:false});
    el.orderBackdrop.hidden=true;
    el.orderSheet?.classList.remove('manager-target-active');
    if(isMobile())restoreSearchMode(); else document.body.style.overflow='';renderFlowNav();

    if(navBridge.fromOrder && navBridge.searchSnapshot){
      const snap=navBridge.searchSnapshot;
      navBridge.fromOrder=false;
      navBridge.pzn='';
      navBridge.searchSnapshot=null;
      S.set({...snap,expanded:new Set()});
      el.searchInput.value=snap.query||'';
      renderProducts();
      requestAnimationFrame(()=>window.scrollTo({top:navBridge.searchScrollY||0,behavior:'auto'}));
    }
  }
  function ensureRxFlightLayer(){
    let layer=document.getElementById('rx-flight-layer');
    if(layer)return layer;
    layer=document.createElement('div');
    layer.id='rx-flight-layer';
    layer.setAttribute('aria-hidden','true');
    document.body.appendChild(layer);
    return layer;
  }
  function captureFlySource(source,pzn=''){
    const centerOf=node=>{
      if(!node||!node.getBoundingClientRect)return null;
      const r=node.getBoundingClientRect();
      if(!r.width&&!r.height)return null;
      return {x:r.left+r.width*.5,y:r.top+r.height*.5};
    };
    if(source&&typeof source.x==='number'&&typeof source.y==='number')return source;
    const fromSource=centerOf(source);
    if(fromSource)return fromSource;
    const key=U.pzn(pzn);
    const row=el.productList?.querySelector(`.product-row[data-pzn="${key}"]`);
    const rowStepper=row?.querySelector('.r2-qty');
    const rowPoint=centerOf(rowStepper||row);
    if(rowPoint)return rowPoint;
    const orderRow=el.orderLines?.querySelector(`.order-product-row[data-pzn="${key}"],.order-line[data-pzn="${key}"]`);
    const orderStepper=orderRow?.querySelector('.qty-stepper,[data-order-qty]')||orderRow;
    return centerOf(orderStepper)||null;
  }
  function activeOrderDock(){
    const inside=document.getElementById('orderHeaderStatus');
    if(S.get().orderOpen && inside){
      const r=inside.getBoundingClientRect();
      if(r.width&&r.height)return inside;
    }
    const quick=document.getElementById('quickOrderDock');
    const quickBackdrop=document.getElementById('productQuickBackdrop');
    if(quick && quickBackdrop && !quickBackdrop.hidden){
      const r=quick.getBoundingClientRect();
      if(r.width&&r.height)return quick;
    }
    // The cart peek is the real visible target when the sticky header is off-screen.
    const peek=document.getElementById('rxdeTransientCartPeek');
    if(peek?.classList.contains('visible')){
      const r=peek.getBoundingClientRect();
      if(r.width&&r.height)return peek;
    }
    return el.desktopOrderDock||null;
  }
  function flyRxBrand(pzn,direction='up',source=null,onDone=null){
    const done=()=>{try{onDone?.()}catch(_){}};
    const dockNode=activeOrderDock();
    if(!dockNode){done();return}
    const dockRect=dockNode.getBoundingClientRect();
    if(!dockRect.width){done();return}
    const sourcePoint=captureFlySource(source,pzn);
    if(!sourcePoint){done();return}

    const dockPoint={x:dockRect.left+dockRect.width*.5,y:dockRect.top+dockRect.height*.52};
    const from=direction==='down'?dockPoint:sourcePoint;
    const to=direction==='down'?sourcePoint:dockPoint;
    const layer=ensureRxFlightLayer();

    const ghost=document.createElement('div');
    ghost.className=`order-fly-ghost order-plane-flight drift-flight ${direction==='down'?'reverse-flight':''}`;
    ghost.innerHTML='<span class="flight-plane-core"><img src="assets/ui/flight-airliner.png" alt="" aria-hidden="true"></span>';
    const dx=to.x-from.x;
    const dy=to.y-from.y;
    const movingLeft=dx<0;
    let planeAngle=Math.atan2(dy,Math.abs(dx))*180/Math.PI;
    planeAngle=Math.max(-38,Math.min(38,planeAngle));
    const planeFlip=movingLeft?-1:1;

    ghost.style.left=`${from.x}px`;
    ghost.style.top=`${from.y}px`;
    ghost.style.transform=`translate(-50%,-50%) scaleX(${planeFlip}) rotate(${planeAngle}deg)`;
    layer.appendChild(ghost);
    const dist=Math.max(1,Math.hypot(dx,dy));
    const nx=-dy/dist;
    const ny=dx/dist;
    const swayBase=Math.max(8,Math.min(22,dist*0.028));
    const liftBase=Math.max(6,Math.min(16,dist*0.032));
    const duration=isMobile()?(direction==='down'?1900:2050):(direction==='down'?2250:2450);
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
      ghost.style.left=`${x}px`;
      ghost.style.top=`${y}px`;
      ghost.style.transform=`translate(-50%,-50%) scaleX(${planeFlip}) rotate(${planeAngle}deg) scale(${scale})`;
      ghost.style.opacity=String(Math.max(0,opacity));
      if(raw<1){
        requestAnimationFrame(frame);
      }else{
        ghost.remove();
        done();
      }
    };
    requestAnimationFrame(frame);
  }

  function pulseOrder(direction='up',pzn='',source=null,onDone=null){
    const done=()=>{try{onDone?.()}catch(_){}};
    const node=activeOrderDock();
    if(node){
      node.classList.remove('order-accepted','order-removed');
      void node.offsetWidth;
      node.classList.add(direction==='down'?'order-removed':'order-accepted');
      setTimeout(()=>node.classList.remove('order-accepted','order-removed'),1450);
    }
    if(pzn)setTimeout(()=>flyRxBrand(pzn,direction,source,done),70);
    else done();
  }
  function updateQuickViewQtyUI(pzn){
    pzn=U.pzn(pzn);
    if(quickViewPzn!==pzn)return;
    const p=P.byPzn.get(pzn);if(!p)return;
    const q=Cart.qty(pzn),st=S.get(),sumE=p.eur*q,sumR=U.rub(p.eur,st.rate)*q;
    const body=document.getElementById('productQuickBody');if(!body)return;
    const hasStepper=!!body.querySelector('#pqQty');
    const hasAdd=!!body.querySelector('.pq-add-zero');
    if((q>0&&!hasStepper)||(q===0&&!hasAdd)){renderQuickView(pzn,{history:false,preserveRelatedFilter:true,preserveRelatedScroll:true});return;}
    const input=body.querySelector('#pqQty');
    if(input && document.activeElement!==input)input.value=String(q);
    const minus=body.querySelector('[data-pq-delta="-1"]');
    if(minus)minus.disabled=q<=0;
    const picked=body.querySelector('[data-pq-picked]');
    if(picked){
      picked.classList.toggle('selected',q>=1);
      picked.innerHTML=q>=1?`<span class="r2-picked-sum">${U.money(sumR)} ₽</span>`:'';
    }
    const relatedHost=document.getElementById('productQuickRelated');
    if(relatedHost){
      relatedHost.querySelectorAll('.pq-float-related[data-pq-related-open]').forEach(card=>{
        const rpzn=U.pzn(card.dataset.pqRelatedOpen||'');
        const prod=P.byPzn.get(rpzn); if(!prod)return;
        const rq=Cart.qty(rpzn), rsumR=U.rub(prod.eur,st.rate)*rq;
        card.classList.toggle('selected',rq>0);
        const b=card.querySelector('.pq-related-stepper b'); if(b)b.textContent=String(rq);
        const rminus=card.querySelector('[data-pq-related-delta="-1"]'); if(rminus)rminus.disabled=rq<=0;
        const pickedLine=card.querySelector(`[data-pq-related-picked="${rpzn}"]`);
        if(pickedLine){
          pickedLine.classList.toggle('selected',rq>0);
          pickedLine.innerHTML=rq>0?`${rq} уп. · ${U.money(rsumR)} ₽`:'';
        }
      });
    }
  }

  function updateVisibleProductRow(pzn){
    pzn=U.pzn(pzn);
    const p=P.byPzn.get(pzn);if(!p)return;
    const q=Cart.qty(pzn);

    // Native mobile row: keep geometry fixed and only swap the action contents.
    const native=el.productList.querySelector(`.mn-product[data-pzn="${pzn}"]`);
    if(native){
      native.dataset.qty=String(q);
      native.classList.toggle('selected',q>0);
      const slot=native.querySelector('.mn-action-slot');
      if(slot){
        slot.innerHTML=q
          ? `<button type="button" class="mn-action in-cart" data-order-jump="${pzn}" aria-label="В заказе ${q} упаковок. Открыть корзину"><span>✓</span><b>${q}</b></button>`
          : `<button type="button" class="mn-action" data-delta="1" data-pzn="${pzn}" aria-label="Добавить одну упаковку">+</button>`;
      }
    }

    const card=el.productList.querySelector(`.product-row[data-pzn="${pzn}"]`);
    if(!card)return;

    const st=S.get();
    const sumE=p.eur*q;
    const sumR=U.rub(p.eur,st.rate)*q;

    card.dataset.qty=String(q);
    card.classList.toggle('selected',q>0);

    const qtyCell=card.querySelector('.r2-qty-cell');
    if(qtyCell){
      qtyCell.innerHTML=q
        ? `<div class="r2-qty" aria-label="Количество"><button type="button" data-delta="-1" data-pzn="${pzn}">−</button><input data-qty="${pzn}" type="number" value="${q}" min="0" max="999"><button type="button" data-delta="1" data-pzn="${pzn}">+</button></div>`
        : `<button type="button" class="r2-add-zero" data-delta="1" data-pzn="${pzn}" aria-label="Добавить одну упаковку">Добавить</button>`;
    }

    const input=card.querySelector(`[data-qty="${pzn}"]`);
    if(input && document.activeElement!==input)input.value=String(q);

    const badge=card.querySelector('.rxde-card-sum-badge');
    if(badge){
      badge.classList.toggle('is-visible',q>=1);
      badge.textContent=q>=1?`${U.money(sumR)} ₽`:'';
      badge.setAttribute('aria-label',`Итого ${U.money(sumR)} рублей за ${q} упаковок. Открыть позицию в листе заказа`);
    }

    const picked=card.querySelector(`[data-card-picked="${pzn}"]`);
    if(picked){
      picked.classList.toggle('selected',q>=1);
      picked.innerHTML=q>=1?`<span class="r2-picked-sum">${U.money(sumR)} ₽</span>`:'';
    }
  }
  function updateVisibleOrderLine(pzn,{keepRemoved=false}={}){
    if(!S.get().orderOpen)return;
    pzn=U.pzn(pzn);
    const idx=S.get().cart.findIndex(x=>x.pzn===pzn);
    const old=el.orderLines.querySelector(`.order-product-row[data-pzn="${pzn}"]`);

    if(idx<0){
      if(!keepRemoved)old?.remove();
      return;
    }
    if(!old){renderOrder();return}

    const it=S.get().cart[idx];
    const p=P.byPzn.get(pzn);
    if(!p)return;

    // Update only values; keep the same DOM controls under the pointer.
    const unitR=U.rub(p.eur,S.get().rate);
    const sumE=p.eur*it.qty;
    const sumR=unitR*it.qty;

    const input=old.querySelector('[data-order-qty]');
    if(input && document.activeElement!==input)input.value=String(it.qty);

    const total=old.querySelector('.order-line-total');
    if(total){
      const strong=total.querySelector('strong');
      const span=total.querySelector('span');
      if(strong)strong.textContent=`${U.money(sumR)} ₽`;
      if(span)span.textContent=`${U.money(sumE)} €`;
    }

    const unit=old.querySelector('.order-unit-price');
    if(unit){
      const strong=unit.querySelector('strong');
      const span=unit.querySelector('span');
      if(strong)strong.textContent=`${U.money(unitR)} ₽`;
      if(span)span.textContent=`${U.money(p.eur)} €`;
    }
  }
  function afterQtyChange(pzn,direction,source=null){
    if(lastClearedCart&&!restoringClearedCart){lastClearedCart=null;syncRestoreReceiptButton()}
    const flySource=captureFlySource(source,pzn);
    renderOrderStatus();updateVisibleProductRow(pzn);
    if(S.get().orderOpen){
      updateVisibleOrderLine(pzn);
      const t=Cart.totals();
      el.orderPositions.textContent=`${t.positions} поз. · ${t.packs} уп.`;
      el.orderTotalRub.textContent=`${U.money(t.rub)} ₽`;
      if(el.orderHeaderMeta)el.orderHeaderMeta.textContent=`${t.positions} поз. · ${t.packs} уп.`;
      if(el.orderHeaderTotal)el.orderHeaderTotal.textContent=`${U.money(t.rub)} ₽`;
      // Logistics price can depend on order presence; keep it in sync too.
      const log=el.orderLines.querySelector('.compact-logistics-line');
      if(log){
        const tmp=document.createElement('div');
        tmp.innerHTML=OrderView.logisticsLine({U,S,Cart},true).trim();
        if(tmp.firstElementChild)log.replaceWith(tmp.firstElementChild);
      }
    }
    pulseOrder(direction,pzn,flySource||source);
    window.RXDEShowCartPeek?.(direction);
  }

  function ensureDeletePortal(){
    let layer=document.getElementById('rx-delete-portal');
    if(layer)return layer;
    layer=document.createElement('div');
    layer.id='rx-delete-portal';
    document.body.appendChild(layer);
    return layer;
  }
  function positionDeleteOverlay(job){
    if(!job?.host?.isConnected||!job.overlay?.isConnected)return;
    const r=job.host.getBoundingClientRect();
    job.overlay.style.left=`${r.left}px`;
    job.overlay.style.top=`${r.top}px`;
    job.overlay.style.width=`${r.width}px`;
    job.overlay.style.height=`${r.height}px`;
  }
  function stopDeleteTracking(job){
    if(!job)return;
    if(job.trackRaf)cancelAnimationFrame(job.trackRaf);
    job.trackRaf=0;
  }
  function trackDeleteOverlay(job){
    if(!job?.overlay?.isConnected||!job?.host?.isConnected)return;
    positionDeleteOverlay(job);
    job.trackRaf=requestAnimationFrame(()=>trackDeleteOverlay(job));
  }
  function snapshotQuickSearchForDelete(){
    if(!el.searchSuggest||el.searchSuggest.hidden)return null;
    return {
      html:el.searchSuggest.innerHTML,
      scrollTop:el.searchSuggest.scrollTop||0,
      query:el.searchInput?.value||''
    };
  }

  function restoreQuickSearchAfterDelete(snap,pzn,qty){
    if(!snap||!el.searchSuggest||!el.searchInput)return;
    el.searchInput.value=snap.query;
    el.searchSuggest.innerHTML=snap.html;
    el.searchSuggest.hidden=false;
    el.searchSuggest.scrollTop=snap.scrollTop;

    const row=el.searchSuggest.querySelector(`.suggest-row[data-suggest-pzn="${pzn}"]`);
    if(row){
      row.classList.remove('pending-delete','delete-landing-wait','delete-row-collapse');
      const step=row.querySelector('.suggest-stepper');
      if(step){
        const b=step.querySelector('b');
        if(b)b.textContent=String(qty);
        const minus=step.querySelector('[data-suggest-delta="-1"]');
        if(minus)minus.disabled=qty<=0;
      }
    }
    requestAnimationFrame(()=>{
      if(el.searchSuggest){
        el.searchSuggest.hidden=false;
        el.searchSuggest.scrollTop=snap.scrollTop;
      }
    });
  }

  function cancelDelete(pzn){
    pzn=U.pzn(pzn);
    const job=deleteJobs.get(pzn);
    if(!job)return;
    if(job.timer)clearInterval(job.timer);
    stopDeleteTracking(job);
    job.host?.classList.remove('pending-delete');
    job.overlay?.remove();
    deleteJobs.delete(pzn);

    // Restore visible controls from the actual cart state. This is important
    // after a user typed 0 and then chose ОСТАВИТЬ: the cart still contains
    // the previous quantity, so the DOM must be put back in sync too.
    updateVisibleProductRow(pzn);
    if(S.get().orderOpen)updateVisibleOrderLine(pzn);
    if(job.host?.matches?.('.product-quick-sheet') && quickViewPzn===pzn){
      renderQuickView(pzn,{history:false,preserveRelatedFilter:true});
    }
    if(job.quickSearchSnapshot){
      restoreQuickSearchAfterDelete(job.quickSearchSnapshot,pzn,Cart.qty(pzn));
    }else if(!el.searchSuggest?.hidden){
      renderSuggestions();
    }
  }

  function refreshOrderNumbers(animate=false){
    el.orderLines?.querySelectorAll('.order-product-row').forEach((node,i)=>{
      const n=node.querySelector('.order-num-badge');
      if(n){
        const label=String(i+1).padStart(2,'0');
        const changed=n.textContent!==label;
        n.textContent=label;
        n.setAttribute('aria-label',`Переместить позицию ${label}`);
        if(animate&&changed){
          node.classList.remove('order-swap-changed');
          n.classList.remove('order-num-renumber','order-num-swap-stamp');
          void n.offsetWidth;
          node.classList.add('order-swap-changed');
          n.classList.add('order-num-swap-stamp');
          setTimeout(()=>{
            node.classList.remove('order-swap-changed');
            n.classList.remove('order-num-swap-stamp');
          },1050);
        }
      }
    });
  }
  function pulseOrderMetrics(){
    [el.desktopOrderDock,el.orderHeaderMeta,el.orderHeaderTotal,el.orderPositions,el.orderTotalRub].filter(Boolean).forEach(node=>{
      node.classList.remove('order-metric-change');
      void node.offsetWidth;
      node.classList.add('order-metric-change');
      setTimeout(()=>node.classList.remove('order-metric-change'),850);
    });
  }

  function animateOrderSwap(pznA,pznB){
    const keys=[U.pzn(pznA),U.pzn(pznB)].filter(Boolean);
    if(keys.length<2||keys[0]===keys[1])return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      keys.forEach(key=>{
        const row=el.orderLines?.querySelector(`.order-product-row[data-pzn="${key}"]`);
        if(!row)return;
        row.classList.remove('order-swap-changed');
        const badge=row.querySelector('.order-num-badge');
        badge?.classList.remove('order-num-swap-stamp');
        void row.offsetWidth;
        row.classList.add('order-swap-changed');
        badge?.classList.add('order-num-swap-stamp');
        setTimeout(()=>{
          row.classList.remove('order-swap-changed');
          badge?.classList.remove('order-num-swap-stamp');
        },920);
      });
    }));
  }

  function finalizeDelete(pzn){
    pzn=U.pzn(pzn);
    const job=deleteJobs.get(pzn);
    if(!job||job.committing)return;
    job.committing=true;
    if(job.timer)clearInterval(job.timer);
    job.timer=null;
    stopDeleteTracking(job);

    const copy=job.overlay?.querySelector('.delete-countdown-copy');
    if(copy)copy.innerHTML='Удаляем позицию…';
    const cancel=job.overlay?.querySelector('.delete-cancel');
    if(cancel)cancel.disabled=true;
    job.host?.classList.add('delete-landing-wait');

    U.sound('remove');
    pulseOrder('down','',null);

    // Geometry is frozen before any row changes. Brand marker lands on this exact row.
    const liveLandPoint=captureFlySource(job.source,pzn)||job.flySource||job.source||null;
    flyRxBrand(pzn,'down',liveLandPoint,()=>{
      const target=job.host?.isConnected?job.host:null;
      if(!target){
        job.overlay?.remove();deleteJobs.delete(pzn);
        Cart.setQty(pzn,0);renderOrderStatus();renderOrder();updateVisibleProductRow(pzn);pulseOrderMetrics();return;
      }

      // Keep the already-erased white field for a beat, then collapse the physical row.
      target.classList.remove('delete-landing-wait');
      target.classList.add('delete-row-collapse');
      job.overlay?.classList.add('delete-overlay-finish');

      setTimeout(()=>{
        job.overlay?.remove();
        deleteJobs.delete(pzn);
        Cart.setQty(pzn,0);
        renderOrderStatus();

        if(target.matches('.product-quick-sheet')){
          // Floating product card is persistent UI, not a removable list row.
          target.classList.remove('delete-row-collapse','pending-delete','delete-landing-wait');
          updateVisibleProductRow(pzn);
          if(S.get().orderOpen)updateVisibleOrderLine(pzn);
          renderQuickView(pzn,{history:false,preserveRelatedFilter:true});
        }else if(target.matches('.product-row')){
          const p=P.byPzn.get(pzn);
          if(p){
            const box=document.createElement('div');box.innerHTML=row(p).trim();
            const fresh=box.firstElementChild;
            if(fresh){target.replaceWith(fresh);fresh.classList.add('delete-row-return');setTimeout(()=>fresh.classList.remove('delete-row-return'),520)}
          }else target.remove();
          if(S.get().orderOpen)updateVisibleOrderLine(pzn);
        }else if(target.matches('.suggest-row')){
          /* Keep the quick-search screen itself unchanged; only update this row qty. */
          updateVisibleProductRow(pzn);
          if(S.get().orderOpen)updateVisibleOrderLine(pzn);
          restoreQuickSearchAfterDelete(job.quickSearchSnapshot,pzn,0);
        }else{
          target.remove();
          refreshOrderNumbers(true);
          updateVisibleProductRow(pzn);
          if(S.get().orderOpen){
            const t=Cart.totals();
            if(el.orderPositions)el.orderPositions.textContent=`${t.positions} поз. · ${t.packs} уп.`;
            if(el.orderTotalRub)el.orderTotalRub.textContent=`${U.money(t.rub)} ₽`;
            if(el.orderHeaderMeta)el.orderHeaderMeta.textContent=`${t.positions} поз. · ${t.packs} уп.`;
            if(el.orderHeaderTotal)el.orderHeaderTotal.textContent=`${U.money(t.rub)} ₽`;
            if(!t.positions)renderOrder();
          }
        }
        pulseOrderMetrics();
        if(!job.quickSearchSnapshot && !el.searchSuggest?.hidden)renderSuggestions();
      },620);
    });
  }

  function startDelete(pzn,source){
    pzn=U.pzn(pzn);
    const stale=deleteJobs.get(pzn);
    if(stale){
      if(stale.timer)clearInterval(stale.timer);
      stopDeleteTracking(stale);
      stale.host?.classList.remove('pending-delete','delete-landing-wait');
      stale.overlay?.remove();
      deleteJobs.delete(pzn);
    }

    const host=source?.closest?.('.product-row,.order-line,.order-product-row,.suggest-row,.product-quick-sheet');
    if(!host)return;
    host.classList.add('pending-delete');

    const overlay=document.createElement('div');
    const inOrder=Boolean(host.closest('#orderLines'));
    const erasers=Array.from({length:20},(_,i)=>`<i class="delete-erase-segment" style="--erase-i:${i}" aria-hidden="true"></i>`).join('');
    overlay.className=`delete-overlay-portal ${inOrder?'delete-overlay-order':'delete-overlay-catalog'}`;
    overlay.innerHTML=`<div class="delete-erase-layer" aria-hidden="true">${erasers}</div>
      <div class="delete-card delete-card-countdown" role="status" aria-live="polite">
        <span class="delete-countdown-copy">Удаление через <b>2.0</b> с</span>
        <button type="button" class="delete-cancel">НЕ УДАЛЯТЬ</button>
      </div>`;
    ensureDeletePortal().appendChild(overlay);

    const flySource=captureFlySource(source,pzn)||source;
    const startedAt=performance.now();
    const duration=2000;
    const job={
      pzn,host,overlay,timer:null,startedAt,source,flySource,trackRaf:0,committing:false,
      quickSearchSnapshot:host.matches('.suggest-row')?snapshotQuickSearchForDelete():null
    };
    deleteJobs.set(pzn,job);
    positionDeleteOverlay(job);
    trackDeleteOverlay(job);
    overlay.classList.add('delete-erasing');

    overlay.querySelector('.delete-cancel').onclick=e=>{e.preventDefault();e.stopPropagation();cancelDelete(pzn)};

    job.timer=setInterval(()=>{
      const elapsed=performance.now()-startedAt;
      const remaining=Math.max(0,duration-elapsed);
      const b=overlay.querySelector('b');
      if(b)b.textContent=(remaining/1000).toFixed(1);
      if(remaining<=0){clearInterval(job.timer);job.timer=null;finalizeDelete(pzn)}
    },80);
  }

  const removalVisualJobs=new Map();

  function removalVisualHost(source,pzn){
    const direct=source?.closest?.('.order-product-row,.suggest-row,.product-row,.product-quick-sheet');
    if(direct)return direct;
    return el.orderLines?.querySelector(`.order-product-row[data-pzn="${pzn}"]`)
      || el.searchSuggest?.querySelector(`.suggest-row[data-suggest-pzn="${pzn}"]`)
      || el.productList?.querySelector(`.product-row[data-pzn="${pzn}"]`)
      || null;
  }

  function captureOrderRowPositions(){
    const m=new Map();
    el.orderLines?.querySelectorAll('.order-product-row[data-pzn]').forEach(r=>m.set(U.pzn(r.dataset.pzn),r.getBoundingClientRect().top));
    return m;
  }
  function animateOrderReflow(before){
    if(!before||!before.size)return;
    requestAnimationFrame(()=>{
      el.orderLines?.querySelectorAll('.order-product-row[data-pzn]').forEach(r=>{
        const key=U.pzn(r.dataset.pzn),oldTop=before.get(key);
        if(oldTop==null)return;
        const now=r.getBoundingClientRect().top,dy=oldTop-now;
        if(Math.abs(dy)<2)return;
        r.style.transition='none';
        r.style.transform=`translateY(${dy}px)`;
        r.classList.add('rx-reflow-move');
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          r.style.transition='';
          r.style.transform='translateY(0)';
          setTimeout(()=>{r.classList.remove('rx-reflow-move');r.style.transform='';},430);
        }));
      });
    });
  }

  function animateImmediateRemoval(pzn,source){
    pzn=U.pzn(pzn);
    const previous=removalVisualJobs.get(pzn);
    if(previous){
      clearTimeout(previous.timer);
      previous.host?.classList.remove('rx-removing-position');
      previous.badge?.remove();
      removalVisualJobs.delete(pzn);
    }

    const host=removalVisualHost(source,pzn);
    const orderReflowBefore=host?.matches?.('.order-product-row')?captureOrderRowPositions():null;
    if(!host){
      updateVisibleProductRow(pzn);
      if(S.get().orderOpen)updateVisibleOrderLine(pzn);
      if(!el.searchSuggest?.hidden)renderSuggestions();
      return;
    }

    host.classList.add('rx-removing-position');
    host.setAttribute('aria-busy','true');

    const badge=document.createElement('span');
    badge.className='rx-removed-mark';
    badge.textContent='Удалено';
    host.appendChild(badge);

    // Cart state is already zero. Keep the old visual row for one beat so
    // the user can see exactly what disappeared.
    const timer=setTimeout(()=>{
      host.classList.add('rx-removing-collapse');

      setTimeout(()=>{
        host.removeAttribute('aria-busy');
        badge.remove();
        removalVisualJobs.delete(pzn);

        if(host.matches('.order-product-row')){
          host.remove();
          refreshOrderNumbers(true);
          animateOrderReflow(orderReflowBefore);
          if(S.get().orderOpen){
            const t=Cart.totals();
            if(el.orderPositions)el.orderPositions.textContent=`${t.positions} поз. · ${t.packs} уп.`;
            if(el.orderTotalRub)el.orderTotalRub.textContent=`${U.money(t.rub)} ₽`;
            if(el.orderHeaderMeta)el.orderHeaderMeta.textContent=`${t.positions} поз. · ${t.packs} уп.`;
            if(el.orderHeaderTotal)el.orderHeaderTotal.textContent=`${U.money(t.rub)} ₽`;
            const log=el.orderLines.querySelector('.compact-logistics-line');
            if(log){
              const tmp=document.createElement('div');
              tmp.innerHTML=OrderView.logisticsLine({U,S,Cart},true).trim();
              if(tmp.firstElementChild)log.replaceWith(tmp.firstElementChild);
            }else if(S.get().cart.length){
              renderOrder();
            }
          }
        }else if(host.matches('.suggest-row')){
          renderSuggestions();
        }else if(host.matches('.product-row')){
          // Catalogue rows are persistent results. The 1→0 animation may fade
          // the row for a beat, but after it finishes the exact same card must
          // remain visible at qty=0. Remove every temporary deletion class
          // before syncing the visible controls.
          host.classList.remove('rx-removing-position','rx-removing-collapse');
          updateVisibleProductRow(pzn);
        }else if(host.matches('.product-quick-sheet') && quickViewPzn===pzn){
          host.classList.remove('rx-removing-position','rx-removing-collapse');
          renderQuickView(pzn,{history:false,preserveRelatedFilter:true});
        }
      },260);
    },820);

    removalVisualJobs.set(pzn,{host,badge,timer});
  }

  function removeOnePositionNow(pzn,source){
    pzn=U.pzn(pzn);
    if(Cart.qty(pzn)<=0)return;

    // Capture the visible row BEFORE the cart state changes. The cart row must
    // remain on screen long enough to visibly disappear and let lower rows close up.
    const visualHost=removalVisualHost(source,pzn);

    Cart.setQty(pzn,0);
    U.sound('remove');

    renderOrderStatus();
    updateVisibleProductRow(pzn);
    updateQuickViewQtyUI(pzn);

    if(S.get().orderOpen){
      // Do not remove the order row immediately: animateImmediateRemoval owns
      // the collapse, then refreshes numbering and totals.
      const t=Cart.totals();
      if(el.orderPositions)el.orderPositions.textContent=`${t.positions} поз. · ${t.packs} уп.`;
      if(el.orderTotalRub)el.orderTotalRub.textContent=`${U.money(t.rub)} ₽`;
      if(el.orderHeaderMeta)el.orderHeaderMeta.textContent=`${t.positions} поз. · ${t.packs} уп.`;
      if(el.orderHeaderTotal)el.orderHeaderTotal.textContent=`${U.money(t.rub)} ₽`;
    }

    animateImmediateRemoval(pzn,visualHost||source);
    showGooseCancel();
  }

  function change(pzn,d,source){
    pzn=U.pzn(pzn);
    const q=Cart.qty(pzn);

    if(d<0&&q===1){
      removeOnePositionNow(pzn,source);
      return;
    }

    const next=Math.max(0,q+d);
    if(next===q)return;

    Cart.setQty(pzn,next);
    U.sound(d>0?'add':'remove');

    // Keep controls stable for rapid repeated clicks.
    if(lastClearedCart&&!restoringClearedCart){lastClearedCart=null;syncRestoreReceiptButton()}
    const flySource=captureFlySource(source,pzn);
    const statusSeq=++orderStatusSeq;
    const statusSnapshot=Cart.totals();
    // On addition, the top cart waits for the plane to land. The product card itself
    // updates immediately, so the click still feels instant. Removal stays immediate.
    if(d<0)renderOrderStatus(statusSnapshot,statusSeq);
    updateVisibleProductRow(pzn);
    updateQuickViewQtyUI(pzn);

    if(S.get().orderOpen){
      updateVisibleOrderLine(pzn);
      const t=Cart.totals();
      if(el.orderPositions)el.orderPositions.textContent=`${t.positions} поз. · ${t.packs} уп.`;
      if(el.orderTotalRub)el.orderTotalRub.textContent=`${U.money(t.rub)} ₽`;
      if(el.orderHeaderMeta)el.orderHeaderMeta.textContent=`${t.positions} поз. · ${t.packs} уп.`;
      if(el.orderHeaderTotal)el.orderHeaderTotal.textContent=`${U.money(t.rub)} ₽`;
      const log=el.orderLines.querySelector('.compact-logistics-line');
      if(log){
        const tmp=document.createElement('div');
        tmp.innerHTML=OrderView.logisticsLine({U,S,Cart},true).trim();
        if(tmp.firstElementChild)log.replaceWith(tmp.firstElementChild);
      }
    }

    // Plane remains for ordinary + / − changes only, never for 1→0.
    // For +, commit the header cart numbers exactly when this flight lands.
    pulseOrder(d>0?'up':'down',pzn,flySource||source,d>0?()=>renderOrderStatus(statusSnapshot,statusSeq):null);
  }
  let clearOrderArmTimer=null;
  function syncRestoreReceiptButton(){
    if(el.clearOrder){
      el.clearOrder.dataset.restoreReceipt='';
      el.clearOrder.dataset.armed='';
      el.clearOrder.classList.remove('armed','restore-receipt');
      el.clearOrder.title='Очистить корзину';
    }
    const restore=document.getElementById('restoreOrder');
    if(restore)restore.hidden=!(lastClearedCart?.length&&!S.get().cart.length);
  }
  function restoreClearedReceipt(){
    if(!lastClearedCart?.length)return;
    restoringClearedCart=true;
    const snapshot=lastClearedCart.map(x=>({...x}));
    lastClearedCart=null;
    S.set({cart:snapshot});
    Cart.save();
    restoringClearedCart=false;
    resetClearOrderButton();
    renderOrder();renderProducts();renderOrderStatus();
    pulseOrder('up');pulseOrderMetrics();
    U.sound('add');U.toast('Заказ восстановлен');
  }
  function resetClearOrderButton(){
    if(clearOrderArmTimer){clearTimeout(clearOrderArmTimer);clearOrderArmTimer=null}
    syncRestoreReceiptButton();
  }
  function clearWholeOrder(){
    if(!S.get().cart.length){U.toast('Корзина уже пуста');return}
    // Short native confirmation avoids a second accidental tap.
    if(!window.confirm('Удалить все товары из корзины?'))return;
    lastClearedCart=S.get().cart.map(x=>({...x}));
    [...deleteJobs.keys()].forEach(cancelDelete);
    S.set({cart:[]});Cart.save();
    resetClearOrderButton();renderOrder();renderProducts();renderOrderStatus();
    pulseOrder('down');U.sound('remove');U.toast('Корзина очищена');
  }

  function miniReceipt(){return OrderView.miniReceipt({U,S,P,Cart})}

  function renderHeaderStatus(){
    const st=S.get();
    const sourceCode=st.rateSource==='G'?'G':'B';
    const sourceName=sourceCode==='G'?'Google-таблица / биржевой источник':'резервный источник';
    if(el.rateSourceBadge){
      el.rateSourceBadge.textContent=`(${sourceCode})`;
      el.rateSourceBadge.classList.toggle('source-g',sourceCode==='G');
      el.rateSourceBadge.classList.toggle('source-b',sourceCode!=='G');
      el.rateSourceBadge.title=sourceCode==='G'?'G — EUR/RUB получен из Google-таблицы':'B — резервный EUR/RUB';
    }
    if(el.headerCalcRate){
      el.headerCalcRate.textContent=String(Math.floor(st.rate));
      el.headerCalcRate.closest('div')?.setAttribute('title',`${sourceName}: ${st.cbrRate.toFixed(4)} + ${R.Constants.RATE_MARKUP_RUB} ₽, округление вниз`);
    }
    if(el.headerCbrRate){
      el.headerCbrRate.textContent=Number.isFinite(st.cbrRate)?st.cbrRate.toFixed(2):'—';
      const d=R.Constants.RATE_EFFECTIVE_DATE||'';
      if(el.headerCbrDate){
        const parts=d.split('-');
        el.headerCbrDate.textContent=parts.length===3?`· ${parts[2]}.${parts[1]}`:'';
        el.headerCbrDate.classList.toggle('stale',Boolean(R.Constants.RATE_STALE));
      }
      el.headerCbrRate.closest('div')?.setAttribute('title',`Источник: ${sourceName}${d?' · '+d:''}${R.Constants.RATE_STALE?' · последнее сохранённое значение':''}`);
      if(el.mobileRateSummary){
        const parts=d.split('-'); const dd=parts.length===3?`${parts[2]}.${parts[1]}`:'';
        el.mobileRateSummary.innerHTML=`<span>Расчётный <b>${Math.floor(st.rate)} ₽/€</b></span><i>·</i><span>EUR/RUB <b>${Number.isFinite(st.cbrRate)?st.cbrRate.toFixed(2):'—'}</b> <em class="mobile-rate-source source-${sourceCode.toLowerCase()}">(${sourceCode})</em></span>${dd?`<i>·</i><span>${dd}</span>`:''}`;
      }
    }
  }
  function initFlipDate(){
    if(!el.flipDay||!el.flipDate)return;
    const months=['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'];
    const weekdays=['ВС','ПН','ВТ','СР','ЧТ','ПТ','СБ'];
    const now=new Date();
    const setDate=d=>{
      if(el.flipMonth)el.flipMonth.textContent=months[d.getMonth()];
      if(el.flipYear)el.flipYear.textContent=weekdays[d.getDay()];
      el.flipDay.textContent=String(d.getDate()).padStart(2,'0');
      el.flipDay.classList.add('date-ready');
      el.flipDate.setAttribute('aria-label',`Текущая дата: ${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]} ${weekdays[d.getDay()]}`);
    };
    setDate(now);
    el.flipDate.classList.remove('calendar-arrive');
    requestAnimationFrame(()=>{void el.flipDate.offsetWidth;el.flipDate.classList.add('calendar-arrive')});
    setTimeout(()=>el.flipDate.classList.remove('calendar-arrive'),560);
  }

  const CURRENT_VIEW_KEY='rxde:currentView:v1';
  let persistTimer=0,viewRestoreDone=false;
  function currentViewSnapshot(){
    const st=S.get();
    return {scrollY:window.scrollY||0,state:{home:!!st.home,query:st.query||'',category:st.category||'',subcategory:st.subcategory||'',mobileSearchScope:st.mobileSearchScope||'global',searchScrollCategory:st.searchScrollCategory||0,searchScrollGlobal:st.searchScrollGlobal||0,limit:st.limit||R.Constants.PAGE_SIZE,categoryLimit:st.categoryLimit||20,globalLimit:st.globalLimit||20,expanded:Array.from(st.expanded||[])}};
  }
  function persistCurrentView(){if(!viewRestoreDone)return;try{sessionStorage.setItem(CURRENT_VIEW_KEY,JSON.stringify(currentViewSnapshot()))}catch(_){}}
  function schedulePersistCurrentView(){clearTimeout(persistTimer);persistTimer=setTimeout(persistCurrentView,100)}
  function restoreCurrentViewOnRefresh(){
    try{
      if(sessionStorage.getItem('rxde:navRestore')||sessionStorage.getItem('rxde:returnNow')==='1')return false;
      const params=new URLSearchParams(location.search);if(params.get('q')||params.get('category')||params.get('openOrder')==='1'||params.get('c'))return false;
      const raw=sessionStorage.getItem(CURRENT_VIEW_KEY);if(!raw)return false;
      const x=JSON.parse(raw);if(!x?.state)return false;
      S.set({...x.state,expanded:new Set(x.state.expanded||[])});
      if(el.searchInput)el.searchInput.value=x.state.query||'';
      requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:Number(x.scrollY)||0,behavior:'auto'})));
      return true;
    }catch(_){return false}
  }
  function refreshVisibleMoney(){
    const st=S.get();
    document.querySelectorAll('.product-row[data-pzn]').forEach(node=>{
      const p=P.byPzn.get(U.pzn(node.dataset.pzn));if(!p)return;
      const q=Cart.qty(p.pzn),rub=U.rub(p.eur,st.rate),sumR=U.rub(p.eur,st.rate)*q;
      const priceR=node.querySelector('.r2-unit strong');if(priceR)priceR.textContent=`${U.money(rub)} ₽`;
      // EUR is the source price and must remain visible in the secondary line.
      const priceE=node.querySelector('.r2-unit span');if(priceE)priceE.textContent=`${U.money(p.eur)} €`;
    });
    if(S.get().orderOpen)renderOrder();
  }
  function refreshRateDisplay(changed){renderHeaderStatus();renderOrderStatus();if(changed)refreshVisibleMoney()}
  function renderAll(){renderProducts();renderOrderStatus();renderHeaderStatus();renderFlowNav();if(S.get().orderOpen)renderOrder();schedulePersistCurrentView()}
  function syncMobileKeyboard(){
    if(!isMobile()){document.body.classList.remove('keyboard-open');return}
    const vv=window.visualViewport;
    if(!vv){document.body.classList.remove('keyboard-open');return}
    const loss=window.innerHeight-vv.height;
    document.body.classList.toggle('keyboard-open',loss>150);
  }

  function restoreCatalogFromProductPage(){
    try{
      const nr=sessionStorage.getItem('rxde:navRestore');if(nr){sessionStorage.removeItem('rxde:navRestore');const n=JSON.parse(nr);if(n?.state){S.set({...n.state,expanded:new Set()});el.searchInput.value=n.state.query||'';renderAll();requestAnimationFrame(()=>window.scrollTo({top:Number(n.scrollY)||0,behavior:'auto'}));return}}
      if(sessionStorage.getItem('rxde:returnNow')!=='1')return;
      sessionStorage.removeItem('rxde:returnNow');
      const raw=sessionStorage.getItem('rxde:catalogReturn');if(!raw)return;
      const x=JSON.parse(raw);if(x?.state){S.set({...x.state,expanded:new Set()});el.searchInput.value=x.state.query||'';renderAll()}
      requestAnimationFrame(()=>{window.scrollTo({top:Number(x.scrollY)||0,behavior:'auto'});requestAnimationFrame(()=>{if(!x.focusPzn)return;const card=document.querySelector(`.static-product-card[data-pzn="${CSS.escape(U.pzn(x.focusPzn))}"]`);if(!card)return;const wanted=Number(x.cardViewportTop);if(Number.isFinite(wanted)){const now=card.getBoundingClientRect().top;window.scrollBy({top:now-wanted,behavior:'auto'});}card.classList.add('return-focus');setTimeout(()=>card.classList.remove('return-focus'),650);});});
    }catch(_){}
  }

  // Public deep links for a search/category, independent of browser's sessionStorage.
  function syncCatalogShareUrl(view){
    try{
      const url=new URL(location.href);
      ['q','category','subcategory','product'].forEach(k=>url.searchParams.delete(k));
      if(view?.query)url.searchParams.set('q',String(view.query));
      else{
        if(view?.category)url.searchParams.set('category',String(view.category));
        if(view?.subcategory)url.searchParams.set('subcategory',String(view.subcategory));
      }
      history.replaceState(history.state,'',url.pathname+url.search+url.hash);
      window.__rxdeMobileExitLastUrl=location.href;
    }catch(err){console.warn('RXDE catalog link:',err)}
  }

  function commitSearch(){
    const typed=el.searchInput.value.trim();if(!typed)return;
    if(favoritesOnly){favoritesOnly=false;syncFavoritesUI()}
    clearFormBadgeReturnContext();
    if(navCurrentLabel()!==`Поиск «${typed}»`)navPush(navSnapshot());
    const exact=P.byPzn.get(U.pzn(typed));
    const query=exact?exact.pzn:typed;
    el.searchInput.value=query;
    const before=S.get();
    S.set({home:false,query,category:'',subcategory:'',mobileSearchScope:'global',searchScrollCategory:0,searchScrollGlobal:0,limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:R.Constants.PAGE_SIZE,expanded:new Set(exact?[exact.pzn]:[])});
    syncCatalogShareUrl({query});
    recentRecord(navSnapshot(`Поиск «${query}»`));
    hideSuggestions();
    syncHome();
    if(el.contextLine){el.contextLine.hidden=false;el.contextLine.style.display=''}
    if(el.productList){el.productList.hidden=false;el.productList.style.display=''}
    renderProducts();
    el.searchInput.blur();
    requestAnimationFrame(()=>requestAnimationFrame(scrollResultsTop));
    renderFlowNav();
  }

  R.UI={init(){refs();restoreCurrentViewOnRefresh();renderAll();restoreCatalogFromProductPage();renderFlowNav();viewRestoreDone=true;schedulePersistCurrentView();
    window.addEventListener('scroll',schedulePersistCurrentView,{passive:true});
    window.addEventListener('pagehide',persistCurrentView);
    window.addEventListener('beforeunload',persistCurrentView);
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize',syncMobileKeyboard,{passive:true});
      window.visualViewport.addEventListener('scroll',syncMobileKeyboard,{passive:true});
      syncMobileKeyboard();
    }initFlipDate();if(isMobile()){document.body.dataset.mobileMode='search';
      const dismissKeyboard=()=>{if(document.activeElement===el.searchInput)el.searchInput.blur()};
      el.productList?.addEventListener('touchmove',dismissKeyboard,{passive:true});
      window.addEventListener('scroll',()=>{if(S.get().mobileMode==='search')dismissKeyboard()},{passive:true});
    }
    el.searchInput.addEventListener('input',R.Utils.debounce(()=>{
      // Typing is a DRAFT state: only smart suggestions change.
      // The main result sheet changes only after Enter / “show all” / choosing a product.
      renderSuggestions();
    },45));
    el.searchInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitSearch()}});
    el.searchInput.addEventListener('search',()=>{if(el.searchInput.value.trim())commitSearch()});
    el.searchInput.addEventListener('focus',()=>{
      if(favoritesOnly){favoritesOnly=false;syncFavoritesUI();renderProducts()}
      document.body.classList.add('search-focus');
      if(innerWidth<=760){
        el.searchWrap.classList.add('thumb-mode');
        let backdrop=document.getElementById('mobileSearchFocusBackdrop');
        if(!backdrop){
          backdrop=document.createElement('div');
          backdrop.id='mobileSearchFocusBackdrop';
          backdrop.className='mobile-search-focus-backdrop';
          backdrop.setAttribute('aria-hidden','true');
          document.body.appendChild(backdrop);
          backdrop.addEventListener('pointerdown',ev=>{
            ev.preventDefault();
            el.searchInput.blur();
          });
        }
        backdrop.classList.add('visible');
        requestAnimationFrame(()=>{
          try{
            const n=el.searchInput.value.length;
            el.searchInput.setSelectionRange(n,n);
          }catch(_){}
        });
      }
      if(el.searchInput.value.trim().length>=1)renderSuggestions();
    });
    el.searchInput.addEventListener('blur',()=>setTimeout(()=>{
      if(document.body.classList.contains('quick-search-photo-open'))return;
      document.body.classList.remove('search-focus');
      el.searchWrap.classList.remove('thumb-mode');
      document.getElementById('mobileSearchFocusBackdrop')?.classList.remove('visible');
      hideSuggestions();
    },180));
    el.clearSearch.onclick=()=>{
      const st=S.get();
      el.searchInput.value='';
      hideSuggestions();
      S.set({
        query:'',
        expanded:new Set(),
        searchScrollCategory:0,
        searchScrollGlobal:0,
        limit:R.Constants.PAGE_SIZE,
        categoryLimit:6,
        globalLimit:R.Constants.PAGE_SIZE
      });
      syncCatalogShareUrl({category:S.get().category,subcategory:S.get().subcategory});
      syncHome();
      renderProducts();
      renderSearchScope();
      renderFlowNav();
      requestAnimationFrame(()=>requestAnimationFrame(scrollResultsTop));
      el.searchInput.focus();
      try{el.searchInput.setSelectionRange(0,0)}catch(_){}
    };

    const headerSearchIcon=document.querySelector('#appHeader .search-icon');
    if(headerSearchIcon){
      headerSearchIcon.setAttribute('role','button');
      headerSearchIcon.setAttribute('tabindex','0');
      headerSearchIcon.setAttribute('aria-label','Выполнить поиск');
      const runHeaderSearch=()=>{
        if(el.searchInput.value.trim()){
          commitSearch();
          if(innerWidth<=760)el.searchInput.blur();
        }else{
          el.searchInput.focus();
        }
      };
      headerSearchIcon.addEventListener('pointerdown',e=>e.preventDefault());
      headerSearchIcon.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();runHeaderSearch()});
      headerSearchIcon.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){e.preventDefault();runHeaderSearch()}
      });
    }
    if(el.searchScopeButton){
      el.searchScopeButton.addEventListener('pointerdown',e=>e.stopPropagation());
      el.searchScopeButton.onclick=e=>{e.preventDefault();e.stopPropagation();const willOpen=Boolean(el.searchScopeMenu.hidden);renderSearchScope();el.searchScopeMenu.hidden=!willOpen;el.searchScopeButton.setAttribute('aria-expanded',String(willOpen));el.searchScopeButton.classList.toggle('open',willOpen)};
    }
    if(el.searchScopeMenu)el.searchScopeMenu.onclick=e=>{e.stopPropagation();const g=e.target.closest('[data-scope-global]');if(g){setSearchScopeGlobal();return}const c=e.target.closest('[data-scope-category]');if(c)setSearchScopeCategory(c.dataset.scopeCategory)};
    document.addEventListener('click',e=>{if(!e.target.closest('#searchScopeMenu')&&!e.target.closest('#searchScopeButton'))closeSearchScope()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSearchScope()});
    el.searchSuggest.addEventListener('pointerdown',e=>{
      if(e.target.closest('.suggest-row'))e.preventDefault();
    });

    /* v1.56: photo is an isolated overlay action.
       It must never reach the result-navigation click handlers. */
    el.searchSuggest.addEventListener('click',e=>{
      const host=e.target.closest?.('.suggest-photo');
      const photo=host?.querySelector?.('img')||null;
      if(!photo)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openProductLightbox(photo);
    },true);
    el.productList.addEventListener('pointerdown',e=>{
      if(e.target.closest('.static-product-card .product-photo img'))e.preventDefault();
    },true);
    el.orderLines?.addEventListener('pointerdown',e=>{
      if(e.target.closest('.order-static-card .order-thumb img'))e.preventDefault();
    },true);
    el.searchSuggest.addEventListener('click',e=>{
      const strip=e.target.closest('[data-suggest-picked]');
      if(!strip)return;
      const p=strip.dataset.suggestPicked;
      if(Cart.qty(p)>0){e.preventDefault();e.stopImmediatePropagation();hideSuggestions();openOrder(p)}
    },true);
    el.searchSuggest.onclick=e=>{
      if(e.target.closest('.rx-badge')){showRxNotice();return}
      const delta=e.target.closest('[data-suggest-delta]');
      if(delta){
        const pzn=delta.dataset.pzn,d=Number(delta.dataset.suggestDelta),q=Cart.qty(pzn),next=Math.max(0,q+d);
        const source=delta.closest('.suggest-stepper')||delta;
        if(d<0&&q===1){
          removeOnePositionNow(pzn,source);
          return;
        }
        Cart.setQty(pzn,next);
        U.sound(d>0?'add':'remove');
        afterQtyChange(pzn,d>0?'up':'down',source);
        renderSuggestions();
        return;
      }
      const pickedStrip=e.target.closest('[data-suggest-picked]');
      if(pickedStrip){
        const pzn=pickedStrip.dataset.suggestPicked;
        if(Cart.qty(pzn)>0){
          hideSuggestions();
          openOrder(pzn);
          return;
        }
      }
      const suggestFamily=e.target.closest('[data-family-search]');
      if(suggestFamily){
        e.preventDefault();e.stopPropagation();
        const pzn=U.pzn(suggestFamily.dataset.familySearch||'');
        if(restoreFamilySearchIfSame(pzn))return;
        const query=orderFamilySearchTerm(pzn);
        if(query){
          captureFormBadgeReturnContext(pzn);
          activeFormFilters.clear();activeFormFilter='';formFilterEngaged=false;activeDoseFilter='';activeDoseKey='';
          S.set({home:false,query,category:'',subcategory:'',mobileSearchScope:'global',limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:R.Constants.PAGE_SIZE,expanded:new Set()});
          if(el.searchInput)el.searchInput.value=query;
          hideSuggestions();renderProducts();renderSearchScope();renderFlowNav();
          requestAnimationFrame(()=>requestAnimationFrame(scrollResultsTop));
        }
        return;
      }
      const titleOpen=e.target.closest('[data-suggest-title-open]');
      if(titleOpen){e.preventDefault();e.stopPropagation();openSuggestedProduct(titleOpen.dataset.suggestTitleOpen);return}
      const row=e.target.closest('.suggest-row[data-suggest-pzn]');
      if(row&&!e.target.closest('button,input,a,.suggest-photo,.suggest-stepper')){return}

      const all=e.target.closest('[data-suggest-all]');
      if(all){
        commitSearch();
      }
    };

    if(el.homeCategories)el.homeCategories.onclick=e=>{clearFormBadgeReturnContext();const b=e.target.closest('[data-home-category]');if(!b)return;if(favoritesOnly){favoritesOnly=false;syncFavoritesUI()}navPush(navSnapshot());S.set({home:false,category:b.dataset.homeCategory,subcategory:'',query:'',limit:R.Constants.PAGE_SIZE,expanded:new Set()});el.searchInput.value='';renderProducts();renderSearchScope();recentRecord(navSnapshot(b.dataset.homeCategory));requestAnimationFrame(scrollResultsTop)};
    if(el.homeOpenCatalog)el.homeOpenCatalog.onclick=()=>{if(favoritesOnly){favoritesOnly=false;syncFavoritesUI()}clearFormBadgeReturnContext();navPush(navSnapshot());S.set({home:false,category:'',subcategory:'',query:'',limit:R.Constants.PAGE_SIZE,expanded:new Set()});renderProducts();renderSearchScope();recentRecord(navSnapshot('Весь каталог'));requestAnimationFrame(scrollResultsTop)};

    el.categoryStrip.onclick=e=>{clearFormBadgeReturnContext();leaveBridgeIfNeeded();const b=e.target.closest('[data-category],[data-category-clear]');if(!b)return;if(favoritesOnly){favoritesOnly=false;syncFavoritesUI()}navPush(navSnapshot());const cat=b.hasAttribute('data-category-clear')?'':b.dataset.category;activeFormFilters.clear();activeFormFilter='';activeFormKey='';formFilterEngaged=false;activeDoseFilter='';activeDoseKey='';closeFormChooser();el.searchInput.value='';hideSuggestions();S.set({home:false,query:'',category:cat,subcategory:'',mobileSearchScope:'category',searchScrollCategory:0,searchScrollGlobal:0,limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:20,expanded:new Set()});syncCatalogShareUrl({category:cat});renderProducts();renderSearchScope();renderFlowNav();recentRecord(navSnapshot(cat||'Весь каталог'));scrollCatalogHeroTop()};
    el.subcategoryStrip.onclick=e=>{clearFormBadgeReturnContext();leaveBridgeIfNeeded();const b=e.target.closest('[data-subcategory],[data-subcategory-clear]');if(!b)return;if(favoritesOnly){favoritesOnly=false;syncFavoritesUI()}const sub=b.hasAttribute('data-subcategory-clear')?'':b.dataset.subcategory;activeFormFilters.clear();activeFormFilter='';activeFormKey='';formFilterEngaged=false;activeDoseFilter='';activeDoseKey='';closeFormChooser();el.searchInput.value='';hideSuggestions();S.set({query:'',subcategory:sub,mobileSearchScope:'category',searchScrollCategory:0,searchScrollGlobal:0,categoryLimit:20,globalLimit:20,limit:R.Constants.PAGE_SIZE,expanded:new Set()});syncCatalogShareUrl({category:S.get().category,subcategory:sub});renderProducts();renderFlowNav();recentRecord(navSnapshot(sub||S.get().category||'Весь каталог'));requestAnimationFrame(()=>requestAnimationFrame(scrollResultsTop))};
    if(el.formFilterStrip)el.formFilterStrip.onclick=e=>{
      const reset=e.target.closest('[data-form-reset-search]');
      if(reset){
        if(navBridge.fromOrder){returnToOrder(navBridge.pzn);return}
        try{const pr=JSON.parse(sessionStorage.getItem('rxde:productReturn')||'null');if(pr?.url){sessionStorage.removeItem('rxde:productReturn');location.href=pr.url;return}}catch(_){}
        if(restoreFormBadgeReturnContext())return;
        if(el.searchInput)el.searchInput.value='';
        activeFormFilters.clear();
        activeFormFilter='';
        activeFormKey='';
        formFilterEngaged=false;
        S.set({home:false,query:'',category:'Витамины и минералы',subcategory:'',limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:20,expanded:new Set()});
        renderProducts();renderSearchScope();renderFlowNav();requestAnimationFrame(scrollCatalogHeroTop);
        return;
      }
      const b=e.target.closest('[data-form-filter]');
      if(!b)return;
      const k=b.dataset.formFilter||'';
      if(!k){
        runLocalCatalogAction(()=>{
          activeFormFilters.clear();
          activeFormFilter='';
          formFilterEngaged=false;
          S.set({limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:R.Constants.PAGE_SIZE,expanded:new Set()});
          renderProducts();
        });
        return;
      }
      runLocalCatalogAction(()=>{
        if(activeFormFilters.has(k))activeFormFilters.delete(k);else activeFormFilters.add(k);
        S.set({limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:R.Constants.PAGE_SIZE,expanded:new Set()});
        renderProducts();
      });
    };
    let productCardPointerDown=null;
    el.productList.addEventListener('pointerdown',e=>{
      const card=e.target.closest('.static-product-card[data-pzn]');
      if(!card||e.target.closest('button,input,a,textarea,select,label,.r2-unit,.r2-qty,.form-badge[data-card-form-filter]')){productCardPointerDown=null;return}
      productCardPointerDown={x:e.clientX,y:e.clientY,pzn:card.dataset.pzn,moved:false};
    });
    el.productList.addEventListener('pointermove',e=>{
      if(!productCardPointerDown)return;
      if(Math.hypot(e.clientX-productCardPointerDown.x,e.clientY-productCardPointerDown.y)>5){
        productCardPointerDown.moved=true;
      }
    });
    el.productList.onclick=e=>{
      const cp=e.target.closest('[data-copy-pzn]');if(cp){e.stopPropagation();copyPzn(cp.dataset.copyPzn);return}
      if(e.target.closest('.rx-badge')){showRxNotice();return}

      const ctx=e.target.closest('[data-search-context]');
      if(ctx&&!ctx.disabled){switchSearchContext(ctx.dataset.searchContext);return}

      const more=e.target.closest('[data-search-more]');
      if(more){
        const kind=more.dataset.searchMore;
        if(kind==='category')S.set({categoryLimit:S.get().categoryLimit+6});
        else S.set({globalLimit:S.get().globalLimit+6});
        renderProducts();return;
      }

      const full=e.target.closest('[data-full-product]');
      if(full){
        navPush(navSnapshot());
        try{sessionStorage.setItem('rxde:catalogReturn',JSON.stringify({url:location.href,scrollY:window.scrollY,state:{query:S.get().query,category:S.get().category,subcategory:S.get().subcategory,mobileSearchScope:S.get().mobileSearchScope,searchScrollCategory:S.get().searchScrollCategory,searchScrollGlobal:S.get().searchScrollGlobal,limit:S.get().limit,categoryLimit:S.get().categoryLimit,globalLimit:S.get().globalLimit}}))}catch(_){}
        return;
      }

      const familySearch=e.target.closest('[data-family-search]');
      if(familySearch){
        e.preventDefault();e.stopPropagation();
        const pzn=U.pzn(familySearch.dataset.familySearch||'');
        if(restoreFamilySearchIfSame(pzn))return;
        const query=orderFamilySearchTerm(pzn);
        if(query){
          captureFormBadgeReturnContext(pzn);
          activeFormFilters.clear();activeFormFilter='';formFilterEngaged=false;activeDoseFilter='';activeDoseKey='';
          S.set({home:false,query,category:'',subcategory:'',mobileSearchScope:'global',limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:R.Constants.PAGE_SIZE,expanded:new Set()});
          if(el.searchInput)el.searchInput.value=query;
          hideSuggestions();renderProducts();renderSearchScope();renderFlowNav();
          requestAnimationFrame(()=>requestAnimationFrame(scrollResultsTop));
        }
        return;
      }

      const formBadge=e.target.closest('.form-badge[data-card-form-filter]');
      if(formBadge){
        // V2.60: a dosage-form badge is ONLY a dosage-form filter.
        // It must never launch the family/first-word search. That action belongs
        // exclusively to the magnifier button.
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        const k=formBadge.dataset.cardFormFilter||'';
        if(!k)return;
        runLocalCatalogAction(()=>{
          // Card form badge = quick toggle for the whole form-filter capsule.
          // First tap enables this form and reveals the form controls.
          // Tapping the same active badge again resets ALL form filters and hides the capsule.
          if(activeFormFilters.has(k)){
            activeFormFilters.clear();
            activeFormFilter='';
            activeFormKey='';
            formFilterEngaged=false;
          }else{
            activeFormFilters.add(k);
            formFilterEngaged=true;
            activeFormKey=formFilterKey(S.get());
          }
          S.set({limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:R.Constants.PAGE_SIZE,expanded:new Set()});
          renderProducts();
          renderSearchScope();
          renderFlowNav();
        });
        return;
      }

      const titleOpen=e.target.closest('[data-card-title-open]');
      if(titleOpen){
        e.preventDefault();
        e.stopPropagation();
        const pzn=U.pzn(titleOpen.dataset.cardTitleOpen||'');
        if(!pzn)return;
        const direct=pageUrl(pzn);
        if(direct){
          navPush(navSnapshot());
          const sourceCard=titleOpen.closest('.static-product-card[data-pzn]');
          saveFullProductOrigin(pzn,'catalog',sourceCard);
          location.href=direct;
        }
        return;
      }

      const d=e.target.closest('[data-delta]');
      if(d){const before=Cart.qty(d.dataset.pzn),delta=Number(d.dataset.delta);change(d.dataset.pzn,delta,d);const after=Cart.qty(d.dataset.pzn);if(delta>0&&after>before)showOrderAddHint(before>0);return}

      const pickedStrip=e.target.closest('[data-card-picked]');
      if(pickedStrip){
        const pzn=pickedStrip.dataset.cardPicked;
        if(Cart.qty(pzn)>0){openOrder(pzn);return}
      }

      const j=e.target.closest('[data-order-jump]');
      if(j){openOrder(j.dataset.orderJump);return}

      if(e.target.closest('button,input,a,textarea,select,label,.r2-unit,.r2-qty'))return;
      const card=e.target.closest('[data-pzn].mn-product,.static-product-card[data-pzn]');
      if(card){
        if(productCardPointerDown?.moved){productCardPointerDown=null;return}
        productCardPointerDown=null;
        // Unified behaviour on every screen: the mini-card itself is inert/selectable.
        // Title = full product page; loupe = related search; controls = cart.
        return
      }

    }
    el.productList.onchange=e=>{const q=e.target.closest('[data-qty]');if(q){const p=q.dataset.qty,n=Number(q.value);const source=q.closest('.r2-qty')||q;if(n===0&&Cart.qty(p)>0)removeOnePositionNow(p,source);else{const old=Cart.qty(p);Cart.setQty(p,n);afterQtyChange(p,n>=old?'up':'down',source)}}};
    document.addEventListener('click',e=>{
      const choice=e.target.closest?.('[data-form-choice]');
      if(choice&&formChooser&&!formChooser.hidden){
        e.preventDefault();e.stopPropagation();
        enterFormCompare(formChooser.dataset.anchorPzn||'',choice.dataset.formChoice||'');
        return;
      }
      if(e.target.closest?.('[data-form-chooser-close]')){closeFormChooser();return}
      if(formChooser&&!formChooser.hidden&&!e.target.closest?.('.form-chooser-popover')&&!e.target.closest?.('.form-badge[data-card-form-filter]'))closeFormChooser();
    },true);
    window.addEventListener('resize',closeFormChooser,{passive:true});
    window.addEventListener('scroll',()=>{if(formChooser&&!formChooser.hidden)closeFormChooser()},{passive:true});

    el.loadMore.onclick=()=>{
      const st=S.get();
      const oldLimit=Math.max(0,Number(st.limit)||R.Constants.PAGE_SIZE);
      const nextLimit=Math.min(filtered.length,oldLimit+R.Constants.PAGE_SIZE);
      const more=filtered.slice(oldLimit,nextLimit);
      if(!more.length){el.loadMore.hidden=true;return}

      // Append-only: never rebuild the already visible catalogue and never touch scroll/header state.
      const beforeCount=el.productList.children.length;
      el.productList.insertAdjacentHTML('beforeend',more.map(row).join(''));
      S.set({limit:nextLimit});
      el.loadMore.hidden=nextLimit>=filtered.length;

      const added=Array.from(el.productList.children).slice(beforeCount);
      requestAnimationFrame(()=>added.forEach((card,i)=>{
        card.classList.add('rxde-card-added');
        card.style.setProperty('--rxde-add-delay',`${Math.min(i,7)*26}ms`);
        card.addEventListener('animationend',()=>{card.classList.remove('rxde-card-added');card.style.removeProperty('--rxde-add-delay')},{once:true});
      }));
    };
    if(el.doseFilterStrip)el.doseFilterStrip.onclick=e=>{const b=e.target.closest('[data-dose-filter]');if(!b)return;runLocalCatalogAction(()=>{activeDoseFilter=b.dataset.doseFilter||'';S.set({limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:R.Constants.PAGE_SIZE});renderProducts()})};
    if(el.catalogFormSelect)el.catalogFormSelect.onchange=()=>{runLocalCatalogAction(()=>{formFilterEngaged=true;activeFormFilters.clear();if(el.catalogFormSelect.value)activeFormFilters.add(el.catalogFormSelect.value);S.set({limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:20,expanded:new Set()});renderProducts()})};

    document.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-sort-toggle]');
      if(!b)return;
      e.preventDefault();e.stopPropagation();
      const axis=b.dataset.sortToggle||'';
      if(axis==='name'){
        nameSortDir=nameSortDir===''?'asc':nameSortDir==='asc'?'desc':'';
        if(nameSortDir)sortPrimary='name';
        else if(sortPrimary==='name')sortPrimary=priceSortDir?'price':'';
      }else if(axis==='price'){
        priceSortDir=priceSortDir===''?'desc':priceSortDir==='desc'?'asc':'';
        if(priceSortDir)sortPrimary='price';
        else if(sortPrimary==='price')sortPrimary=nameSortDir?'name':'';
      }else return;
      catalogSort='catalog';
      runLocalCatalogAction(()=>{
        syncSortControls();
        S.set({limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:20});
        renderProducts();
      });
    });
    if(el.desktopOrderDock)el.desktopOrderDock.onclick=()=>openOrder('',true);
    if(el.quickOrderDock)el.quickOrderDock.onclick=()=>{
      closeQuickView({history:false});
      const url=new URL(location.href);
      if(url.searchParams.has('product')){
        url.searchParams.delete('product');
        history.replaceState({...history.state,rxdeQuickView:null},'',url);
      }
      openOrder();
    };
    const openQuestion=()=>{
      blurSearch();
      el.questionBackdrop.hidden=false;
      if(isMobile())setMobileMode('question');
      setTimeout(()=>el.questionText?.focus(),60)
    };
    const closeQuestion=()=>{el.questionBackdrop.hidden=true;if(isMobile())restoreSearchMode()};
    const pqBackdrop=document.getElementById('productQuickBackdrop');
    const pqClose=document.getElementById('closeProductQuick');
    if(pqClose)pqClose.onclick=closeQuickView;
    window.addEventListener('popstate',syncQuickViewFromLocation);
    window.addEventListener('resize',()=>{if(quickViewPzn)syncQuickRelatedRailGeometry()},{passive:true});
    if(pqBackdrop){
      pqBackdrop.onclick=e=>{
        // Any click outside the main sheet or a real related-card/control closes Quick View.
        // The related rail may reserve empty space; that empty space behaves like backdrop.
        const insideSheet=e.target.closest('.product-quick-sheet');
        const relatedCard=e.target.closest('.pq-float-related');
        const relatedControl=e.target.closest('[data-pq-form-filter],[data-pq-scroll-cue],[data-pq-related-toggle]');
        const orderDock=e.target.closest('#quickOrderDock');
        const shareTarget=e.target.closest('[data-pq-share]');
        if(shareTarget){e.preventDefault();e.stopPropagation();shareSingleProduct(shareTarget.dataset.pqShare,shareTarget);return}
        const mainPicked=e.target.closest('[data-pq-picked]');
        if(mainPicked && quickViewPzn && Cart.qty(quickViewPzn)>0){
          closeQuickView();
          openOrder(quickViewPzn);
          return
        }
        const relatedPicked=e.target.closest('[data-pq-related-picked]');
        if(relatedPicked){
          const rpzn=relatedPicked.dataset.pqRelatedPicked;
          if(Cart.qty(rpzn)>0){
            closeQuickView();
            openOrder(rpzn);
            return
          }
        }
        if(!insideSheet && !relatedCard && !relatedControl && !orderDock){
          closeQuickView();
          return
        }
        const mobileRelatedSearch=e.target.closest('[data-pq-related-search]');
        if(mobileRelatedSearch){
          const anchor=mobileRelatedSearch.dataset.pqRelatedSearch||quickViewPzn;
          const query=orderFamilySearchTerm(anchor);
          closeQuickView({history:false});
          if(query){
            activeFormFilters.clear();activeFormFilter='';formFilterEngaged=false;
            S.set({home:false,query,category:'',subcategory:'',mobileSearchScope:'global',limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:R.Constants.PAGE_SIZE,expanded:new Set()});
            if(el.searchInput)el.searchInput.value=query;
            renderProducts();renderSearchScope();renderFlowNav();
            requestAnimationFrame(()=>requestAnimationFrame(scrollResultsTop));
          }
          return;
        }
        const relatedToggle=e.target.closest('[data-pq-related-toggle]');
        if(relatedToggle){
          const host=document.getElementById('productQuickRelated');
          const collapsed=host?.classList.toggle('mobile-related-collapsed');
          relatedToggle.setAttribute('aria-expanded',collapsed?'false':'true');
          return;
        }
        const fullOpen=e.target.closest('[data-pq-full-open]');
        if(fullOpen){
          const fpzn=fullOpen.dataset.pqFullOpen||quickViewPzn;
          const href=pageUrl(fpzn);
          if(href){
            e.preventDefault();
            navPush(navSnapshot());
            recentRecord(navSnapshot());
            location.href=href;
          }
          return;
        }
        const d=e.target.closest('[data-pq-delta]');
        if(d&&quickViewPzn){
          const current=quickViewPzn;
          change(current,Number(d.dataset.pqDelta),d);
          updateQuickViewQtyUI(current);
          return
        }
        const scrollCue=e.target.closest('[data-pq-scroll-cue]');
        if(scrollCue){
          const rail=document.querySelector('#productQuickRelated .pq-related-rail-list');
          if(rail){
            const dir=Number(scrollCue.dataset.pqScrollCue||1);
            rail.scrollBy({top:dir*Math.max(160,rail.clientHeight*.62),behavior:'smooth'});
          }
          return;
        }
        const prev=e.target.closest('[data-pq-prev-context]');
        if(prev&&quickViewPreviousContext){
          const back={...quickViewPreviousContext};
          quickViewPreviousContext=null;
          quickViewFormFilter=back.filter||'';
          const source=document.querySelector(`.pq-float-related[data-pq-related-open="${back.pzn}"]`);
          if(source)animateQuickViewSwap(source,back.pzn);
          else renderQuickView(back.pzn,{replace:true,preserveRelatedFilter:true});
          return;
        }
        const relDelta=e.target.closest('[data-pq-related-delta]');
        if(relDelta){
          const rpzn=relDelta.dataset.pzn;
          const d=Number(relDelta.dataset.pqRelatedDelta);
          const q=Cart.qty(rpzn),next=Math.max(0,q+d);
          const source=relDelta.closest('.pq-related-stepper')||relDelta;
          if(d<0&&q===1){
            removeOnePositionNow(rpzn,source);
            updateQuickViewQtyUI(quickViewPzn);
            return;
          }
          Cart.setQty(rpzn,next);
          U.sound(d>0?'add':'remove');
          afterQtyChange(rpzn,d>0?'up':'down',source);
          updateQuickViewQtyUI(quickViewPzn);
          return;
        }
        const formFilter=e.target.closest('[data-pq-form-filter]');
        if(formFilter){
          quickViewPreviousContext=null;
          quickViewFormFilter=formFilter.dataset.pqFormFilter||'';
          renderQuickView(quickViewPzn,{replace:true,preserveRelatedFilter:true});
          return;
        }
        const jumpMainForm=e.target.closest('[data-pq-jump-form]');
        if(jumpMainForm){
          const formKey=jumpMainForm.dataset.pqJumpForm||'';
          if(formKey){
            activeFormKey=formFilterKey(S.get());
            activeFormFilters.clear();
            activeFormFilters.add(formKey);
            formFilterEngaged=true;
            closeQuickView();
            S.set({limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:R.Constants.PAGE_SIZE,expanded:new Set()});
            renderProducts();
            requestAnimationFrame(scrollResultsTop);
          }
          return;
        }
        const rel=e.target.closest('[data-pq-related-open]');
        if(rel){
          rememberQuickViewContext(rel.dataset.pqRelatedOpen);
          animateQuickViewSwap(rel,rel.dataset.pqRelatedOpen);
          return
        }
      };
      pqBackdrop.onchange=e=>{
        if(e.target.id==='pqQty'&&quickViewPzn){
          const n=Math.max(0,Math.min(999,parseInt(e.target.value,10)||0));
          const old=Cart.qty(quickViewPzn);
          if(n===0&&old>0)removeOnePositionNow(quickViewPzn,e.target);
          else{
            Cart.setQty(quickViewPzn,n);
            afterQtyChange(quickViewPzn,n>=old?'up':'down',e.target);
            updateQuickViewQtyUI(quickViewPzn);
          }
        }
      };
    }
    if(el.headerQuestion)el.headerQuestion.onclick=openQuestion;if(el.footerQuestion)el.footerQuestion.onclick=openQuestion;
    if(el.closeQuestion)el.closeQuestion.onclick=closeQuestion;
    if(el.questionBackdrop)el.questionBackdrop.onclick=e=>{if(e.target===el.questionBackdrop)closeQuestion()};
    if(el.sendQuestion)el.sendQuestion.onclick=async()=>{
      const question=(el.questionText?.value||'').trim();if(!question){U.toast('Напишите вопрос');return;}
      const replyPhone=(document.getElementById('questionPhoneInput')?.value||'').trim();if(phoneDigits(replyPhone).length<7||phoneDigits(replyPhone).length>15){U.toast('Укажите телефон для ответа');document.getElementById('questionPhoneInput')?.focus();return;}
      let customerEmail;try{customerEmail=optionalEmail('questionEmailInput')}catch(_){return;}
      if(!window.RXDE_DELIVERY?.isConfigured()){U.toast('Отправка не настроена: напишите на email ниже');return;}
      el.sendQuestion.disabled=true;
      const sending=document.getElementById('rxdeSendingOverlay');
      const status=document.getElementById('rxdeSendingStatus');
      const detail=document.getElementById('rxdeSendingDetail');
      const sendingClose=document.getElementById('rxdeSendingClose');
      const fallback=document.getElementById('rxdeManualFallback');
      if(sending){
        sending.dataset.status='pending';sending.hidden=false;
        document.body.classList.add('rxde-send-locked');
        if(status)status.textContent='Отправляем вопрос';
        if(detail)detail.textContent='Передаём обращение менеджеру и ожидаем подтверждение.';
        if(sendingClose)sendingClose.hidden=true;
        if(fallback)fallback.hidden=true;
      }
      try{
        const t=Cart.totals();const items=S.get().cart.map(it=>{const p=P.byPzn.get(it.pzn);return {pzn:it.pzn,qty:it.qty,name:p?.name||'',eur:p?.eur||0}});
        const result=await window.RXDE_DELIVERY.send({type:'question',question,phone:replyPhone,email:customerEmail,receiptText:'Вопрос клиента:\n'+question+'\n\nКонтакт: '+replyPhone+(customerEmail?'\nEmail: '+customerEmail:''),items,positions:t.positions,packs:t.packs,totalEur:t.eur,totalRub:t.rub,rate:S.get().rate,source:location.href.slice(0,200)});
        el.questionText.value='';closeQuestion();
        if(sending){sending.dataset.status='success';if(status)status.textContent='Вопрос отправлен';if(detail)detail.textContent='Номер обращения: '+result.id+(customerEmail?' · подтверждение на email отправляется':'');if(sendingClose){sendingClose.textContent='ОК';sendingClose.hidden=false;}}
        else U.toast('Вопрос отправлен · '+result.id);
      }catch(e){
        if(sending){sending.dataset.status='error';if(status)status.textContent='Вопрос не отправлен';if(detail)detail.textContent='Сервер не подтвердил получение. Повторите попытку или напишите на email.';if(sendingClose){sendingClose.textContent='Закрыть';sendingClose.hidden=false;}}
        else U.toast('Вопрос не подтверждён сервером. Повторите попытку или отправьте его на email ниже.');
      }
      finally{el.sendQuestion.disabled=false;}
    };el.closeOrder.onclick=closeOrder;el.orderBackdrop.onclick=e=>{
      if(e.target!==el.orderBackdrop)return;
      // Soft keyboards may resize the visual viewport and send a stray backdrop tap.
      const recentInput=Number(window.__rxdeContactEditingUntil||0)>Date.now();
      if(recentInput)return;
      closeOrder();
    };
    const lightboxClick=e=>{
      // Form badge is an independent filter control and must never be treated as a photo click.
      if(e.target.closest?.('.form-badge,[data-card-form-filter]'))return;
      const img=expandedPhotoFromTarget(e.target);
      if(!img)return;
      e.preventDefault();
      e.stopPropagation();
      openProductLightbox(img);
    };
    el.productList.addEventListener('click',lightboxClick,true);
    el.orderLines?.addEventListener('click',lightboxClick,true);
    document.getElementById('productQuickBackdrop')?.addEventListener('click',lightboxClick,true);

    // v1.56: static-card fallback — photo click must never depend on expansion state.
    const staticPhotoClick=e=>{
      if(e.target.closest?.('.form-badge,[data-card-form-filter]'))return;
      const img=e.target.closest?.('.static-product-card .product-photo img,.order-static-card .order-thumb img');
      if(!img)return;
      e.preventDefault();
      e.stopPropagation();
      openProductLightbox(img);
    };
    el.productList.addEventListener('click',staticPhotoClick,true);
    el.orderLines?.addEventListener('click',staticPhotoClick,true);

    // V3.13: one top-level capture route for every thumbnail surface.
    // This prevents card/search row handlers or legacy layers from stealing the click.
    document.addEventListener('click',e=>{
      if(e.target.closest?.('#product-photo-lightbox'))return;
      // Form badges are filters, not photo-zoom triggers.
      if(e.target.closest?.('.form-badge,[data-card-form-filter]'))return;
      const host=e.target.closest?.('#productList .product-photo,#productList .m-product-photo,#searchSuggest .suggest-photo');
      const img=host?.querySelector?.('img')||null;
      if(!img)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openProductLightbox(img);
    },true);

    el.brandHome.onclick=()=>{if(!S.get().home)navPush(navSnapshot());if(S.get().orderOpen)closeOrder();if(el.confirmBackdrop)el.confirmBackdrop.hidden=true;if(el.questionBackdrop)el.questionBackdrop.hidden=true;S.set({home:true,query:'',category:'',subcategory:'',mobileSearchScope:'category',searchScrollCategory:0,searchScrollGlobal:0,limit:R.Constants.PAGE_SIZE,categoryLimit:20,globalLimit:20,expanded:new Set()});el.searchInput.value='';history.replaceState(history.state||{},'',location.pathname);window.__rxdeMobileExitLastUrl=location.href;scrollTo({top:0,behavior:'smooth'});renderProducts();recentRecord(navSnapshot('Главная'))};
    const brandHomeZone=el.brandHome?.closest('.brand-cluster');
    if(brandHomeZone)brandHomeZone.onclick=e=>{if(e.target.closest('#brandHome'))return;el.brandHome.click()};
    if(el.orderBrandHome)el.orderBrandHome.onclick=()=>el.brandHome.click();
    // Category name in the floating capsule is an explicit 'go to start' control.
    // Sorting/filtering clicks remain independent.
    document.addEventListener('click',e=>{
      const title=e.target.closest?.('#catalogHero .catalog-hero-pill h1');
      if(!title)return;
      e.preventDefault();
      e.stopPropagation();
      // Keep the selected category and sorting. Return to its FIRST row,
      // never to home and never to the previous scroll position.
      scrollCategoryFirstRow();
    });

    const syncSoundToggle=()=>{if(!el.soundToggle)return;const on=U.soundEnabled();el.soundToggle.textContent=on?'Звук: вкл':'Звук: выкл';el.soundToggle.setAttribute('aria-pressed',String(on))};
    syncSoundToggle();if(el.soundToggle)el.soundToggle.onclick=()=>{U.setSoundEnabled(!U.soundEnabled());syncSoundToggle();if(U.soundEnabled())U.sound('tick')};
    if(el.flowBack)el.flowBack.onclick=()=>{const a=navLoad();const x=a.pop();navSave(a);navGo(x,false)};
    if(el.flowCrumbs)el.flowCrumbs.onclick=e=>{if(e.target.closest('[data-flow-home]')){if(!S.get().home)navPush(navSnapshot());S.set({home:true,query:'',category:'',subcategory:'',expanded:new Set()});el.searchInput.value='';renderProducts();window.scrollTo({top:0,behavior:'smooth'});renderFlowNav()}};
    if(el.flowHistoryToggle)el.flowHistoryToggle.onclick=()=>{const open=el.flowHistoryMenu.hidden;el.flowHistoryMenu.hidden=!open;el.flowHistoryToggle.setAttribute('aria-expanded',String(open))};
    if(el.flowHistoryToggle&&el.flowHistoryMenu){
      let hoverTimer=0;
      const openRecent=()=>{clearTimeout(hoverTimer);el.flowHistoryMenu.hidden=false;el.flowHistoryToggle.setAttribute('aria-expanded','true')};
      const closeRecent=()=>{clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>{el.flowHistoryMenu.hidden=true;el.flowHistoryToggle.setAttribute('aria-expanded','false')},180)};
      const hoverCapable=()=>window.matchMedia?.('(hover:hover) and (pointer:fine)').matches;
      el.flowHistoryToggle.addEventListener('mouseenter',()=>{if(hoverCapable())hoverTimer=setTimeout(openRecent,140)});
      el.flowHistoryToggle.addEventListener('mouseleave',()=>{if(hoverCapable())closeRecent()});
      el.flowHistoryMenu.addEventListener('mouseenter',()=>{if(hoverCapable()){clearTimeout(hoverTimer);openRecent()}});
      el.flowHistoryMenu.addEventListener('mouseleave',()=>{if(hoverCapable())closeRecent()});
    }
    if(el.mobileRecentTrail)el.mobileRecentTrail.onclick=e=>{
      if(e.target.closest('[data-mobile-flow-home]')){if(!S.get().home)navPush(navSnapshot());S.set({home:true,query:'',category:'',subcategory:'',expanded:new Set()});el.searchInput.value='';renderProducts();window.scrollTo({top:0,behavior:'smooth'});return}
      if(e.target.closest('[data-mobile-history-more]')){if(el.flowHistoryMenu&&el.flowHistoryToggle){const open=el.flowHistoryMenu.hidden;el.flowHistoryMenu.hidden=!open;el.flowHistoryToggle.setAttribute('aria-expanded',String(open))}return}
      const b=e.target.closest('[data-mobile-recent-index]');if(!b)return;const visits=recentLoad(),x=visits[Number(b.dataset.mobileRecentIndex)];if(!x)return;navGo(x,false);
    };
    if(el.flowHistoryMenu)el.flowHistoryMenu.onclick=e=>{const b=e.target.closest('[data-recent-index]');if(!b)return;const visits=recentLoad(),x=visits[Number(b.dataset.recentIndex)];if(!x)return;el.flowHistoryMenu.hidden=true;navGo(x,false)};
    // v2 11.11.2026-06: exact original working add-product navigation.
    // Do not overwrite home/category/query state: closeOrder() already restores
    // mobile search mode and any previous search bridge.
    const returnToCatalogFromOrder = e => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      closeOrder();
      // Keep the original + button action available internally (hidden in UI).
      // No automatic keyboard opening on mobile.
    };
    // Both real buttons in index.html, not the nonexistent orderFlowBack.
    if(el.addOrderProduct)el.addOrderProduct.onclick=returnToCatalogFromOrder;
    const returnButton=document.getElementById('rxdeReturnCatalog');
    if(returnButton)returnButton.onclick=returnToCatalogFromOrder;
    if(el.orderFlowBack)el.orderFlowBack.onclick=returnToCatalogFromOrder;
    // Delegation covers header re-renders; hidden + is NOT needed.
    document.addEventListener('click',e=>{
      const btn=e.target.closest?.('#rxdeReturnCatalog');
      if(!btn)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      returnToCatalogFromOrder();
    },true);
    if(el.clearOrder)el.clearOrder.onclick=clearWholeOrder;
    const restoreOrderBtn=document.getElementById('restoreOrder');if(restoreOrderBtn)restoreOrderBtn.onclick=restoreClearedReceipt;
    // Read-only receipt preview: only shown by explicit click, never uploaded.
    const receiptPreview=document.getElementById('rxdeReceiptPreview');
    const receiptPreviewPanel=receiptPreview?.querySelector('.rxde-receipt-preview-panel');
    let receiptPreviousFocus=null;
    const closeReceiptPreview=()=>{
      if(!receiptPreview||receiptPreview.hidden)return;
      receiptPreview.hidden=true;receiptPreview.setAttribute('aria-hidden','true');
      document.body.classList.remove('rxde-receipt-preview-open');
      (receiptPreviousFocus?.isConnected?receiptPreviousFocus:document.getElementById('viewOrderReceipt'))?.focus?.();
    };
    const showReceiptPreview=()=>{
      if(!receiptPreview)return;
      receiptPreviousFocus=document.activeElement;
      document.getElementById('rxdeReceiptPreviewText').textContent=R.Admin.privateShareText();
      receiptPreview.hidden=false;receiptPreview.setAttribute('aria-hidden','false');
      document.body.classList.add('rxde-receipt-preview-open');receiptPreviewPanel?.focus();
    };
    // RXDE V2: simple, predictable receipt action, including touch browsers.
    // One click always copies. Viewing is available in the separate receipt modal.
    const receiptTrigger=document.getElementById('viewOrderReceipt');
    const copyReceiptQuick=async()=>{
      if(!S.get().cart.length){U.toast('Добавьте позиции в заказ');return}
      await copyRxdeShare(R.Admin.privateShareText(),'заказ',receiptTrigger);
    };
    receiptTrigger?.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();copyReceiptQuick();
    });
    document.getElementById('rxdeReceiptPreviewClose')?.addEventListener('click',closeReceiptPreview);
    document.getElementById('rxdeReceiptPreviewDone')?.addEventListener('click',closeReceiptPreview);
    receiptPreview?.addEventListener('click',event=>{if(event.target===receiptPreview)closeReceiptPreview()});
    document.addEventListener('keydown',event=>{
      if(receiptPreview?.hidden)return;
      if(event.key==='Escape'){event.preventDefault();closeReceiptPreview();}
      if(event.key==='Tab'){
        const items=[...receiptPreviewPanel.querySelectorAll('button:not([disabled])')];
        if(!items.length){event.preventDefault();return;}
        if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1).focus();}
        else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}
      }
    });
    const receiptShareBtn=document.getElementById('rxdeReceiptPreviewShare');if(receiptShareBtn)receiptShareBtn.onclick=async()=>{if(!S.get().cart.length){U.toast('Добавьте позиции в заказ');return}const ok=await copyRxdeShare(R.Admin.privateShareText(),'заказ',receiptShareBtn);if(ok)closeReceiptPreview()};
    el.orderLines.addEventListener('input',e=>{
      if(!e.target.matches('[data-expiry-months]'))return;
      const ed=e.target.closest('[data-expiry-editor]');
      const preview=ed?.querySelector('[data-expiry-preview]');
      if(preview)preview.textContent=R.expiryMonthLabel(Math.max(1,Math.min(120,Number(e.target.value)||12)));
    });
    // V3.13.123: one modal per order; independent of item row geometry and clipping.
    let expiryModal=null;
    let expiryViewportCleanup=null;
    function closeRxExpiryDialog(){
      if(!expiryModal)return;
      if(expiryViewportCleanup){expiryViewportCleanup();expiryViewportCleanup=null;}
      const m=expiryModal;expiryModal=null;m.remove();document.body.classList.remove('rxde-expiry-dialog-open');
    }
    function openRxExpiryDialog(trigger){
      const product=trigger.closest('.order-product-row');
      const pzn=String(trigger.dataset.expiryToggle||'');
      const existing=expiryModal?.dataset?.pzn===pzn;
      closeRxExpiryDialog();
      if(existing)return;
      const base=product?.querySelector('[data-expiry-editor]');
      if(!base)return;
      const overlay=document.createElement('div');
      overlay.className='rxde-expiry-modal-backdrop';overlay.dataset.pzn=pzn;
      overlay.setAttribute('role','presentation');
      const panel=document.createElement('section');panel.className='rxde-expiry-modal-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Пожелание по сроку годности');
      panel.innerHTML='<button class="rxde-expiry-modal-close" type="button" aria-label="Закрыть">×</button>' + base.innerHTML;
      overlay.appendChild(panel);document.body.appendChild(overlay);expiryModal=overlay;
      document.body.classList.add('rxde-expiry-dialog-open');
      // Android keyboards may overlay the layout viewport. Position the dialog
      // within the real visible viewport so its action buttons remain reachable.
      const vv=window.visualViewport;
      const syncVisibleViewport=()=>{
        if(!expiryModal||expiryModal!==overlay)return;
        if(vv){
          overlay.style.setProperty('--rxde-vv-top',vv.offsetTop+'px');
          overlay.style.setProperty('--rxde-vv-height',vv.height+'px');
          overlay.style.setProperty('--rxde-vv-left',vv.offsetLeft+'px');
          overlay.style.setProperty('--rxde-vv-width',vv.width+'px');
        }
      };
      syncVisibleViewport();
      vv?.addEventListener('resize',syncVisibleViewport);
      vv?.addEventListener('scroll',syncVisibleViewport);
      expiryViewportCleanup=()=>{
        vv?.removeEventListener('resize',syncVisibleViewport);
        vv?.removeEventListener('scroll',syncVisibleViewport);
      };
      const input=panel.querySelector('[data-expiry-months]');
      const refresh=()=>{const n=Math.max(1,Math.min(120,Number(input?.value)||12));const preview=panel.querySelector('[data-expiry-preview]');if(preview)preview.textContent=R.expiryMonthLabel(n)};
      input?.addEventListener('input',refresh);
      overlay.addEventListener('click',e=>{
        if(e.target===overlay||e.target.closest('.rxde-expiry-modal-close')||e.target.closest('[data-expiry-cancel]')){closeRxExpiryDialog();return}
        if(e.target.closest('[data-expiry-save]')){
          const n=Math.max(1,Math.min(120,parseInt(input?.value,10)||12));
          R.OrderExpiry.set(pzn,{mode:'months',months:n,comment:String(panel.querySelector('[data-expiry-comment]')?.value||'').trim().slice(0,160)});closeRxExpiryDialog();renderOrder();return;
        }
        if(e.target.closest('[data-expiry-clear]')){R.OrderExpiry.remove(pzn);closeRxExpiryDialog();renderOrder();return}
      });
      // Deliberately no input autofocus: do not open mobile keyboard on dialog open.
    }
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&expiryModal)closeRxExpiryDialog()});
    el.orderLines.onclick=e=>{
      if(typeof suppressOrderClickUntil!=='undefined'&&Date.now()<suppressOrderClickUntil){e.preventDefault();e.stopPropagation();return}
      const cp=e.target.closest('[data-copy-pzn]');if(cp){e.stopPropagation();copyPzn(cp.dataset.copyPzn);return}
      if(e.target.closest('.rx-badge')){showRxNotice();return}
      const expToggle=e.target.closest('[data-expiry-toggle]');
      if(expToggle){e.preventDefault();e.stopPropagation();openRxExpiryDialog(expToggle);return}
      const expSave=e.target.closest('[data-expiry-save]');
      if(expSave){e.preventDefault();e.stopPropagation();const ed=expSave.closest('[data-expiry-editor]');const months=Math.max(1,Math.min(120,parseInt(ed.querySelector('[data-expiry-months]').value,10)||12));R.OrderExpiry.set(expSave.dataset.expirySave,{mode:'months',months,comment:String(ed.querySelector('[data-expiry-comment]')?.value||'').trim().slice(0,160)});renderOrder();return}
      const expClear=e.target.closest('[data-expiry-clear]');
      if(expClear){e.preventDefault();e.stopPropagation();R.OrderExpiry.remove(expClear.dataset.expiryClear);renderOrder();return}
      const del=e.target.closest('[data-order-delete]');if(del){e.preventDefault();e.stopPropagation();removeOnePositionNow(del.dataset.orderDelete,del);return}
      const orderTitle=e.target.closest('[data-order-title-open]');
      if(orderTitle){e.preventDefault();e.stopPropagation();const pzn=U.pzn(orderTitle.dataset.orderTitleOpen||'');if(pzn){saveFullProductOrigin(pzn,'order');closeOrder();setTimeout(()=>{location.href=pageUrl(pzn)},50)}return}
      const family=e.target.closest('[data-order-family-search]');
      if(family){e.preventDefault();e.stopPropagation();jumpOrderToFamily(family.dataset.orderFamilySearch);return}
      const d=e.target.closest('[data-order-delta]');if(d){change(d.dataset.pzn,Number(d.dataset.orderDelta),d);return}
      const full=e.target.closest('[data-order-full-product]');
      if(full){
        navPush(navSnapshot());
        try{sessionStorage.setItem('rxde:catalogReturn',JSON.stringify({url:location.href,scrollY:window.scrollY,state:{query:S.get().query,category:S.get().category,subcategory:S.get().subcategory,mobileSearchScope:S.get().mobileSearchScope,searchScrollCategory:S.get().searchScrollCategory,searchScrollGlobal:S.get().searchScrollGlobal,limit:S.get().limit,categoryLimit:S.get().categoryLimit,globalLimit:S.get().globalLimit}}))}catch(_){}
        return;
      }
      if(e.target.closest('button,input,a,textarea,select,label,.order-unit-price,.order-qty,.order-line-total,.order-num-badge'))return;
      // The cart row itself is intentionally inert: title = full product, loupe = family search.
    };
    el.orderLines.onchange=e=>{const q=e.target.closest('[data-order-qty]');if(q){const p=q.dataset.orderQty,n=Math.max(0,Math.min(999,Number(q.value)||0));if(n===0){removeOnePositionNow(p,q)}else{const old=Cart.qty(p);Cart.setQty(p,n);updateVisibleOrderLine(p);updateVisibleProductRow(p);renderOrderStatus();const t=Cart.totals();if(el.orderPositions)el.orderPositions.textContent=`${t.positions} поз. · ${t.packs} уп.`;if(el.orderTotalRub)el.orderTotalRub.textContent=`${U.money(t.rub)} ₽`;if(el.orderHeaderMeta)el.orderHeaderMeta.textContent=`${t.positions} поз. · ${t.packs} уп.`;if(el.orderHeaderTotal)el.orderHeaderTotal.textContent=`${U.money(t.rub)} ₽`;pulseOrder(n>=old?'up':'down',p,q);window.RXDEShowCartPeek?.(n>=old?'up':'down')}}};
    el.orderLines.addEventListener('dragstart',e=>{const h=e.target.closest('[data-drag-pzn]');if(h){dragPzn=h.dataset.dragPzn;e.dataTransfer.effectAllowed='move';h.closest('.order-product-row')?.classList.add('dragging')}});
    el.orderLines.addEventListener('dragend',e=>{e.target.closest('.order-product-row')?.classList.remove('dragging');dragPzn=null});
    el.orderLines.addEventListener('dragover',e=>{if(e.target.closest('.order-product-row'))e.preventDefault()});
    el.orderLines.addEventListener('drop',e=>{const r=e.target.closest('.order-product-row');if(!r||!dragPzn)return;e.preventDefault();const movedPzn=dragPzn,targetPzn=r.dataset.pzn;const to=S.get().cart.findIndex(x=>x.pzn===targetPzn);Cart.move(movedPzn,to);dragPzn=null;renderOrder();animateOrderSwap(movedPzn,targetPzn)});
    let pointerDrag=null, suppressOrderClickUntil=0;
    const clearDragGhost=()=>{document.querySelector('.rxde-drag-ghost')?.remove();el.orderLines.querySelectorAll('.rxde-drag-source').forEach(x=>x.classList.remove('rxde-drag-source'))};
    const clearPointerDragVisual=()=>{
      el.orderLines.querySelectorAll('.dragging,.drag-target').forEach(x=>x.classList.remove('dragging','drag-target'));
    };
    el.orderLines.addEventListener('pointerdown',e=>{
      const h=e.target.closest('[data-drag-pzn]');
      if(!h||e.pointerType==='mouse')return;
      e.preventDefault();
      pointerDrag={pzn:h.dataset.dragPzn,id:e.pointerId,startX:e.clientX,startY:e.clientY,toPzn:null,moved:false};
      const source=h.closest('.order-product-row');
      if(source){const rect=source.getBoundingClientRect(),ghost=source.cloneNode(true);ghost.classList.add('rxde-drag-ghost');ghost.removeAttribute('id');ghost.style.cssText=`left:${rect.left}px;top:${e.clientY-40}px;width:${rect.width}px`;document.body.appendChild(ghost);pointerDrag.ghost=ghost;source.classList.add('rxde-drag-source')}
      h.setPointerCapture?.(e.pointerId);
      h.closest('.order-product-row')?.classList.add('dragging');
    });
    el.orderLines.addEventListener('pointermove',e=>{
      if(!pointerDrag||pointerDrag.id!==e.pointerId)return;
      e.preventDefault();
      if(Math.hypot(e.clientX-pointerDrag.startX,e.clientY-pointerDrag.startY)>7)pointerDrag.moved=true;
      if(pointerDrag.ghost)pointerDrag.ghost.style.top=(e.clientY-40)+'px';
      const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.order-product-row');
      el.orderLines.querySelectorAll('.drag-target').forEach(x=>x.classList.remove('drag-target'));
      if(target&&target.dataset.pzn!==pointerDrag.pzn){
        pointerDrag.toPzn=target.dataset.pzn;
        target.classList.add('drag-target');
      }else pointerDrag.toPzn=null;
      const r=el.orderLines.getBoundingClientRect(),edge=46;
      if(e.clientY<r.top+edge)el.orderLines.scrollTop-=10;
      else if(e.clientY>r.bottom-edge)el.orderLines.scrollTop+=10;
    },{passive:false});
    const finishPointerDrag=e=>{
      if(!pointerDrag||pointerDrag.id!==e.pointerId)return;
      const job=pointerDrag;pointerDrag=null;
      clearDragGhost();clearPointerDragVisual();
      if(job.moved)suppressOrderClickUntil=Date.now()+350;
      if(job.toPzn){
        const to=S.get().cart.findIndex(x=>x.pzn===job.toPzn);
        if(to>=0){const targetPzn=job.toPzn;Cart.move(job.pzn,to);renderOrder();animateOrderSwap(job.pzn,targetPzn);U.haptic?.('move')}
      }
    };
    el.orderLines.addEventListener('pointerup',finishPointerDrag);
    el.orderLines.addEventListener('pointercancel',finishPointerDrag);
    function standardCartReceipt(){
      const items=S.get().cart;
      if(!items.length)return '';
      // Reuse the exact admin-template generator: one format for copy, Outlook and client email.
      return R.Admin.template(null,items,R.Admin.importAddress?.()||'');
    }
    function orderEmailText(){
      const phone=String(el.phoneInput?.value||'').trim();
      const email=String(document.getElementById('orderContactEmail')?.value||'').trim();
      return [standardCartReceipt(),phone?'\nТелефон для связи: '+phone:'',email?'Email для связи: '+email:''].filter(Boolean).join('\n');
    }
    // One common phone or independent contacts for selected messengers.
    const messengerNames=['MAX','Viber','Telegram','WhatsApp'];
    const exitPrompt=document.getElementById('rxdeExitConfirm');
    function bindContactToggle(toggleId,inputId){
      const toggle=document.getElementById(toggleId),field=document.getElementById(inputId);
      if(!toggle||!field)return;
      if(field.value.trim())toggle.checked=true;
      toggle.addEventListener('change',()=>{syncContacts();if(toggle.checked&&!field.disabled)field.focus();});
      field.addEventListener('input',()=>{validatePhone(false);updateConfirmSubmitState();});
    }
    function syncContacts(){
      const unified=unifiedPhoneMode();
      const phoneToggle=document.getElementById('rxdeUsePhone');
      if(unified){phoneToggle.checked=true;phoneToggle.disabled=true;}
      else phoneToggle.disabled=false;
      el.phoneInput.disabled=!phoneToggle.checked;
      const emailToggle=document.getElementById('rxdeUseEmail');
      const emailField=document.getElementById('orderContactEmail');
      emailField.disabled=!emailToggle.checked;
      for(const name of messengerNames){
        const field=document.getElementById('rxdeContact'+name);
        const toggle=document.getElementById('rxdeUse'+name);
        field.disabled=unified||!toggle.checked;
        field.placeholder=unified?'Единый номер':(name==='Telegram'?'@username или ссылка':'Номер / логин / ссылка');
      }
      document.getElementById('rxdeContactDetails')?.classList.toggle('rxde-unified-mode',unified);
      validatePhone(false);
      updateConfirmSubmitState();
    }
    bindContactToggle('rxdeUsePhone','phoneInput');
    bindContactToggle('rxdeUseEmail','orderContactEmail');
    messengerNames.forEach(name=>bindContactToggle('rxdeUse'+name,'rxdeContact'+name));
    document.getElementById('rxdeUnifiedPhone')?.addEventListener('change',()=>{syncContacts();});
    syncContacts();
    function contactDraft(){return [el.phoneInput?.value,document.getElementById('orderContactEmail')?.value,...messengerNames.map(name=>document.getElementById('rxdeContact'+name)?.value)].some(x=>String(x||'').trim())||selectedMessengers().length>0;}
    function exitForm(){
      if(el.confirmSubmit?.dataset.busy==='1')return;
      // Checkout is a reversible step; the fields remain in the DOM, so
      // going back to the cart must not open a second confirmation dialog.
      if(exitPrompt)exitPrompt.hidden=true;
      el.confirmBackdrop.hidden=true;if(isMobile())setMobileMode('order');
    }
    document.getElementById('rxdeExitStay')?.addEventListener('click',()=>{exitPrompt.hidden=true;});
    document.getElementById('rxdeExitLeave')?.addEventListener('click',()=>{exitPrompt.hidden=true;el.confirmBackdrop.hidden=true;if(isMobile())setMobileMode('order');});
    const directMail=document.getElementById('orderEmailDirect');
    directMail?.addEventListener('click',e=>{e.preventDefault();const url='mailto:med.zakaz.de@gmail.com?subject='+encodeURIComponent('RXDE · заказ клиента')+'&body='+encodeURIComponent(orderEmailText());window.location.href=url;});
    const acceptedBackdrop=document.getElementById('orderAcceptedBackdrop');
    const acceptedOk=document.getElementById('acceptedOk');
    const acceptedEmailInput=document.getElementById('acceptedEmailInput');
    const acceptedEmailStatus=document.getElementById('acceptedEmailStatus');
    let acceptedReceipt='';
    // A successfully accepted order must exit ALL order overlays and restore
    // the catalog; hiding the accepted dialog alone leaves mobile locked.
    function finishAcceptedOrder(){
      acceptedBackdrop.hidden=true;
      el.confirmBackdrop.hidden=true;
      closeOrder();
      if(isMobile())restoreSearchMode();
      if(favoritesOnly){favoritesOnly=false;syncFavoritesUI();}
      activeFormFilters.clear();activeFormFilter='';activeFormKey='';formFilterEngaged=false;
      activeDoseFilter='';activeDoseKey='';
      el.searchInput.value='';hideSuggestions();
      // Restore a known populated category instead of a blank global browse.
      // The catalogue's normal browse() path requires a concrete category.
      const firstCategory=R.Products?.categories?.[0]?.[0] || 'Витамины и минералы';
      S.set({home:false,query:'',category:firstCategory,subcategory:'',mobileSearchScope:'category',
        searchScrollCategory:0,searchScrollGlobal:0,limit:R.Constants.PAGE_SIZE,
        categoryLimit:20,globalLimit:R.Constants.PAGE_SIZE,expanded:new Set()});
      renderAll();
      requestAnimationFrame(()=>requestAnimationFrame(scrollResultsTop));
    }
    document.querySelectorAll('input[name="acceptedChoice"]').forEach(r=>r.addEventListener('change',()=>{
      document.getElementById('acceptedEmailEntry').hidden=document.querySelector('input[name="acceptedChoice"]:checked')?.value!=='yes';
      acceptedEmailStatus.textContent='';
    }));
    acceptedOk.onclick=async()=>{
      const wantsEmail=document.querySelector('input[name="acceptedChoice"]:checked')?.value==='yes';
      if(wantsEmail){
        const email=String(acceptedEmailInput.value||'').trim();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){acceptedEmailInput.focus();acceptedEmailStatus.textContent='Введите корректный email.';return;}
        acceptedOk.disabled=true;acceptedEmailStatus.textContent='Сохраняем email и отправляем копию…';
        try{
          const reply=await window.RXDE_DELIVERY.addClientEmail(acceptedReceipt,email);
          acceptedEmailStatus.textContent=reply.clientMailStatus==='ОТПРАВЛЕНО'?'Копия отправлена на email.':'Email сохранён. Письмо будет отправлено при первой возможности.';
          acceptedOk.textContent='Закрыть';acceptedOk.onclick=()=>{finishAcceptedOrder();};
        }catch(e){acceptedEmailStatus.textContent='Не удалось подтвердить сохранение email. Повторите попытку.';}
        finally{acceptedOk.disabled=false;}
        return;
      }
      finishAcceptedOrder();
    };
    // Legacy checkout is retired. checkout35.js replaces this fallback when ready.
    // Never open confirmBackdrop: it contains obsolete independent messenger inputs.
    if(el.confirmBackdrop){
      el.confirmBackdrop.hidden=true;
      el.confirmBackdrop.setAttribute('aria-hidden','true');
    }
    el.submitOrder.onclick=()=>{
      if(!S.get().cart.length){U.toast?.('Сначала добавьте товар в корзину');return;}
      U.toast?.('Форма оформления не загрузилась. Обновите страницу.');
    };
    el.closeConfirm.onclick=exitForm;
    el.confirmBackdrop.onclick=e=>{if(e.target===el.confirmBackdrop){/* Backdrop taps do not discard the draft. */}};
    el.phoneInput?.addEventListener('input',()=>{validatePhone(false);updateConfirmSubmitState();});
    el.confirmSubmit.onclick=async()=>{
      if(!validatePhone(true)){updateConfirmSubmitState();document.getElementById('rxdeContactDetails').open=true;U.beep?.(false);return;}
      const box=el.confirmBackdrop?.querySelector('.confirm-card');
      let status=box?.querySelector('.confirm-local-status');if(!status){status=document.createElement('div');status.className='confirm-local-status';el.confirmSubmit?.insertAdjacentElement('afterend',status);}
      if(!window.RXDE_DELIVERY?.isConfigured()){status.textContent='Приём заявок ещё не подключён. Вы можете отправить заказ письмом по ссылке выше.';return;}
      el.confirmSubmit.dataset.busy='1';el.confirmSubmit.disabled=true;el.confirmSubmit.textContent='Отправляем…';status.textContent='Проверяем сохранение заявки…';
      try{
        const t=Cart.totals(),items=S.get().cart.map(it=>{const p=P.byPzn.get(it.pzn);return {pzn:it.pzn,qty:it.qty,name:p?.name||'',eur:p?.eur||0}});
        const result=await window.RXDE_DELIVERY.send({type:'order',phone:(document.getElementById('rxdeUsePhone')?.checked||unifiedPhoneMode())?el.phoneInput.value.trim():'',email:document.getElementById('rxdeUseEmail')?.checked?String(document.getElementById('orderContactEmail')?.value||'').trim():'',messengers:selectedMessengers(),messenger:selectedMessengers().map(m=>m.name).join(', '),messengerContact:selectedMessengers().map(m=>m.name+': '+m.contact).join(' | '),receiptText:standardCartReceipt(),question:'',items,positions:t.positions,packs:t.packs,totalEur:t.eur,totalRub:t.rub,rate:S.get().rate,source:location.href.slice(0,200)});
        acceptedReceipt=result.id;
        document.getElementById('orderAcceptedId').textContent='Номер заявки: '+result.id;
        acceptedEmailInput.value='';acceptedEmailStatus.textContent='';acceptedOk.textContent='ОК';
        const providedEmail=document.getElementById('rxdeUseEmail')?.checked?String(document.getElementById('orderContactEmail')?.value||'').trim():'';
        document.getElementById('acceptedEmailChoice').hidden=!!providedEmail;
        document.getElementById('acceptedEmailPrompt').textContent='Хотите получить копию заказа на почту и указать email как запасной способ связи?';
        if(providedEmail){acceptedEmailStatus.textContent='Копия заказа на '+providedEmail+' поставлена в очередь отправки.';}
        acceptedOk.onclick=null;
        // Install a fresh handler after each successful receipt, allowing repeat orders.
        acceptedOk.onclick=async()=>{
          if(document.querySelector('input[name="acceptedChoice"]:checked')?.value!=='yes'){finishAcceptedOrder();return;}
          const email=String(acceptedEmailInput.value||'').trim();
          if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){acceptedEmailInput.focus();acceptedEmailStatus.textContent='Введите корректный email.';return;}
          acceptedOk.disabled=true;acceptedEmailStatus.textContent='Сохраняем email…';
          try{const r=await window.RXDE_DELIVERY.addClientEmail(acceptedReceipt,email);acceptedEmailStatus.textContent=r.clientMailStatus==='ОТПРАВЛЕНО'?'Копия отправлена на email.':'Email сохранён, отправка письма ожидается.';acceptedOk.textContent='Закрыть';acceptedOk.onclick=()=>{finishAcceptedOrder();};}
          catch(_){acceptedEmailStatus.textContent='Не удалось подтвердить сохранение email. Повторите попытку.';}
          finally{acceptedOk.disabled=false;}
        };
        document.querySelector('input[name="acceptedChoice"][value="no"]').checked=true;
        document.getElementById('acceptedEmailEntry').hidden=true;
        el.confirmSubmit.dataset.busy='0'; el.confirmBackdrop.hidden=true;acceptedBackdrop.hidden=false;U.beep(true);
      }catch(e){status.textContent='Не удалось подтвердить запись заказа. Повторите попытку либо отправьте заказ письмом.';el.confirmSubmit.dataset.busy='0';el.confirmSubmit.disabled=false;el.confirmSubmit.textContent='Повторить отправку';updateConfirmSubmitState();}
    };
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();el.searchInput.focus()}if(e.key==='Escape'){
      const photoBox=document.getElementById('product-photo-lightbox');
      if(photoBox&&!photoBox.hidden){photoBox._rxdeClose?.();return}
      if(el.questionBackdrop&&!el.questionBackdrop.hidden){el.questionBackdrop.hidden=true;if(isMobile())restoreSearchMode()}
      else if(!el.confirmBackdrop.hidden){exitForm()}
      else if(S.get().orderOpen){
        const editing=el.orderSheet?.contains(document.activeElement)&&document.activeElement?.matches?.('input,textarea,[contenteditable="true"]');
        if(editing){e.preventDefault();e.stopPropagation();document.activeElement.blur();return}
        closeOrder();
      }
    }});
  },renderAll,openOrder,refreshRateDisplay};
})(window.RXDE);


(function(R){
  const U=R.Utils,S=R.Store,P=R.Products,Cart=R.Cart;
  const A=R.Admin={};
  const session={parsed:null,address:'',addressParts:{},useRawAddress:false,manualRate:null,baseRate:null,priceOverrides:new Map(),basePrices:new Map(),shippingEur:null,changes:new Set(),unlocked:(()=>{try{return localStorage.getItem('rxde:admin:trusted-browser:v2')==='yes'}catch(_){return false}})()};

  function $(id){return document.getElementById(id)}
  function cleanLines(text){return String(text||'').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()}
  function htmlToText(html,plain=''){
    if(!html)return cleanLines(plain);
    const box=document.createElement('div');box.innerHTML=html;
    box.querySelectorAll('br').forEach(x=>x.replaceWith('\n'));
    box.querySelectorAll('p,div,li').forEach(x=>x.append('\n'));
    return cleanLines(box.textContent||plain);
  }
  function findFirstLabel(text){
    const lines=cleanLines(text).split('\n').map(x=>x.trim()).filter(Boolean);
    for(const line of lines.slice(0,5)){
      if(/^дата\s*:/i.test(line)||/^€\/₽\s*:/i.test(line)||/^позиц/i.test(line))continue;
      if(/https?:\/\//i.test(line))continue;
      if(/^\d+\.\s*$/.test(line))continue;
      return line.length<=100?line:'';
    }
    return '';
  }
  function parseLinkCart(text){
    const out=new Map();
    const m=String(text||'').match(/[?&]c=([^&\s]+)/i);
    if(!m)return out;
    try{
      decodeURIComponent(m[1]).split(',').forEach(part=>{
        const [rawPzn,rawQty]=part.split(':');
        const pzn=U.pzn(rawPzn),qty=Math.max(1,parseInt(rawQty||'1',10)||1);
        if(/^(?:\d{8}|[A-Za-z][A-Za-z0-9]{7,15})$/.test(pzn))out.set(pzn,(out.get(pzn)||0)+qty);
      });
    }catch(_){}
    return out;
  }
  function parseExplicitItems(text){
    const noLinks=String(text||'').replace(/https?:\/\/[^\s]+/gi,' ');
    const rx=/(?:PZN\s*[:№#-]?\s*([A-Za-z][A-Za-z0-9]{7,15}|\d{6,8}))/gi;
    const ms=[...noLinks.matchAll(rx)],items=[];
    for(let i=0;i<ms.length;i++){
      const m=ms[i],pzn=U.pzn(m[1]);
      const start=m.index+m[0].length,end=ms[i+1]?ms[i+1].index:noLinks.length;
      const chunk=noLinks.slice(start,Math.min(end,start+110));
      let qty=1;
      const qm=chunk.match(/(?:\*|×|x|х|:)?\s*(\d+)\s*(?:pack|paсk|уп(?:ак)?|шт)/i);
      if(qm)qty=Math.max(1,parseInt(qm[1],10)||1);
      const pm=chunk.match(/(?:\.\.\.|=|\s)(\d+(?:[.,]\d+)?)\s*€/i);
      items.push({pzn,qty,oldPrice:pm?U.num(pm[1]):null});
    }
    return items;
  }
  function mergeItems(explicit,linkMap){
    const map=new Map();
    explicit.forEach(x=>{
      const q=linkMap.has(x.pzn)?linkMap.get(x.pzn):x.qty;
      if(map.has(x.pzn)){map.get(x.pzn).qty+=q}
      else map.set(x.pzn,{...x,qty:q});
    });
    linkMap.forEach((qty,pzn)=>{
      if(!map.has(pzn))map.set(pzn,{pzn,qty,oldPrice:null});
    });
    return [...map.values()];
  }
  function parseLoosePznList(text){
    const raw=cleanLines(text);
    if(!raw)return [];
    const out=new Map();
    const add=(value,qty=1)=>{
      let digits=String(value||'').replace(/\D/g,'');
      if(digits.length<6||digits.length>8)return false;
      digits=digits.padStart(8,'0');
      qty=Math.max(1,Math.min(999,parseInt(qty||'1',10)||1));
      if(out.has(digits))out.get(digits).qty+=qty;
      else out.set(digits,{pzn:digits,qty,oldPrice:null});
      return true;
    };

    const lines=raw.split('\n').map(x=>x.trim()).filter(Boolean);
    let acceptedLines=0;
    for(const line of lines){
      // Excel copy: first column PZN, second column optional quantity.
      const tabs=line.split(/\t+/).map(x=>x.trim()).filter(Boolean);
      if(tabs.length>=1 && /^\d{6,8}$/.test(tabs[0])){
        if(tabs.length===1 || /^\d{1,3}$/.test(tabs[1])){
          add(tabs[0],tabs[1]||1);acceptedLines++;continue;
        }
      }

      // One PZN with optional qty: 6308348 x2 / 6308348;2 / 6308348,2
      const pair=line.match(/^\s*(\d{6,8})\s*(?:[xх×]\s*|[;|,]\s*|\s+)(\d{1,3})\s*$/i);
      if(pair){add(pair[1],pair[2]);acceptedLines++;continue;}

      // Pure single PZN line.
      if(/^\d{6,8}$/.test(line)){add(line,1);acceptedLines++;continue;}

      // A line containing several PZN values separated by comma/semicolon/spaces.
      const pieces=line.split(/[;,\s]+/).filter(Boolean);
      if(pieces.length>1 && pieces.every(x=>/^\d{6,8}$/.test(x))){
        pieces.forEach(x=>add(x,1));acceptedLines++;continue;
      }
    }

    // Safety: loose mode is only valid if every non-empty line looked like PZN input.
    if(lines.length && acceptedLines===lines.length)return [...out.values()];
    return [];
  }
  function parseAddress(text){
    const raw=cleanLines(text);
    const labelled=raw.match(/(?:АДРЕС\s+ДОСТАВКИ|ADDRESS|ADRESSE|DIRECCI[ÓO]N|INDIRIZZO)\s*:\s*\n?([\s\S]*?)(?=\n\s*https?:\/\/|\n\s*(?:дата|€\/₽|позиц|упаковок)\s*:|$)/i);
    let value='',confidence='не найден';
    if(labelled){
      value=cleanLines(labelled[1].replace(/https?:\/\/[^\s]+/gi,''));
      confidence='точно по метке';
    }else{
      // Legacy RXDE behavior: a Russian six-digit postal code starts the address.
      // Work only with FULL lines, never a six-digit substring inside a phone/PZN/price.
      const beforeLink=raw.split(/\n\s*https?:\/\//i)[0];
      const lines=beforeLink.split('\n');
      const start=lines.findIndex(line=>/^\s*[1-9]\d{5}(?:\s|$)/.test(line));
      if(start>=0){
        value=cleanLines(lines.slice(start).join('\n').split(/\n\s*(?:дата\s*:|€\/₽\s*:|позиций\s*:|https?:\/\/)/i)[0]);
        confidence='точно: блок от индекса';
      }else{
        // For non-Russian / unlabelled addresses: don't guess and silently lose lines.
        // Show a warning and let the administrator paste or edit the address.
        confidence='адрес не распознан — вставьте вручную';
      }
    }
    const parts={recipient:'',street:'',unit:'',postal:'',city:'',region:'',country:'',phone:''};
    if(value){
      const lines=value.split('\n').map(x=>x.trim()).filter(Boolean);
      const post=lines.find(x=>/^\s*[1-9]\d{5}(?:\s|$)/.test(x));
      if(post)parts.postal=(post.match(/^\s*([1-9]\d{5})/)||[])[1]||'';
      const phoneRx=/^(?:\+?\d[\d\s()\-]{8,}\d)$/;
      const phone=lines.find(x=>phoneRx.test(x)&&x!==post);
      if(phone)parts.phone=phone;
      // Phone/email may be on separately labelled lines in the original receipt.
      const labelledPhone=raw.match(/(?:^|\n)\s*(?:телефон|тел\.|phone|контакт(?:ный номер)?)\s*[:：]\s*(\+?[\d()\-\s]{10,22})(?=\n|$)/i);
      if(labelledPhone)parts.phone=labelledPhone[1].trim();
      const city=lines.find(x=>/^(?:г\.|город\s|пос\.|пгт\.|с\.)/i.test(x));
      if(city)parts.city=city;
      const street=lines.find(x=>/(?:^|\s)(?:ул\.|улица|проспект|пр-т|пер\.|переулок|шоссе|наб\.|бульвар|проезд|street|straße|str\.)/i.test(x));
      if(street){parts.street=street; const u=street.match(/(?:кв\.?|квартира|офис)\s*[^,;]+/i);if(u)parts.unit=u[0]}
      const person=lines.find(x=>x!==post&&x!==phone&&x!==city&&x!==street&&/^[А-ЯЁ][а-яё-]+\s+[А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ][а-яё-]+)?$/u.test(x));
      if(person)parts.recipient=person;
      // Do not invent region/country or treat telephone digits as a postal/city line.
    }
    return {value,confidence,parts};
  }
  function parse(text){
    const clean=cleanLines(text);
    const oldRate=(clean.match(/€\/₽\s*:\s*\[?\s*([\d.,]+)/i)||[])[1]||'';
    const oldDate=(clean.match(/дата\s*:\s*\[?\s*([^\]\n]+)/i)||[])[1]||'';
    const address=parseAddress(clean);
    const labelledPhone=clean.match(/(?:^|\n)\s*(?:телефон|тел\.|phone)\s*[:：]\s*(\+?[\d()\-\s]{10,22})(?=\n|$)/i);
    if(labelledPhone && address.value && !address.value.includes(labelledPhone[1].trim())){
      address.value+='\n'+labelledPhone[1].trim();
      address.parts.phone=labelledPhone[1].trim();
    }
    const explicit=parseExplicitItems(clean);
    const linkMap=parseLinkCart(clean);
    // A pasted receipt's product lines take precedence over a possibly stale cart URL.
    // A URL-only import still works for legacy checkout links.
    const authoritativeLinks=explicit.length?new Map([...linkMap].filter(([sku])=>explicit.some(x=>x.pzn===sku))):linkMap;
    let items=mergeItems(explicit,authoritativeLinks);
    const looseMode=!items.length;
    if(looseMode)items=parseLoosePznList(clean);
    return {
      raw:clean,
      label:looseMode&&items.length?'Список PZN':findFirstLabel(clean),
      oldRate:oldRate?U.num(oldRate):null,
      oldTotal:extractOldTotal(clean),
      oldDate:oldDate.trim(),
      address,
      items,
      inputMode:looseMode&&items.length?'pzn-list':'receipt'
    };
  }
  function extractOldTotal(text){
    const source=String(text||'').replace(/\u00a0/g,' ');
    const rubLines=source.split('\n').filter(x=>/₽|руб(?:лей|ля)?/i.test(x));
    const parseAmount=x=>U.num(String(x||'').replace(/[\s\u202f]/g,''));
    for(const line of rubLines.slice().reverse()){
      const payment=line.match(/к\s+оплате\s*[:—-]?\s*([\d\s\u202f.,]+)\s*₽/i);
      if(payment && parseAmount(payment[1])>0)return parseAmount(payment[1]);
    }
    for(const line of rubLines.slice().reverse()){
      const final=line.match(/(?:=|итого\s*:?|сумма\s*:?)\s*([\d\s\u202f.,]+)\s*₽/i);
      if(final && parseAmount(final[1])>0)return parseAmount(final[1]);
    }
    return null;
  }
  function effectiveRate(){return session.manualRate||S.get().rate}
  function effectivePrice(pzn){
    const p=P.byPzn.get(pzn);
    return session.priceOverrides.has(pzn)?session.priceOverrides.get(pzn):(p?.eur||0);
  }
  function currentItemInfo(item){
    const p=P.byPzn.get(item.pzn);
    if(!p)return {...item,missing:true};
    return {...item,missing:false,p,currentPrice:effectivePrice(item.pzn)};
  }
  function currentDate(){
    return new Date().toLocaleDateString('ru-RU');
  }
  function publicLink(items){
    const c=items.map(x=>`${x.pzn}:${x.qty}`).join(',');
    const d=currentDate();
    if(!R.Constants.PUBLIC_BASE_URL)return '';
    return `${R.Constants.PUBLIC_BASE_URL.replace(/\/$/,'')}/?c=${encodeURIComponent(c).replace(/%2C/g,',').replace(/%3A/g,':')}&d=${encodeURIComponent(d)}`;
  }
  function template(parsed,items,address){
    const rate=effectiveRate(),ship=session.shippingEur??R.Constants.SHIPPING_EUR;
    const valid=items.map(currentItemInfo).filter(x=>!x.missing&&x.currentPrice>0);
    let packs=0,sum=0,parts=[],rows=[];
    valid.forEach((x,i)=>{
      packs+=x.qty; const line=x.currentPrice*x.qty;sum+=line;parts.push(U.money(line));
      const p=x.p;
      const desc=[p.name,p.form,p.maker,`PZN ${p.pzn}`].filter(Boolean).join(', ');
      const math=x.qty>1?`${U.money(x.currentPrice)}€*${x.qty}pack= ${U.money(line)}€`:`${U.money(line)}€`;
      const expiryNote=R.OrderExpiry?.line(x.pzn)||'';
      rows.push(`${expiryNote?expiryNote+'\n\n':''}${valid.length>1?(i+1)+'.\n':''}${desc}...${math}`);
    });
    const total=sum+ship, rub=U.rubFinal(total,rate);
    let out='';
    if(parsed?.label)out+=parsed.label+'\n\n';
    out+=`дата:      [${new Intl.DateTimeFormat("ru-RU",{timeZone:"Europe/Moscow",day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date())}]\n`;
    out+=`€/₽:       [${rate.toFixed(2)}]\n`;

    out+=`позиций:   [${valid.length}]\n`;
    out+=`упаковок:  [${packs} pack]\n\n`;
    out+=rows.join('\n\n')+'\n\n';
    out+=`Тариф почты из Европы до 5кг...${U.money(ship)}€ (12-25 дней)\n\n`;
    out+=`${[U.money(ship),...parts].join('+')}=${U.money(total)}€\n`;
    out+=`${U.money(total)}€*${rate.toFixed(2)}=${U.money(rub)} ₽\n\n`;
    if(address.trim())out+=`АДРЕС ДОСТАВКИ:\n${address.trim()}\n\n`;
    out+=(publicLink(valid)?publicLink(valid)+"\n\n":"")+"RXDE · Сервис заказа из Германии\n"+(window.RXDE_CONFIG?.contactEmail||"med.zakaz.de@gmail.com");
    return out;
  }
  // Sensitive imported client details never enter persistent storage, URL or network payloads.
  // Only an explicit user click on 'Поделиться' copies this information to the OS clipboard.
  function privateShareText(){
    const cart=S.get().cart;
    if(!cart.length)return template(null,cart,'');
    const address=session.applied&&session.parsed?.items?.length?composeAddress():'';
    return template(null,cart,address);
  }
  A.importAddress=()=>session.applied&&session.parsed?.items?.length?composeAddress():'';
  A.cartShippingEur=()=>session.applied?(session.shippingEur??R.Constants.SHIPPING_EUR):R.Constants.SHIPPING_EUR;
  function clearPrivateClient(){
    session.parsed=null;session.applied=false;session.shippingEur=null;session.address='';session.addressParts={};session.useRawAddress=false;
    const ids=['adminSourceText','adminAddress','adminPreview','adminOriginalPreview'];
    ids.forEach(id=>{const n=$(id);if(n){if('value' in n)n.value='';else n.textContent='';}});
    const result=$('adminResultBlock');if(result)result.hidden=true;
  }
  function composeAddress(){
    if(session.useRawAddress)return String(session.address||'').trim();
    const a=session.addressParts||{};
    const postalCity=[a.postal,a.city].filter(Boolean).join(' ');
    return [a.recipient,a.street,a.unit,postalCity,a.region,a.country,a.phone].map(x=>String(x||'').trim()).filter(Boolean).join('\n');
  }
  function markChange(label,on=true){
    if(on)session.changes.add(label);else session.changes.delete(label);
    renderChangeLog();
  }
  function renderChangeLog(){
    const box=$('adminChangeLog');if(!box)return;
    box.innerHTML=session.changes.size?[...session.changes].map(x=>`<span>${U.escape(x)}</span>`).join(''):'Нет ручных изменений';
    box.classList.toggle('has-changes',session.changes.size>0);
  }
  function updateAdminPreview(){
    if(!session.parsed)return;
    const items=session.applied?S.get().cart:session.parsed.items;
    $('adminPreview').textContent=template(session.parsed,items,composeAddress());
  }
  function fillAddressFields(){
    const a=session.addressParts||{};
    const map={adminAddrRecipient:'recipient',adminAddrStreet:'street',adminAddrUnit:'unit',adminAddrPostal:'postal',adminAddrCity:'city',adminAddrRegion:'region',adminAddrCountry:'country',adminAddrPhone:'phone'};
    Object.entries(map).forEach(([id,key])=>{const n=$(id);if(n)n.value=a[key]||''});
    if($('adminAddressRawMode'))$('adminAddressRawMode').checked=!!session.useRawAddress;
    $('adminAddressGrid')?.classList.toggle('disabled',!!session.useRawAddress);
  }
  function renderParsed(){
    const p=session.parsed;if(!p)return;
    const info=p.items.map(currentItemInfo);
    $('adminClientLabel').textContent=p.inputMode==='pzn-list'?'Список PZN':(p.label||'—');
    $('adminOldDate').textContent=p.oldDate||'—';
    $('adminOldRate').textContent=p.oldRate?`${p.oldRate.toFixed(2)} ₽/€`:'—';
    const rate=effectiveRate();
    if($('adminRateInput'))$('adminRateInput').value=rate.toFixed(2);
    if($('adminRateStatus'))$('adminRateStatus').textContent=session.manualRate?`Ручной курс: ${rate.toFixed(2)} ₽/€`:`Авто · сейчас ${rate.toFixed(2)} ₽/€`;
    $('adminAddress').value=session.address||'';
    $('adminAddressConfidence').textContent=p.address.confidence;
    $('adminAddressConfidence').className=p.address.confidence.startsWith('точно')?'ok':'warn';
    fillAddressFields();

    const found=info.filter(x=>!x.missing).length;
    const missingCount=info.length-found;
    const packs=info.reduce((n,x)=>n+x.qty,0);
    if($('adminQuickOverview'))$('adminQuickOverview').textContent=`${info.length} поз. · ${packs} уп. · найдено ${found}${missingCount?' · отсутствует '+missingCount:''}`;
    const known=info.filter(x=>!x.missing&&x.currentPrice>0);
    const newTotalEur=known.reduce((sum,x)=>sum+x.currentPrice*x.qty,0)+(session.shippingEur??R.Constants.SHIPPING_EUR);
    const newTotalRub=U.rubFinal(newTotalEur,effectiveRate());
    const oldTotalText=p.oldTotal!=null?`${U.money(p.oldTotal)} ₽`:'не указана';
    const oldRateText=p.oldRate?`${p.oldRate.toFixed(2)} ₽/€`:'не указан';
    if($('adminOldSummary'))$('adminOldSummary').textContent=`Было при курсе ${oldRateText}: ${oldTotalText}`;
    if($('adminNewSummary'))$('adminNewSummary').textContent=`Стало при курсе ${effectiveRate().toFixed(2)} ₽/€: ${U.money(newTotalRub)} ₽`;
    if($('adminNewSummaryHint'))$('adminNewSummaryHint').hidden=!missingCount;

    if($('adminItemsSummary'))$('adminItemsSummary').textContent=`(${info.length})`;
    if($('adminSettingsSummary'))$('adminSettingsSummary').textContent=`· доставка ${U.money(session.shippingEur??R.Constants.SHIPPING_EUR)} €`;
    if($('adminShippingInput') && document.activeElement!==$('adminShippingInput'))$('adminShippingInput').value=String(session.shippingEur??R.Constants.SHIPPING_EUR);
    $('adminItems').innerHTML=info.length?info.map((x,i)=>{
      if(x.missing)return `<div class="admin-item missing"><b>${i+1}. PZN ${x.pzn}</b><span>нет в текущей базе</span><strong>×${x.qty}</strong></div>`;
      if(!session.basePrices.has(x.pzn))session.basePrices.set(x.pzn,x.p.eur);
      const base=session.basePrices.get(x.pzn);
      const changed=session.priceOverrides.has(x.pzn)||(x.oldPrice!==null&&Math.round(x.oldPrice)!==Math.round(x.currentPrice));
      return `<div class="admin-item admin-item-editable ${changed?'changed':''}" data-admin-row="${x.pzn}">
        <div><b>${i+1}. ${U.escape(x.p.name)}</b><span>${U.escape(x.p.form||'')} · ${U.escape(x.p.maker||'')} · PZN ${x.pzn}</span></div>
        <div class="admin-price-editor">
          ${x.oldPrice!==null?`<small>в старом чеке ${U.money(x.oldPrice)} €</small>`:''}
          <label><span>€ / уп.</span><input class="admin-number-input admin-price-input" data-admin-price="${x.pzn}" inputmode="decimal" value="${String(x.currentPrice).replace('.',',')}"></label>
          <button class="admin-mini-reset" data-admin-price-reset="${x.pzn}" type="button">↺ База ${U.money(base)} €</button>
        </div>
        <em>×${x.qty}</em>
      </div>`;
    }).join(''):'<div class="admin-empty">PZN в тексте не найдены.</div>';

    const missing=info.filter(x=>x.missing).map(x=>x.pzn);
    const missingBtn=$('adminCopyMissing');
    if(missingBtn){missingBtn.hidden=!missing.length;missingBtn.textContent=`Скопировать отсутствующие PZN (${missing.length})`}
    if($('adminMissingNote'))$('adminMissingNote').hidden=!missing.length;
    $('adminPreview').textContent=template(p,p.items,composeAddress());
    if($('adminOriginalPreview'))$('adminOriginalPreview').textContent=$('adminSourceText')?.value||'';
    renderChangeLog();
    $('adminResultBlock').hidden=false;
  }
  function applyCart(){
    const p=session.parsed;if(!p||!p.items.length){U.toast('Сначала разберите чек');return false}
    const items=p.items.filter(x=>P.byPzn.has(x.pzn)&&x.qty>0).map(x=>({pzn:x.pzn,qty:x.qty}));
    if(!items.length){U.toast('Ни один PZN не найден в каталоге. Корзина не изменена');return false}
    const previous=S.get().cart;
    const different=previous.length!==items.length||previous.some((x,i)=>x.pzn!==items[i]?.pzn||x.qty!==items[i]?.qty);
    if(previous.length&&different&&!window.confirm('Заменить текущую корзину импортированным заказом?\nНесохранённый состав текущей корзины будет заменён.'))return false;
    // Transfer the imported order to the SAME working cart used by the catalogue.
    // The address stays private in the admin session and is used by "Копировать".
    const addr=$('adminAddress');if(addr&&session.useRawAddress)session.address=addr.value.trim();
    session.applied=true;
    S.set({cart:items});Cart.save();R.OrderExpiry?.prune(items);
    $('adminPreview').textContent=template(p,items,composeAddress());
    R.UI.renderAll();
    U.beep(true);
    close();
    requestAnimationFrame(()=>{R.UI.openOrder();U.toast(`Готово: ${items.length} поз. · ${items.reduce((n,x)=>n+x.qty,0)} уп. — корзина открыта`)});
    return true;
  }
  async function copyTemplate(useCurrentCart=false){
    // Copy must never silently replace the working cart or discard post-import edits.
    const cart=S.get().cart;
    if(!cart.length && !session.parsed?.items?.length){U.toast('Заказ пуст');return}
    const addressEl=$('adminAddress');
    if(addressEl&&session.useRawAddress)session.address=addressEl.value.trim();
    const items=useCurrentCart?cart:(session.parsed?.items||cart);
    const text=template(useCurrentCart?null:session.parsed,items,composeAddress());
    const preview=$('adminPreview');
    if(preview)preview.textContent=text;
    try{await navigator.clipboard.writeText(text);U.beep(true);U.toast('Счёт клиенту скопирован')}
    catch(_){
      const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy');U.toast('Счёт клиенту скопирован')}catch(__){U.toast('Выделите текст вручную')}
      ta.remove();
    }
  }
  function open(){
    if(!session.unlocked)return;
    $('adminBackdrop').hidden=false;
    document.documentElement.classList.add('rxde-admin-modal-open');
    document.body.classList.add('rxde-admin-modal-open');
    const displayRate=effectiveRate();
    if($('adminRateInput'))$('adminRateInput').value=displayRate.toFixed(2);
    if($('adminRateStatus'))$('adminRateStatus').textContent=session.manualRate?`Ручной курс: ${displayRate.toFixed(2)} ₽/€`:`Авто · сейчас ${displayRate.toFixed(2)} ₽/€`;
    $('adminSourceText')?.focus({preventScroll:true});
  }
  function close(){
    const zoom=document.getElementById('rxdePreviewLightbox');
    if(zoom && !zoom.hidden)zoom.dispatchEvent(new CustomEvent('rxde-close-preview'));
    $('adminBackdrop').hidden=true;
    document.documentElement.classList.remove('rxde-admin-modal-open');
    document.body.classList.remove('rxde-admin-modal-open');
  }
  function unlock(){
    session.unlocked=true;
    try{localStorage.setItem('rxde:admin:trusted-browser:v2','yes')}catch(_){}
    $('searchInput').value='';S.set({query:''});R.UI.renderAll();open();
  }
  function maybeUnlock(value){
    const q=String(value||'').trim().toUpperCase();
    if(q==='ADMIN'||q==='АДМИН'){unlock();return true}
    return false;
  }
  // Parsing is a preview operation; it does NOT change the existing cart.
  function parseReceipt(){
      const raw=$('adminSourceText').value;
      if(!raw.trim()){U.toast('Вставьте старый чек');return false}
      if(session.parsed?.raw===cleanLines(raw))return true;
      session.parsed=parse(raw);session.applied=false;session.shippingEur=null;session.address=session.parsed.address.value||'';session.addressParts={...(session.parsed.address.parts||{})};session.useRawAddress=true;session.baseRate=S.get().rate;session.manualRate=null;session.priceOverrides.clear();session.basePrices.clear();session.changes.clear();['adminItemsDetails','adminSettingsDetails','adminPreviewDetails'].forEach(id=>{const el=$(id);if(el)el.open=false});renderParsed();
      if(session.parsed.items.length){
        U.toast(`Найдено ${session.parsed.items.length} поз. — проверьте сравнение и соберите корзину`);
      }else U.toast('PZN не найдены в тексте');
      return true;
    }
  async function paste(){
    const input=$('adminSourceText');if(!input)return;
    let value='';
    try{
      // Like the original editor: preserve readable text from copied HTML receipts.
      if(navigator.clipboard?.read){
        const items=await navigator.clipboard.read();
        for(const item of items){
          if(item.types.includes('text/html')){
            const html=await (await item.getType('text/html')).text();
            let plain='';
            if(item.types.includes('text/plain'))plain=await (await item.getType('text/plain')).text();
            value=(typeof decodeRichText==='function'?decodeRichText(html,plain):plain);
            if(!value.trim()&&html){const holder=document.createElement('div');holder.innerHTML=html;value=holder.innerText||holder.textContent||'';}
            if(value.trim())break;
          }else if(item.types.includes('text/plain')){
            value=await (await item.getType('text/plain')).text();
            if(value.trim())break;
          }
        }
      }
    }catch(_){/* Browser may allow readText even if read is blocked. */}
    if(!value.trim()){
      try{if(navigator.clipboard?.readText)value=await navigator.clipboard.readText()}catch(_){}
    }
    if(value.trim()){
      input.value=value;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.focus({preventScroll:true});
      parseReceipt();
    }else{
      input.focus({preventScroll:true});
      U.toast('Браузер не разрешил чтение буфера. Нажмите поле и вставьте текст через меню клавиатуры.');
    }
  }
  function init(){
    const rateSlot=$('adminRateSlot'),rateBox=$('adminRateBox');if(rateSlot&&rateBox)rateSlot.appendChild(rateBox);const inputBox=document.querySelector('#adminBackdrop .admin-input-block');if(inputBox&&rateBox){inputBox.insertBefore(rateBox,$('adminSourceText'));rateBox.style.margin='6px 0';}/* Preview tap-to-toggle is controlled by the single lightbox handler. */
    const search=$('searchInput');
    search?.addEventListener('keydown',e=>{
      if(e.key==='Enter'&&maybeUnlock(search.value)){e.preventDefault();e.stopPropagation()}
    });
    const rateStack=document.querySelector('.rate-stack');rateStack?.addEventListener('click',()=>{if(session.unlocked)open()});if(rateStack){rateStack.setAttribute('tabindex','0');rateStack.setAttribute('role','button');rateStack.addEventListener('keydown',e=>{if(session.unlocked&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open()}})}

    // Once ADMIN was entered, single click on the displayed exchange rate.
    // A single click on the desktop exchange-rate planner opens unlocked admin.
    const planner=document.querySelector('.rxde-pencil-planner');
    if(planner){
      planner.addEventListener('click',()=>{if(session.unlocked)open()});
      planner.addEventListener('keydown',e=>{if(session.unlocked&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open()}});
      planner.setAttribute('tabindex','0');planner.setAttribute('role','button');
    }
    document.querySelector('.mobile-rate-summary')?.addEventListener('click',()=>{if(session.unlocked)open()});
    const mobileRate=document.querySelector('.mobile-rate-summary');
    if(mobileRate){mobileRate.title='Администратор (после ввода ADMIN)';mobileRate.setAttribute('role','button');mobileRate.setAttribute('tabindex','0');mobileRate.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&session.unlocked){e.preventDefault();open()}})}

    $('closeAdmin').onclick=close;
    $('adminBackdrop').onclick=e=>{if(e.target===$('adminBackdrop'))close()};
    $('adminPaste').onclick=paste;
    $('adminPaste').textContent='Вставить и сравнить';
    $('adminParse').textContent='Собрать корзину';
    $('adminApply').textContent='Собрать корзину';
    // The button labelled "Собрать корзину" now actually builds and opens the cart.
    $('adminParse').onclick=()=>{if(parseReceipt())applyCart()};
    $('adminShippingInput')?.addEventListener('change',()=>{
      const input=$('adminShippingInput'),v=U.num(input.value);
      if(!Number.isFinite(v)||v<0||v>10000){U.toast('Проверьте тариф доставки');input.value=String(session.shippingEur??R.Constants.SHIPPING_EUR);return}
      session.shippingEur=v;[...session.changes].filter(x=>x.startsWith('Тариф доставки:')).forEach(x=>session.changes.delete(x));
      markChange(`Тариф доставки: ${U.money(v)} €`,v!==R.Constants.SHIPPING_EUR);
      if($('adminSettingsSummary'))$('adminSettingsSummary').textContent=`· доставка ${U.money(v)} €`;
      updateAdminPreview();if(session.applied)R.UI.renderAll();
    });
    $('adminShippingReset')?.addEventListener('click',()=>{
      session.shippingEur=null;$('adminShippingInput').value=String(R.Constants.SHIPPING_EUR);
      [...session.changes].filter(x=>x.startsWith('Тариф доставки:')).forEach(x=>session.changes.delete(x));renderChangeLog();
      if($('adminSettingsSummary'))$('adminSettingsSummary').textContent=`· доставка ${U.money(R.Constants.SHIPPING_EUR)} €`;
      updateAdminPreview();if(session.applied)R.UI.renderAll();
    });
    $('adminAddress').addEventListener('input',()=>{
      session.address=$('adminAddress').value;session.useRawAddress=true;
      markChange('Адрес исправлен вручную');
      updateAdminPreview();
    });
    $('adminAddressRawMode')?.addEventListener('change',()=>{
      session.useRawAddress=$('adminAddressRawMode').checked;
      $('adminAddressGrid')?.classList.toggle('disabled',session.useRawAddress);
      markChange(session.useRawAddress?'Адрес используется как есть':'Адрес разобран по полям');
      updateAdminPreview();
    });
    const addressMap={adminAddrRecipient:'recipient',adminAddrStreet:'street',adminAddrUnit:'unit',adminAddrPostal:'postal',adminAddrCity:'city',adminAddrRegion:'region',adminAddrCountry:'country',adminAddrPhone:'phone'};
    Object.entries(addressMap).forEach(([id,key])=>$(id)?.addEventListener('input',()=>{
      session.addressParts[key]=$(id).value;
      markChange('Адрес исправлен вручную');
      updateAdminPreview();
    }));
    $('adminRateInput')?.addEventListener('change',()=>{
      const v=U.num($('adminRateInput').value);
      if(!(v>0)){ $('adminRateInput').value=effectiveRate().toFixed(2);return }
      session.manualRate=v;S.set({rate:v});markChange(`Курс ${v.toFixed(2)} ₽/€`);R.UI.renderAll();renderParsed();
    });
    $('adminRateReset')?.addEventListener('click',()=>{
      const v=session.baseRate||S.get().rate;session.manualRate=null;S.set({rate:v});
      [...session.changes].filter(x=>x.startsWith('Курс ')).forEach(x=>session.changes.delete(x));
      R.UI.renderAll();renderParsed();
    });
    $('adminItems')?.addEventListener('change',e=>{
      const inp=e.target.closest('[data-admin-price]');if(!inp)return;
      const pzn=inp.dataset.adminPrice,p=P.byPzn.get(pzn),v=U.num(inp.value);if(!p||!(v>0)){renderParsed();return}
      if(!session.basePrices.has(pzn))session.basePrices.set(pzn,p.eur);
      session.priceOverrides.set(pzn,v);p.eur=v;markChange(`Цена PZN ${pzn}: ${U.money(v)} €`);R.UI.renderAll();renderParsed();
    });
    $('adminItems')?.addEventListener('click',e=>{
      const b=e.target.closest('[data-admin-price-reset]');if(!b)return;
      const pzn=b.dataset.adminPriceReset,p=P.byPzn.get(pzn),base=session.basePrices.get(pzn);if(!p||!(base>0))return;
      p.eur=base;session.priceOverrides.delete(pzn);[...session.changes].filter(x=>x.startsWith(`Цена PZN ${pzn}:`)).forEach(x=>session.changes.delete(x));R.UI.renderAll();renderParsed();
    });
    $('adminCopyMissing')?.addEventListener('click',async()=>{
      const missing=[...new Set((session.parsed?.items||[]).filter(x=>!P.byPzn.has(x.pzn)).map(x=>x.pzn))];
      if(!missing.length){U.toast('Все PZN найдены');return}
      const value=missing.join('\n');
      try{await navigator.clipboard.writeText(value);U.toast(`Скопировано ${missing.length} PZN — один номер на строку`)}
      catch(_){const ta=document.createElement('textarea');ta.value=value;document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();U.toast(ok?'Список PZN скопирован':'Не удалось скопировать: выделите номера вручную')}
    });
    $('adminApply').onclick=applyCart;
    $('adminCopyTemplate').onclick=()=>copyTemplate(!session.parsed?.items?.length || session.applied);
    const amount=$('orderHeaderTotal');
    if(amount){
      amount.title='Дважды нажмите, чтобы скопировать шаблон клиента';
      amount.addEventListener('dblclick',e=>{if(!session.unlocked)return;e.preventDefault();e.stopPropagation();copyTemplate(true)});
      let lastTap=0;
      amount.addEventListener('pointerup',e=>{
        if(!session.unlocked || e.pointerType==='mouse')return;
        const now=Date.now();if(now-lastTap<370){lastTap=0;e.preventDefault();e.stopPropagation();copyTemplate(true)}else lastTap=now;
      });
    }


    // The hidden admin shortcut works on every prominent order total, not only one header.
    ['desktopOrderTotal','quickOrderTotal','orderTotalRub'].forEach(id=>{
      const node=$(id);if(!node)return;
      node.title='В режиме ADMIN: дважды нажмите, чтобы скопировать счёт';
      node.addEventListener('dblclick',e=>{if(!session.unlocked)return;e.preventDefault();e.stopPropagation();copyTemplate(true)});
      let last=0;
      node.addEventListener('pointerup',e=>{if(!session.unlocked||e.pointerType==='mouse')return;const now=Date.now();if(now-last<370){last=0;e.preventDefault();e.stopPropagation();copyTemplate(true)}else last=now});
    });

    $('adminSourceText').addEventListener('paste',e=>{
      const html=(e.clipboardData||window.clipboardData)?.getData('text/html')||'';
      const plain=(e.clipboardData||window.clipboardData)?.getData('text/plain')||'';
      if(html){e.preventDefault();$('adminSourceText').value=htmlToText(html,plain)}
      setTimeout(parseReceipt,0);
    });
  }

  A.init=init;A.open=open;A.parse=parse;A.parseLoosePznList=parseLoosePznList;A.template=template;A.privateShareText=privateShareText;A.clearPrivateClient=clearPrivateClient;A.session=session;
})(window.RXDE);


(function(R){
  const startRXDEApp = ()=>{
    R.Cart.init();
    R.UI.init();
    R.RateGuard?.init();
    R.Admin?.init();
    const params=new URLSearchParams(location.search);
    const categoryFromLink=params.get('category');
    if(categoryFromLink && R.Products.all.some(p=>p.category===categoryFromLink)){
      R.Store.set({home:false,category:categoryFromLink,subcategory:params.get('subcategory')||'',query:'',mobileSearchScope:'category',limit:R.Constants.PAGE_SIZE,categoryLimit:20,expanded:new Set()});
      R.UI.renderAll();
    }
    const query=params.get('q');
    if(query){
      const input=document.getElementById('searchInput');
      if(input){input.value=query;input.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})),30)}
    }
    if(params.get('openOrder')==='1')setTimeout(()=>R.UI.openOrder(params.get('focus')||''),40);
    if(params.get('product'))setTimeout(()=>window.dispatchEvent(new PopStateEvent('popstate')),70);
    console.info(`RXDE NEXT V2.34 — ${R.Products.all.length} products loaded`);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startRXDEApp,{once:true});
  else startRXDEApp();
})(window.RXDE);



/* v0.54 — keep the semantic navigation immediately below the sticky header. */
(()=>{
  const root=document.documentElement;
  const header=document.getElementById('appHeader');
  if(!header)return;
  const sync=()=>root.style.setProperty('--rxde-app-header-h',`${Math.ceil(header.getBoundingClientRect().height)}px`);
  sync();
  window.addEventListener('resize',sync,{passive:true});
  window.addEventListener('orientationchange',sync,{passive:true});
  if('ResizeObserver' in window)new ResizeObserver(sync).observe(header);
  requestAnimationFrame(sync);
})();

/* V2.23 — row-anchored sticky package.
   One physical model on desktop and mobile:
   - at the top, the package belongs to the first catalogue row;
   - scrolling DOWN keeps it visible only while its current anchor row is still
     visible; once that row leaves the viewport, the package leaves too;
   - scrolling UP always reveals the package immediately and re-attaches it to
     the current top visible catalogue row;
   - after the anchored row leaves while moving down, the anchor resets to the
     catalogue's first row (the default home anchor);
   - stopping does not change state. No layout-height toggling is involved. */
(()=>{
  const search=()=>document.getElementById('searchInput');
  const suggest=()=>document.getElementById('searchSuggest');
  const list=()=>document.getElementById('productList');
  const searchActive=()=>{
    const s=search(), box=suggest();
    return !!(s && document.activeElement===s) || !!(box && !box.hidden);
  };

  const EPS=2;
  let lastY=window.scrollY||0;
  let state='visible';
  let anchorRow=null;
  let lastDir=0;
  let touchY=null;
  let expandingMore=false;
  let suppressScrollUntil=0;
  let loadMoreHeaderState='visible';

  const rows=()=>Array.from(list()?.querySelectorAll('.product-row')||[]);
  const firstRow=()=>rows()[0]||null;
  const rowVisible=row=>{
    if(!row || !row.isConnected)return false;
    const r=row.getBoundingClientRect();
    return r.bottom>0 && r.top<window.innerHeight;
  };
  const topVisibleRow=()=>{
    let best=null,bestTop=Infinity;
    for(const row of rows()){
      const r=row.getBoundingClientRect();
      if(r.bottom<=0 || r.top>=window.innerHeight)continue;
      /* Prefer the row intersecting the top edge; otherwise the nearest row
         below it. This is the user's active upper row. */
      const score=r.top<=0 ? Math.abs(r.top)*0.001 : r.top;
      if(score<bestTop){bestTop=score;best=row;}
    }
    return best;
  };
  const setVisible=visible=>{
    const mobile=window.matchMedia('(max-width:760px)').matches;
    if(mobile){
      // On mobile do not re-apply layout properties on every scroll tick.
      if(state===(visible?'visible':'hidden'))return;
      state=visible?'visible':'hidden';
      document.body.classList.toggle('mobile-header-scrolling',!visible);
      document.body.classList.toggle('mobile-header-hidden',!visible);
      document.body.classList.toggle('mobile-header-visible',visible);
      const stack=document.getElementById('stickyStack');
      if(stack){
        stack.classList.add('rxde-mobile-floating-header');
        stack.style.setProperty('transform',visible?'translate3d(0,0,0)':'translate3d(0,calc(-100% - 24px),0)','important');
        stack.style.setProperty('opacity',visible?'1':'0','important');
        stack.style.setProperty('visibility','visible','important');
        stack.style.setProperty('pointer-events',visible?'auto':'none','important');
        stack.style.setProperty('clip-path','none','important');
      }
      const head=document.getElementById('appHeader');
      if(head){head.style.removeProperty('top');head.style.removeProperty('visibility');head.style.removeProperty('opacity');}
      return;
    }
    state=visible?'visible':'hidden';
    document.body.classList.toggle('mobile-header-scrolling',!visible);
    document.body.classList.toggle('mobile-header-hidden',!visible);
    document.body.classList.toggle('mobile-header-visible',visible);
    const stack=document.getElementById('stickyStack');
    if(stack){
      stack.classList.remove('rxde-mobile-floating-header');
      stack.style.setProperty('transform',visible?'translate3d(0,0,0)':'translate3d(0,calc(-100% - 30px),0)','important');
      stack.style.setProperty('opacity',visible?'1':'0','important');
      stack.style.setProperty('visibility',visible?'visible':'hidden','important');
      stack.style.setProperty('pointer-events',visible?'auto':'none','important');
      stack.style.setProperty('clip-path',visible?'inset(0)':'inset(0 0 100% 0)','important');
    }
  };
  const attachCurrent=()=>{anchorRow=topVisibleRow()||firstRow();};
  const resetDefaultAnchor=()=>{anchorRow=firstRow();};

  const goUp=()=>{
    expandingMore=false;
    lastDir=-1;
    // Mobile: upward gestures must NOT summon the full header.
    // The original menu returns only at the actual top of the document.
    const mobile=document.documentElement.classList.contains('rxde-mobile-ui')
      || window.matchMedia('(max-width:760px)').matches;
    if(mobile){
      const atTop=(window.scrollY||0)<=4;
      if(atTop){resetDefaultAnchor();setVisible(true)}
      else if(state!=='hidden')setVisible(false);
      return;
    }
    attachCurrent();
    setVisible(true);
  };
  const goDown=()=>{
    expandingMore=false;
    lastDir=1;
    if(window.matchMedia('(max-width:760px)').matches){
      setVisible((window.scrollY||0)<=64 || searchActive());
      return;
    }
    if(searchActive()){
      attachCurrent();
      setVisible(true);
      return;
    }
    if(!anchorRow || !anchorRow.isConnected)resetDefaultAnchor();
    /* At the catalogue start the first row is the natural anchor. */
    if(rowVisible(anchorRow)){
      setVisible(true);
      return;
    }
    setVisible(false);
    resetDefaultAnchor();
  };
  const applyDirection=dir=>{
    if(dir<0)goUp();
    else if(dir>0)goDown();
  };

  /* The actual scroll delta is authoritative and works for mouse, touch,
     trackpads, scrollbar dragging and inertial scrolling. */
  window.addEventListener('scroll',()=>{
    const y=window.scrollY||0;
    const d=y-lastY;
    /* Load More re-renders the grid. Edge/Chromium may emit a synthetic
       scroll while preserving its anchor. That is layout maintenance, not
       user navigation, so it must never reveal the sticky package. */
    if(performance.now()<suppressScrollUntil){lastY=y;return;}
    if(Math.abs(d)>EPS)applyDirection(d>0?1:-1);
    lastY=y;
  },{passive:true});

  /* Input-direction hints make the package react at the start of a gesture,
     before the browser has necessarily produced its first scroll event. */
  window.addEventListener('wheel',e=>{
    if(Math.abs(e.deltaY)>1)applyDirection(e.deltaY>0?1:-1);
  },{passive:true});
  window.addEventListener('touchstart',e=>{touchY=e.touches?.[0]?.clientY??null},{passive:true});
  window.addEventListener('touchmove',e=>{
    const y=e.touches?.[0]?.clientY;
    if(y==null||touchY==null)return;
    const d=touchY-y;
    if(Math.abs(d)>3){applyDirection(d>0?1:-1);touchY=y;}
  },{passive:true});
  window.addEventListener('touchend',()=>{touchY=null},{passive:true});
  window.addEventListener('touchcancel',()=>{touchY=null},{passive:true});
  /* On mobile Edge/Chrome the visual viewport can move while the layout
     viewport barely changes (browser chrome / keyboard). Treat a visual
     viewport upward move as the same explicit request to reveal the menu. */
  let lastVVTop=window.visualViewport?.offsetTop||0;
  window.visualViewport?.addEventListener('scroll',()=>{
    const now=window.visualViewport?.offsetTop||0;
    const d=now-lastVVTop;
    if(Math.abs(d)>2)applyDirection(d>0?1:-1);
    lastVVTop=now;
  },{passive:true});
  window.addEventListener('keydown',e=>{
    if(['ArrowUp','PageUp','Home'].includes(e.key))goUp();
    else if(['ArrowDown','PageDown','End',' '].includes(e.key))goDown();
  });

  /* Search always owns the top package. */
  document.addEventListener('focusin',e=>{if(e.target===search()){attachCurrent();setVisible(true)}});

  /* 'Показать ещё' only expands the catalogue. It must never be interpreted
     as navigation back/up and must not reveal a hidden sticky package. */
  document.addEventListener('rxde:load-more',e=>{
    expandingMore=true;
    loadMoreHeaderState=state;
    suppressScrollUntil=performance.now()+650;
    /* Preserve the exact visible/hidden state. Clicking the button is not an
       upward scroll gesture and must never summon the header. */
    setVisible(loadMoreHeaderState==='visible');
    resetDefaultAnchor();
    lastY=Number(e.detail?.scrollY)||window.scrollY||0;
  });
  document.addEventListener('rxde:load-more-settled',e=>{
    suppressScrollUntil=performance.now()+220;
    lastY=Number(e.detail?.scrollY)||window.scrollY||0;
    setVisible(loadMoreHeaderState==='visible');
    resetDefaultAnchor();
    requestAnimationFrame(()=>{
      lastY=window.scrollY||0;
      expandingMore=false;
    });
  });

  let localControlHeaderState='visible';
  document.addEventListener('rxde:local-control',e=>{
    const phase=e.detail?.phase||'start';
    if(phase==='start'){
      localControlHeaderState=state;
      suppressScrollUntil=performance.now()+900;
      lastY=Number(e.detail?.scrollY)||window.scrollY||0;
      setVisible(localControlHeaderState==='visible');
    }else{
      suppressScrollUntil=performance.now()+260;
      lastY=window.scrollY||0;
      setVisible(localControlHeaderState==='visible');
    }
  });

  const reset=()=>{
    lastY=window.scrollY||0;
    resetDefaultAnchor();
    setVisible(true);
    lastDir=0;
  };
  document.addEventListener('DOMContentLoaded',()=>{
    reset();
    const box=suggest();
    if(box && document.documentElement.classList.contains('rxde-mobile-ui') && box.parentElement!==document.body)document.body.appendChild(box);
  },{once:true});
  window.addEventListener('pageshow',reset,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastY=window.scrollY||0}});

  /* Product list is re-rendered frequently by filters/search. Never keep a
     detached DOM node as the anchor. */
  const productList=list();
  if(productList && 'MutationObserver' in window){
    new MutationObserver(()=>{
      if(!anchorRow || !anchorRow.isConnected){
        /* Re-rendering / Load More may replace DOM rows. Repair only the
           anchor; never reveal the package because cards were appended. */
        anchorRow=state==='visible' && !expandingMore?(topVisibleRow()||firstRow()):firstRow();
      }
    }).observe(productList,{childList:true});
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-mobile-price-sort]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();
    const select=null;
    if(!select)return;
    const cur=['price-asc','price-desc'].includes(select.value)?select.value:'catalog';
    select.value=cur==='catalog'?'price-asc':cur==='price-asc'?'price-desc':'catalog';
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
})();

/* V2.32 — robust live-search overlay positioning.
   The existing query engine already understands swapped RU/EN keyboard layouts;
   this layer only guarantees that the suggestions remain visible above the UI. */
(()=>{
  const input=()=>document.getElementById('searchInput');
  const wrap=()=>document.getElementById('searchWrap');
  const box=()=>document.getElementById('searchSuggest');
  const isMobile=()=>window.matchMedia('(max-width:760px)').matches;

  function promoteAndPlace(){
    const s=input(),w=wrap(),b=box();
    if(!s||!w||!b)return;
    if(b.parentElement!==document.body)document.body.appendChild(b);
    const r=s.getBoundingClientRect();
    const gutter=isMobile()?8:12;
    const left=Math.max(gutter,Math.round(r.left));
    const width=Math.min(window.innerWidth-left-gutter,Math.round(r.width));
    document.documentElement.style.setProperty('--rxde-suggest-left',left+'px');
    document.documentElement.style.setProperty('--rxde-suggest-width',Math.max(220,width)+'px');
    document.documentElement.style.setProperty('--rxde-suggest-top',Math.max(6,Math.round(r.bottom+6))+'px');
  }

  function refresh(){
    promoteAndPlace();
    const s=input();
    if(s&&document.activeElement===s&&s.value.trim().length>=1){
      /* Nudge the existing debounced renderer after geometry/navigation changes. */
      s.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    promoteAndPlace();
    input()?.addEventListener('focus',()=>requestAnimationFrame(refresh));
    input()?.addEventListener('input',()=>requestAnimationFrame(promoteAndPlace));
  },{once:true});
  window.addEventListener('resize',()=>requestAnimationFrame(promoteAndPlace),{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(promoteAndPlace,80),{passive:true});
  window.addEventListener('scroll',()=>{
    if(isMobile() && document.activeElement===input())requestAnimationFrame(promoteAndPlace);
  },{passive:true});
})();

/* V2.34 — exact typeahead anchoring and category image reveal. */
(()=>{
  const input=()=>document.getElementById('searchInput');
  const box=()=>document.getElementById('searchSuggest');
  let raf=0;

  function placeTypeahead(){
    const s=input(),b=box();
    if(!s||!b)return;
    if(b.parentElement!==document.body)document.body.appendChild(b);
    const r=s.getBoundingClientRect();
    const vv=window.visualViewport;
    const viewportW=vv?.width||window.innerWidth;
    const viewportH=vv?.height||window.innerHeight;
    const mobile=window.matchMedia('(max-width:760px)').matches;
    const gutter=mobile?8:12;
    const top=Math.max(4,Math.round(r.bottom+6));
    if(mobile){
      /* Mobile suggestions are a viewport overlay, not a narrow copy of the
         search input. This keeps title, price and +/- readable with keyboard. */
      const left=gutter;
      const width=Math.max(260,Math.round(viewportW-gutter*2));
      const maxH=Math.max(150,Math.min(390,Math.round(viewportH-top-gutter)));
      b.style.setProperty('left',left+'px','important');
      b.style.setProperty('right','auto','important');
      b.style.setProperty('width',width+'px','important');
      b.style.setProperty('max-width',width+'px','important');
      b.style.setProperty('max-height',maxH+'px','important');
    }else{
      const left=Math.max(gutter,Math.round(r.left));
      const maxW=Math.max(220,Math.round(viewportW-left-gutter));
      const width=Math.min(Math.round(r.width),maxW);
      b.style.setProperty('left',left+'px','important');
      b.style.setProperty('right','auto','important');
      b.style.setProperty('width',width+'px','important');
      b.style.setProperty('max-width',width+'px','important');
      b.style.removeProperty('max-height');
    }
    b.style.setProperty('top',top+'px','important');
    b.style.setProperty('transform','none','important');
  }
  function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(placeTypeahead)}
  function loopWhileOpen(){
    const b=box();
    if(!b||b.hidden)return;
    placeTypeahead();
    raf=requestAnimationFrame(loopWhileOpen);
  }
  document.addEventListener('focusin',e=>{if(e.target===input()){schedule();requestAnimationFrame(loopWhileOpen)}});
  document.addEventListener('input',e=>{if(e.target===input()){schedule();requestAnimationFrame(loopWhileOpen)}},true);
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('scroll',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
  document.addEventListener('DOMContentLoaded',schedule,{once:true});

  const categoryImages={
    '':'assets/categories/medical.webp',
    'Витамины и минералы':'assets/categories/vitamins.webp',
    'Уход и косметика':'assets/categories/cosmetics.webp',
    'Пищеварение':'assets/categories/digestion.webp',
    'Боль, мышцы и суставы':'assets/categories/joints.webp',
    'Глаза':'assets/categories/eyes.webp',
    'Простуда и дыхание':'assets/categories/respiratory.webp',
    'Детские товары':'assets/categories/children.webp',
    'Волосы и кожа головы':'assets/categories/hair.webp',
    'Кожа и заживление':'assets/categories/skin.webp',
    'Товары для животных':'assets/categories/pets.webp',
    'Аллергия':'assets/categories/allergy.webp',
    'Уход за полостью рта':'assets/categories/mouth.webp'
  };
  Object.values(categoryImages).forEach(src=>{const im=new Image();im.decoding='async';im.src=src});

  let transitionSeq=0;
  function revealCategory(button,{initial=false}={}){
    const cat=button?.hasAttribute?.('data-category-clear')?'':(button?.dataset?.category||button?.dataset?.categoryName||'');
    const src=categoryImages[cat]||categoryImages[''];
    const label=((button?.textContent)||cat||'Все товары').trim();
    const shell=document.querySelector('.paper-shell')||document.body;
    const sr=shell.getBoundingClientRect();
    const sticky=document.getElementById('stickyStack');
    const top=Math.max(0,sticky?.getBoundingClientRect?.().bottom||0);
    const seq=++transitionSeq;
    document.querySelectorAll('.category-transition-overlay').forEach(n=>n.remove());
    const o=document.createElement('div');
    o.className='category-transition-overlay'+(initial?' initial':'');
    o.dataset.label=label;
    o.style.left=Math.max(0,Math.round(sr.left))+'px';
    o.style.width=Math.max(1,Math.round(sr.width))+'px';
    o.style.top=Math.round(top)+'px';
    o.style.bottom='0';
    o.style.backgroundImage=`url("${src}")`;
    const cuts=document.createElement('div');
    cuts.className='category-cut-lines';
    cuts.innerHTML='<span class="category-cut-sweep" aria-hidden="true"></span>';
    o.appendChild(cuts);
    document.body.appendChild(o);
    requestAnimationFrame(()=>{
      if(seq!==transitionSeq)return;
      o.classList.add('reveal');
      requestAnimationFrame(()=>o.classList.add('cut'));
    });
    setTimeout(()=>{if(seq===transitionSeq)o.classList.add('dissolve')},initial?1500:1280);
    setTimeout(()=>{if(o.isConnected)o.remove()},initial?2360:2080);
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('#categoryStrip [data-category],#categoryStrip [data-category-clear]');
    if(!b)return;
    revealCategory(b);
  },true);
  function startInitialCategoryReveal(){
    if(window.__rxdeInitialCategoryReveal)return;
    const starter=document.querySelector('#categoryStrip [data-category].active')
      || document.querySelector('#categoryStrip [data-category="Витамины и минералы"]')
      || document.querySelector('#categoryStrip [data-category]');
    if(!starter)return;
    window.__rxdeInitialCategoryReveal=true;
    revealCategory(starter,{initial:true});
  }
  if(document.readyState==='loading'){
    /* Fast-first v3.13.59: initial page is usable immediately; no entrance animation. */
  }else{
    /* Initial category animation suppressed for faster first interaction. */
  }

})();



/* V2.55 — universal hover hints for titles and the blue picked strip */
(()=>{
  if(window.__rxdeHoverHints48)return;
  window.__rxdeHoverHints48=true;
  const RX=window.RXDE||{};
  const U=RX.Utils||{},Cart=RX.Cart||{},Products=RX.Products||{},Store=RX.Store||{};
  const esc=v=>U.escape?U.escape(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>U.money?U.money(n):String(Math.round(Number(n)||0));
  let tip=null,active=null;
  const ensure=()=>{
    if(tip&&tip.isConnected)return tip;
    tip=document.createElement('div');tip.id='rxdeHoverHint';tip.setAttribute('role','tooltip');document.body.appendChild(tip);return tip;
  };
  const move=e=>{
    if(!tip||!tip.classList.contains('visible'))return;
    const pad=12,gap=14,r=tip.getBoundingClientRect();let x=(e?.clientX||0)+gap,y=(e?.clientY||0)+gap;
    if(x+r.width>innerWidth-pad)x=(e?.clientX||0)-r.width-gap;
    if(y+r.height>innerHeight-pad)y=(e?.clientY||0)-r.height-gap;
    tip.style.left=Math.max(pad,x)+'px';tip.style.top=Math.max(pad,y)+'px';
  };
  const show=(html,e,source,mode)=>{
    if(matchMedia('(hover:none),(pointer:coarse)').matches)return;
    const t=ensure();active=source;t.className='';t.id='rxdeHoverHint';t.dataset.mode=mode||'';t.innerHTML=html;t.classList.add('visible');move(e);
  };
  const hide=()=>{active=null;if(tip)tip.classList.remove('visible')};
  const titleName=b=>(b?.querySelector?.('.r2-title-text')?.textContent||b?.textContent||'').trim();
  const titleHint=(b,e)=>{
    const name=titleName(b);if(!name)return;
    show(`<span class="hint-title">${esc(name)}</span>`,e,b,'title');
  };
  const genericTitleHint=(b,e)=>{
    const name=(b.textContent||'').trim();if(!name)return;
    show(`<span class="hint-title">${esc(name)}</span>`,e,b,'title');
  };
  const pickedHint=(strip,e)=>{
    const pzn=(strip.dataset.cardPicked||'').trim();if(!pzn||!Cart.qty||Cart.qty(pzn)<=0)return;
    const row=strip.closest('article.r2-card');const p=Products.byPzn?Products.byPzn(pzn):null;const q=Cart.qty(pzn);
    const st=Store.get?Store.get():{};
    const lineRub=p&&U.rub?U.rub((Number(p.eur)||0)*q,st.rate):0;
    const totals=Cart.totals?Cart.totals():null;
    show(`<span class="hint-position"><small>Сумма по позиции</small><strong>${money(lineRub)} ₽</strong></span>`+
         `<span class="hint-overall"><small>Всего</small><strong>${totals?money(totals.rub):'—'} ₽</strong><b class="hint-list-badge" aria-hidden="true"><svg viewBox="0 0 18 18"><path d="M3 4h2M7 4h8M3 9h2M7 9h8M3 14h2M7 14h8"/></svg></b></span>`,e,strip,'picked');
  };
  const triggerFor=t=>t.closest?.('#productList .r2-title-open,#searchSuggest .suggest-title-open,#orderSheet .order-title-open,#productList [data-card-picked].selected');
  document.addEventListener('pointerover',e=>{
    const trigger=triggerFor(e.target);if(!trigger||trigger===active)return;hide();
    if(trigger.matches('#productList .r2-title-open'))return titleHint(trigger,e);
    if(trigger.matches('#productList [data-card-picked].selected'))return pickedHint(trigger,e);
    return genericTitleHint(trigger,e);
  },true);
  document.addEventListener('pointermove',e=>{if(active)move(e)},{passive:true});
  document.addEventListener('pointerout',e=>{if(!active)return;if(active.contains?.(e.relatedTarget))return;hide()},true);
  document.addEventListener('scroll',hide,true);window.addEventListener('blur',hide);
})();

/* V2.55 — fixed cart peek: never moves the page or the pointer target under +/- */
(()=>{
  if(window.__rxdeCartPeek48)return;window.__rxdeCartPeek48=true;
  const RX=window.RXDE||{},Cart=RX.Cart||{},U=RX.Utils||{};
  let node=null,timer=0;
  const visibleDock=()=>{
    const d=document.getElementById('desktopOrderDock');if(!d)return false;
    const r=d.getBoundingClientRect(),cs=getComputedStyle(d),stack=d.closest('#stickyStack');
    const ss=stack?getComputedStyle(stack):null;
    const stackVisible=!ss||(ss.display!=='none'&&ss.visibility!=='hidden'&&Number(ss.opacity||1)>.15);
    return stackVisible&&cs.display!=='none'&&cs.visibility!=='hidden'&&Number(cs.opacity||1)>.15&&r.width>20&&r.height>20&&r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;
  };
  const ensure=()=>{
    if(node&&node.isConnected)return node;
    node=document.createElement('button');node.id='rxdeTransientCartPeek';node.type='button';node.setAttribute('aria-label','Открыть общий список');
    node.innerHTML='<span class="peek-list-mark" aria-hidden="true"><svg viewBox="0 0 18 18"><path d="M3 4h2M7 4h8M3 9h2M7 9h8M3 14h2M7 14h8"/></svg></span><span class="peek-copy"><small></small><strong></strong></span>';
    document.body.appendChild(node);node.addEventListener('click',()=>{node.classList.remove('visible');RX.UI?.openOrder?.('',true)});return node;
  };
  window.RXDEShowCartPeek=(direction='up', duration=1900)=>{
    if(visibleDock())return;
    const t=Cart.totals?.();if(!t)return;const n=ensure();
    n.querySelector('small').textContent=`${t.positions} поз. · ${t.packs} уп.`;
    n.querySelector('strong').textContent=`${U.money?U.money(t.rub):t.rub} ₽`;
    n.classList.remove('pulse-up','pulse-down');void n.offsetWidth;n.classList.add('visible',direction==='down'?'pulse-down':'pulse-up');
    clearTimeout(timer);timer=setTimeout(()=>n.classList.remove('visible','pulse-up','pulse-down'),duration);
  };
})();


/* V2.60 — passive fixed category backdrop only. Header physics stays V2.23. */
(()=>{
  if(window.__rxdeBackdrop260)return;window.__rxdeBackdrop260=true;
  const $=s=>document.querySelector(s);let raf=0,ro=null;
  function install(){
    const shell=$('.paper-shell'),hero=$('#catalogHero'),list=$('#productList');if(!shell||!list)return;
    let backdrop=$('#rxdeCategoryBackdrop');
    if(!backdrop){backdrop=document.createElement('div');backdrop.id='rxdeCategoryBackdrop';backdrop.setAttribute('aria-hidden','true');shell.insertBefore(backdrop,shell.firstChild)}
    const measure=()=>{
      const sr=shell.getBoundingClientRect();
      const topNode=hero&&!hero.hidden?hero:list;
      const top=Math.max(0,Math.round(topNode.getBoundingClientRect().top));
      document.documentElement.style.setProperty('--rxde-paper-left-v260',Math.max(0,Math.round(sr.left))+'px');
      document.documentElement.style.setProperty('--rxde-paper-right-v260',Math.max(0,Math.round(innerWidth-sr.right))+'px');
      document.documentElement.style.setProperty('--rxde-backdrop-top-v260',top+'px');
    };
    const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(measure)};
    window.addEventListener('resize',schedule,{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(schedule,60),{passive:true});
    document.addEventListener('rxde:load-more-settled',schedule);
    if('ResizeObserver' in window){ro=new ResizeObserver(schedule);ro.observe(shell);if(hero)ro.observe(hero);ro.observe(list)}
    schedule();setTimeout(schedule,100);setTimeout(schedule,420);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();


/* V2.74 — lift category capsule to body and pin it independently of scroll direction. */
(()=>{
  if(window.__rxdeFloatingHero274)return;window.__rxdeFloatingHero274=true;
  const root=document.documentElement;
  let hero=null,placeholder=null,raf=0;
  const visibleStackBottom=()=>{
    const stack=document.getElementById('stickyStack');
    if(!stack)return 0;
    const cs=getComputedStyle(stack),r=stack.getBoundingClientRect();
    if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity||1)<.15||r.bottom<=0||r.top>=innerHeight)return 0;
    return Math.max(0,Math.min(innerHeight,r.bottom));
  };
  const measure=()=>{
    raf=0;
    const shell=document.querySelector('.paper-shell');
    if(shell){
      const r=shell.getBoundingClientRect();
      root.style.setProperty('--rxde-v274-paper-left',Math.max(0,Math.round(r.left))+'px');
      root.style.setProperty('--rxde-v274-paper-right',Math.max(0,Math.round(innerWidth-r.right))+'px');
    }
    const b=visibleStackBottom();
    root.style.setProperty('--rxde-v274-pill-top',(b>0?Math.max(4,Math.round(b-4)):4)+'px');
  };
  const schedule=()=>{if(!raf)raf=requestAnimationFrame(measure)};
  const lift=()=>{
    hero=document.getElementById('catalogHero');
    if(!hero)return;
    if(!placeholder){
      placeholder=document.createElement('div');
      placeholder.id='catalogHeroPlaceholder';
      placeholder.setAttribute('aria-hidden','true');
      hero.parentNode?.insertBefore(placeholder,hero);
    }
    if(hero.parentElement!==document.body)document.body.appendChild(hero);
    schedule();
  };
  const install=()=>{
    lift();
    addEventListener('scroll',schedule,{passive:true});
    addEventListener('resize',schedule,{passive:true});
    addEventListener('orientationchange',()=>setTimeout(schedule,80),{passive:true});
    const stack=document.getElementById('stickyStack');
    if(stack&&'MutationObserver'in window)new MutationObserver(schedule).observe(stack,{attributes:true,attributeFilter:['class','style']});
    if('ResizeObserver'in window){const ro=new ResizeObserver(schedule);const shell=document.querySelector('.paper-shell');if(shell)ro.observe(shell);if(stack)ro.observe(stack)}
    new MutationObserver(()=>{const h=document.getElementById('catalogHero');if(h&&h!==hero){hero=h;lift()}schedule()}).observe(document.body,{childList:true,subtree:true});
    setTimeout(schedule,80);setTimeout(schedule,350);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* V3.13.3: search backdrop belongs to the same stacking context as the sticky header. */
(()=>{
  const fix=()=>{
    if(!document.documentElement.classList.contains('rxde-mobile-ui'))return;
    const backdrop=document.getElementById('mobileSearchFocusBackdrop');
    const shell=document.querySelector('.paper-shell');
    if(backdrop&&shell&&backdrop.parentElement!==shell)shell.appendChild(backdrop);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{
    fix();new MutationObserver(fix).observe(document.body,{childList:true});
  },{once:true});
  else {fix();new MutationObserver(fix).observe(document.body,{childList:true});}
})();

// V3.13.126 — copy the same prepared receipt text without opening its preview.
document.addEventListener('click',async e=>{
 const btn=e.target.closest('#rxdeCopyReceiptInstant');if(!btn)return;
 e.preventDefault();e.stopPropagation();
 document.getElementById('viewOrderReceipt')?.click();
 const text=document.getElementById('rxdeReceiptPreviewText')?.textContent||'';
 document.getElementById('rxdeReceiptPreviewClose')?.click();
 if(!text)return;try{await navigator.clipboard.writeText(text);btn.title='Скопировано';}
 catch(_){const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();btn.title='Скопировано'}
 clearTimeout(btn._toastTimer);btn._toastTimer=setTimeout(()=>btn.title='Скопировать заказ',1800);
},true);


/* RXDE V2 — mobile browser Back exit confirmation.
   Uses one same-URL history guard; existing product Quick View entries remain above it.
   Only the user's explicit 'Выйти' action navigates past the guard. */
(()=>{
  'use strict';
  const KEY='__rxdeMobileExitGuard';
  const isMobile=()=>{
    try{return window.matchMedia('(max-width: 720px)').matches &&
      (window.matchMedia('(pointer: coarse)').matches || document.documentElement.classList.contains('rxde-mobile-ui'));}
    catch(_){return false;}
  };
  let dialog=null;
  let leaving=false;
  let ready=false;
  const hide=()=>{if(!dialog)return;dialog.hidden=true;document.body.classList.remove('rxde-mobile-exit-open')};
  const show=()=>{
    if(!dialog){
      dialog=document.createElement('div');
      dialog.id='rxdeMobileExitConfirm';
      dialog.hidden=true;
      dialog.innerHTML='<section class="rxde-mobile-exit-card" role="alertdialog" aria-modal="true" aria-labelledby="rxdeMobileExitTitle" aria-describedby="rxdeMobileExitDescription"><h2 id="rxdeMobileExitTitle">Покинуть RXDE?</h2><p id="rxdeMobileExitDescription">Корзина останется сохранённой.</p><div class="rxde-mobile-exit-actions"><button type="button" data-rxde-exit-stay>Остаться</button><button type="button" data-rxde-exit-leave>Выйти</button></div></section>';
      const css=document.createElement('style');
      css.textContent='#rxdeMobileExitConfirm:not([hidden]){position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(13,33,44,.55);padding:20px}#rxdeMobileExitConfirm .rxde-mobile-exit-card{box-sizing:border-box;width:min(100%,390px);border-radius:18px;background:#fff;color:#203543;padding:23px 20px 18px;box-shadow:0 18px 55px rgba(0,0,0,.24);font:inherit}#rxdeMobileExitConfirm h2{font-size:20px;margin:0 0 9px;font-weight:700}#rxdeMobileExitConfirm p{font-size:14px;line-height:1.5;margin:0 0 22px;color:#52636a}#rxdeMobileExitConfirm .rxde-mobile-exit-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}#rxdeMobileExitConfirm button{min-height:46px;border-radius:11px;border:1px solid #cbd8dd;font:inherit;font-size:15px;font-weight:650;background:#fff;color:#244659}#rxdeMobileExitConfirm [data-rxde-exit-stay]{background:#317da5;color:#fff;border-color:#317da5}';
      document.head.appendChild(css);
      document.body.appendChild(dialog);
      dialog.querySelector('[data-rxde-exit-stay]').addEventListener('click',hide);
      dialog.querySelector('[data-rxde-exit-leave]').addEventListener('click',()=>{
        leaving=true;hide();
        // Explicit user choice must leave on the first tap. History contains
        // variable numbers of same-page entries, so go(-2) is unreliable.
        let destination='about:blank';
        try {
          const previous=document.referrer && new URL(document.referrer);
          if(previous && /^https?:$/.test(previous.protocol) && previous.origin!==location.origin)
            destination=previous.href;
        } catch(_) {}
        location.replace(destination);
      });
      dialog.addEventListener('click',e=>{if(e.target===dialog)hide()});
    }
    dialog.hidden=false;
    document.body.classList.add('rxde-mobile-exit-open');
    dialog.querySelector('[data-rxde-exit-stay]')?.focus({preventScroll:true});
  };
  function arm(){
    if(!isMobile()||leaving)return;
    if(history.state?.[KEY])return;
    history.pushState({...history.state,[KEY]:true},'',window.__rxdeMobileExitLastUrl||location.href);
  }
  function onBack(e){
    if(!ready||!isMobile()||leaving)return;
    // Returning from an internal Quick View history entry to our guard
    // is a normal app navigation, not an attempt to exit the site.
    if(e.state?.[KEY])return;
    // Restore the guard before displaying UI or collapsing an overlay.
    arm();
    if(dialog && !dialog.hidden){hide();return;}
    if(!document.getElementById('orderBackdrop')?.hidden){document.getElementById('closeOrder')?.click();return;}
    if(!document.getElementById('questionBackdrop')?.hidden){document.getElementById('closeQuestion')?.click();return;}
    if(!document.getElementById('confirmBackdrop')?.hidden){document.getElementById('closeConfirm')?.click();return;}
    if(!document.getElementById('adminBackdrop')?.hidden){document.getElementById('closeAdmin')?.click();return;}
    if(!document.getElementById('productQuickBackdrop')?.hidden){document.getElementById('closeProductQuick')?.click();return;}
    show();
  }
  function init(){
    if(!isMobile())return;
    ready=true;
    window.__rxdeMobileExitLastUrl=location.href;
    arm();
    window.addEventListener('popstate',onBack);
    window.addEventListener('pageshow',()=>{if(!leaving)arm()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dialog&&!dialog.hidden){e.preventDefault();hide()}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();


/* RXDE v2 10.11.2026-03 — independent mobile header + reliable build stamp.
   The header never switches positioning on scroll. Its spacer occupies the
   original document slot; only GPU-composited transform/opacity are animated. */
(()=>{
  'use strict';
  const BUILD='v2 · 11.11.2026-17';
  const DETAILS='Компактное окно срока годности · доступные кнопки при клавиатуре · предыдущие исправления';
  window.RXDE_CLIENT_BUILD=BUILD;
  const style=document.createElement('style');
  style.id='rxde-v2-20261110-mobile-header';
  style.textContent=`
    @media(max-width:760px){
      html #stickyStack.sticky-stack,
      html.rxde-mobile-ui #stickyStack.sticky-stack,
      html.rxde-mobile-ui #stickyStack.rxde-mobile-floating-header.sticky-stack{
        position:fixed!important;top:0!important;left:0!important;right:0!important;
        width:100%!important;max-width:none!important;margin:0!important;
        z-index:2147481500!important;
        transition:transform .22s cubic-bezier(.2,.65,.24,1),opacity .22s ease!important;
        will-change:transform,opacity!important;
        clip-path:none!important;visibility:visible!important;
        contain:layout style!important;
      }
      html body.mobile-header-hidden #stickyStack.sticky-stack,
      html body.mobile-header-scrolling #stickyStack.sticky-stack{
        visibility:visible!important;clip-path:none!important;
        pointer-events:none!important;
      }
      html body.mobile-header-hidden #stickyStack.sticky-stack *,
      html body.mobile-header-scrolling #stickyStack.sticky-stack *{
        visibility:visible!important;
      }
      html #stickyStack > #appHeader,
      html.rxde-mobile-ui #stickyStack > #appHeader{
        position:relative!important;top:auto!important;left:auto!important;
        right:auto!important;transform:none!important;transition:none!important;
      }
      #rxdeMobileHeaderSpace{display:block!important;pointer-events:none!important;
        flex:none!important;overflow-anchor:none!important;}
      html .paper-shell > .workspace{padding-top:0!important;transition:none!important;}
    }
    @media(min-width:761px){#rxdeMobileHeaderSpace{display:none!important}}
  `;
  document.head.appendChild(style);
  const mobile=()=>matchMedia('(max-width:760px)').matches;
  const stamp=()=>{
    const el=document.getElementById('rxdeFooterVersion');
    if(!el)return;
    if(el.textContent!==BUILD)el.textContent=BUILD;
    el.title=DETAILS;
  };
  const init=()=>{
    const stack=document.getElementById('stickyStack');
    if(stack){
      let spacer=document.getElementById('rxdeMobileHeaderSpace');
      if(!spacer){spacer=document.createElement('div');spacer.id='rxdeMobileHeaderSpace';
        stack.parentElement.insertBefore(spacer,stack);}
      const measure=()=>{
        if(!mobile()){spacer.style.height='0px';return;}
        stack.classList.add('rxde-mobile-floating-header');
        // offsetHeight is transform-independent. Never change spacer during scrolling.
        spacer.style.height=Math.ceil(stack.offsetHeight)+'px';
      };
      measure();
      addEventListener('resize',measure,{passive:true});
      addEventListener('orientationchange',measure,{passive:true});
      if('ResizeObserver'in window)new ResizeObserver(()=>{if(mobile())measure()}).observe(stack);
    }
    stamp();
    const foot=document.getElementById('rxdeFooterVersion');
    if(foot)new MutationObserver(stamp).observe(foot,{characterData:true,childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* RXDE v2 11.11.2026-01 — empty search contact action */
(()=>{
  const style=document.createElement('style');
  style.id='rxde-empty-search-contact-style';
  style.textContent=`
    .rxde-empty-search{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:16px!important}
    .rxde-empty-contact{appearance:none;border:1px solid #bfd7df;background:#f5fafc;color:#285b71;
      border-radius:13px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer;min-height:42px}
    .rxde-empty-contact:hover,.rxde-empty-contact:focus-visible{background:#e9f4f8;border-color:#83b9cb}
  `;
  document.head.appendChild(style);
})();

/* RXDE v2 11.11.2026-02 — compact responsive expiry dialog. */
(()=>{
  'use strict';
  if(document.getElementById('rxde-expiry-sheet-v2'))return;
  const style=document.createElement('style');
  style.id='rxde-expiry-sheet-v2';
  style.textContent=`
    .rxde-expiry-modal-backdrop{
      position:fixed!important;z-index:2147483100!important;
      top:var(--rxde-vv-top,0px)!important;left:var(--rxde-vv-left,0px)!important;
      width:var(--rxde-vv-width,100%)!important;height:var(--rxde-vv-height,100dvh)!important;
      box-sizing:border-box!important;display:flex!important;align-items:center!important;
      justify-content:center!important;padding:12px!important;
      background:rgba(19,35,43,.52)!important;overflow:hidden!important;
    }
    .rxde-expiry-modal-panel{
      position:relative!important;box-sizing:border-box!important;
      width:min(100%,440px)!important;max-width:100%!important;
      max-height:100%!important;margin:0 auto!important;
      border-radius:20px!important;padding:18px 18px 14px!important;
      background:#fff!important;color:#29465a!important;
      box-shadow:0 16px 48px rgba(0,0,0,.25)!important;
      display:flex!important;flex-direction:column!important;gap:0!important;
      overflow:hidden!important;transform:none!important;
      font-family:inherit!important;
    }
    .rxde-expiry-modal-close{
      position:absolute!important;top:9px!important;right:10px!important;
      width:40px!important;height:40px!important;min-width:40px!important;
      display:grid!important;place-items:center!important;
      background:transparent!important;color:#66818f!important;
      border:0!important;border-radius:12px!important;cursor:pointer!important;
      font-size:28px!important;line-height:1!important;z-index:2!important;
    }
    .rxde-expiry-modal-panel .rxde-expiry-editor{
      display:flex!important;flex-direction:column!important;min-height:0!important;
      overflow:hidden!important;padding:0!important;margin:0!important;
      border:0!important;background:none!important;
    }
    .rxde-expiry-modal-panel .rxde-expiry-sheet-head{flex:0 0 auto!important;padding-right:38px!important;}
    .rxde-expiry-modal-panel .rxde-expiry-heading{
      margin:0 0 10px!important;padding:0!important;
      font-weight:700!important;font-size:22px!important;line-height:1.2!important;
      color:#28526a!important;text-align:left!important;
    }
    .rxde-expiry-modal-panel .rxde-expiry-sheet-content{
      flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;
      overscroll-behavior:contain!important;padding:0 2px 4px 0!important;
    }
    .rxde-expiry-modal-panel .rxde-expiry-explainer{
      margin:0 0 14px!important;font-size:14px!important;line-height:1.42!important;
      font-weight:400!important;color:#536771!important;text-align:left!important;
    }
    .rxde-expiry-modal-panel .rxde-expiry-months-row{
      display:flex!important;align-items:center!important;justify-content:center!important;
      gap:10px!important;margin:0!important;padding:0!important;
      font-size:16px!important;font-weight:500!important;white-space:nowrap!important;
    }
    .rxde-expiry-modal-panel input[data-expiry-months]{
      display:block!important;box-sizing:border-box!important;width:82px!important;height:48px!important;
      min-width:0!important;max-width:82px!important;margin:0!important;padding:7px!important;
      border:1px solid #a5bfca!important;border-radius:12px!important;
      background:#fff!important;color:#254c62!important;text-align:center!important;
      font:inherit!important;font-size:20px!important;
    }
    .rxde-expiry-modal-panel .rxde-expiry-date-preview{
      margin:10px 0 15px!important;padding:0!important;
      font-size:14px!important;line-height:1.4!important;text-align:center!important;
      color:#49697a!important;font-weight:400!important;
    }
    .rxde-expiry-modal-panel .rxde-expiry-date-preview strong{font-weight:700!important;}
    .rxde-expiry-modal-panel .rxde-item-comment-label{
      display:block!important;margin:0!important;padding:0!important;
      font-size:14px!important;font-weight:650!important;line-height:1.4!important;
      color:#34566a!important;text-align:left!important;
    }
    .rxde-expiry-modal-panel .rxde-item-comment-label small{font-size:12px!important;font-weight:400!important;color:#72848b!important;}
    .rxde-expiry-modal-panel textarea[data-expiry-comment]{
      display:block!important;box-sizing:border-box!important;width:100%!important;
      min-height:62px!important;height:62px!important;max-height:100px!important;
      margin:6px 0 0!important;padding:10px 12px!important;
      border:1px solid #bfced5!important;border-radius:12px!important;
      resize:vertical!important;background:white!important;color:#294b5d!important;
      font:inherit!important;font-size:14px!important;line-height:1.4!important;
    }
    .rxde-expiry-modal-panel .rxde-expiry-sheet-actions{
      display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important;
      flex:0 0 auto!important;margin:12px 0 0!important;padding:0!important;
      background:#fff!important;
    }
    .rxde-expiry-modal-panel .rxde-expiry-sheet-actions button{
      box-sizing:border-box!important;min-height:46px!important;margin:0!important;
      border:1px solid #b5cbd5!important;border-radius:11px!important;
      padding:9px 10px!important;background:#fff!important;color:#2e566b!important;
      font:inherit!important;font-size:15px!important;font-weight:650!important;
      cursor:pointer!important;
    }
    .rxde-expiry-modal-panel .rxde-expiry-sheet-actions [data-expiry-save]{
      background:#327a9b!important;border-color:#327a9b!important;color:#fff!important;
    }
    .rxde-expiry-modal-panel .rxde-expiry-remove{
      display:block!important;flex:0 0 auto!important;margin:8px auto 0!important;
      padding:5px 10px!important;min-height:24px!important;
      border:0!important;background:transparent!important;color:#697e86!important;
      font:inherit!important;font-size:12px!important;text-decoration:underline!important;
      cursor:pointer!important;
    }
    @media(max-width:760px){
      .rxde-expiry-modal-backdrop{padding:10px!important;}
      .rxde-expiry-modal-panel{width:min(100%,400px)!important;border-radius:17px!important;padding:16px 15px 12px!important;}
      .rxde-expiry-modal-panel .rxde-expiry-heading{font-size:20px!important;margin-bottom:8px!important;}
      .rxde-expiry-modal-panel .rxde-expiry-explainer{font-size:13px!important;margin-bottom:10px!important;}
      .rxde-expiry-modal-panel .rxde-expiry-date-preview{margin:8px 0 12px!important;}
      .rxde-expiry-modal-panel textarea[data-expiry-comment]{height:56px!important;min-height:56px!important;}
      .rxde-expiry-modal-panel .rxde-expiry-sheet-actions{margin-top:10px!important;}
    }
    @media(max-height:470px){
      .rxde-expiry-modal-panel{padding-top:9px!important;padding-bottom:8px!important;}
      .rxde-expiry-modal-panel .rxde-expiry-heading{font-size:18px!important;margin-bottom:4px!important;}
      .rxde-expiry-modal-panel .rxde-expiry-explainer{margin-bottom:5px!important;}
      .rxde-expiry-modal-panel .rxde-expiry-date-preview{margin:4px 0 6px!important;}
      .rxde-expiry-modal-panel .rxde-expiry-sheet-actions{margin-top:6px!important;}
    }
  `;
  document.head.appendChild(style);
})();

/* RXDE v2 11.11.2026-03 — one visible way back to the catalogue. */
(function(){
  const style=document.createElement('style');
  style.id='rxde-hide-duplicate-add-order';
  style.textContent='#addOrderProduct{display:none!important}';
  document.head.appendChild(style);
})();
