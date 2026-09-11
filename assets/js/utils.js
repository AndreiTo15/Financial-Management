// Finora — common UI and finance helpers
function msg(text,type='error'){
  const el=document.getElementById('auth-msg'); el.textContent=text; el.classList.remove('hidden');
  el.className='mt-4 p-3 rounded-xl text-xs '+(type==='success'?'bg-emerald-500/10 text-emerald-300':'bg-rose-500/10 text-rose-300');
}
function clearMsg(){document.getElementById('auth-msg').classList.add('hidden')}
function friendly(e){
  const m=(e?.message||String(e)||'').toLowerCase();
  if(m.includes('rate limit')) return 'Hai richiesto troppe email in poco tempo. Attendi e riprova.';
  if(m.includes('invalid login')) return 'Email o password non corretti.';
  if(m.includes('email not confirmed')) return 'Conferma prima il tuo indirizzo email.';
  if(m.includes('already registered')) return 'Esiste già un account con questa email.';
  if(m.includes('duplicate key')) return 'Esiste già un elemento con questo nome.';
  return e?.message||'Si è verificato un errore.';
}
function toast(t){premiumToast(t,'success')}
let snapshotTimer=null;
function tempId(prefix='tmp'){
  const rnd=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now();
  return `${prefix}_${rnd}`;
}
function commitUI(){
  saveCache();
  renderAll();
  scheduleSnapshot();
}
function scheduleSnapshot(){
  clearTimeout(snapshotTimer);
  snapshotTimer=setTimeout(()=>{ saveSnapshot().catch(()=>{}); },700);
}

function openModal(id){document.getElementById(id)?.classList.add('open')}
function closeModal(id){document.getElementById(id)?.classList.remove('open')}
function confirmAction(title,text,fn){
  document.getElementById('confirm-title').textContent=title;document.getElementById('confirm-text').textContent=text;
  const b=document.getElementById('confirm-yes');
  if(b._finoraConfirmHandler)b.removeEventListener('click',b._finoraConfirmHandler);
  b._finoraConfirmHandler=async()=>{closeModal('confirm-modal');await fn()};
  b.addEventListener('click',b._finoraConfirmHandler);
  openModal('confirm-modal')
}
function togglePrivacy(){privacy=!privacy;document.body.classList.toggle('privacy',privacy)}
function applyThemeMeta(){
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',document.documentElement.classList.contains('light')?'#f5f7fb':'#07111f');
}
function toggleTheme(){
  const root=document.documentElement;
  root.classList.add('theme-switching');
  root.classList.toggle('light');
  localStorage.setItem('finance_theme',root.classList.contains('light')?'light':'dark');
  applyThemeMeta();

  // Forza un repaint pulito: evita glitch grafici della card principale
  // su alcuni browser/PWA durante il cambio tema.
  void document.body.offsetHeight;
  requestAnimationFrame(()=>{
    root.classList.remove('theme-switching');
    try{renderCharts()}catch{}
  });
}
function isoMonth(d=new Date()){return d.toISOString().slice(0,7)}
function monthStart(v){return v+'-01'}
function fmt(v){return money.format(Number(v||0))}
function localDT(v){const d=v?new Date(v):new Date();const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,16)}
function catByName(n){return categories.find(c=>c.name.toLowerCase()===(n||'').toLowerCase())||{name:n||'altro',icon:'fa-tag',color:'#64748b',kind:'expense'}}
function txSign(t){return t.type==='INCOME'?'+':'-'}
function txColor(t){return t.type==='INCOME'?'text-emerald-400':t.type==='INVESTMENT'?'text-cyan-400':'text-rose-400'}
function currentBalance(){
  const opening=Number(settings?.opening_balance||0);
  return transactions.reduce((s,t)=>s+(t.type==='INCOME'?Number(t.amount):-Number(t.amount)),opening);
}
function monthTx(month=isoMonth()){return transactions.filter(t=>(t.occurred_at||'').slice(0,7)===month)}
function totals(month=isoMonth()){
  const a=monthTx(month);return {
    income:a.filter(x=>x.type==='INCOME').reduce((s,x)=>s+Number(x.amount),0),
    expense:a.filter(x=>x.type==='EXPENSE').reduce((s,x)=>s+Number(x.amount),0),
    investment:a.filter(x=>x.type==='INVESTMENT').reduce((s,x)=>s+Number(x.amount),0)
  }
}
function savings(month=isoMonth()){const t=totals(month);return t.income-t.expense-t.investment}
function assetsTotal(){return assets.reduce((s,a)=>s+Number(a.value),0)}
function netWorth(){return currentBalance()+assetsTotal()}

