// Finora — savings and investment goals
function renderGoals(){
  document.getElementById('goals-list').innerHTML=goals.map(g=>{
    const p=Math.min(100,Number(g.current_amount)/Number(g.target_amount)*100);
    const isInvestment=(g.goal_type||'savings')==='investment';
    const icon=isInvestment?'fa-chart-line':'fa-piggy-bank';
    const badge=isInvestment?'Investimenti':'Risparmio';
    const accent=isInvestment?'bg-cyan-500':'bg-emerald-500';
    const accentText=isInvestment?'text-cyan-400':'text-emerald-400';
    return `<div class="glass rounded-2xl p-4">
      <div class="flex justify-between gap-3">
        <div class="flex items-start gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl ${isInvestment?'bg-cyan-500/10 text-cyan-400':'bg-emerald-500/10 text-emerald-400'} flex items-center justify-center flex-shrink-0">
            <i class="fa-solid ${icon}"></i>
          </div>
          <div class="min-w-0">
            <p class="font-bold truncate">${esc(g.name)}</p>
            <div class="flex flex-wrap items-center gap-2 mt-1">
              <span class="text-[10px] px-2 py-0.5 rounded-full ${isInvestment?'bg-cyan-500/10 text-cyan-400':'bg-emerald-500/10 text-emerald-400'}">${badge}</span>
              <span class="text-xs text-slate-500">${g.target_date?'Entro '+new Date(g.target_date).toLocaleDateString('it-IT'):''}</span>
            </div>
          </div>
        </div>
        <div class="flex">
          <button onclick="editGoal('${g.id}')" class="p-2 text-slate-500"><i class="fa-solid fa-pen"></i></button>
          <button onclick="deleteGoal('${g.id}')" class="p-2 text-rose-400"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <p class="money text-sm mt-3">${fmt(g.current_amount)} / ${fmt(g.target_amount)}</p>
      <div class="h-2 bg-slate-800 rounded-full mt-2"><div class="h-full ${accent} rounded-full" style="width:${p}%"></div></div>
      <button onclick="contributeGoal('${g.id}')" class="mt-3 text-xs ${accentText}">${isInvestment?'+ Aggiungi capitale':'+ Aggiungi risparmio'}</button>
    </div>`
  }).join('')||'<p class="text-sm text-slate-500">Nessun obiettivo.</p>'
}
function openGoalModal(g=null){
  document.getElementById('goal-id').value=g?.id||'';
  document.getElementById('goal-name').value=g?.name||'';
  document.getElementById('goal-type').value=g?.goal_type||'savings';
  document.getElementById('goal-target').value=g?.target_amount||'';
  document.getElementById('goal-current').value=g?.current_amount||0;
  document.getElementById('goal-date').value=g?.target_date||'';
  openModal('goal-modal')
}
function editGoal(id){openGoalModal(goals.find(g=>g.id===id))}
async function saveGoal(e){
  e.preventDefault();
  const id=document.getElementById('goal-id').value;
  const row={user_id:user.id,name:document.getElementById('goal-name').value.trim(),goal_type:document.getElementById('goal-type').value,target_amount:Number(document.getElementById('goal-target').value),current_amount:Number(document.getElementById('goal-current').value),target_date:document.getElementById('goal-date').value||null};

  if(id){
    const i=goals.findIndex(g=>g.id===id);if(i===-1)return;const previous={...goals[i]};goals[i]={...goals[i],...row};closeModal('goal-modal');commitUI();
    const {data,error}=await sb.from('savings_goals').update(row).eq('id',id).eq('user_id',user.id).select().single();
    if(error){const x=goals.findIndex(g=>g.id===id);if(x!==-1)goals[x]=previous;commitUI();toast(friendly(error));return;}
    const x=goals.findIndex(g=>g.id===id);if(x!==-1)goals[x]=data;saveCache();renderAll();toast('Obiettivo salvato');return;
  }

  const optimistic={...row,id:tempId('goal'),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};goals.push(optimistic);closeModal('goal-modal');commitUI();
  const {data,error}=await sb.from('savings_goals').insert(row).select().single();
  if(error){goals=goals.filter(g=>g.id!==optimistic.id);commitUI();toast(friendly(error));return;}
  const i=goals.findIndex(g=>g.id===optimistic.id);if(i!==-1)goals[i]=data;saveCache();renderAll();toast('Obiettivo salvato');
}
async function contributeGoal(id){
  const g=goals.find(x=>x.id===id);
  if(!g) return;

  const v=prompt('Quanto vuoi aggiungere?', '50');
  if(v===null) return;

  const amount=Number(String(v).replace(',','.'));
  if(!Number.isFinite(amount) || amount<=0){
    toast('Inserisci un importo valido.');
    return;
  }

  const oldAmount=Number(g.current_amount||0);
  const newAmount=oldAmount+amount;

  // Aggiornamento immediato nell'interfaccia.
  g.current_amount=newAmount;
  commitUI();

  const {data,error}=await sb.from('savings_goals')
    .update({current_amount:newAmount})
    .eq('id',id)
    .eq('user_id',user.id)
    .select()
    .single();

  if(error){
    // Ripristina il valore se Supabase non salva.
    g.current_amount=oldAmount;
    saveCache();
    renderAll();
    toast(friendly(error));
    return;
  }

  const i=goals.findIndex(x=>x.id===id);
  if(i!==-1) goals[i]=data;
  saveCache();
  renderAll();
  toast('Importo aggiunto all’obiettivo');
}
function deleteGoal(id){
  confirmAction('Eliminare obiettivo?','Questa operazione non modifica il saldo.',async()=>{
    const previous=[...goals];goals=goals.filter(g=>g.id!==id);commitUI();
    const {error}=await sb.from('savings_goals').delete().eq('id',id).eq('user_id',user.id);
    if(error){goals=previous;commitUI();toast(friendly(error));return;}
    toast('Obiettivo eliminato');
  })
}

