// ── TREND ─────────────────────────────────────────────────────────────────
async function refreshReportSource(){
  if(!window.InventoryDataAdapter?.isSupabaseEnabled?.())return true;
  try{await reloadCloudReportData();return true;}
  catch(err){console.error(err);alert(err?.message||'Supabase 報表資料讀取失敗');return false;}
}
function populateTrend(){document.getElementById('trend-item').innerHTML=items.filter(i=>i.active!==false).map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('');}
async function renderTrend(){
  if(!await refreshReportSource())return;
  const itemId=normalizeRefId(document.getElementById('trend-item').value);
  const days=parseInt(document.getElementById('trend-days').value)||30;
  const item=items.find(i=>i.id===itemId);if(!item)return;
  const labels=[],inData=[],outData=[];
  for(let d=days-1;d>=0;d--){
    const dt=new Date();dt.setDate(dt.getDate()-d);
    const ds=`${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()}`;
    labels.push(`${dt.getMonth()+1}/${dt.getDate()}`);
    const dl=logs.filter(l=>l.itemId===itemId&&l.time===ds);
    let inbound=dl.filter(l=>l.type==='進').reduce((s,l)=>s+l.qty,0);
    let outbound=dl.filter(l=>l.type==='出'||l.type==='扣包材').reduce((s,l)=>s+l.qty,0);
    dl.filter(l=>l.type==='盤點'||l.type==='調整').forEach(l=>{
      if(l.beforeStock===null||l.afterStock===null){inbound+=l.qty;return;}
      const diff=toQty((l.afterStock-l.beforeStock).toFixed(2));
      if(diff>=0)inbound+=diff;else outbound+=Math.abs(diff);
    });
    inData.push(inbound);
    outData.push(outbound);
  }
  const ctx=document.getElementById('trend-chart').getContext('2d');
  if(trendChart)trendChart.destroy();
  trendChart=new Chart(ctx,{type:'bar',data:{labels,datasets:[
    {label:'進貨',data:inData,backgroundColor:'rgba(46,107,69,.6)',borderColor:'#2E6B45',borderWidth:1,borderRadius:3},
    {label:'出貨',data:outData,backgroundColor:'rgba(160,50,31,.6)',borderColor:'#A0321F',borderWidth:1,borderRadius:3}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:{size:12},color:'#6B6560'}}},
    scales:{x:{ticks:{font:{size:10},color:'#A09A93'},grid:{display:false}},y:{ticks:{font:{size:11},color:'#A09A93'},grid:{color:'#F0EDE7'}}}}});
  const tot=outData.reduce((s,v)=>s+v,0);const tin=inData.reduce((s,v)=>s+v,0);
  document.getElementById('trend-stats').innerHTML=`
    <div class="metric-card"><div class="m-label">期間出貨</div><div class="m-value" style="font-size:18px;color:var(--red);">${formatQty(tot)}</div><div class="m-sub">${esc(item.unit)}</div></div>
    <div class="metric-card"><div class="m-label">期間進貨</div><div class="m-value" style="font-size:18px;color:var(--green);">${formatQty(tin)}</div><div class="m-sub">${esc(item.unit)}</div></div>
    <div class="metric-card"><div class="m-label">日均消耗</div><div class="m-value" style="font-size:18px;color:var(--amber);">${formatQty(tot/days)}</div><div class="m-sub">${esc(item.unit)}/天</div></div>`;
}

// ── REPORT ────────────────────────────────────────────────────────────────
function initRpt(){
  const n=new Date();const ye=document.getElementById('rpt-year'),me=document.getElementById('rpt-month');
  ye.innerHTML='';for(let y=n.getFullYear();y>=n.getFullYear()-2;y--)ye.innerHTML+=`<option value="${y}">${y}</option>`;
  me.innerHTML='';for(let m=1;m<=12;m++)me.innerHTML+=`<option value="${m}" ${m===n.getMonth()+1?'selected':''}>${m}月</option>`;
}
async function renderReport(){
  if(!await refreshReportSource())return;
  const y=parseInt(document.getElementById('rpt-year').value),m=parseInt(document.getElementById('rpt-month').value);
  const pfx=`${y}/${m}/`;const ml=logs.filter(l=>l.time.startsWith(pfx));
  const outs=ml.filter(l=>l.type==='出'),bomConsumed=ml.filter(l=>l.type==='扣包材'),ins=ml.filter(l=>l.type==='進'),adjusts=ml.filter(l=>l.type==='調整'||l.type==='盤點');
  const cost=ins.reduce((s,l)=>s+(l.price||0)*l.qty,0);
  document.getElementById('rpt-metrics').innerHTML=`
    <div class="rpt-card"><div class="rpt-num" style="color:var(--red);">${outs.length}</div><div class="rpt-label">出貨次數</div></div>
    <div class="rpt-card"><div class="rpt-num" style="color:var(--green);">${ins.length}</div><div class="rpt-label">進貨次數</div></div>
    <div class="rpt-card"><div class="rpt-num" style="color:var(--amber);">${bomConsumed.length}</div><div class="rpt-label">包材扣庫</div></div>
    <div class="rpt-card"><div class="rpt-num" style="color:var(--blue);">${adjusts.length}</div><div class="rpt-label">調整/盤點</div></div>
    <div class="rpt-card"><div class="rpt-num" style="color:var(--amber);">${cost>0?'$'+cost.toLocaleString():'—'}</div><div class="rpt-label">進貨金額</div></div>`;
  const renderList=(arr,elId)=>{
    const g={};arr.forEach(l=>{if(!g[l.name])g[l.name]=0;g[l.name]+=l.qty;});
    document.getElementById(elId).innerHTML=Object.entries(g).sort((a,b)=>b[1]-a[1]).map(([n,q])=>`
      <div class="log-item"><div style="flex:1;font-size:13px;">${esc(n||'未知品項')}</div><div style="font-family:var(--mono);font-size:13px;font-weight:500;">${formatQty(q)}</div></div>`).join('')||'<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">無紀錄</div>';
  };
  renderList(outs.concat(bomConsumed),'rpt-out');renderList(ins.concat(adjusts),'rpt-in');
}
async function exportReport(){
  if(!await refreshReportSource())return;
  const y=parseInt(document.getElementById('rpt-year').value),m=parseInt(document.getElementById('rpt-month').value);
  const ml=logs.filter(l=>l.time.startsWith(`${y}/${m}/`));
  const wb=XLSX.utils.book_new();
  const data=[['時間','類型','品項','數量','備註','金額']];
  ml.forEach(l=>data.push([l.time,l.type,l.name,l.qty,l.note||'',(l.price||0)*l.qty||'']));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),`${y}年${m}月`);
  XLSX.writeFile(wb,`月報表_${y}${m}.xlsx`);toast('月報表已匯出','success');
}

// ── LOG ───────────────────────────────────────────────────────────────────
async function addLog(type,name,qty,note,dateStr,itemId,price=0,meta={}){
  const now=new Date();
  const d=dateStr?localDateOnly(dateStr):now;
  const rawTime=dateStr?new Date(`${dateStr}T12:00:00`).toISOString():now.toISOString();
  const time=`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
  const log={
    type,name,qty:toQty(qty),note,time,rawTime,itemId,price:toQty(price),
    beforeStock:meta.beforeStock===undefined?null:toQty(meta.beforeStock),
    afterStock:meta.afterStock===undefined?null:toQty(meta.afterStock),
    refType:meta.refType||'',refId:meta.refId===undefined||meta.refId===null?'':String(meta.refId)
  };
  logs.unshift(log);
  try{await InventoryDataAdapter?.addInventoryLog?.(log);}
  catch(err){logs=logs.filter(l=>l!==log);console.error('操作紀錄寫入 Supabase 失敗：',err);toast('操作紀錄雲端寫入失敗','error');throw err;}
  if(logs.length>1000)logs=logs.slice(0,1000);
  return log;
}
function renderLog(){
  const q=(document.getElementById('log-search')?.value||'').toLowerCase();
  const filtered=logs.filter(l=>(lfilt==='all'||l.type===lfilt)&&(!q||(l.name||'').toLowerCase().includes(q)||(l.note||'').toLowerCase().includes(q)));
  const colors={'出':'var(--red)','進':'var(--green)','扣包材':'var(--amber)','調整':'var(--amber)','盤點':'var(--blue)'};
  document.getElementById('log-body').innerHTML=filtered.length?filtered.map(l=>{
    const stockFlow=l.beforeStock!==null&&l.afterStock!==null?`<div style="font-family:var(--mono);font-size:12px;color:var(--text2);min-width:90px;text-align:right;">${formatQty(l.beforeStock)} → ${formatQty(l.afterStock)}</div>`:'<div style="min-width:90px;"></div>';
    return`<div class="log-item"><div class="log-dot" style="background:${colors[l.type]||'var(--text3)'}"></div>
    <div class="log-time">${esc(l.time)}</div>
    <div style="min-width:36px;font-size:12px;font-weight:600;color:${colors[l.type]||'var(--text3)'};">${esc(l.type)}</div>
    <div style="flex:1;font-size:13px;">${esc(l.name)}</div>
    <div style="font-family:var(--mono);font-size:13px;font-weight:500;color:${colors[l.type]}">${(l.type==='出'||l.type==='扣包材')?'-':'+'}${formatQty(l.qty)}</div>
    ${stockFlow}
    <div style="font-size:12px;color:var(--text3);min-width:70px;text-align:right;">${esc(l.note||'')}</div>
    </div>`;
  }).join(''):'<div class="empty"><div class="empty-icon">📝</div><p>無紀錄</p></div>';
}
function setLF(f,el){lfilt=f;document.querySelectorAll('#panel-log .fbtn').forEach(b=>b.classList.remove('active'));el.classList.add('active');renderLog();}
async function clearLogs(){
  if(!confirm('確定清除所有操作紀錄？'))return;
  try{
    await InventoryDataAdapter?.clearInventoryLogs?.();
    logs=[];toast('已清除','warn');renderLog();saveData();
  }catch(err){console.error(err);alert('清除操作紀錄失敗，請稍後再試。');}
}

// ── DATA CHECK ────────────────────────────────────────────────────────────
function itemLabelById(id){
  const item=items.find(i=>i.id===id);
  return item?`${item.name}${item.partNo?`（${item.partNo}）`:''}`:`未知品項 / ${id||'空白 id'}`;
}
function pushDataIssue(list,severity,type,desc,ref){
  list.push({severity,type,desc,ref:ref||''});
}
function duplicateGroups(rows,keyFn){
  const map={};
  rows.forEach(row=>{
    const key=keyFn(row);
    if(!key)return;
    if(!map[key])map[key]=[];
    map[key].push(row);
  });
  return Object.values(map).filter(g=>g.length>1);
}
async function renderDataCheck(){
  if(!await refreshReportSource())return;
  const issues=[];
  const itemIds=new Set(items.map(i=>i.id));
  duplicateGroups(items,i=>String(i.partNo||'').trim().toLowerCase()).forEach(group=>{
    pushDataIssue(issues,'error','重複料號',`料號「${group[0].partNo}」有 ${group.length} 筆品項。`,group.map(i=>itemLabelById(i.id)).join('、'));
  });
  duplicateGroups(items.filter(i=>!String(i.partNo||'').trim()),i=>`${String(i.name||'').trim()}|${String(i.spec||'').trim()}|${i.type||''}`).forEach(group=>{
    pushDataIssue(issues,'warning','重複品項',`無料號品項「${group[0].name} / ${group[0].spec||'無規格'} / ${typeText(group[0].type)}」有 ${group.length} 筆。`,group.map(i=>itemLabelById(i.id)).join('、'));
  });
  bom.forEach(b=>{
    if(!itemIds.has(b.product))pushDataIssue(issues,'error','BOM 異常','product_item_id 找不到對應品項。',b.product||b.id||'');
    if(!itemIds.has(b.material))pushDataIssue(issues,'error','BOM 異常','material_item_id 找不到對應品項。',b.material||b.id||'');
    if(toQty(b.qty)<=0)pushDataIssue(issues,'error','BOM 異常','qty_per_unit 小於或等於 0。',`${itemLabelById(b.product)} → ${itemLabelById(b.material)}`);
  });
  locations.forEach(l=>{
    if(!itemIds.has(l.itemId))pushDataIssue(issues,'error','庫位異常','locations.item_id 找不到對應品項。',l.itemId||l.id||'');
    if(toQty(l.qty)<0)pushDataIssue(issues,'warning','庫位異常','locations.qty 小於 0。',`${itemLabelById(l.itemId)} / ${l.warehouse||''} ${l.zone||''}`);
  });
  duplicateGroups(locations,l=>`${l.itemId}|${String(l.warehouse||'').trim()}|${String(l.zone||'').trim().toUpperCase()}`).forEach(group=>{
    pushDataIssue(issues,'warning','庫位異常','同一 item_id + warehouse + location_code 有重複資料。',`${itemLabelById(group[0].itemId)} / ${group[0].warehouse||''} ${group[0].zone||''}`);
  });
  schedules.forEach(s=>{
    (s.products||[]).forEach(p=>{
      if(!itemIds.has(p.productId))pushDataIssue(issues,'error','排程異常','schedules.item_id 找不到對應品項。',p.productId||s.id||'');
      if(toQty(p.qty)<=0)pushDataIssue(issues,'error','排程異常','qty 小於或等於 0。',`${s.customer||''} / ${itemLabelById(p.productId)}`);
    });
    const status=s.status||(s.shipped?'shipped':'pending');
    if(!['pending','shipped','cancelled'].includes(status))pushDataIssue(issues,'warning','排程異常','status 不在 pending / shipped / cancelled。',`${s.id} / ${status}`);
    if((status==='shipped'||s.shipped)&&!s.shippedAt)pushDataIssue(issues,'warning','排程異常','已 shipped 但沒有 shipped_at。',s.id||s.customer||'');
  });
  logs.forEach(l=>{
    if(l.itemId&&!itemIds.has(l.itemId))pushDataIssue(issues,'warning','操作紀錄異常','inventory_logs.item_id 找不到對應品項。',l.itemId);
    if(l.beforeStock===null||l.afterStock===null)pushDataIssue(issues,'warning','操作紀錄異常','before_stock 或 after_stock 為 null。',`${l.name||'未知品項'} / ${l.time||''}`);
    if(('actionType'in l&&!String(l.actionType||'').trim())||(!('actionType'in l)&&!String(l.type||'').trim()))pushDataIssue(issues,'error','操作紀錄異常','action_type 空白。',l.id||l.itemId||'');
  });
  items.forEach(item=>{
    const locTotal=toQty(locations.filter(l=>l.itemId===item.id).reduce((sum,l)=>sum+toQty(l.qty),0).toFixed(2));
    if(Math.abs(locTotal-toQty(item.stock))>0.01){
      pushDataIssue(issues,'warning','庫位合計差異',`庫位合計 ${formatQty(locTotal)} 與帳面庫存 ${formatQty(item.stock)} 不一致。`,itemLabelById(item.id));
    }
  });
  const errorCount=issues.filter(i=>i.severity==='error').length;
  const warnCount=issues.length-errorCount;
  document.getElementById('dc-summary').innerHTML=`
    <div class="rpt-card"><div class="rpt-num" style="color:${issues.length?'var(--red)':'var(--green)'};">${issues.length}</div><div class="rpt-label">總問題數</div></div>
    <div class="rpt-card"><div class="rpt-num" style="color:var(--red);">${errorCount}</div><div class="rpt-label">錯誤</div></div>
    <div class="rpt-card"><div class="rpt-num" style="color:var(--amber);">${warnCount}</div><div class="rpt-label">警告</div></div>`;
  document.getElementById('dc-body').innerHTML=issues.length?issues.map(issue=>`
    <div class="dc-item ${issue.severity}">
      <div class="dc-badge">${issue.severity==='error'?'錯誤':'警告'}</div>
      <div class="dc-main">
        <div class="dc-title">${esc(issue.type)}</div>
        <div class="dc-desc">${esc(issue.desc)}</div>
        <div class="dc-ref">${esc(issue.ref)}</div>
      </div>
    </div>`).join(''):'<div class="empty"><div class="empty-icon">✓</div><p>目前未發現資料異常</p></div>';
}

// ── PURCHASE ──────────────────────────────────────────────────────────────
async function renderPurchase(){
  if(!await refreshReportSource())return;
  const needBuy=items.filter(i=>i.active!==false&&toQty(i.stock)<=toQty(i.minStock));
  document.getElementById('pur-body').innerHTML=needBuy.length?needBuy.map(i=>{
    const c=getPurchaseCycle(i.id),sq=getSmartSuggestedQty(i),available=getAvailableStock(i),reserved=getReservedQty(i.id);
    return`<tr>
      <td data-label="品項名稱"><strong style="font-weight:500;">${esc(i.name)}</strong></td>
      <td data-label="規格" style="color:var(--text2);">${esc(i.spec)}</td>
      <td data-label="單位"><span class="tag">${esc(i.unit)}</span></td>
      <td data-label="目前庫存" class="num" style="color:var(--text2);">${formatQty(i.stock)}</td>
      <td data-label="保留量" class="num" style="color:var(--amber);">${formatQty(reserved)}</td>
      <td data-label="可用庫存" class="num" style="color:var(--red);font-weight:700;">${formatQty(available)}</td>
      <td data-label="最低庫存" class="num" style="color:var(--text3);">${formatQty(i.minStock)}</td>
      <td data-label="建議採購" class="num" style="color:var(--green);font-weight:700;">${formatQty(sq)}</td>
      <td data-label="採購週期">${c?`<span class="cycle-info">約每 ${c} 天</span>`:'<span style="font-size:11px;color:var(--text3);">無記錄</span>'}</td>
      <td data-label="供應商" style="font-size:12px;color:var(--text3);">${esc(i.supplier||'—')}</td>
      <td data-label="狀態">${statusBadge(i)}</td>
    </tr>`;
  }).join(''):'<tr><td colspan="11" style="text-align:center;padding:48px;color:var(--text3);">✓ 目前無需採購品項</td></tr>';
}

// ── EXPORT / IMPORT ───────────────────────────────────────────────────────
async function exportExcel(){
  if(!await refreshReportSource())return;
  const wb=XLSX.utils.book_new();
  const inv=[['料號','品項名稱','規格/型號','花紋','顏色','類型','單位','帳面庫存','保留量','可用庫存','最低庫存數','採購週期(天)','損耗率%','供應商備註','狀態','啟用']];
  items.forEach(i=>{const s=getStatus(i);inv.push([i.partNo||'',i.name,i.spec,i.pattern||'',i.color||'',typeText(i.type),i.unit,i.stock,getReservedQty(i.id),getAvailableStock(i),i.minStock,i.purchaseCycleDays||'',i.waste||0,i.supplierNote||i.supplier||'',s==='buy'?'需採購':s==='low'?'偏低':'正常',i.active!==false?'是':'否']);});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(inv),'庫存總覽');
  const locData=[['料號','品項名稱','庫位','數量']];
  locations.filter(l=>l.qty>0).forEach(l=>{const item=items.find(i=>i.id===l.itemId);if(item)locData.push([item.partNo||'',item.name,l.zone,l.qty]);});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(locData),'庫位資料');
  const logData=[['時間','類型','品項','數量','異動前','異動後','備註','關聯類型','關聯ID']];
  logs.forEach(l=>logData.push([l.time,l.type,l.name,l.qty,l.beforeStock??'',l.afterStock??'',l.note||'',l.refType||'',l.refId||'']));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(logData),'操作紀錄');
  const bomData=[['產品','包材','單位用量','備註']];
  bom.forEach(b=>{
    const product=items.find(i=>i.id===b.product),material=items.find(i=>i.id===b.material);
    bomData.push([product?.name||'未知品項',material?.name||'未知品項',b.qty,b.label||'']);
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(bomData),'BOM');
  const schData=[['日期','客戶','訂單編號','負責人','品項','數量','狀態','備註','已出貨時間']];
  schedules.forEach(s=>(s.products||[]).forEach(p=>{
    const item=items.find(i=>i.id===p.productId);
    schData.push([s.date,s.customer,s.order||'',s.owner||'',item?.name||p.name||'未知品項',p.qty,s.status||getSchStatus(s),s.note||'',s.shippedAt||'']);
  }));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(schData),'出貨排程');
  const d=new Date();XLSX.writeFile(wb,`庫存管理_${d.getFullYear()}${d.getMonth()+1}${d.getDate()}.xlsx`);
  toast('匯出成功（含庫位資料）','success');
}
async function exportPurchase(){
  if(!await refreshReportSource())return;
  const nb=items.filter(i=>i.active!==false&&toQty(i.stock)<=toQty(i.minStock));
  const data=[['品項名稱','規格','單位','帳面庫存','保留量','可用庫存','最低庫存','建議採購量','採購週期','供應商','狀態']];
  nb.forEach(i=>{const c=getPurchaseCycle(i.id);const sq=getSmartSuggestedQty(i);data.push([i.name,i.spec,i.unit,i.stock,getReservedQty(i.id),getAvailableStock(i),i.minStock,sq,c?`約${c}天`:'—',i.supplierNote||i.supplier||'',i.stock<=i.minStock?'需採購':'偏低']);});
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),'採購清單');
  const d=new Date();XLSX.writeFile(wb,`採購清單_${d.getFullYear()}${d.getMonth()+1}${d.getDate()}.xlsx`);
  toast('採購清單已匯出','success');
}
function typeText(type){return type==='product'?'產品':type==='consumable'?'耗材':'包材';}
function parseImportType(value,warnings,rowNo){
  const raw=String(value||'').trim().toLowerCase();
  if(raw==='產品'||raw==='product')return'product';
  if(raw==='包材'||raw==='package'||raw==='material')return'package';
  if(raw==='耗材'||raw==='consumable')return'consumable';
  warnings.push(`第 ${rowNo} 列：類型無法辨識，已預設為包材`);
  return'package';
}
function parseImportFloat(value,label,warnings,rowNo){
  const raw=String(value??'').trim();
  if(raw==='')return 0;
  const n=parseFloat(raw);
  if(Number.isNaN(n)){warnings.push(`第 ${rowNo} 列：${label} 數字欄位格式錯誤，已改為 0`);return 0;}
  if(n<0)warnings.push(`第 ${rowNo} 列：${label} 為負數`);
  return n;
}
function parseImportInt(value,label,warnings,rowNo){
  const raw=String(value??'').trim();
  if(raw==='')return 0;
  const n=parseInt(raw,10);
  if(Number.isNaN(n)){warnings.push(`第 ${rowNo} 列：${label} 數字欄位格式錯誤，已改為 0`);return 0;}
  if(n<0)warnings.push(`第 ${rowNo} 列：${label} 為負數，已改為 0`);
  return Math.max(0,n);
}
function normalizeImportPartNo(value){return String(value||'').trim().toLowerCase();}
function normalizeImportText(value){return String(value||'').trim();}
function findImportItemMatch(data,options={}){
  const partKey=normalizeImportPartNo(data.partNo);
  if(partKey){
    const match=items.find(i=>normalizeImportPartNo(i.partNo)===partKey);
    if(!match&&options.fallbackName)return items.find(i=>normalizeImportText(i.name)===normalizeImportText(data.name))||null;
    return match||null;
  }
  const name=normalizeImportText(data.name),spec=normalizeImportText(data.spec),type=data.type==='material'?'package':data.type;
  return items.find(i=>normalizeImportText(i.name)===name&&normalizeImportText(i.spec)===spec&&(i.type==='material'?'package':i.type)===type);
}
async function upsertImportedItem(data,options={}){
  if(window.InventoryDataAdapter?.isSupabaseEnabled?.()){
    const result=await InventoryDataAdapter.importUpsertItem(data,options);
    const saved=result.item;
    const idx=items.findIndex(i=>i.id===saved.id);
    if(idx>=0)items[idx]=saved;else items.push(saved);
    return result.status;
  }
  const ex=findImportItemMatch(data,options);
  if(ex){Object.assign(ex,data);return'updated';}
  items.push({id:nextId++,...data});return'added';
}
function handleErpImport(ev){
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=async e=>{
    try{
      if(window.InventoryDataAdapter?.isSupabaseEnabled?.())await reloadCloudReportData();
      const wb=XLSX.read(e.target.result,{type:'binary'});
      const ws=wb.Sheets[wb.SheetNames[0]];

      // 自動偵測：檢查第一列是否為大標題（非欄位列）
      // 若 A1 不是 '公司別' 或 '品項名稱'，代表有標題列，跳過第一列
      const rawDefault=XLSX.utils.sheet_to_json(ws,{defval:''});
      const rawSkip1=XLSX.utils.sheet_to_json(ws,{defval:'',range:1});
      const firstKey=rawDefault.length?Object.keys(rawDefault[0])[0]:'';
      const isHeaderRow=firstKey==='公司別'||firstKey==='品項名稱'||firstKey==='料號'||firstKey==='成品代號';
      const raw=isHeaderRow?rawDefault:rawSkip1;

      if(!raw.length){toast('Excel 無資料','error');return;}

      // 自動偵測欄位格式（ERP格式 or 標準格式）
      const firstRow=raw[0];
      const isErp='成品代號' in firstRow||'產品名稱' in firstRow||'儲位' in firstRow;

      let added=0,updated=0,locUpdated=0,skipped=0;
      const warnings=[];

      if(isErp){
        // ── ERP 格式：成品代號、規格、花紋、顏色、產品名稱、儲位、數量 ──
        // 先按料號加總數量（同料號多儲位）
        const grouped={};
        raw.forEach(row=>{
          const partNo=String(row['成品代號']||'').trim();
          const name=String(row['產品名稱']||'').trim();
          const spec=String(row['規格']||'').trim();
          const pattern=String(row['花紋']||'').trim();
          const color=String(row['顏色']||'').trim();
          const warehouse=String(row['倉庫別']||'').trim();
          const zone=String(row['儲位']||'').trim().toUpperCase();
          const qty=+row['數量']||0;
          if(!partNo&&!name)return;
          const key=partNo||name;
          if(!grouped[key]){
            grouped[key]={partNo,name,spec,pattern,color,warehouse,totalQty:0,zones:[]};
          }
          grouped[key].totalQty+=qty;
          if(zone&&qty>0)grouped[key].zones.push({zone,qty});
        });

        for(const g of Object.values(grouped)){
          // 用料號找，找不到再用名稱
          const data={
            partNo:g.partNo,
            name:g.name||g.partNo,
            spec:g.spec,
            pattern:g.pattern,
            color:g.color,
            warehouse:g.warehouse,
            unit:'條',
            stock:g.totalQty,
            minStock:0,
            purchaseCycleDays:0,
            type:'product',
            waste:0,
            supplier:'',
            supplierNote:'',
            active:true
          };
          const result=await upsertImportedItem(data,{fallbackName:true});
          if(result==='updated')updated++;else added++;

          // 更新庫位：先清除舊庫位，再寫入新的
          const item=findImportItemMatch(data,{fallbackName:true})||items.find(i=>i.name===g.name);
          if(item&&g.zones.length){
            const oldLocs=locations.filter(l=>l.itemId===item.id);
            if(window.InventoryDataAdapter?.isSupabaseEnabled?.()){
              for(const loc of oldLocs)await InventoryDataAdapter.deleteLocation(loc);
            }
            locations=locations.filter(l=>l.itemId!==item.id);
            for(const {zone,qty} of g.zones){
              const loc={itemId:item.id,zone,qty};
              if(window.InventoryDataAdapter?.isSupabaseEnabled?.())await InventoryDataAdapter.saveLocation(loc);
              locations.push(loc);
            }
            locUpdated+=g.zones.length;
          }
        }

        normalizeData();
        if(window.InventoryDataAdapter?.isSupabaseEnabled?.()){items=await loadItemsFromSupabase();await reloadCloudReportData();}
        toast(`ERP 匯入完成：新增 ${added}，更新 ${updated} 筆，庫位更新 ${locUpdated} 筆`,'success');

      }else{
        // ── 標準庫存匯入格式 ──
        const seenPartNos=new Set();
        for(const [idx,row] of raw.entries()){
          const rowNo=idx+2;
          const partNo=String(row['料號']||'').trim();
          const name=String(row['品項名稱']||row['name']||'').trim();
          if(!name){skipped++;warnings.push(`第 ${rowNo} 列：品項名稱空白，已跳過`);continue;}
          if(partNo){
            const partKey=normalizeImportPartNo(partNo);
            if(seenPartNos.has(partKey))warnings.push(`第 ${rowNo} 列：料號 ${partNo} 重複，已用最後一筆更新`);
            seenPartNos.add(partKey);
          }
          const type=parseImportType(row['類型'],warnings,rowNo);
          const stock=parseImportFloat(row['庫存數'],'庫存數',warnings,rowNo);
          const minStock=parseImportFloat(row['最低庫存數'],'最低庫存數',warnings,rowNo);
          const purchaseCycleDays=parseImportInt(row['採購週期(天)'],'採購週期(天)',warnings,rowNo);
          const data={
            partNo,
            name,
            spec:String(row['規格/型號']||'').trim(),
            color:'',
            pattern:'',
            warehouse:'',
            unit:String(row['單位']||'個').trim()||'個',
            stock,
            minStock,
            purchaseCycleDays,
            type,
            waste:parseImportFloat(row['損耗率%'],'損耗率%',warnings,rowNo),
            supplier:String(row['供應商備註']||row['supplier']||'').trim(),
            supplierNote:String(row['供應商備註']||row['supplier']||'').trim(),
            active:true
          };
          const result=await upsertImportedItem(data);
          if(result==='updated')updated++;else added++;
        }
        // 庫位分頁
        if(wb.SheetNames.length>1){
          const lws=wb.Sheets[wb.SheetNames.find(n=>n.includes('庫位'))||wb.SheetNames[1]];
          if(lws){
            const ld=XLSX.utils.sheet_to_json(lws);
            for(const row of ld){
              const name=row['品項名稱'];const zone=(row['庫位']||'').toString().toUpperCase();const qty=+row['數量']||0;
              if(!name||!zone)continue;
              const item=items.find(i=>i.name===name);if(!item)continue;
              const exi=locations.find(l=>l.itemId===item.id&&l.zone===zone);
              if(exi){
                exi.qty=qty;
                if(window.InventoryDataAdapter?.isSupabaseEnabled?.())await InventoryDataAdapter.saveLocation(exi);
              }else if(qty>0){
                const loc={itemId:item.id,zone,qty};
                locations.push(loc);
                if(window.InventoryDataAdapter?.isSupabaseEnabled?.())await InventoryDataAdapter.saveLocation(loc);
              }
            }
          }
        }
        normalizeData();
        if(window.InventoryDataAdapter?.isSupabaseEnabled?.()){items=await loadItemsFromSupabase();await reloadCloudReportData();}
        const msg=`標準匯入完成：新增 ${added} 筆，更新 ${updated} 筆，跳過 ${skipped} 筆，警告 ${warnings.length} 筆`;
        toast(msg,warnings.length?'warn':'success');
        if(warnings.length)alert(`${msg}\n\n${warnings.slice(0,12).join('\n')}${warnings.length>12?`\n...另有 ${warnings.length-12} 筆警告`:''}`);
        else alert(msg);
      }
      refresh();
    }catch(err){console.error(err);alert(err?.message||'匯入失敗，請確認格式');toast('匯入失敗，請確認格式','error');}
  };
  r.readAsBinaryString(f);ev.target.value='';
}

function handleImport(ev){handleErpImport(ev);}





