// ── LOCATION ──────────────────────────────────────────────────────────────
function renderLoc(){
  const q=(document.getElementById('loc-search')?.value||'').toLowerCase();
  const filtered=items.filter(i=>i.active!==false&&(i.name.toLowerCase().includes(q)||getItemLocs(i.id).some(l=>l.zone.toLowerCase().includes(q))));
  document.getElementById('loc-list').innerHTML=filtered.map(i=>{
    const locs=getItemLocs(i.id);
    const total=locs.reduce((s,l)=>s+l.qty,0);
    const diff=total-i.stock;
    const diffText=diff!==0?` · 差異 ${diff>0?'+':''}${formatQty(diff)}${esc(i.unit)}`:'';
    const diffColor=diff!==0?'var(--amber)':'var(--text3)';
    return`<div class="loc-zone-card">
      <div class="loc-zone-title">
        <span class="badge ${i.type==='product'?'badge-blue':i.type==='consumable'?'badge-purple':'badge-gray'}">${i.type==='product'?'產品':i.type==='consumable'?'耗材':'包材'}</span>
        <strong style="font-weight:500;">${esc(i.name)}</strong>
        <span style="font-size:12px;color:${diffColor};margin-left:auto;">帳面 ${formatQty(i.stock)}${esc(i.unit)}${total>0?` · 已標記 ${formatQty(total)}${esc(i.unit)}`:''}${diffText}</span>
        <button class="btn btn-purple btn-sm" onclick='openLocModalFor(${JSON.stringify(i.id)})'>+ 庫位</button>
      </div>
      ${locs.length?locs.map(l=>`
        <div class="loc-slot">
          <span class="loc-id-badge">${esc(l.zone)}</span>
          <span style="flex:1;margin-left:12px;font-size:13px;">${esc(i.name)}</span>
          <span style="font-family:var(--mono);font-size:13px;font-weight:500;">${formatQty(l.qty)} ${esc(i.unit)}</span>
          <button class="btn btn-danger btn-sm" style="margin-left:10px;" onclick='removeLoc(${JSON.stringify(i.id)},${JSON.stringify(l.zone)},event)'>移除</button>
        </div>`).join('')
      :`<div style="font-size:12px;color:var(--text3);padding:6px 0;">尚未設定庫位</div>`}
    </div>`;
  }).join('')||'<div class="empty"><div class="empty-icon">📍</div><p>無符合條件的品項</p></div>';

  // by zone
  const zones={};
  locations.filter(l=>l.qty>0).forEach(l=>{
    if(!zones[l.zone])zones[l.zone]=[];
    const item=items.find(i=>i.id===l.itemId);
    if(item)zones[l.zone].push({item,qty:l.qty});
  });
  const zoneKeys=Object.keys(zones).sort();
  document.getElementById('loc-by-zone').innerHTML=zoneKeys.length?zoneKeys.map(z=>`
    <div class="card" style="margin-bottom:10px;"><div class="card-body" style="padding:14px 18px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span class="loc-id-badge" style="font-size:14px;padding:4px 14px;">${esc(z)}</span>
        <span style="font-size:12px;color:var(--text3);">${zones[z].length} 種品項</span>
      </div>
      ${zones[z].map(({item,qty})=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">
          <span>${esc(item.name)}</span>
          <span style="font-family:var(--mono);font-weight:500;">${formatQty(qty)} ${esc(item.unit)}</span>
        </div>`).join('')}
    </div></div>`).join('')
  :'<div class="empty"><div class="empty-icon">📍</div><p>尚無庫位資料</p></div>';
}
function openLocModal(){
  document.getElementById('loc-item').innerHTML=items.filter(i=>i.active!==false).map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('');
  document.getElementById('loc-zone').value='';document.getElementById('loc-qty').value=0;
  openModal('modal-loc');
}
function openLocModalFor(itemId){
  document.getElementById('loc-item').innerHTML=items.filter(i=>i.active!==false||i.id===itemId).map(i=>`<option value="${i.id}" ${i.id===itemId?'selected':''}>${esc(i.name)}${i.active===false?' - 停用':''}</option>`).join('');
  document.getElementById('loc-zone').value='';document.getElementById('loc-qty').value=0;
  openModal('modal-loc');
}
async function saveLoc(){
  const itemId=normalizeRefId(document.getElementById('loc-item').value);
  const zone=document.getElementById('loc-zone').value.trim().toUpperCase().replace(/[^\w-]/g,'');
  const qty=toQty(document.getElementById('loc-qty').value);
  if(!zone){toast('請輸入庫位編號','error');return;}
  const existing=locations.find(l=>l.itemId===itemId&&l.zone===zone);
  try{
    if(existing){
      if(qty===0){await InventoryDataAdapter?.deleteLocation?.(existing);locations=locations.filter(l=>!(l.itemId===itemId&&l.zone===zone));toast(`庫位 ${zone} 已清空`,'warn');}
      else{const saved=await InventoryDataAdapter?.saveLocation?.({...existing,qty});Object.assign(existing,saved||{qty});toast(`庫位 ${zone} 已更新`,'success');}
    }else if(qty>0){
      const saved=await InventoryDataAdapter?.saveLocation?.({itemId,zone,qty,warehouse:''});
      locations.push(saved||{itemId,zone,qty});toast(`庫位 ${zone} 已設定`,'success');
    }
    await reloadCloudLocations();
    closeModal('modal-loc');renderLoc();filterInv();saveData();
  }catch(err){console.error(err);alert(err?.message||'儲存庫位失敗');}
}



