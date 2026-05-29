// ── SHIP OUT ──────────────────────────────────────────────────────────────
function populateSO(){
  const prods=items.filter(i=>i.type==='product'&&i.active!==false);
  document.getElementById('so-product').innerHTML=prods.length?prods.map(i=>`<option value="${i.id}">${esc(i.name)}（可用：${formatQty(getAvailableStock(i))}${esc(i.unit)}）</option>`).join(''):'<option value="">無產品</option>';
  document.getElementById('so-date').value=localTodayString();
  previewSO();
}
function previewSO(){
  const pid=normalizeRefId(document.getElementById('so-product').value);
  const qty=toQty(document.getElementById('so-qty').value,1);
  const related=bom.filter(b=>b.product===pid);
  if(!related.length){document.getElementById('so-preview').innerHTML='<div class="empty"><div class="empty-icon">📋</div><p>此產品尚未設定包材對照</p></div>';return;}
  const grouped={};
  related.forEach(b=>{const k=b.label||'預設';if(!grouped[k])grouped[k]=[];grouped[k].push(b);});
  let html='';
  Object.keys(grouped).forEach(lbl=>{
    html+=`<div class="preview-box" style="margin-bottom:8px;"><div class="preview-title">${esc(lbl)}</div>`;
    grouped[lbl].forEach(b=>{
      const mat=items.find(i=>i.id===b.material);if(!mat)return;
      const consume=toQty((b.qty*qty*(1+(b.waste||0)/100)).toFixed(2));
      const after=toQty((mat.stock-consume).toFixed(2));
      const warn=after<=mat.minStock;
      html+=`<div class="preview-row"><span>${esc(mat.name)}</span><span>消耗 <strong>${formatQty(consume)}${esc(mat.unit)}</strong></span><span style="${warn?'color:var(--red);font-weight:600;':''}">剩 ${formatQty(Math.max(0,after))}${esc(mat.unit)}${warn?' ⚠':''}</span></div>`;
    });
    html+='</div>';
  });
  document.getElementById('so-preview').innerHTML=html;
}
async function submitSO(){
  const pid=normalizeRefId(document.getElementById('so-product').value);
  const qty=toQty(document.getElementById('so-qty').value,1);
  const note=document.getElementById('so-note').value.trim();
  const dateVal=document.getElementById('so-date').value;
  const product=items.find(i=>i.id===pid);
  if(!product){toast('請選擇產品','error');return;}
  const check=buildShipmentCheck([{productId:pid,name:product.name,qty}]);
  if(!check.ok){
    document.getElementById('so-alert-card').style.display='';
    document.getElementById('so-alert-body').innerHTML=check.issues.map(msg=>`<div class="alert alert-red">⚠ ${esc(msg)}</div>`).join('');
    toast('庫存不足，無法出貨','error');
    return;
  }
  const productBefore=product.stock;
  product.stock=toQty((product.stock-qty).toFixed(2));
  await InventoryDataAdapter?.updateItem?.(product.id,{stock:product.stock});
  const alerts=[];
  for(const {item:mat,qty:consume} of check.consumptions){
    const before=mat.stock;
    mat.stock=toQty((mat.stock-consume).toFixed(2));
    await InventoryDataAdapter?.updateItem?.(mat.id,{stock:mat.stock});
    addLog('出',mat.name,consume,`出貨:${product.name}`,dateVal,mat.id,0,{beforeStock:before,afterStock:mat.stock,refType:'shipout'});
    if(getStatus(mat)==='buy')alerts.push(mat);
  }
  addLog('出',product.name,qty,note||'出貨',dateVal,product.id,0,{beforeStock:productBefore,afterStock:product.stock,refType:'shipout'});
  if(alerts.length){
    document.getElementById('so-alert-card').style.display='';
    document.getElementById('so-alert-body').innerHTML=alerts.map(a=>`<div class="alert alert-red">⚠ ${esc(a.name)} 可用庫存 ${formatQty(getAvailableStock(a))}${esc(a.unit)}，低於最低庫存 ${formatQty(a.minStock)}${esc(a.unit)}</div>`).join('');
  }else{document.getElementById('so-alert-card').style.display='none';}
  document.getElementById('so-qty').value=1;document.getElementById('so-note').value='';
  toast(`出貨成功：${product.name} ×${formatQty(qty)}`,'success');refresh();populateSO();
}

// ── SHIP IN ───────────────────────────────────────────────────────────────
function populateSI(){
  document.getElementById('si-item').innerHTML=items.filter(i=>i.active!==false).map(i=>`<option value="${i.id}">[${i.type==='product'?'產品':i.type==='consumable'?'耗材':'包材'}] ${esc(i.name)}</option>`).join('');
  document.getElementById('si-date').value=localTodayString();
}
async function submitSI(){
  const iid=normalizeRefId(document.getElementById('si-item').value);
  const qty=toQty(document.getElementById('si-qty').value,1);
  const supplier=document.getElementById('si-supplier').value.trim();
  const price=toQty(document.getElementById('si-price').value);
  const dateVal=document.getElementById('si-date').value;
  const item=items.find(i=>i.id===iid);
  if(!item){toast('請選擇品項','error');return;}
  const before=item.stock;
  item.stock=toQty((item.stock+qty).toFixed(2));
  await InventoryDataAdapter?.updateItem?.(item.id,{stock:item.stock});
  addLog('進',item.name,qty,supplier||'進貨',dateVal,item.id,price,{beforeStock:before,afterStock:item.stock,refType:'shipin'});
  document.getElementById('si-qty').value=1;document.getElementById('si-supplier').value='';document.getElementById('si-price').value='';
  toast(`入庫成功：${item.name} +${formatQty(qty)}${item.unit}`,'success');refresh();populateSI();
}

// ── STOCKTAKE ─────────────────────────────────────────────────────────────
function renderST(){
  document.getElementById('st-body').innerHTML=items.filter(i=>i.active!==false).map(i=>`
    <div class="st-row">
      <div style="font-size:13px;"><strong style="font-weight:500;">${esc(i.name)}</strong> <span style="font-size:11px;color:var(--text3);">${esc(i.spec)}</span></div>
      <div class="num">${formatQty(i.stock)} ${esc(i.unit)}</div>
      <div><input type="number" id="st-${i.id}" placeholder="${formatQty(i.stock)}" min="0" step="0.01" style="height:32px;text-align:right;" oninput='calcDiff(${JSON.stringify(i.id)})'></div>
      <div class="num" id="diff-${i.id}" style="font-family:var(--mono);font-size:13px;color:var(--text3);">—</div>
    </div>`).join('');
}
function calcDiff(id){
  const item=items.find(i=>i.id===id);if(!item)return;
  const val=document.getElementById(`st-${id}`).value;
  const el=document.getElementById(`diff-${id}`);
  if(val===''){el.textContent='—';el.style.color='var(--text3)';return;}
  const diff=toQty(val)-item.stock;
  el.textContent=(diff>=0?'+':'')+formatQty(diff);
  el.style.color=diff>0?'var(--green)':diff<0?'var(--red)':'var(--text3)';
}
function resetST(){document.querySelectorAll('[id^="st-"]').forEach(e=>e.value='');document.querySelectorAll('[id^="diff-"]').forEach(e=>{e.textContent='—';e.style.color='var(--text3)';});}
async function confirmST(){
  let changed=0;
  for(const i of items){
    const el=document.getElementById(`st-${i.id}`);if(!el||el.value==='')continue;
    const actual=toQty(el.value);const diff=toQty((actual-i.stock).toFixed(2));
    if(diff!==0){const before=i.stock;i.stock=actual;await InventoryDataAdapter?.updateItem?.(i.id,{stock:i.stock});addLog('盤點',i.name,Math.abs(diff),`盤點調整 ${diff>0?'+':''}${formatQty(diff)}`,localTodayString(),i.id,0,{beforeStock:before,afterStock:i.stock,refType:'stocktake'});changed++;}
  }
  if(!changed){toast('沒有差異需要調整');return;}
  toast(`盤點完成，調整了 ${changed} 個品項`,'success');
  resetST();renderST();refresh();
}
