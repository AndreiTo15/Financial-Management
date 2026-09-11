// Finora — PWA registration and controlled app updates
let finoraSWRegistration=null;
let finoraRefreshing=false;
let finoraUpdateDismissed=false;

function showPWAUpdateBanner(){
  if(finoraUpdateDismissed)return;
  document.getElementById('pwa-update-banner')?.classList.remove('hidden');
}
function hidePWAUpdateBanner(){
  document.getElementById('pwa-update-banner')?.classList.add('hidden');
}
function dismissPWAUpdate(){
  finoraUpdateDismissed=true;
  hidePWAUpdateBanner();
}
async function checkPWAUpdate(manual=false){
  if(!('serviceWorker' in navigator))return;
  try{
    const reg=finoraSWRegistration||await navigator.serviceWorker.getRegistration();
    if(!reg){
      if(manual)premiumToast('Service worker non ancora registrato','info');
      return;
    }
    finoraSWRegistration=reg;
    await reg.update();
    if(reg.waiting&&navigator.serviceWorker.controller){
      showPWAUpdateBanner();
      if(manual)premiumToast('Nuova versione disponibile','info');
    }else if(manual){
      premiumToast('Finora è aggiornata');
    }
  }catch(e){
    if(typeof finoraLog==='function')finoraLog('warn','Controllo aggiornamenti PWA fallito',e?.message||e);
    if(manual)toast('Controllo aggiornamenti non riuscito.');
  }
}
function applyPWAUpdate(){
  const worker=finoraSWRegistration?.waiting;
  if(!worker){
    checkPWAUpdate(true);
    return;
  }
  worker.postMessage({type:'SKIP_WAITING'});
}
function watchPWARegistration(reg){
  finoraSWRegistration=reg;
  if(reg.waiting&&navigator.serviceWorker.controller)showPWAUpdateBanner();
  reg.addEventListener('updatefound',()=>{
    const worker=reg.installing;
    if(!worker)return;
    worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'&&navigator.serviceWorker.controller){
        if(typeof finoraLog==='function')finoraLog('info','Nuova versione PWA pronta');
        showPWAUpdateBanner();
      }
    });
  });
}
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(finoraRefreshing)return;
    finoraRefreshing=true;
    location.reload();
  });
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./service-worker.js?v=1.0.0-beta.6');
      watchPWARegistration(reg);
      setTimeout(()=>checkPWAUpdate(false),2500);
    }catch(err){
      console.warn('Service Worker:',err);
      if(typeof finoraLog==='function')finoraLog('error','Registrazione service worker fallita',err?.message||err);
    }
  });
  setInterval(()=>checkPWAUpdate(false),30*60*1000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')setTimeout(()=>checkPWAUpdate(false),1200);
  });
}
