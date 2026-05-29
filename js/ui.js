// ── NAV ───────────────────────────────────────────────────────────────────
const panelMeta={
  overview:['總覽儀表板','掌握所有庫存狀況'],
  schedule:['出貨排程','月曆 + 列表雙視圖，含庫存預扣'],
  inventory:['庫存總覽','查看與快速調整品項'],
  shipout:['出貨登記','自動扣除包材庫存'],
  shipin:['進貨登記','補充庫存數量'],
  stocktake:['批次盤點','實際盤點與帳面比對'],
  location:['庫位管理','查詢品項放在哪個庫位'],
  bom:['包材對照表（BOM）','設定產品與包材對應'],
  usage:['包材使用率排行','消耗量統計與排行'],
  trend:['庫存趨勢圖','異動歷史與消耗分析'],
  report:['月報表','每月出入庫統計'],
  log:['操作紀錄','所有出入庫歷史'],
  datacheck:['資料檢查','檢查重複、缺失與關聯異常'],
  help:['使用說明','內部試用流程與注意事項'],
  purchase:['採購清單','含採購週期智慧建議'],
};
function updateTrialStatus(){
  const cloudMode=!!window.InventoryDataAdapter?.isSupabaseEnabled?.();
  const modeText=cloudMode?'Supabase 雲端模式':'localStorage 本機模式';
  const statusText=cloudMode?(cloudConnectionOk?'雲端連線正常':'雲端連線失敗'):'本機資料模式';
  const modeEls=[document.getElementById('data-mode-badge'),document.getElementById('help-data-mode')].filter(Boolean);
  const statusEls=[document.getElementById('cloud-status-badge'),document.getElementById('help-cloud-status')].filter(Boolean);
  modeEls.forEach(el=>{el.textContent=modeText;el.className=`trial-badge ${cloudMode?'cloud':'local'}`;});
  statusEls.forEach(el=>{el.textContent=statusText;el.className=`trial-badge ${cloudMode&&cloudConnectionOk?'ok':cloudMode?'fail':'local'}`;});
}
async function ensureFreshReportData(){
  if(!window.InventoryDataAdapter?.isSupabaseEnabled?.())return true;
  try{await reloadCloudReportData();return true;}
  catch(err){console.error(err);alert(err?.message||'Supabase 報表資料讀取失敗');return false;}
}
async function go(name,el){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.nav-sub-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('panel-'+name).classList.add('active');
  el.classList.add('active');
  const [t,s]=panelMeta[name]||['',''];
  document.getElementById('tb-title').textContent=t;
  document.getElementById('tb-sub').textContent=s;
  if(['overview','purchase','usage','trend','report','log','datacheck'].includes(name)){
    const ok=await ensureFreshReportData();
    if(!ok){closeMobileMenu();return;}
  }
  if(name==='log')renderLog();
  else if(name==='purchase')renderPurchase();
  else if(name==='bom'){populateBOM();renderBOM();}
  else if(name==='shipout')populateSO();
  else if(name==='shipin')populateSI();
  else if(name==='overview')renderOverview();
  else if(name==='inventory')filterInv();
  else if(name==='stocktake')renderST();
  else if(name==='location')renderLoc();
  else if(name==='usage')renderUsage();
  else if(name==='trend'){populateTrend();renderTrend();}
  else if(name==='report'){initRpt();renderReport();}
  else if(name==='datacheck')renderDataCheck();
  else if(name==='help')updateTrialStatus();
  else if(name==='schedule')renderSchedule();
  closeMobileMenu();
}
function toggleInvMenu(){document.getElementById('inv-submenu').classList.toggle('collapsed');}
function toggleMobileMenu(){document.body.classList.toggle('mobile-nav-open');}
function closeMobileMenu(){document.body.classList.remove('mobile-nav-open');}
function setInvType(type,el){
  sfilt=type;
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.nav-sub-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('panel-inventory').classList.add('active');
  document.querySelector('.nav-parent').classList.add('active');
  el.classList.add('active');
  const labels={all:['庫存總覽','全部 active 品項'],product:['產品庫存','只顯示產品品項'],package:['包材庫存','只顯示包材品項'],consumable:['耗材庫存','只顯示耗材品項']};
  const [t,s]=labels[type]||labels.all;
  document.getElementById('tb-title').textContent=t;
  document.getElementById('tb-sub').textContent=s;
  filterInv();
  closeMobileMenu();
}
function goItemManage(el){
  sfilt='manage';
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.nav-sub-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('panel-inventory').classList.add('active');
  el.classList.add('active');
  document.getElementById('tb-title').textContent='品項管理';
  document.getElementById('tb-sub').textContent='新增、編輯與停用品項';
  filterInv();
  closeMobileMenu();
}
function goInactiveItems(el){
  sfilt='inactive';
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll('.nav-sub-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('panel-inventory').classList.add('active');
  el.classList.add('active');
  document.getElementById('tb-title').textContent='停用品項';
  document.getElementById('tb-sub').textContent='重新啟用或清理測試品項';
  filterInv();
  closeMobileMenu();
}

// ── MODAL ─────────────────────────────────────────────────────────────────
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal-overlay').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)closeModal(el.id);}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));});

// ── TOAST ─────────────────────────────────────────────────────────────────
function toast(msg,type=''){
  const wrap=document.getElementById('toast-wrap');
  const el=document.createElement('div');
  el.className=`toast${type?` toast-${type}`:''}`;
  el.innerHTML=`<span style="font-weight:700;">${{success:'✓',error:'✕',warn:'!'}[type]||'●'}</span><span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(()=>el.classList.add('show'),10);
  setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),400);},3200);
}

// ── REFRESH ───────────────────────────────────────────────────────────────
function refresh(){updateMetrics();filterInv();renderOverview();updateSchBadge();saveData();}

// ── INIT ──────────────────────────────────────────────────────────────────
(async function initApp(){
  try{await loadData();}
  catch(err){console.error(err);toast('雲端資料載入失敗，請檢查 Supabase 設定','error');}
  initRpt();updateTrialStatus();refresh();
})();

