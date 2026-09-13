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

// Viewport handling
// Su mobile la barra del browser cambia altezza mentre si scorre e genera numerosi
// eventi `resize` / `visualViewport.resize`. Ricreare i grafici in quei casi
// provocava il refresh visibile 3-4 volte durante lo scroll della Home.
//
// Regola:
// - scroll / variazioni della sola altezza: ignorate;
// - variazioni reali della larghezza: semplice Chart.resize();
// - cambio orientamento: ricreazione controllata una sola volta.
let chartViewportTimer=null;
let lastChartViewportWidth=Math.round(window.visualViewport?.width||window.innerWidth||0);

function resizeVisibleCharts(){
  const home=document.getElementById('page-home');
  const wealth=document.getElementById('page-wealth');

  if(home?.classList.contains('active')){
    try{ charts.monthly?.resize(); }catch{}
    try{ charts.category?.resize(); }catch{}
  }
  if(wealth?.classList.contains('active')){
    try{ charts.wealth?.resize(); }catch{}
  }
}

function handleChartViewportResize(){
  const currentWidth=Math.round(window.visualViewport?.width||window.innerWidth||0);
  const widthDelta=Math.abs(currentWidth-lastChartViewportWidth);

  // Safari/iOS modifica soprattutto l'altezza del viewport quando la toolbar
  // compare/scompare durante lo scroll. In quel caso non tocchiamo i canvas.
  if(widthDelta<12) return;

  lastChartViewportWidth=currentWidth;
  clearTimeout(chartViewportTimer);
  chartViewportTimer=setTimeout(resizeVisibleCharts,120);
}

function rebuildVisibleChartsAfterOrientation(){
  clearTimeout(chartViewportTimer);
  chartViewportTimer=setTimeout(()=>{
    lastChartViewportWidth=Math.round(window.visualViewport?.width||window.innerWidth||0);

    const home=document.getElementById('page-home');
    const wealth=document.getElementById('page-wealth');

    if(home?.classList.contains('active')){
      try{ renderCharts(); }catch(e){ console.warn('Chart orientation home:',e); }
    }
    if(wealth?.classList.contains('active')){
      try{ renderWealthChart(); }catch(e){ console.warn('Chart orientation wealth:',e); }
    }

    // Ultimo resize dopo che Safari ha assestato il layout.
    setTimeout(resizeVisibleCharts,180);
  },260);
}

window.addEventListener('orientationchange',rebuildVisibleChartsAfterOrientation,{passive:true});
window.addEventListener('resize',handleChartViewportResize,{passive:true});

if(window.visualViewport){
  window.visualViewport.addEventListener('resize',handleChartViewportResize,{passive:true});
}
