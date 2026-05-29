// ── BOM ───────────────────────────────────────────────────────────────────
function populateBOM(){
  const prods=items.filter(i=>i.type==='product'&&i.active!==false),mats=items.filter(i=>i.type==='package'&&i.active!==false);
  document.getElementById('bom-prod').innerHTML=prods.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('');
  document.getElementById('bom-mat').innerHTML=mats.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('');
}
function renderBOM(){
  document.getElementById('bom-body').innerHTML=bom.length?bom.map((b,idx)=>{
    const prod=items.find(i=>i.id===b.product),mat=items.find(i=>i.id===b.material);
    const actual=+(b.qty*(1+(b.waste||0)/100)).toFixed(3);
    return`<tr><td><strong style="font-weight:500;">${esc(prod?.name||'未知品項')}</strong></td><td><span class="tag">${esc(b.label||'預設')}</span></td><td>${esc(mat?.name||'未知品項')}</td><td class="num">${formatQty(b.qty)} ${esc(mat?.unit||'')}</td><td class="num">${b.waste||0}%</td><td class="num" style="color:var(--text2);">${formatQty(actual)} ${esc(mat?.unit||'')}</td><td><button class="btn btn-sm" onclick="editBOM(${idx})">修改</button><button class="btn btn-danger btn-sm" onclick="removeBOM(${idx})">移除</button></td></tr>`;
  }).join(''):'<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text3);">尚無設定</td></tr>';
}
async function addBom(){
  const pid=normalizeRefId(document.getElementById('bom-prod').value),mid=normalizeRefId(document.getElementById('bom-mat').value);
  const qty=parseFloat(document.getElementById('bom-qty').value)||1,waste=parseFloat(document.getElementById('bom-waste').value)||0;
  const label=document.getElementById('bom-label').value.trim()||'標準包裝';
  try{
    const saved=await InventoryDataAdapter?.saveBomItem?.({product:pid,material:mid,qty,waste,label});
    bom.push(saved||{product:pid,material:mid,qty,waste,label});
    await reloadCloudBomItems();
    toast('已新增','success');renderBOM();saveData();
  }catch(err){console.error(err);alert(err?.message||'新增 BOM 失敗');}
}
async function removeBOM(idx){
  const row=bom[idx];if(!row)return;
  try{
    await InventoryDataAdapter?.deleteBomItem?.(row);
    if(!InventoryDataAdapter?.isSupabaseEnabled?.())bom.splice(idx,1);
    await reloadCloudBomItems();
    toast('已移除','warn');renderBOM();saveData();
  }catch(err){console.error(err);alert(err?.message||'刪除 BOM 失敗');}
}
async function editBOM(idx){
  const row=bom[idx];if(!row)return;
  const qtyText=prompt('請輸入新的單位用量',formatQty(row.qty));
  if(qtyText===null)return;
  const qty=parseFloat(qtyText);
  if(!Number.isFinite(qty)||qty<0){alert('單位用量格式錯誤');return;}
  const label=prompt('請輸入備註 / 標籤',row.label||'標準包裝');
  if(label===null)return;
  const patch={...row,qty,label:String(label).trim()||'標準包裝'};
  try{
    const saved=await InventoryDataAdapter?.saveBomItem?.(patch);
    bom[idx]=saved||patch;
    await reloadCloudBomItems();
    toast('已更新','success');renderBOM();saveData();
  }catch(err){console.error(err);alert(err?.message||'修改 BOM 失敗');}
}

// ── USAGE RANKING ─────────────────────────────────────────────────────────
async function renderUsage(){
  if(typeof refreshReportSource==='function'&&!await refreshReportSource())return;
  const days=parseInt(document.getElementById('usage-days').value);
  const typeFilter=document.getElementById('usage-type').value;
  const cutoff=days>0?new Date(Date.now()-days*86400000):null;
  const usage={};
  logs.filter(l=>l.type==='扣包材'&&(!cutoff||new Date(l.rawTime)>=cutoff)).forEach(l=>{
    if(!usage[l.itemId])usage[l.itemId]=0;
    usage[l.itemId]+=l.qty;
  });
  let ranked=Object.entries(usage).map(([id,total])=>({item:items.find(i=>i.id===normalizeRefId(id)),total}))
    .filter(x=>x.item&&(typeFilter==='all'||x.item.type===typeFilter))
    .sort((a,b)=>b.total-a.total);
  if(!ranked.length){document.getElementById('usage-body').innerHTML='<div class="empty"><div class="empty-icon">📊</div><p>此期間無出貨紀錄</p></div>';return;}
  const max=ranked[0].total;
  const colors=['#A0321F','#7A5215','#2E6B45','#1A4A7A','#5B2D8E'];
  document.getElementById('usage-body').innerHTML=ranked.map(({item,total},idx)=>{
    const pct=Math.round(total/max*100);
    const color=colors[Math.min(idx,colors.length-1)];
    const daily=days>0?(total/days):0;
    return`<div style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:13px;font-weight:500;min-width:18px;color:var(--text3);font-family:var(--mono);">${idx+1}</span>
          <span style="font-size:13px;">${esc(item.name)}</span>
          <span class="badge ${item.type==='product'?'badge-blue':item.type==='consumable'?'badge-purple':'badge-gray'}" style="font-size:10px;">${item.type==='product'?'產品':item.type==='consumable'?'耗材':'包材'}</span>
        </div>
        <div style="text-align:right;">
          <span style="font-family:var(--mono);font-weight:600;color:${color};">${formatQty(total)} ${esc(item.unit)}</span>
          ${days>0?`<span style="font-size:11px;color:var(--text3);margin-left:8px;">日均 ${formatQty(daily)}</span>`:''}
        </div>
      </div>
      <div class="usage-bar-wrap"><div class="usage-bar" style="width:${pct}%;background:${color};opacity:.7;"></div></div>
    </div>`;
  }).join('');
}



