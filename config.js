(function(){
  window.RXDE_CONFIG = Object.assign({
    rateMarkupRub: 10,
    shippingEur: 50,
    googleOrdersWebAppUrl: 'https://script.google.com/macros/s/AKfycbwPFPuVjA7lY7S2EVYt4YVd8yhTLtlpNQdWRapmGcR1AC1k3iHF3kTe2sgBJt0ogqvLDw/exec', // вставить URL развернутого Apps Script /exec
    fallbackCbrRate: 100.2998,
    publicBaseUrl: 'https://rxde.online/', // CHANGE DOMAIN HERE; '' hides link in receipts
    contactEmail: 'med.zakaz.de@gmail.com',
    buildVersion: 'V3.13.154',
    dbVersion: 'b260905',
    googleRateSpreadsheetId: '1PIme36xuunoQiqQlSbpnlDiBqMgBvWXfUnzV1Anlauw',
    googleRateSheet: 'settings_1',
    googleRateCell: 'C2',
    googleRateRefreshMs: 21600000
  }, window.RXDE_CONFIG || {});
})();