// ── SCHEDULE ──────────────────────────────────────────────────────────────
function getSchStatus(sch){
  if(sch.status==='cancelled')return'cancelled';
  if(sch.shipped)return'shipped';
  const today=localDateOnly(new Date());
  const d=localDateOnly(sch.date);
  const diff=Math.floor((d-today)/(1000*60*60*24));
  if(diff<0)return'overdue';
  if(diff<=3)return'warning';
  return'pending';
}
function schStatusLabel(s){
  const map={shipped:'已出貨',cancelled:'已取消',overdue:'已逾期',warning:'即將到期',pending:'待出貨'};
  return map[s]||s;
}
function schStatusClass(s){
  const map={shipped:'sch-shipped',cancelled:'sch-shipped',overdue:'sch-overdue',warning:'sch-warning',pending:'sch-pending'};
  return map[s]||'sch-pending';
}
function updateSchBadge(){
  const urgent=schedules.filter(s=>!s.shipped&&(getSchStatus(s)==='overdue'||getSchStatus(s)==='warning')).length;
  const el=document.getElementById('badge-sch');
  if(urgent>0){el.style.display='';el.textContent=urgent;}else el.style.display='none';
}
function formatSchDate(dateStr){
  const d=localDateOnly(dateStr);
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return{month:months[d.getMonth()],day:d.getDate(),full:`${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`};
}
function renderSchedule(){
  updateSchBadge();
  // today banner
  const todaySchs=schedules.filter(s=>!s.shipped&&s.date===localTodayString());
  const bannerEl=document.getElementById('sch-today-banner');
  if(todaySchs.length){
    bannerEl.style.display='';
    bannerEl.innerHTML=`<div class="today-banner"><div><div style="font-size:15px;font-weight:500;">📦 今日出貨提醒</div><div style="font-size:13px;opacity:.85;margin-top:2px;">今天有 ${todaySchs.length} 筆排程需要出貨：${todaySchs.map(s=>esc(s.customer)).join('、')}</div></div><button class="btn" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.2);color:#fff;" onclick="setSchView('list');setSchFilter('warning',document.querySelector('#sch-list-filters .fbtn:nth-child(3)'))">查看</button></div>`;
  }else{bannerEl.style.display='none';}
  if(schView==='cal')renderCal();
  else renderSchList();
}
function setSchView(v){
  schView=v;
  document.getElementById('sch-cal-view').style.display=v==='cal'?'':'none';
  document.getElementById('sch-list-view').style.display=v==='list'?'':'none';
  document.getElementById('sch-list-filters').style.display=v==='list'?'':'none';
  document.getElementById('sch-view-cal').style.background=v==='cal'?'var(--accent)':'transparent';
  document.getElementById('sch-view-cal').style.color=v==='cal'?'#F7F5F0':'var(--text2)';
  document.getElementById('sch-view-list').style.background=v==='list'?'var(--accent)':'transparent';
  document.getElementById('sch-view-list').style.color=v==='list'?'#F7F5F0':'var(--text2)';
  if(v==='cal')renderCal();else renderSchList();
}
function setSchFilter(f,el){
  schFilter=f;
  document.querySelectorAll('#sch-list-filters .fbtn').forEach(b=>b.classList.remove('active'));
  if(el)el.classList.add('active');
  renderSchList();
}

// CALENDAR
function renderCal(){
  const months=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  document.getElementById('cal-month-label').textContent=`${calYear} 年 ${months[calMonth]}`;
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const daysInPrev=new Date(calYear,calMonth,0).getDate();
  const today=localDateOnly(new Date());
  let cells=[];
  // prev month padding
  for(let i=firstDay-1;i>=0;i--)cells.push({day:daysInPrev-i,cur:false});
  // current month
  for(let d=1;d<=daysInMonth;d++)cells.push({day:d,cur:true});
  // next month padding
  const rem=42-cells.length;
  for(let d=1;d<=rem;d++)cells.push({day:d,cur:false});

  const grid=document.getElementById('cal-grid');
  grid.innerHTML=cells.map(({day,cur})=>{
    if(!cur)return`<div class="cal-cell other-month"><div class="cal-date" style="color:var(--text3);">${day}</div></div>`;
    const dateStr=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const cellDate=new Date(calYear,calMonth,day);
    const isToday=cellDate.getTime()===today.getTime();
    const daySchs=schedules.filter(s=>s.date===dateStr);
    const hasAny=daySchs.length>0;
    const events=daySchs.slice(0,3).map(s=>{
      const st=getSchStatus(s);
      return`<div class="cal-event ${st}" onclick='openSchDetail(${JSON.stringify(s.id)},event)' title="${esc(s.customer)} - ${esc(s.products.map(p=>p.name+'×'+p.qty).join(', '))}">${esc(s.customer)}</div>`;
    }).join('');
    const more=daySchs.length>3?`<div style="font-size:10px;color:var(--text3);padding:1px 4px;">+${daySchs.length-3} 筆</div>`:'';
    return`<div class="cal-cell${isToday?' today':''}${hasAny?' has-schedule':''}" onclick="openAddSchOnDate('${dateStr}')">
      <div class="cal-date${isToday?'':''}">${isToday?`<span style="background:var(--accent);color:#F7F5F0;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;">${day}</span>`:day}</div>
      ${events}${more}
    </div>`;
  }).join('');
}
function calPrev(){calMonth--;if(calMonth<0){calMonth=11;calYear--;}renderCal();}
function calNext(){calMonth++;if(calMonth>11){calMonth=0;calYear++;}renderCal();}
function calToday(){calYear=new Date().getFullYear();calMonth=new Date().getMonth();renderCal();}

// LIST VIEW
function renderSchList(){
  let list=schedules.filter(s=>schFilter==='all'||(schFilter==='shipped'?s.shipped:getSchStatus(s)===schFilter));
  list=list.sort((a,b)=>localDateOnly(a.date)-localDateOnly(b.date));
  if(!list.length){document.getElementById('sch-list-body').innerHTML='<div class="empty"><div class="empty-icon">📅</div><p>無排程</p></div>';return;}
  const today=localTodayString();
  document.getElementById('sch-list-body').innerHTML=list.map(s=>{
    const{month,day,full}=formatSchDate(s.date);
    const st=getSchStatus(s);
    const isToday=s.date===today;
    const isOverdue=st==='overdue';
    const blockClass=isToday?'today-block':isOverdue?'overdue-block':'';
    const products=s.products||[];
    const diff=Math.floor((localDateOnly(s.date)-localDateOnly(new Date()))/(1000*60*60*24));
    const diffLabel=s.shipped?'已出貨':isOverdue?`逾期 ${Math.abs(diff)} 天`:diff===0?'今天出貨':`${diff} 天後`;
    return`<div class="sch-item">
      <div class="sch-date-block ${blockClass}">
        <div class="sch-date-month">${month}</div>
        <div class="sch-date-day">${day}</div>
      </div>
      <div class="sch-body">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
          <div class="sch-title">${esc(s.customer)}</div>
          <span class="sch-status ${schStatusClass(st)}">${schStatusLabel(st)}</span>
          <span style="font-size:11px;color:var(--text3);margin-left:4px;">${diffLabel}</span>
        </div>
        <div class="sch-meta">
          ${s.order?`<span>訂單：${esc(s.order)}</span>`:''}
          ${s.owner?`<span>負責人：${esc(s.owner)}</span>`:''}
          <span>${full}</span>
        </div>
        <div class="sch-products">
          ${products.map(p=>`<span class="sch-prod-tag">${esc(p.name)} ×${p.qty}</span>`).join('')}
        </div>
        ${s.note?`<div style="font-size:12px;color:var(--text3);margin-top:4px;">📝 ${esc(s.note)}</div>`:''}
      </div>
      <div class="sch-actions">
        ${!s.shipped?`<button class="btn btn-success btn-sm" onclick='confirmSchShip(${JSON.stringify(s.id)})'>✓ 確認出貨</button>`:'<span style="font-size:11px;color:var(--green);">✓ 已完成</span>'}
        <button class="btn btn-default btn-sm" onclick='openSchDetail(${JSON.stringify(s.id)})'>編輯</button>
        <button class="btn btn-ghost btn-sm" onclick='delSch(${JSON.stringify(s.id)})' style="color:var(--red);">刪除</button>
      </div>
    </div>`;
  }).join('');
}

// SCHEDULE MODAL
let schProductRows=[];
function openSchModal(dateStr){
  document.getElementById('modal-sch-title').textContent='新增出貨排程';
  document.getElementById('sch-edit-id').value='';
  document.getElementById('sch-customer').value='';
  document.getElementById('sch-order').value='';
  document.getElementById('sch-owner').value='';
  document.getElementById('sch-note').value='';
  document.getElementById('sch-date').value=dateStr||localTodayString();
  document.getElementById('sch-date').disabled=false;
  schProductRows=[];
  renderSchProductRows();
  addSchProduct();
  openModal('modal-sch');
}
function openAddSchOnDate(dateStr){openSchModal(dateStr);}
function openSchDetail(id,e){
  if(e)e.stopPropagation();
  const s=schedules.find(x=>x.id===id);if(!s)return;
  document.getElementById('modal-sch-title').textContent='編輯出貨排程';
  document.getElementById('sch-edit-id').value=id;
  document.getElementById('sch-customer').value=s.customer;
  document.getElementById('sch-order').value=s.order||'';
  document.getElementById('sch-owner').value=s.owner||'';
  document.getElementById('sch-note').value=s.note||'';
  document.getElementById('sch-date').value=s.date;
  document.getElementById('sch-date').disabled=!!s.shipped;
  schProductRows=s.products?s.products.map(p=>({...p})):[];
  renderSchProductRows();
  openModal('modal-sch');
}
function addSchProduct(){
  const eid=document.getElementById('sch-edit-id')?.value;
  const sid=normalizeRefId(eid);
  const s=eid?schedules.find(x=>x.id===sid):null;
  if(s?.shipped){toast('已出貨排程不可修改扣庫內容','warn');return;}
  schProductRows.push({productId:'',name:'',qty:1});
  renderSchProductRows();
}
function renderSchProductRows(){
  const eid=document.getElementById('sch-edit-id')?.value;
  const sid=normalizeRefId(eid);
  const editing=schedules.find(x=>x.id===sid);
  const locked=!!editing?.shipped;
  const prods=items.filter(i=>i.type==='product'&&i.active!==false);
  const warning=locked?'<div class="alert alert-amber" style="margin-bottom:8px;">已出貨排程不可修改扣庫內容</div>':'';
  document.getElementById('sch-products-wrap').innerHTML=warning+schProductRows.map((row,idx)=>`
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:7px;">
      <select ${locked?'disabled':''} onchange="schProdChange(${idx},this)" style="flex:2;height:36px;padding:0 10px;border:1.5px solid var(--border2);border-radius:var(--r-sm);font-size:13px;font-family:var(--font);background:var(--surface);color:var(--text);outline:none;">
        <option value="">— 選擇產品 —</option>
        ${prods.concat(items.filter(i=>i.id===row.productId&&i.active===false)).map(p=>`<option value="${p.id}" ${p.id===row.productId?'selected':''}>${esc(p.name)}（可用：${formatQty(getAvailableStock(p,editing?.id||null))}${esc(p.unit)}）${p.active===false?' - 停用':''}</option>`).join('')}
      </select>
      <input type="number" value="${formatQty(row.qty)}" min="0" step="0.01" ${locked?'disabled':''} onchange="schProductRows[${idx}].qty=toQty(this.value,1)" style="width:80px;height:36px;padding:0 10px;border:1.5px solid var(--border2);border-radius:var(--r-sm);font-size:13px;font-family:var(--mono);text-align:right;background:var(--surface);color:var(--text);outline:none;">
      <button ${locked?'disabled':''} onclick="schProductRows.splice(${idx},1);renderSchProductRows();" style="width:28px;height:28px;border:none;background:var(--red-bg);color:var(--red);border-radius:var(--r-sm);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">×</button>
    </div>`).join('');
}
function schProdChange(idx,sel){
  const pid=normalizeRefId(sel.value);
  const item=items.find(i=>i.id===pid);
  schProductRows[idx].productId=pid;
  schProductRows[idx].name=item?item.name:'';
}
async function saveSch(){
  const customer=document.getElementById('sch-customer').value.trim();
  if(!customer){toast('請輸入客戶名稱','error');return;}
  const eid=document.getElementById('sch-edit-id').value;
  const sid=normalizeRefId(eid);
  const existing=eid?schedules.find(x=>x.id===sid):null;
  const date=document.getElementById('sch-date').value;
  if(!date){toast('請選擇出貨日期','error');return;}
  const prods=schProductRows.filter(r=>r.productId&&r.name);
  const common={customer,order:document.getElementById('sch-order').value.trim(),owner:document.getElementById('sch-owner').value.trim(),note:document.getElementById('sch-note').value.trim()};
  try{
    if(existing?.shipped){
      const updated={...existing,...common,status:'shipped',shipped:true};
      const saved=await InventoryDataAdapter?.saveSchedule?.(updated);
      Object.assign(existing,saved||updated);
      toast('排程已更新；已出貨排程不可修改扣庫內容','success');
    }else{
      const issues=buildScheduleAvailabilityIssues(prods,existing?.id||null);
      if(issues.length&&!confirm(`此排程會造成未來可用庫存不足：\n${issues.join('\n')}\n\n仍要儲存排程？`))return;
      if(window.InventoryDataAdapter?.isSupabaseEnabled?.()){
        if(!prods.length){toast('請至少選擇一個產品','error');return;}
        if(existing){
          const data={...existing,...common,date,products:[prods[0]],status:'pending',shipped:false,shippedAt:''};
          const saved=await InventoryDataAdapter.saveSchedule(data);
          Object.assign(existing,saved||data);
          toast('排程已更新','success');
        }else{
          for(const p of prods){
            const saved=await InventoryDataAdapter.saveSchedule({id:'',...common,date,products:[p],status:'pending',shipped:false,shippedAt:''});
            schedules.push(saved);
          }
          toast(prods.length>1?`排程已新增 ${prods.length} 筆`:'排程已新增','success');
        }
      }else{
        const data={...common,date,products:prods,status:'pending',shipped:false};
        if(existing){Object.assign(existing,data);await InventoryDataAdapter?.saveSchedule?.(existing);toast('排程已更新','success');}
        else{schedules.push({id:nextSchId++,...data});toast('排程已新增','success');}
      }
    }
    await reloadCloudSchedules();
    closeModal('modal-sch');saveData();renderSchedule();
  }catch(err){console.error(err);alert(err?.message||'排程儲存失敗');}
}
async function confirmSchShip(id){
  const s=schedules.find(x=>x.id===id);if(!s)return;
  if(s.shipped){toast('此排程已出貨，不能重複扣庫','warn');return;}
  try{
    if(window.InventoryDataAdapter?.isSupabaseEnabled?.()){
      await reloadCloudItemsAndLogs();
      await reloadCloudBomItems();
      await reloadCloudSchedules();
    }
  }catch(err){console.error(err);alert(err?.message||'Supabase 排程資料重新讀取失敗');return;}
  const fresh=schedules.find(x=>x.id===id)||s;
  if(fresh.shipped){toast('此排程已出貨，不能重複扣庫','warn');return;}
  const check=buildShipmentCheck(fresh.products||[]);
  if(!check.ok){alert(`以下庫存不足，無法確認出貨：\n${check.issues.join('\n')}`);return;}
  try{
    for(const p of fresh.products||[]){
      const item=items.find(i=>i.id===p.productId);
      if(!item)throw new Error(`找不到排程品項：${p.name||p.productId}`);
      const before=item.stock;
      const after=toQty((item.stock-p.qty).toFixed(2));
      await InventoryDataAdapter?.updateItem?.(item.id,{stock:after});
      item.stock=after;
      await addLog('出',item.name,p.qty,`排程出貨:${fresh.customer} ${fresh.order||''}`,fresh.date,item.id,0,{beforeStock:before,afterStock:after,refType:'schedule',refId:fresh.id});
    }
    for(const {item:mat,qty} of check.consumptions){
      const before=mat.stock;
      const after=toQty((mat.stock-qty).toFixed(2));
      await InventoryDataAdapter?.updateItem?.(mat.id,{stock:after});
      mat.stock=after;
      await addLog('扣包材',mat.name,qty,`排程出貨自動扣包材:${fresh.customer}`,fresh.date,mat.id,0,{beforeStock:before,afterStock:after,refType:'schedule',refId:fresh.id});
    }
    fresh.shipped=true;fresh.status='shipped';fresh.shippedAt=new Date().toISOString();
    await InventoryDataAdapter?.saveSchedule?.(fresh);
    await reloadCloudItemsAndLogs();
    await reloadCloudBomItems();
    await reloadCloudSchedules();
    toast(`${fresh.customer} 出貨完成！庫存已自動扣除`,'success');
    saveData();refresh();renderSchedule();
  }catch(err){console.error(err);alert(err?.message||'確認出貨失敗');}
}
async function delSch(id){
  if(!confirm('確定要刪除此排程？'))return;
  try{
    await InventoryDataAdapter?.deleteSchedule?.(id);
    schedules=schedules.filter(s=>s.id!==id);
    await reloadCloudSchedules();
    toast('已刪除','warn');saveData();renderSchedule();
  }catch(err){console.error(err);alert(err?.message||'排程刪除失敗');}
}




