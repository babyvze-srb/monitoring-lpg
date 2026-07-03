/* ===== PENERIMAAN PINDAH GUDANG (WAITING LIST) ===== */
let pnReg='all', pnFrom='', pnTo='', pnSearch='', pnShowDone=false, pnPage=1;
const PN_PER=25;
function pnGoPage(p){ pnPage=p; updatePenerimaan(); }

function _pnRegs(){
  const isSA=me.role==='superadmin';
  return isSA?(S.regions||REGIONS):(me.region?[me.region]:[]);
}

function getPenerimaanData(){
  const regs=_pnRegs();
  /* Tabung yang dipindah ke gudang ini (region tujuan) menunggu di-ACC. */
  let data=S.transactions.filter(t=>t.type==='masuk'&&t.saleType==='pindah_gudang'&&regs.includes(t.region));
  if(!pnShowDone) data=data.filter(t=>(t.deliveryStatus||'belum')==='belum');
  if(pnReg!=='all') data=data.filter(t=>t.region===pnReg);
  if(pnFrom)        data=data.filter(t=>t.tanggal>=pnFrom);
  if(pnTo)          data=data.filter(t=>t.tanggal<=pnTo);
  if(pnSearch.trim()){
    const q=pnSearch.trim().toLowerCase();
    data=data.filter(t=>(t.noSj||'').toLowerCase().includes(q)||(t.ket||'').toLowerCase().includes(q));
  }
  data.sort((a,b)=>(((a.deliveryStatus||'belum')==='belum')?0:1)-(((b.deliveryStatus||'belum')==='belum')?0:1) || b.createdAt-a.createdAt);
  return data;
}

function penerimaanResultsHtml(){
  const data=getPenerimaanData();
  const menungguArr=data.filter(t=>(t.deliveryStatus||'belum')==='belum');
  const menunggu=menungguArr.length;
  const totMenunggu=menungguArr.reduce((a,t)=>a+(+t.qty||0),0);
  const pg=paginate(data,pnPage,PN_PER); pnPage=pg.page;
  const rows=pg.items.length?pg.items.map(t=>{
    const belum=(t.deliveryStatus||'belum')==='belum';
    return `<tr>
      <td>${esc(t.tanggal)}</td>
      <td><b>${esc(t.region)}</b></td>
      <td style="font-size:11px">${esc(t.ket)||'-'}</td>
      <td style="font-size:11px">${esc(t.noSj)||'-'}</td>
      <td>${esc(t.tabung)}</td>
      <td><span class="badge badge-${esc(String(t.status).toLowerCase())}">${esc(t.status)}</span></td>
      <td><b>${esc(t.qty)}</b></td>
      <td>${belum?`<span class="badge badge-bocor">⏳ Menunggu</span>`:`<span class="badge badge-isi">✅ Diterima${t.deliveryDate?' · '+esc(t.deliveryDate):''}</span>`}</td>
      <td>${belum?`<button class="btn btn-success btn-sm" onclick="openTerima('${t.id}')">✅ ACC Terima</button>`:'<span style="font-size:10px;color:var(--muted)">selesai</span>'}</td>
    </tr>`;
  }).join(''):`<tr><td colspan="9" class="empty"><div class="ico">📭</div>Tidak ada barang pindahan menunggu</td></tr>`;
  return `
  <div class="stats-grid" style="margin-bottom:14px">
    <div class="stat-card stat-orange"><div class="val">${menunggu}</div><div class="lbl">⏳ Menunggu ACC</div></div>
    <div class="stat-card stat-red"><div class="val">${fmtNum(totMenunggu)}</div><div class="lbl">Total Tabung Menunggu</div></div>
  </div>
  <div class="card">
    <div class="card-title">📥 Penerimaan Pindah Gudang (Waiting List)</div>
    <div class="monitor-wrap"><table class="riwayat-tbl">
      <tr><th>Tgl Kirim</th><th>Gudang Tujuan</th><th>Keterangan</th><th>No.SJ</th><th>Tabung</th><th>Status</th><th>QTY</th><th>Penerimaan</th><th>Aksi</th></tr>
      ${rows}
    </table></div>${pagerHtml(pg,'pnGoPage')}
  </div>`;
}

function updatePenerimaan(){
  const el=document.getElementById('penerimaan-results');
  if(el) el.innerHTML=penerimaanResultsHtml();
}
function resetPenerimaanFilter(){ pnReg='all';pnFrom='';pnTo='';pnSearch='';pnShowDone=false; setContent(renderPenerimaan()); }

function openTerima(id){
  const t=S.transactions.find(x=>x.id===id); if(!t) return;
  const today=new Date().toISOString().split('T')[0];
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeTerima()">
    <div class="modal" onclick="event.stopPropagation()" style="width:360px">
      <div class="modal-header"><h4>📥 Terima Barang Pindah</h4><button class="modal-close" onclick="closeTerima()">✕</button></div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.6">
        <b style="color:var(--text)">${esc(t.qty)} ${esc(t.tabung)} ${esc(t.status)}</b> → gudang <b style="color:var(--text)">${esc(t.region)}</b><br>
        <span style="font-size:11px">${esc(t.ket)||''}</span>
      </p>
      <div class="field"><label>Tanggal Terima</label><input type="date" id="pn-tgl" value="${today}"></div>
      <p style="font-size:11px;color:var(--muted);margin-top:4px">Setelah di-ACC, tabung resmi masuk ke stok gudang ini.</p>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-success" onclick="submitTerima('${t.id}')">✅ ACC Masuk Stok</button>
        <button class="btn btn-ghost" onclick="closeTerima()">Batal</button>
      </div>
    </div>
  </div>`);
}
function closeTerima(){ setModal(''); }
async function submitTerima(id){
  const tgl=(document.getElementById('pn-tgl')||{}).value;
  if(!tgl){ showAlert('❌ Isi tanggal terima','error'); return; }
  await accPindahMasuk(id, tgl);
  closeTerima(); updatePenerimaan(); showAlert('✅ Barang diterima & masuk stok gudang');
}

function renderPenerimaan(){
  if(!me) return '';
  const isSA=me.role==='superadmin';
  const regs=_pnRegs();
  const regOpts=`<option value="all">Semua Region</option>`+regs.map(r=>`<option value="${escAttr(r)}"${pnReg===r?' selected':''}>${esc(r)}</option>`).join('');
  const ada=pnReg!=='all'||pnFrom||pnTo||pnSearch.trim()||pnShowDone;
  return `
  <div class="card">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span>🔍 Filter Penerimaan</span>
      <button class="btn btn-ghost btn-sm" onclick="resetPenerimaanFilter()"${ada?'':' disabled style="opacity:.5;cursor:not-allowed"'}>↺ Reset</button>
    </div>
    <div class="field" style="margin-bottom:12px">
      <label>Cari (No. SJ / Keterangan)</label>
      <input type="search" id="pn-search" placeholder="Ketik kata kunci…" value="${escAttr(pnSearch)}" oninput="pnSearch=this.value;updatePenerimaan()">
    </div>
    <div class="form-grid">
      ${isSA?`<div class="field"><label>Region</label><select onchange="pnReg=this.value;updatePenerimaan()">${regOpts}</select></div>`:''}
      <div class="field"><label>Tampilkan</label><select onchange="pnShowDone=(this.value==='all');updatePenerimaan()">
        <option value="menunggu"${!pnShowDone?' selected':''}>Hanya menunggu ACC</option>
        <option value="all"${pnShowDone?' selected':''}>Semua (termasuk diterima)</option>
      </select></div>
      <div class="field"><label>Dari Tanggal</label><input type="date" value="${escAttr(pnFrom)}" onchange="pnFrom=this.value;updatePenerimaan()"></div>
      <div class="field"><label>Sampai Tanggal</label><input type="date" value="${escAttr(pnTo)}" onchange="pnTo=this.value;updatePenerimaan()"></div>
    </div>
  </div>
  <div id="penerimaan-results">${penerimaanResultsHtml()}</div>`;
}
