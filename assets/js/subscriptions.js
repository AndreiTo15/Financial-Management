// Finora — subscriptions
function renderSubscriptions(){
  const active=subscriptions.filter(s=>s.active);
  const paused=subscriptions.filter(s=>!s.active);
  const total=active.reduce((sum,s)=>sum+Number(s.amount||0),0);

  const monthly=document.getElementById('subscriptions-monthly-total');
  const activeCount=document.getElementById('subscriptions-active-count');
  const pausedCount=document.getElementById('subscriptions-paused-count');
  const moreActive=document.getElementById('more-sub-active');
  const moreTotal=document.getElementById('more-sub-total');

  if(monthly) monthly.textContent=fmt(total);
  if(activeCount) activeCount.textContent=active.length;
  if(pausedCount) pausedCount.textContent=paused.length;
  if(moreActive) moreActive.textContent=active.length;
  if(moreTotal) moreTotal.textContent=fmt(total);

  const box=document.getElementById('subscriptions-list');
  if(!box) return;

  box.innerHTML=subscriptions.map(s=>{
    const c=catByName(s.category);
    return `<div class="p-3 bg-slate-900/50 rounded-xl flex justify-between items-center gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${c.color}22;color:${c.color}">
          <i class="fa-solid ${c.icon}"></i>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold truncate">${esc(s.name)}</p>
          <p class="text-[10px] text-slate-500">${fmt(s.amount)} · giorno ${s.charge_day} · #${esc(s.category)}</p>
        </div>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <button data-action="toggle-subscription" data-id="${s.id}" data-active="${!s.active}" class="px-2 py-1 rounded-lg text-[10px] ${s.active?'bg-emerald-500/10 text-emerald-400':'bg-slate-800 text-slate-400'}">${s.active?'Attivo':'Pausa'}</button>
        <button data-action="edit-subscription" data-id="${s.id}" class="p-2 text-slate-500 hover:text-emerald-400"><i class="fa-solid fa-pen"></i></button>
        <button data-action="delete-subscription" data-id="${s.id}" class="p-2 text-rose-400"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }).join('')||'<p class="text-xs text-slate-500">Nessun abbonamento.</p>'
}
function openSubscriptionModal(s=null){document.getElementById('sub-id').value=s?.id||'';renderSelects();document.getElementById('sub-name').value=s?.name||'';document.getElementById('sub-amount').value=s?.amount||'';document.getElementById('sub-category').value=s?.category||'';document.getElementById('sub-day').value=s?.charge_day||1;document.getElementById('sub-active').checked=s?.active??true;openModal('subscription-modal')}
function editSubscription(id){openSubscriptionModal(subscriptions.find(x=>x.id===id))}
async function saveSubscription(e){
  e.preventDefault();
  const id=document.getElementById('sub-id').value;
  const row={user_id:user.id,name:document.getElementById('sub-name').value.trim(),amount:Number(document.getElementById('sub-amount').value),category:document.getElementById('sub-category').value,charge_day:Number(document.getElementById('sub-day').value),active:document.getElementById('sub-active').checked};

  if(id){
    const i=subscriptions.findIndex(s=>s.id===id);if(i===-1)return;
    const previous={...subscriptions[i]};subscriptions[i]={...subscriptions[i],...row};subscriptions.sort((a,b)=>a.name.localeCompare(b.name));
    closeModal('subscription-modal');commitUI();
    const {data,error}=await sb.from('subscriptions').update(row).eq('id',id).eq('user_id',user.id).select().single();
    if(error){const x=subscriptions.findIndex(s=>s.id===id);if(x!==-1)subscriptions[x]=previous;commitUI();toast(friendly(error));return;}
    const x=subscriptions.findIndex(s=>s.id===id);if(x!==-1)subscriptions[x]=data;saveCache();renderAll();toast('Abbonamento salvato');return;
  }

  const optimistic={...row,id:tempId('sub'),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  subscriptions.push(optimistic);subscriptions.sort((a,b)=>a.name.localeCompare(b.name));closeModal('subscription-modal');commitUI();
  const {data,error}=await sb.from('subscriptions').insert(row).select().single();
  if(error){subscriptions=subscriptions.filter(s=>s.id!==optimistic.id);commitUI();toast(friendly(error));return;}
  const i=subscriptions.findIndex(s=>s.id===optimistic.id);if(i!==-1)subscriptions[i]=data;subscriptions.sort((a,b)=>a.name.localeCompare(b.name));saveCache();renderAll();toast('Abbonamento salvato');
}
async function toggleSubscription(id,active){
  const old=subscriptions.map(s=>({...s}));
  const s=subscriptions.find(x=>x.id===id);if(s)s.active=active;
  commitUI();
  const{error}=await sb.from('subscriptions').update({active}).eq('id',id).eq('user_id',user.id);
  if(error){subscriptions=old;saveCache();renderAll();toast(friendly(error));}
}
function deleteSubscription(id){
  confirmAction('Eliminare abbonamento?','Le spese già registrate resteranno nello storico.',async()=>{
    const previous=[...subscriptions];subscriptions=subscriptions.filter(s=>s.id!==id);commitUI();
    const {error}=await sb.from('subscriptions').delete().eq('id',id).eq('user_id',user.id);
    if(error){subscriptions=previous;commitUI();toast(friendly(error));return;}
    toast('Abbonamento eliminato');
  })
}
function renderSubscriptionAlert(){
  const d=new Date().getDate();const upcoming=subscriptions.filter(s=>s.active&&s.charge_day>=d&&s.charge_day<=d+3);const el=document.getElementById('subscription-alert');
  if(upcoming.length){el.classList.remove('hidden');el.innerHTML=`<i class="fa-solid fa-bell mr-1"></i> ${upcoming.length} abbonament${upcoming.length===1?'o':'i'} in addebito nei prossimi 3 giorni.`}else el.classList.add('hidden')
}

