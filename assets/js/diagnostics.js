// Finora — diagnostics and lightweight local error log
const FINORA_LOG_KEY='finora_diagnostics_log_v1';
const FINORA_LAST_SYNC_KEY='finora_last_sync_at';
const FINORA_LAST_LOAD_KEY='finora_last_cloud_load_at';
const FINORA_MAX_LOGS=20;

function finoraReadLogs(){
  try{return JSON.parse(localStorage.getItem(FINORA_LOG_KEY)||'[]')}catch{return []}
}
function finoraWriteLogs(logs){
  try{localStorage.setItem(FINORA_LOG_KEY,JSON.stringify(logs.slice(0,FINORA_MAX_LOGS)))}catch{}
}
function finoraLog(level,message,detail){
  try{
    const logs=finoraReadLogs();
    logs.unshift({
      at:new Date().toISOString(),
      level:String(level||'info'),
      message:String(message||''),
      detail:detail==null?'':String(detail).slice(0,500)
    });
    finoraWriteLogs(logs);
  }catch{}
}
window.addEventListener('error',e=>{
  finoraLog('error',e.message||'Errore JavaScript',`${e.filename||''}:${e.lineno||''}:${e.colno||''}`);
});
window.addEventListener('unhandledrejection',e=>{
  const reason=e.reason;
  finoraLog('error','Promise non gestita',reason?.message||String(reason||''));
});

async function getFinoraDiagnostics(){
  let registration=null;
  let sessionState='non disponibile';
  try{
    if('serviceWorker' in navigator)registration=await navigator.serviceWorker.getRegistration();
  }catch{}
  try{
    if(typeof sb!=='undefined'&&sb){
      const {data}=await sb.auth.getSession();
      sessionState=data?.session?.user?'attiva':'assente';
    }
  }catch{
    sessionState='errore';
  }
  const standalone=window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true;
  const controller=!!navigator.serviceWorker?.controller;
  const swState=registration?.waiting?'aggiornamento in attesa':
    registration?.installing?'installazione':
    registration?.active?.state||'non registrato';

  return {
    version:window.Finora?.meta?.version||'sconosciuta',
    online:navigator.onLine,
    standalone:!!standalone,
    theme:document.documentElement.classList.contains('light')?'light':'dark',
    session:sessionState,
    user:typeof user!=='undefined'&&user?.id?'autenticato':'non autenticato',
    queue:typeof getTxQueue==='function'?getTxQueue().length:0,
    lastSync:localStorage.getItem(FINORA_LAST_SYNC_KEY)||'mai',
    lastCloudLoad:localStorage.getItem(FINORA_LAST_LOAD_KEY)||'mai',
    serviceWorker:{controller,state:swState,updateWaiting:!!registration?.waiting},
    url:location.href,
    userAgent:navigator.userAgent,
    logs:finoraReadLogs()
  };
}
function formatDiagnosticDate(value){
  if(!value||value==='mai')return 'Mai';
  try{return new Date(value).toLocaleString('it-IT')}catch{return value}
}
async function renderDiagnostics(){
  const data=await getFinoraDiagnostics();
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  set('diag-version',data.version);
  set('diag-network',data.online?'Online':'Offline');
  set('diag-session',data.session);
  set('diag-user',data.user);
  set('diag-queue',String(data.queue));
  set('diag-last-sync',formatDiagnosticDate(data.lastSync));
  set('diag-last-load',formatDiagnosticDate(data.lastCloudLoad));
  set('diag-sw',data.serviceWorker.state);
  set('diag-pwa',data.standalone?'Installata / standalone':'Browser');
  set('diag-theme',data.theme);
  const logs=document.getElementById('diag-logs');
  if(logs){
    if(!data.logs.length){
      logs.innerHTML='<div class="text-xs text-slate-500 text-center py-3">Nessun errore locale registrato.</div>';
    }else{
      logs.innerHTML=data.logs.slice(0,8).map(x=>`
        <div class="diagnostic-log-row">
          <div class="flex justify-between gap-3">
            <span class="font-bold ${x.level==='error'?'text-rose-500':'text-amber-500'}">${esc(x.level.toUpperCase())}</span>
            <span class="text-[10px] text-slate-500">${esc(new Date(x.at).toLocaleString('it-IT'))}</span>
          </div>
          <div class="mt-1">${esc(x.message)}</div>
          ${x.detail?`<div class="text-[10px] text-slate-500 mt-1 break-all">${esc(x.detail)}</div>`:''}
        </div>`).join('');
    }
  }
  return data;
}
async function openDiagnostics(){
  await renderDiagnostics();
  openModal('diagnostics-modal');
}
async function copyDiagnostics(){
  const d=await getFinoraDiagnostics();
  const text=[
    `Finora ${d.version}`,
    `online=${d.online}`,
    `pwa=${d.standalone}`,
    `theme=${d.theme}`,
    `session=${d.session}`,
    `user=${d.user}`,
    `queue=${d.queue}`,
    `lastSync=${d.lastSync}`,
    `lastCloudLoad=${d.lastCloudLoad}`,
    `serviceWorker=${d.serviceWorker.state}`,
    `controller=${d.serviceWorker.controller}`,
    `url=${d.url}`,
    `userAgent=${d.userAgent}`,
    '',
    'Ultimi log:',
    ...d.logs.slice(0,8).map(x=>`${x.at} [${x.level}] ${x.message}${x.detail?' | '+x.detail:''}`)
  ].join('\n');
  try{
    await navigator.clipboard.writeText(text);
    premiumToast('Diagnostica copiata');
  }catch{
    toast('Non riesco a copiare automaticamente la diagnostica.');
  }
}
async function clearDiagnostics(){
  localStorage.removeItem(FINORA_LOG_KEY);
  await renderDiagnostics();
  premiumToast('Log diagnostici cancellati');
}
