// Finora — Chart.js rendering and viewport/orientation handling
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

