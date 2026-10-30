/* ===== FORM INPUT ===== */
function renderFormInput(type){
  return type==='keluar' ? renderKeluarForm() : renderMasukForm();
}

/* ===================================================================
   BARANG MASUK — form tunggal (tidak ada Tujuan Transaksi, tetap sama).
   =================================================================== */
function renderMasukForm(){
  const isSA=me.role==='superadmin';
  if(!isSA && !me.region) return `<div class="card"><div style="text-align:center;padding:40px 20px"><div style="font-size:40px;margin-bottom:12px"><i class="bi bi-slash-circle"></i></div><p style="color:var(--muted);font-size:13px">Akun Anda belum memiliki region.<br>Hubungi Super Admin untuk mengatur region.</p></div></div>`;
  const regs=isSA?(S.regions||REGIONS):[me.region];
  const regOpts=regs.map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('');
  const tabOpts=TABUNGS.map(t=>`<option value="${escAttr(t)}">${esc(t)}</option>`).join('');
  const stOpts=STATUSES.map(s=>`<option value="${escAttr(s)}">${esc(s)}</option>`).join('');
  const today=localDate();
  const recent=catTx().filter(t=>t.type==='masuk'&&regs.includes(t.region)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,25);
  const rows=recent.length?recent.map(t=>`<tr>
    <td>${esc(t.tanggal)}</td>${isSA?`<td>${esc(t.region)}</td>`:''}
    <td>${esc(t.noSj)||'-'}</td><td>${esc(t.pihak)||'-'}</td>
    <td>${esc(t.tabung)}</td>
    <td><span class="badge badge-${esc(String(t.status).toLowerCase())}">${esc(t.status)}</span></td>
    <td><b>${esc(t.qty)}</b></td><td>${esc(t.ket)||'-'}</td>
    <td>${txActions(t)}</td>
  </tr>`).join(''):`<tr><td colspan="${isSA?9:8}" class="empty"><div class="ico"><i class="bi bi-inbox"></i></div>Belum ada data</td></tr>`;
  return `
  <div class="card">
    <div class="card-title"><i class="bi bi-box-arrow-in-down"></i> Input Barang Masuk</div>
    ${!isSA?`<div style="margin-bottom:12px;padding:8px 12px;background:color-mix(in srgb,var(--accent) 8%,transparent);border:1px solid color-mix(in srgb,var(--accent) 20%,transparent);border-radius:7px;font-size:12px;color:var(--accent)"><i class="bi bi-geo-alt"></i> Region: <b>${esc(me.region)}</b></div>`:''}
    <div class="form-grid">
      <div class="field"><label>Tanggal</label><input type="date" id="f-tgl" value="${today}"></div>
      ${isSA?`<div class="field"><label>Region Gudang</label><select id="f-reg">${regOpts}</select></div>`:`<div class="field"><label>Region Gudang</label><input id="f-reg" readonly value="${escAttr(me.region)}" style="opacity:.6;cursor:not-allowed"></div>`}
      <div class="field"><label>No. Surat Jalan <span style="color:var(--danger)">*</span></label><input id="f-sj" placeholder="SJ-001" required></div>
      <div class="field"><label>Supplier <span style="color:var(--danger)">*</span></label><input id="f-pihak" placeholder="Supplier..." required></div>
      <div class="field"><label>${catMeta().itemLabel}</label><select id="f-tab">${tabOpts}</select></div>
      <div class="field"><label>${catMeta().statusLabel}</label><select id="f-st">${stOpts}</select></div>
      <div class="field"><label>Jumlah (${catMeta().unit})</label><input type="number" id="f-qty" placeholder="0" min="1"></div>
    </div>
    <div class="field"><label>Keterangan</label><input id="f-ket" placeholder="Opsional..."></div>
    <div style="margin-top:12px"><button class="btn btn-primary" onclick="submitTx('masuk')"><i class="bi bi-floppy"></i> Simpan Data Masuk</button></div>
  </div>
  <div class="card">
    <div class="card-title" style="justify-content:space-between;display:flex">
      <span><i class="bi bi-card-list"></i> Data Masuk Terbaru</span>
      <button class="btn btn-warn btn-sm" onclick="downloadTableById('tbl-inp-masuk','Masuk')"><i class="bi bi-download"></i> Unduh Excel</button>
    </div>
    <div class="monitor-wrap">
      <table class="riwayat-tbl" id="tbl-inp-masuk">
        <tr><th>Tanggal</th>${isSA?'<th>Region</th>':''}<th>No.SJ</th><th>Supplier</th><th>${catMeta().itemLabel}</th><th>Status</th><th>QTY</th><th>Keterangan</th><th>Aksi</th></tr>
        ${rows}
      </table>
    </div>
  </div>`;
}

/* ===================================================================
   BARANG KELUAR — dipisah jadi 3 tab pane: Penjualan, Pindah Gudang,
   Pengisian Surabaya. Tiap pane hanya menampilkan kolom yang relevan;
   Tanggal/Region/No.SJ tetap sekali di atas karena berlaku untuk ketiganya.
   =================================================================== */
let keluarTab='penjualan';
function keluarSetTab(t){ keluarTab=t; setContent(renderFormInput('keluar')); }

/* Transaksi keluar "Pengisian Surabaya" disimpan dgn saleType pindah_gudang
   + penanda di keterangan (lihat submitTx) — dipakai untuk memisahkan dari
   Pindah Gudang biasa saat memfilter tabel & menghitung ringkasan. */
function _isPengisianSbyTx(t){ return t.saleType==='pindah_gudang' && (t.ket||'').includes('Kirim ke Surabaya'); }

function renderKeluarForm(){
  const isSA=me.role==='superadmin';
  if(activeCategory!=='lpg'&&keluarTab==='pengisian_sby') keluarTab='penjualan';
  if(!isSA && !me.region) return `<div class="card"><div style="text-align:center;padding:40px 20px"><div style="font-size:40px;margin-bottom:12px"><i class="bi bi-slash-circle"></i></div><p style="color:var(--muted);font-size:13px">Akun Anda belum memiliki region.<br>Hubungi Super Admin untuk mengatur region.</p></div></div>`;
  const regs=isSA?(S.regions||REGIONS):[me.region];
  const regOpts=regs.map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('');
  const tabOpts=TABUNGS.map(t=>`<option value="${escAttr(t)}">${esc(t)}</option>`).join('');
  const today=localDate();
  const initSrc=isSA?(regs[0]||''):me.region;
  const destOpts=(S.regions||REGIONS).filter(r=>r!==initSrc).map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('');
  const custList=`<datalist id="cust-list">${(S.customers||[]).map(c=>`<option value="${escAttr(c.name)}">`).join('')}</datalist>`;

  const matchesTab=t=>{
    if(keluarTab==='pengisian_sby') return _isPengisianSbyTx(t);
    if(keluarTab==='pindah_gudang') return t.saleType==='pindah_gudang' && !_isPengisianSbyTx(t);
    return t.saleType==='penjualan';
  };
  const recent=catTx().filter(t=>t.type==='keluar'&&regs.includes(t.region)&&matchesTab(t)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,25);
  const rows=recent.length?recent.map(t=>`<tr>
    <td>${esc(t.tanggal)}</td>${isSA?`<td>${esc(t.region)}</td>`:''}
    <td>${esc(t.noSj)||'-'}</td><td>${esc(t.pihak)||'-'}</td>
    <td>${esc(t.tabung)}</td>
    <td><span class="badge badge-${esc(String(t.status).toLowerCase())}">${esc(t.status)}</span></td>
    <td><b>${esc(t.qty)}</b></td><td>${esc(t.ket)||'-'}</td>
    <td>${txActions(t)}</td>
  </tr>`).join(''):`<tr><td colspan="${isSA?9:8}" class="empty"><div class="ico"><i class="bi bi-inbox"></i></div>Belum ada data</td></tr>`;

  const tabBtn=(id,ico,lbl)=>`<button onclick="keluarSetTab('${id}')" style="padding:8px 14px;font-size:13px;background:none;border:none;border-bottom:2px solid ${keluarTab===id?'var(--accent)':'transparent'};color:${keluarTab===id?'var(--text)':'var(--muted)'};cursor:pointer;font-weight:600;white-space:nowrap">${ico} ${lbl}</button>`;

  let pane='';
  if(keluarTab==='pindah_gudang'){
    pane=`<div class="cta-box"><div><b>Pindah gudang memakai barcode</b><p>Stok berpindah saat sopir memindai barcode di gudang asal dan gudang tujuan.</p></div>
      <a class="btn btn-primary" href="../transfer/transfer.html"><i class="bi bi-qr-code"></i> Buka Transfer Barcode</a></div>`;
  } else if(keluarTab==='pengisian_sby'){
    pane=`<div style="margin:2px 0 8px;padding:7px 11px;background:color-mix(in srgb,var(--ok) 8%,transparent);border:1px solid color-mix(in srgb,var(--ok) 20%,transparent);border-radius:7px;font-size:11px;color:var(--accent3)"><i class="bi bi-buildings"></i> Kirim tabung <b>KOSONG</b> ke Surabaya untuk pengisian. Isi jumlah per jenis (input sama dengan "Kirim Tabung Kosong" di Kontrol Surabaya).</div>
    <div class="form-grid" style="margin-top:0">
      <div class="field"><label>No. Kontainer</label><input id="f-sby-kont" placeholder="Kont..."></div>
      <div class="field"><label>Kapal</label><input id="f-sby-kapal" placeholder="Nama kapal"></div>
      <div class="field"><label>Ekspedisi <span style="color:var(--muted);font-weight:400;text-transform:none">(opsional)</span></label><input id="f-sby-eksp" placeholder="Ekspedisi..."></div>
      <div class="field"><label>Qty 50 KG</label><input type="number" id="f-sby-q50" min="0" value="0"></div>
      <div class="field"><label>Qty 12 KG</label><input type="number" id="f-sby-q12" min="0" value="0"></div>
      <div class="field"><label>Qty 5.5 KG</label><input type="number" id="f-sby-q55" min="0" value="0"></div>
    </div>`;
  } else {
    pane=`<div class="form-grid" style="margin-top:0">
      <div class="field"><label>Customer <span style="color:var(--danger)">*</span></label><input id="f-pihak" list="cust-list" placeholder="Customer..." required>${custList}</div>
      <div class="field"><label>${catMeta().itemLabel}</label><select id="f-tab">${tabOpts}</select></div>
      <div class="field"><label>${catMeta().statusLabel}</label><select id="f-st">${(activeCategory==='lpg'?['ISI']:STATUSES).map(s=>`<option value="${escAttr(s)}">${esc(s)}</option>`).join('')}</select></div>
      <div class="field"><label>Jumlah (${catMeta().unit})</label><input type="number" id="f-qty" placeholder="0" min="1"></div>
      ${activeCategory==='lpg'?`<div class="field"><label>Jenis Pembelian</label>
        <select id="f-beli">
          <option value="isi">Beli Isi (refill) — ada tabung balik</option>
          <option value="isi_tabung">Beli Isi + Tabung — tanpa balik</option>
        </select>
      </div>`:''}
    </div>`;
  }

  return `
  <div class="card">
    <div class="card-title"><i class="bi bi-box-arrow-up"></i> Input Barang Keluar</div>
    ${!isSA?`<div style="margin-bottom:12px;padding:8px 12px;background:color-mix(in srgb,var(--accent) 8%,transparent);border:1px solid color-mix(in srgb,var(--accent) 20%,transparent);border-radius:7px;font-size:12px;color:var(--accent)"><i class="bi bi-geo-alt"></i> Region: <b>${esc(me.region)}</b></div>`:''}
    ${keluarTab==='pindah_gudang'?'':`<div class="form-grid">
      <div class="field"><label>Tanggal</label><input type="date" id="f-tgl" value="${today}"></div>
      ${isSA?`<div class="field"><label>Region Gudang</label><select id="f-reg">${regOpts}</select></div>`:`<div class="field"><label>Region Gudang</label><input id="f-reg" readonly value="${escAttr(me.region)}" style="opacity:.6;cursor:not-allowed"></div>`}
      <div class="field"><label>No. Surat Jalan <span style="color:var(--danger)">*</span></label><input id="f-sj" placeholder="SJ-001" required></div>
    </div>`}
    <div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:14px;flex-wrap:wrap;overflow-x:auto">
      ${tabBtn('penjualan','<i class="bi bi-cart"></i>','Penjualan')}
      ${tabBtn('pindah_gudang','<i class="bi bi-arrow-left-right"></i>','Pindah Gudang')}
      ${activeCategory==='lpg'?tabBtn('pengisian_sby','<i class="bi bi-buildings"></i>','Pengisian Surabaya'):''}
    </div>
    ${pane}
    ${keluarTab==='pindah_gudang'?'':`<div class="field"><label>Keterangan</label><input id="f-ket" placeholder="Opsional..."></div>
    <div style="margin-top:12px"><button class="btn btn-primary" onclick="submitTx('keluar')"><i class="bi bi-floppy"></i> Simpan Data Keluar</button></div>`}
  </div>
  <div class="card">
    <div class="card-title" style="justify-content:space-between;display:flex">
      <span><i class="bi bi-card-list"></i> Data Keluar Terbaru — ${keluarTab==='pindah_gudang'?'Pindah Gudang':keluarTab==='pengisian_sby'?'Pengisian Surabaya':'Penjualan'}</span>
      <button class="btn btn-warn btn-sm" onclick="downloadTableById('tbl-inp-keluar','Keluar')"><i class="bi bi-download"></i> Unduh Excel</button>
    </div>
    <div class="monitor-wrap">
      <table class="riwayat-tbl" id="tbl-inp-keluar">
        <tr><th>Tanggal</th>${isSA?'<th>Region</th>':''}<th>No.SJ</th><th>Customer</th><th>${catMeta().itemLabel}</th><th>Status</th><th>QTY</th><th>Keterangan</th><th>Aksi</th></tr>
        ${rows}
      </table>
    </div>
  </div>`;
}

function keluarSource(){
  const isSA=me.role==='superadmin';
  const reg=document.getElementById('f-reg');
  return isSA ? (reg?reg.value:'') : me.region;
}
/* Bangun ulang daftar Region Tujuan (pane Pindah Gudang): KECUALI region asal. */
function buildKeluarDest(){
  const dest=document.getElementById('f-dest'); if(!dest) return;
  const src=keluarSource();
  const prev=dest.value;
  dest.innerHTML=(S.regions||REGIONS).filter(r=>r!==src).map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('');
  if([...dest.options].some(o=>o.value===prev)) dest.value=prev;
}

async function submitTx(type){
  const isSA=me.role==='superadmin';
  const tgl=document.getElementById('f-tgl').value;
  const region=isSA?document.getElementById('f-reg').value:me.region;
  if(!isSA&&!region){showAlert('Akun Anda tidak memiliki region. Hubungi admin.','error');return;}
  const noSj=document.getElementById('f-sj').value.trim();
  const g=id=>document.getElementById(id);
  const pihak=(g('f-pihak')||{}).value?.trim()||'';
  const tabung=(g('f-tab')||{}).value||'';
  const status=(g('f-st')||{}).value||'';
  const qty=parseInt((g('f-qty')||{}).value)||0;
  const ket=document.getElementById('f-ket').value.trim();
  const tujuan = type==='keluar' ? keluarTab : '';
  const isSbyFill = type==='keluar' && tujuan==='pengisian_sby';
  const gnum=id=>parseInt((document.getElementById(id)||{}).value)||0;
  const sbyQ50=gnum('f-sby-q50'), sbyQ12=gnum('f-sby-q12'), sbyQ55=gnum('f-sby-q55');
  const sbyTotal=sbyQ50+sbyQ12+sbyQ55;
  const pihakLbl = type==='masuk' ? 'Supplier' : 'Customer';
  if(!tgl){showAlert('Tanggal wajib diisi!','error');return;}
  if(!noSj){showAlert('No. Surat Jalan wajib diisi!','error');return;}
  if(isSbyFill){
    if(sbyTotal<=0){showAlert('Isi minimal 1 jumlah tabung (50 / 12 / 5.5 KG)','error');return;}
  } else {
    if(!qty||qty<=0){showAlert('QTY wajib diisi!','error');return;}
    if(tujuan!=='pindah_gudang' && !pihak){showAlert(`Nama ${pihakLbl} wajib diisi!`,'error');return;}
  }
  const d=new Date(tgl);
  const base={tanggal:tgl,noSj,pihak,tabung,status,qty,ket,monthIdx:d.getMonth(),year:d.getFullYear(),createdAt:Date.now()};

  const ringkasan = isSbyFill
    ? `Keluar · KOSONG 50:${sbyQ50} 12:${sbyQ12} 5.5:${sbyQ55} (${sbyTotal}) · ${region} → Surabaya (Pengisian)`
    : `${type==='masuk'?'Masuk':'Keluar'} · ${qty} ${tabung} ${status} · ${region}`
      + (type==='keluar' ? ' · Penjualan' : '');
  showConfirm({
    ico:'<i class="bi bi-floppy"></i>', title:'Konfirmasi Simpan Data',
    msg:`Simpan transaksi berikut?<br><b style="font-size:12px">${esc(ringkasan)}</b>${noSj?`<br><span style="font-size:11px;color:var(--muted)">No.SJ: ${esc(noSj)}${pihak?' · '+esc(pihak):''}</span>`:''}`,
    confirmLabel:'Ya, Simpan', confirmClass:'btn-primary',
    onConfirm: async()=>{
  if(type==='keluar'){
    if(isSbyFill){
        /* Kirim tabung KOSONG ke Surabaya untuk pengisian → input meniru "Kirim
           Tabung Kosong" di Kontrol Surabaya: qty per jenis (50/12/5.5) sekaligus.
           Tiap jenis dgn qty>0 dicatat sebagai transaksi keluar KOSONG dan semua
           terhubung ke satu kiriman Surabaya (parentId = kirimId). */
        const gv=id=>(document.getElementById(id)||{}).value||'';
        const noKont=gv('f-sby-kont').trim(), kapal=gv('f-sby-kapal').trim(), eksp=gv('f-sby-eksp').trim();
        const kirimId=gid();
        const jenisQty=[['50 KG',sbyQ50],['12 KG',sbyQ12],['5.5 KG',sbyQ55]];
        for(const [jn,qq] of jenisQty){
          if(qq<=0) continue;
          const outTx={id:gid(),type:'keluar',region,tanggal:tgl,noSj,pihak:'',tabung:jn,status:'KOSONG',qty:qq,
            ket:(ket?ket+' | ':'')+'Kirim ke Surabaya',monthIdx:base.monthIdx,year:base.year,createdAt:Date.now(),
            saleType:'pindah_gudang',closed:true,parentId:kirimId};
          S.transactions.push(outTx); await saveTx(outTx);
        }
        const kir={id:kirimId,tanggal:tgl,so:'',noKont,kapal,ekspedisi:eksp,regionAsal:region,
          qty50:sbyQ50,qty12:sbyQ12,qty55:sbyQ55,
          status:'dikirim',tanggalSampai:null,catatan:ket,createdAt:Date.now()};
        try{ await saveSbyKirim(kir); }catch(e){ showAlert('Gagal catat kiriman Surabaya: '+(e.message||e),'error'); }
        await writeLog('PINDAH_GUDANG',`KOSONG 50:${sbyQ50} 12:${sbyQ12} 5.5:${sbyQ55} (${sbyTotal} tabung) | ${region} → Surabaya (pengisian)`);
        showAlert(`Dikirim ke Surabaya: ${sbyTotal} tabung KOSONG — cek menu Kontrol Surabaya`);
      } else {
      const purchaseType=activeCategory==='lpg'?((document.getElementById('f-beli')||{}).value||'isi'):null;
      const tx={id:gid(),type:'keluar',region,...base,status:activeCategory==='lpg'?'ISI':status,saleType:'penjualan',purchaseType,deliveryStatus:'belum',deliveredQty:0,returnedQty:0,closed:false};
      S.transactions.push(tx);
      await saveTx(tx);
      await writeLog('BARANG_KELUAR',`${tabung} – ${status} – ${qty} tabung | Region: ${region} | Penjualan (${PURCHASE_TYPE_LABEL[purchaseType]||purchaseType}) | No.SJ: ${noSj||'-'} | Customer: ${pihak||'-'}`);
      showAlert(`Penjualan tersimpan — ${qty} ${tabung} ${status} · Belum Terantar`);
    }
  } else {
    const tx={id:gid(),type:'masuk',region,...base,closed:true};
    S.transactions.push(tx);
    await saveTx(tx);
    await writeLog('BARANG_MASUK',`${tabung} – ${status} – ${qty} tabung | Region: ${region} | No.SJ: ${noSj||'-'} | Supplier: ${pihak||'-'}`);
    showAlert(`Berhasil disimpan! ${tabung} – ${status} – ${qty} tabung`);
  }
  setContent(renderFormInput(type));
    }
  });
}

/* Aksi baris transaksi. Transaksi hasil scan transfer tidak boleh diubah manual
   karena akan membuat stok tidak cocok dengan barang yang dibawa sopir. */
function txActions(t){
  if(t.transferId) return `<span class="muted small mono" title="Dicatat otomatis dari scan transfer"><i class="bi bi-lock"></i></span>`;
  return `<div class="row-actions"><button class="icon-btn icon-btn-sm" onclick="editTx('${t.id}')" aria-label="Edit"><i class="bi bi-pencil"></i></button><button class="icon-btn icon-btn-sm" onclick="confirmDelTx('${t.id}')" aria-label="Hapus"><i class="bi bi-trash3"></i></button></div>`;
}
function confirmDelTx(id){
  const tx=S.transactions.find(t=>t.id===id);
  if(tx&&tx.transferId){ showAlert('Transaksi ini dicatat dari scan transfer dan tidak bisa dihapus','error'); return; }
  showConfirm({
    ico:'<i class="bi bi-trash3"></i>',title:'Hapus Transaksi',
    msg:`Yakin hapus transaksi <b>${tx?tx.tabung+' '+tx.status+' '+tx.qty+' '+catMeta(tx.category).unit:''}</b>?<br>Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel:'Ya, Hapus',
    confirmClass:'btn-danger',
    onConfirm:async()=>{
      await deleteTx(id);
      if(tx) await writeLog('HAPUS_TRANSAKSI',`${tx.type} – ${tx.tabung} – ${tx.status} – ${tx.qty} tabung | Region: ${tx.region}`);
      if(typeof onRealtimeUpdate==='function') onRealtimeUpdate();
      showAlert('Transaksi dihapus');
    }
  });
}

/* ── Edit transaksi (masuk/keluar) ── */
function editTx(id){
  const t=S.transactions.find(x=>x.id===id); if(!t) return;
  if(t.transferId){ showAlert('Transaksi ini dicatat dari scan transfer dan tidak bisa diubah','error'); return; }
  const isSA=me.role==='superadmin';
  const regList=isSA?(S.regions||REGIONS):[me.region];
  const regOpts=regList.map(r=>`<option value="${escAttr(r)}"${t.region===r?' selected':''}>${esc(r)}</option>`).join('');
  const tabOpts=TABUNGS.map(x=>`<option value="${escAttr(x)}"${t.tabung===x?' selected':''}>${esc(x)}</option>`).join('');
  const stOpts=STATUSES.map(x=>`<option value="${escAttr(x)}"${t.status===x?' selected':''}>${esc(x)}</option>`).join('');
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeEditTx()">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header"><h4><i class="bi bi-pencil"></i> Edit Transaksi ${t.type==='masuk'?'<i class="bi bi-box-arrow-in-down"></i> Masuk':'<i class="bi bi-box-arrow-up"></i> Keluar'}</h4><button class="modal-close" onclick="closeEditTx()"><i class="bi bi-x-lg"></i></button></div>
      <div class="form-grid">
        <div class="field"><label>Tanggal</label><input type="date" id="et-tgl" value="${escAttr(t.tanggal)}"></div>
        <div class="field"><label>Region</label><select id="et-reg"${isSA?'':' disabled style="opacity:.6"'}>${regOpts}</select></div>
        <div class="field"><label>No. Surat Jalan</label><input id="et-sj" value="${escAttr(t.noSj||'')}"></div>
        <div class="field"><label>${t.type==='masuk'?'Supplier':'Customer'}</label><input id="et-pihak" value="${escAttr(t.pihak||'')}"></div>
        <div class="field"><label>${catMeta().itemLabel}</label><select id="et-tab">${tabOpts}</select></div>
        <div class="field"><label>${catMeta().statusLabel}</label><select id="et-st">${stOpts}</select></div>
        <div class="field"><label>Jumlah (${catMeta().unit})</label><input type="number" id="et-qty" min="1" value="${escAttr(t.qty)}"></div>
      </div>
      <div class="field"><label>Keterangan</label><input id="et-ket" value="${escAttr(t.ket||'')}"></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" onclick="submitEditTx('${t.id}')"><i class="bi bi-floppy"></i> Simpan Perubahan</button>
        <button class="btn btn-ghost" onclick="closeEditTx()">Batal</button>
      </div>
    </div>
  </div>`);
}
function closeEditTx(){ setModal(''); }
async function submitEditTx(id){
  const g=x=>document.getElementById(x);
  const tgl=g('et-tgl').value, noSj=g('et-sj').value.trim(), pihak=g('et-pihak').value.trim();
  const tabung=g('et-tab').value, status=g('et-st').value, qty=parseInt(g('et-qty').value), ket=g('et-ket').value.trim();
  const region=(g('et-reg')||{}).value;
  if(!tgl||!qty||qty<=0){ showAlert('Tanggal & QTY wajib diisi','error'); return; }
  if(!noSj){ showAlert('No. Surat Jalan wajib diisi','error'); return; }
  try{ await updateTx(id,{tanggal:tgl,region,noSj,pihak,tabung,status,qty,ket}); }
  catch(e){ showAlert('Gagal menyimpan: '+(e.message||e),'error'); return; }
  closeEditTx();
  if(typeof onRealtimeUpdate==='function') onRealtimeUpdate();
  showAlert('Transaksi berhasil diperbarui');
}
