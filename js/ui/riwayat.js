/* ===== RIWAYAT ===== */
let filtReg='all', filtType='all', filtTab='all', filtStatus='all';
let filtFrom='', filtTo='', filtSearch='';
let filtSale='all', filtDelivery='all';
let riwayatPage=1; const RIWAYAT_PER=25;
function riwayatGoPage(p){ riwayatPage=p; updateRiwayat(); }

function _riwayatRegs(){
  const isSA = me.role==='superadmin';
  return isSA ? (S.regions||REGIONS) : (me.region ? [me.region] : []);
}

/* Terapkan SEMUA filter ke daftar transaksi, urut terbaru dulu. */
function getRiwayatData(){
  const regs=_riwayatRegs();
  let data=[...S.transactions].filter(t=>regs.includes(t.region));
  if(filtReg!=='all')    data=data.filter(t=>t.region===filtReg);
  if(filtType!=='all')   data=data.filter(t=>t.type===filtType);
  if(filtTab!=='all')    data=data.filter(t=>t.tabung===filtTab);
  if(filtStatus!=='all') data=data.filter(t=>t.status===filtStatus);
  if(filtFrom)           data=data.filter(t=>t.tanggal>=filtFrom);
  if(filtTo)             data=data.filter(t=>t.tanggal<=filtTo);
  if(filtSale!=='all')   data=data.filter(t=>t.saleType===filtSale);
  if(filtDelivery!=='all') data=data.filter(t=>t.saleType==='penjualan' && (t.deliveryStatus||'belum')===filtDelivery);
  if(filtSearch.trim()){
    const q=filtSearch.trim().toLowerCase();
    data=data.filter(t=>
      (t.noSj||'').toLowerCase().includes(q) ||
      (t.pihak||'').toLowerCase().includes(q) ||
      (t.ket||'').toLowerCase().includes(q) ||
      (t.region||'').toLowerCase().includes(q)
    );
  }
  data.sort((a,b)=>b.createdAt-a.createdAt);
  return data;
}

/* Sel "Detail Penjualan": jenis pembelian, status pengantaran, status pinjaman. */
function riwayatDetailCell(t){
  if(t.saleType==='pindah_gudang') return `<span class="badge badge-kosong" style="font-size:9px">🔄 Pindah</span>`;
  if(t.parentId && t.status==='KOSONG') return `<span style="font-size:9px;color:var(--accent3)">↩ tabung balik</span>`;
  if(t.saleType==='penjualan'){
    const ds=t.deliveryStatus||'belum';
    const dBadge = ds==='terantar'?`<span class="badge badge-isi" style="font-size:9px">✅ Terantar</span>`
      : ds==='sebagian'?`<span class="badge badge-kosong" style="font-size:9px">📦 ${+t.deliveredQty||0}/${+t.qty||0}</span>`
      : `<span class="badge badge-bocor" style="font-size:9px">⏳ Belum</span>`;
    const loan = t.purchaseType==='isi'
      ? (t.closed?`<span style="font-size:9px;color:var(--accent3)">Lunas</span>`
                 :`<span style="font-size:9px;color:var(--accent)">Pinjam ${Math.max(0,(+t.deliveredQty||0)-(+t.returnedQty||0))}</span>`)
      : '';
    return `<div style="display:flex;flex-direction:column;gap:2px;align-items:flex-start">
      <span style="font-size:9px;color:var(--muted)">${esc(PURCHASE_TYPE_LABEL[t.purchaseType]||'')}</span>${dBadge}${loan}</div>`;
  }
  return '-';
}

/* Hanya bagian HASIL (ringkasan + tabel). Dipisah supaya saat mengetik di
   kotak pencarian, hanya bagian ini yang dirender ulang → fokus ketik & kursor
   tidak hilang. */
function riwayatResultsHtml(){
  const isSA = me.role==='superadmin';
  const data=getRiwayatData();
  const totMasuk =data.filter(t=>t.type==='masuk').reduce((a,b)=>a+(+b.qty||0),0);
  const totKeluar=data.filter(t=>t.type==='keluar').reduce((a,b)=>a+(+b.qty||0),0);
  const saldo=totMasuk-totKeluar;
  const pg=paginate(data, riwayatPage, RIWAYAT_PER); riwayatPage=pg.page;
  const rows=pg.items.length?pg.items.map(t=>`<tr>
    <td>${esc(t.tanggal)}</td>
    <td><span class="badge badge-${esc(t.type)}">${t.type==='masuk'?'📥 Masuk':'📤 Keluar'}</span></td>
    <td>${esc(t.region)}</td><td>${esc(t.noSj)||'-'}</td><td>${esc(t.pihak)||'-'}</td>
    <td style="font-size:11px">${esc(t.tabung)}</td>
    <td><span class="badge badge-${esc(String(t.status).toLowerCase())}">${esc(t.status)}</span></td>
    <td><b>${esc(t.qty)}</b></td><td>${esc(t.ket)||'-'}</td>
    <td>${riwayatDetailCell(t)}</td>
    <td><div style="display:flex;gap:4px"><button class="btn btn-blue btn-sm" onclick="editTx('${t.id}')">✏️</button><button class="btn btn-danger btn-sm" onclick="confirmDelTx('${t.id}')">🗑</button></div></td>
  </tr>`).join(''):`<tr><td colspan="11" class="empty"><div class="ico">📭</div>Tidak ada transaksi sesuai filter</td></tr>`;
  return `
  <div class="stats-grid" style="margin-bottom:14px">
    <div class="stat-card stat-blue"><div class="val">${data.length}</div><div class="lbl">Transaksi (hasil filter)</div></div>
    <div class="stat-card stat-green"><div class="val">${fmtNum(totMasuk)}</div><div class="lbl">Total Masuk</div></div>
    <div class="stat-card stat-red"><div class="val">${fmtNum(totKeluar)}</div><div class="lbl">Total Keluar</div></div>
    <div class="stat-card stat-orange"><div class="val" style="color:${saldo>=0?'var(--accent)':'#ef4444'}">${saldo>=0?'+':''}${fmtNum(saldo)}</div><div class="lbl">Saldo Bersih</div></div>
  </div>
  <div class="card">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span>📋 Riwayat Transaksi</span>
      <button class="btn btn-warn btn-sm" onclick="exportRiwayat()">⬇ Unduh Excel (semua)</button>
    </div>
    <div class="monitor-wrap">
      <table class="riwayat-tbl" id="tbl-riwayat">
        <tr><th>Tanggal</th><th>Tipe</th><th>Region</th><th>No.SJ</th><th>Supplier/Customer</th><th>Jenis Tabung</th><th>Status</th><th>QTY</th><th>Keterangan</th><th>Detail Penjualan</th><th>Aksi</th></tr>
        ${rows}
      </table>
    </div>
    ${pagerHtml(pg,'riwayatGoPage')}
  </div>`;
}

/* Export SELURUH data hasil filter (bukan hanya halaman aktif). */
function exportRiwayat(){
  const data=getRiwayatData();
  if(!data.length){ showAlert('Tidak ada data untuk diekspor','error'); return; }
  const headers=['Tanggal','Tipe','Region','No.SJ','Supplier/Customer','Jenis Tabung','Status','QTY','Keterangan','Tujuan','Pengantaran','Terantar','Balik'];
  const rows=data.map(t=>[
    t.tanggal, t.type, t.region, t.noSj||'', t.pihak||'', t.tabung, t.status, t.qty, t.ket||'',
    t.saleType||'', t.deliveryStatus||'', t.deliveredQty||0, t.returnedQty||0
  ]);
  downloadXlsFromData(headers, rows, 'Riwayat_Transaksi');
}

/* Render ulang HANYA bagian hasil (dipakai oleh semua kontrol filter). */
function updateRiwayat(){
  const el=document.getElementById('riwayat-results');
  if(el) el.innerHTML=riwayatResultsHtml();
}

function resetRiwayatFilter(){
  filtReg='all'; filtType='all'; filtTab='all'; filtStatus='all';
  filtSale='all'; filtDelivery='all';
  filtFrom=''; filtTo=''; filtSearch='';
  setContent(renderRiwayat());
}

function renderRiwayat(){
  const isSA = me.role==='superadmin';
  const regs=_riwayatRegs();
  const regOpts=`<option value="all">Semua Region</option>`+regs.map(r=>`<option value="${escAttr(r)}"${filtReg===r?' selected':''}>${esc(r)}</option>`).join('');
  const tabOpts=`<option value="all">Semua Tabung</option>`+TABUNGS.map(t=>`<option value="${escAttr(t)}"${filtTab===t?' selected':''}>${esc(t)}</option>`).join('');
  const stOpts =`<option value="all">Semua Status</option>`+STATUSES.map(s=>`<option value="${escAttr(s)}"${filtStatus===s?' selected':''}>${esc(s)}</option>`).join('');
  const adaFilter = filtReg!=='all'||filtType!=='all'||filtTab!=='all'||filtStatus!=='all'||filtSale!=='all'||filtDelivery!=='all'||filtFrom||filtTo||filtSearch.trim();
  return `
  <div class="card">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span>🔍 Filter Riwayat</span>
      <button class="btn btn-ghost btn-sm" onclick="resetRiwayatFilter()"${adaFilter?'':' disabled style="opacity:.5;cursor:not-allowed"'}>↺ Reset Filter</button>
    </div>
    <div class="field" style="margin-bottom:12px">
      <label>Cari (No. SJ / Supplier-Customer / Keterangan / Region)</label>
      <input type="search" id="riwayat-search" placeholder="Ketik kata kunci…" value="${escAttr(filtSearch)}" oninput="filtSearch=this.value;updateRiwayat()">
    </div>
    <div class="form-grid">
      ${isSA?`<div class="field"><label>Region</label><select onchange="filtReg=this.value;updateRiwayat()">${regOpts}</select></div>`:''}
      <div class="field"><label>Tipe</label><select onchange="filtType=this.value;updateRiwayat()">
        <option value="all">Semua Tipe</option>
        <option value="masuk"${filtType==='masuk'?' selected':''}>📥 Masuk</option>
        <option value="keluar"${filtType==='keluar'?' selected':''}>📤 Keluar</option>
      </select></div>
      <div class="field"><label>Jenis Tabung</label><select onchange="filtTab=this.value;updateRiwayat()">${tabOpts}</select></div>
      <div class="field"><label>Status</label><select onchange="filtStatus=this.value;updateRiwayat()">${stOpts}</select></div>
      <div class="field"><label>Tujuan</label><select onchange="filtSale=this.value;updateRiwayat()">
        <option value="all">Semua</option>
        <option value="penjualan"${filtSale==='penjualan'?' selected':''}>🛒 Penjualan</option>
        <option value="pindah_gudang"${filtSale==='pindah_gudang'?' selected':''}>🔄 Pindah Gudang</option>
      </select></div>
      <div class="field"><label>Pengantaran</label><select onchange="filtDelivery=this.value;updateRiwayat()">
        <option value="all">Semua</option>
        <option value="belum"${filtDelivery==='belum'?' selected':''}>⏳ Belum Terantar</option>
        <option value="terantar"${filtDelivery==='terantar'?' selected':''}>✅ Sudah Terantar</option>
      </select></div>
      <div class="field"><label>Dari Tanggal</label><input type="date" value="${escAttr(filtFrom)}" onchange="filtFrom=this.value;updateRiwayat()"></div>
      <div class="field"><label>Sampai Tanggal</label><input type="date" value="${escAttr(filtTo)}" onchange="filtTo=this.value;updateRiwayat()"></div>
    </div>
  </div>
  <div id="riwayat-results">${riwayatResultsHtml()}</div>`;
}
