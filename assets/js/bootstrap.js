// Finora — application bootstrap
document.addEventListener('DOMContentLoaded',()=>{document.getElementById('budget-month').value=isoMonth();updateNetworkStatus();init();setTimeout(flushTxQueue,1200)});
