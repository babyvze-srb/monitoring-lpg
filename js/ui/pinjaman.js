/* ===== TABUNG PINJAMAN (penjualan "Beli Isi" yang tabung kosongnya belum balik penuh) ===== */
let pjReg='all', pjFrom='', pjTo='', pjSearch='', pjShowDone=false;
let pjPage=1; const PJ_PER=25;
function pjGoPage(p){ pjPage=p; updatePinjaman(); }

function _pjRegs(){
  const isSA=me.role==='superadmin';
  return isSA?(S.regions||REGIONS):(me.region?[me.region]:[]);
}

/* Semua penjualan "Beli Isi" (yang punya kewajiban tabung balik). */
function getPinjamanData(){
  const regs=_pjRegs();
  let data=S.transactions.filter(t=>
    t.type==='keluar' && t.saleType==='penjualan' && t.purchaseType==='isi' && regs.includes(t.region));
  if(!pjShowDone) data=data.filter(t=>!t.closed);   // default: hanya yang masih meminjam
  if(pjReg!=='all') data=data.filter(t=>t.region===pjReg);
  if(pjFrom)        data=data.filter(t=>t.tanggal>=pjFrom);
  if(pjTo)          data=data.filter(t=>t.tanggal<=pjTo);
  if(pjSearch.trim()){
    const q=pjSearch.trim().toLowerCase();
    data=data.filter(t=>(t.noSj||'').toLowerCase().includes(q)||(t.pihak||'').toLowerCase().includes(q)||(t.ket||'').toLowerCase().includes(q));
  }
  data.sort((a,b)=>(a.closed?1:0)-(b.closed?1:0) || b.createdAt-a.createdAt);
  return data;
}

function pinjamanResultsHtml(){
  const data=getPinjamanData();
  const totPinjam=data.filter(t=>!t.closed).reduce((a,t)=>a+Math.max(0,(+t.deliveredQty||0)-(+t.returnedQty||0)),0);
  const totBalik =data.reduce((a,t)=>a+(+t.returnedQty||0),0);
  const aktif=data.filter(t=>!t.closed).length;
  const pg=paginate(data, pjPage, PJ_PER); pjPage=pg.page;
  const rows=pg.items.length?pg.items.map(t=>{
    const qty=+t.qty||0, deliv=+t.deliveredQty||0, back=+t.returnedQty||0, owed=Math.max(0,deliv-back);
    const pct=deliv>0?Math.round(back/deliv*100):0;
    const ds=t.deliveryStatus||'belum';
    const dsBadge = ds==='terantar' ? `<span class="badge badge-isi">✅ Terantar</span>` : `<span class="badge badge-bocor">⏳ Belum</span>`;
    const progress=`<div style="display:flex;align-items:center;gap:6px">
      <div style="flex:1;min-width:60px;height:6px;background:var(--surface2);border-radius:99px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${t.closed?'var(--accent3)':'var(--accent)'}"></div></div>
      <span style="font-size:10px;color:var(--muted);white-space:nowrap">${back}/${qty}</span></div>`;
    const canReturn=deliv-back>0;
    const canFinalize=!t.closed && deliv>0 && back>=deliv;
    const aksi=t.closed
      ? `<span class="badge badge-isi">✅ Lunas</span>`
      : `<div style="display:flex;gap:5px;flex-wrap:wrap">
          ${canReturn?`<button class="btn btn-success btn-sm" onclick="openReturn('${t.id}')">↩ Balik</button>`:''}
          ${canFinalize?`<button class="btn btn-blue btn-sm" onclick="doFinalize('${t.id}')">✔ Selesaikan</button>`:''}
          ${!canReturn&&!canFinalize?`<span style="font-size:10px;color:var(--muted)">menunggu pengantaran</span>`:''}
        </div>`;
    return `<tr>
      <td>${esc(t.tanggal)}</td><td>${esc(t.region)}</td>
      <td>${esc(t.noSj)||'-'}</td><td>${esc(t.pihak)||'-'}</td>
      <td style="font-size:11px">${esc(t.tabung)}</td>
      <td><b>${qty}</b></td>
      <td>${deliv}</td>
      <td style="color:var(--accent3)">${back}</td>
      <td style="font-weight:800;color:${owed>0?'var(--accent)':'var(--muted)'}">${owed}</td>
      <td style="min-width:110px">${progress}</td>
      <td>${dsBadge}</td>
      <td>${aksi}</td>
    </tr>`;
  }).join(''):`<tr><td colspan="12" class="empty"><div class="ico">📭</div>Tidak ada data pinjaman sesuai filter</td></tr>`;
  return `
  <div class="stats-grid" style="margin-bottom:14px">
    <div class="stat-card stat-orange"><div class="val">${aktif}</div><div class="lbl">Pinjaman Aktif</div></div>
    <div class="stat-card stat-red"><div class="val">${fmtNum(totPinjam)}</div><div class="lbl">Total Tabung Dipinjam</div></div>
    <div class="stat-card stat-green"><div class="val">${fmtNum(totBalik)}</div><div class="lbl">Total Sudah Balik</div></div>
  </div>
  <div class="card">
    <div class="card-title">↩️ Daftar Tabung Pinjaman (Beli Isi / Refill)</div>
    <div class="monitor-wrap">
      <table class="riwayat-tbl" id="tbl-pinjaman">
        <tr><th>Tanggal</th><th>Region</th><th>No.SJ</th><th>Customer</th><th>Tabung</th><th>Ambil</th><th>Terantar</th><th>Balik</th><th>Sisa</th><th>Progress</th><th>Pengantaran</th><th>Aksi</th></tr>
        ${rows}
      </table>
    </div>
    ${pagerHtml(pg,'pjGoPage')}
  </div>`;
}

function updatePinjaman(){
  const el=document.getElementById('pinjaman-results');
  if(el) el.innerHTML=pinjamanResultsHtml();
}

function resetPinjamanFilter(){
  pjReg='all'; pjFrom=''; pjTo=''; pjSearch=''; pjShowDone=false;
  setContent(renderPinjaman());
}

/* Modal konfirmasi tabung balik (boleh dicicil). */
function openReturn(id){
  const t=S.transactions.find(x=>x.id===id); if(!t) return;
  const owed=(+t.deliveredQty||0)-(+t.returnedQty||0);
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeReturn()">
    <div class="modal" onclick="event.stopPropagation()" style="width:380px">
      <div class="modal-header"><h4>↩️ Konfirmasi Tabung Balik</h4><button class="modal-close" onclick="closeReturn()">✕</button></div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">
        <b style="color:var(--text)">${esc(t.qty)} ${esc(t.tabung)}</b> ke <b style="color:var(--text)">${esc(t.pihak||'-')}</b><br>
        Sudah balik: <b style="color:var(--accent3)">${t.returnedQty||0}</b> &nbsp;·&nbsp; Sisa pinjaman: <b style="color:var(--accent)">${owed}</b>
      </p>
      <div class="field"><label>Jumlah tabung balik sekarang</label>
        <input id="ret-qty" type="number" min="1" max="${owed}" value="${owed}" onkeydown="if(event.key==='Enter')submitReturn('${t.id}')">
        <p style="font-size:11px;color:var(--muted);margin-top:4px">Boleh dicicil. Otomatis <b>LUNAS</b> jika total balik = jumlah ambil.</p>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-success" onclick="submitReturn('${t.id}')">💾 Simpan Balik</button>
        <button class="btn btn-ghost" onclick="closeReturn()">Batal</button>
      </div>
    </div>
  </div>`);
  setTimeout(()=>{ const el=document.getElementById('ret-qty'); if(el){el.focus();el.select();} },50);
}
function closeReturn(){ setModal(''); }
async function submitReturn(id){
  const v=parseInt((document.getElementById('ret-qty')||{}).value)||0;
  const ok=await confirmReturn(id, v);
  if(ok){ closeReturn(); updatePinjaman(); showAlert('✅ Tabung balik dicatat'); }
}

/* Selesaikan manual (terantar sebagian yang sudah balik penuh). */
function doFinalize(id){
  showConfirm({
    ico:'✔️', title:'Selesaikan Penjualan',
    msg:'Tandai penjualan ini <b>SELESAI/LUNAS</b>?<br><span style="font-size:11px;color:var(--muted)">Sisa yang belum terantar dianggap tidak jadi diantar.</span>',
    confirmLabel:'Ya, Selesaikan', confirmClass:'btn-primary',
    onConfirm:async()=>{ const ok=await finalizeSale(id); if(ok){ updatePinjaman(); showAlert('✅ Penjualan diselesaikan'); } }
  });
}

function renderPinjaman(){
  if(!me) return '';
  const isSA=me.role==='superadmin';
  const regs=_pjRegs();
  const regOpts=`<option value="all">Semua Region</option>`+regs.map(r=>`<option value="${escAttr(r)}"${pjReg===r?' selected':''}>${esc(r)}</option>`).join('');
  const ada = pjReg!=='all'||pjFrom||pjTo||pjSearch.trim()||pjShowDone;
  return `
  <div class="card">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span>🔍 Filter Tabung Pinjaman</span>
      <button class="btn btn-ghost btn-sm" onclick="resetPinjamanFilter()"${ada?'':' disabled style="opacity:.5;cursor:not-allowed"'}>↺ Reset</button>
    </div>
    <div class="field" style="margin-bottom:12px">
      <label>Cari (No. SJ / Customer / Keterangan)</label>
      <input type="search" id="pj-search" placeholder="Ketik kata kunci…" value="${escAttr(pjSearch)}" oninput="pjSearch=this.value;updatePinjaman()">
    </div>
    <div class="form-grid">
      ${isSA?`<div class="field"><label>Region</label><select onchange="pjReg=this.value;updatePinjaman()">${regOpts}</select></div>`:''}
      <div class="field"><label>Tampilkan</label><select onchange="pjShowDone=(this.value==='all');updatePinjaman()">
        <option value="aktif"${!pjShowDone?' selected':''}>Hanya yang masih meminjam</option>
        <option value="all"${pjShowDone?' selected':''}>Semua (termasuk lunas)</option>
      </select></div>
      <div class="field"><label>Dari Tanggal</label><input type="date" value="${escAttr(pjFrom)}" onchange="pjFrom=this.value;updatePinjaman()"></div>
      <div class="field"><label>Sampai Tanggal</label><input type="date" value="${escAttr(pjTo)}" onchange="pjTo=this.value;updatePinjaman()"></div>
    </div>
  </div>
  <div id="pinjaman-results">${pinjamanResultsHtml()}</div>`;
}
