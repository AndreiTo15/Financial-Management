// Finora — notifications and legal modal helpers
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
