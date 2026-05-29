// ── TREND ─────────────────────────────────────────────────────────────────
function populateTrend(){document.getElementById('trend-item').innerHTML=items.filter(i=>i.active!==false).map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join('');}
function renderTrend(){
  const itemId=parseInt(document.getElementById('trend-item').value);
  const days=parseInt(document.getElementById('trend-days').value)||30;
  const item=items.find(i=>i.id===itemId);if(!item)return;
  const labels=[],inData=[],outData=[];
  for(let d=days-1;d>=0;d--){
    const dt=new Date();dt.setDate(dt.getDate()-d);
    const ds=`${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()}`;
    labels.push(`${dt.getMonth()+1}/${dt.getDate()}`);
    const dl=logs.filter(l=>l.itemId===itemId&&l.time===ds);
    inData.push(dl.filter(l=>l.type==='進'||l.type==='盤點').reduce((s,l)=>s+l.qty,0));
    outData.push(dl.filter(l=>l.type==='出').reduce((s,l)=>s+l.qty,0));
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
function renderReport(){
  const y=parseInt(document.getElementById('rpt-year').value),m=parseInt(document.getElementById('rpt-month').value);
  const pfx=`${y}/${m}/`;const ml=logs.filter(l=>l.time.startsWith(pfx));
  const outs=ml.filter(l=>l.type==='出'),ins=ml.filter(l=>l.type==='進');
  const cost=ins.reduce((s,l)=>s+(l.price||0)*l.qty,0);
  document.getElementById('rpt-metrics').innerHTML=`
    <div class="rpt-card"><div class="rpt-num" style="color:var(--red);">${outs.length}</div><div class="rpt-label">出貨次數</div></div>
    <div class="rpt-card"><div class="rpt-num" style="color:var(--green);">${ins.length}</div><div class="rpt-label">進貨次數</div></div>
    <div class="rpt-card"><div class="rpt-num" style="color:var(--amber);">${cost>0?'$'+cost.toLocaleString():'—'}</div><div class="rpt-label">進貨金額</div></div>`;
  const renderList=(arr,elId)=>{
    const g={};arr.forEach(l=>{if(!g[l.name])g[l.name]=0;g[l.name]+=l.qty;});
    document.getElementById(elId).innerHTML=Object.entries(g).sort((a,b)=>b[1]-a[1]).map(([n,q])=>`
      <div class="log-item"><div style="flex:1;font-size:13px;">${n}</div><div style="font-family:var(--mono);font-size:13px;font-weight:500;">${q}</div></div>`).join('')||'<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">無紀錄</div>';
  };
  renderList(outs,'rpt-out');renderList(ins,'rpt-in');
}
function exportReport(){
  const y=parseInt(document.getElementById('rpt-year').value),m=parseInt(document.getElementById('rpt-month').value);
  const ml=logs.filter(l=>l.time.startsWith(`${y}/${m}/`));
  const wb=XLSX.utils.book_new();
  const data=[['時間','類型','品項','數量','備註','金額']];
  ml.forEach(l=>data.push([l.time,l.type,l.name,l.qty,l.note||'',(l.price||0)*l.qty||'']));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),`${y}年${m}月`);
  XLSX.writeFile(wb,`月報表_${y}${m}.xlsx`);toast('月報表已匯出','success');
}

// ── LOG ───────────────────────────────────────────────────────────────────
function addLog(type,name,qty,note,dateStr,itemId,price=0,meta={}){
  const now=new Date();
  const d=dateStr?localDateOnly(dateStr):now;
  const rawTime=dateStr?new Date(`${dateStr}T12:00:00`).toISOString():now.toISOString();
  const time=`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
  logs.unshift({
    type,name,qty:toQty(qty),note,time,rawTime,itemId,price:toQty(price),
    beforeStock:meta.beforeStock===undefined?null:toQty(meta.beforeStock),
    afterStock:meta.afterStock===undefined?null:toQty(meta.afterStock),
    refType:meta.refType||'',refId:meta.refId===undefined||meta.refId===null?'':String(meta.refId)
  });
  if(logs.length>1000)logs=logs.slice(0,1000);
}
function renderLog(){
  const q=(document.getElementById('log-search')?.value||'').toLowerCase();
  const filtered=logs.filter(l=>(lfilt==='all'||l.type===lfilt)&&(!q||l.name.toLowerCase().includes(q)||(l.note||'').toLowerCase().includes(q)));
  const colors={'出':'var(--red)','進':'var(--green)','調整':'var(--amber)','盤點':'var(--blue)'};
  document.getElementById('log-body').innerHTML=filtered.length?filtered.map(l=>{
    const stockFlow=l.beforeStock!==null&&l.afterStock!==null?`<div style="font-family:var(--mono);font-size:12px;color:var(--text2);min-width:90px;text-align:right;">${formatQty(l.beforeStock)} → ${formatQty(l.afterStock)}</div>`:'<div style="min-width:90px;"></div>';
    return`<div class="log-item"><div class="log-dot" style="background:${colors[l.type]||'var(--text3)'}"></div>
    <div class="log-time">${esc(l.time)}</div>
    <div style="min-width:36px;font-size:12px;font-weight:600;color:${colors[l.type]||'var(--text3)'};">${esc(l.type)}</div>
    <div style="flex:1;font-size:13px;">${esc(l.name)}</div>
    <div style="font-family:var(--mono);font-size:13px;font-weight:500;color:${colors[l.type]}">${l.type==='出'?'-':'+'}${formatQty(l.qty)}</div>
    ${stockFlow}
    <div style="font-size:12px;color:var(--text3);min-width:70px;text-align:right;">${esc(l.note||'')}</div>
    </div>`;
  }).join(''):'<div class="empty"><div class="empty-icon">📝</div><p>無紀錄</p></div>';
}
function setLF(f,el){lfilt=f;document.querySelectorAll('#panel-log .fbtn').forEach(b=>b.classList.remove('active'));el.classList.add('active');renderLog();}
function clearLogs(){if(!confirm('確定清除所有操作紀錄？'))return;logs=[];toast('已清除','warn');renderLog();saveData();}

// ── PURCHASE ──────────────────────────────────────────────────────────────
function renderPurchase(){
  const needBuy=items.filter(i=>i.active!==false&&(getStatus(i)==='buy'||getStatus(i)==='low'));
  document.getElementById('pur-body').innerHTML=needBuy.length?needBuy.map(i=>{
    const c=getPurchaseCycle(i.id),sq=getSmartSuggestedQty(i),available=getAvailableStock(i),reserved=getReservedQty(i.id);
    return`<tr>
      <td><strong style="font-weight:500;">${esc(i.name)}</strong></td>
      <td style="color:var(--text2);">${esc(i.spec)}</td>
      <td><span class="tag">${esc(i.unit)}</span></td>
      <td class="num" style="color:var(--text2);">${formatQty(i.stock)}</td>
      <td class="num" style="color:var(--amber);">${formatQty(reserved)}</td>
      <td class="num" style="color:var(--red);font-weight:700;">${formatQty(available)}</td>
      <td class="num" style="color:var(--text3);">${formatQty(i.minStock)}</td>
      <td class="num" style="color:var(--green);font-weight:700;">${formatQty(sq)}</td>
      <td>${c?`<span class="cycle-info">約每 ${c} 天</span>`:'<span style="font-size:11px;color:var(--text3);">無記錄</span>'}</td>
      <td style="font-size:12px;color:var(--text3);">${esc(i.supplier||'—')}</td>
      <td>${statusBadge(i)}</td>
    </tr>`;
  }).join(''):'<tr><td colspan="11" style="text-align:center;padding:48px;color:var(--text3);">✓ 目前無需採購品項</td></tr>';
}

// ── EXPORT / IMPORT ───────────────────────────────────────────────────────
function exportExcel(){
  const wb=XLSX.utils.book_new();
  const inv=[['料號','品項名稱','規格/型號','花紋','顏色','類型','單位','帳面庫存','保留量','可用庫存','最低庫存數','採購週期(天)','損耗率%','供應商備註','狀態','啟用']];
  items.forEach(i=>{const s=getStatus(i);inv.push([i.partNo||'',i.name,i.spec,i.pattern||'',i.color||'',typeText(i.type),i.unit,i.stock,getReservedQty(i.id),getAvailableStock(i),i.minStock,i.purchaseCycleDays||'',i.waste||0,i.supplier||'',s==='buy'?'需採購':s==='low'?'偏低':'正常',i.active!==false?'是':'否']);});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(inv),'庫存總覽');
  const locData=[['料號','品項名稱','庫位','數量']];
  locations.filter(l=>l.qty>0).forEach(l=>{const item=items.find(i=>i.id===l.itemId);if(item)locData.push([item.partNo||'',item.name,l.zone,l.qty]);});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(locData),'庫位資料');
  const logData=[['時間','類型','品項','數量','異動前','異動後','備註','關聯類型','關聯ID']];
  logs.forEach(l=>logData.push([l.time,l.type,l.name,l.qty,l.beforeStock??'',l.afterStock??'',l.note||'',l.refType||'',l.refId||'']));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(logData),'操作紀錄');
  const d=new Date();XLSX.writeFile(wb,`庫存管理_${d.getFullYear()}${d.getMonth()+1}${d.getDate()}.xlsx`);
  toast('匯出成功（含庫位資料）','success');
}
function exportPurchase(){
  const nb=items.filter(i=>i.active!==false&&(getStatus(i)==='buy'||getStatus(i)==='low'));
  const data=[['品項名稱','規格','單位','帳面庫存','保留量','可用庫存','最低庫存','建議採購量','採購週期','供應商','狀態']];
  nb.forEach(i=>{const c=getPurchaseCycle(i.id);const sq=getSmartSuggestedQty(i);const s=getStatus(i);data.push([i.name,i.spec,i.unit,i.stock,i.minStock,sq,c?`約${c}天`:'—',i.supplier||'',s==='buy'?'需採購':'偏低']);});
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
function handleErpImport(ev){
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{
    try{
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

        Object.values(grouped).forEach(g=>{
          // 用料號找，找不到再用名稱
          let ex=g.partNo?items.find(i=>i.partNo===g.partNo):null;
          if(!ex)ex=items.find(i=>i.name===g.name);

          if(ex){
            // 更新現有品項
            ex.stock=g.totalQty;
            if(g.partNo)ex.partNo=g.partNo;
            if(g.spec)ex.spec=g.spec;
            if(g.pattern)ex.pattern=g.pattern;
            if(g.color)ex.color=g.color;
            if(g.warehouse)ex.warehouse=g.warehouse;
            updated++;
          }else{
            // 新增品項
            items.push({
              id:nextId++,
              partNo:g.partNo,
              name:g.name||g.partNo,
              spec:g.spec,
              pattern:g.pattern,
              color:g.color,
              warehouse:g.warehouse,
              unit:'條',
              stock:g.totalQty,
              minStock:0,
              type:'product',
              waste:0,
              supplier:''
            });
            added++;
          }

          // 更新庫位：先清除舊庫位，再寫入新的
          const item=items.find(i=>i.partNo===g.partNo||(i.name===g.name));
          if(item&&g.zones.length){
            locations=locations.filter(l=>l.itemId!==item.id);
            g.zones.forEach(({zone,qty})=>{
              locations.push({itemId:item.id,zone,qty});
            });
            locUpdated+=g.zones.length;
          }
        });

        normalizeData();
        toast(`ERP 匯入完成：新增 ${added}，更新 ${updated} 筆，庫位更新 ${locUpdated} 筆`,'success');

      }else{
        // ── 標準庫存匯入格式 ──
        const seenPartNos=new Set();
        raw.forEach((row,idx)=>{
          const rowNo=idx+2;
          const partNo=String(row['料號']||'').trim();
          const name=String(row['品項名稱']||row['name']||'').trim();
          if(!name){skipped++;warnings.push(`第 ${rowNo} 列：品項名稱空白，已跳過`);return;}
          if(partNo){
            if(seenPartNos.has(partNo))warnings.push(`第 ${rowNo} 列：料號 ${partNo} 重複，已用最後一筆更新`);
            seenPartNos.add(partNo);
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
            active:true
          };
          let ex=partNo?items.find(i=>i.partNo===partNo):null;
          if(!ex)ex=items.find(i=>i.name===name);
          if(ex){Object.assign(ex,data);updated++;}
          else{items.push({id:nextId++,...data});added++;}
        });
        // 庫位分頁
        if(wb.SheetNames.length>1){
          const lws=wb.Sheets[wb.SheetNames.find(n=>n.includes('庫位'))||wb.SheetNames[1]];
          if(lws){const ld=XLSX.utils.sheet_to_json(lws);ld.forEach(row=>{const name=row['品項名稱'];const zone=(row['庫位']||'').toString().toUpperCase();const qty=+row['數量']||0;if(!name||!zone)return;const item=items.find(i=>i.name===name);if(!item)return;const exi=locations.find(l=>l.itemId===item.id&&l.zone===zone);if(exi)exi.qty=qty;else if(qty>0)locations.push({itemId:item.id,zone,qty});});}
        }
        normalizeData();
        const msg=`標準匯入完成：新增 ${added} 筆，更新 ${updated} 筆，跳過 ${skipped} 筆，警告 ${warnings.length} 筆`;
        toast(msg,warnings.length?'warn':'success');
        if(warnings.length)alert(`${msg}\n\n${warnings.slice(0,12).join('\n')}${warnings.length>12?`\n...另有 ${warnings.length-12} 筆警告`:''}`);
        else alert(msg);
      }
      refresh();
    }catch(err){console.error(err);toast('匯入失敗，請確認格式','error');}
  };
  r.readAsBinaryString(f);ev.target.value='';
}

function handleImport(ev){handleErpImport(ev);}





