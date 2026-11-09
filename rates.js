(function(){
  window.RXDE_RATES = {
    source: 'GOOGLE',
    currency: 'EUR',
    cbrRate: 100.5700,
    effectiveDate: '2026-09-05',
    fetchedAt: '2026-09-05T22:40:00+03:00',
    stale: false
  };

  // RXDE: reuse a recently verified Google rate immediately across page openings.
  // Do not treat the legacy embedded 2026-09-05 snapshot as a fresh rate.
  try {
    const saved=JSON.parse(localStorage.getItem('rxde:rate:verified:v1')||'null');
    const age=Date.now()-Number(saved?.savedAt||0);
    if(saved && saved.source==='GOOGLE' && Number.isFinite(Number(saved.cbrRate)) &&
       Number(saved.cbrRate)>20 && Number(saved.cbrRate)<300 && age>=0 && age<7*24*60*60*1000){
      window.RXDE_RATES={source:'GOOGLE',currency:'EUR',cbrRate:Number(saved.cbrRate),
        effectiveDate:String(saved.effectiveDate||''),fetchedAt:String(saved.fetchedAt||''),stale:age>60*60*1000,
        verifiedCache:true,verifiedCacheAge:age};
    }
  } catch (_) { /* local storage can be unavailable in private browsing */ }
})();
