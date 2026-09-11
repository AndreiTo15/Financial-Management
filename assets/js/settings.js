// Finora — statistics and user settings
function renderStats(){
  const year=new Date().getFullYear();const ys=transactions.filter(t=>new Date(t.occurred_at).getFullYear()===year&&t.type==='EXPENSE').reduce((s,t)=>s+Number(t.amount),0);
  const avg=ys/(new Date().getMonth()+1);const allExp=monthTx().filter(t=>t.type==='EXPENSE');const map={};allExp.forEach(t=>map[t.category]=(map[t.category]||0)+Number(t.amount));const top=Object.entries(map).sort((a,b)=>b[1]-a[1])[0];
  const sr=totals().income?Math.max(0,savings()/totals().income*100):0;
  const cards=[['Spese anno',fmt(ys)],['Media mensile',fmt(avg)],['Categoria top',top?top[0]:'—'],['Tasso risparmio',sr.toFixed(0)+'%']];
  document.getElementById('stats-grid').innerHTML=cards.map(x=>`<div class="bg-slate-900/50 rounded-xl p-3"><p class="text-[10px] text-slate-500">${x[0]}</p><p class="money text-sm font-bold mt-1">${x[1]}</p></div>`).join('')
}
function renderSettings(){document.getElementById('settings-username').value=profile?.username||'';document.getElementById('settings-opening').value=settings?.opening_balance||0}
async function saveSettings(){
  const username=document.getElementById('settings-username').value.trim();
  const opening_balance=Number(document.getElementById('settings-opening').value);
  const oldProfile=profile?{...profile}:profile,oldSettings=settings?{...settings}:settings;
  profile={...(profile||{}),username};settings={...(settings||{}),opening_balance};closeModal('settings-modal');commitUI();

  const [a,b]=await Promise.all([
    sb.from('profiles').update({username}).eq('id',user.id),
    sb.from('finance_settings').update({opening_balance}).eq('user_id',user.id)
  ]);
  if(a.error||b.error){profile=oldProfile;settings=oldSettings;commitUI();toast(friendly(a.error||b.error));return;}
  toast('Impostazioni salvate');
}
