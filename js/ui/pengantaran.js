/* ===== PENGANTARAN (ACC TERANTAR / BELUM) ===== */
let pgStatus='all', pgReg='all', pgJenis='all', pgFrom='', pgTo='', pgSearch='';
let pgPage=1; const PG_PER=25;
function pgGoPage(p){ pgPage=p; updatePengantaran(); }

function _pgRegs(){
  const isSA=me.role==='superadmin';
  return isSA?(S.regions||REGIONS):(me.region?[me.region]:[]);
}

function getPengantaranData(){
  const regs=_pgRegs();
  let data=S.transactions.filter(t=>t.type==='keluar' && t.saleType==='penjualan' && regs.includes(t.region));
  if(pgStatus!=='all') data=data.filter(t=>(t.deliveryStatus||'belum')===pgStatus);
  if(pgReg!=='all')    data=data.filter(t=>t.region===pgReg);
  if(pgJenis!=='all')  data=data.filter(t=>(t.purchaseType||'isi')===pgJenis);
  if(pgFrom)           data=data.filter(t=>t.tanggal>=pgFrom);
  if(pgTo)             data=data.filter(t=>t.tanggal<=pgTo);
  if(pgSearch.trim()){
    const q=pgSearch.trim().toLowerCase();
    data=data.filter(t=>(t.noSj||'').toLowerCase().includes(q)||(t.pihak||'').toLowerCase().includes(q)||(t.ket||'').toLowerCase().includes(q));
  }
  data.sort((a,b)=>b.createdAt-a.createdAt);
  return data;
}

function pengantaranResultsHtml(){
  const data=getPengantaranData();
  const belum=data.filter(t=>(t.deliveryStatus||'belum')==='belum').length;
  const terantar=data.length-belum;
  const pg=paginate(data, pgPage, PG_PER); pgPage=pg.page;
  const rows=pg.items.length?pg.items.map(t=>{
    const ds=t.deliveryStatus||'belum';
    const deliv=+t.deliveredQty||0, qty=+t.qty||0;
    const dsBadge = ds==='terantar'
      ? `<span class="badge badge-isi">✅ Terantar ${qty}/${qty}</span>`
      : ds==='sebagian'
        ? `<span class="badge badge-kosong">📦 Sebagian ${deliv}/${qty}</span>`
        : `<span class="badge badge-bocor">⏳ Belum 0/${qty}</span>`;
    const aksi = `<button class="btn btn-blue btn-sm" onclick="openDelivery('${t.id}')">✏️ Update</button>`;
    return `<tr>
      <td>${esc(t.tanggal)}</td><td>${esc(t.region)}</td>
      <td>${esc(t.noSj)||'-'}</td><td>${esc(t.pihak)||'-'}</td>
      <td style="font-size:11px">${esc(t.tabung)}</td>
      <td><span class="badge badge-${esc(String(t.status).toLowerCase())}">${esc(t.status)}</span></td>
      <td><b>${esc(t.qty)}</b></td>
      <td style="font-size:11px">${esc(PURCHASE_TYPE_LABEL[t.purchaseType]||t.purchaseType||'-')}</td>
      <td>${dsBadge}</td>
      <td>${aksi}</td>
    </tr>`;
  }).join(''):`<tr><td colspan="10" class="empty"><div class="ico">📭</div>Tidak ada penjualan sesuai filter</td></tr>`;
  return `
  <div class="stats-grid" style="margin-bottom:14px">
    <div class="stat-card stat-blue"><div class="val">${data.length}</div><div class="lbl">Total Penjualan</div></div>
    <div class="stat-card stat-red"><div class="val">${belum}</div><div class="lbl">⏳ Belum Terantar</div></div>
    <div class="stat-card stat-green"><div class="val">${terantar}</div><div class="lbl">✅ Sudah Terantar</div></div>
  </div>
  <div class="card">
    <div class="card-title">🚚 Daftar Pengantaran</div>
    <div class="monitor-wrap">
      <table class="riwayat-tbl" id="tbl-pengantaran">
        <tr><th>Tanggal</th><th>Region</th><th>No.SJ</th><th>Customer</th><th>Tabung</th><th>Status</th><th>QTY</th><th>Jenis</th><th>Pengantaran</th><th>Aksi</th></tr>
        ${rows}
      </table>
    </div>
    ${pagerHtml(pg,'pgGoPage')}
  </div>`;
}

function updatePengantaran(){
  const el=document.getElementById('pengantaran-results');
  if(el) el.innerHTML=pengantaranResultsHtml();
}

function resetPengantaranFilter(){
  pgStatus='all'; pgReg='all'; pgJenis='all'; pgFrom=''; pgTo=''; pgSearch='';
  setContent(renderPengantaran());
}

/* Modal update pengantaran (boleh dicicil 0..qty). */
function openDelivery(id){
  const t=S.transactions.find(x=>x.id===id); if(!t) return;
  const qty=+t.qty||0, deliv=+t.deliveredQty||0;
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeDelivery()">
    <div class="modal" onclick="event.stopPropagation()" style="width:380px">
      <div class="modal-header"><h4>🚚 Update Pengantaran</h4><button class="modal-close" onclick="closeDelivery()">✕</button></div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">
        <b style="color:var(--text)">${esc(qty)} ${esc(t.tabung)}</b> ke <b style="color:var(--text)">${esc(t.pihak||'-')}</b><br>
        Sudah terantar: <b style="color:var(--accent3)">${deliv}</b> dari <b>${qty}</b>
      </p>
      <div class="field"><label>Jumlah SUDAH terantar (total)</label>
        <input id="dlv-qty" type="number" min="0" max="${qty}" value="${deliv}" onkeydown="if(event.key==='Enter')submitDelivery('${t.id}')">
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('dlv-qty').value=0">⏳ Belum (0)</button>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('dlv-qty').value=${qty}">✅ Terantar Semua (${qty})</button>
        </div>
        <p style="font-size:11px;color:var(--muted);margin-top:6px">Boleh dicicil. ${t.purchaseType==='isi'?'Tabung kosong balik dipantau di menu Tabung Pinjaman.':'Otomatis selesai bila terantar penuh.'}</p>
      </div>
      <div class="field"><label>Tanggal Terantar</label><input type="date" id="dlv-tgl" value="${escAttr(t.deliveryDate||new Date().toISOString().split('T')[0])}"></div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-success" onclick="submitDelivery('${t.id}')">💾 Simpan</button>
        <button class="btn btn-ghost" onclick="closeDelivery()">Batal</button>
      </div>
    </div>
  </div>`);
  setTimeout(()=>{ const el=document.getElementById('dlv-qty'); if(el){el.focus();el.select();} },50);
}
function closeDelivery(){ setModal(''); }
async function submitDelivery(id){
  const v=(document.getElementById('dlv-qty')||{}).value;
  const tgl=(document.getElementById('dlv-tgl')||{}).value;
  const ok=await updateDelivery(id, v, tgl);
  if(ok){ closeDelivery(); updatePengantaran(); showAlert('✅ Status pengantaran diperbarui'); }
}

function renderPengantaran(){
  if(!me) return '';
  const isSA=me.role==='superadmin';
  const regs=_pgRegs();
  const regOpts=`<option value="all">Semua Region</option>`+regs.map(r=>`<option value="${escAttr(r)}"${pgReg===r?' selected':''}>${esc(r)}</option>`).join('');
  const ada = pgStatus!=='all'||pgReg!=='all'||pgJenis!=='all'||pgFrom||pgTo||pgSearch.trim();
  return `
  <div class="card">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span>🔍 Filter Pengantaran</span>
      <button class="btn btn-ghost btn-sm" onclick="resetPengantaranFilter()"${ada?'':' disabled style="opacity:.5;cursor:not-allowed"'}>↺ Reset</button>
    </div>
    <div class="field" style="margin-bottom:12px">
      <label>Cari (No. SJ / Customer / Keterangan)</label>
      <input type="search" id="pg-search" placeholder="Ketik kata kunci…" value="${escAttr(pgSearch)}" oninput="pgSearch=this.value;updatePengantaran()">
    </div>
    <div class="form-grid">
      <div class="field"><label>Status Pengantaran</label><select onchange="pgStatus=this.value;updatePengantaran()">
        <option value="all">Semua</option>
        <option value="belum"${pgStatus==='belum'?' selected':''}>⏳ Belum Terantar</option>
        <option value="terantar"${pgStatus==='terantar'?' selected':''}>✅ Sudah Terantar</option>
      </select></div>
      ${isSA?`<div class="field"><label>Region</label><select onchange="pgReg=this.value;updatePengantaran()">${regOpts}</select></div>`:''}
      <div class="field"><label>Jenis Pembelian</label><select onchange="pgJenis=this.value;updatePengantaran()">
        <option value="all">Semua</option>
        <option value="isi"${pgJenis==='isi'?' selected':''}>Beli Isi (refill)</option>
        <option value="isi_tabung"${pgJenis==='isi_tabung'?' selected':''}>Beli Isi + Tabung</option>
      </select></div>
      <div class="field"><label>Dari Tanggal</label><input type="date" value="${escAttr(pgFrom)}" onchange="pgFrom=this.value;updatePengantaran()"></div>
      <div class="field"><label>Sampai Tanggal</label><input type="date" value="${escAttr(pgTo)}" onchange="pgTo=this.value;updatePengantaran()"></div>
    </div>
  </div>
  <div id="pengantaran-results">${pengantaranResultsHtml()}</div>`;
}
