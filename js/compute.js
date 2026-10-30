/* ===== COMPUTATION (PURE FUNCTIONS) ===== */
function getTxSum(region,tabung,status,type,monthIdx){
  return S.transactions.filter(t=>t.region===region&&t.tabung===tabung&&t.status===status&&t.type===type&&t.monthIdx===monthIdx&&t.year===CUR_YEAR
    /* Pindah gudang yang belum di-ACC operator tujuan = belum masuk stok. */
    && !(t.type==='masuk'&&t.saleType==='pindah_gudang'&&(t.deliveryStatus||'')==='belum')
  ).reduce((a,b)=>a+(+b.qty||0),0);
}

function getStokAwal(region,tabung,status,monthIdx){
  if(monthIdx===0) return S.stokAwal[`${region}_${tabung}_${status}_0`]||0;
  const sa=getStokAwal(region,tabung,status,monthIdx-1);
  const m=getTxSum(region,tabung,status,'masuk',monthIdx-1);
  const k=getTxSum(region,tabung,status,'keluar',monthIdx-1);
  return sa+m-k;
}

function computeCell(region,tabung,status,monthIdx){
  const stokAwal=getStokAwal(region,tabung,status,monthIdx);
  const masuk=getTxSum(region,tabung,status,'masuk',monthIdx);
  const keluar=getTxSum(region,tabung,status,'keluar',monthIdx);
  return {stokAwal,masuk,keluar,stokAkhir:stokAwal+masuk-keluar};
}

/* ===== KATEGORI & PRODUK ===== */
function productsOf(cat,includeInactive){
  return S.products.filter(p=>p.category===cat&&(includeInactive||p.active))
    .sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name));
}
function categoryOfProduct(name){
  const p=S.products.find(x=>x.name===name);
  return p?p.category:'lpg';
}
function syncCategoryLists(){
  const names=productsOf(activeCategory).map(p=>p.name);
  if(names.length) TABUNGS.splice(0,TABUNGS.length,...names);
  else TABUNGS.splice(0,TABUNGS.length);
}
function inCat(t){ return (t.category||'lpg')===activeCategory; }
function catTx(){ return S.transactions.filter(inCat); }

/* ===== STOK REALTIME — sama dengan lpg_stock_on_hand() di server ===== */
function stockNow(region,product,status){
  const base=S.stokAwal[`${region}_${product}_${status}_0`]||0;
  return S.transactions.reduce((sum,t)=>{
    if(t.region!==region||t.tabung!==product||t.status!==status||t.year!==CUR_YEAR) return sum;
    if(t.type==='masuk'&&t.saleType==='pindah_gudang'&&(t.deliveryStatus||'')==='belum') return sum;
    return sum+(t.type==='masuk'?1:-1)*(+t.qty||0);
  },base);
}
function stockReserved(region,product,status){
  return S.transfers.reduce((sum,x)=>{
    if(x.origin!==region||x.status!=='menunggu') return sum;
    return sum+x.items.filter(i=>i.product===product&&i.status===status).reduce((a,i)=>a+i.qty,0);
  },0);
}
function stockAvailable(region,product,status){
  return stockNow(region,product,status)-stockReserved(region,product,status);
}
/* Total barang kategori tertentu yang sedang dipegang sopir / dititipkan. */
function stockInCustody(custody,cat,product,status){
  return S.transfers.reduce((sum,x)=>{
    if(x.custody!==custody||(x.status!=='jalan'&&x.status!=='singgah')) return sum;
    return sum+x.items.filter(i=>(!cat||i.category===cat)&&(!product||i.product===product)&&(!status||i.status===status))
      .reduce((a,i)=>a+i.qty,0);
  },0);
}
/* Stok bagus per kategori: status pertama tiap kategori (ISI / BAIK). */
function goodStatus(cat){ return catMeta(cat).statuses[0]; }

/* ===== TRANSFER — status & rute ===== */
const TRANSFER_STATUS={menunggu:'Menunggu muat',jalan:'Di perjalanan',singgah:'Singgah',selesai:'Selesai',batal:'Batal'};
function statusBadge(x){ return `<span class="badge trf-${x.status}">${TRANSFER_STATUS[x.status]||x.status}</span>`; }
function transferNeedsAction(x){
  if(!me) return false;
  if(me.role==='superadmin') return ['menunggu','jalan','singgah'].includes(x.status);
  if(me.role!=='operator') return false;
  return (x.status==='menunggu'&&x.origin===me.region)
      || (x.status==='jalan'&&x.destination===me.region)
      || (x.status==='singgah'&&x.currentLocation===me.region);
}
function custodyText(x){
  if(x.status==='batal') return 'Barang tetap di '+x.origin;
  if(x.custody==='asal') return 'Barang masih di '+x.origin;
  if(x.custody==='tujuan') return 'Barang sudah di '+x.destination;
  if(x.custody==='titip') return 'Barang dititipkan di '+x.currentLocation;
  return 'Barang dibawa '+(x.driverName||'sopir');
}
/* Urutan titik: asal, singgah yang sudah dilalui, rencana singgah sisa, tujuan. */
function routeNodes(x){
  const visited=x.events.filter(e=>e.kind==='singgah_masuk').map(e=>e.warehouse);
  const mid=[...new Set([...visited,...x.stops])].filter(w=>w!==x.origin&&w!==x.destination);
  const started=x.status==='jalan'||x.status==='singgah'||x.status==='selesai';
  return [
    {name:x.origin,state:started?'done':(x.status==='menunggu'?'current':'pending')},
    ...mid.map(w=>({name:w,stop:true,
      state:x.currentLocation===w?'current':(visited.includes(w)?'done':'pending')})),
    {name:x.destination,state:x.status==='selesai'?'done':'pending'}
  ];
}
function routeHtml(x,compact){
  const nodes=routeNodes(x);
  if(compact) return `<span class="route-inline">${nodes.map(n=>`<span class="ri-node ri-${n.state}${n.stop?' ri-stop':''}">${esc(n.name)}</span>`).join('<i class="bi bi-arrow-right-short"></i>')}</span>`;
  return `<div class="route">${nodes.map(n=>`<div class="route-node ${n.state}${n.stop?' stop':''}"><span class="route-dot"></span><span class="route-name">${esc(n.name)}</span></div>`).join('')}</div>`;
}
function schemaMissingCard(){
  return `<div class="card"><div class="empty"><div class="ico"><i class="bi bi-database-exclamation"></i></div>
    Fitur ini aktif setelah <code>supabase/migration_v3_multiproduk_transfer.sql</code> dijalankan di Supabase SQL Editor.</div></div>`;
}
