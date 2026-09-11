// Finora — onboarding and global interaction helpers
let onboardingStep=0;
function onboardingKey(){ return user?.id ? `finora_onboarding_v2_${user.id}` : 'finora_onboarding_v2'; }
function showOnboarding(force=false){
  if(!force && localStorage.getItem(onboardingKey())==='done') return;
  onboardingStep=0;renderOnboarding();openModal('onboarding-modal');
}
function renderOnboarding(){
  document.querySelectorAll('[data-onboarding-slide]').forEach(el=>el.classList.toggle('active',Number(el.dataset.onboardingSlide)===onboardingStep));
  document.querySelectorAll('[data-onboarding-dot]').forEach(el=>el.classList.toggle('active',Number(el.dataset.onboardingDot)===onboardingStep));
  const btn=document.getElementById('onboarding-next');
  if(btn) btn.innerHTML=onboardingStep===2?'Inizia a usare Finora <i class="fa-solid fa-check ml-1"></i>':'Continua <i class="fa-solid fa-arrow-right ml-1"></i>';
}
function nextOnboarding(){
  softHaptic();
  if(onboardingStep<2){onboardingStep++;renderOnboarding()}
  else finishOnboarding();
}
function finishOnboarding(){
  try{localStorage.setItem(onboardingKey(),'done')}catch{}
  closeModal('onboarding-modal');softHaptic();
}
function updateGreeting(){
  const greeting=document.getElementById('home-greeting');
  const title=document.getElementById('home-greeting-title');
  if(!greeting||!title)return;
  const hour=new Date().getHours();
  const part=hour<12?'Buongiorno':hour<18?'Buon pomeriggio':'Buonasera';
  const name=(profile?.username||'').trim();
  greeting.textContent=name?`${part}, ${name}`:part;
  const t=totals(),saving=t.income-t.expense-t.investment;
  title.textContent=!transactions.length?'Cominciamo dalla tua prima operazione':saving>=0?'Stai costruendo margine questo mese':'Tieni d’occhio il margine di questo mese';
}
function premiumToast(text,type='success'){
  const e=document.getElementById('toast');if(!e)return;
  e.innerHTML=`<span class="inline-flex items-center gap-2"><i class="fa-solid ${type==='success'?'fa-circle-check text-emerald-400':'fa-circle-info text-cyan-400'}"></i><span>${esc(text)}</span></span>`;
  e.classList.remove('hidden');e.classList.add('success-pop');
  setTimeout(()=>{e.classList.add('hidden');e.classList.remove('success-pop')},2600);
}
function handleKeyboardShortcuts(e){
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const tag=(document.activeElement?.tagName||'').toLowerCase();
  const typing=['input','textarea','select'].includes(tag);
  if(!typing && (e.key==='n'||e.key==='N')){e.preventDefault();openQuickAdd()}
  if(!typing && e.key==='/'){
    e.preventDefault();goPage('transactions');
    document.getElementById('advanced-filters')?.classList.remove('hidden');
    setTimeout(()=>document.getElementById('filter-search')?.focus(),120);
  }
}
document.addEventListener('keydown',handleKeyboardShortcuts);
document.addEventListener('input',e=>{if(['tx-amount','tx-category'].includes(e.target?.id))validateTransactionForm()});
document.addEventListener('change',e=>{if(['tx-amount','tx-category'].includes(e.target?.id))validateTransactionForm()});


