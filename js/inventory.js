// ── INVENTORY ─────────────────────────────────────────────────────────────
let invNameSort='';
function filterInv(){
  const q=(document.getElementById('inv-search').value||'').toLowerCase();
  let rows=items.filter(i=>{
    const m=(i.name||'').toLowerCase().includes(q)||(i.spec||'').toLowerCase().includes(q)||(i.partNo||'').toLowerCase().includes(q);
    if(!m)return false;
    if(sfilt==='manage')return true;
    if(sfilt==='inactive')return i.active===false;
    if(i.active===false)return false;
    if(sfilt==='all')return true;
    if(sfilt==='product')return i.type==='product';
    if(sfilt==='package')return i.type==='package';
    if(sfilt==='consumable')return i.type==='consumable';
    return true;
  });
  if(invNameSort){
    rows=rows.slice().sort((a,b)=>{
      const result=String(a.name||'').localeCompare(String(b.name||''),'zh-Hant',{numeric:true,sensitivity:'base'});
      return invNameSort==='asc'?result:-result;
    });
  }
  const showType=sfilt==='all';
  const sortMark=invNameSort==='asc'?'↑':invNameSort==='desc'?'↓':'↕';
  document.getElementById('inv-head').innerHTML=`<tr>
    <th onclick="toggleInvNameSort()" style="cursor:pointer;user-select:none;">品項名稱 ${sortMark}</th><th>規格</th><th class="num">庫存數</th><th>單位</th>
    <th class="num" style="min-width:100px;">快速調整</th><th>庫位</th>${showType?'<th>類型</th>':''}<th>操作</th>
  </tr>`;
  document.getElementById('inv-body').innerHTML=rows.length?rows.map(i=>{
    const status=getStatus(i);
    const stockStyle=status==='buy'?'color:var(--red);font-weight:700;':status==='low'?'color:var(--amber);font-weight:700;':'font-weight:500;';
    const typeLabel=i.type==='product'?'產品':i.type==='consumable'?'耗材':'包材';
    const typeClass=i.type==='product'?'badge-blue':i.type==='consumable'?'badge-purple':'badge-gray';
    const itemId=JSON.stringify(i.id);
    const actionBtn=i.active===false
      ?`<button class="btn btn-success btn-sm" onclick='activateItem(${itemId})'>啟用</button><button class="btn btn-ghost btn-sm" onclick='deleteDisabledItem(${itemId})' style="color:var(--red);">刪除</button>`
      :`<button class="btn btn-ghost btn-sm" onclick='disableItem(${itemId})' style="color:var(--red);">停用</button>`;
    return`
    <tr style="${i.active===false?'opacity:.6;':''}">
      <td data-label="品項名稱">
        <strong style="font-weight:500;">${esc(i.name)}</strong>${i.active===false?' <span class="badge badge-gray">停用</span>':''}
        ${i.partNo?`<br><span style="font-size:11px;color:var(--blue);font-family:var(--mono);">${esc(i.partNo)}</span>`:''}
        ${i.supplier?`<br><span style="font-size:11px;color:var(--text3);">${esc(i.supplier)}</span>`:''}
      </td>
      <td data-label="規格" style="color:var(--text2);">${esc(i.spec)}${i.color?`<br><span style="font-size:11px;color:var(--text3);">${esc(i.color)}</span>`:''}${i.pattern?`<span style="font-size:11px;color:var(--text3);margin-left:4px;">${esc(i.pattern)}</span>`:''}</td>
      <td data-label="庫存數" class="num" style="${stockStyle}">${formatQty(i.stock)}</td>
      <td data-label="單位"><span class="tag">${esc(i.unit)}</span></td>
      <td data-label="快速調整" class="num"><div class="qty-ctrl"><button class="qty-btn" onclick='quickAdj(${itemId},-1)'>−</button><span class="qty-num">${formatQty(i.stock)}</span><button class="qty-btn" onclick='quickAdj(${itemId},1)'>+</button></div></td>
      <td data-label="庫位">${locChips(i.id)}</td>
      ${showType?`<td data-label="類型"><span class="badge ${typeClass}">${typeLabel}</span></td>`:''}
      <td data-label="操作"><div style="display:flex;gap:5px;flex-wrap:wrap;">
        <button class="btn btn-default btn-sm" onclick='openEditModal(${itemId})'>編輯</button>
        <button class="btn btn-warn btn-sm" onclick='adjustStock(${itemId})'>調整</button>
        ${actionBtn}
      </div></td>
    </tr>`;
  }).join(''):`<tr><td colspan="${showType?8:7}" style="text-align:center;padding:32px;color:var(--text3);">無符合條件的品項</td></tr>`;
}
function toggleInvNameSort(){
  invNameSort=invNameSort==='asc'?'desc':'asc';
  filterInv();
}
async function quickAdj(id,d){
  const i=items.find(x=>x.id===id);if(!i)return;
  const before=i.stock;
  i.stock=Math.max(0,toQty((i.stock+d).toFixed(2)));
  await InventoryDataAdapter?.updateItem?.(id,{stock:i.stock});
  addLog('調整',i.name,Math.abs(d),d>0?'手動+1':'手動-1',null,i.id,0,{beforeStock:before,afterStock:i.stock,refType:'adjust'});
  refresh();
}
async function adjustStock(id){
  const i=items.find(x=>x.id===id);if(!i)return;
  const mode=confirm('按「確定」直接設定新庫存；按「取消」改用增加 / 扣除數量。')?'set':'delta';
  const label=mode==='set'?'請輸入新的庫存數量':'請輸入調整數量，例如 +10 或 -5';
  const raw=prompt(`${i.name}\n目前庫存：${formatQty(i.stock)} ${i.unit}\n${label}`);
  if(raw===null)return;
  const val=toQty(raw,NaN);
  if(Number.isNaN(val)){toast('調整數量格式錯誤','error');return;}
  const before=i.stock;
  const after=mode==='set'?val:toQty((i.stock+val).toFixed(2));
  const reason=(prompt('請輸入調整原因','手動調整')||'手動調整').trim()||'手動調整';
  i.stock=after;
  await InventoryDataAdapter?.updateItem?.(id,{stock:after});
  addLog('調整',i.name,Math.abs(toQty((after-before).toFixed(2))),reason,localTodayString(),i.id,0,{beforeStock:before,afterStock:after,refType:'manual-adjust'});
  toast(`庫存已調整：${formatQty(before)} → ${formatQty(after)}`,'success');
  refresh();
}

// ── ITEM MODAL ────────────────────────────────────────────────────────────
function openAddModal(){
  document.getElementById('modal-add-title').textContent='新增品項';
  document.getElementById('m-edit-id').value='';
  ['m-name','m-spec','m-unit','m-supplier','m-partno'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('m-stock').value=0;document.getElementById('m-min').value=0;document.getElementById('m-waste').value=0;
  document.getElementById('m-cycle').value=0;
  document.getElementById('m-type').value='package';
  openModal('modal-add');
}
function openEditModal(id){
  const i=items.find(x=>x.id===id);if(!i)return;
  document.getElementById('modal-add-title').textContent='編輯品項';
  document.getElementById('m-edit-id').value=id;
  document.getElementById('m-name').value=i.name;
  document.getElementById('m-spec').value=i.spec;
  document.getElementById('m-unit').value=i.unit;
  document.getElementById('m-stock').value=i.stock;
  document.getElementById('m-min').value=i.minStock;
  document.getElementById('m-waste').value=i.waste||0;
  document.getElementById('m-cycle').value=i.purchaseCycleDays||0;
  document.getElementById('m-type').value=i.type;
  document.getElementById('m-supplier').value=i.supplier||'';
  const pn=document.getElementById('m-partno');if(pn)pn.value=i.partNo||'';
  openModal('modal-add');
}
function normalizeItemPartNo(value){return String(value||'').trim().toLowerCase();}
function normalizeItemText(value){return String(value||'').trim();}
function findDuplicateItemForCreate(input,excludeItemId=0){
  const partNo=normalizeItemPartNo(input.partNo);
  const name=normalizeItemText(input.name);
  const spec=normalizeItemText(input.spec);
  const type=input.type;
  const candidates=items.filter(i=>i.id!==excludeItemId);
  if(partNo){
    const dup=candidates.find(i=>normalizeItemPartNo(i.partNo)===partNo);
    if(dup)return{type:'exact',item:dup,by:'partNo'};
  }
  const dup=candidates.find(i=>normalizeItemText(i.name)===name&&normalizeItemText(i.spec)===spec&&i.type===type);
  if(dup)return{type:'exact',item:dup,by:'nameSpecType'};
  const sameName=candidates.find(i=>normalizeItemText(i.name)===name);
  return sameName?{type:'sameName',item:sameName}:null;
}
async function saveItem(){
  const name=document.getElementById('m-name').value.trim();
  if(!name){toast('請輸入品項名稱','error');return;}
  const eid=document.getElementById('m-edit-id').value;
  const pnEl=document.getElementById('m-partno');
  const data={
    name,
    partNo:pnEl?pnEl.value.trim():'',
    spec:document.getElementById('m-spec').value.trim(),
    unit:document.getElementById('m-unit').value.trim()||'個',
    stock:toQty(document.getElementById('m-stock').value),
    minStock:toQty(document.getElementById('m-min').value),
    purchaseCycleDays:Math.max(0,parseInt(document.getElementById('m-cycle').value,10)||0),
    type:document.getElementById('m-type').value,
    waste:toQty(document.getElementById('m-waste').value),
    supplier:document.getElementById('m-supplier').value.trim(),
    supplierNote:document.getElementById('m-supplier').value.trim()
  };
  const excludeId=eid?(isNumericId(eid)?+eid:eid):0;
  const duplicate=findDuplicateItemForCreate(data,excludeId);
  if(duplicate?.type==='exact'){
    toast(duplicate.item.active===false?'已有相同的停用品項，請先到停用品項重新啟用，或確認是否要修改原資料。':'已有相同品項，請改用編輯或進貨登記調整庫存。','warn');
    return;
  }
  if(duplicate?.type==='sameName'&&!confirm('已有相同名稱但規格或類型不同的品項，確定要新增為另一個品項嗎？'))return;
  if(eid){
    const itemId=isNumericId(eid)?+eid:eid;
    const i=items.find(x=>x.id===itemId);
    if(i){Object.assign(i,data);await InventoryDataAdapter?.updateItem?.(itemId,data);}
    toast('品項已更新','success');
  }else{
    const localItem={id:nextId++,active:true,...data};
    const saved=await InventoryDataAdapter?.saveItem?.(localItem);
    items.push(saved||localItem);
    toast('品項已新增','success');
  }
  closeModal('modal-add');refresh();
}
function canDeleteItem(id){
  return !(
    bom.some(b=>b.material===id||b.product===id)||
    locations.some(l=>l.itemId===id)||
    logs.some(l=>l.itemId===id)||
    schedules.some(s=>(s.products||[]).some(p=>p.productId===id))
  );
}
function hasItemRelations(id){
  return bom.some(b=>b.material===id||b.product===id)||locations.some(l=>l.itemId===id)||logs.some(l=>l.itemId===id)||schedules.some(s=>(s.products||[]).some(p=>p.productId===id));
}
async function deleteItem(id){
  const item=items.find(i=>i.id===id);if(!item)return;
  if(!canDeleteItem(id)){toast('此品項已有使用紀錄，無法直接刪除','warn');return;}
  if(!confirm('此操作會永久刪除此品項，且無法復原。確定刪除嗎？'))return;
  await InventoryDataAdapter?.deleteItem?.(id);
  items=items.filter(i=>i.id!==id);
  toast('已刪除','warn');refresh();
}
async function disableItem(id){
  const item=items.find(i=>i.id===id);if(!item)return;
  if(!confirm('確定要停用此品項？'))return;
  item.active=false;await InventoryDataAdapter?.updateItem?.(id,{active:false});toast('品項已停用','warn');refresh();
}
async function deleteDisabledItem(id){
  const item=items.find(i=>i.id===id);if(!item)return;
  if(item.active!==false){disableItem(id);return;}
  if(canDeleteItem(id)){deleteItem(id);return;}
  if(!confirm('此品項已有出入庫、BOM、庫位、排程或操作紀錄。若這是正式資料，不建議刪除；若這只是測試資料，可以強制刪除並同步清除相關紀錄。確定要強制刪除測試資料嗎？'))return;
  forceDeleteItem(id);
}
// 測試資料清理用途：正式資料不建議使用，會同步移除所有引用此品項的資料。
async function forceDeleteItem(id){
  await InventoryDataAdapter?.deleteItem?.(id);
  items=items.filter(i=>i.id!==id);
  logs=logs.filter(l=>l.itemId!==id);
  schedules=schedules.filter(s=>!(s.products||[]).some(p=>p.productId===id));
  bom=bom.filter(b=>b.material!==id&&b.product!==id);
  locations=locations.filter(l=>l.itemId!==id);
  toast('測試品項與關聯資料已強制刪除','warn');
  refresh();
  saveData();
}
async function activateItem(id){
  const item=items.find(i=>i.id===id);if(!item)return;
  item.active=true;await InventoryDataAdapter?.updateItem?.(id,{active:true});toast('品項已啟用','success');refresh();
}
function delItem(id){
  const item=items.find(i=>i.id===id);if(!item)return;
  if(item.active===false)deleteDisabledItem(id);
  else disableItem(id);
}
