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
