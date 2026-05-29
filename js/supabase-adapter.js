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
function markSupabaseSuccess(){
  if(typeof setCloudConnectionStatus==='function')setCloudConnectionStatus(true);
}
function markSupabaseFailure(error){
  if(typeof setCloudConnectionStatus==='function')setCloudConnectionStatus(false,error?.message||error);
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
  const typeMap={inbound:'進',outbound:'出',bom_consumed:'扣包材',adjust:'調整',stocktake:'盤點'};
  return{
    id:row.id||'',
    actionType:row.action_type||'',
    type:typeMap[row.action_type]||row.action_type||'調整',
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
  const typeMap={'進':'inbound','出':'outbound','扣包材':'bom_consumed','調整':'adjust','盤點':'adjust',inbound:'inbound',outbound:'outbound',bom_consumed:'bom_consumed',adjust:'adjust'};
  return{
    item_id:log.itemId||null,
    action_type:typeMap[log.type]||'adjust',
    qty:toQty(log.qty),
    before_stock:log.beforeStock===null||log.beforeStock===undefined?null:toQty(log.beforeStock),
    after_stock:log.afterStock===null||log.afterStock===undefined?null:toQty(log.afterStock),
    reason:log.note||'',
    ref_type:log.refType||'',
    ref_id:log.refId||null,
    created_by:log.createdBy||'web',
    created_at:log.rawTime||new Date().toISOString()
  };
}
function isUuid(value){
  return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function pickDefined(row){
  return Object.fromEntries(Object.entries(row).filter(([,v])=>v!==undefined));
}
function backupItemToDb(item){
  const row=('part_no'in item||'min_stock'in item)?{
    part_no:item.part_no??null,
    name:item.name||'',
    spec:item.spec||'',
    type:item.type==='material'?'package':item.type||'package',
    unit:item.unit||'個',
    stock:toQty(item.stock),
    min_stock:toQty(item.min_stock),
    purchase_cycle_days:parseInt(item.purchase_cycle_days,10)||0,
    supplier_note:item.supplier_note||'',
    active:item.active!==false
  }:mapAppItemToDbItem(item);
  if(isUuid(item.id))row.id=item.id;
  return pickDefined(row);
}
function backupLocationToDb(location){
  const row=('item_id'in location)?{
    item_id:location.item_id||null,
    warehouse:location.warehouse||'',
    location_code:String(location.location_code||'').toUpperCase(),
    qty:toQty(location.qty)
  }:mapAppLocationToDbLocation(location);
  if(isUuid(location.id))row.id=location.id;
  return pickDefined(row);
}
function backupBomToDb(rowData){
  const row=('product_item_id'in rowData)?{
    product_item_id:rowData.product_item_id||null,
    material_item_id:rowData.material_item_id||null,
    qty_per_unit:toQty(rowData.qty_per_unit),
    note:rowData.note||''
  }:mapAppBomToDbBom(rowData);
  if(isUuid(rowData.id))row.id=rowData.id;
  return pickDefined(row);
}
function backupScheduleToDb(schedule){
  const row=('item_id'in schedule)?{
    item_id:schedule.item_id||null,
    qty:toQty(schedule.qty),
    customer:schedule.customer||'',
    order_no:schedule.order_no||'',
    owner:schedule.owner||'',
    scheduled_date:schedule.scheduled_date||localTodayString(),
    status:schedule.status||'pending',
    note:schedule.note||'',
    shipped_at:schedule.shipped_at||null
  }:mapAppScheduleToDbSchedule(schedule);
  if(isUuid(schedule.id))row.id=schedule.id;
  return pickDefined(row);
}
function backupLogToDb(log){
  const row=('action_type'in log)?{
    item_id:log.item_id||null,
    action_type:log.action_type||'adjust',
    qty:toQty(log.qty),
    before_stock:log.before_stock===null||log.before_stock===undefined?null:toQty(log.before_stock),
    after_stock:log.after_stock===null||log.after_stock===undefined?null:toQty(log.after_stock),
    reason:log.reason||'',
    ref_type:log.ref_type||'',
    ref_id:log.ref_id||null,
    created_by:log.created_by||'web',
    created_at:log.created_at||new Date().toISOString()
  }:mapAppLogToDbLog(log);
  if(isUuid(log.id))row.id=log.id;
  return pickDefined(row);
}
function mapDbLocationToAppLocation(row){
  return{
    id:row.id,
    itemId:row.item_id||0,
    warehouse:row.warehouse||'',
    zone:String(row.location_code||'').toUpperCase(),
    qty:toQty(row.qty)
  };
}
function mapAppLocationToDbLocation(location){
  return{
    item_id:location.itemId||null,
    warehouse:location.warehouse||'',
    location_code:String(location.zone||location.locationCode||'').toUpperCase(),
    qty:toQty(location.qty)
  };
}
function mapDbBomToAppBom(row){
  return{
    id:row.id,
    product:row.product_item_id||0,
    material:row.material_item_id||0,
    qty:toQty(row.qty_per_unit),
    waste:0,
    label:row.note||'標準包裝'
  };
}
function mapAppBomToDbBom(row){
  return{
    product_item_id:row.product||null,
    material_item_id:row.material||null,
    qty_per_unit:toQty(row.qty),
    note:row.label||row.note||''
  };
}
function mapDbScheduleToAppSchedule(row){
  const item=items.find(i=>i.id===row.item_id);
  const status=row.status||'pending';
  return{
    id:row.id,
    customer:row.customer||'未命名客戶',
    order:row.order_no||'',
    owner:row.owner||'',
    note:row.note||'',
    date:String(row.scheduled_date||localTodayString()).slice(0,10),
    products:[{productId:row.item_id||0,name:item?item.name:'未知品項',qty:toQty(row.qty)}].filter(p=>p.productId),
    status,
    shipped:status==='shipped'||!!row.shipped_at,
    shippedAt:row.shipped_at||''
  };
}
function mapAppScheduleToDbSchedule(schedule){
  const product=(schedule.products||[])[0]||{};
  return{
    item_id:product.productId||null,
    qty:toQty(product.qty),
    customer:schedule.customer||'',
    order_no:schedule.order||'',
    owner:schedule.owner||'',
    scheduled_date:schedule.date||localTodayString(),
    status:schedule.shipped?'shipped':(schedule.status||'pending'),
    note:schedule.note||'',
    shipped_at:schedule.shippedAt||null
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
  if(error){console.error('Supabase load items failed:',error);markSupabaseFailure(error);throw error;}
  markSupabaseSuccess();
  return (data||[]).map(mapDbItemToAppItem);
}
async function createItemToSupabase(item){
  const db=supabaseClient();
  if(!db)return item;
  const {data,error}=await db.from('items').insert(mapAppItemToDbItem(item)).select('*').single();
  if(error){console.error('Supabase create item failed:',error);markSupabaseFailure(error);throw error;}
  markSupabaseSuccess();
  return mapDbItemToAppItem(data);
}
async function updateItemToSupabase(itemId,patch){
  const db=supabaseClient();
  if(!db)return items.find(i=>i.id===itemId);
  const {data,error}=await db.from('items').update(appItemPatchToDb(patch)).eq('id',itemId).select('*').single();
  if(error){console.error('Supabase update item failed:',error);markSupabaseFailure(error);throw error;}
  markSupabaseSuccess();
  return mapDbItemToAppItem(data);
}
async function deleteItemFromSupabase(itemId){
  const db=supabaseClient();
  if(!db)return;
  const {error}=await db.from('items').delete().eq('id',itemId);
  if(error){console.error('Supabase delete item failed:',error);throw error;}
}
async function importUpsertItemToSupabase(item,options={}){
  const db=supabaseClient();
  if(!db)return{status:'local',item};
  const dbItem={...mapAppItemToDbItem(item),active:item.active!==false};
  let found=null;
  if(dbItem.part_no){
    const {data,error}=await db.from('items').select('*').ilike('part_no',dbItem.part_no).limit(1);
    if(error){console.error('Supabase import find by part_no failed:',error);markSupabaseFailure(error);throw error;}
    found=data?.[0]||null;
    if(!found&&options.fallbackName){
      const {data:nameData,error:nameError}=await db.from('items').select('*').eq('name',dbItem.name).limit(1);
      if(nameError){console.error('Supabase import find by name failed:',nameError);markSupabaseFailure(nameError);throw nameError;}
      found=nameData?.[0]||null;
    }
  }else{
    const {data,error}=await db.from('items').select('*').eq('name',dbItem.name).eq('type',dbItem.type);
    if(error){console.error('Supabase import find by name/spec/type failed:',error);markSupabaseFailure(error);throw error;}
    found=(data||[]).find(row=>String(row.spec||'').trim()===String(dbItem.spec||'').trim())||null;
  }
  if(found){
    const {data,error}=await db.from('items').update(dbItem).eq('id',found.id).select('*').single();
    if(error){console.error('Supabase import update item failed:',error);markSupabaseFailure(error);throw error;}
    markSupabaseSuccess();
    return{status:'updated',item:mapDbItemToAppItem(data)};
  }
  const {data,error}=await db.from('items').insert(dbItem).select('*').single();
  if(error){console.error('Supabase import insert item failed:',error);markSupabaseFailure(error);throw error;}
  markSupabaseSuccess();
  return{status:'added',item:mapDbItemToAppItem(data)};
}

window.mapDbItemToAppItem=mapDbItemToAppItem;
window.mapAppItemToDbItem=mapAppItemToDbItem;
window.loadItemsFromSupabase=loadItemsFromSupabase;
window.createItemToSupabase=createItemToSupabase;
window.updateItemToSupabase=updateItemToSupabase;
window.deleteItemFromSupabase=deleteItemFromSupabase;
window.importUpsertItemToSupabase=importUpsertItemToSupabase;

console.log(useSupabase()?'Supabase mode enabled':'localStorage mode enabled');

window.InventoryDataAdapter={
  isSupabaseEnabled:useSupabase,
  loadItems:loadItemsFromSupabase,
  saveItem:createItemToSupabase,
  updateItem:updateItemToSupabase,
  deleteItem:deleteItemFromSupabase,
  importUpsertItem:importUpsertItemToSupabase,
  async loadLogs(){
    const db=supabaseClient();
    if(!db)return localSnapshot().logs||logs;
    const {data,error}=await db.from('inventory_logs').select('*').order('created_at',{ascending:false});
    if(error){console.error('Supabase load logs failed:',error);throw error;}
    const rows=(data||[]).map(mapDbLogToAppLog);
    rows.forEach(l=>{const item=items.find(i=>i.id===l.itemId);l.name=item?item.name:(l.itemId?'未知品項':'已刪除品項');});
    return rows;
  },
  async addInventoryLog(log){
    const db=supabaseClient();
    if(!db){localSaveSnapshot({logs});return log;}
    const {error}=await db.from('inventory_logs').insert(mapAppLogToDbLog(log));
    if(error){console.error('Supabase add log failed:',error);throw error;}
    return log;
  },
  async clearInventoryLogs(){
    const db=supabaseClient();
    if(!db){logs=[];localSaveSnapshot({logs});return;}
    const {error}=await db.from('inventory_logs').delete().not('id','is',null);
    if(error){console.error('Supabase clear logs failed:',error);throw error;}
  },
  async loadLocations(){
    const db=supabaseClient();
    if(!db)return localSnapshot().locations||locations;
    const {data,error}=await db.from('locations').select('*').order('location_code',{ascending:true});
    if(error){console.error('Supabase load locations failed:',error);throw error;}
    return (data||[]).map(mapDbLocationToAppLocation);
  },
  async saveLocation(location){
    const db=supabaseClient();
    if(!db){localSaveSnapshot({locations});return location;}
    if(location.id){
      const {data,error}=await db.from('locations').update(mapAppLocationToDbLocation(location)).eq('id',location.id).select('*').single();
      if(error){console.error('Supabase update location failed:',error);throw error;}
      return mapDbLocationToAppLocation(data);
    }
    const {data,error}=await db.from('locations').insert(mapAppLocationToDbLocation(location)).select('*').single();
    if(error){console.error('Supabase insert location failed:',error);throw error;}
    return mapDbLocationToAppLocation(data);
  },
  async deleteLocation(location){
    const db=supabaseClient();
    if(!db){locations=locations.filter(l=>!(l.itemId===location.itemId&&l.zone===location.zone));localSaveSnapshot({locations});return;}
    if(location.id){
      const {error}=await db.from('locations').delete().eq('id',location.id);
      if(error){console.error('Supabase delete location failed:',error);throw error;}
      return;
    }
    const {error}=await db.from('locations').delete().eq('item_id',location.itemId).eq('location_code',location.zone);
    if(error){console.error('Supabase delete location failed:',error);throw error;}
  },
  async loadBomItems(){
    const db=supabaseClient();
    if(!db)return localSnapshot().bom||bom;
    const {data,error}=await db.from('bom_items').select('*').order('created_at',{ascending:false});
    if(error){console.error('Supabase load bom_items failed:',error);throw error;}
    return (data||[]).map(mapDbBomToAppBom);
  },
  async saveBomItem(row){
    const db=supabaseClient();
    if(!db){localSaveSnapshot({bom});return row;}
    if(row.id){
      const {data,error}=await db.from('bom_items').update(mapAppBomToDbBom(row)).eq('id',row.id).select('*').single();
      if(error){console.error('Supabase update bom_items failed:',error);throw error;}
      return mapDbBomToAppBom(data);
    }
    const {data,error}=await db.from('bom_items').insert(mapAppBomToDbBom(row)).select('*').single();
    if(error){console.error('Supabase insert bom_items failed:',error);throw error;}
    return mapDbBomToAppBom(data);
  },
  async deleteBomItem(row){
    const db=supabaseClient();
    if(!db){localSaveSnapshot({bom});return;}
    if(row.id){
      const {error}=await db.from('bom_items').delete().eq('id',row.id);
      if(error){console.error('Supabase delete bom_items failed:',error);throw error;}
      return;
    }
    const {error}=await db.from('bom_items').delete().eq('product_item_id',row.product).eq('material_item_id',row.material);
    if(error){console.error('Supabase delete bom_items failed:',error);throw error;}
  },
  async loadSchedules(){
    const db=supabaseClient();
    if(!db)return localSnapshot().schedules||schedules;
    const {data,error}=await db.from('schedules').select('*').order('scheduled_date',{ascending:true});
    if(error){console.error('Supabase load schedules failed:',error);throw error;}
    return (data||[]).map(mapDbScheduleToAppSchedule);
  },
  async saveSchedule(schedule){
    const db=supabaseClient();
    if(!db){localSaveSnapshot({schedules});return schedule;}
    if(schedule.id){
      const {data,error}=await db.from('schedules').update(mapAppScheduleToDbSchedule(schedule)).eq('id',schedule.id).select('*').single();
      if(error){console.error('Supabase update schedule failed:',error);throw error;}
      return mapDbScheduleToAppSchedule(data);
    }
    const {data,error}=await db.from('schedules').insert(mapAppScheduleToDbSchedule(schedule)).select('*').single();
    if(error){console.error('Supabase insert schedule failed:',error);throw error;}
    return mapDbScheduleToAppSchedule(data);
  },
  async deleteSchedule(scheduleId){
    const db=supabaseClient();
    if(!db){localSaveSnapshot({schedules});return;}
    const {error}=await db.from('schedules').delete().eq('id',scheduleId);
    if(error){console.error('Supabase delete schedule failed:',error);throw error;}
  },
  async restoreBackupMerge(data){
    const db=supabaseClient();
    if(!db){localSaveSnapshot({items,bom,logs,locations,schedules});return;}
    const upsertOrInsert=async(table,row)=>{
      const query=row.id?db.from(table).upsert(row,{onConflict:'id'}):db.from(table).insert(row);
      const {error}=await query;
      if(error){console.error(`Supabase restore ${table} failed:`,error);throw error;}
    };
    for(const item of data.items||[])await upsertOrInsert('items',backupItemToDb(item));
    for(const location of data.locations||[])await upsertOrInsert('locations',backupLocationToDb(location));
    for(const row of data.bom_items||[])await upsertOrInsert('bom_items',backupBomToDb(row));
    for(const schedule of data.schedules||[])await upsertOrInsert('schedules',backupScheduleToDb(schedule));
    for(const log of data.inventory_logs||[])await upsertOrInsert('inventory_logs',backupLogToDb(log));
  },
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
