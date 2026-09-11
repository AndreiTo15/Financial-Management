// Finora — offline transaction queue and sync state
const FINORA_QUEUE_KEY='finora_offline_tx_queue_v1';
let finoraNotifications=[];

function getTxQueue(){try{return JSON.parse(localStorage.getItem(FINORA_QUEUE_KEY)||'[]')}catch{return []}}
function setTxQueue(q){localStorage.setItem(FINORA_QUEUE_KEY,JSON.stringify(q));updateNetworkStatus()}
function queueTxOperation(op){const q=getTxQueue();q.push({...op,queued_at:new Date().toISOString()});setTxQueue(q);premiumToast('Salvato offline: sincronizzerò appena torna la rete','info')}
async function flushTxQueue(){
  if(!navigator.onLine||!user)return;
  const q=getTxQueue();if(!q.length){updateNetworkStatus();return}
  updateNetworkStatus('syncing');
  const remaining=[];
  for(const op of q){
    try{
      let res;
      if(op.action==='insert')res=await sb.from('transactions').insert(op.row);
      else if(op.action==='update')res=await sb.from('transactions').update(op.row).eq('id',op.id).eq('user_id',user.id);
      else if(op.action==='delete')res=await sb.from('transactions').delete().eq('id',op.id).eq('user_id',user.id);
      if(res?.error)throw res.error;
    }catch(e){remaining.push(op)}
  }
  setTxQueue(remaining);
  updateNetworkStatus();
  if(!remaining.length){
    localStorage.setItem(FINORA_LAST_SYNC_KEY,new Date().toISOString());
    premiumToast('Sincronizzazione completata');
    try{await loadAll()}catch{}
  }
}
function updateNetworkStatus(force){
  const online=navigator.onLine,queued=getTxQueue().length;
  const mode=force==='syncing'?'syncing':!online?'offline':queued?'pending':'online';
  const map={online:['Online','text-emerald-400'],offline:['Offline','text-amber-400'],pending:[`${queued} da sincronizzare`,'text-amber-400'],syncing:['Sincronizzazione…','text-cyan-400']};
  const [label,color]=map[mode];
  ['sync-status','settings-network-status'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.className=`status-pill ${color}`+(id==='sync-status'?' hidden sm:inline-flex':'');
    const span=el.querySelector('span:last-child');if(span)span.textContent=label;
  });
}
window.addEventListener('online',()=>{updateNetworkStatus();flushTxQueue()});
window.addEventListener('offline',updateNetworkStatus);

