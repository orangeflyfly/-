// ── DATA ──────────────────────────────────────────────────────────────────
const SK='ims_v5';
let items=[],bom=[],logs=[],locations=[],schedules=[],nextId=100,nextSchId=1;
let sfilt='all',lfilt='all';
let trendChart=null;
let calYear=new Date().getFullYear(),calMonth=new Date().getMonth();
let schView='cal',schFilter='all';

function esc(value){
  return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function toQty(value, fallback=0){
  const n=parseFloat(value);
  return Number.isFinite(n)?n:fallback;
}
function formatQty(value){
  const n=toQty(value);
  return Number.isInteger(n)?String(n):n.toFixed(2).replace(/\.?0+$/,'');
}
function isNumericId(value){return /^\d+$/.test(String(value));}
function normalizeRefId(value){
  if(value===undefined||value===null||String(value)==='')return 0;
  return isNumericId(value)?+value:String(value);
}
function localDateOnly(dateInput){
  const d=dateInput instanceof Date?new Date(dateInput):new Date(`${dateInput}T00:00:00`);
  d.setHours(0,0,0,0);
  return d;
}
function localTodayString(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function normalizeData(){
  items=Array.isArray(items)?items:[];
  bom=Array.isArray(bom)?bom:[];
  logs=Array.isArray(logs)?logs:[];
  locations=Array.isArray(locations)?locations:[];
  schedules=Array.isArray(schedules)?schedules:[];

  items=items.map(i=>({
    id:i.id!==undefined&&i.id!==null&&String(i.id)!==''?(isNumericId(i.id)?+i.id:String(i.id)):nextId++,
    partNo:String(i.partNo||''),
    name:String(i.name||'未命名品項'),
    spec:String(i.spec||''),
    color:String(i.color||''),
    pattern:String(i.pattern||''),
    warehouse:String(i.warehouse||''),
    unit:String(i.unit||'個'),
    stock:toQty(i.stock),
    minStock:toQty(i.minStock),
    type:i.type==='product'?'product':i.type==='consumable'?'consumable':'package',
    purchaseCycleDays:Math.max(0,parseInt(i.purchaseCycleDays,10)||0),
    waste:toQty(i.waste),
    supplier:String(i.supplier||i.supplierNote||''),
    supplierNote:String(i.supplierNote||i.supplier||''),
    active:i.active!==false
  }));
  bom=bom.map(b=>({
    product:normalizeRefId(b.product),
    material:normalizeRefId(b.material),
    qty:toQty(b.qty),
    waste:toQty(b.waste),
    label:String(b.label||'標準包裝')
  })).filter(b=>b.product&&b.material&&b.qty>0);
  locations=locations.map(l=>({
    itemId:normalizeRefId(l.itemId),
    zone:String(l.zone||'').toUpperCase().replace(/[^\w-]/g,''),
    qty:toQty(l.qty)
  })).filter(l=>l.itemId&&l.zone);
  logs=logs.map(l=>({
    type:String(l.type||'調整'),
    name:String(l.name||''),
    qty:toQty(l.qty),
    note:String(l.note||''),
    time:String(l.time||''),
    rawTime:String(l.rawTime||new Date().toISOString()),
    itemId:normalizeRefId(l.itemId),
    price:toQty(l.price),
    beforeStock:l.beforeStock===undefined?null:toQty(l.beforeStock),
    afterStock:l.afterStock===undefined?null:toQty(l.afterStock),
    refType:String(l.refType||''),
    refId:l.refId===undefined||l.refId===null?'':String(l.refId)
  }));
  schedules=schedules.map(s=>{
    const raw=s.data?{id:s.id,...s.data}:s;
    return{
      id:+raw.id||nextSchId++,
      customer:String(raw.customer||'未命名客戶'),
      order:String(raw.order||''),
      owner:String(raw.owner||''),
      note:String(raw.note||''),
      date:String(raw.date||localTodayString()).slice(0,10),
      products:Array.isArray(raw.products)?raw.products.map(p=>({
        productId:normalizeRefId(p.productId||p.id),
        name:String(p.name||''),
        qty:toQty(p.qty)
      })).filter(p=>p.productId&&p.qty>0):[],
      shipped:!!raw.shipped,
      shippedAt:raw.shippedAt||''
    };
  });
  nextId=Math.max(+nextId||100,...items.filter(i=>typeof i.id==='number').map(i=>i.id+1),100);
  nextSchId=Math.max(+nextSchId||1,...schedules.map(s=>s.id+1),1);
}
function buildShipmentCheck(products){
  const issues=[],consumptions=[];
  const materialNeeds={};
  products.forEach(p=>{
    const productId=+p.productId||+p.id||0;
    const qty=+p.qty||0;
    const product=items.find(i=>i.id===productId);
    if(!product){issues.push(`找不到產品：${p.name||productId}`);return;}
    if(qty<=0){issues.push(`${product.name} 出貨數量需大於 0`);return;}
    if(product.stock<qty)issues.push(`${product.name} 庫存不足（需 ${formatQty(qty)}${product.unit}，剩 ${formatQty(product.stock)}${product.unit}）`);
    bom.filter(b=>b.product===productId).forEach(b=>{
      const mat=items.find(i=>i.id===b.material);if(!mat)return;
      const consume=toQty((b.qty*qty*(1+(b.waste||0)/100)).toFixed(2));
      materialNeeds[mat.id]=(materialNeeds[mat.id]||0)+consume;
    });
  });
  Object.entries(materialNeeds).forEach(([id,qty])=>{
    const mat=items.find(i=>i.id===+id);if(!mat)return;
    const consume=toQty(qty.toFixed(2));
    if(mat.stock<consume)issues.push(`${mat.name} 包材不足（需 ${formatQty(consume)}${mat.unit}，剩 ${formatQty(mat.stock)}${mat.unit}）`);
    consumptions.push({item:mat,qty:consume});
  });
  return{ok:issues.length===0,issues,consumptions};
}

function loadLocalStorageData(){
  try{
    const r=localStorage.getItem(SK);
    if(!r)return false;
    const d=JSON.parse(r);
    items=d.items||[];bom=d.bom||[];logs=d.logs||[];locations=d.locations||[];schedules=d.schedules||[];nextId=d.nextId||100;nextSchId=d.nextSchId||1;
    normalizeData();return true;
  }catch(e){console.error('localStorage load failed:',e);return false;}
}
async function loadData(){
  if(window.InventoryDataAdapter?.isSupabaseEnabled()){
    try{
      const cloudItems=await loadItemsFromSupabase();
      loadLocalStorageData();
      items=cloudItems;
      normalizeData();return;
    }catch(err){
      console.error('Supabase items 讀取失敗：',err);
      alert('Supabase items 讀取失敗，系統暫時載入 localStorage 資料，請檢查網址、anon key、RLS 或網路狀態。');
      if(loadLocalStorageData())return;
    }
  }else if(loadLocalStorageData())return;
  // defaults
  items=[
    {id:1,name:'瓦楞紙箱 A',spec:'30x20x15cm',unit:'個',stock:48,minStock:20,type:'package',waste:2,supplier:''},
    {id:2,name:'瓦楞紙箱 B',spec:'40x30x25cm',unit:'個',stock:12,minStock:30,type:'package',waste:2,supplier:''},
    {id:3,name:'氣泡布',spec:'50cm寬',unit:'捲',stock:8,minStock:5,type:'package',waste:5,supplier:''},
    {id:4,name:'封箱膠帶',spec:'透明48mm',unit:'捲',stock:3,minStock:10,type:'package',waste:0,supplier:''},
    {id:5,name:'珍珠棉片',spec:'60x40cm',unit:'片',stock:200,minStock:100,type:'package',waste:3,supplier:''},
    {id:6,name:'標籤貼紙',spec:'A4防水',unit:'張',stock:55,minStock:50,type:'package',waste:0,supplier:''},
    {id:7,name:'防潮袋',spec:'PE透明30x40',unit:'個',stock:80,minStock:200,type:'package',waste:1,supplier:''},
    {id:8,name:'產品 A',spec:'標準款',unit:'件',stock:30,minStock:10,type:'product',waste:0,supplier:''},
    {id:9,name:'產品 B',spec:'大型款',unit:'件',stock:15,minStock:10,type:'product',waste:0,supplier:''},
    {id:10,name:'產品 C',spec:'精裝版',unit:'件',stock:8,minStock:5,type:'product',waste:0,supplier:''},
  ];
  bom=[
    {product:8,material:1,qty:1,waste:2,label:'標準包裝'},{product:8,material:5,qty:2,waste:3,label:'標準包裝'},{product:8,material:6,qty:1,waste:0,label:'標準包裝'},
    {product:9,material:2,qty:1,waste:2,label:'標準包裝'},{product:9,material:3,qty:0.5,waste:5,label:'標準包裝'},{product:9,material:6,qty:1,waste:0,label:'標準包裝'},
    {product:10,material:1,qty:1,waste:2,label:'標準包裝'},{product:10,material:4,qty:0.5,waste:0,label:'標準包裝'},{product:10,material:6,qty:1,waste:0,label:'標準包裝'},
  ];
  locations=[
    {itemId:1,zone:'A1',qty:30},{itemId:1,zone:'A2',qty:18},
    {itemId:2,zone:'B1',qty:12},{itemId:3,zone:'A3',qty:8},
    {itemId:5,zone:'C1',qty:200},{itemId:8,zone:'D1',qty:30},
  ];
  logs=[];nextId=100;
  normalizeData();
}
function saveData(){
  localStorage.setItem(SK,JSON.stringify({items,bom,logs,locations,schedules,nextId,nextSchId}));
  const n=new Date();
  document.getElementById('save-status').textContent=`● 已儲存 ${n.getHours()}:${String(n.getMinutes()).padStart(2,'0')}`;
}

// ── BACKUP ────────────────────────────────────────────────────────────────
function exportBackup(){
  const blob=new Blob([JSON.stringify({items,bom,logs,locations,schedules,nextId,nextSchId,_v:6,_d:new Date().toISOString()},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`庫存備份_${new Date().toLocaleDateString('zh-TW').replace(/\//g,'')}.json`;a.click();
  toast('備份完成','success');
}
function importBackup(ev){
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=e=>{
    try{
      const d=JSON.parse(e.target.result);
      if(!d.items)throw 0;
      if(!confirm(`確定還原備份？\n備份日期：${d._d?new Date(d._d).toLocaleString('zh-TW'):'-'}\n\n目前資料將被覆蓋！`))return;
      items=d.items||[];bom=d.bom||[];logs=d.logs||[];locations=d.locations||[];schedules=d.schedules||[];nextId=d.nextId||100;nextSchId=d.nextSchId||1;
      normalizeData();
      toast('還原成功','success');refresh();
    }catch{toast('備份格式錯誤','error');}
  };
  r.readAsText(f);ev.target.value='';
}



