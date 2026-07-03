/* ===== DATA SERVICE (CRUD) ===== */
function gid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,5); }

/* Deteksi error "fungsi RPC belum ada" → artinya supabase/schema.sql BELUM
   dijalankan, sehingga kita boleh memakai jalur lama (langsung ke tabel).
   Setelah schema.sql dijalankan, tabel lpg_users dikunci RLS sehingga jalur
   lama otomatis gagal dan hanya RPC (jalur aman) yang dipakai. */
function rpcMissing(err){
  const m = ((err && (err.code || err.message)) || '').toString();
  return m.includes('PGRST202')
      || m.includes('Could not find the function')
      || m.includes('schema cache')
      || m.includes('does not exist')
      || m.includes('404');
}

/* Deteksi error "kolom belum ada" → migrasi fitur penjualan belum dijalankan. */
function colMissing(err){
  const m=((err && (err.code||err.message))||'').toString();
  return m.includes('PGRST204') || m.includes('Could not find the')
      || m.includes('schema cache') || m.includes('does not exist');
}

async function saveTx(tx){
  if(!useSupabase) return;
  const base={
    id:tx.id,type:tx.type,region:tx.region,tanggal:tx.tanggal,no_sj:tx.noSj,
    pihak:tx.pihak,tabung:tx.tabung,status:tx.status,qty:tx.qty,ket:tx.ket,
    month_idx:tx.monthIdx,year:tx.year
  };
  const full={...base,
    sale_type:tx.saleType||null, purchase_type:tx.purchaseType||null,
    delivery_status:tx.deliveryStatus||null, delivered_qty:tx.deliveredQty||0, delivery_date:tx.deliveryDate||null,
    returned_qty:tx.returnedQty||0, closed:tx.closed||false, parent_id:tx.parentId||null
  };
  const {error}=await SB.from('lpg_transactions').insert(full);
  if(error){
    /* Sebelum migration_penjualan_acc.sql dijalankan: kolom baru belum ada →
       simpan kolom dasar saja agar masuk/keluar biasa tetap berfungsi. */
    if(colMissing(error)){
      const {error:e2}=await SB.from('lpg_transactions').insert(base);
      if(e2) throw e2;
      return;
    }
    throw error;
  }
}

/* Hitung ulang flag "closed" (selesai) sesuai aturan:
   - Pindah Gudang   → selalu selesai.
   - Beli Isi+Tabung → selesai saat terantar penuh (tak perlu tabung balik).
   - Beli Isi (refill) → LUNAS saat terantar PENUH dan semua tabung terantar
     sudah balik (returned >= delivered >= qty). */
function recomputeSaleClosed(tx){
  const qty=+tx.qty||0, deliv=+tx.deliveredQty||0, back=+tx.returnedQty||0;
  if(tx.saleType==='pindah_gudang'){ tx.closed=true; return; }
  if(tx.purchaseType==='isi_tabung'){ tx.closed=(deliv>=qty && qty>0); return; }
  if(tx.purchaseType==='isi'){ tx.closed=(deliv>=qty && qty>0 && back>=deliv); return; }
}

/* Perbarui jumlah tabung yang SUDAH terantar (boleh dicicil 0..qty).
   Status diturunkan: belum / sebagian / terantar. */
async function updateDelivery(id, deliveredQty, deliveryDate){
  const tx=S.transactions.find(t=>t.id===id);
  if(!tx) return false;
  const qty=+tx.qty||0;
  let q=parseInt(deliveredQty); if(isNaN(q)) q=0;
  q=Math.max(0, Math.min(q, qty));
  tx.deliveredQty=q;
  tx.deliveryStatus = q<=0 ? 'belum' : (q>=qty ? 'terantar' : 'sebagian');
  tx.deliveryDate = q>0 ? (deliveryDate||tx.deliveryDate||null) : null;
  recomputeSaleClosed(tx);
  if(useSupabase){
    await SB.from('lpg_transactions').update({delivered_qty:q, delivery_status:tx.deliveryStatus, delivery_date:tx.deliveryDate||null, closed:tx.closed}).eq('id',id);
  }
  await writeLog('UBAH_PENGANTARAN',
    `${tx.tabung} – Region: ${tx.region} | No.SJ: ${tx.noSj||'-'} | terantar ${q}/${qty} (${tx.deliveryStatus})${tx.deliveryDate?' | tgl '+tx.deliveryDate:''}`);
  return true;
}

/* Selesaikan penjualan secara manual (mis. sisa tidak jadi diantar) —
   hanya boleh bila tabung balik sudah >= yang terantar. */
async function finalizeSale(id){
  const tx=S.transactions.find(t=>t.id===id);
  if(!tx) return false;
  if((+tx.returnedQty||0) < (+tx.deliveredQty||0)){
    showAlert('❌ Belum bisa diselesaikan: tabung balik belum sama dengan yang terantar','error');
    return false;
  }
  tx.closed=true;
  if(useSupabase) await SB.from('lpg_transactions').update({closed:true}).eq('id',id);
  await writeLog('TABUNG_BALIK',
    `${tx.tabung} – Region: ${tx.region} | DISELESAIKAN (terantar ${tx.deliveredQty}/${tx.qty}, balik ${tx.returnedQty})`);
  return true;
}

/* ACC penerimaan pindah gudang oleh operator gudang tujuan → tabung resmi
   masuk stok gudang tersebut. */
async function accPindahMasuk(id, tgl){
  const tx=S.transactions.find(t=>t.id===id); if(!tx) return false;
  tx.deliveryStatus='terantar'; tx.closed=true;
  tx.deliveryDate=tgl||new Date().toISOString().split('T')[0];
  if(useSupabase) await SB.from('lpg_transactions').update({delivery_status:'terantar',closed:true,delivery_date:tx.deliveryDate}).eq('id',id);
  await writeLog('TERIMA_PINDAH',`Terima pindah masuk | ${tx.tabung} ${tx.status} – ${tx.qty} tabung | Gudang: ${tx.region} | ${tx.ket||''}`);
  return true;
}

/* Konfirmasi tabung kosong yang balik (boleh dicicil). Membuat transaksi
   KOSONG masuk terhubung ke penjualan, lalu menutup penjualan bila balik
   sudah sama dengan jumlah pengambilan. */
async function confirmReturn(saleId, qtyBack){
  const sale=S.transactions.find(t=>t.id===saleId);
  if(!sale) return false;
  qtyBack=parseInt(qtyBack)||0;
  /* Hanya bisa balik sebanyak yang SUDAH terantar (dikurangi yang sudah balik). */
  const owed=(+sale.deliveredQty||0)-(+sale.returnedQty||0);
  if(owed<=0){ showAlert('❌ Belum ada tabung terantar yang bisa dibalikkan','error'); return false; }
  if(qtyBack<=0 || qtyBack>owed){ showAlert(`❌ Jumlah balik harus 1–${owed} (sesuai yang sudah terantar)`,'error'); return false; }

  const today=new Date();
  const ret={
    id:gid(), type:'masuk', region:sale.region, tanggal:today.toISOString().split('T')[0],
    noSj:sale.noSj||'', pihak:sale.pihak||'', tabung:sale.tabung, status:'KOSONG', qty:qtyBack,
    ket:'Tabung balik (refill)', monthIdx:today.getMonth(), year:today.getFullYear(),
    createdAt:Date.now(), parentId:saleId, closed:true
  };
  S.transactions.push(ret);
  await saveTx(ret);

  sale.returnedQty=(+sale.returnedQty||0)+qtyBack;
  recomputeSaleClosed(sale);
  if(useSupabase){
    await SB.from('lpg_transactions').update({returned_qty:sale.returnedQty, closed:sale.closed}).eq('id',saleId);
  }
  await writeLog('TABUNG_BALIK',
    `${sale.tabung} – Region: ${sale.region} | balik ${qtyBack} tabung (total ${sale.returnedQty}/${sale.qty})${sale.closed?' — LUNAS/SELESAI':''}`);
  return true;
}

async function deleteTx(id){
  if(!useSupabase){ S.transactions=S.transactions.filter(t=>t.id!==id); return; }
  await SB.from('lpg_transactions').delete().eq('id',id);
  S.transactions=S.transactions.filter(t=>t.id!==id);
}

/* Update field dasar transaksi (tanggal, region, no.sj, pihak, tabung, status,
   qty, ket). month_idx & year diturunkan ulang dari tanggal. */
async function updateTx(id, c){
  const tx=S.transactions.find(t=>t.id===id);
  if(!tx) return false;
  const old=`${tx.tabung} ${tx.status} ${tx.qty} | ${tx.region}`;
  if(c.tanggal){ const d=new Date(c.tanggal); tx.monthIdx=d.getMonth(); tx.year=d.getFullYear(); tx.tanggal=c.tanggal; }
  if(c.region!==undefined && c.region) tx.region=c.region;
  if(c.noSj!==undefined)   tx.noSj=c.noSj;
  if(c.pihak!==undefined)  tx.pihak=c.pihak;
  if(c.tabung!==undefined) tx.tabung=c.tabung;
  if(c.status!==undefined) tx.status=c.status;
  if(c.qty!==undefined)    tx.qty=c.qty;
  if(c.ket!==undefined)    tx.ket=c.ket;
  if(useSupabase){
    const {error}=await SB.from('lpg_transactions').update({
      tanggal:tx.tanggal,region:tx.region,no_sj:tx.noSj,pihak:tx.pihak,
      tabung:tx.tabung,status:tx.status,qty:tx.qty,ket:tx.ket,
      month_idx:tx.monthIdx,year:tx.year
    }).eq('id',id);
    if(error) throw error;
  }
  await writeLog('EDIT_TRANSAKSI',`${tx.type} | ${old} → ${tx.tabung} ${tx.status} ${tx.qty} | ${tx.region} | No.SJ: ${tx.noSj||'-'}`);
  return true;
}

async function saveStokAwal(region,tabung,status,monthIdx,qty){
  const key=`${region}_${tabung}_${status}_${monthIdx}`;
  const oldQty=S.stokAwal[key]||0;
  S.stokAwal[key]=qty;
  if(!useSupabase) return;
  await SB.from('lpg_stok_awal').upsert({region,tabung,status,month_idx:monthIdx,year:CUR_YEAR,qty},{onConflict:'region,tabung,status,month_idx,year'});
  if(oldQty!==qty) await writeLog('UBAH_STOK_AWAL',`${region} – ${tabung} – ${status} – Bulan: ${MONTHS[monthIdx]} | ${oldQty} → ${qty}`);
}

async function saveRegions(){
  /* Perbarui mirror lokal lebih dulu, supaya mode offline pun tetap konsisten. */
  REGIONS.splice(0,REGIONS.length,...S.regions);
  if(!useSupabase) return;
  const rows=S.regions.map((name,i)=>({name,sort_order:i}));
  /* Upsert dulu (TANPA jendela kosong & tanpa risiko kehilangan semua data
     bila ada kegagalan), baru hapus region yang sudah tidak ada di daftar.
     Penghapusan dilakukan per-nama persis agar aman terhadap nama dengan
     koma/kutip. */
  const { error: upErr } = await SB.from('lpg_regions').upsert(rows,{ onConflict:'name' });
  if(upErr) throw upErr;
  const { data: existing } = await SB.from('lpg_regions').select('name');
  const keep = new Set(S.regions);
  const toDelete = (existing||[]).map(r=>r.name).filter(n=>!keep.has(n));
  for(const name of toDelete){
    await SB.from('lpg_regions').delete().eq('name',name);
  }
}

async function deleteUser(id){
  if(useSupabase){
    const { error } = await SB.rpc('lpg_delete_user', { p_id:id });
    if(error){
      if(!rpcMissing(error)) throw error;
      await SB.from('lpg_users').delete().eq('id',id); /* jalur lama pra-migrasi */
    }
  }
  S.users=S.users.filter(u=>u.id!==id);
}

async function updateTxRegion(oldName,newName){
  if(!useSupabase) return;
  await SB.from('lpg_transactions').update({region:newName}).eq('region',oldName);
  await SB.from('lpg_users').update({region:newName}).eq('region',oldName);
  await SB.from('lpg_stok_awal').update({region:newName}).eq('region',oldName);
}

/* ===== MASTER CUSTOMER ===== */
async function saveCustomer(c){
  const existing=S.customers.find(x=>x.id===c.id);
  if(existing) Object.assign(existing,c); else S.customers.push(c);
  if(useSupabase){
    const {error}=await SB.from('lpg_customers').upsert({
      id:c.id,name:c.name,phone:c.phone||null,address:c.address||null,region:c.region||null,note:c.note||null
    });
    if(error) throw error;
  }
}
async function deleteCustomerById(id){
  S.customers=S.customers.filter(x=>x.id!==id);
  if(useSupabase) await SB.from('lpg_customers').delete().eq('id',id);
}
/* Ganti nama customer di master DAN di semua transaksi terkait (pihak),
   supaya data tetap sinkron. */
async function renameCustomer(id,oldName,newName){
  S.transactions.forEach(t=>{ if(t.type==='keluar' && t.pihak===oldName) t.pihak=newName; });
  if(useSupabase){
    await SB.from('lpg_transactions').update({pihak:newName}).eq('pihak',oldName).eq('type','keluar');
  }
}

async function writeLog(action,detail=''){
  if(!useSupabase||!me) return;
  try{
    await SB.from('lpg_activity_log').insert({
      id:gid(),user_id:me.id,username:me.username,name:me.name,
      role:me.role,region:me.region||null,action,detail,
      created_at:new Date().toISOString()
    });
  }catch(e){}
}

/* ===== KONTROL TABUNG SURABAYA =====
   Alur: Kirim kosong (gudang asal → Surabaya) → Sampai → Dibongkar
   (masuk stok KOSONG gudang Surabaya) → Tebusan/SO (1 jenis tabung) →
   LO pengisian, pecahan atau utuh dari satu Tebusan (mengurangi stok
   KOSONG & menambah stok ISI gudang Surabaya) → Kirim ke gudang tujuan
   (mengurangi stok ISI; kontainer & kapal sendiri, terpisah dari
   perjalanan tabung kosong). Stok gudang DIHITUNG di klien (surabaya.js),
   tidak disimpan sebagai kolom — selalu konsisten dari baris-baris ini. */

/* ── 1) Perjalanan tabung kosong: gudang asal → Surabaya ── */
async function saveSbyKirim(k){
  S.sbyKirim.unshift(k);
  if(useSupabase){
    const {error}=await SB.from('lpg_sby_kirim').insert({
      id:k.id,tanggal:k.tanggal,so:k.so||null,no_kont:k.noKont||null,kapal:k.kapal||null,
      ekspedisi:k.ekspedisi||null,region_asal:k.regionAsal||null,
      qty_50:k.qty50||0,qty_12:k.qty12||0,qty_55:k.qty55||0,status:k.status||'dikirim',
      tanggal_sampai:k.tanggalSampai||null,catatan:k.catatan||null
    });
    if(error) throw error;
  }
  await writeLog('SBY_KIRIM',`Kirim kosong → Surabaya | Kont ${k.noKont||'-'} | 50:${k.qty50||0} 12:${k.qty12||0} 5.5:${k.qty55||0}`);
}
async function setSbyKirimSampai(id,tgl){
  const k=S.sbyKirim.find(x=>x.id===id); if(!k) return;
  k.status='sampai'; k.tanggalSampai=tgl||new Date().toISOString().split('T')[0];
  if(useSupabase) await SB.from('lpg_sby_kirim').update({status:'sampai',tanggal_sampai:k.tanggalSampai}).eq('id',id);
  await writeLog('SBY_KIRIM',`Sampai di Surabaya | Kont ${k.noKont||'-'}`);
}
/* Bongkar kontainer: tabung kosong resmi masuk stok gudang Surabaya. */
async function setSbyKirimBongkar(id,tgl){
  const k=S.sbyKirim.find(x=>x.id===id); if(!k) return;
  k.status='dibongkar'; k.tanggalBongkar=tgl||new Date().toISOString().split('T')[0];
  if(useSupabase) await SB.from('lpg_sby_kirim').update({status:'dibongkar',tanggal_bongkar:k.tanggalBongkar}).eq('id',id);
  await writeLog('SBY_BONGKAR',`Bongkar kontainer ${k.noKont||'-'} | 50:${k.qty50||0} 12:${k.qty12||0} 5.5:${k.qty55||0} → masuk stok gudang Surabaya`);
}
async function deleteSbyKirim(id){
  S.sbyKirim=S.sbyKirim.filter(x=>x.id!==id);
  if(useSupabase) await SB.from('lpg_sby_kirim').delete().eq('id',id);
}

/* ── 2) Tebusan / SO — HANYA SATU jenis tabung per SO. Bisa dipecah jadi
   beberapa LO (lihat saveSbyLo di bawah). ── */
async function saveSbySo(o){
  S.sbySo.unshift(o);
  if(useSupabase){
    const {error}=await SB.from('lpg_sby_so').insert({
      id:o.id,so:o.so||null,no_tebusan:o.noTebusan||null,tanggal:o.tanggal,
      tabung:o.tabung,qty:o.qty||0,catatan:o.catatan||null
    });
    if(error) throw error;
  }
  await writeLog('SBY_SO',`Buat Tebusan/SO ${o.so||'-'} | ${o.tabung} × ${o.qty||0}`);
}
async function deleteSbySo(id){
  S.sbySo=S.sbySo.filter(x=>x.id!==id);
  if(useSupabase) await SB.from('lpg_sby_so').delete().eq('id',id);
}

/* ── 3) LO: aksi pengisian — pecahan (atau utuh) dari SATU Tebusan/SO
   (l.soId), mewarisi jenis tabung yang sama. Begitu disimpan, stok KOSONG
   gudang Surabaya berkurang qty & stok ISI bertambah qty (dihitung dari
   kumpulan baris ini oleh surabaya.js — bukan kolom tersimpan). ── */
async function saveSbyLo(l){
  S.sbyLo.unshift(l);
  if(useSupabase){
    const {error}=await SB.from('lpg_sby_lo').insert({
      id:l.id,so_id:l.soId,so:l.so||null,lo:l.lo||null,tanggal:l.tanggal,
      tabung:l.tabung,qty:l.qty||0,catatan:l.catatan||null,status:'terisi'
    });
    if(error) throw error;
  }
  await writeLog('SBY_LO',`Pengisian (LO) ${l.tabung} × ${l.qty||0} dari Tebusan/SO ${l.so||'-'}${l.lo?' | No. LO '+l.lo:''} — stok kosong → isi`);
}
async function deleteSbyLo(id){
  S.sbyLo=S.sbyLo.filter(x=>x.id!==id);
  if(useSupabase) await SB.from('lpg_sby_lo').delete().eq('id',id);
}

/* ── 4) Perjalanan tabung ISI: Surabaya → gudang tujuan. Mengurangi stok
   ISI gudang Surabaya. Kontainer & kapal sendiri, terpisah dari #1. ── */
async function saveSbyKirimTujuan(k){
  S.sbyKirimTujuan.unshift(k);
  if(useSupabase){
    const {error}=await SB.from('lpg_sby_kirim_tujuan').insert({
      id:k.id,tanggal:k.tanggal,tabung:k.tabung,qty:k.qty||0,region_tujuan:k.regionTujuan||null,
      no_kont:k.noKont||null,kapal:k.kapal||null,ekspedisi:k.ekspedisi||null,
      status:'dikirim',catatan:k.catatan||null
    });
    if(error) throw error;
  }
  await writeLog('SBY_KIRIM_TUJUAN',`Kirim isi Surabaya → ${k.regionTujuan||'-'} | ${k.tabung} × ${k.qty||0} | Kont ${k.noKont||'-'}`);
}
async function setSbyKirimTujuanSampai(id,tgl){
  const k=S.sbyKirimTujuan.find(x=>x.id===id); if(!k) return;
  k.status='sampai'; k.tanggalSampai=tgl||new Date().toISOString().split('T')[0];
  if(useSupabase) await SB.from('lpg_sby_kirim_tujuan').update({status:'sampai',tanggal_sampai:k.tanggalSampai}).eq('id',id);
  await writeLog('SBY_KIRIM_TUJUAN',`Sampai di gudang tujuan ${k.regionTujuan||'-'} | ${k.tabung} × ${k.qty||0}`);
}
async function deleteSbyKirimTujuan(id){
  S.sbyKirimTujuan=S.sbyKirimTujuan.filter(x=>x.id!==id);
  if(useSupabase) await SB.from('lpg_sby_kirim_tujuan').delete().eq('id',id);
}
