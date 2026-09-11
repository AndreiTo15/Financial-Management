// Finora — categories
function renderCategories(){
  document.getElementById('categories-list').innerHTML=categories.map(c=>`<button data-action="edit-category" data-id="${c.id}" class="px-3 py-2 rounded-xl border border-slate-800 text-xs flex items-center gap-2"><i class="fa-solid ${c.icon}" style="color:${c.color}"></i>${esc(c.name)}</button>`).join('')
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
