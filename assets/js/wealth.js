// Finora — assets and net worth
function renderWealth(){
  const cash=currentBalance(),av=assetsTotal();document.getElementById('wealth-cash').textContent=fmt(cash);document.getElementById('wealth-assets').textContent=fmt(av);document.getElementById('wealth-total').textContent=fmt(cash+av);document.getElementById('wealth-saving').textContent=fmt(savings());
  document.getElementById('assets-list').innerHTML=assets.map(a=>`<div class="glass rounded-2xl p-4 flex justify-between"><div><p class="font-bold">${esc(a.name)}</p><p class="text-xs text-slate-500">${esc(a.asset_type)}</p><p class="money mt-2 text-emerald-400 font-bold">${fmt(a.value)}</p></div><div><button data-action="edit-asset" data-id="${a.id}" class="p-2 text-slate-500"><i class="fa-solid fa-pen"></i></button><button data-action="delete-asset" data-id="${a.id}" class="p-2 text-rose-400"><i class="fa-solid fa-trash"></i></button></div></div>`).join('')||'<p class="text-sm text-slate-500">Nessun asset.</p>';renderWealthChart()
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


