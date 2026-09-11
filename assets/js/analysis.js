// Finora — local/AI financial analysis and report history
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
    return `<button data-action="open-ai-history-report" data-id="${r.id}" class="w-full text-left p-3.5 rounded-2xl bg-slate-900/55 border border-slate-800 hover:border-emerald-500/30 transition">
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
  const deleteBtn=document.getElementById('history-delete-btn');
  if(deleteBtn._finoraDeleteHandler)deleteBtn.removeEventListener('click',deleteBtn._finoraDeleteHandler);
  deleteBtn._finoraDeleteHandler=()=>deleteAIHistoryReport(id);
  deleteBtn.addEventListener('click',deleteBtn._finoraDeleteHandler);
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

    // Ensure the browser is still holding a valid Supabase session before
    // invoking the authenticated Edge Function.
    const {data:sessionData,error:sessionError}=await sb.auth.getSession();
    if(sessionError) throw sessionError;
    if(!sessionData?.session) throw new Error('Sessione Supabase non disponibile. Effettua nuovamente il login.');

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

    let detail='Errore sconosciuto';
    let status='';
    let hint='';

    try{
      detail=e?.message||e?.error_description||e?.context?.statusText||String(e);
      status=e?.context?.status?`HTTP ${e.context.status}`:'';

      if(/Failed to send a request|fetch|network/i.test(detail)){
        hint='La chiamata non ha raggiunto correttamente la Edge Function. Verifica connessione, deploy della funzione e configurazione Supabase.';
      }else if(/401|JWT|unauthorized|invalid.*token/i.test(`${status} ${detail}`)){
        hint='La sessione Supabase potrebbe essere scaduta o la chiave Publishable del frontend non corrisponde al progetto.';
      }else if(/404|not found/i.test(`${status} ${detail}`)){
        hint='La Edge Function "financial-analysis" non risulta disponibile nel progetto Supabase configurato.';
      }else if(/500|502|503|504/i.test(`${status} ${detail}`)){
        hint='La Edge Function è stata raggiunta ma ha avuto un errore server. Controlla i log Supabase e il secret OPENROUTER_API_KEY.';
      }
    }catch{}

    report.innerHTML=`
      <p>Il rapporto IA non è stato generato, ma l’analisi locale resta disponibile.</p>
      <div id="ai-error-details" class="mt-3 p-3 rounded-xl border text-xs">
        <strong>Dettaglio tecnico:</strong> ${esc([status,detail].filter(Boolean).join(' · '))}
        ${hint?`<br><span class="opacity-80">${esc(hint)}</span>`:''}
      </div>`;

    modelLabel.textContent='Fallback locale';
    document.getElementById('analysis-local-summary-card')?.classList.remove('hidden');
    sourceNote.textContent='Il dettaglio tecnico sopra serve a capire se il problema è frontend, autenticazione o Edge Function.';
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

