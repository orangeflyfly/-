// ── STATUS / RESERVED STOCK ──────────────────────────────────────────────
function getReservedQty(itemId, ignoreScheduleId=null){
  let reserved=0;
  schedules.filter(s=>!s.shipped&&s.status!=='cancelled'&&s.id!==ignoreScheduleId).forEach(s=>{
    (s.products||[]).forEach(p=>{
      const qty=toQty(p.qty);
      if(p.productId===itemId)reserved+=qty;
      bom.filter(b=>b.product===p.productId&&b.material===itemId).forEach(b=>{
        reserved+=toQty((b.qty*qty*(1+(b.waste||0)/100)).toFixed(2));
      });
    });
  });
  return toQty(reserved.toFixed(2));
}
function getAvailableStock(item, ignoreScheduleId=null){return toQty((item.stock-getReservedQty(item.id,ignoreScheduleId)).toFixed(2));}
function getStatus(i){const available=getAvailableStock(i);if(available<=i.minStock)return'buy';if(available<=i.minStock*1.3)return'low';return'ok';}
function statusBadge(i){const s=getStatus(i);return s==='buy'?'<span class="badge badge-red">需採購</span>':s==='low'?'<span class="badge badge-amber">偏低</span>':'<span class="badge badge-green">正常</span>';}
function buildScheduleAvailabilityIssues(products, ignoreScheduleId=null){
  const needs={};
  (products||[]).forEach(p=>{
    const productId=normalizeRefId(p.productId),qty=toQty(p.qty);
    if(!productId||qty<=0)return;
    needs[productId]=(needs[productId]||0)+qty;
    bom.filter(b=>b.product===productId).forEach(b=>{
      needs[b.material]=(needs[b.material]||0)+toQty((b.qty*qty*(1+(b.waste||0)/100)).toFixed(2));
    });
  });
  return Object.entries(needs).map(([id,need])=>{
    const item=items.find(i=>i.id===normalizeRefId(id));if(!item)return null;
    const available=getAvailableStock(item,ignoreScheduleId);
    return available<need?`${item.name} 可用庫存不足（本排程需 ${formatQty(need)}${item.unit}，目前可用 ${formatQty(available)}${item.unit}）`:null;
  }).filter(Boolean);
}

// ── PURCHASE CYCLE (記憶) ─────────────────────────────────────────────────
function getPurchaseCycle(itemId){
  const item=items.find(i=>i.id===itemId);
  if(item&&item.purchaseCycleDays>0)return item.purchaseCycleDays;
  const purLogs=logs.filter(l=>l.type==='進'&&l.itemId===itemId).sort((a,b)=>new Date(a.rawTime)-new Date(b.rawTime));
  if(purLogs.length<2)return null;
  let gaps=[];
  for(let i=1;i<purLogs.length;i++){
    const g=(new Date(purLogs[i].rawTime)-new Date(purLogs[i-1].rawTime))/(1000*60*60*24);
    if(g>0)gaps.push(g);
  }
  if(!gaps.length)return null;
  return Math.round(gaps.reduce((s,v)=>s+v,0)/gaps.length);
}
function getSmartSuggestedQty(item){
  const available=getAvailableStock(item);
  const cycle=getPurchaseCycle(item.id);
  if(!cycle)return Math.max(0,Math.ceil(item.minStock*2-available));
  const purLogs=logs.filter(l=>l.type==='進'&&l.itemId===item.id);
  if(!purLogs.length)return Math.max(0,Math.ceil(item.minStock*2-available));
  const avgPerPurchase=purLogs.reduce((s,l)=>s+l.qty,0)/purLogs.length;
  return Math.max(0,Math.ceil(avgPerPurchase-(available-item.minStock)));
}
function cycleBadge(itemId){
  const c=getPurchaseCycle(itemId);
  if(!c)return'<span style="font-size:11px;color:var(--text3);">無記錄</span>';
  return`<span class="cycle-info">約 ${c} 天</span>`;
}

// ── DAILY CONSUMPTION ─────────────────────────────────────────────────────
function getDailyOut(itemId,days=30){
  const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days);
  const total=logs.filter(l=>(l.type==='出'||l.type==='扣包材')&&l.itemId===itemId&&new Date(l.rawTime)>=cutoff).reduce((s,l)=>s+l.qty,0);
  return total/days;
}
function predictDays(item){
  const d=getDailyOut(item.id);
  if(d<=0)return null;
  return Math.max(0,Math.floor((getAvailableStock(item)-item.minStock)/d));
}
function predictBadge(item){
  const d=predictDays(item);
  if(d===null)return'<span style="font-size:11px;color:var(--text3);">無數據</span>';
  if(d<=3)return`<span style="font-size:11px;font-weight:500;color:var(--red);">⚠ ${d}天後</span>`;
  if(d<=7)return`<span style="font-size:11px;color:var(--amber);">${d}天後</span>`;
  return`<span style="font-size:11px;color:var(--green);">${d}天後</span>`;
}

// ── LOCATION HELPERS ──────────────────────────────────────────────────────
function getItemLocs(itemId){return locations.filter(l=>l.itemId===itemId&&l.qty>0);}
function locChips(itemId){
  const locs=getItemLocs(itemId);
  if(!locs.length)return'<span style="font-size:11px;color:var(--text3);">未設定</span>';
  return locs.map(l=>`<span class="loc-chip">${esc(l.zone)}<span class="loc-qty">×${formatQty(l.qty)}</span><button class="loc-del" onclick='removeLoc(${JSON.stringify(itemId)},${JSON.stringify(l.zone)},event)'>×</button></span>`).join('');
}
async function removeLoc(itemId,zone,e){
  e.stopPropagation();
  const loc=locations.find(l=>l.itemId===itemId&&l.zone===zone);
  try{
    if(loc)await InventoryDataAdapter?.deleteLocation?.(loc);
    locations=locations.filter(l=>!(l.itemId===itemId&&l.zone===zone));
    await reloadCloudLocations();
    toast('已移除庫位','warn');renderLoc();filterInv();saveData();
  }catch(err){console.error(err);alert(err?.message||'刪除庫位失敗');}
}

// ── METRICS ───────────────────────────────────────────────────────────────
function activeItems(){return items.filter(i=>i.active!==false);}
function updateMetrics(){
  const visible=activeItems();
  const buy=visible.filter(i=>getStatus(i)==='buy').length;
  const low=visible.filter(i=>getStatus(i)==='low').length;
  document.getElementById('m-total').textContent=visible.length;
  document.getElementById('m-buy').textContent=buy;
  document.getElementById('m-low').textContent=low;
  document.getElementById('m-ok').textContent=visible.length-buy-low;
  const bb=document.getElementById('badge-buy'),bp=document.getElementById('badge-pur');
  if(buy>0){bb.style.display='';bb.textContent=buy;bp.style.display='';bp.textContent=buy;}
  else{bb.style.display='none';bp.style.display='none';}
  const noLoc=visible.filter(i=>getItemLocs(i.id).length===0).length;
  document.getElementById('badge-loc').style.display=noLoc>0?'':'none';
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────
function renderOverview(){
  const visible=activeItems();
  const needBuy=visible.filter(i=>getStatus(i)==='buy');
  document.getElementById('alert-section').innerHTML=needBuy.slice(0,4).map(i=>
    `<div class="alert alert-red">⚠ ${esc(i.name)} 可用庫存 <strong>${formatQty(getAvailableStock(i))}${esc(i.unit)}</strong>，保留 ${formatQty(getReservedQty(i.id))}${esc(i.unit)}，低於最低庫存 ${formatQty(i.minStock)}${esc(i.unit)}</div>`
  ).join('')+(needBuy.length>4?`<div style="font-size:12px;color:var(--text3);margin-top:4px;">還有 ${needBuy.length-4} 個品項需採購…</div>`:'');

  const urgents=visible.map(i=>({i,d:predictDays(i)})).filter(x=>x.d!==null&&x.d<=14).sort((a,b)=>a.d-b.d);
  document.getElementById('ov-predict').innerHTML=urgents.length
    ?urgents.slice(0,6).map(({i,d})=>`<div class="log-item"><div class="log-dot" style="background:${d<=3?'var(--red)':'var(--amber)'}"></div><div style="flex:1;font-size:13px;">${esc(i.name)}</div>${predictBadge(i)}</div>`).join('')
    :'<div class="alert alert-green">✓ 近 14 天內無品項預計耗盡</div>';

  const colors={'出':'var(--red)','扣包材':'var(--amber)','進':'var(--green)','調整':'var(--amber)','盤點':'var(--blue)'};
  document.getElementById('ov-log').innerHTML=logs.slice(0,6).length
    ?logs.slice(0,6).map(l=>`<div class="log-item"><div class="log-dot" style="background:${colors[l.type]||'var(--text3)'}"></div><div class="log-time">${esc(l.time)}</div><div style="flex:1;font-size:13px;">${esc(l.name)}</div><div style="font-family:var(--mono);font-size:13px;color:${colors[l.type]}">${(l.type==='出'||l.type==='扣包材')?'-':'+'}${formatQty(l.qty)}</div></div>`).join('')
    :'<div class="empty"><div class="empty-icon">📝</div><p>尚無紀錄</p></div>';
}
