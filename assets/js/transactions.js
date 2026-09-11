// Finora — transaction rendering and CRUD
function txCard(t){
  const c=catByName(t.category);return `<div class="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/50">
    <div class="flex items-center gap-3 min-w-0"><div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background:${c.color}22;color:${c.color}"><i class="fa-solid ${c.icon}"></i></div>
    <div class="min-w-0"><p class="text-xs font-bold truncate">${esc(t.description||t.category)}</p><p class="text-[10px] text-slate-500">${new Date(t.occurred_at).toLocaleDateString('it-IT')} · #${esc(t.category)}</p></div></div>
    <div class="flex items-center"><span class="money text-xs font-bold ${txColor(t)}">${txSign(t)}${fmt(t.amount)}</span>
    <button onclick="editTransaction('${t.id}')" class="p-2 text-slate-500 hover:text-emerald-400"><i class="fa-solid fa-pen"></i></button>
    <button onclick="deleteTransaction('${t.id}')" class="p-2 text-slate-500 hover:text-rose-400"><i class="fa-solid fa-trash"></i></button></div></div>`
}
function renderTransactions(){
  const q=(document.getElementById('filter-search')?.value||'').toLowerCase(),type=document.getElementById('filter-type')?.value||'',cat=document.getElementById('filter-category')?.value||'',from=document.getElementById('filter-from')?.value||'',to=document.getElementById('filter-to')?.value||'';
  let list=transactions.filter(t=>(!q||(t.description||'').toLowerCase().includes(q)||t.category.toLowerCase().includes(q))&&(!type||t.type===type)&&(!cat||t.category===cat)&&(!from||t.occurred_at.slice(0,10)>=from)&&(!to||t.occurred_at.slice(0,10)<=to));
  document.getElementById('transactions-list').innerHTML=list.map(txCard).join('')||'<div class="empty-state"><i class="fa-solid fa-magnifying-glass text-slate-600"></i><p class="text-sm text-slate-400 mt-2">Nessun movimento trovato.</p><button onclick="setQuickFilter(\'all\')" class="mt-3 text-xs font-bold text-emerald-400">Azzera i filtri</button></div>'
}
function openTransactionModal(type='EXPENSE',t=null){
  document.getElementById('tx-id').value=t?.id||'';document.getElementById('tx-type').value=t?.type||type;document.getElementById('transaction-title').textContent=t?'Modifica movimento':type==='INCOME'?'Nuova entrata':type==='INVESTMENT'?'Nuovo investimento':'Nuova spesa';
  let valid=categories.filter(c=>type==='INCOME'?['income','both'].includes(c.kind):type==='INVESTMENT'?c.kind==='investment':['expense','both'].includes(c.kind));
  document.getElementById('tx-category').innerHTML=valid.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  document.getElementById('tx-amount').value=t?.amount||'';document.getElementById('tx-category').value=t?.category||valid[0]?.name||'';document.getElementById('tx-description').value=t?.description||'';document.getElementById('tx-date').value=localDT(t?.occurred_at);openModal('transaction-modal');softHaptic();setTimeout(()=>{document.getElementById('tx-amount')?.focus();validateTransactionForm()},180)
}
function editTransaction(id){const t=transactions.find(x=>x.id===id);if(t)openTransactionModal(t.type,t)}
async function saveTransaction(e){
  e.preventDefault();
  if(!validateTransactionForm())return;
  const id=document.getElementById('tx-id').value;
  const row={user_id:user.id,type:document.getElementById('tx-type').value,amount:Number(document.getElementById('tx-amount').value),category:document.getElementById('tx-category').value,description:document.getElementById('tx-description').value.trim(),occurred_at:new Date(document.getElementById('tx-date').value).toISOString(),source:'manual'};
  if(!navigator.onLine){
    if(id){
      const i=transactions.findIndex(t=>t.id===id);if(i!==-1)transactions[i]={...transactions[i],...row};
      queueTxOperation({action:'update',id,row});
    }else{
      const optimistic={...row,id:tempId('tx'),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),offline_pending:true};
      transactions.unshift(optimistic);queueTxOperation({action:'insert',row});
    }
    closeModal('transaction-modal');commitUI();return;
  }

  if(id){
    const i=transactions.findIndex(t=>t.id===id);
    if(i===-1)return;
    const previous={...transactions[i]};
    transactions[i]={...transactions[i],...row};
    closeModal('transaction-modal');
    commitUI();

    const {data,error}=await sb.from('transactions').update(row).eq('id',id).eq('user_id',user.id).select().single();
    if(error){transactions[i]=previous;commitUI();toast(friendly(error));return;}
    const now=transactions.findIndex(t=>t.id===id);if(now!==-1)transactions[now]=data;
    saveCache();
    toast('Movimento salvato');
    return;
  }

  const optimistic={...row,id:tempId('tx'),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  transactions.unshift(optimistic);
  closeModal('transaction-modal');
  commitUI();

  const {data,error}=await sb.from('transactions').insert(row).select().single();
  if(error){transactions=transactions.filter(t=>t.id!==optimistic.id);commitUI();toast(friendly(error));return;}
  const i=transactions.findIndex(t=>t.id===optimistic.id);if(i!==-1)transactions[i]=data;
  saveCache();renderAll();
  toast('Movimento salvato');
}
function deleteTransaction(id){
  confirmAction('Eliminare movimento?','Il saldo e i grafici verranno aggiornati.',async()=>{
    if(!navigator.onLine){
      const t=transactions.find(x=>x.id===id);
      transactions=transactions.filter(x=>x.id!==id);commitUI();
      if(t&&!String(id).startsWith('tmp_'))queueTxOperation({action:'delete',id});
      else setTxQueue(getTxQueue().filter(q=>!(q.action==='insert'&&q.row?.occurred_at===t?.occurred_at&&q.row?.amount===t?.amount)));
      return;
    }
    const oldTransactions = [...transactions];
    transactions = transactions.filter(t => t.id !== id);
    commitUI();

    const { error } = await sb.from('transactions').delete().eq('id',id).eq('user_id',user.id);

    if(error){
      transactions = oldTransactions;
      commitUI();
      toast(friendly(error));
      return;
    }

    toast('Movimento eliminato');
  })
}

