// Finora — authentication, data loading, cache and realtime
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
  localStorage.setItem(FINORA_LAST_LOAD_KEY,new Date().toISOString());
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



