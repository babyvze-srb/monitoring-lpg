/* ===== SUPABASE CLIENT ===== */
async function loadAllData(){
  const {data:rData}=await SB.from('lpg_regions').select('*').order('sort_order');
  S.regions=(rData||[]).map(r=>r.name);
  if(S.regions.length===0) S.regions=['Ternate','Tobelo','Tidore','Morotai','Bacan'];
  REGIONS.splice(0,REGIONS.length,...S.regions);

  /* Jalur aman: RPC lpg_list_users (tanpa kolom password).
     Fallback ke select langsung hanya bila schema.sql belum dijalankan. */
  let uData=null;
  const ru=await SB.rpc('lpg_list_users');
  if(!ru.error){ uData=ru.data; }
  else if(rpcMissing(ru.error)){ const r2=await SB.from('lpg_users').select('*'); uData=r2.data; }
  else { throw ru.error; }
  S.users=(uData||[]).map(u=>({id:u.id,username:u.username,name:u.name,role:u.role,region:u.region}));
  if(S.users.length===0){ try{ await seedDefaultUsers(); }catch(e){ console.warn('Seed user dilewati:',e); } }

  const {data:tData}=await SB.from('lpg_transactions').select('*').eq('year',CUR_YEAR);
  S.transactions=(tData||[]).map(mapTxRow);

  const {data:sData}=await SB.from('lpg_stok_awal').select('*').eq('year',CUR_YEAR);
  S.stokAwal={};
  (sData||[]).forEach(s=>{ S.stokAwal[`${s.region}_${s.tabung}_${s.status}_${s.month_idx}`]=s.qty; });

  /* Kontrol Tabung Surabaya (data null bila tabel belum dibuat → aman). */
  const {data:kData}=await SB.from('lpg_sby_kirim').select('*').order('created_at',{ascending:false});
  S.sbyKirim=(kData||[]).map(mapSbyKirim);
  const {data:lData}=await SB.from('lpg_sby_lo').select('*').order('created_at',{ascending:false});
  S.sbyLo=(lData||[]).map(mapSbyLo);
  const {data:soData}=await SB.from('lpg_sby_so').select('*').order('created_at',{ascending:false});
  S.sbySo=(soData||[]).map(mapSbySo);
  const {data:ktData}=await SB.from('lpg_sby_kirim_tujuan').select('*').order('created_at',{ascending:false});
  S.sbyKirimTujuan=(ktData||[]).map(mapSbyKirimTujuan);

  /* Master customer (data null bila tabel belum dibuat → aman). */
  const {data:cData}=await SB.from('lpg_customers').select('*').order('name');
  S.customers=(cData||[]).map(mapCustomer);

  /* Simpan ke cache supaya navigasi halaman berikutnya tampil instan. */
  if(typeof _writeDataCache==='function') _writeDataCache();
}

function mapSbyKirim(r){
  return {id:r.id,tanggal:r.tanggal,so:r.so||'',noKont:r.no_kont||'',kapal:r.kapal||'',
    ekspedisi:r.ekspedisi||'',regionAsal:r.region_asal||'',qty50:r.qty_50||0,qty12:r.qty_12||0,qty55:r.qty_55||0,
    status:r.status||'dikirim',tanggalSampai:r.tanggal_sampai||null,tanggalBongkar:r.tanggal_bongkar||null,
    catatan:r.catatan||'',createdAt:new Date(r.created_at).getTime()};
}
/* LO = aksi pengisian, pecahan (atau utuh) dari satu Tebusan/SO (so_id).
   1 jenis tabung per baris. */
function mapSbyLo(r){
  return {id:r.id,soId:r.so_id||'',so:r.so||'',lo:r.lo||'',tanggal:r.tanggal,
    tabung:r.tabung||'',qty:r.qty||0,
    catatan:r.catatan||'',createdAt:new Date(r.created_at).getTime()};
}
/* Tebusan/SO = 1 jenis tabung, bisa dipecah jadi beberapa LO (lihat mapSbyLo). */
function mapSbySo(r){
  return {id:r.id,so:r.so||'',noTebusan:r.no_tebusan||'',tanggal:r.tanggal,
    tabung:r.tabung||'',qty:r.qty||0,
    catatan:r.catatan||'',createdAt:new Date(r.created_at).getTime()};
}
/* Perjalanan tabung ISI: Surabaya → gudang tujuan (kontainer & kapal sendiri). */
function mapSbyKirimTujuan(r){
  return {id:r.id,tanggal:r.tanggal,tabung:r.tabung||'',qty:r.qty||0,regionTujuan:r.region_tujuan||'',
    noKont:r.no_kont||'',kapal:r.kapal||'',ekspedisi:r.ekspedisi||'',
    status:r.status||'dikirim',tanggalSampai:r.tanggal_sampai||null,catatan:r.catatan||'',
    createdAt:new Date(r.created_at).getTime()};
}
function mapCustomer(r){
  return {id:r.id,name:r.name||'',phone:r.phone||'',address:r.address||'',region:r.region||'',note:r.note||''};
}

async function seedDefaultUsers(){
  const defaults=[
    {id:'sa',username:'admin',password:'admin123',name:'Super Admin',role:'superadmin',region:null},
    {id:'u1',username:'ternate',password:'ternate123',name:'Operator Ternate',role:'operator',region:'Ternate'},
    {id:'u2',username:'tobelo',password:'tobelo123',name:'Operator Tobelo',role:'operator',region:'Tobelo'},
    {id:'u3',username:'tidore',password:'tidore123',name:'Operator Tidore',role:'operator',region:'Tidore'},
    {id:'u4',username:'morotai',password:'morotai123',name:'Operator Morotai',role:'operator',region:'Morotai'},
    {id:'u5',username:'bacan',password:'bacan123',name:'Operator Bacan',role:'operator',region:'Bacan'},
  ];
  await SB.from('lpg_users').upsert(defaults);
  const defaultRegions=S.regions.map((name,i)=>({name,sort_order:i}));
  await SB.from('lpg_regions').upsert(defaultRegions,{onConflict:'name'});
  const {data:u2}=await SB.from('lpg_users').select('*');
  S.users=(u2||[]).map(u=>({id:u.id,username:u.username,name:u.name,role:u.role,region:u.region}));
}

/* Petakan satu baris lpg_transactions (snake_case DB) → bentuk state (camelCase). */
function mapTxRow(t){
  return {id:t.id,type:t.type,region:t.region,tanggal:t.tanggal,noSj:t.no_sj,
    pihak:t.pihak,tabung:t.tabung,status:t.status,qty:t.qty,ket:t.ket,
    monthIdx:t.month_idx,year:t.year,createdAt:new Date(t.created_at).getTime(),
    saleType:t.sale_type||null, purchaseType:t.purchase_type||null,
    deliveryStatus:t.delivery_status||null, deliveredQty:t.delivered_qty||0, deliveryDate:t.delivery_date||null,
    returnedQty:t.returned_qty||0, closed:!!t.closed, parentId:t.parent_id||null};
}

function _emitRealtime(){ if(typeof onRealtimeUpdate==='function') onRealtimeUpdate(); }

function setupRealtime(){
  SB.channel('lpg-changes')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'lpg_transactions'},payload=>{
      const t=payload.new;
      if(t.year===CUR_YEAR && !S.transactions.find(x=>x.id===t.id)){
        S.transactions.push(mapTxRow(t));
        _emitRealtime();
      }
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'lpg_transactions'},payload=>{
      const t=payload.new;
      const idx=S.transactions.findIndex(x=>x.id===t.id);
      if(idx>=0){
        if(t.year===CUR_YEAR) S.transactions[idx]=mapTxRow(t);
        else S.transactions.splice(idx,1); /* dipindah ke tahun lain */
      } else if(t.year===CUR_YEAR){
        S.transactions.push(mapTxRow(t));
      }
      _emitRealtime();
    })
    .on('postgres_changes',{event:'DELETE',schema:'public',table:'lpg_transactions'},payload=>{
      S.transactions=S.transactions.filter(t=>t.id!==payload.old.id);
      _emitRealtime();
    })
    .on('postgres_changes',{event:'*',schema:'public',table:'lpg_stok_awal'},payload=>{
      const s=payload.new||payload.old;
      if(!s || s.year!==CUR_YEAR) return;
      const key=`${s.region}_${s.tabung}_${s.status}_${s.month_idx}`;
      if(payload.eventType==='DELETE') delete S.stokAwal[key];
      else S.stokAwal[key]=s.qty;
      _emitRealtime();
    })
    .subscribe();
}
