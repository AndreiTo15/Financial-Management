// Finora — budgets
function renderBudgets(){
  const m=document.getElementById('budget-month').value||isoMonth();document.getElementById('budget-month').value=m;
  const list=budgets.filter(b=>b.month.slice(0,7)===m);document.getElementById('budgets-list').innerHTML=list.map(b=>budgetCard(b,true)).join('')||'<div class="empty-state"><i class="fa-solid fa-gauge-high text-2xl text-slate-600"></i><p class="text-sm font-bold text-slate-300 mt-3">Nessun budget per questo mese</p><p class="text-xs text-slate-500 mt-1">Imposta un limite per capire subito quando una categoria sta crescendo troppo.</p><button onclick="openBudgetModal()" class="mt-4 px-4 py-2 rounded-xl bg-brand-600 text-xs font-bold">Crea budget</button></div>'
}
function budgetCard(b,actions){
  const spent=transactions.filter(t=>t.type==='EXPENSE'&&t.category===b.category&&t.occurred_at.slice(0,7)===b.month.slice(0,7)).reduce((s,t)=>s+Number(t.amount),0);const pct=Math.min(100,spent/Number(b.amount)*100),over=spent>Number(b.amount);
  return `<div class="${actions?'glass rounded-2xl p-4':''}"><div class="flex justify-between text-xs"><span class="font-bold">#${esc(b.category)}</span><span class="money ${over?'text-rose-400':'text-slate-400'}">${fmt(spent)} / ${fmt(b.amount)}</span></div>
  <div class="h-2 bg-slate-800 rounded-full mt-2 overflow-hidden"><div class="h-full rounded-full ${over?'bg-rose-500':'bg-emerald-500'}" style="width:${pct}%"></div></div>${actions?`<div class="mt-2 text-right"><button onclick="editBudget('${b.id}')" class="text-xs text-slate-400 mr-3">Modifica</button><button onclick="deleteBudget('${b.id}')" class="text-xs text-rose-400">Elimina</button></div>`:''}</div>`
}
function openBudgetModal(b=null){document.getElementById('budget-id').value=b?.id||'';renderSelects();document.getElementById('budget-category').value=b?.category||'';document.getElementById('budget-form-month').value=b?.month?.slice(0,7)||document.getElementById('budget-month').value||isoMonth();document.getElementById('budget-amount').value=b?.amount||'';openModal('budget-modal')}
function editBudget(id){openBudgetModal(budgets.find(x=>x.id===id))}
async function saveBudget(e){
  e.preventDefault();
  const id=document.getElementById('budget-id').value;
  const row={user_id:user.id,category:document.getElementById('budget-category').value,month:monthStart(document.getElementById('budget-form-month').value),amount:Number(document.getElementById('budget-amount').value)};
  let previous=null, optimisticId=id;
  let i=id?budgets.findIndex(b=>b.id===id):budgets.findIndex(b=>b.category===row.category&&b.month===row.month);

  if(i!==-1){
    previous={...budgets[i]};optimisticId=budgets[i].id;budgets[i]={...budgets[i],...row};
  }else{
    optimisticId=tempId('budget');budgets.push({...row,id:optimisticId,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  }
  closeModal('budget-modal');commitUI();

  const r=id
    ? await sb.from('budgets').update(row).eq('id',id).eq('user_id',user.id).select().single()
    : await sb.from('budgets').upsert(row,{onConflict:'user_id,category,month'}).select().single();
  if(r.error){
    if(previous){const x=budgets.findIndex(b=>b.id===optimisticId);if(x!==-1)budgets[x]=previous;}
    else budgets=budgets.filter(b=>b.id!==optimisticId);
    commitUI();toast(friendly(r.error));return;
  }
  const x=budgets.findIndex(b=>b.id===optimisticId||b.id===r.data.id);if(x!==-1)budgets[x]=r.data;else budgets.push(r.data);
  saveCache();renderAll();toast('Budget salvato');
}
function deleteBudget(id){
  confirmAction('Eliminare budget?','Le transazioni non verranno eliminate.',async()=>{
    const previous=[...budgets];budgets=budgets.filter(b=>b.id!==id);commitUI();
    const {error}=await sb.from('budgets').delete().eq('id',id).eq('user_id',user.id);
    if(error){budgets=previous;commitUI();toast(friendly(error));return;}
    toast('Budget eliminato');
  })
}

