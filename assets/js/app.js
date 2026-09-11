let sb=null,user=null,profile=null,settings=null;
let transactions=[],subscriptions=[],categories=[],budgets=[],goals=[],assets=[],snapshots=[],aiReports=[];
let charts={monthly:null,category:null,wealth:null};
let privacy=false,recovery=false,reloadTimer=null;
const money=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'});
const CACHE_PREFIX='finance_v2_cache_';

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
  const b=document.getElementById('confirm-yes');b.onclick=async()=>{closeModal('confirm-modal');await fn()};openModal('confirm-modal')
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

function authMode(mode){
  ['login-form','register-form','forgot-form','reset-form'].forEach(id=>document.getElementById(id).classList.add('hidden'));

  const tabs=document.getElementById('auth-tabs');
  const loginTab=document.getElementById('tab-login');
  const registerTab=document.getElementById('tab-register');

  tabs.classList.remove('hidden');
  clearMsg();

  // Stato visivo dei due tab Accedi / Registrati
  [loginTab, registerTab].forEach(tab=>{
    tab.classList.remove('bg-brand-600','text-white');
    tab.classList.add('text-slate-400');
  });

  if(mode==='login'){
    document.getElementById('login-form').classList.remove('hidden');
    loginTab.classList.remove('text-slate-400');
    loginTab.classList.add('bg-brand-600','text-white');
  }

  if(mode==='register'){
    document.getElementById('register-form').classList.remove('hidden');
    registerTab.classList.remove('text-slate-400');
    registerTab.classList.add('bg-brand-600','text-white');
  }

  if(mode==='forgot'){
    document.getElementById('forgot-form').classList.remove('hidden');
    tabs.classList.add('hidden');
  }

  if(mode==='reset'||mode==='reset-direct'){
    recovery=mode==='reset';
    document.getElementById('reset-form').classList.remove('hidden');
    tabs.classList.add('hidden');
    if(mode==='reset-direct'){
      closeModal('settings-modal');
      document.getElementById('auth-screen').classList.remove('hidden');
    }
  }
}
async function register(e){
  e.preventDefault();clearMsg();
  try{
    const email=document.getElementById('reg-email').value.trim(),password=document.getElementById('reg-password').value,username=document.getElementById('reg-user').value.trim();
    const {data,error}=await sb.auth.signUp({email,password,options:{data:{username},emailRedirectTo:location.origin+location.pathname}});if(error)throw error;
    if(data.session)await onUser(data.user);else{document.getElementById('email-confirm-address').textContent=email;openModal('email-modal')}
  }catch(x){msg(friendly(x))}
}
async function login(e){e.preventDefault();clearMsg();try{const{data,error}=await sb.auth.signInWithPassword({email:document.getElementById('login-email').value.trim(),password:document.getElementById('login-password').value});if(error)throw error;await onUser(data.user)}catch(x){msg(friendly(x))}}
async function forgotPassword(e){e.preventDefault();try{const email=document.getElementById('forgot-email').value.trim();const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;msg('Se l’email è associata a un account, riceverai il link di recupero.','success')}catch(x){msg(friendly(x))}}
async function updatePassword(e){e.preventDefault();const p=document.getElementById('new-password').value,p2=document.getElementById('new-password2').value;if(p!==p2)return msg('Le password non coincidono.');try{const{error}=await sb.auth.updateUser({password:p});if(error)throw error;recovery=false;msg('Password aggiornata.','success');setTimeout(()=>{document.getElementById('auth-screen').classList.add('hidden');renderAll()},800)}catch(x){msg(friendly(x))}}
function requestAccountDeletion(){
  closeModal('settings-modal');
  const input=document.getElementById('delete-account-confirm');
  if(input) input.value='';
  openModal('delete-account-modal');
}

async function deleteAccount(){
  const input=document.getElementById('delete-account-confirm');
  const btn=document.getElementById('delete-account-btn');
  if(!input || input.value.trim()!=='ELIMINA'){
    toast('Scrivi ELIMINA per confermare.');
    return;
  }
  if(!user || !sb) return;

  const userId=user.id;
  btn.disabled=true;
  btn.textContent='Eliminazione...';

  try{
    const {error}=await sb.rpc('delete_my_account');
    if(error) throw error;

    try{ localStorage.removeItem(CACHE_PREFIX+userId); }catch{}
    try{ await sb.auth.signOut(); }catch{}

    closeModal('delete-account-modal');
    document.getElementById('auth-screen').classList.remove('hidden');
    authMode('login');
    msg('Account eliminato definitivamente.','success');
    setTimeout(()=>location.reload(),1200);
  }catch(error){
    toast(friendly(error));
    btn.disabled=false;
    btn.textContent='Elimina account';
  }
}

async function logout(){await sb.auth.signOut();location.reload()}

async function init(){
  const savedTheme=localStorage.getItem('finance_theme');if(savedTheme==='light'||!savedTheme)document.documentElement.classList.add('light');applyThemeMeta();
  if(!SUPABASE_CONFIG.anonKey||SUPABASE_CONFIG.anonKey.includes('INCOLLA_QUI')){document.getElementById('auth-screen').classList.remove('hidden');msg('Inserisci la Publishable Key di Supabase nel file index.html.');return}
  sb=supabase.createClient(SUPABASE_CONFIG.url,SUPABASE_CONFIG.anonKey);
  sb.auth.onAuthStateChange(async(event,session)=>{
    if(event==='PASSWORD_RECOVERY'){recovery=true;user=session?.user;document.getElementById('auth-screen').classList.remove('hidden');authMode('reset');msg('Link verificato: scegli la nuova password.','success')}
    else if(event==='SIGNED_IN'&&session?.user&&!recovery)await onUser(session.user);
    else if(event==='SIGNED_OUT'){document.getElementById('auth-screen').classList.remove('hidden')}
  });
  const{data}=await sb.auth.getSession();if(data.session?.user&&!recovery)await onUser(data.session.user)
}
async function onUser(u){
  user=u;document.getElementById('auth-screen').classList.add('hidden');
  try{await sb.rpc('process_due_subscriptions')}catch(e){console.warn(e)}
  await loadAll();subscribeRealtime()
}
async function loadAll(){
  if(!user)return;
  
  const requests=[
    sb.from('profiles').select('*').eq('id',user.id).maybeSingle(),
    sb.from('finance_settings').select('*').eq('user_id',user.id).maybeSingle(),
    sb.from('categories').select('*').eq('user_id',user.id).order('name'),
    sb.from('transactions').select('*').eq('user_id',user.id).order('occurred_at',{ascending:false}),
    sb.from('subscriptions').select('*').eq('user_id',user.id).order('name'),
    sb.from('budgets').select('*').eq('user_id',user.id),
    sb.from('savings_goals').select('*').eq('user_id',user.id).order('created_at'),
    sb.from('assets').select('*').eq('user_id',user.id).order('created_at'),
    sb.from('net_worth_snapshots').select('*').eq('user_id',user.id).order('snapshot_date')
  ];
  const res=await Promise.all(requests);const err=res.find(x=>x.error)?.error;
  if(err){console.error(err);loadCache();toast('Modalità cache: errore di sincronizzazione');return}
  [profile,settings]=[res[0].data,res[1].data];
  categories=res[2].data||[];transactions=res[3].data||[];subscriptions=res[4].data||[];budgets=res[5].data||[];
  goals=res[6].data||[];assets=res[7].data||[];snapshots=res[8].data||[];
  try{
    const {data:historyData,error:historyError}=await sb.from('ai_financial_reports').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(24);
    if(!historyError) aiReports=historyData||[];
    else console.warn('Storico IA non disponibile:',historyError.message);
  }catch(e){ console.warn('Storico IA non disponibile:',e); }
  saveCache();renderAll();scheduleSnapshot();setTimeout(()=>showOnboarding(false),220)
}
function saveCache(){localStorage.setItem(CACHE_PREFIX+user.id,JSON.stringify({profile,settings,categories,transactions,subscriptions,budgets,goals,assets,snapshots,aiReports}))}
function loadCache(){
  try{
    const d=JSON.parse(localStorage.getItem(CACHE_PREFIX+user.id)||'{}');
    profile=d.profile||profile;settings=d.settings||settings;categories=d.categories||[];
    transactions=d.transactions||[];subscriptions=d.subscriptions||[];budgets=d.budgets||[];
    goals=d.goals||[];assets=d.assets||[];snapshots=d.snapshots||[];aiReports=d.aiReports||[];
    renderAll();
  }catch{}
}
function subscribeRealtime(){
  sb.removeAllChannels();
  ['transactions','subscriptions','categories','budgets','savings_goals','assets','finance_settings','profiles'].forEach(t=>{
    sb.channel('rt-'+t+'-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:t,filter:t==='profiles'?`id=eq.${user.id}`:`user_id=eq.${user.id}`},()=>{
      clearTimeout(reloadTimer);reloadTimer=setTimeout(loadAll,250)
    }).subscribe()
  })
}
async function saveSnapshot(){
  if(!user||!settings)return;
  const row={user_id:user.id,snapshot_date:new Date().toISOString().slice(0,10),cash_balance:currentBalance(),assets_value:assetsTotal(),net_worth:netWorth()};
  await sb.from('net_worth_snapshots').upsert(row,{onConflict:'user_id,snapshot_date'});
}



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
  if(!remaining.length){premiumToast('Sincronizzazione completata');try{await loadAll()}catch{}}
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

function buildNotifications(){
  const list=[],now=new Date(),month=isoMonth(),t=totals();
  budgets.filter(b=>b.month.slice(0,7)===month).forEach(b=>{
    const spent=transactions.filter(x=>x.type==='EXPENSE'&&x.category===b.category&&x.occurred_at.slice(0,7)===month).reduce((s,x)=>s+Number(x.amount||0),0);
    const pct=Number(b.amount)>0?spent/Number(b.amount)*100:0;
    if(pct>=100)list.push({id:`budget-over-${b.id}`,level:'danger',icon:'fa-triangle-exclamation',title:`Budget ${b.category} superato`,text:`Hai utilizzato il ${pct.toFixed(0)}% del budget mensile.`});
    else if(pct>=80)list.push({id:`budget-near-${b.id}`,level:'warn',icon:'fa-gauge-high',title:`Budget ${b.category} quasi al limite`,text:`Hai già utilizzato il ${pct.toFixed(0)}% del budget.`});
  });
  subscriptions.filter(s=>s.active).forEach(s=>{
    const day=Number(s.billing_day||1),today=now.getDate();
    let delta=day-today;if(delta<0)delta+=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    if(delta<=3)list.push({id:`sub-${s.id}-${month}`,level:'warn',icon:'fa-repeat',title:`${s.name} tra ${delta===0?'oggi':delta+' giorni'}`,text:`Addebito previsto: ${fmt(Number(s.amount||0))}.`});
  });
  const history=completedMonthlyHistory(6),avg=averageHistory(history);
  if(avg.monthsAvailable>=3&&avg.expenses){
    const pct=(t.expense-avg.expenses)/avg.expenses*100;
    if(pct>=20)list.push({id:`spend-high-${month}`,level:'warn',icon:'fa-arrow-trend-up',title:'Spese sopra la tua media',text:`Questo mese sei circa ${pct.toFixed(0)}% sopra la media recente.`});
    if(pct<=-20)list.push({id:`spend-low-${month}`,level:'good',icon:'fa-arrow-trend-down',title:'Spese sotto la tua media',text:`Questo mese sei circa ${Math.abs(pct).toFixed(0)}% sotto la media recente.`});
  }
  goals.forEach(g=>{const p=Number(g.target_amount)>0?Number(g.current_amount||0)/Number(g.target_amount)*100:0;if(p>=80&&p<100)list.push({id:`goal-${g.id}`,level:'good',icon:'fa-bullseye',title:`Obiettivo “${g.name}” vicino`,text:`Hai raggiunto circa il ${p.toFixed(0)}% del traguardo.`})});
  finoraNotifications=list;
  renderNotificationBadge();renderHomeInsights();
  return list;
}
function notificationReadKey(){return user?.id?`finora_notifications_read_${user.id}`:'finora_notifications_read'}
function readNotificationIds(){try{return JSON.parse(localStorage.getItem(notificationReadKey())||'[]')}catch{return []}}
function unreadNotifications(){const r=new Set(readNotificationIds());return finoraNotifications.filter(n=>!r.has(n.id))}
function renderNotificationBadge(){const b=document.getElementById('notification-badge');if(!b)return;const n=unreadNotifications().length;b.textContent=n>9?'9+':n;b.classList.toggle('hidden',!n)}
function notifTone(level){return level==='danger'?'text-rose-400 bg-rose-500/10':level==='warn'?'text-amber-400 bg-amber-500/10':'text-emerald-400 bg-emerald-500/10'}
function renderNotifications(){
  const box=document.getElementById('notifications-list');if(!box)return;const list=buildNotifications();
  box.innerHTML=list.length?list.map(n=>`<div class="p-3 rounded-2xl bg-slate-900/55 border border-slate-800 flex gap-3"><div class="w-9 h-9 rounded-xl ${notifTone(n.level)} flex items-center justify-center flex-shrink-0"><i class="fa-solid ${n.icon}"></i></div><div><p class="text-sm font-bold">${esc(n.title)}</p><p class="text-xs text-slate-500 mt-1">${esc(n.text)}</p></div></div>`).join(''):'<div class="empty-state"><i class="fa-solid fa-circle-check text-emerald-400"></i><p class="text-sm font-bold mt-2">Tutto sotto controllo</p><p class="text-xs text-slate-500 mt-1">Non ci sono avvisi importanti in questo momento.</p></div>';
}

const LEGAL_CONTENT = {
  privacy: {
    title: 'Privacy',
    html: `
      <h4 class="font-bold text-base text-white mb-2">Privacy di Finora</h4>
      <p>Finora è un'app per la gestione personale delle finanze. I dati dell'account e i dati finanziari inseriti vengono archiviati nel backend Supabase associato all'app e sono protetti da regole di accesso per utente.</p>
      <p class="mt-3">La funzione di analisi IA invia alla Edge Function solo dati finanziari aggregati necessari a generare il rapporto; le descrizioni dei singoli movimenti non vengono inviate al modello IA.</p>
      <p class="mt-3">L'utente può eliminare il proprio account e i dati associati direttamente dalle Impostazioni dell'app.</p>
      <p class="mt-3 text-slate-500 text-xs">Questa è una base tecnica e dovrà essere completata con i dati legali del titolare, contatti, basi giuridiche, tempi di conservazione e fornitori prima della pubblicazione sugli store.</p>
      <p class="mt-3 text-slate-500 text-xs">Aggiornamento: settembre 2026.</p>`
  },
  terms: {
    title: 'Termini d’uso',
    html: `
      <h4 class="font-bold text-base text-white mb-2">Termini d'uso di Finora</h4>
      <p>Finora fornisce strumenti informativi per registrare e organizzare finanze personali. Le informazioni e i rapporti generati, inclusi quelli prodotti con IA, non costituiscono consulenza finanziaria, d'investimento, fiscale o legale.</p>
      <p class="mt-3">L'utente è responsabile dell'accuratezza dei dati inseriti e delle decisioni prese sulla base delle informazioni visualizzate.</p>
      <p class="mt-3 text-slate-500 text-xs">Questo documento è una bozza tecnica e dovrà essere revisionato e completato con i dati del titolare, condizioni di servizio, limitazioni di responsabilità e legge applicabile prima della distribuzione pubblica.</p>
      <p class="mt-3 text-slate-500 text-xs">Aggiornamento: settembre 2026.</p>`
  }
};
function openLegalModal(type){
  const data=LEGAL_CONTENT[type]||LEGAL_CONTENT.privacy;
  document.getElementById('legal-modal-title').textContent=data.title;
  document.getElementById('legal-modal-content').innerHTML=data.html;
  openModal('legal-modal');
}

function openNotifications(){renderNotifications();openModal('notifications-modal')}
function markNotificationsRead(){localStorage.setItem(notificationReadKey(),JSON.stringify(finoraNotifications.map(n=>n.id)));renderNotificationBadge();premiumToast('Notifiche segnate come lette')}
function renderHomeInsights(){
  const box=document.getElementById('home-insights');if(!box)return;
  const top=(finoraNotifications||[]).slice(0,3);
  box.innerHTML=top.length?top.map(n=>`<div class="insight-card"><div class="flex gap-2"><i class="fa-solid ${n.icon} ${n.level==='danger'?'text-rose-400':n.level==='warn'?'text-amber-400':'text-emerald-400'} mt-0.5"></i><div><p class="text-xs font-bold">${esc(n.title)}</p><p class="text-[11px] text-slate-500 mt-1">${esc(n.text)}</p></div></div></div>`).join(''):'<div class="insight-card sm:col-span-2 lg:col-span-3"><p class="text-xs font-bold text-emerald-400"><i class="fa-solid fa-circle-check mr-1"></i>Tutto sotto controllo</p><p class="text-[11px] text-slate-500 mt-1">Non emergono segnali particolari dai dati di questo mese.</p></div>';
}
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
        <button onclick="toggleSubscription('${s.id}',${!s.active})" class="px-2 py-1 rounded-lg text-[10px] ${s.active?'bg-emerald-500/10 text-emerald-400':'bg-slate-800 text-slate-400'}">${s.active?'Attivo':'Pausa'}</button>
        <button onclick="editSubscription('${s.id}')" class="p-2 text-slate-500 hover:text-emerald-400"><i class="fa-solid fa-pen"></i></button>
        <button onclick="deleteSubscription('${s.id}')" class="p-2 text-rose-400"><i class="fa-solid fa-trash"></i></button>
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

function renderCategories(){
  document.getElementById('categories-list').innerHTML=categories.map(c=>`<button onclick="openCategoryModalById('${c.id}')" class="px-3 py-2 rounded-xl border border-slate-800 text-xs flex items-center gap-2"><i class="fa-solid ${c.icon}" style="color:${c.color}"></i>${esc(c.name)}</button>`).join('')
}
function openCategoryModal(c=null){document.getElementById('cat-id').value=c?.id||'';document.getElementById('cat-old-name').value=c?.name||'';document.getElementById('cat-name').value=c?.name||'';document.getElementById('cat-icon').value=c?.icon||'fa-tag';document.getElementById('cat-color').value=c?.color||'#10b981';document.getElementById('cat-kind').value=c?.kind||'expense';openModal('category-modal')}
function openCategoryModalById(id){openCategoryModal(categories.find(c=>c.id===id))}
async function saveCategory(e){
  e.preventDefault();
  const id=document.getElementById('cat-id').value;
  const old=document.getElementById('cat-old-name').value;
  const row={user_id:user.id,name:document.getElementById('cat-name').value.trim().toLowerCase(),icon:document.getElementById('cat-icon').value,color:document.getElementById('cat-color').value,kind:document.getElementById('cat-kind').value};
  const backup={categories:categories.map(c=>({...c})),transactions:transactions.map(t=>({...t})),subscriptions:subscriptions.map(s=>({...s})),budgets:budgets.map(b=>({...b}))};
  let optimisticId=id;

  if(id){
    const i=categories.findIndex(c=>c.id===id);if(i!==-1)categories[i]={...categories[i],...row};
  }else{
    optimisticId=tempId('cat');categories.push({...row,id:optimisticId,is_default:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  }
  if(id&&old&&old!==row.name){
    transactions.forEach(t=>{if(t.category===old)t.category=row.name});
    subscriptions.forEach(s=>{if(s.category===old)s.category=row.name});
    budgets.forEach(b=>{if(b.category===old)b.category=row.name});
  }
  categories.sort((a,b)=>a.name.localeCompare(b.name));closeModal('category-modal');commitUI();

  try{
    if(id&&old&&old!==row.name){
      const refs=await Promise.all([
        sb.from('transactions').update({category:row.name}).eq('user_id',user.id).eq('category',old),
        sb.from('subscriptions').update({category:row.name}).eq('user_id',user.id).eq('category',old),
        sb.from('budgets').update({category:row.name}).eq('user_id',user.id).eq('category',old)
      ]);
      const refErr=refs.find(x=>x.error)?.error;if(refErr)throw refErr;
    }
    const r=id
      ? await sb.from('categories').update(row).eq('id',id).eq('user_id',user.id).select().single()
      : await sb.from('categories').insert(row).select().single();
    if(r.error)throw r.error;
    const i=categories.findIndex(c=>c.id===optimisticId||c.id===r.data.id);if(i!==-1)categories[i]=r.data;
    categories.sort((a,b)=>a.name.localeCompare(b.name));saveCache();renderAll();toast('Categoria salvata');
  }catch(error){
    categories=backup.categories;transactions=backup.transactions;subscriptions=backup.subscriptions;budgets=backup.budgets;commitUI();toast(friendly(error));
  }
}
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

function renderWealth(){
  const cash=currentBalance(),av=assetsTotal();document.getElementById('wealth-cash').textContent=fmt(cash);document.getElementById('wealth-assets').textContent=fmt(av);document.getElementById('wealth-total').textContent=fmt(cash+av);document.getElementById('wealth-saving').textContent=fmt(savings());
  document.getElementById('assets-list').innerHTML=assets.map(a=>`<div class="glass rounded-2xl p-4 flex justify-between"><div><p class="font-bold">${esc(a.name)}</p><p class="text-xs text-slate-500">${esc(a.asset_type)}</p><p class="money mt-2 text-emerald-400 font-bold">${fmt(a.value)}</p></div><div><button onclick="editAsset('${a.id}')" class="p-2 text-slate-500"><i class="fa-solid fa-pen"></i></button><button onclick="deleteAsset('${a.id}')" class="p-2 text-rose-400"><i class="fa-solid fa-trash"></i></button></div></div>`).join('')||'<p class="text-sm text-slate-500">Nessun asset.</p>';renderWealthChart()
}
function openAssetModal(a=null){document.getElementById('asset-id').value=a?.id||'';document.getElementById('asset-name').value=a?.name||'';document.getElementById('asset-type').value=a?.asset_type||'investment';document.getElementById('asset-value').value=a?.value||'';document.getElementById('asset-notes').value=a?.notes||'';openModal('asset-modal')}
function editAsset(id){openAssetModal(assets.find(a=>a.id===id))}
async function saveAsset(e){
  e.preventDefault();
  const id=document.getElementById('asset-id').value;
  const row={user_id:user.id,name:document.getElementById('asset-name').value.trim(),asset_type:document.getElementById('asset-type').value,value:Number(document.getElementById('asset-value').value),notes:document.getElementById('asset-notes').value.trim()};

  if(id){
    const i=assets.findIndex(a=>a.id===id);if(i===-1)return;const previous={...assets[i]};assets[i]={...assets[i],...row};closeModal('asset-modal');commitUI();
    const {data,error}=await sb.from('assets').update(row).eq('id',id).eq('user_id',user.id).select().single();
    if(error){const x=assets.findIndex(a=>a.id===id);if(x!==-1)assets[x]=previous;commitUI();toast(friendly(error));return;}
    const x=assets.findIndex(a=>a.id===id);if(x!==-1)assets[x]=data;saveCache();renderAll();toast('Asset salvato');return;
  }

  const optimistic={...row,id:tempId('asset'),created_at:new Date().toISOString(),updated_at:new Date().toISOString()};assets.push(optimistic);closeModal('asset-modal');commitUI();
  const {data,error}=await sb.from('assets').insert(row).select().single();
  if(error){assets=assets.filter(a=>a.id!==optimistic.id);commitUI();toast(friendly(error));return;}
  const i=assets.findIndex(a=>a.id===optimistic.id);if(i!==-1)assets[i]=data;saveCache();renderAll();toast('Asset salvato');
}
function deleteAsset(id){
  confirmAction('Eliminare asset?','Verrà rimosso dal calcolo del patrimonio.',async()=>{
    const previous=[...assets];assets=assets.filter(a=>a.id!==id);commitUI();
    const {error}=await sb.from('assets').delete().eq('id',id).eq('user_id',user.id);
    if(error){assets=previous;commitUI();toast(friendly(error));return;}
    toast('Asset eliminato');
  })
}


function analysisRange(period){
  const now=new Date();
  let start,currentEnd=new Date(now),previousStart,previousEnd;
  if(period==='year'){
    start=new Date(now.getFullYear(),0,1);
    previousStart=new Date(now.getFullYear()-1,0,1);
    previousEnd=new Date(now.getFullYear()-1,now.getMonth(),now.getDate(),23,59,59,999);
  }else{
    const months=Number(period||1);
    start=new Date(now.getFullYear(),now.getMonth()-months+1,1);
    previousStart=new Date(start.getFullYear(),start.getMonth()-months,1);
    previousEnd=new Date(start.getTime()-1);
  }
  start.setHours(0,0,0,0);currentEnd.setHours(23,59,59,999);
  return {start,end:currentEnd,previousStart,previousEnd};
}
function transactionsBetween(start,end){
  return transactions.filter(t=>{const d=new Date(t.occurred_at);return d>=start&&d<=end});
}
function aggregateTransactions(list){
  const out={income:0,expense:0,investment:0,expenseByCategory:{},investmentByCategory:{}};
  list.forEach(t=>{
    const v=Number(t.amount||0);
    if(t.type==='INCOME') out.income+=v;
    if(t.type==='EXPENSE'){
      out.expense+=v;
      out.expenseByCategory[t.category]=(out.expenseByCategory[t.category]||0)+v;
    }
    if(t.type==='INVESTMENT'){
      out.investment+=v;
      out.investmentByCategory[t.category]=(out.investmentByCategory[t.category]||0)+v;
    }
  });
  out.savings=out.income-out.expense-out.investment;
  out.savingRate=out.income>0?(out.savings/out.income*100):null;
  return out;
}
function analysisItem(text){return `<div class="flex items-start gap-2"><span class="mt-1 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0"></span><span>${esc(text)}</span></div>`}
function periodLabel(period){return period==='1'?'questo mese':period==='3'?'negli ultimi 3 mesi':period==='6'?'negli ultimi 6 mesi':'nell’anno corrente'}

function monthKeyFromDate(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function completedMonthlyHistory(maxMonths){
  const now=new Date();
  const currentMonthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const earliest=transactions.length
    ? new Date(Math.min(...transactions.map(t=>new Date(t.occurred_at).getTime()).filter(Number.isFinite)))
    : null;

  const months=[];
  for(let i=1;i<=maxMonths;i++){
    const start=new Date(currentMonthStart.getFullYear(),currentMonthStart.getMonth()-i,1);
    const end=new Date(currentMonthStart.getFullYear(),currentMonthStart.getMonth()-i+1,1);
    if(earliest && start < new Date(earliest.getFullYear(),earliest.getMonth(),1)) break;
    const list=transactions.filter(t=>{
      const d=new Date(t.occurred_at);
      return d>=start&&d<end;
    });
    months.push({key:monthKeyFromDate(start),data:aggregateTransactions(list)});
  }
  return months.reverse();
}

function averageHistory(months){
  if(!months.length) return {
    monthsAvailable:0, income:null, expenses:null, investments:null, netSavings:null, savingRate:null, expensesByCategory:{}
  };

  const sum={income:0,expense:0,investment:0,savings:0};
  const cats={};
  let savingRateSum=0,savingRateCount=0;

  months.forEach(m=>{
    sum.income+=m.data.income;
    sum.expense+=m.data.expense;
    sum.investment+=m.data.investment;
    sum.savings+=m.data.savings;
    if(m.data.savingRate!==null){savingRateSum+=m.data.savingRate;savingRateCount++}
    Object.entries(m.data.expenseByCategory).forEach(([cat,val])=>cats[cat]=(cats[cat]||0)+Number(val||0));
  });

  const n=months.length;
  return {
    monthsAvailable:n,
    income:Number((sum.income/n).toFixed(2)),
    expenses:Number((sum.expense/n).toFixed(2)),
    investments:Number((sum.investment/n).toFixed(2)),
    netSavings:Number((sum.savings/n).toFixed(2)),
    savingRate:savingRateCount?Number((savingRateSum/savingRateCount).toFixed(1)):null,
    expensesByCategory:Object.fromEntries(Object.entries(cats).map(([cat,val])=>[cat,Number((val/n).toFixed(2))]))
  };
}

function categoryTrendsFromHistory(months){
  if(months.length<3) return [];
  const cats=[...new Set(months.flatMap(m=>Object.keys(m.data.expenseByCategory)))];
  return cats.map(category=>{
    const values=months.map(m=>Number(m.data.expenseByCategory[category]||0));
    const split=Math.max(1,Math.floor(values.length/2));
    const first=values.slice(0,split);
    const second=values.slice(split);
    const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
    const firstAvg=avg(first),secondAvg=avg(second);
    const changePct=firstAvg>0?((secondAvg-firstAvg)/firstAvg*100):(secondAvg>0?100:null);
    return {category,changePct:changePct===null?null:Number(changePct.toFixed(1)),recentAverage:Number(secondAvg.toFixed(2))};
  }).filter(x=>x.changePct!==null&&Math.abs(x.changePct)>=20&&x.recentAverage>0)
    .sort((a,b)=>Math.abs(b.changePct)-Math.abs(a.changePct)).slice(0,6);
}

function buildAggregatedAnalysisPayload(period){
  const range=analysisRange(period);
  const current=aggregateTransactions(transactionsBetween(range.start,range.end));
  const previous=aggregateTransactions(transactionsBetween(range.previousStart,range.previousEnd));
  const currentExpenses=Object.entries(current.expenseByCategory).sort((a,b)=>b[1]-a[1]).map(([category,amount])=>({category,amount:Number(amount.toFixed(2))}));
  const previousExpenses=Object.entries(previous.expenseByCategory).sort((a,b)=>b[1]-a[1]).map(([category,amount])=>({category,amount:Number(amount.toFixed(2))}));
  const activeSubs=subscriptions.filter(s=>s.active);
  const subsMonthly=activeSubs.reduce((s,x)=>s+Number(x.amount||0),0);

  const history6=completedMonthlyHistory(6);
  const history3=history6.slice(-3);
  const avg3=averageHistory(history3);
  const avg6=averageHistory(history6);

  const currentVsAvg={};
  Object.entries(current.expenseByCategory).forEach(([cat,val])=>{
    const base=avg6.expensesByCategory[cat];
    if(base!==undefined&&base>0){
      currentVsAvg[cat]=Number(((Number(val)-base)/base*100).toFixed(1));
    }
  });

  const thisMonth=isoMonth();
  const budgetRows=period==='1'?budgets.filter(b=>b.month.slice(0,7)===thisMonth).map(b=>{
    const spent=transactions.filter(t=>t.type==='EXPENSE'&&t.category===b.category&&t.occurred_at.slice(0,7)===thisMonth).reduce((s,t)=>s+Number(t.amount||0),0);
    return {category:b.category,budget:Number(b.amount||0),spent:Number(spent.toFixed(2)),remaining:Number((Number(b.amount||0)-spent).toFixed(2))};
  }):[];

  return {
    period: periodLabel(period),
    currency:'EUR',
    totals:{
      income:Number(current.income.toFixed(2)),
      expenses:Number(current.expense.toFixed(2)),
      investments:Number(current.investment.toFixed(2)),
      netSavings:Number(current.savings.toFixed(2)),
      savingRate:current.savingRate===null?null:Number(current.savingRate.toFixed(1))
    },
    previousTotals:{
      income:Number(previous.income.toFixed(2)),
      expenses:Number(previous.expense.toFixed(2)),
      investments:Number(previous.investment.toFixed(2)),
      netSavings:Number(previous.savings.toFixed(2)),
      savingRate:previous.savingRate===null?null:Number(previous.savingRate.toFixed(1))
    },
    personalAverages:{
      last3CompletedMonths:avg3,
      last6CompletedMonths:avg6,
      note:'Le medie usano solo mesi di calendario completati precedenti al mese corrente. monthsAvailable indica quanti mesi storici erano realmente disponibili.'
    },
    categoryComparisonVs6MonthAverage:currentVsAvg,
    persistentCategoryTrends:categoryTrendsFromHistory(history6),
    expensesByCategory:currentExpenses,
    previousExpensesByCategory:previousExpenses,
    subscriptions:{activeCount:activeSubs.length,monthlyTotal:Number(subsMonthly.toFixed(2))},
    budgets:budgetRows
  };
}

function formatAIReport(text){
  if(!text) return '';
  let safe=esc(String(text)).replace(/\r\n/g,'\n');

  // Titoli Markdown: ## Titolo -> titolo grafico senza mostrare #
  safe=safe.replace(/^#{1,6}\s+(.+)$/gm,
    '<h4 class="text-base font-bold text-white mt-5 mb-2">$1</h4>');

  // Grassetto Markdown
  safe=safe.replace(/\*\*(.+?)\*\*/g,'<strong class="font-bold text-white">$1</strong>');

  // Liste semplici
  const lines=safe.split('\n');
  let result=[];
  let inList=false;
  for(const line of lines){
    const m=line.match(/^\s*[-•]\s+(.+)$/);
    if(m){
      if(!inList){ result.push('<ul class="list-disc pl-5 space-y-1.5 my-2">'); inList=true; }
      result.push('<li>'+m[1]+'</li>');
    }else{
      if(inList){ result.push('</ul>'); inList=false; }
      if(line.trim()===''){
        result.push('<div class="h-2"></div>');
      }else if(/^<h4 /.test(line)){
        result.push(line);
      }else{
        result.push('<p class="mb-2">'+line+'</p>');
      }
    }
  }
  if(inList) result.push('</ul>');
  return result.join('');
}


function aiPeriodKey(period){
  const now=new Date();
  const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if(period==='1') return ym;
  if(period==='3') return `3m-${ym}`;
  if(period==='6') return `6m-${ym}`;
  return `year-${now.getFullYear()}`;
}

function toggleAIHistory(){
  const box=document.getElementById('ai-history');
  box.classList.toggle('hidden');
  if(!box.classList.contains('hidden')) renderAIHistory();
}

function aiHistoryTrend(current,index){
  const older=aiReports.slice(index+1).find(r=>r.period_type==='1');
  if(current.period_type!=='1'||!older) return '';
  const delta=Number(current.net_savings||0)-Number(older.net_savings||0);
  if(Math.abs(delta)<0.01) return '≈ invariato';
  return `${delta>0?'▲':'▼'} ${fmt(Math.abs(delta))} vs precedente`;
}

function renderAIHistory(){
  const box=document.getElementById('ai-history');
  if(!box) return;
  if(!aiReports.length){
    box.innerHTML='<div class="p-4 rounded-2xl bg-slate-900/50 text-xs text-slate-500 text-center">Nessun rapporto salvato ancora.</div>';
    return;
  }
  box.innerHTML=aiReports.slice(0,12).map((r,i)=>{
    const trend=aiHistoryTrend(r,i);
    const created=new Date(r.created_at).toLocaleDateString('it-IT',{day:'2-digit',month:'short',year:'numeric'});
    const score=r.score==null?'—':`${r.score}/100`;
    const rate=r.saving_rate==null?'—':`${Number(r.saving_rate).toFixed(0)}%`;
    return `<button onclick="openAIHistoryReport('${r.id}')" class="w-full text-left p-3.5 rounded-2xl bg-slate-900/55 border border-slate-800 hover:border-emerald-500/30 transition">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-bold text-slate-200">${esc(r.period_label||r.period_key)}</p>
          <p class="text-[10px] text-slate-500 mt-1">${created} · ${esc(r.model||'OpenRouter')}</p>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="text-xs font-bold ${Number(r.net_savings)>=0?'text-emerald-400':'text-rose-400'}">${fmt(Number(r.net_savings||0))}</p>
          <p class="text-[10px] text-slate-500">${trend}</p>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2 mt-3 text-[10px]">
        <div class="rounded-xl bg-slate-950/60 p-2"><span class="text-slate-500">Score</span><div class="font-bold text-slate-300 mt-0.5">${score}</div></div>
        <div class="rounded-xl bg-slate-950/60 p-2"><span class="text-slate-500">Risparmio</span><div class="font-bold text-slate-300 mt-0.5">${rate}</div></div>
        <div class="rounded-xl bg-slate-950/60 p-2"><span class="text-slate-500">Spese</span><div class="font-bold text-slate-300 mt-0.5">${fmt(Number(r.expenses||0))}</div></div>
      </div>
    </button>`;
  }).join('');
}

function openAIHistoryReport(id){
  const r=aiReports.find(x=>x.id===id);if(!r)return;
  document.getElementById('history-report-title').textContent=r.period_label||'Rapporto IA';
  document.getElementById('history-report-meta').textContent=`${new Date(r.created_at).toLocaleString('it-IT')} · ${r.model||'OpenRouter'}`;
  document.getElementById('history-report-body').innerHTML=formatAIReport(r.report_text||'');
  document.getElementById('history-report-score').textContent=r.score==null?'—':`${r.score}/100`;
  document.getElementById('history-report-saving').textContent=r.saving_rate==null?'—':`${Number(r.saving_rate).toFixed(0)}%`;
  document.getElementById('history-report-net').textContent=fmt(Number(r.net_savings||0));
  document.getElementById('history-delete-btn').onclick=()=>deleteAIHistoryReport(id);
  openModal('ai-history-modal');
}

async function saveAIReport(period,payload,data){
  if(!user||!data?.report) return;
  const scoreText=document.getElementById('analysis-score')?.textContent||'';
  const score=parseInt(scoreText,10);
  const row={
    user_id:user.id,
    period_key:aiPeriodKey(period),
    period_type:String(period),
    period_label:periodLabel(period),
    report_text:data.report,
    model:data.model||'openrouter/free',
    score:Number.isFinite(score)?score:null,
    saving_rate:payload.totals.savingRate,
    income:payload.totals.income,
    expenses:payload.totals.expenses,
    investments:payload.totals.investments,
    net_savings:payload.totals.netSavings
  };
  const {data:saved,error}=await sb.from('ai_financial_reports').upsert(row,{onConflict:'user_id,period_key'}).select().single();
  if(error){console.warn('Salvataggio storico IA:',error.message);return}
  aiReports=[saved,...aiReports.filter(x=>x.id!==saved.id&&x.period_key!==saved.period_key)].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  saveCache();renderAIHistory();
}

async function deleteAIHistoryReport(id){
  const old=[...aiReports];
  aiReports=aiReports.filter(x=>x.id!==id);renderAIHistory();closeModal('ai-history-modal');saveCache();
  const {error}=await sb.from('ai_financial_reports').delete().eq('id',id).eq('user_id',user.id);
  if(error){aiReports=old;renderAIHistory();saveCache();toast('Impossibile eliminare il rapporto.');}
  else toast('Rapporto eliminato.');
}

async function runAIFinancialAnalysis(){
  const period=document.getElementById('analysis-period').value;
  runFinancialAnalysis();

  const reportCard=document.getElementById('ai-report-card');
  const report=document.getElementById('ai-report');
  const modelLabel=document.getElementById('ai-model-label');
  const sourceNote=document.getElementById('analysis-source-note');
  reportCard.classList.remove('hidden');
  document.getElementById('analysis-local-summary-card')?.classList.remove('hidden');
      document.getElementById('analysis-detail-panels')?.classList.remove('analysis-detail-collapsed');
      document.getElementById('analysis-toggle-details')?.classList.add('hidden');
  report.textContent='Sto preparando il rapporto IA…';
  modelLabel.textContent='';

  try{
    const payload=buildAggregatedAnalysisPayload(period);
    const {data,error}=await sb.functions.invoke('financial-analysis',{body:payload});
    if(error) throw error;

    if(data?.ok===false){
      const detail=data?.diagnostic?.message||'Nessun modello gratuito disponibile';
      const code=data?.diagnostic?.status?`HTTP ${data.diagnostic.status}`:'';
      report.textContent=`OpenRouter non ha completato il rapporto. ${detail}${code?' ('+code+')':''}. Ti mostro comunque l’analisi locale completa.`;
      modelLabel.textContent=data?.diagnostic?.attempts?`Fallback dopo ${data.diagnostic.attempts} tentativi`:'Fallback locale';
      document.getElementById('analysis-local-summary-card')?.classList.remove('hidden');
      sourceNote.textContent='Diagnostica ricevuta dalla Edge Function. Nessuna chiave API viene esposta al browser.';
      return;
    }

    if(!data?.report) throw new Error('Risposta IA non valida');
    report.innerHTML=formatAIReport(data.report);
    modelLabel.textContent=data.model?`Modello: ${data.model}`:'OpenRouter';
    await saveAIReport(period,payload,data);
    document.getElementById('analysis-local-summary-card')?.classList.add('hidden');
    document.getElementById('analysis-detail-panels')?.classList.add('analysis-detail-collapsed');
    document.getElementById('analysis-toggle-details')?.classList.remove('hidden');
    sourceNote.textContent=data.attempts>1?`Rapporto generato dopo ${data.attempts} tentativi. Non costituisce consulenza finanziaria o di investimento.`:'Il rapporto IA usa solo dati aggregati del periodo selezionato. Non costituisce consulenza finanziaria o di investimento.';
  }catch(e){
    console.warn('OpenRouter analysis fallback:',e);
    report.textContent='La Edge Function non è raggiungibile o ha restituito un errore inatteso. Ti mostro comunque l’analisi locale completa.';
    modelLabel.textContent='Fallback locale';
    document.getElementById('analysis-local-summary-card')?.classList.remove('hidden');
    sourceNote.textContent='Controlla i log della funzione financial-analysis su Supabase per il dettaglio tecnico.';
  }
}

function runFinancialAnalysis(){
  const period=document.getElementById('analysis-period').value;
  const range=analysisRange(period);
  const current=aggregateTransactions(transactionsBetween(range.start,range.end));
  const previous=aggregateTransactions(transactionsBetween(range.previousStart,range.previousEnd));
  const label=periodLabel(period);
  const good=[],watch=[],tips=[];

  const expenseRows=Object.entries(current.expenseByCategory).sort((a,b)=>b[1]-a[1]);
  const top=expenseRows[0]||null;
  const second=expenseRows[1]||null;
  const expenseChange=previous.expense>0?((current.expense-previous.expense)/previous.expense*100):null;
  const incomeChange=previous.income>0?((current.income-previous.income)/previous.income*100):null;
  const investmentRate=current.income>0?(current.investment/current.income*100):0;
  const activeSubs=subscriptions.filter(s=>s.active);
  const subsMonthly=activeSubs.reduce((s,x)=>s+Number(x.amount||0),0);

  let score=65;
  if(current.income<=0){score-=10;watch.push('Non risultano entrate nel periodo selezionato: il confronto è quindi limitato.');}
  if(current.savingRate!==null){
    if(current.savingRate>=20){score+=18;good.push(`Hai mantenuto un margine di risparmio del ${current.savingRate.toFixed(0)}% delle entrate.`)}
    else if(current.savingRate>=10){score+=10;good.push(`Il saldo tra entrate e uscite resta positivo, con un margine del ${current.savingRate.toFixed(0)}%.`)}
    else if(current.savingRate>=0){score+=2;watch.push(`Il margine di risparmio è contenuto (${current.savingRate.toFixed(0)}%).`)}
    else {score-=25;watch.push(`Nel periodo le uscite complessive superano le entrate di ${fmt(Math.abs(current.savings))}.`)}
  }

  if(expenseChange!==null){
    if(expenseChange<=-8){score+=7;good.push(`Le spese sono diminuite del ${Math.abs(expenseChange).toFixed(0)}% rispetto al periodo precedente.`)}
    else if(expenseChange>=15){score-=8;watch.push(`Le spese sono aumentate del ${expenseChange.toFixed(0)}% rispetto al periodo precedente.`)}
  }
  if(incomeChange!==null&&incomeChange>=10) good.push(`Le entrate sono cresciute del ${incomeChange.toFixed(0)}% rispetto al periodo precedente.`);
  if(current.investment>0) good.push(`Hai destinato ${fmt(current.investment)} agli investimenti (${investmentRate.toFixed(0)}% delle entrate del periodo).`);

  if(top){
    const share=current.expense>0?top[1]/current.expense*100:0;
    watch.push(`La categoria di spesa principale è “${top[0]}”: ${fmt(top[1])}, pari al ${share.toFixed(0)}% delle spese.`);
    const prevTop=previous.expenseByCategory[top[0]]||0;
    if(prevTop>0){
      const ch=(top[1]-prevTop)/prevTop*100;
      if(ch>=20) watch.push(`“${top[0]}” è cresciuta del ${ch.toFixed(0)}% rispetto al periodo precedente.`);
      if(ch<=-15) good.push(`“${top[0]}” è scesa del ${Math.abs(ch).toFixed(0)}% rispetto al periodo precedente.`);
    }
  }

  if(period==='1'){
    const thisMonth=isoMonth();
    const over=[];
    budgets.filter(b=>b.month.slice(0,7)===thisMonth).forEach(b=>{
      const spent=transactions.filter(t=>t.type==='EXPENSE'&&t.category===b.category&&t.occurred_at.slice(0,7)===thisMonth).reduce((s,t)=>s+Number(t.amount),0);
      if(spent>Number(b.amount)) over.push({category:b.category,over:spent-Number(b.amount)});
    });
    if(over.length){score-=Math.min(12,over.length*4);over.slice(0,2).forEach(x=>watch.push(`Budget “${x.category}” superato di ${fmt(x.over)}.`));}
    else if(budgets.some(b=>b.month.slice(0,7)===thisMonth)){score+=5;good.push('I budget impostati per il mese risultano rispettati.');}
  }

  if(activeSubs.length&&current.income>0){
    const subShare=subsMonthly/current.income*100;
    if(subShare>=10) watch.push(`Gli abbonamenti attivi valgono circa ${fmt(subsMonthly)} al mese (${subShare.toFixed(0)}% delle entrate del periodo).`);
    else good.push(`Gli abbonamenti attivi incidono per circa ${fmt(subsMonthly)} al mese.`);
  }

  if(top&&current.expense>0){
    const cut=top[1]*0.15;
    tips.push(`Valuta se puoi ridurre del 15% la categoria “${top[0]}”: libereresti circa ${fmt(cut)} ${label}.`);
  }
  if(second&&current.expense>0&&second[1]/current.expense>=0.15) tips.push(`Anche “${second[0]}” pesa in modo rilevante: controlla le singole spese per distinguere quelle necessarie da quelle comprimibili.`);
  if(current.savingRate!==null&&current.savingRate<10) tips.push('Prova a fissare un piccolo budget sulle 1–2 categorie discrezionali più alte prima dell’inizio del prossimo mese.');
  if(activeSubs.length>=3) tips.push(`Hai ${activeSubs.length} abbonamenti attivi: una revisione periodica può aiutarti a individuare servizi poco utilizzati.`);
  if(!budgets.length) tips.push('Impostare almeno un budget sulle categorie più variabili rende più semplice controllare gli sforamenti.');
  if(current.investment>0) tips.push('Tieni separati consumo e investimenti: l’app li distingue già, così il risparmio mensile è più leggibile.');

  if(!good.length) good.push('Hai registrato i movimenti: avere dati aggiornati è il primo passo per capire dove intervenire.');
  if(!watch.length) watch.push('Non emergono anomalie evidenti dai dati disponibili nel periodo selezionato.');
  if(!tips.length) tips.push('Mantieni le categorie aggiornate e confronta periodicamente i dati con il periodo precedente.');

  score=Math.max(0,Math.min(100,Math.round(score)));
  const scoreEl=document.getElementById('analysis-score');
  scoreEl.textContent=score+'/100';
  scoreEl.className='text-xl font-extrabold mt-1 '+(score>=80?'text-emerald-400':score>=60?'text-amber-400':'text-rose-400');
  document.getElementById('analysis-saving-rate').textContent=current.savingRate===null?'—':current.savingRate.toFixed(0)+'%';
  document.getElementById('analysis-expenses').textContent=fmt(current.expense);
  const savingsEl=document.getElementById('analysis-savings');
  savingsEl.textContent=fmt(current.savings);savingsEl.className='money text-xl font-extrabold mt-1 '+(current.savings>=0?'text-emerald-400':'text-rose-400');
  document.getElementById('analysis-good').innerHTML=good.slice(0,4).map(analysisItem).join('');
  document.getElementById('analysis-watch').innerHTML=watch.slice(0,4).map(analysisItem).join('');
  document.getElementById('analysis-tips').innerHTML=tips.slice(0,4).map(analysisItem).join('');

  let summary=`${label.charAt(0).toUpperCase()+label.slice(1)} hai registrato ${fmt(current.income)} di entrate, ${fmt(current.expense)} di spese e ${fmt(current.investment)} di investimenti.`;
  summary+=` Il risultato netto del periodo è ${current.savings>=0?'positivo per ':'negativo per '}${fmt(Math.abs(current.savings))}.`;
  if(top) summary+=` La voce di spesa più rilevante è “${top[0]}” con ${fmt(top[1])}.`;
  if(expenseChange!==null) summary+=` Rispetto al periodo precedente, le spese sono ${expenseChange>=0?'aumentate':'diminuite'} del ${Math.abs(expenseChange).toFixed(0)}%.`;
  document.getElementById('analysis-summary').textContent=summary;

  document.getElementById('analysis-empty').classList.add('hidden');
  document.getElementById('analysis-result').classList.remove('hidden');
}

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
function renderCharts(){
  const months=[];for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);months.push(isoMonth(d))}
  const labels=months.map(m=>new Date(m+'-01').toLocaleDateString('it-IT',{month:'short'}));
  const inc=months.map(m=>totals(m).income),exp=months.map(m=>totals(m).expense),inv=months.map(m=>totals(m).investment);
  if(charts.monthly)charts.monthly.destroy();charts.monthly=new Chart(document.getElementById('monthly-chart'),{type:'bar',data:{labels,datasets:[{label:'Entrate',data:inc},{label:'Spese',data:exp},{label:'Investimenti',data:inv}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#94a3b8'}}},scales:{x:{ticks:{color:'#94a3b8'},grid:{display:false}},y:{ticks:{color:'#94a3b8'},grid:{color:'rgba(148,163,184,.08)'}}}}});
  const m=monthTx().filter(t=>t.type==='EXPENSE'),map={};m.forEach(t=>map[t.category]=(map[t.category]||0)+Number(t.amount));if(charts.category)charts.category.destroy();charts.category=new Chart(document.getElementById('category-chart'),{type:'doughnut',data:{labels:Object.keys(map),datasets:[{data:Object.values(map)}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#94a3b8',boxWidth:10}}}}})
}
function renderWealthChart(){
  if(charts.wealth)charts.wealth.destroy();charts.wealth=new Chart(document.getElementById('wealth-chart'),{type:'line',data:{labels:snapshots.map(s=>new Date(s.snapshot_date).toLocaleDateString('it-IT')),datasets:[{label:'Patrimonio',data:snapshots.map(s=>Number(s.net_worth)),tension:.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#94a3b8'}}},scales:{x:{ticks:{color:'#94a3b8'}},y:{ticks:{color:'#94a3b8'}}}}})
}

function download(name,text,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
function exportCSV(){const rows=[['data','tipo','importo','categoria','descrizione'],...transactions.map(t=>[t.occurred_at,t.type,t.amount,t.category,(t.description||'').replaceAll('"','""')])];download('transazioni.csv',rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n'),'text/csv')}
function exportBackup(){download('gestione-finanze-backup.json',JSON.stringify({version:2,profile,settings,categories,transactions,subscriptions,budgets,goals,assets},null,2),'application/json')}
async function importBackup(e){
  const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());for(const [table,rows] of [['categories',d.categories],['transactions',d.transactions],['subscriptions',d.subscriptions],['budgets',d.budgets],['savings_goals',d.goals],['assets',d.assets]]){if(rows?.length){const clean=rows.map(r=>({...r,user_id:user.id}));const{error}=await sb.from(table).upsert(clean);if(error)throw error}}toast('Backup importato')}catch(x){toast(friendly(x))}e.target.value=''
}
async function importCSV(e){
  const f=e.target.files[0];if(!f)return;try{const lines=(await f.text()).split(/\r?\n/).filter(Boolean);if(lines.length<2)throw new Error('CSV vuoto');const rows=lines.slice(1).map(line=>{const cols=line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v=>v.replace(/^"|"$/g,'').replaceAll('""','"'))||[];return{user_id:user.id,occurred_at:new Date(cols[0]).toISOString(),type:String(cols[1]).toUpperCase(),amount:Number(String(cols[2]).replace(',','.')),category:String(cols[3]||'spesa').toLowerCase(),description:cols[4]||'',source:'import'}}).filter(r=>['INCOME','EXPENSE','INVESTMENT'].includes(r.type)&&r.amount>0);const{error}=await sb.from('transactions').insert(rows);if(error)throw error;toast(`${rows.length} movimenti importati`)}catch(x){toast(friendly(x))}e.target.value=''
}


let viewportFixTimer=null;
function refreshVisibleChartsAfterResize(){
  clearTimeout(viewportFixTimer);
  viewportFixTimer=setTimeout(()=>{
    // iOS può lasciare i canvas con le dimensioni della precedente orientazione.
    // Ricreiamo soltanto i grafici della pagina attualmente visibile.
    const home=document.getElementById('page-home');
    const wealth=document.getElementById('page-wealth');

    if(home && home.classList.contains('active')){
      try{ renderCharts(); }catch(e){ console.warn('Chart resize home:',e); }
    }
    if(wealth && wealth.classList.contains('active')){
      try{ renderWealthChart(); }catch(e){ console.warn('Chart resize wealth:',e); }
    }

    // Secondo passaggio dopo che Safari ha terminato il nuovo layout.
    setTimeout(()=>{
      try{ charts.monthly?.resize(); }catch{}
      try{ charts.category?.resize(); }catch{}
      try{ charts.wealth?.resize(); }catch{}
    },180);
  },220);
}

window.addEventListener('orientationchange',()=>{
  refreshVisibleChartsAfterResize();
  setTimeout(refreshVisibleChartsAfterResize,450);
});

window.addEventListener('resize',refreshVisibleChartsAfterResize,{passive:true});

// Su iOS visualViewport è spesso più affidabile del solo window.resize.
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',refreshVisibleChartsAfterResize,{passive:true});
}

document.addEventListener('DOMContentLoaded',()=>{document.getElementById('budget-month').value=isoMonth();updateNetworkStatus();init();setTimeout(flushTxQueue,1200)});
