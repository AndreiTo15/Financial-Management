// Finora — navigation, setup wizard, filters and main rendering
function openSetupWizard(){
  document.getElementById('setup-opening').value=Number(settings?.opening_balance||0);
  const sel=document.getElementById('setup-budget-category');sel.innerHTML=categories.filter(c=>['expense','both'].includes(c.kind)).map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  openModal('setup-modal');
}
async function saveSetupWizard(){
  const opening=Number(document.getElementById('setup-opening').value||0);
  const cat=document.getElementById('setup-budget-category').value;
  const amount=Number(document.getElementById('setup-budget-amount').value||0);
  const goalName=document.getElementById('setup-goal-name').value.trim();
  const goalTarget=Number(document.getElementById('setup-goal-target').value||0);
  try{
    settings={...(settings||{}),opening_balance:opening};commitUI();
    await sb.from('finance_settings').upsert({user_id:user.id,opening_balance:opening},{onConflict:'user_id'});
    if(cat&&amount>0)await sb.from('budgets').upsert({user_id:user.id,month:isoMonth()+'-01',category:cat,amount},{onConflict:'user_id,month,category'});
    if(goalName&&goalTarget>0)await sb.from('savings_goals').insert({user_id:user.id,name:goalName,target_amount:goalTarget,current_amount:0,goal_type:'savings'});
    closeModal('setup-modal');premiumToast('Configurazione completata');await loadAll();
  }catch(e){toast(friendly(e))}
}
function validateTransactionForm(){
  const amount=document.getElementById('tx-amount'),cat=document.getElementById('tx-category'),btn=document.getElementById('tx-save-btn');
  const amountErr=document.getElementById('tx-amount-error'),catErr=document.getElementById('tx-category-error');
  const validAmount=Number(amount?.value)>0,validCat=!!cat?.value;
  amount?.classList.toggle('field-invalid',!validAmount&&!!amount.value);
  cat?.classList.toggle('field-invalid',!validCat);
  if(amountErr){amountErr.textContent=validAmount?'':'Inserisci un importo maggiore di zero.';amountErr.classList.toggle('hidden',validAmount||!amount.value)}
  if(catErr){catErr.textContent=validCat?'':'Seleziona una categoria.';catErr.classList.toggle('hidden',validCat)}
  if(btn)btn.disabled=!(validAmount&&validCat);
  return validAmount&&validCat;
}
function copyDiagnostics(){
  const text=`Finora 2.3 | ${navigator.userAgent} | online=${navigator.onLine} | queue=${getTxQueue().length} | user=${user?.id?'signed-in':'signed-out'}`;
  navigator.clipboard?.writeText(text);premiumToast('Diagnostica copiata');
}

function softHaptic(){
  try{ if(navigator.vibrate) navigator.vibrate(12); }catch{}
}
function openQuickAdd(){ softHaptic(); openModal('quick-add-modal'); }
function quickAddType(type){ closeModal('quick-add-modal'); setTimeout(()=>openTransactionModal(type),80); }
function toggleAdvancedFilters(){ document.getElementById('advanced-filters')?.classList.toggle('hidden'); }
function syncFilterChips(){
  const type=document.getElementById('filter-type')?.value||'';
  document.querySelectorAll('[data-chip]').forEach(x=>x.classList.remove('active'));
  const key=type||'all';document.querySelector(`[data-chip="${key}"]`)?.classList.add('active');
}
function setQuickFilter(mode){
  const type=document.getElementById('filter-type'),from=document.getElementById('filter-from'),to=document.getElementById('filter-to');
  if(!type)return;
  if(mode==='month'){
    type.value='';
    const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1),end=new Date(now.getFullYear(),now.getMonth()+1,0);
    from.value=start.toISOString().slice(0,10);to.value=end.toISOString().slice(0,10);
  }else{
    type.value=mode==='all'?'':mode;
    if(from)from.value='';if(to)to.value='';
  }
  document.querySelectorAll('[data-chip]').forEach(x=>x.classList.toggle('active',x.dataset.chip===mode));
  renderTransactions();softHaptic();
}
function toggleAnalysisDetails(){
  const box=document.getElementById('analysis-detail-panels'),btn=document.getElementById('analysis-toggle-details');
  if(!box||!btn)return;
  const hidden=box.classList.toggle('analysis-detail-collapsed');
  btn.innerHTML=hidden?'<i class="fa-solid fa-chart-simple mr-1"></i> Vedi indicatori e dettagli':'<i class="fa-solid fa-chevron-up mr-1"></i> Nascondi indicatori e dettagli';
}
function renderHomeAIInsight(){
  const el=document.getElementById('home-ai-insight');if(!el)return;
  const current=totals(),history=completedMonthlyHistory(6),avg=averageHistory(history);
  if(!transactions.length){el.textContent='Registra qualche movimento: poi Finora potrà evidenziare trend e abitudini.';return}
  if(avg.monthsAvailable>=3&&avg.expenses!==null){
    const diff=avg.expenses?((current.expense-avg.expenses)/avg.expenses*100):0;
    if(Math.abs(diff)>=12) el.textContent=`Le spese di questo mese sono ${Math.abs(diff).toFixed(0)}% ${diff>0?'sopra':'sotto'} la tua media recente.`;
    else el.textContent='Le spese di questo mese sono in linea con la tua media recente.';
  }else{
    const saving=current.income-current.expense-current.investment;
    el.textContent=saving>=0?`Questo mese il saldo tra entrate e uscite è positivo di ${fmt(saving)}.`:`Questo mese le uscite superano le entrate di ${fmt(Math.abs(saving))}.`;
  }
}

function goPage(p){
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+p)?.classList.add('active');
  document.querySelectorAll('.navbtn').forEach(x=>x.className=x.className.replace('text-emerald-400','text-slate-500'));
  const navMap={budgets:'more',wealth:'more',goals:'more',subscriptions:'more'};
  const navKey=navMap[p]||p;
  const b=document.querySelector(`[data-nav="${navKey}"]`);if(b)b.className=b.className.replace('text-slate-500','text-emerald-400');
  if(p==='budgets')renderBudgets();if(p==='wealth')renderWealth();if(p==='subscriptions')renderSubscriptions();if(p==='analysis')renderAIHistory();
  window.scrollTo({top:0,behavior:'smooth'});
}
function renderAll(){
  document.getElementById('header-subtitle').textContent=profile?.username||user?.email||'Gestione personale';
  renderSelects();renderHome();renderTransactions();renderBudgets();renderSubscriptions();renderCategories();renderGoals();renderWealth();renderStats();renderSettings();renderSubscriptionAlert();renderAIHistory();updateGreeting();buildNotifications();updateNetworkStatus()
}
function renderSelects(){
  const catOptions='<option value="">Tutte le categorie</option>'+categories.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  document.getElementById('filter-category').innerHTML=catOptions;
  const expense=categories.filter(c=>['expense','both','investment'].includes(c.kind));
  document.getElementById('sub-category').innerHTML=expense.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  document.getElementById('budget-category').innerHTML=categories.filter(c=>['expense','both'].includes(c.kind)).map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function renderHome(){
  const t=totals();
  const saving=t.income-t.expense-t.investment;
  document.getElementById('kpi-balance').textContent=fmt(currentBalance());
  document.getElementById('kpi-income').textContent=fmt(t.income);
  document.getElementById('kpi-expense').textContent=fmt(t.expense);
  document.getElementById('kpi-investment').textContent=fmt(t.investment);
  const savingEl=document.getElementById('kpi-saving');if(savingEl){savingEl.textContent=fmt(saving);savingEl.className='money text-lg font-extrabold mt-1 '+(saving>=0?'text-emerald-400':'text-rose-400')}
  const monthEl=document.getElementById('home-month-label');if(monthEl)monthEl.textContent=new Date().toLocaleDateString('it-IT',{month:'long',year:'numeric'});
  const prev=new Date();prev.setMonth(prev.getMonth()-1);const pt=totals(isoMonth(prev));const diff=pt.expense?((t.expense-pt.expense)/pt.expense*100):0;
  document.getElementById('mom-text').textContent=pt.expense?`${Math.abs(diff).toFixed(0)}% ${diff<=0?'in meno':'in più'} vs mese scorso`:'';
  renderHomeBudgets();renderRecent();renderCharts();renderHomeAIInsight()
}
function renderHomeBudgets(){
  const m=isoMonth(),box=document.getElementById('home-budgets');const rows=budgets.filter(b=>b.month.slice(0,7)===m).slice(0,5);
  box.innerHTML=rows.length?rows.map(b=>budgetCard(b,false)).join(''):'<div class="empty-state"><i class="fa-solid fa-gauge-high text-slate-600"></i><p class="text-xs text-slate-400 mt-2">Nessun budget per questo mese.</p><button onclick="goPage(\'budgets\')" class="mt-3 text-xs font-bold text-emerald-400">Crea un budget</button></div>'
}
function renderRecent(){const box=document.getElementById('recent-transactions');box.innerHTML=transactions.slice(0,6).map(txCard).join('')||'<div class="empty-state"><i class="fa-solid fa-receipt text-slate-600"></i><p class="text-xs text-slate-400 mt-2">Ancora nessun movimento.</p><button onclick="openQuickAdd()" class="mt-3 text-xs font-bold text-emerald-400">Aggiungi il primo</button></div>'}
