/* ===== HALAMAN SOPIR — scan barcode & muatan (mobile-first) ===== */
let _scanner=null, _scanBusy=false, _scanResult=null;

function renderSopir(){
  if(!S.schemaV3) return schemaMissingCard();
  return `
  <div class="sopir">
    <div id="scan-panel">${scanPanelHtml()}</div>
    <div id="sopir-lists">${sopirListsHtml()}</div>
    <div id="reader-file" hidden></div>
  </div>`;
}
function updateSopirLists(){
  const el=document.getElementById('sopir-lists');
  if(el) el.innerHTML=sopirListsHtml();
}

function scanPanelHtml(){
  if(_scanResult) return scanResultHtml(_scanResult);
  return `<div class="scan-card">
    <div id="reader" class="reader" hidden></div>
    <div id="scan-idle">
      <button class="scan-btn" onclick="startCameraScan()"><i class="bi bi-qr-code-scan"></i><span>Pindai Barcode</span></button>
    </div>
    <button class="btn btn-ghost btn-block" id="scan-stop" hidden onclick="stopCameraScan()">Tutup Kamera</button>
    <p class="scan-note" id="scan-note" hidden></p>
    <div class="scan-or"><span>atau</span></div>
    <div class="scan-manual">
      <input id="scan-code" placeholder="Masukkan kode barcode" autocomplete="off" autocapitalize="characters" spellcheck="false"
        onkeydown="if(event.key==='Enter')submitManualCode()">
      <button class="btn btn-primary" id="scan-submit" onclick="submitManualCode()">Kirim</button>
    </div>
    <label class="btn btn-ghost btn-block scan-photo"><i class="bi bi-camera"></i> Foto Barcode
      <input type="file" accept="image/*" capture="environment" hidden onchange="scanFromPhoto(this)">
    </label>
  </div>`;
}
function scanResultHtml(r){
  if(!r.ok) return `<div class="scan-card scan-result bad">
    <div class="done-ico"><i class="bi bi-x-lg"></i></div>
    <h4>Gagal</h4><p>${esc(r.message)}</p>
    <button class="btn btn-primary btn-block" onclick="resetScan()">Coba Lagi</button>
  </div>`;
  const x=S.transfers.find(t=>t.id===r.transferId);
  return `<div class="scan-card scan-result ok">
    <div class="done-ico"><i class="bi bi-check-lg"></i></div>
    <h4>Berhasil</h4><p>${esc(r.message)}</p>
    ${x?`<div class="route-box">${routeHtml(x)}</div>`:''}
    <button class="btn btn-primary btn-block" onclick="resetScan()">Selesai</button>
  </div>`;
}
function resetScan(){
  _scanResult=null;
  document.getElementById('scan-panel').innerHTML=scanPanelHtml();
}

/* ── Kamera ── */
function scanNote(msg){
  const n=document.getElementById('scan-note');
  if(n){ n.textContent=msg; n.hidden=!msg; }
}
async function startCameraScan(){
  if(!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)){
    /* Browser memblokir kamera di halaman HTTP selain localhost. */
    scanNote('Kamera hanya bisa dibuka lewat HTTPS. Gunakan Foto Barcode atau masukkan kode.');
    return;
  }
  document.getElementById('scan-idle').hidden=true;
  const rd=document.getElementById('reader'); rd.hidden=false;
  document.getElementById('scan-stop').hidden=false;
  scanNote('');
  try{
    _scanner=new Html5Qrcode('reader',{formatsToSupport:[Html5QrcodeSupportedFormats.QR_CODE,Html5QrcodeSupportedFormats.CODE_128],verbose:false});
    await _scanner.start({facingMode:'environment'},
      {fps:10,qrbox:(w,h)=>{const s=Math.floor(Math.min(w,h)*0.75);return {width:s,height:s};}},
      text=>handleScan(text),()=>{});
  }catch(e){
    await stopCameraScan();
    scanNote('Kamera tidak bisa dibuka. Izinkan akses kamera, atau gunakan Foto Barcode.');
  }
}
async function stopCameraScan(){
  const s=_scanner; _scanner=null;
  if(s){ try{ await s.stop(); s.clear(); }catch(e){} }
  const rd=document.getElementById('reader'); if(rd) rd.hidden=true;
  const idle=document.getElementById('scan-idle'); if(idle) idle.hidden=false;
  const stop=document.getElementById('scan-stop'); if(stop) stop.hidden=true;
}
async function scanFromPhoto(inp){
  const f=inp.files&&inp.files[0]; if(!f) return;
  try{
    const reader=new Html5Qrcode('reader-file',{formatsToSupport:[Html5QrcodeSupportedFormats.QR_CODE,Html5QrcodeSupportedFormats.CODE_128],verbose:false});
    const text=await reader.scanFile(f,false);
    reader.clear();
    await handleScan(text);
  }catch(e){
    scanNote('Barcode tidak terbaca dari foto. Coba foto lebih dekat dan terang.');
  }
  inp.value='';
}
function submitManualCode(){
  const v=(document.getElementById('scan-code')||{}).value||'';
  if(!v.trim()){ scanNote('Masukkan kode barcode terlebih dahulu.'); return; }
  handleScan(v);
}
async function handleScan(code){
  if(_scanBusy) return;
  _scanBusy=true;
  const sb=document.getElementById('scan-submit'); if(sb) sb.disabled=true;
  await stopCameraScan();
  try{
    const r=await transferScan(code);
    await refreshAfterTransfer();
    _scanResult={ok:true,message:r.message,transferId:r.transfer_id};
    if(navigator.vibrate) navigator.vibrate(120);
  }catch(e){
    _scanResult={ok:false,message:e.message};
    if(navigator.vibrate) navigator.vibrate([80,60,80]);
  }
  _scanBusy=false;
  document.getElementById('scan-panel').innerHTML=scanPanelHtml();
  updateSopirLists();
}

/* ── Muatan & tugas ── */
function driverNextStep(x){
  if(x.status==='menunggu') return `Minta barcode muat ke admin ${x.origin}`;
  if(x.status==='singgah') return `Minta barcode lanjut ke admin ${x.currentLocation}`;
  const nextStop=x.stops.find(s=>!x.events.some(e=>e.kind==='singgah_masuk'&&e.warehouse===s));
  if(nextStop) return `Singgah di ${nextStop} atau lanjut ke ${x.destination}. Minta barcode ke admin gudang saat tiba.`;
  return `Minta barcode bongkar ke admin ${x.destination} saat tiba`;
}
function tripCard(x){
  return `<div class="trip">
    <div class="trip-head"><span class="mono">${esc(x.code)}</span>${statusBadge(x)}</div>
    <div class="route-box">${routeHtml(x)}</div>
    <ul class="trip-items">
      ${x.items.map(i=>`<li><span>${esc(i.product)} <span class="muted">${esc(i.status)}</span></span><b>${fmtNum(i.qty)} ${catMeta(i.category).unit}</b></li>`).join('')}
    </ul>
    <div class="trip-next"><i class="bi bi-arrow-right-short"></i>${esc(driverNextStep(x))}</div>
  </div>`;
}
function sopirListsHtml(){
  const mine=S.transfers.filter(x=>x.driverId===me.id);
  const onRoad=mine.filter(x=>['jalan','singgah'].includes(x.status));
  const waiting=mine.filter(x=>x.status==='menunggu');
  const done=mine.filter(x=>x.status==='selesai').slice(0,8);
  const load={};
  onRoad.filter(x=>x.custody==='sopir').forEach(x=>x.items.forEach(i=>{
    const k=i.category+'|'+i.product+'|'+i.status;
    load[k]=load[k]||{...i,qty:0}; load[k].qty+=i.qty;
  }));
  const loadRows=Object.values(load);
  return `
  <div class="section-label">Muatan saya</div>
  ${loadRows.length?`<div class="card card-flush"><ul class="load-list">
    ${loadRows.map(i=>`<li><span>${esc(i.product)} <span class="muted">${esc(i.status)}</span></span><b>${fmtNum(i.qty)} ${catMeta(i.category).unit}</b></li>`).join('')}
  </ul></div>`:`<p class="muted empty-line">Tidak ada barang yang sedang Anda bawa.</p>`}
  ${onRoad.length?`<div class="section-label">Perjalanan</div>${onRoad.map(tripCard).join('')}`:''}
  ${waiting.length?`<div class="section-label">Tugas menunggu dimuat</div>${waiting.map(tripCard).join('')}`:''}
  ${done.length?`<div class="section-label">Riwayat</div><div class="card card-flush"><ul class="load-list">
    ${done.map(x=>`<li><span><span class="mono">${esc(x.code)}</span><div class="muted small">${esc(x.origin)} ke ${esc(x.destination)}</div></span><span class="muted small">${esc(itemsSummary(x))}</span></li>`).join('')}
  </ul></div>`:''}`;
}
