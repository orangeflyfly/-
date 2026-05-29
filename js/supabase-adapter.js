// Supabase 接入設定：只放 anon key，切勿把 service role key 放在前端。
const SUPABASE_CONFIG={
  url:'https://tbxmccytrcyuqlgedgoy.supabase.co',
  anonKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRieG1jY3l0cmN5dXFsZ2VkZ295Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDMyNzIsImV4cCI6MjA5NTU3OTI3Mn0.Meyd1QSzVQYxTidmC4kL16ZoVBxLSXMvFF9F7Iim89U'
};
window.SUPABASE_CONFIG=SUPABASE_CONFIG;

function useSupabase(){
  return !!(SUPABASE_CONFIG.url&&SUPABASE_CONFIG.anonKey&&window.supabase);
}
function supabaseClient(){
  if(!useSupabase())return null;
  if(!window._imsSupabaseClient){
    window._imsSupabaseClient=window.supabase.createClient(SUPABASE_CONFIG.url,SUPABASE_CONFIG.anonKey);
  }
  return window._imsSupabaseClient;
}
function mapDbItemToAppItem(row){
  return{
    id:row.id,
    partNo:row.part_no||'',
    name:row.name||'',
    spec:row.spec||'',
    type:row.type==='material'?'package':row.type,
    unit:row.unit||'個',
    stock:toQty(row.stock),
    minStock:toQty(row.min_stock),
    purchaseCycleDays:parseInt(row.purchase_cycle_days,10)||0,
    supplier:row.supplier_note||'',
    supplierNote:row.supplier_note||'',
    active:row.active!==false,
    color:'',
    pattern:'',
    warehouse:'',
    waste:0
  };
}
function mapAppItemToDbItem(item){
  return{
    part_no:String(item.partNo||'').trim()||null,
    name:String(item.name||'').trim(),
    spec:String(item.spec||'').trim(),
    type:item.type==='material'?'package':item.type||'package',
    unit:String(item.unit||'個').trim()||'個',
    stock:toQty(item.stock),
    min_stock:toQty(item.minStock),
    purchase_cycle_days:parseInt(item.purchaseCycleDays,10)||0,
    supplier_note:String(item.supplierNote||item.supplier||'').trim(),
    active:item.active!==false
  };
}
function appItemPatchToDb(patch){
  const data={};
  if('partNo'in patch)data.part_no=String(patch.partNo||'').trim()||null;
  if('name'in patch)data.name=String(patch.name||'').trim();
  if('spec'in patch)data.spec=String(patch.spec||'').trim();
  if('type'in patch)data.type=patch.type==='material'?'package':patch.type||'package';
  if('unit'in patch)data.unit=String(patch.unit||'個').trim()||'個';
  if('stock'in patch)data.stock=toQty(patch.stock);
  if('minStock'in patch)data.min_stock=toQty(patch.minStock);
  if('purchaseCycleDays'in patch)data.purchase_cycle_days=parseInt(patch.purchaseCycleDays,10)||0;
  if('supplierNote'in patch||'supplier'in patch)data.supplier_note=String(patch.supplierNote||patch.supplier||'').trim();
  if('active'in patch)data.active=patch.active!==false;
  return data;
}
function mapDbLogToAppLog(row){
  const d=row.created_at?new Date(row.created_at):new Date();
  return{
    type:row.action_type||'調整',
    name:'',
    qty:toQty(row.qty),
    note:row.reason||'',
    time:`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`,
    rawTime:d.toISOString(),
    itemId:row.item_id||0,
    price:0,
    beforeStock:row.before_stock===null?null:toQty(row.before_stock),
    afterStock:row.after_stock===null?null:toQty(row.after_stock),
    refType:row.ref_type||'',
    refId:row.ref_id||''
  };
}
function mapAppLogToDbLog(log){
  return{
    item_id:log.itemId||null,
    action_type:log.type||'調整',
    qty:toQty(log.qty),
    before_stock:log.beforeStock===null||log.beforeStock===undefined?null:toQty(log.beforeStock),
    after_stock:log.afterStock===null||log.afterStock===undefined?null:toQty(log.afterStock),
    reason:log.note||'',
    ref_type:log.refType||'',
    ref_id:log.refId||null,
    created_at:log.rawTime||new Date().toISOString()
  };
}
function localSnapshot(){
  return JSON.parse(localStorage.getItem(SK)||'{}');
}
function localSaveSnapshot(patch){
  const data={...localSnapshot(),items,bom,logs,locations,schedules,nextId,nextSchId,...patch};
  localStorage.setItem(SK,JSON.stringify(data));
}

async function loadItemsFromSupabase(){
  const db=supabaseClient();
  if(!db)return items;
  const {data,error}=await db.from('items').select('*').order('name',{ascending:true});
  if(error){console.error('Supabase load items failed:',error);throw error;}
  return (data||[]).map(mapDbItemToAppItem);
}
async function createItemToSupabase(item){
  const db=supabaseClient();
  if(!db)return item;
  const {data,error}=await db.from('items').insert(mapAppItemToDbItem(item)).select('*').single();
  if(error){console.error('Supabase create item failed:',error);throw error;}
  return mapDbItemToAppItem(data);
}
async function updateItemToSupabase(itemId,patch){
  const db=supabaseClient();
  if(!db)return items.find(i=>i.id===itemId);
  const {data,error}=await db.from('items').update(appItemPatchToDb(patch)).eq('id',itemId).select('*').single();
  if(error){console.error('Supabase update item failed:',error);throw error;}
  return mapDbItemToAppItem(data);
}
async function deleteItemFromSupabase(itemId){
  const db=supabaseClient();
  if(!db)return;
  const {error}=await db.from('items').delete().eq('id',itemId);
  if(error){console.error('Supabase delete item failed:',error);throw error;}
}

window.mapDbItemToAppItem=mapDbItemToAppItem;
window.mapAppItemToDbItem=mapAppItemToDbItem;
window.loadItemsFromSupabase=loadItemsFromSupabase;
window.createItemToSupabase=createItemToSupabase;
window.updateItemToSupabase=updateItemToSupabase;
window.deleteItemFromSupabase=deleteItemFromSupabase;

console.log(useSupabase()?'Supabase mode enabled':'localStorage mode enabled');

window.InventoryDataAdapter={
  isSupabaseEnabled:useSupabase,
  loadItems:loadItemsFromSupabase,
  saveItem:createItemToSupabase,
  updateItem:updateItemToSupabase,
  deleteItem:deleteItemFromSupabase,
  async loadLogs(){
    const db=supabaseClient();
    if(!db)return localSnapshot().logs||logs;
    const {data,error}=await db.from('inventory_logs').select('*').order('created_at',{ascending:false}).limit(1000);
    if(error){console.error('Supabase load logs failed:',error);throw error;}
    const rows=(data||[]).map(mapDbLogToAppLog);
    rows.forEach(l=>{const item=items.find(i=>i.id===l.itemId);if(item)l.name=item.name;});
    return rows;
  },
  async addInventoryLog(log){
    const db=supabaseClient();
    if(!db){localSaveSnapshot({logs});return log;}
    const {error}=await db.from('inventory_logs').insert(mapAppLogToDbLog(log));
    if(error){console.error('Supabase add log failed:',error);throw error;}
    return log;
  },
  async loadLocations(){return localSnapshot().locations||locations;},
  async saveLocation(location){locations.push(location);localSaveSnapshot({locations});return location;},
  async loadBomItems(){return localSnapshot().bom||bom;},
  async saveBomItem(row){bom.push(row);localSaveSnapshot({bom});return row;},
  async loadSchedules(){return localSnapshot().schedules||schedules;},
  async saveSchedule(schedule){schedules.push(schedule);localSaveSnapshot({schedules});return schedule;},
  async migrateLocalStorageToSupabase(){
    const db=supabaseClient();
    if(!db){alert('尚未設定 Supabase，無法匯出。');return;}
    if(!confirm('確定要將目前 localStorage 品項匯出到 Supabase？系統會用料號或品名+規格+類型避免重複。'))return;
    const localItems=(localSnapshot().items||items||[]).map(i=>({...i,type:i.type==='material'?'package':i.type}));
    let inserted=0,updated=0;
    for(const item of localItems){
      const dbItem=mapAppItemToDbItem(item);
      let query=db.from('items').select('*').limit(1);
      query=dbItem.part_no?query.eq('part_no',dbItem.part_no):query.eq('name',dbItem.name).eq('spec',dbItem.spec).eq('type',dbItem.type);
      const {data:found,error:findError}=await query;
      if(findError){console.error(findError);throw findError;}
      if(found&&found.length){
        const {error}=await db.from('items').update(dbItem).eq('id',found[0].id);
        if(error)throw error;
        updated++;
      }else{
        const {error}=await db.from('items').insert(dbItem);
        if(error)throw error;
        inserted++;
      }
    }
    alert(`匯出完成：新增 ${inserted} 筆，更新 ${updated} 筆`);
  }
};
