// Finora — shared application state
let sb=null,user=null,profile=null,settings=null;
let transactions=[],subscriptions=[],categories=[],budgets=[],goals=[],assets=[],snapshots=[],aiReports=[];
let charts={monthly:null,category:null,wealth:null};
let privacy=false,recovery=false,reloadTimer=null;
const money=new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'});
const CACHE_PREFIX='finance_v2_cache_';

