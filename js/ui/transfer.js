/* ===== TRANSFER GUDANG — sisi Admin Gudang =====
   Admin membuat transfer lalu menampilkan barcode di lokasi truk berada; sopir
   memindai dari halaman sopir.html. Stok hanya berubah di server saat dipindai. */
let trfTab='aktif', trfSearch='', trfPage=1;
const TRF_PER=20;
let trfDraft=null, trfDetailId=null;
const TRF_VEHICLE_TYPES=['Pick Up','Engkel (CDE)','Engkel Double (CDD)','Fuso','Tronton','Wingbox'];
let trfBarcode=null, _trfPollTimer=null, _trfClockTimer=null;

function trfGoPage(p){ trfPage=p; updateTransferList(); }
function isAdminAt(w){ return me.role==='superadmin' || (me.role==='operator' && me.region===w); }

function trfVisible(x){
  if(me.role==='superadmin') return true;
  /* Gudang mana pun bisa jadi tempat singgah, jadi transfer aktif terlihat semua. */
  if(['menunggu','jalan','singgah'].includes(x.status)) return true;
  return x.origin===me.region||x.destination===me.region||x.stops.includes(me.region)
    ||x.events.some(e=>e.warehouse===me.region);
}
function trfFiltered(){
  let list=S.transfers.filter(trfVisible);
  if(trfTab==='aktif') list=list.filter(x=>['menunggu','jalan','singgah'].includes(x.status));
  else if(trfTab==='selesai') list=list.filter(x=>x.status==='selesai');
  else if(trfTab==='batal') list=list.filter(x=>x.status==='batal');
  const q=trfSearch.trim().toLowerCase();
  if(q) list=list.filter(x=>[x.code,x.noSj,x.origin,x.destination,x.driverName,x.vehicle,...x.items.map(i=>i.product)]
    .some(v=>(v||'').toLowerCase().includes(q)));
  return list;
}

function renderTransfer(){
  if(!S.schemaV3) return schemaMissingCard();
  const vis=S.transfers.filter(trfVisible);
  const count=s=>vis.filter(x=>x.status===s).length;
  const finishedThisMonth=vis.filter(x=>x.status==='selesai'&&x.finishedAt&&new Date(x.finishedAt).getMonth()===new Date().getMonth()).length;
  const canCreate=me.role==='superadmin'||me.role==='operator';
  const need=vis.filter(transferNeedsAction).filter(x=>me.role!=='superadmin');
  return `
  <div class="page-head">
    <div>
      <h1>Transfer Barcode</h1>
      <p>Pindahkan LPG dan pelumas antar gudang. Barang berpindah saat sopir memindai barcode dari admin gudang.</p>
    </div>
    ${canCreate?`<button class="btn btn-primary" onclick="openCreateTransfer()"><i class="bi bi-plus-lg"></i> Buat Transfer</button>`:''}
  </div>
  <div class="kpi-row">
    ${kpi('Menunggu dimuat',count('menunggu'),'bi-hourglass-split','','amber')}
    ${kpi('Di perjalanan',count('jalan'),'bi-truck','','blue')}
    ${kpi('Singgah',count('singgah'),'bi-signpost-split','','violet')}
    ${kpi('Selesai bulan ini',finishedThisMonth,'bi-check2-circle','','green')}
  </div>
  ${need.length?`<div class="section-label">Perlu tindakan di gudang Anda</div>
    <div class="action-list">${need.map(actionCard).join('')}</div>`:''}
  <div class="toolbar">
    <div class="seg" role="tablist">
      ${[['aktif','Aktif'],['selesai','Selesai'],['batal','Batal'],['semua','Semua']].map(([k,l])=>
        `<button class="seg-btn${trfTab===k?' active':''}" onclick="trfTab='${k}';trfPage=1;setContent(renderTransfer())">${l}</button>`).join('')}
    </div>
    <div class="search-box"><i class="bi bi-search"></i>
      <input type="search" placeholder="Cari kode, gudang, sopir, produk" value="${escAttr(trfSearch)}" oninput="trfSearch=this.value;trfPage=1;updateTransferList()">
    </div>
  </div>
  <div id="transfer-list">${transferListHtml()}</div>`;
}
function updateTransferList(){
  const el=document.getElementById('transfer-list');
  if(el) el.innerHTML=transferListHtml();
}
function kpi(label,val,icon,sub,color){
  return `<div class="kpi" style="--c:var(--c-${color})"><div class="kpi-top"><span>${label}</span><i class="bi ${icon}"></i></div>
    <div class="kpi-val">${fmtNum(val)}</div>${sub?`<div class="kpi-sub">${sub}</div>`:''}</div>`;
}
function actionCard(x){
  const a=trfNextAction(x);
  return `<div class="action-card">
    <div class="action-main" onclick="openTransferDetail('${x.id}')">
      <div class="action-title"><span class="mono">${esc(x.code)}</span> ${statusBadge(x)}</div>
      <div class="action-sub">${esc(a.text)} · ${esc(itemsSummary(x))}</div>
    </div>
    <button class="btn btn-primary btn-sm" onclick="${a.onclick}"><i class="bi bi-qr-code"></i> ${esc(a.label)}</button>
  </div>`;
}
function trfNextAction(x){
  if(x.status==='menunggu') return {label:'Barcode Muat',text:`Sopir memuat barang ke ${x.destination}`,onclick:`issueBarcode('${x.id}','muat',${jsArg(x.origin)})`};
  if(x.status==='singgah') return {label:'Barcode Lanjut',text:`Singgah di ${x.currentLocation}, lanjut ke ${x.destination}`,onclick:`openContinue('${x.id}')`};
  return {label:'Barcode Bongkar',text:`Tiba dari ${x.origin}, sopir ${x.driverName||'-'}`,onclick:`issueBarcode('${x.id}','bongkar',${jsArg(x.destination)})`};
}
function itemsSummary(x){
  const totals={};
  x.items.forEach(i=>{ totals[i.category]=(totals[i.category]||0)+i.qty; });
  return CATEGORY_KEYS.filter(c=>totals[c]).map(c=>`${fmtNum(totals[c])} ${catMeta(c).unit} ${catMeta(c).short}`).join(', ');
}
function transferListHtml(){
  const list=trfFiltered();
  const pg=paginate(list,trfPage,TRF_PER); trfPage=pg.page;
  if(!pg.items.length) return `<div class="card"><div class="empty"><div class="ico"><i class="bi bi-inbox"></i></div>Tidak ada transfer pada daftar ini</div></div>`;
  return `<div class="card card-flush"><div class="monitor-wrap"><table class="riwayat-tbl trf-tbl">
    <tr><th>Kode</th><th>Rute</th><th>Barang</th><th>Sopir</th><th>Status</th><th>Tanggal</th></tr>
    ${pg.items.map(x=>`<tr class="row-link" onclick="openTransferDetail('${x.id}')">
      <td class="mono">${esc(x.code)}</td>
      <td>${routeHtml(x,true)}</td>
      <td>${esc(itemsSummary(x))}</td>
      <td>${esc(x.driverName)||'<span class="muted">Belum ada</span>'}</td>
      <td>${statusBadge(x)}</td>
      <td class="muted">${esc(x.tanggal)}</td>
    </tr>`).join('')}
  </table></div>${pagerHtml(pg,'trfGoPage')}</div>`;
}

/* ── Buat transfer ── */
function newLine(){
  const cat=activeCategory; const p=productsOf(cat)[0];
  return {category:cat,product:p?p.name:'',status:goodStatus(cat),qty:''};
}
function openCreateTransfer(){
  const origin=me.role==='superadmin'?(S.regions[0]||''):me.region;
  trfDraft={origin,destination:S.regions.find(r=>r!==origin)||'',stops:[],noSj:'',driverId:'',vehicleType:'',vehicle:'',note:'',
    tanggal:localDate(),items:[],line:newLine()};
  renderCreateModal();
}
function draftAvailable(d,product,status){
  const used=d.items.filter(i=>i.product===product&&i.status===status).reduce((a,i)=>a+i.qty,0);
  return stockAvailable(d.origin,product,status)-used;
}
function renderCreateModal(){
  const d=trfDraft;
  const opt=(v,l,sel)=>`<option value="${escAttr(v)}"${sel?' selected':''}>${esc(l)}</option>`;
  const originSel=me.role==='superadmin'
    ?`<select onchange="trfDraftSet('origin',this.value)">${S.regions.map(r=>opt(r,r,r===d.origin)).join('')}</select>`
    :`<input value="${escAttr(d.origin)}" readonly>`;
  const destOpts=S.regions.filter(r=>r!==d.origin).map(r=>opt(r,r,r===d.destination)).join('');
  const stopChoices=S.regions.filter(r=>r!==d.origin&&r!==d.destination&&!d.stops.includes(r));
  const drivers=S.users.filter(u=>u.role==='sopir');
  const l=d.line;
  const prods=productsOf(l.category);
  const avail=l.product?draftAvailable(d,l.product,l.status):0;
  /* Dirender ulang tiap perubahan: jaga posisi scroll & jangan ulang animasi. */
  const prev=document.querySelector('#modal-root .modal');
  const keepScroll=prev?prev.scrollTop:0;
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeModal()">
    <div class="modal modal-lg${prev?' no-anim':''}" onclick="event.stopPropagation()">
      <div class="modal-header"><h4>Buat Transfer</h4><button class="modal-close" onclick="closeModal()"><i class="bi bi-x-lg"></i></button></div>
      <div class="form-section">Rute</div>
      <div class="form-grid form-grid-2">
        <div class="field"><label>Gudang Asal</label>${originSel}</div>
        <div class="field"><label>Gudang Tujuan</label><select onchange="trfDraftSet('destination',this.value)">${destOpts}</select></div>
      </div>
      <div class="field"><label>Singgah di Gudang <span class="label-hint">opsional, untuk tujuan jauh</span></label>
        <div class="chips">
          ${d.stops.map((s,i)=>`<span class="chip"><span class="chip-num">${i+1}</span>${esc(s)}<button onclick="trfRemoveStop(${i})" aria-label="Hapus ${escAttr(s)}"><i class="bi bi-x"></i></button></span>`).join('')}
          ${stopChoices.length?`<select class="chip-add" onchange="if(this.value)trfAddStop(this.value)">
            <option value="">Tambah gudang singgah</option>${stopChoices.map(r=>opt(r,r)).join('')}</select>`:''}
        </div>
      </div>
      <div class="form-section">Barang</div>
      <div class="line-form">
        <div class="field"><label>Kategori</label><select onchange="trfLineCategory(this.value)">${CATEGORY_KEYS.map(c=>opt(c,catMeta(c).label,c===l.category)).join('')}</select></div>
        <div class="field"><label>${catMeta(l.category).itemLabel}</label><select onchange="trfLineSet('product',this.value)">${prods.map(p=>opt(p.name,p.name,p.name===l.product)).join('')}</select></div>
        <div class="field"><label>${catMeta(l.category).statusLabel}</label><select onchange="trfLineSet('status',this.value)">${catMeta(l.category).statuses.map(s=>opt(s,s,s===l.status)).join('')}</select></div>
        <div class="field"><label>Jumlah</label><input id="trf-qty" type="number" min="1" value="${escAttr(l.qty)}" oninput="trfDraft.line.qty=this.value" onkeydown="if(event.key==='Enter')trfAddItem()"></div>
        <button class="btn btn-ghost line-add" onclick="trfAddItem()"><i class="bi bi-plus-lg"></i> Tambah</button>
      </div>
      <p class="field-note">Tersedia di ${esc(d.origin)}: <b>${fmtNum(Math.max(avail,0))}</b> ${catMeta(l.category).unit}</p>
      ${d.items.length?`<table class="riwayat-tbl line-tbl">
        <tr><th>Produk</th><th>Kondisi</th><th>Jumlah</th><th></th></tr>
        ${d.items.map((i,n)=>`<tr><td>${esc(i.product)} <span class="muted">${esc(catMeta(i.category).short)}</span></td>
          <td><span class="badge badge-${esc(i.status.toLowerCase())}">${esc(i.status)}</span></td>
          <td><b>${fmtNum(i.qty)}</b> ${catMeta(i.category).unit}</td>
          <td class="td-end"><button class="icon-btn icon-btn-sm" onclick="trfRemoveItem(${n})" aria-label="Hapus"><i class="bi bi-trash3"></i></button></td></tr>`).join('')}
      </table>`:`<p class="field-note">Belum ada barang ditambahkan.</p>`}
      <div class="form-section">Pengiriman</div>
      <div class="form-grid form-grid-2">
        <div class="field"><label>No. Surat Jalan <span class="req-mark">*</span></label><input id="trf-sj" required aria-required="true" placeholder="Wajib diisi" value="${escAttr(d.noSj)}" oninput="trfDraft.noSj=this.value;this.classList.remove('input-error')"></div>
        <div class="field"><label>Sopir</label><select onchange="trfDraft.driverId=this.value">
          <option value="">Sopir pertama yang memindai</option>${drivers.map(u=>opt(u.id,u.name,u.id===d.driverId)).join('')}
        </select>${drivers.length?'':`<p class="field-note">Belum ada akun sopir. Buat di menu Kelola User.</p>`}</div>
        <div class="field"><label>Tanggal</label><input type="date" value="${escAttr(d.tanggal)}" oninput="trfDraft.tanggal=this.value"></div>
        <div class="field"><label>Jenis Mobil</label><input list="trf-vehicle-types" placeholder="Pilih atau ketik" value="${escAttr(d.vehicleType)}" oninput="trfDraft.vehicleType=this.value">
          <datalist id="trf-vehicle-types">${TRF_VEHICLE_TYPES.map(v=>`<option value="${escAttr(v)}"></option>`).join('')}</datalist></div>
        <div class="field"><label>No. Polisi</label><input placeholder="Opsional" value="${escAttr(d.vehicle)}" oninput="trfDraft.vehicle=this.value"></div>
        <div class="field"><label>Catatan</label><input placeholder="Opsional" value="${escAttr(d.note)}" oninput="trfDraft.note=this.value"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" id="trf-submit" onclick="submitCreateTransfer()">Buat Transfer</button>
      </div>
    </div>
  </div>`);
  const now=document.querySelector('#modal-root .modal');
  if(now) now.scrollTop=keepScroll;
}
function trfDraftSet(k,v){
  trfDraft[k]=v;
  if(k==='origin'){
    trfDraft.items=[];
    if(trfDraft.destination===v) trfDraft.destination=S.regions.find(r=>r!==v)||'';
  }
  trfDraft.stops=trfDraft.stops.filter(s=>s!==trfDraft.origin&&s!==trfDraft.destination);
  renderCreateModal();
}
function trfAddStop(s){ trfDraft.stops.push(s); renderCreateModal(); }
function trfRemoveStop(i){ trfDraft.stops.splice(i,1); renderCreateModal(); }
function trfLineCategory(c){
  const p=productsOf(c)[0];
  trfDraft.line={category:c,product:p?p.name:'',status:goodStatus(c),qty:trfDraft.line.qty};
  renderCreateModal();
}
function trfLineSet(k,v){ trfDraft.line[k]=v; renderCreateModal(); }
function trfAddItem(){
  const d=trfDraft,l=d.line,q=parseInt(l.qty)||0;
  if(!l.product){ showAlert('Pilih produk terlebih dahulu','error'); return; }
  if(q<=0){ showAlert('Jumlah harus lebih dari 0','error'); return; }
  const avail=draftAvailable(d,l.product,l.status);
  if(q>avail){ showAlert(`Stok ${l.product} ${l.status} di ${d.origin} hanya ${Math.max(avail,0)}`,'error'); return; }
  const ex=d.items.find(i=>i.product===l.product&&i.status===l.status);
  if(ex) ex.qty+=q; else d.items.push({category:l.category,product:l.product,status:l.status,qty:q});
  l.qty='';
  renderCreateModal();
  const inp=document.getElementById('trf-qty'); if(inp) inp.focus();
}
function trfRemoveItem(i){ trfDraft.items.splice(i,1); renderCreateModal(); }
async function submitCreateTransfer(){
  const d=trfDraft;
  if(!d.destination){ showAlert('Pilih gudang tujuan','error'); return; }
  if(!d.items.length){ showAlert('Tambahkan minimal satu barang','error'); return; }
  if(!(d.noSj||'').trim()){
    showAlert('No. Surat Jalan wajib diisi','error');
    const sj=document.getElementById('trf-sj');
    if(sj){ sj.classList.add('input-error'); sj.focus(); }
    return;
  }
  const btn=document.getElementById('trf-submit'); if(btn) btn.disabled=true;
  try{
    /* Jenis mobil dan no. polisi disimpan bersama di kolom vehicle. */
    const vehicle=[d.vehicleType,d.vehicle].map(v=>(v||'').trim()).filter(Boolean).join(' · ');
    const r=await transferCreate({...d,vehicle});
    await loadTransfers();
    trfDraft=null;
    setContent(renderTransfer());
    showAlert(`Transfer ${r.code} dibuat`);
    openTransferDetail(r.id);
  }catch(e){
    showAlert(e.message,'error');
    if(btn) btn.disabled=false;
  }
}

/* ── Detail ── */
const EVENT_LABEL={dibuat:'Transfer dibuat',muat:'Dimuat sopir',singgah_masuk:'Singgah',singgah_keluar:'Lanjut jalan',
  ganti_sopir:'Ganti sopir',bongkar:'Dibongkar di tujuan',batal:'Dibatalkan',alih_tujuan:'Tujuan dialihkan'};
const EVENT_ICON={dibuat:'bi-plus-lg',muat:'bi-box-arrow-up',singgah_masuk:'bi-signpost-split',singgah_keluar:'bi-signpost-2',
  ganti_sopir:'bi-person-gear',bongkar:'bi-box-arrow-in-down',batal:'bi-x-lg',alih_tujuan:'bi-sign-turn-right'};
function fmtTime(ms){ return new Date(ms).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }

function openTransferDetail(id){
  const x=S.transfers.find(t=>t.id===id); if(!x) return;
  trfDetailId=id;
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeModal()">
    <div class="modal modal-lg" onclick="event.stopPropagation()">
      <div class="modal-header"><h4 class="mono">${esc(x.code)}</h4><button class="modal-close" onclick="closeModal()"><i class="bi bi-x-lg"></i></button></div>
      <div class="detail-status">${statusBadge(x)}<span class="muted">${esc(custodyText(x))}</span></div>
      <div class="route-box">${routeHtml(x)}</div>
      ${detailActions(x)}
      <div class="detail-grid">
        <div>
          <div class="form-section">Barang</div>
          <table class="riwayat-tbl">
            ${x.items.map(i=>`<tr><td>${esc(i.product)}<div class="muted small">${esc(catMeta(i.category).label)}</div></td>
              <td><span class="badge badge-${esc(i.status.toLowerCase())}">${esc(i.status)}</span></td>
              <td class="td-end"><b>${fmtNum(i.qty)}</b> ${catMeta(i.category).unit}</td></tr>`).join('')}
          </table>
          <dl class="meta">
            ${x.noSj?`<dt>No. SJ</dt><dd>${esc(x.noSj)}</dd>`:''}
            <dt>Sopir</dt><dd>${esc(x.driverName)||'Sopir pertama yang memindai'}</dd>
            ${x.vehicle?`<dt>Kendaraan</dt><dd>${esc(x.vehicle)}</dd>`:''}
            <dt>Dibuat oleh</dt><dd>${esc(x.createdByName)||'-'}</dd>
            ${x.note?`<dt>Catatan</dt><dd>${esc(x.note)}</dd>`:''}
          </dl>
        </div>
        <div>
          <div class="form-section">Perjalanan</div>
          <ol class="timeline">
            ${[...x.events].reverse().map(e=>`<li>
              <span class="tl-ico"><i class="bi ${EVENT_ICON[e.kind]||'bi-dot'}"></i></span>
              <div><div class="tl-title">${esc(EVENT_LABEL[e.kind]||e.kind)}${e.warehouse?` · ${esc(e.warehouse)}`:''}</div>
              <div class="muted small">${fmtTime(e.at)} · ${esc(e.actorName)}</div></div>
            </li>`).join('')}
          </ol>
        </div>
      </div>
    </div>
  </div>`);
}
function detailActions(x){
  const btns=[];
  if(x.status==='menunggu'&&isAdminAt(x.origin)){
    btns.push(`<button class="btn btn-primary" onclick="issueBarcode('${x.id}','muat',${jsArg(x.origin)})"><i class="bi bi-qr-code"></i> Barcode Muat</button>`);
    btns.push(`<button class="btn btn-ghost" onclick="confirmCancelTransfer('${x.id}')">Batalkan</button>`);
  }
  if(x.status==='jalan'){
    if(isAdminAt(x.destination)) btns.push(`<button class="btn btn-primary" onclick="issueBarcode('${x.id}','bongkar',${jsArg(x.destination)})"><i class="bi bi-qr-code"></i> Barcode Bongkar</button>`);
    if(me.role==='superadmin'||(me.region&&me.region!==x.destination)) btns.push(`<button class="btn btn-ghost" onclick="openStopover('${x.id}')"><i class="bi bi-signpost-split"></i> Barcode Singgah</button>`);
  }
  if(x.status==='singgah'){
    if(isAdminAt(x.currentLocation)) btns.push(`<button class="btn btn-primary" onclick="openContinue('${x.id}')"><i class="bi bi-qr-code"></i> Barcode Lanjut</button>`);
    if(x.currentLocation===x.destination&&isAdminAt(x.destination)) btns.push(`<button class="btn btn-ghost" onclick="issueBarcode('${x.id}','bongkar',${jsArg(x.destination)})">Barcode Bongkar</button>`);
  }
  if(['jalan','singgah'].includes(x.status)&&(me.role==='superadmin'||[x.origin,x.destination,x.currentLocation].includes(me.region)))
    btns.push(`<button class="btn btn-ghost" onclick="openReroute('${x.id}')"><i class="bi bi-sign-turn-right"></i> Alih Tujuan</button>`);
  return btns.length?`<div class="detail-actions">${btns.join('')}</div>`:'';
}
function closeModal(){
  if(_trfPollTimer){ clearInterval(_trfPollTimer); _trfPollTimer=null; }
  if(_trfClockTimer){ clearInterval(_trfClockTimer); _trfClockTimer=null; }
  trfBarcode=null; trfDetailId=null; trfDraft=null;
  setModal('');
  if(document.getElementById('transfer-list')) setContent(renderTransfer());
}

/* ── Singgah: pilih gudang & apakah barang dititipkan ── */
function openStopover(id){
  const x=S.transfers.find(t=>t.id===id); if(!x) return;
  const choices=me.role==='superadmin'?S.regions.filter(r=>r!==x.destination):[me.region];
  const planned=x.stops.find(s=>choices.includes(s));
  setModal(`<div class="modal-bg" onclick="if(event.target===this)openTransferDetail('${x.id}')">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header"><h4>Barcode Singgah</h4><button class="modal-close" onclick="openTransferDetail('${x.id}')"><i class="bi bi-x-lg"></i></button></div>
      <div class="field"><label>Singgah di Gudang</label>
        <select id="so-wh">${choices.map(r=>`<option value="${escAttr(r)}"${r===planned?' selected':''}>${esc(r)}${x.stops.includes(r)?' (rencana)':''}</option>`).join('')}</select></div>
      <div class="field"><label>Barang selama singgah</label>
        <div class="radio-cards">
          <label class="radio-card"><input type="radio" name="so-mode" value="0" checked><span><b>Tetap di sopir</b><small>Sopir istirahat, barang tetap di truk.</small></span></label>
          <label class="radio-card"><input type="radio" name="so-mode" value="1"><span><b>Titipkan di gudang</b><small>Diturunkan sementara. Tidak menambah stok gudang ini.</small></span></label>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="openTransferDetail('${x.id}')">Kembali</button>
        <button class="btn btn-primary" onclick="issueBarcode('${x.id}','singgah_masuk',document.getElementById('so-wh').value,document.querySelector('input[name=so-mode]:checked').value==='1')"><i class="bi bi-qr-code"></i> Tampilkan Barcode</button>
      </div>
    </div></div>`);
}
/* ── Lanjut dari singgah: boleh ganti sopir ── */
function openContinue(id){
  const x=S.transfers.find(t=>t.id===id); if(!x) return;
  const drivers=S.users.filter(u=>u.role==='sopir');
  const titip=x.custody==='titip';
  setModal(`<div class="modal-bg" onclick="if(event.target===this)openTransferDetail('${x.id}')">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header"><h4>Barcode Lanjut</h4><button class="modal-close" onclick="openTransferDetail('${x.id}')"><i class="bi bi-x-lg"></i></button></div>
      <p class="modal-text">Lanjut dari <b>${esc(x.currentLocation)}</b> menuju <b>${esc(x.destination)}</b>.</p>
      <div class="field"><label>Sopir yang melanjutkan</label>
        <select id="ct-driver">
          <option value="">${titip?'Sopir mana pun yang memindai':`Tetap ${esc(x.driverName)}`}</option>
          ${drivers.filter(u=>u.id!==x.driverId).map(u=>`<option value="${escAttr(u.id)}">Ganti ke ${esc(u.name)}</option>`).join('')}
          ${titip&&x.driverId?`<option value="${escAttr(x.driverId)}">${esc(x.driverName)}</option>`:''}
        </select></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="openTransferDetail('${x.id}')">Kembali</button>
        <button class="btn btn-primary" onclick="issueBarcode('${x.id}','singgah_keluar',${jsArg(x.currentLocation)},false,document.getElementById('ct-driver').value)"><i class="bi bi-qr-code"></i> Tampilkan Barcode</button>
      </div>
    </div></div>`);
}
function openReroute(id){
  const x=S.transfers.find(t=>t.id===id); if(!x) return;
  setModal(`<div class="modal-bg" onclick="if(event.target===this)openTransferDetail('${x.id}')">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header"><h4>Alih Tujuan</h4><button class="modal-close" onclick="openTransferDetail('${x.id}')"><i class="bi bi-x-lg"></i></button></div>
      <p class="modal-text">Tujuan sekarang <b>${esc(x.destination)}</b>. Pilih gudang asal untuk mengembalikan barang.</p>
      <div class="field"><label>Tujuan Baru</label><select id="rr-dest">${S.regions.filter(r=>r!==x.destination).map(r=>`<option value="${escAttr(r)}">${esc(r)}${r===x.origin?' (kembali ke asal)':''}</option>`).join('')}</select></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="openTransferDetail('${x.id}')">Kembali</button>
        <button class="btn btn-primary" onclick="submitReroute('${x.id}')">Alihkan</button>
      </div>
    </div></div>`);
}
async function submitReroute(id){
  try{
    await transferReroute(id,document.getElementById('rr-dest').value);
    await loadTransfers();
    showAlert('Tujuan transfer dialihkan');
    openTransferDetail(id);
  }catch(e){ showAlert(e.message,'error'); }
}
function confirmCancelTransfer(id){
  const x=S.transfers.find(t=>t.id===id); if(!x) return;
  showConfirm({ico:'<i class="bi bi-x-circle"></i>',title:'Batalkan Transfer',
    msg:`Batalkan <b>${esc(x.code)}</b>? Barang belum dimuat, jadi stok tidak berubah.`,
    confirmLabel:'Ya, Batalkan',confirmClass:'btn-danger',
    onConfirm:async()=>{
      try{
        await transferCancel(id,'');
        await loadTransfers();
        closeModal();
        showAlert('Transfer dibatalkan');
      }catch(e){ showAlert(e.message,'error'); }
    }});
}

/* ── Barcode: QR + Code128, dipantau sampai sopir memindai ── */
const BARCODE_TEXT={
  muat:{title:'Barcode Muat',hint:'Sopir memindai ini setelah barang naik ke truk. Stok gudang langsung berkurang dan barang tercatat di sopir.'},
  singgah_masuk:{title:'Barcode Singgah',hint:'Sopir memindai ini saat tiba untuk singgah.'},
  singgah_keluar:{title:'Barcode Lanjut',hint:'Sopir memindai ini saat berangkat lagi menuju tujuan.'},
  bongkar:{title:'Barcode Bongkar',hint:'Sopir memindai ini setelah barang diturunkan. Barang langsung masuk stok gudang ini.'}
};
async function issueBarcode(id,kind,warehouse,titip,nextDriver){
  try{
    const r=await transferIssueToken(id,kind,warehouse,titip,nextDriver);
    await loadTransfers();
    const x=S.transfers.find(t=>t.id===id);
    trfBarcode={id,kind,warehouse,titip:!!titip,nextDriver:nextDriver||'',token:r.token,expiresAt:new Date(r.expires_at).getTime(),
      seenEvents:x?x.events.length:0};
    renderBarcodeModal();
    startBarcodeWatch();
  }catch(e){ showAlert(e.message,'error'); }
}
function fmtToken(t){ return t.slice(0,5)+'-'+t.slice(5); }
function renderBarcodeModal(){
  const b=trfBarcode; if(!b) return;
  const x=S.transfers.find(t=>t.id===b.id); if(!x) return;
  const txt=BARCODE_TEXT[b.kind];
  const qr=qrcode(0,'M'); qr.addData(b.token); qr.make();
  setModal(`<div class="modal-bg">
    <div class="modal barcode-modal" onclick="event.stopPropagation()">
      <div class="modal-header"><h4>${txt.title}</h4><button class="modal-close" onclick="backToDetail()"><i class="bi bi-x-lg"></i></button></div>
      <div class="barcode-meta"><span class="mono">${esc(x.code)}</span><span class="muted">${esc(b.warehouse)}</span></div>
      <div class="barcode-paper">
        <div class="qr">${qr.createSvgTag({cellSize:6,margin:0,scalable:true})}</div>
        <svg id="bc-128"></svg>
        <div class="barcode-code mono">${esc(fmtToken(b.token))}</div>
      </div>
      <p class="modal-text">${txt.hint}${b.titip?' Barang dititipkan sementara dan tidak menambah stok gudang ini.':''}</p>
      <div class="barcode-foot">
        <span class="live-dot"></span><span class="muted">Menunggu sopir memindai</span>
        <span class="barcode-timer mono" id="bc-timer"></span>
      </div>
    </div>
  </div>`);
  JsBarcode('#bc-128',b.token,{format:'CODE128',displayValue:false,height:56,margin:0,width:2,lineColor:'#000',background:'#fff'});
  tickBarcodeClock();
}
function tickBarcodeClock(){
  const el=document.getElementById('bc-timer'); if(!el||!trfBarcode) return;
  const left=trfBarcode.expiresAt-Date.now();
  if(left<=0){
    const b=trfBarcode;
    if(_trfClockTimer){ clearInterval(_trfClockTimer); _trfClockTimer=null; }
    if(_trfPollTimer){ clearInterval(_trfPollTimer); _trfPollTimer=null; }
    const paper=document.querySelector('.barcode-paper');
    if(paper) paper.classList.add('expired');
    const foot=document.querySelector('.barcode-foot');
    if(foot) foot.innerHTML=`<span class="muted">Barcode kedaluwarsa</span><button class="btn btn-primary btn-sm" onclick="issueBarcode('${b.id}','${b.kind}',${jsArg(b.warehouse)},${b.titip},${jsArg(b.nextDriver)})">Buat Ulang</button>`;
    return;
  }
  const s=Math.ceil(left/1000);
  el.textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}
function startBarcodeWatch(){
  if(_trfPollTimer) clearInterval(_trfPollTimer);
  if(_trfClockTimer) clearInterval(_trfClockTimer);
  _trfClockTimer=setInterval(tickBarcodeClock,1000);
  _trfPollTimer=setInterval(async()=>{
    if(!trfBarcode||document.hidden) return;
    try{
      await loadTransfers();
      const x=S.transfers.find(t=>t.id===trfBarcode.id);
      if(x&&x.events.length>trfBarcode.seenEvents) barcodeScanned(x);
    }catch(e){ /* coba lagi siklus berikutnya */ }
  },3000);
}
async function barcodeScanned(x){
  const kind=trfBarcode.kind;
  clearInterval(_trfPollTimer); clearInterval(_trfClockTimer); _trfPollTimer=null; _trfClockTimer=null;
  trfBarcode=null;
  await refreshAfterTransfer();
  buildSidebarNav();
  setContent(renderTransfer());
  const y=S.transfers.find(t=>t.id===x.id)||x;
  const lines={muat:`${y.driverName} memuat barang. Stok ${y.origin} sudah berkurang.`,
    singgah_masuk:`${y.driverName} singgah di ${y.currentLocation}.`,
    singgah_keluar:`${y.driverName} melanjutkan perjalanan ke ${y.destination}.`,
    bongkar:`Barang sudah masuk stok ${y.destination}.`};
  setModal(`<div class="modal-bg"><div class="modal scan-done" onclick="event.stopPropagation()">
    <div class="done-ico"><i class="bi bi-check-lg"></i></div>
    <h4>Berhasil dipindai</h4>
    <p class="modal-text">${esc(lines[kind])}</p>
    <div class="route-box">${routeHtml(y)}</div>
    <div class="modal-actions center">
      <button class="btn btn-ghost" onclick="openTransferDetail('${y.id}')">Lihat Detail</button>
      <button class="btn btn-primary" onclick="closeModal()">Selesai</button>
    </div>
  </div></div>`);
}
function backToDetail(){
  const id=trfBarcode&&trfBarcode.id;
  if(_trfPollTimer){ clearInterval(_trfPollTimer); _trfPollTimer=null; }
  if(_trfClockTimer){ clearInterval(_trfClockTimer); _trfClockTimer=null; }
  trfBarcode=null;
  if(id) openTransferDetail(id); else closeModal();
}
