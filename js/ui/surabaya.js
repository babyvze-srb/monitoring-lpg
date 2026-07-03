/* ===== KONTROL TABUNG SURABAYA =====
   Alur lengkap (6 tahap, MASING-MASING HALAMAN SENDIRI — tidak digabung,
   agar navigasi via sidebar & riwayat browser konsisten dengan pola MPA di
   seluruh aplikasi):
   1) surabaya-kirim.html      — kirim tabung KOSONG dari gudang asal (dikirim → sampai)
   2) surabaya-bongkar.html    — bongkar kontainer yang sudah sampai (masuk stok kosong gudang)
   3) surabaya-stok.html       — lihat stok kosong/isi gudang Surabaya per jenis tabung
   4) surabaya-pengisian.html  — pengisian (LO) berdasarkan Tebusan/SO — 1 SO
                                  bisa dipecah jadi beberapa LO sekaligus via
                                  menu "Pecah SO jadi LO"; tiap LO mengurangi
                                  stok KOSONG & menambah stok ISI gudang
   5) surabaya-tebusan.html    — Tebusan/SO, 1 SO = 1 jenis tabung; progres
                                  terisi vs sisa
   6) surabaya-tujuan.html     — tabung ISI dikirim dari gudang Surabaya ke
                                  gudang tujuan (kontainer & kapal sendiri)
   Semua tahap saling sinkron: stok gudang dihitung live dari baris-baris
   kirim/bongkar/LO/kirim-tujuan (bukan angka yang disimpan terpisah).

   `_sbyRender` disetel oleh script inline tiap halaman (mis. `_sbyRender =
   renderSbyBongkar;`) sebelum boot() dipanggil, supaya modul ini tetap satu
   file (helper & modal dipakai bersama) namun aksi apa pun cukup me-render
   ulang HALAMAN YANG SEDANG DIBUKA, bukan gabungan semua tahap. */
let _sbyRender=null;
let sbyFrom='', sbyTo='';

function _sbyRerender(){ if(typeof _sbyRender==='function') setContent(_sbyRender()); }

/* ── Stok gudang Surabaya (dihitung, bukan disimpan) ──
   KOSONG = total dibongkar (per jenis) − total dipakai untuk pengisian (LO)
   ISI    = total hasil pengisian (LO) − total sudah dikirim ke tujuan */
function _sbyStokKosong(tabung){
  const dibongkar=(S.sbyKirim||[]).filter(k=>k.status==='dibongkar')
    .reduce((a,k)=>a+(tabung==='50 KG'?+k.qty50||0:tabung==='12 KG'?+k.qty12||0:+k.qty55||0),0);
  const dipakai=(S.sbyLo||[]).filter(l=>l.tabung===tabung).reduce((a,l)=>a+(+l.qty||0),0);
  return dibongkar-dipakai;
}
function _sbyStokIsi(tabung){
  const hasilIsi=(S.sbyLo||[]).filter(l=>l.tabung===tabung).reduce((a,l)=>a+(+l.qty||0),0);
  const dikirim=(S.sbyKirimTujuan||[]).filter(k=>k.tabung===tabung).reduce((a,k)=>a+(+k.qty||0),0);
  return hasilIsi-dikirim;
}
function _soTerisi(soId){ return (S.sbyLo||[]).filter(l=>l.soId===soId).reduce((a,l)=>a+(+l.qty||0),0); }
function _soSisa(so){ return (+so.qty||0)-_soTerisi(so.id); }
function _loCountForSo(soId){ return (S.sbyLo||[]).filter(l=>l.soId===soId).length; }

function _dateOk(x){ return (!sbyFrom||x.tanggal>=sbyFrom)&&(!sbyTo||x.tanggal<=sbyTo); }
function _sum(arr,key){ return arr.reduce((a,x)=>a+(+x[key]||0),0); }

/* ── Ringkasan stok/progress (ditampilkan di atas tiap halaman) ── */
function _sbyStatsCards(){
  const kirim=S.sbyKirim||[], kt=S.sbyKirimTujuan||[];
  const dalamPerjalanan=_sum(kirim.filter(k=>k.status==='dikirim'),'qty50')+_sum(kirim.filter(k=>k.status==='dikirim'),'qty12')+_sum(kirim.filter(k=>k.status==='dikirim'),'qty55');
  const siapBongkar=kirim.filter(k=>k.status==='sampai');
  const siapBongkarQty=_sum(siapBongkar,'qty50')+_sum(siapBongkar,'qty12')+_sum(siapBongkar,'qty55');
  const totKosong=TABUNGS.reduce((a,t)=>a+_sbyStokKosong(t),0);
  const totIsi=TABUNGS.reduce((a,t)=>a+_sbyStokIsi(t),0);
  const dalamPerjalananTujuan=_sum(kt.filter(k=>k.status==='dikirim'),'qty');
  return `<div class="stats-grid" style="margin-bottom:14px">
    <div class="stat-card stat-blue"><div class="val">${fmtNum(dalamPerjalanan)}</div><div class="lbl">🚢 Dalam Perjalanan ke Surabaya</div></div>
    <div class="stat-card stat-orange"><div class="val">${fmtNum(siapBongkarQty)}</div><div class="lbl">📦 Siap Dibongkar</div></div>
    <div class="stat-card" style="border-left:3px solid #eab308"><div class="val">${fmtNum(totKosong)}</div><div class="lbl">🈳 Stok Kosong Gudang</div></div>
    <div class="stat-card stat-green"><div class="val">${fmtNum(totIsi)}</div><div class="lbl">✅ Stok Isi Gudang</div></div>
    <div class="stat-card" style="border-left:3px solid var(--accent2)"><div class="val">${fmtNum(dalamPerjalananTujuan)}</div><div class="lbl">🚚 Dalam Perjalanan ke Tujuan</div></div>
  </div>`;
}

/* ── Navigasi cepat antar-halaman (link biasa <a href>, BUKAN tab JS —
   tiap tahap adalah halaman .html sendiri, sidebar juga mengarah ke sini). ── */
function _sbyPageNav(active){
  const items=[
    {key:'kirim',     ico:'🚢', lbl:'Perjalanan ke Surabaya', href:'surabaya-kirim.html'},
    {key:'bongkar',   ico:'📦', lbl:'Bongkar Kontainer',      href:'surabaya-bongkar.html'},
    {key:'stok',      ico:'📊', lbl:'Stok Gudang',            href:'surabaya-stok.html'},
    {key:'pengisian', ico:'⛽', lbl:'Pengisian (LO)',          href:'surabaya-pengisian.html'},
    {key:'tebusan',   ico:'🧾', lbl:'Tebusan / SO',           href:'surabaya-tebusan.html'},
    {key:'tujuan',    ico:'🚚', lbl:'Perjalanan ke Tujuan',    href:'surabaya-tujuan.html'},
  ];
  return `<div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:12px;flex-wrap:wrap;overflow-x:auto">
    ${items.map(it=>`<a href="${it.href}" style="padding:8px 14px;font-size:13px;text-decoration:none;border-bottom:2px solid ${active===it.key?'var(--accent)':'transparent'};color:${active===it.key?'var(--text)':'var(--muted)'};font-weight:600;white-space:nowrap;cursor:pointer">${it.ico} ${it.lbl}</a>`).join('')}
  </div>`;
}

function _dateFilterBar(){
  return `<div class="form-grid" style="margin-bottom:10px">
    <div class="field"><label>Dari Tanggal</label><input type="date" value="${escAttr(sbyFrom)}" onchange="sbyFrom=this.value;_sbyRerender()"></div>
    <div class="field"><label>Sampai Tanggal</label><input type="date" value="${escAttr(sbyTo)}" onchange="sbyTo=this.value;_sbyRerender()"></div>
    <div class="field" style="display:flex;align-items:flex-end"><button class="btn btn-ghost btn-sm" style="width:100%" onclick="sbyFrom='';sbyTo='';_sbyRerender()">↺ Reset Tanggal</button></div>
  </div>`;
}

function _qtyCell(x){ return `<span style="font-size:11px">50:<b>${x.qty50||0}</b> · 12:<b>${x.qty12||0}</b> · 5.5:<b>${x.qty55||0}</b></span>`; }
function _qtySum(x){ return (+x.qty50||0)+(+x.qty12||0)+(+x.qty55||0); }
function _kirimStatusBadge(st){
  if(st==='dibongkar') return `<span class="badge badge-isi">📦 Dibongkar</span>`;
  if(st==='sampai') return `<span class="badge badge-bocor">🛳️ Sampai</span>`;
  return `<span class="badge badge-kosong">🚢 Dikirim</span>`;
}

/* ===================================================================
   HALAMAN 1 — Perjalanan ke Surabaya (kirim tabung KOSONG dari gudang asal)
   =================================================================== */
function renderSbyKirim(){
  if(!me) return '';
  const kirim=(S.sbyKirim||[]).filter(_dateOk);
  const rows=kirim.length?kirim.map(k=>`<tr>
    <td>${esc(k.tanggal)}</td>
    <td>${esc(k.noKont)||'-'}</td>
    <td>${esc(k.kapal)||'-'}</td>
    <td style="font-size:11px">${esc(k.ekspedisi)||'-'}</td>
    <td>${esc(k.regionAsal)||'-'}</td>
    <td>${_qtyCell(k)}</td>
    <td><b>${_qtySum(k)}</b></td>
    <td>${_kirimStatusBadge(k.status)}</td>
    <td><div style="display:flex;gap:5px;flex-wrap:wrap">
      ${k.status==='dikirim'?`<button class="btn btn-success btn-sm" onclick="sbyMarkSampai('${k.id}')">✅ Sampai</button>`:''}
      <button class="btn btn-danger btn-sm" onclick="sbyDelKirim('${k.id}')">🗑</button>
    </div></td>
  </tr>`).join(''):`<tr><td colspan="9" class="empty"><div class="ico">📭</div>Tidak ada data</td></tr>`;
  return `${_sbyStatsCards()}
  <div class="card">
    ${_sbyPageNav('kirim')}
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <p style="font-size:12px;color:var(--muted);margin:0">Tabung kosong yang dikirim dari gudang asal menuju Surabaya untuk diisi. Setelah <b>Sampai</b>, lanjutkan ke halaman <b>📦 Bongkar Kontainer</b>.</p>
      <button class="btn btn-primary btn-sm" onclick="openKirimModal()">➕ Kirim Kosong</button>
    </div>
    ${_dateFilterBar()}
    <div class="monitor-wrap"><table class="riwayat-tbl">
      <tr><th>Tanggal</th><th>No. Kont</th><th>Kapal</th><th>Ekspedisi</th><th>Asal</th><th>Qty / Jenis</th><th>Total</th><th>Status</th><th>Aksi</th></tr>
      ${rows}
    </table></div>
  </div>`;
}

/* ── Modal: Kirim tabung kosong (gudang asal → Surabaya) ── */
function openKirimModal(){
  const today=new Date().toISOString().split('T')[0];
  const regOpts=(S.regions||REGIONS).map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('');
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeSbyModal()">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header"><h4>🚢 Kirim Tabung Kosong → Surabaya</h4><button class="modal-close" onclick="closeSbyModal()">✕</button></div>
      <div class="form-grid">
        <div class="field"><label>Tanggal</label><input type="date" id="sk-tgl" value="${today}"></div>
        <div class="field"><label>No. Kontainer</label><input id="sk-kont" placeholder="Kont..."></div>
        <div class="field"><label>Kapal</label><input id="sk-kapal" placeholder="Nama kapal"></div>
        <div class="field"><label>Ekspedisi <span style="color:var(--muted);font-weight:400;text-transform:none">(opsional)</span></label><input id="sk-eksp" placeholder="Ekspedisi..."></div>
        <div class="field"><label>Gudang Asal</label><select id="sk-asal">${regOpts}</select></div>
        <div class="field"><label>Qty 50 KG</label><input type="number" id="sk-q50" min="0" value="0"></div>
        <div class="field"><label>Qty 12 KG</label><input type="number" id="sk-q12" min="0" value="0"></div>
        <div class="field"><label>Qty 5.5 KG</label><input type="number" id="sk-q55" min="0" value="0"></div>
      </div>
      <div class="field"><label>Catatan</label><input id="sk-cat" placeholder="Opsional..."></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" onclick="submitKirim()">💾 Simpan</button>
        <button class="btn btn-ghost" onclick="closeSbyModal()">Batal</button>
      </div>
    </div>
  </div>`);
}
function closeSbyModal(){ setModal(''); }
async function submitKirim(){
  const g=id=>document.getElementById(id);
  const k={
    id:gid(), tanggal:g('sk-tgl').value, so:'', noKont:g('sk-kont').value.trim(),
    kapal:g('sk-kapal').value.trim(), ekspedisi:g('sk-eksp').value.trim(), regionAsal:g('sk-asal').value,
    qty50:parseInt(g('sk-q50').value)||0, qty12:parseInt(g('sk-q12').value)||0, qty55:parseInt(g('sk-q55').value)||0,
    status:'dikirim', tanggalSampai:null, tanggalBongkar:null, catatan:g('sk-cat').value.trim(), createdAt:Date.now()
  };
  if(!k.tanggal){ showAlert('❌ Tanggal wajib diisi','error'); return; }
  if((k.qty50+k.qty12+k.qty55)<=0){ showAlert('❌ Isi minimal 1 jumlah tabung','error'); return; }
  try{ await saveSbyKirim(k); }catch(e){ showAlert('❌ Gagal simpan: '+(e.message||e),'error'); return; }
  closeSbyModal(); _sbyRerender(); showAlert('✅ Pengiriman dicatat');
}
function sbyMarkSampai(id){
  const k=(S.sbyKirim||[]).find(x=>x.id===id); if(!k) return;
  const today=new Date().toISOString().split('T')[0];
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeSbyModal()">
    <div class="modal" onclick="event.stopPropagation()" style="width:360px">
      <div class="modal-header"><h4>📦 Tabung Sampai Surabaya</h4><button class="modal-close" onclick="closeSbyModal()">✕</button></div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Kont ${esc(k.noKont)||'-'}</p>
      <div class="field"><label>Tanggal Sampai</label><input type="date" id="sby-sampai-tgl" value="${today}"></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-success" onclick="doSbyKirimSampai('${id}')">✅ Tandai Sampai</button>
        <button class="btn btn-ghost" onclick="closeSbyModal()">Batal</button>
      </div>
    </div>
  </div>`);
}
async function doSbyKirimSampai(id){
  const tgl=(document.getElementById('sby-sampai-tgl')||{}).value;
  if(!tgl){ showAlert('❌ Isi tanggal','error'); return; }
  await setSbyKirimSampai(id,tgl); closeSbyModal(); _sbyRerender(); showAlert('✅ Ditandai sampai');
}
function sbyDelKirim(id){
  showConfirm({ico:'🗑️',title:'Hapus Pengiriman',msg:'Yakin hapus data pengiriman ini?',confirmLabel:'Ya, Hapus',confirmClass:'btn-danger',onConfirm:async()=>{ await deleteSbyKirim(id); _sbyRerender(); showAlert('🗑️ Dihapus'); }});
}

/* ===================================================================
   HALAMAN 2 — Bongkar Kontainer (tabung kosong yang sudah sampai → masuk
   stok gudang Surabaya)
   =================================================================== */
function renderSbyBongkar(){
  if(!me) return '';
  const siapBongkar=(S.sbyKirim||[]).filter(k=>k.status==='sampai');
  const bongkarRows=siapBongkar.length?siapBongkar.map(k=>`<tr>
    <td>${esc(k.tanggalSampai)||esc(k.tanggal)}</td>
    <td>${esc(k.noKont)||'-'}</td>
    <td>${esc(k.regionAsal)||'-'}</td>
    <td>${_qtyCell(k)}</td>
    <td><b>${_qtySum(k)}</b></td>
    <td><button class="btn btn-success btn-sm" onclick="sbyMarkBongkar('${k.id}')">📦 Bongkar</button></td>
  </tr>`).join(''):`<tr><td colspan="6" class="empty"><div class="ico">📭</div>Tidak ada kontainer menunggu bongkar</td></tr>`;
  return `${_sbyStatsCards()}
  <div class="card">
    ${_sbyPageNav('bongkar')}
    <p style="font-size:12px;color:var(--muted);margin:0 0 10px">Kontainer yang sudah <b>Sampai</b> di Surabaya, siap dibongkar. Setelah dibongkar, tabung kosong otomatis masuk ke halaman <b>📊 Stok Gudang</b>.</p>
    <div class="monitor-wrap"><table class="riwayat-tbl">
      <tr><th>Tgl Sampai</th><th>No. Kont</th><th>Asal</th><th>Qty / Jenis</th><th>Total</th><th>Aksi</th></tr>
      ${bongkarRows}
    </table></div>
  </div>`;
}
function sbyMarkBongkar(id){
  const k=(S.sbyKirim||[]).find(x=>x.id===id); if(!k) return;
  const today=new Date().toISOString().split('T')[0];
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeSbyModal()">
    <div class="modal" onclick="event.stopPropagation()" style="width:380px">
      <div class="modal-header"><h4>📦 Bongkar Kontainer</h4><button class="modal-close" onclick="closeSbyModal()">✕</button></div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Kont ${esc(k.noKont)||'-'} · ${_qtyCell(k)} (total ${_qtySum(k)})</p>
      <p style="font-size:11px;color:var(--muted);margin-bottom:10px">Setelah dibongkar, tabung kosong ini otomatis masuk ke <b>Stok Gudang Surabaya</b>.</p>
      <div class="field"><label>Tanggal Bongkar</label><input type="date" id="sby-bongkar-tgl" value="${today}"></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-success" onclick="doSbyBongkar('${id}')">📦 Bongkar Sekarang</button>
        <button class="btn btn-ghost" onclick="closeSbyModal()">Batal</button>
      </div>
    </div>
  </div>`);
}
async function doSbyBongkar(id){
  const tgl=(document.getElementById('sby-bongkar-tgl')||{}).value;
  if(!tgl){ showAlert('❌ Isi tanggal','error'); return; }
  await setSbyKirimBongkar(id,tgl); closeSbyModal(); _sbyRerender(); showAlert('✅ Kontainer dibongkar — stok gudang diperbarui');
}

/* ===================================================================
   HALAMAN 3 — Stok Gudang Surabaya (ringkasan kosong/isi per jenis tabung)
   =================================================================== */
function renderSbyStok(){
  if(!me) return '';
  const stokRows=TABUNGS.map(t=>`<tr>
    <td><b>${esc(t)}</b></td>
    <td style="color:#eab308"><b>${fmtNum(_sbyStokKosong(t))}</b></td>
    <td style="color:var(--accent3)"><b>${fmtNum(_sbyStokIsi(t))}</b></td>
  </tr>`).join('');
  return `${_sbyStatsCards()}
  <div class="card">
    ${_sbyPageNav('stok')}
    <p style="font-size:12px;color:var(--muted);margin:0 0 10px">Stok KOSONG bertambah saat kontainer dibongkar (halaman <b>📦 Bongkar Kontainer</b>) dan berkurang saat dipakai mengisi (halaman <b>⛽ Pengisian (LO)</b>). Stok ISI bertambah dari hasil pengisian dan berkurang saat dikirim ke gudang tujuan.</p>
    <div class="monitor-wrap"><table class="riwayat-tbl">
      <tr><th>Jenis Tabung</th><th>🈳 Stok Kosong</th><th>✅ Stok Isi</th></tr>
      ${stokRows}
    </table></div>
  </div>`;
}

/* ===================================================================
   HALAMAN 4 — Pengisian (LO): daftar hasil pengisian + menu "Pecah SO
   jadi LO" (1 Tebusan/SO bisa dipecah sekaligus jadi beberapa baris LO).
   =================================================================== */
function renderSbyPengisian(){
  if(!me) return '';
  const lo=(S.sbyLo||[]).filter(_dateOk);
  const loRows=lo.length?lo.map(l=>{
    const cnt=_loCountForSo(l.soId);
    const so=(S.sbySo||[]).find(s=>s.id===l.soId);
    return `<tr>
      <td>${esc(l.tanggal)}</td>
      <td><b>${esc(l.so)||'-'}</b>${cnt>1?` <span class="badge badge-bocor" style="font-size:9px">✂️ Pecahan (${cnt} LO)</span>`:` <span class="badge badge-isi" style="font-size:9px">Utuh</span>`}</td>
      <td style="font-size:11px">${esc(l.lo)||'-'}</td>
      <td>${esc(l.tabung)}</td>
      <td><b>${fmtNum(l.qty)}</b></td>
      <td style="font-size:11px;color:var(--muted)">${so?`Sisa Tebusan: ${fmtNum(_soSisa(so))}/${fmtNum(so.qty)}`:'-'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="sbyDelLo('${l.id}')" title="Batalkan pengisian (stok kosong/isi kembali disesuaikan)">🗑</button></td>
    </tr>`;
  }).join(''):`<tr><td colspan="7" class="empty"><div class="ico">📭</div>Belum ada pengisian</td></tr>`;
  return `${_sbyStatsCards()}
  <div class="card">
    ${_sbyPageNav('pengisian')}
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
      <p style="font-size:12px;color:var(--muted);margin:0">Hasil pengisian (LO) — dari stok kosong gudang, berdasarkan Tebusan/SO. Tiap baris di sini <b>No. LO</b>-nya sendiri, bukan No. Tebusan (No. Tebusan ada di level SO).</p>
      <button class="btn btn-success btn-sm" onclick="openPecahLoModal()">✂️ Pecah SO jadi LO</button>
    </div>
    ${_dateFilterBar()}
    <div class="monitor-wrap"><table class="riwayat-tbl">
      <tr><th>Tanggal</th><th>SO</th><th>No. LO</th><th>Tabung</th><th>Qty Diisi</th><th>Progres Tebusan</th><th>Aksi</th></tr>
      ${loRows}
    </table></div>
  </div>`;
}
function sbyDelLo(id){
  showConfirm({ico:'🗑️',title:'Batalkan Pengisian',msg:'Yakin batalkan pengisian (LO) ini? Stok kosong &amp; isi gudang akan disesuaikan kembali.',confirmLabel:'Ya, Batalkan',confirmClass:'btn-danger',onConfirm:async()=>{ await deleteSbyLo(id); _sbyRerender(); showAlert('🗑️ Pengisian dibatalkan'); }});
}

/* ── Modal: Pecah SO/Tebusan jadi beberapa LO sekaligus ──
   1 Tebusan/SO = 1 jenis tabung. Modal ini mengisi satu atau banyak baris
   LO (No. LO + Qty) dalam SATU aksi; total semua baris tidak boleh
   melebihi sisa Tebusan maupun stok kosong gudang jenis tabung itu. Bisa
   dipakai untuk isi utuh (1 baris) maupun dipecah (>1 baris). */
let _pecahRows=[{lo:'',qty:0}];
function openPecahLoModal(preSoId){
  const avail=(S.sbySo||[]).filter(o=>_soSisa(o)>0);
  if(!avail.length){ showAlert('❌ Tidak ada Tebusan/SO dengan sisa yang bisa diisi. Buat Tebusan dulu di halaman "🧾 Tebusan / SO".','error'); return; }
  _pecahRows=[{lo:'',qty:0}];
  const soId=preSoId && avail.some(o=>o.id===preSoId) ? preSoId : avail[0].id;
  _renderPecahModal(soId);
}
function _renderPecahModal(soId){
  const avail=(S.sbySo||[]).filter(o=>_soSisa(o)>0);
  const so=avail.find(o=>o.id===soId)||avail[0];
  if(!so){ closeSbyModal(); return; }
  const today=new Date().toISOString().split('T')[0];
  const soOpts=avail.map(o=>`<option value="${o.id}"${o.id===so.id?' selected':''}>${esc(o.so)||'(tanpa no.)'} — ${esc(o.tabung)} · sisa ${fmtNum(_soSisa(o))}/${fmtNum(o.qty)}</option>`).join('');
  const sisa=_soSisa(so), kosong=_sbyStokKosong(so.tabung), maks=Math.max(0,Math.min(sisa,kosong));
  const totalQty=_pecahRows.reduce((a,r)=>a+(+r.qty||0),0);
  const overLimit=totalQty>maks;
  const rowsHtml=_pecahRows.map((r,i)=>`<div class="form-grid" style="margin-top:0;margin-bottom:4px">
    <div class="field"><label>No. LO ${i+1}</label><input value="${escAttr(r.lo)}" oninput="pecahSetVal(${i},'lo',this.value)" placeholder="LO-..."></div>
    <div class="field"><label>Qty</label><input type="number" min="0" value="${r.qty||0}" oninput="pecahSetVal(${i},'qty',this.value)"></div>
    <div class="field" style="display:flex;align-items:flex-end">${_pecahRows.length>1?`<button class="btn btn-danger btn-sm" style="width:100%" onclick="pecahRemoveRow(${i})">🗑 Hapus Baris</button>`:''}</div>
  </div>`).join('');
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeSbyModal()">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header"><h4>✂️ Pecah SO jadi Beberapa LO</h4><button class="modal-close" onclick="closeSbyModal()">✕</button></div>
      <p style="font-size:11px;color:var(--muted);margin-bottom:10px">1 Tebusan/SO (satu jenis tabung) bisa langsung dipecah jadi beberapa baris LO sekaligus di sini — atau cukup 1 baris bila tidak dipecah (isi utuh).</p>
      <div class="field"><label>Tebusan / SO</label><select id="pecah-so" onchange="_renderPecahModal(this.value)">${soOpts}</select></div>
      <p style="font-size:11px;color:var(--muted);margin-bottom:10px">Sisa Tebusan: <b>${fmtNum(sisa)}</b> ${esc(so.tabung)} &nbsp;·&nbsp; Stok Kosong Gudang: <b>${fmtNum(kosong)}</b> &nbsp;·&nbsp; Maks total baris: <b style="color:${maks>0?'var(--accent3)':'var(--danger)'}">${fmtNum(maks)}</b></p>
      <div class="field"><label>Tanggal</label><input type="date" id="pecah-tgl" value="${today}"></div>
      <div id="pecah-rows">${rowsHtml}</div>
      <button class="btn btn-ghost btn-sm" onclick="pecahAddRow()">➕ Tambah Baris LO</button>
      <p style="font-size:12px;margin:10px 0;color:${overLimit?'var(--danger)':'var(--text)'}">Total semua baris: <b>${fmtNum(totalQty)}</b>${overLimit?' — melebihi maksimum!':''}</p>
      <div class="field"><label>Catatan</label><input id="pecah-cat" placeholder="Opsional..."></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-success" onclick="submitPecah()">💾 Simpan Semua LO</button>
        <button class="btn btn-ghost" onclick="closeSbyModal()">Batal</button>
      </div>
    </div>
  </div>`);
}
function pecahSetVal(i,key,val){ if(!_pecahRows[i]) return; _pecahRows[i][key]= key==='qty' ? (parseInt(val)||0) : val; const sel=document.getElementById('pecah-so'); _renderPecahModal(sel?sel.value:undefined); }
function pecahAddRow(){ _pecahRows.push({lo:'',qty:0}); const sel=document.getElementById('pecah-so'); _renderPecahModal(sel?sel.value:undefined); }
function pecahRemoveRow(i){ _pecahRows.splice(i,1); if(!_pecahRows.length) _pecahRows=[{lo:'',qty:0}]; const sel=document.getElementById('pecah-so'); _renderPecahModal(sel?sel.value:undefined); }
async function submitPecah(){
  const soId=(document.getElementById('pecah-so')||{}).value;
  const so=(S.sbySo||[]).find(o=>o.id===soId); if(!so){ showAlert('❌ Pilih Tebusan/SO','error'); return; }
  const tgl=(document.getElementById('pecah-tgl')||{}).value;
  const cat=(document.getElementById('pecah-cat')||{}).value?.trim()||'';
  if(!tgl){ showAlert('❌ Tanggal wajib diisi','error'); return; }
  const rows=_pecahRows.filter(r=>(+r.qty||0)>0);
  if(!rows.length){ showAlert('❌ Isi qty minimal 1 baris LO','error'); return; }
  const totalQty=rows.reduce((a,r)=>a+(+r.qty||0),0);
  const sisa=_soSisa(so), kosong=_sbyStokKosong(so.tabung);
  if(totalQty>sisa){ showAlert(`❌ Total qty melebihi sisa Tebusan (sisa ${fmtNum(sisa)})`,'error'); return; }
  if(totalQty>kosong){ showAlert(`❌ Total qty melebihi stok kosong gudang (${esc(so.tabung)}: ${fmtNum(kosong)})`,'error'); return; }
  try{
    for(const r of rows){
      const l={ id:gid(), soId:so.id, so:so.so, lo:(r.lo||'').trim(), tanggal:tgl,
        tabung:so.tabung, qty:r.qty, catatan:cat, createdAt:Date.now() };
      await saveSbyLo(l);
    }
  }catch(e){ showAlert('❌ Gagal simpan: '+(e.message||e),'error'); return; }
  closeSbyModal(); _sbyRerender();
  showAlert(rows.length>1 ? `✅ SO dipecah jadi ${rows.length} LO — total ${totalQty} ${so.tabung}` : `✅ Pengisian dicatat — stok kosong → isi (${totalQty} ${so.tabung})`);
}

/* ===================================================================
   HALAMAN 3 — Tebusan / SO (1 jenis tabung per SO, progres terisi vs sisa)
   =================================================================== */
function renderSbyTebusan(){
  if(!me) return '';
  const soArr=(S.sbySo||[]).filter(_dateOk);
  const rows=soArr.length?soArr.map(o=>{
    const terisi=_soTerisi(o.id), sisa=_soSisa(o), cnt=_loCountForSo(o.id);
    const pct=o.qty>0?Math.min(100,Math.round(terisi/o.qty*100)):0;
    return `<tr>
      <td>${esc(o.tanggal)}</td>
      <td><b>${esc(o.so)||'-'}</b></td>
      <td style="font-size:11px">${esc(o.noTebusan)||'-'}</td>
      <td>${esc(o.tabung)}</td>
      <td><b>${fmtNum(o.qty)}</b></td>
      <td style="color:var(--accent3)">${fmtNum(terisi)}</td>
      <td style="font-weight:800;color:${sisa>0?'var(--accent)':'var(--muted)'}">${fmtNum(sisa)}</td>
      <td style="min-width:110px">
        <div style="background:var(--surface2);border-radius:6px;height:7px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--accent3)"></div></div>
        <span style="font-size:10px;color:var(--muted)">${pct}% · ${cnt} LO${cnt>1?' (pecahan)':cnt===1?' (utuh)':''}</span>
      </td>
      <td style="font-size:11px;color:var(--muted)">${esc(o.catatan)||'-'}</td>
      <td><div style="display:flex;gap:5px;flex-wrap:wrap">
        ${sisa>0?`<button class="btn btn-success btn-sm" onclick="openPecahLoModal('${o.id}')">✂️ Pecah jadi LO</button>`:''}
        ${cnt===0?`<button class="btn btn-danger btn-sm" onclick="sbyDelSo('${o.id}')">🗑</button>`:''}
      </div></td>
    </tr>`;
  }).join(''):`<tr><td colspan="10" class="empty"><div class="ico">📭</div>Belum ada Tebusan/SO — klik "➕ Buat Tebusan"</td></tr>`;
  return `${_sbyStatsCards()}
  <div class="card">
    ${_sbyPageNav('tebusan')}
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <p style="font-size:12px;color:var(--muted);margin:0">1 Tebusan/SO hanya untuk <b>satu jenis tabung</b>. Sebuah Tebusan sudah mencakup LO-nya — klik <b>✂️ Pecah jadi LO</b> untuk mengisi sekaligus (1 baris = utuh) atau dipecah jadi beberapa baris LO dalam satu aksi (lihat juga halaman "⛽ Pengisian (LO)").</p>
      <button class="btn btn-primary btn-sm" onclick="openSoModal()">➕ Buat Tebusan</button>
    </div>
    ${_dateFilterBar()}
    <div class="monitor-wrap"><table class="riwayat-tbl">
      <tr><th>Tanggal</th><th>No. SO</th><th>No. Tebusan</th><th>Tabung</th><th>Qty Tebusan</th><th>Terisi (LO)</th><th>Sisa</th><th>Progres</th><th>Catatan</th><th>Aksi</th></tr>
      ${rows}
    </table></div>
  </div>`;
}

function openSoModal(){
  const today=new Date().toISOString().split('T')[0];
  const tabOpts=TABUNGS.map(t=>`<option value="${escAttr(t)}">${esc(t)} — stok kosong: ${fmtNum(_sbyStokKosong(t))}</option>`).join('');
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeSbyModal()">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header"><h4>🧾 Buat Tebusan / SO</h4><button class="modal-close" onclick="closeSbyModal()">✕</button></div>
      <p style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.6">1 Tebusan hanya untuk <b>satu jenis tabung</b>. Setelah dibuat, isi tabung lewat "✂️ Pecah jadi LO" di halaman ini atau di "⛽ Pengisian (LO)" — boleh sekaligus atau dipecah beberapa kali.</p>
      <div class="form-grid">
        <div class="field"><label>Tanggal</label><input type="date" id="so-tgl" value="${today}"></div>
        <div class="field"><label>No. SO</label><input id="so-no" placeholder="SO-..."></div>
        <div class="field"><label>No. Tebusan <span style="color:var(--muted);font-weight:400;text-transform:none">(opsional)</span></label><input id="so-tebusan" placeholder="No. tebusan..."></div>
        <div class="field"><label>Jenis Tabung</label><select id="so-tab">${tabOpts}</select></div>
        <div class="field"><label>Qty Tebusan</label><input type="number" id="so-qty" min="1" value="0"></div>
      </div>
      <div class="field"><label>Catatan</label><input id="so-cat" placeholder="Opsional..."></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary" onclick="submitSo()">💾 Simpan Tebusan</button>
        <button class="btn btn-ghost" onclick="closeSbyModal()">Batal</button>
      </div>
    </div>
  </div>`);
}
async function submitSo(){
  const g=id=>document.getElementById(id);
  const o={ id:gid(), so:g('so-no').value.trim(), noTebusan:g('so-tebusan').value.trim(), tanggal:g('so-tgl').value,
    tabung:g('so-tab').value, qty:parseInt(g('so-qty').value)||0, catatan:g('so-cat').value.trim(), createdAt:Date.now() };
  if(!o.tanggal||!o.so){ showAlert('❌ Tanggal & No. SO wajib diisi','error'); return; }
  if(o.qty<=0){ showAlert('❌ Isi Qty Tebusan minimal 1','error'); return; }
  try{ await saveSbySo(o); }catch(e){ showAlert('❌ Gagal simpan: '+(e.message||e),'error'); return; }
  closeSbyModal(); _sbyRerender(); showAlert('✅ Tebusan/SO dibuat');
}
function sbyDelSo(id){
  if(_loCountForSo(id)>0){ showAlert('❌ Tebusan sudah punya LO pengisian — tidak bisa dihapus','error'); return; }
  showConfirm({ico:'🗑️',title:'Hapus Tebusan/SO',msg:'Yakin hapus Tebusan/SO ini?',confirmLabel:'Ya, Hapus',confirmClass:'btn-danger',onConfirm:async()=>{ await deleteSbySo(id); _sbyRerender(); showAlert('🗑️ Dihapus'); }});
}

/* ===================================================================
   HALAMAN 4 — Perjalanan ke Tujuan (tabung ISI: Surabaya → gudang tujuan)
   =================================================================== */
function renderSbyKeTujuan(){
  if(!me) return '';
  const kt=(S.sbyKirimTujuan||[]).filter(_dateOk);
  const rows=kt.length?kt.map(k=>`<tr>
    <td>${esc(k.tanggal)}</td>
    <td>${esc(k.noKont)||'-'}</td>
    <td>${esc(k.kapal)||'-'}</td>
    <td style="font-size:11px">${esc(k.ekspedisi)||'-'}</td>
    <td>${esc(k.regionTujuan)||'-'}</td>
    <td>${esc(k.tabung)}</td>
    <td><b>${fmtNum(k.qty)}</b></td>
    <td>${k.status==='sampai'?`<span class="badge badge-isi">✅ Sampai</span>`:`<span class="badge badge-bocor">🚚 Dikirim</span>`}</td>
    <td><div style="display:flex;gap:5px;flex-wrap:wrap">
      ${k.status==='dikirim'?`<button class="btn btn-success btn-sm" onclick="sbyMarkTujuanSampai('${k.id}')">✅ Sampai Gudang</button>`:''}
      <button class="btn btn-danger btn-sm" onclick="sbyDelKirimTujuan('${k.id}')">🗑</button>
    </div></td>
  </tr>`).join(''):`<tr><td colspan="9" class="empty"><div class="ico">📭</div>Belum ada pengiriman ke gudang tujuan</td></tr>`;
  return `${_sbyStatsCards()}
  <div class="card">
    ${_sbyPageNav('tujuan')}
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <p style="font-size:12px;color:var(--muted);margin:0">Tabung ISI dari gudang Surabaya dikirim ke gudang tujuan (mis. Ternate). Mengurangi <b>Stok Isi Gudang</b> Surabaya.</p>
      <button class="btn btn-success btn-sm" onclick="openKirimTujuanModal()">➕ Kirim ke Tujuan</button>
    </div>
    ${_dateFilterBar()}
    <div class="monitor-wrap"><table class="riwayat-tbl">
      <tr><th>Tanggal</th><th>No. Kont</th><th>Kapal</th><th>Ekspedisi</th><th>Tujuan</th><th>Tabung</th><th>Qty</th><th>Status</th><th>Aksi</th></tr>
      ${rows}
    </table></div>
  </div>`;
}

function openKirimTujuanModal(){
  const today=new Date().toISOString().split('T')[0];
  const tersedia=TABUNGS.filter(t=>_sbyStokIsi(t)>0);
  if(!tersedia.length){ showAlert('❌ Belum ada stok isi gudang yang bisa dikirim. Lakukan pengisian dulu di halaman "⛽ Pengisian (LO)".','error'); return; }
  const tabOpts=tersedia.map(t=>`<option value="${escAttr(t)}">${esc(t)} — stok isi: ${fmtNum(_sbyStokIsi(t))}</option>`).join('');
  const regOpts=(S.regions||REGIONS).map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('');
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeSbyModal()">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header"><h4>🚚 Kirim Tabung Isi → Gudang Tujuan</h4><button class="modal-close" onclick="closeSbyModal()">✕</button></div>
      <div class="form-grid">
        <div class="field"><label>Tanggal</label><input type="date" id="kt-tgl" value="${today}"></div>
        <div class="field"><label>Jenis Tabung</label><select id="kt-tab" onchange="updateKirimTujuanInfo()">${tabOpts}</select></div>
        <div class="field"><label>Qty</label><input type="number" id="kt-qty" min="1" value="0"></div>
        <div class="field"><label>Gudang Tujuan</label><select id="kt-tujuan">${regOpts}</select></div>
        <div class="field"><label>No. Kontainer</label><input id="kt-kont" placeholder="Kont..."></div>
        <div class="field"><label>Kapal</label><input id="kt-kapal" placeholder="Nama kapal"></div>
        <div class="field"><label>Ekspedisi <span style="color:var(--muted);font-weight:400;text-transform:none">(opsional)</span></label><input id="kt-eksp" placeholder="Ekspedisi..."></div>
      </div>
      <div id="kt-info" style="font-size:11px;color:var(--muted);margin-bottom:6px"></div>
      <div class="field"><label>Catatan</label><input id="kt-cat" placeholder="Opsional..."></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-success" onclick="submitKirimTujuan()">💾 Simpan</button>
        <button class="btn btn-ghost" onclick="closeSbyModal()">Batal</button>
      </div>
    </div>
  </div>`);
  updateKirimTujuanInfo();
}
function updateKirimTujuanInfo(){
  const sel=document.getElementById('kt-tab'); if(!sel) return;
  const stok=_sbyStokIsi(sel.value);
  const info=document.getElementById('kt-info');
  if(info) info.innerHTML=`Stok isi gudang tersedia untuk <b>${esc(sel.value)}</b>: <b style="color:var(--accent3)">${fmtNum(stok)}</b>`;
  const qtyEl=document.getElementById('kt-qty'); if(qtyEl) qtyEl.max=stok;
}
async function submitKirimTujuan(){
  const g=id=>(document.getElementById(id)||{}).value||'';
  const tabung=g('kt-tab'); const qty=parseInt(g('kt-qty'))||0;
  const tgl=g('kt-tgl'); const tujuan=g('kt-tujuan');
  if(!tgl){ showAlert('❌ Tanggal wajib diisi','error'); return; }
  if(qty<=0){ showAlert('❌ Qty harus lebih dari 0','error'); return; }
  const stok=_sbyStokIsi(tabung);
  if(qty>stok){ showAlert(`❌ Qty melebihi stok isi gudang (${esc(tabung)}: ${fmtNum(stok)})`,'error'); return; }
  const k={ id:gid(), tanggal:tgl, tabung, qty, regionTujuan:tujuan,
    noKont:g('kt-kont').trim(), kapal:g('kt-kapal').trim(), ekspedisi:g('kt-eksp').trim(),
    catatan:g('kt-cat').trim(), createdAt:Date.now() };
  try{ await saveSbyKirimTujuan(k); }catch(e){ showAlert('❌ Gagal simpan: '+(e.message||e),'error'); return; }
  closeSbyModal(); _sbyRerender(); showAlert(`✅ Dikirim ke ${tujuan}: ${qty} ${tabung}`);
}
function sbyMarkTujuanSampai(id){
  const k=(S.sbyKirimTujuan||[]).find(x=>x.id===id); if(!k) return;
  const today=new Date().toISOString().split('T')[0];
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeSbyModal()">
    <div class="modal" onclick="event.stopPropagation()" style="width:360px">
      <div class="modal-header"><h4>🏭 Sampai di Gudang Tujuan</h4><button class="modal-close" onclick="closeSbyModal()">✕</button></div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px">${esc(k.tabung)} × ${fmtNum(k.qty)} → ${esc(k.regionTujuan)||'-'}</p>
      <div class="field"><label>Tanggal Sampai</label><input type="date" id="sby-kt-tgl" value="${today}"></div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-success" onclick="doSbyKirimTujuanSampai('${id}')">✅ Tandai Sampai</button>
        <button class="btn btn-ghost" onclick="closeSbyModal()">Batal</button>
      </div>
    </div>
  </div>`);
}
async function doSbyKirimTujuanSampai(id){
  const tgl=(document.getElementById('sby-kt-tgl')||{}).value;
  if(!tgl){ showAlert('❌ Isi tanggal','error'); return; }
  await setSbyKirimTujuanSampai(id,tgl); closeSbyModal(); _sbyRerender(); showAlert('✅ Sampai di gudang tujuan');
}
function sbyDelKirimTujuan(id){
  showConfirm({ico:'🗑️',title:'Hapus Pengiriman',msg:'Yakin hapus data pengiriman ke tujuan ini? Stok isi gudang Surabaya akan disesuaikan kembali.',confirmLabel:'Ya, Hapus',confirmClass:'btn-danger',onConfirm:async()=>{ await deleteSbyKirimTujuan(id); _sbyRerender(); showAlert('🗑️ Dihapus'); }});
}
