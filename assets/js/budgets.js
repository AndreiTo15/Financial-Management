// Finora — budgets
function renderBudgets(){
  const m=document.getElementById('budget-month').value||isoMonth();document.getElementById('budget-month').value=m;
  const list=budgets.filter(b=>b.month.slice(0,7)===m);document.getElementById('budgets-list').innerHTML=list.map(b=>budgetCard(b,true)).join('')||'<div class="empty-state"><i class="fa-solid fa-gauge-high text-2xl text-slate-600"></i><p class="text-sm font-bold text-slate-300 mt-3">Nessun budget per questo mese</p><p class="text-xs text-slate-500 mt-1">Imposta un limite per capire subito quando una categoria sta crescendo troppo.</p><button data-action="open-budget" class="mt-4 px-4 py-2 rounded-xl bg-brand-600 text-xs font-bold">Crea budget</button></div>'
}
function budgetCard(b,actions){
  const amount=Number(b.amount)||0;
  const spent=transactions
    .filter(t=>t.type==='EXPENSE'&&t.category===b.category&&t.occurred_at.slice(0,7)===b.month.slice(0,7))
    .reduce((s,t)=>s+Number(t.amount),0);
  const rawPct=amount>0?(spent/amount*100):0;
  const barPct=Math.min(100,Math.max(0,rawPct));
  const over=spent>amount;
  const remaining=Math.max(0,amount-spent);
  const pctLabel=`${Math.round(rawPct)}%`;

  return `<div class="${actions?'glass rounded-2xl p-4':''}">
    <div class="flex justify-between items-start gap-3 text-xs">
      <div>
        <span class="font-bold">#${esc(b.category)}</span>
        <div class="mt-1 flex items-center gap-2">
          <span class="budget-percent ${over?'text-rose-400':'text-brand-600'}">${pctLabel}</span>
          <span class="text-slate-500">${over?'Budget superato':`${fmt(remaining)} disponibili`}</span>
        </div>
      </div>
      <span class="money ${over?'text-rose-400':'text-slate-400'}">${fmt(spent)} / ${fmt(amount)}</span>
    </div>
    <div class="h-2.5 bg-slate-800 rounded-full mt-3 overflow-hidden" role="progressbar" aria-label="Budget ${esc(b.category)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(barPct)}">
      <div class="h-full rounded-full ${over?'bg-rose-500':rawPct>=80?'bg-amber-500':'bg-emerald-500'}" style="width:${barPct}%"></div>
    </div>
    ${actions?`<div class="mt-3 flex items-center justify-between gap-3">
      <button data-action="add-budget-expense" data-id="${b.id}" class="text-xs font-bold text-brand-600 inline-flex items-center gap-1.5">
        <i class="fa-solid fa-plus"></i><span>Aggiungi spesa</span>
      </button>
      <div class="text-right">
        <button data-action="edit-budget" data-id="${b.id}" class="text-xs text-slate-400 mr-3">Modifica</button>
        <button data-action="delete-budget" data-id="${b.id}" class="text-xs text-rose-400">Elimina</button>
      </div>
    </div>`:''}
  </div>`
}

function addBudgetExpense(id){
  const b=budgets.find(x=>x.id===id);
  if(!b)return;

  openTransactionModal('EXPENSE');

  const category=document.getElementById('tx-category');
  if(category&&[...category.options].some(o=>o.value===b.category))category.value=b.category;

  const budgetMonth=b.month.slice(0,7);
  const now=new Date();
  const currentMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const date=document.getElementById('tx-date');

  if(date&&budgetMonth!==currentMonth){
    date.value=`${budgetMonth}-01T12:00`;
  }

  const title=document.getElementById('transaction-title');
  if(title)title.textContent=`Spesa · #${b.category}`;

  validateTransactionForm();
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

