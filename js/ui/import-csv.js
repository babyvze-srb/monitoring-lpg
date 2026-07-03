/* ===== IMPORT CSV & GRID PASTE (mirip Excel) ===== */
let importRows=[];
let importMode='file'; // 'file' atau 'grid'
let gridData=[]; // array of arrays of string, 9 kolom per baris
const GRID_COLS=['type','tanggal','region','no_sj','pihak','tabung','status','qty','keterangan'];
const GRID_COL_LABEL={type:'Tipe',tanggal:'Tanggal',region:'Region',no_sj:'No. SJ',pihak:'Pihak',tabung:'Tabung',status:'Status',qty:'QTY',keterangan:'Keterangan'};
const GRID_MIN_ROWS=8;

function renderImport(){
  const regs=S.regions||REGIONS;
  return `
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">📋 Panduan Format Data</div>
    <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Data harus menggunakan kolom berikut:</p>
    <div style="overflow-x:auto">
      <table class="riwayat-tbl">
        <tr><th>Kolom</th><th>Wajib</th><th>Nilai yang Diterima</th><th>Contoh</th></tr>
        <tr><td><code style="background:rgba(249,115,22,.1);color:var(--accent);padding:1px 6px;border-radius:3px">type</code></td><td><span style="color:#10b981">✅ Ya</span></td><td><code>masuk</code> atau <code>keluar</code></td><td>masuk</td></tr>
        <tr><td><code style="background:rgba(249,115,22,.1);color:var(--accent);padding:1px 6px;border-radius:3px">tanggal</code></td><td><span style="color:#10b981">✅ Ya</span></td><td>Format YYYY-MM-DD</td><td>2026-06-01</td></tr>
        <tr><td><code style="background:rgba(249,115,22,.1);color:var(--accent);padding:1px 6px;border-radius:3px">region</code></td><td><span style="color:#10b981">✅ Ya</span></td><td>${regs.map(r=>`<code style="background:rgba(59,130,246,.1);color:#60a5fa;padding:1px 6px;border-radius:3px">${esc(r)}</code>`).join(', ')}</td><td>—</td></tr>
        <tr><td><code style="background:rgba(249,115,22,.1);color:var(--accent);padding:1px 6px;border-radius:3px">tabung</code></td><td><span style="color:#10b981">✅ Ya</span></td><td><code>50 KG</code>, <code>12 KG</code>, <code>5.5 KG</code></td><td>12 KG</td></tr>
        <tr><td><code style="background:rgba(249,115,22,.1);color:var(--accent);padding:1px 6px;border-radius:3px">status</code></td><td><span style="color:#10b981">✅ Ya</span></td><td><code>ISI</code>, <code>KOSONG</code>, <code>BOCOR</code></td><td>ISI</td></tr>
        <tr><td><code style="background:rgba(249,115,22,.1);color:var(--accent);padding:1px 6px;border-radius:3px">qty</code></td><td><span style="color:#10b981">✅ Ya</span></td><td>Angka bulat positif</td><td>100</td></tr>
        <tr><td><code style="background:rgba(249,115,22,.1);color:var(--accent);padding:1px 6px;border-radius:3px">no_sj</code></td><td><span style="color:#eab308">⬜ Opsional</span></td><td>Teks bebas</td><td>SJ-001</td></tr>
        <tr><td><code style="background:rgba(249,115,22,.1);color:var(--accent);padding:1px 6px;border-radius:3px">pihak</code></td><td><span style="color:#eab308">⬜ Opsional</span></td><td>Teks bebas</td><td>PT Pertamina</td></tr>
        <tr><td><code style="background:rgba(249,115,22,.1);color:var(--accent);padding:1px 6px;border-radius:3px">keterangan</code></td><td><span style="color:#eab308">⬜ Opsional</span></td><td>Teks bebas</td><td>Pengiriman rutin</td></tr>
      </table>
    </div>
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-ghost btn-sm" onclick="downloadContohCSV()">⬇ Download Contoh CSV</button>
      <span style="font-size:11px;color:var(--muted)">Region tersedia: ${regs.map(r=>`<b style="color:var(--text)">${esc(r)}</b>`).join(', ')}</span>
    </div>
  </div>

  <div class="card">
    <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <span>📂 Tambah Data</span>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <div class="field" style="margin:0">
          <select id="import-region-filter" style="padding:6px 10px;font-size:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text)">
            <option value="">Semua Region</option>
            ${regs.map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="margin:0">
          <select id="import-type-filter" style="padding:6px 10px;font-size:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text)">
            <option value="">Semua Tipe</option>
            <option value="masuk">📥 Masuk</option>
            <option value="keluar">📤 Keluar</option>
          </select>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:6px;margin-bottom:14px;border-bottom:1px solid var(--border)">
      <button class="import-tab-btn" id="tab-btn-file" onclick="switchImportMode('file')"
        style="padding:8px 14px;font-size:13px;background:none;border:none;border-bottom:2px solid var(--accent);color:var(--text);cursor:pointer;font-weight:600">
        📄 Upload File CSV
      </button>
      <button class="import-tab-btn" id="tab-btn-grid" onclick="switchImportMode('grid')"
        style="padding:8px 14px;font-size:13px;background:none;border:none;border-bottom:2px solid transparent;color:var(--muted);cursor:pointer;font-weight:600">
        📋 Paste dari Excel/Spreadsheet
      </button>
      <button class="import-tab-btn" id="tab-btn-mekari" onclick="switchImportMode('mekari')"
        style="padding:8px 14px;font-size:13px;background:none;border:none;border-bottom:2px solid transparent;color:var(--muted);cursor:pointer;font-weight:600">
        📊 Import Mekari (Penjualan)
      </button>
    </div>

    <div id="import-mode-file">
      <div id="import-dropzone"
        onclick="document.getElementById('csv-file-input').click()"
        ondragover="event.preventDefault();this.style.borderColor='var(--accent)'"
        ondragleave="this.style.borderColor='var(--border)'"
        ondrop="event.preventDefault();this.style.borderColor='var(--border)';handleCSVDrop(event)">
        <div style="font-size:32px;margin-bottom:8px">📄</div>
        <p style="color:var(--muted);font-size:13px">Klik atau drag & drop file CSV di sini</p>
        <p style="color:var(--muted);font-size:11px;margin-top:4px">Format: .csv, maksimal 5MB</p>
      </div>
      <input type="file" id="csv-file-input" accept=".csv" style="display:none" onchange="handleCSVFile(this)">
    </div>

    <div id="import-mode-grid" style="display:none">
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
        Klik sebuah sel lalu <code>Ctrl+V</code> untuk paste dari Excel/Google Sheets — bisa paste 1 sel, 1 kolom, 1 baris, atau seluruh tabel sekaligus (otomatis menyebar dari sel yang diklik). Kolom <b>Tipe, Region, Tabung, Status</b> berupa dropdown: klik untuk memilih dari daftar, atau langsung paste — nilainya akan otomatis dicocokkan ke opsi yang sesuai. Navigasi pakai <code>Tab</code> / <code>Enter</code> / tombol arah / <code>Esc</code>.
      </p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button class="btn btn-ghost btn-sm" onclick="gridAddRow()">➕ Tambah Baris</button>
        <button class="btn btn-ghost btn-sm" onclick="gridAddRows(10)">➕ Tambah 10 Baris</button>
        <button class="btn btn-primary btn-sm" onclick="processGridData()">✅ Proses Data</button>
        <button class="btn btn-ghost btn-sm" onclick="gridClear()">✖ Bersihkan</button>
      </div>
      <div id="paste-grid-wrap" style="overflow:auto;border:1px solid var(--border);border-radius:8px;max-height:420px"></div>
    </div>

    <div id="import-mode-mekari" style="display:none">
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px;line-height:1.6">Unggah file <b>.xlsx</b> (atau .csv) hasil ekspor <b>Mekari Jurnal</b> (penjualan). Baris <b>Pajak</b> diabaikan otomatis; baris <b>ISI</b> & <b>TABUNG</b> pada SJ + jenis yang sama digabung — <b>ISI − TABUNG = tabung balik</b> (sisanya Beli Isi + Tabung tanpa balik). Semua dicatat sebagai <b>Penjualan (status ISI)</b>.</p>
      <p style="font-size:11px;color:var(--muted);margin-bottom:8px">🏬 Gudang/region dideteksi otomatis dari prefix No. SJ: <b>Tob</b>→Tobelo, <b>Halte</b>→Weda, <b>Haltim</b>→Kalinof, <b>Jll</b>→Jailolo, <b>Sff</b>→Sofifi. Prefix lain (mis. <b>SJ…</b>) memakai Region Default di bawah. Region baru ditambahkan otomatis.</p>
      <div class="form-grid" style="margin-bottom:10px">
        <div class="field"><label>Region Default <span style="color:var(--muted);font-weight:400;text-transform:none">(untuk SJ tak dikenal)</span></label>
          <select id="mekari-region">${regs.map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('')}</select>
        </div>
      </div>
      <div id="mekari-dropzone" onclick="document.getElementById('mekari-file-input').click()"
        ondragover="event.preventDefault();this.style.borderColor='var(--accent)'"
        ondragleave="this.style.borderColor='var(--border)'"
        ondrop="event.preventDefault();this.style.borderColor='var(--border)';handleMekariDrop(event)"
        style="border:2px dashed var(--border);border-radius:10px;padding:26px;text-align:center;cursor:pointer">
        <div style="font-size:32px;margin-bottom:8px">📊</div>
        <p style="color:var(--muted);font-size:13px">Klik atau drag &amp; drop file Excel Mekari di sini</p>
        <p style="color:var(--muted);font-size:11px;margin-top:4px">Format: .xlsx / .xls / .csv</p>
      </div>
      <input type="file" id="mekari-file-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleMekariFile(this)">
      <div id="mekari-result" style="margin-top:16px"></div>
    </div>

    <div id="import-preview" style="display:none;margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div id="import-summary" style="font-size:13px;color:var(--text)"></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="resetImport()">✖ Batal</button>
          <button class="btn btn-primary btn-sm" id="btn-import-confirm" onclick="confirmImport()">✅ Import Data Valid</button>
        </div>
      </div>
      <div id="import-error-list" style="margin-bottom:10px"></div>
      <div class="monitor-wrap">
        <table class="riwayat-tbl" id="import-preview-tbl">
          <tr><th>#</th><th>Status</th><th>Tipe</th><th>Tanggal</th><th>Region</th><th>No.SJ</th><th>Pihak</th><th>Tabung</th><th>Status Tab</th><th>QTY</th><th>Keterangan</th></tr>
        </table>
      </div>
    </div>

    <div id="import-result" style="display:none;margin-top:16px"></div>
  </div>`;
}

function switchImportMode(mode){
  importMode=mode;
  const tabs={file:'tab-btn-file',grid:'tab-btn-grid',mekari:'tab-btn-mekari'};
  const panels={file:'import-mode-file',grid:'import-mode-grid',mekari:'import-mode-mekari'};
  Object.keys(panels).forEach(m=>{
    const p=document.getElementById(panels[m]); if(p) p.style.display=(m===mode)?'block':'none';
    const b=document.getElementById(tabs[m]);
    if(b){ b.style.borderBottomColor=(m===mode)?'var(--accent)':'transparent'; b.style.color=(m===mode)?'var(--text)':'var(--muted)'; }
  });
  if(mode==='grid'){ if(!gridData.length) gridInit(); renderGrid(); }
  resetImport();
}

/* ===== GRID PASTE (mirip Excel) ===== */
function gridInit(){
  gridData=Array.from({length:GRID_MIN_ROWS},()=>GRID_COLS.map(()=>''));
}

function gridAddRow(){
  gridData.push(GRID_COLS.map(()=>''));
  renderGrid();
}
function gridAddRows(n){
  for(let i=0;i<n;i++) gridData.push(GRID_COLS.map(()=>''));
  renderGrid();
}
function gridClear(){
  gridInit();
  renderGrid();
  resetImport();
}
function gridRemoveRow(r){
  gridData.splice(r,1);
  if(gridData.length<GRID_MIN_ROWS) gridData.push(GRID_COLS.map(()=>''));
  renderGrid();
}

// Opsi dropdown per kolom (kolom yang tidak ada di sini dirender sebagai input teks biasa)
function gridOptionsFor(col){
  const regs=S.regions||REGIONS;
  if(col==='type') return [{v:'masuk',label:'📥 Masuk'},{v:'keluar',label:'📤 Keluar'}];
  if(col==='status') return STATUSES.map(s=>({v:s,label:s}));
  if(col==='tabung') return TABUNGS.map(t=>({v:t,label:t}));
  if(col==='region') return regs.map(r=>({v:r,label:r}));
  return null;
}

function renderGrid(){
  const wrap=document.getElementById('paste-grid-wrap');
  if(!wrap) return;
  let html=`<table style="border-collapse:collapse;width:100%;font-size:12px">
    <thead><tr>
      <th style="position:sticky;top:0;background:var(--surface2);border:1px solid var(--border);padding:6px;color:var(--muted);font-size:10px;width:26px"></th>
      ${GRID_COLS.map(c=>`<th style="position:sticky;top:0;background:var(--surface2);border:1px solid var(--border);padding:6px 8px;color:var(--text);text-align:left;white-space:nowrap">${GRID_COL_LABEL[c]}</th>`).join('')}
      <th style="position:sticky;top:0;background:var(--surface2);border:1px solid var(--border);padding:6px;width:26px"></th>
    </tr></thead><tbody>`;
  gridData.forEach((row,r)=>{
    html+=`<tr>
      <td style="border:1px solid var(--border);padding:0;text-align:center;color:var(--muted);font-size:10px;background:var(--surface)">${r+1}</td>`;
    GRID_COLS.forEach((col,c)=>{
      const val=(row[c]||'').replace(/"/g,'&quot;');
      const opts=gridOptionsFor(col);
      let cellInner;
      if(opts){
        cellInner=gridDropdownHtml(r,c,col,row[c]||'',opts);
      } else if(col==='tanggal'){
        cellInner=`<input data-r="${r}" data-c="${c}" class="grid-cell" type="text" placeholder="YYYY-MM-DD" value="${val}"
          oninput="gridSetVal(this)" onpaste="gridHandlePaste(event,this)" onkeydown="gridKeyNav(event,this)" style="${gridCellStyle()}">`;
      } else if(col==='qty'){
        cellInner=`<input data-r="${r}" data-c="${c}" class="grid-cell" type="text" placeholder="0" value="${val}"
          oninput="gridSetVal(this)" onpaste="gridHandlePaste(event,this)" onkeydown="gridKeyNav(event,this)" style="${gridCellStyle()}">`;
      } else {
        cellInner=`<input data-r="${r}" data-c="${c}" class="grid-cell" type="text" value="${val}"
          oninput="gridSetVal(this)" onpaste="gridHandlePaste(event,this)" onkeydown="gridKeyNav(event,this)" style="${gridCellStyle()}">`;
      }
      html+=`<td style="border:1px solid var(--border);padding:0;position:relative">${cellInner}</td>`;
    });
    html+=`<td style="border:1px solid var(--border);padding:0;text-align:center">
      <button onclick="gridRemoveRow(${r})" title="Hapus baris" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:13px;padding:4px 6px">✖</button>
    </td></tr>`;
  });
  html+=`</tbody></table>`;
  wrap.innerHTML=html;
}

/* ===== Custom dropdown (berbasis input, jadi tetap menerima paste) ===== */
function gridDropdownHtml(r,c,col,value,opts){
  const match=opts.find(o=>o.v.toLowerCase()===String(value).toLowerCase());
  const displayVal=(match?match.label:value)||'';
  const isInvalid=value && !match;
  return `<div class="grid-dd" data-r="${r}" data-c="${c}" data-col="${col}" style="position:relative">
    <input data-r="${r}" data-c="${c}" data-col="${col}" class="grid-cell grid-dd-input" type="text"
      autocomplete="off" value="${displayVal.replace(/"/g,'&quot;')}"
      placeholder="Pilih atau paste..."
      oninput="gridSetVal(this)"
      onpaste="gridHandlePaste(event,this)"
      onkeydown="gridDdKeyNav(event,this)"
      onfocus="gridOpenDropdown(this)"
      onclick="gridOpenDropdown(this)"
      style="${gridCellStyle()}padding-right:24px;cursor:pointer;${isInvalid?'color:#ef4444':''}">
    <span style="position:absolute;right:7px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--muted);font-size:9px">▾</span>
  </div>`;
}

function gridCellStyle(){
  return 'width:100%;min-width:90px;border:none;outline:none;background:transparent;color:var(--text);padding:6px 8px;font-size:12px;font-family:inherit;box-sizing:border-box';
}

function gridSetVal(el){
  const r=+el.dataset.r, c=+el.dataset.c;
  gridData[r][c]=el.value;
}

function gridCloseDropdown(){
  const panel=document.getElementById('grid-dd-panel');
  if(panel) panel.remove();
}

function gridOpenDropdown(el){
  gridCloseDropdown();
  const col=el.dataset.col;
  const opts=gridOptionsFor(col);
  if(!opts) return;
  const r=+el.dataset.r, c=+el.dataset.c;
  const query=(el.value||'').toLowerCase();
  const filtered=query?opts.filter(o=>o.label.toLowerCase().includes(query)||o.v.toLowerCase().includes(query)):opts;
  const rect=el.getBoundingClientRect();
  const panel=document.createElement('div');
  panel.id='grid-dd-panel';
  panel.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.bottom+2}px;min-width:${Math.max(rect.width,120)}px;
    background:var(--surface2);border:1px solid var(--accent);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.35);
    z-index:99999;max-height:220px;overflow-y:auto;padding:4px`;
  if(!filtered.length){
    panel.innerHTML=`<div style="padding:8px 10px;color:var(--muted);font-size:11px">Tidak ada hasil — nilai bebas akan diperiksa saat "Proses Data"</div>`;
  } else {
    panel.innerHTML=filtered.map(o=>`
      <div class="grid-dd-opt" data-val="${o.v.replace(/"/g,'&quot;')}" data-label="${o.label.replace(/"/g,'&quot;')}"
        style="padding:7px 10px;border-radius:6px;cursor:pointer;color:var(--text);font-size:12px;white-space:nowrap"
        onmouseenter="this.style.background='rgba(249,115,22,.15)'" onmouseleave="this.style.background='transparent'"
        onmousedown="event.preventDefault();gridPickOption(${r},${c},'${col}',this.dataset.val,this.dataset.label)">${o.label}</div>
    `).join('');
  }
  document.body.appendChild(panel);
  setTimeout(()=>{ document.addEventListener('mousedown',gridDdOutsideClick); },0);
}

function gridDdOutsideClick(e){
  const panel=document.getElementById('grid-dd-panel');
  if(panel && !panel.contains(e.target) && !e.target.classList.contains('grid-dd-input')){
    gridCloseDropdown();
    document.removeEventListener('mousedown',gridDdOutsideClick);
  }
}

function gridPickOption(r,c,col,val,label){
  gridData[r][c]=val;
  gridCloseDropdown();
  document.removeEventListener('mousedown',gridDdOutsideClick);
  renderGrid();
  focusCell(r,c);
}

function gridDdKeyNav(e,el){
  if(e.key==='Escape'){ gridCloseDropdown(); return; }
  if(e.key==='Enter'){
    const col=el.dataset.col;
    const opts=gridOptionsFor(col);
    const match=opts.find(o=>o.v.toLowerCase()===el.value.toLowerCase()||o.label.toLowerCase()===el.value.toLowerCase());
    if(match){ const r=+el.dataset.r,c=+el.dataset.c; gridData[r][c]=match.v; }
    gridCloseDropdown();
  }
  gridKeyNav(e,el);
}

// Tempel mulai dari sel yang diklik, menyebar ke kanan/bawah sesuai bentuk data yang dipaste.
// Untuk sel dropdown (type/region/tabung/status), nilai yang ditempel dicocokkan otomatis ke opsi resmi
// (case-insensitive), supaya hasil copy-paste dari Excel tetap rapi tanpa perlu klik dropdown manual.
function gridHandlePaste(e,el){
  e.preventDefault();
  gridCloseDropdown();
  const text=(e.clipboardData||window.clipboardData).getData('text').replace(/\r/g,'');
  if(!text) return;
  const lines=text.split('\n');
  while(lines.length>1 && lines[lines.length-1]==='') lines.pop();
  const matrix=lines.map(l=>l.split('\t'));
  const startR=+el.dataset.r, startC=+el.dataset.c;
  const setCell=(r,c,rawVal)=>{
    const col=GRID_COLS[c];
    const opts=gridOptionsFor(col);
    let v=rawVal.trim();
    if(opts){
      const match=opts.find(o=>o.v.toLowerCase()===v.toLowerCase()||o.label.toLowerCase()===v.toLowerCase());
      if(match) v=match.v;
    }
    gridData[r][c]=v;
  };
  // Jika cuma 1 sel (tanpa tab/newline), cukup isi sel ini saja seperti ketik manual.
  if(matrix.length===1 && matrix[0].length===1){
    setCell(startR,startC,matrix[0][0]);
    renderGrid();
    focusCell(startR,startC);
    return;
  }
  const neededRows=startR+matrix.length;
  while(gridData.length<neededRows) gridData.push(GRID_COLS.map(()=>''));
  matrix.forEach((rowVals,ri)=>{
    rowVals.forEach((v,ci)=>{
      const targetC=startC+ci;
      if(targetC<GRID_COLS.length) setCell(startR+ri,targetC,v);
    });
  });
  renderGrid();
  focusCell(Math.min(startR+matrix.length-1,gridData.length-1), Math.min(startC+matrix[0].length-1,GRID_COLS.length-1));
}

function focusCell(r,c){
  setTimeout(()=>{
    const el=document.querySelector(`.grid-cell[data-r="${r}"][data-c="${c}"]`);
    if(el){ el.focus(); if(el.select) el.select(); }
  },0);
}

function gridKeyNav(e,el){
  const r=+el.dataset.r, c=+el.dataset.c;
  let nr=r, nc=c;
  if(e.key==='Tab'){ e.preventDefault(); gridCloseDropdown(); nc=e.shiftKey?c-1:c+1; if(nc<0){nc=GRID_COLS.length-1;nr=r-1;} if(nc>=GRID_COLS.length){nc=0;nr=r+1;} }
  else if(e.key==='Enter'){ e.preventDefault(); gridCloseDropdown(); nr=r+1; if(nr>=gridData.length) gridData.push(GRID_COLS.map(()=>'')); }
  else if(e.key==='ArrowDown'){ e.preventDefault(); gridCloseDropdown(); nr=r+1; if(nr>=gridData.length) gridData.push(GRID_COLS.map(()=>'')); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); gridCloseDropdown(); nr=Math.max(0,r-1); }
  else if(e.key==='ArrowRight'){ if(el.selectionStart!==el.value.length) return; e.preventDefault(); gridCloseDropdown(); nc=Math.min(GRID_COLS.length-1,c+1); }
  else if(e.key==='ArrowLeft'){ if(el.selectionStart!==0) return; e.preventDefault(); gridCloseDropdown(); nc=Math.max(0,c-1); }
  else return;
  renderGrid();
  focusCell(nr,nc);
}

function processGridData(){
  const rows=gridData.filter(row=>row.some(v=>(v||'').trim()!==''));
  if(!rows.length){showAlert('❌ Belum ada data di grid','error');return;}
  const headerLessLines=rows.map(row=>row.map(v=>(v||'').trim()));
  validateAndPreview(GRID_COLS, headerLessLines);
}

/* ===== VALIDASI BERSAMA (CSV & Grid) ===== */
function validateAndPreview(headers, dataLines){
  const required=['type','tanggal','region','tabung','status','qty'];
  const missing=required.filter(r=>!headers.includes(r));
  if(missing.length){showAlert(`❌ Kolom wajib tidak ditemukan: ${missing.join(', ')}`,'error');return;}
  const validRegions=S.regions||REGIONS;
  const regFilter=document.getElementById('import-region-filter')?.value||'';
  const typeFilter=document.getElementById('import-type-filter')?.value||'';
  const rows=[];
  dataLines.forEach((vals,i)=>{
    const get=col=>{ const idx=headers.indexOf(col); return idx>=0?(vals[idx]||''):''; };
    const row={
      line:i+1,type:get('type').toLowerCase(),tanggal:get('tanggal'),region:get('region'),
      noSj:get('no_sj'),pihak:get('pihak'),tabung:get('tabung'),status:get('status').toUpperCase(),
      qty:parseInt(get('qty'))||0,ket:get('keterangan'),valid:true,errors:[]
    };
    if(!['masuk','keluar'].includes(row.type)) row.errors.push('type tidak valid');
    if(!row.tanggal.match(/^\d{4}-\d{2}-\d{2}$/)) row.errors.push('tanggal tidak valid (YYYY-MM-DD)');
    if(!validRegions.includes(row.region)) row.errors.push(`region "${row.region}" tidak ditemukan`);
    if(!TABUNGS.includes(row.tabung)) row.errors.push(`tabung "${row.tabung}" tidak valid`);
    if(!STATUSES.includes(row.status)) row.errors.push(`status "${row.status}" tidak valid`);
    if(row.qty<=0) row.errors.push('qty harus > 0');
    if(row.errors.length) row.valid=false;
    row.filteredOut=false;
    if(regFilter && row.region!==regFilter) row.filteredOut=true;
    if(typeFilter && row.type!==typeFilter) row.filteredOut=true;
    rows.push(row);
  });
  importRows=rows;
  const displayed=rows.filter(r=>!r.filteredOut);
  const valid=displayed.filter(r=>r.valid).length;
  const invalid=displayed.filter(r=>!r.valid).length;
  document.getElementById('import-preview').style.display='block';
  document.getElementById('import-summary').innerHTML=
    `<b>Total: ${displayed.length} baris</b>${regFilter?` (Region: <b>${regFilter}</b>)`:''}${typeFilter?` (Tipe: <b>${typeFilter}</b>)`:''}
    &nbsp;|&nbsp;<span style="color:#10b981">✅ Valid: ${valid}</span>&nbsp;|&nbsp;<span style="color:#ef4444">❌ Error: ${invalid}</span>`;
  if(invalid>0){
    const errHtml=displayed.filter(r=>!r.valid).slice(0,5).map(r=>
      `<div style="font-size:11px;color:#ef4444;margin-bottom:3px">⚠️ Baris ${r.line}: ${esc(r.errors.join(', '))}</div>`
    ).join('')+(invalid>5?`<div style="font-size:11px;color:var(--muted)">...dan ${invalid-5} error lainnya</div>`:'');
    document.getElementById('import-error-list').innerHTML=
      `<div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:10px 12px;margin-bottom:10px">${errHtml}</div>`;
  } else { document.getElementById('import-error-list').innerHTML=''; }
  const tblRows=displayed.map(r=>`<tr style="${r.valid?'':'background:rgba(239,68,68,.06)'}">
    <td>${r.line}</td>
    <td>${r.valid?'<span style="color:#10b981">✅</span>':'<span style="color:#ef4444" title="'+escAttr(r.errors.join(', '))+'">❌</span>'}</td>
    <td><span class="badge badge-${esc(r.type)}">${r.type==='masuk'?'📥':'📤'} ${esc(r.type)}</span></td>
    <td>${esc(r.tanggal)}</td><td>${esc(r.region)}</td><td>${esc(r.noSj)||'-'}</td><td>${esc(r.pihak)||'-'}</td>
    <td style="font-size:11px">${esc(r.tabung)}</td>
    <td><span class="badge badge-${esc(String(r.status).toLowerCase())}">${esc(r.status)}</span></td>
    <td><b>${esc(r.qty)}</b></td><td style="font-size:11px">${esc(r.ket)||'-'}</td>
  </tr>`).join('');
  document.getElementById('import-preview-tbl').innerHTML=
    `<tr><th>#</th><th>Status</th><th>Tipe</th><th>Tanggal</th><th>Region</th><th>No.SJ</th><th>Pihak</th><th>Tabung</th><th>Status Tab</th><th>QTY</th><th>Keterangan</th></tr>${tblRows}`;
  document.getElementById('btn-import-confirm').disabled=valid===0;
}

function downloadContohCSV(){
  const regs=S.regions||REGIONS;
  const csv=`type,tanggal,region,no_sj,pihak,tabung,status,qty,keterangan\nmasuk,2026-06-01,${regs[0]||'Ternate'},SJ-001,PT Pertamina,12 KG,ISI,100,Pengiriman rutin\nmasuk,2026-06-02,${regs[1]||'Tobelo'},SJ-002,PT Pertamina,50 KG,ISI,20,\nkeluar,2026-06-03,${regs[0]||'Ternate'},SJ-003,Agen ABC,12 KG,KOSONG,80,Return kosong\nkeluar,2026-06-04,${regs[2]||'Tidore'},,Agen XYZ,5.5 KG,ISI,30,`;
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
  a.download='contoh-import-lpg.csv';
  a.click();
}

function handleCSVDrop(e){ const f=e.dataTransfer.files[0]; if(f)parseCSVFile(f); }
function handleCSVFile(inp){ const f=inp.files[0]; if(f)parseCSVFile(f); inp.value=''; }

/* Deteksi pemisah kolom dari baris header: dukung koma, titik-koma (Excel
   locale Indonesia), atau TAB. Abaikan pemisah di dalam tanda kutip. */
function detectDelimiter(headerLine){
  const counts={',':0,';':0,'\t':0};
  let inQ=false;
  for(const ch of headerLine){
    if(ch==='"'){ inQ=!inQ; continue; }
    if(!inQ && counts[ch]!==undefined) counts[ch]++;
  }
  let best=',', n=-1;
  for(const d of [',',';','\t']){ if(counts[d]>n){ n=counts[d]; best=d; } }
  return n>0 ? best : ',';
}

/* Pecah satu baris CSV menjadi kolom, menghormati tanda kutip ganda
   (termasuk "" sebagai escape kutip di dalam nilai). */
function splitCSVLine(line, delim){
  const out=[]; let cur=''; let inQ=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(inQ){
      if(ch==='"'){ if(line[i+1]==='"'){ cur+='"'; i++; } else inQ=false; }
      else cur+=ch;
    } else {
      if(ch==='"') inQ=true;
      else if(ch===delim){ out.push(cur); cur=''; }
      else cur+=ch;
    }
  }
  out.push(cur);
  return out.map(v=>v.trim());
}

function parseCSVFile(file){
  if(!file.name.toLowerCase().endsWith('.csv')){showAlert('❌ File harus berformat .csv','error');return;}
  if(file.size>5*1024*1024){showAlert('❌ File terlalu besar (maks 5MB)','error');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    // Strip BOM (Excel sering menambahkannya) + normalkan CRLF/CR → LF.
    const text=String(e.target.result).replace(/^﻿/,'').replace(/\r\n?/g,'\n');
    const lines=text.split('\n').filter(l=>l.trim());
    if(lines.length<2){showAlert('❌ File CSV kosong atau tidak valid','error');return;}
    const delim=detectDelimiter(lines[0]);
    const headers=splitCSVLine(lines[0],delim).map(h=>h.trim().toLowerCase());
    const dataLines=lines.slice(1).map(l=>splitCSVLine(l,delim));
    validateAndPreview(headers, dataLines);
  };
  reader.readAsText(file,'UTF-8');
}

function resetImport(){
  importRows=[];
  const pv=document.getElementById('import-preview'); if(pv) pv.style.display='none';
  const el=document.getElementById('import-error-list'); if(el) el.innerHTML='';
  const resultBox=document.getElementById('import-result');
  if(resultBox){ resultBox.style.display='none'; resultBox.innerHTML=''; }
  const mk=document.getElementById('mekari-result'); if(mk) mk.innerHTML='';
  mekariEntries=[];
}

function confirmImport(){
  const regFilter=document.getElementById('import-region-filter')?.value||'';
  const typeFilter=document.getElementById('import-type-filter')?.value||'';
  let validRows=importRows.filter(r=>r.valid&&!r.filteredOut);
  if(!validRows.length){showAlert('❌ Tidak ada data valid untuk diimport','error');return;}
  showConfirm({
    ico:'📂',title:'Konfirmasi Import Data',
    msg:`Akan mengimport <b>${validRows.length} baris</b> data${regFilter?` untuk region <b>${regFilter}</b>`:''}.${typeFilter?`<br>Tipe: <b>${typeFilter}</b>`:''}<br><br>Data ini akan ditambahkan ke database. Lanjutkan?`,
    confirmLabel:'Ya, Import Sekarang',
    confirmClass:'btn-primary',
    onConfirm:doImportCSV
  });
}

async function doImportCSV(){
  const validRows=importRows.filter(r=>r.valid&&!r.filteredOut);
  const results=[]; // {line, row, ok, errorMsg}
  for(const row of validRows){
    try{
      const d=new Date(row.tanggal);
      const tx={id:gid(),type:row.type,region:row.region,tanggal:row.tanggal,noSj:row.noSj,
        pihak:row.pihak,tabung:row.tabung,status:row.status,qty:row.qty,ket:row.ket,
        monthIdx:d.getMonth(),year:d.getFullYear(),createdAt:Date.now()};
      await saveTx(tx);
      S.transactions.push(tx);
      results.push({line:row.line,row,ok:true});
    }catch(e){
      const msg=e?.message || e?.error_description || (typeof e==='string'?e:JSON.stringify(e));
      console.error('Gagal simpan baris import:', row, e);
      results.push({line:row.line,row,ok:false,errorMsg:msg});
    }
  }
  const sukses=results.filter(r=>r.ok).length;
  const gagal=results.filter(r=>!r.ok).length;

  importRows=[];
  document.getElementById('import-preview').style.display='none';

  // Untuk mode grid: hapus baris yang BERHASIL dari grid, sisakan baris yang GAGAL supaya bisa diperbaiki & dicoba lagi.
  if(importMode==='grid'){
    const failedLines=new Set(results.filter(r=>!r.ok).map(r=>r.line));
    // Bangun ulang gridData: hanya baris non-kosong yang gagal, urut sesuai 'line' dari hasil validasi
    const nonEmptyRows=gridData.filter(rowVals=>rowVals.some(v=>(v||'').trim()!==''));
    const keptRows=nonEmptyRows.filter((rowVals,idx)=>failedLines.has(idx+1));
    gridData=keptRows;
    while(gridData.length<GRID_MIN_ROWS) gridData.push(GRID_COLS.map(()=>''));
    renderGrid();
  }

  await writeLog('IMPORT_CSV',`Import ${sukses} transaksi berhasil${gagal>0?', '+gagal+' gagal':''}`);
  renderImportResult(results, sukses, gagal);

  if(gagal===0){
    showAlert(`✅ Import berhasil! ${sukses} transaksi ditambahkan`);
    setTimeout(()=>window.location.href='riwayat.html',1800);
  } else if(sukses===0){
    showAlert(`❌ Import gagal total: 0 dari ${gagal} baris tersimpan`,'error');
  } else {
    showAlert(`⚠️ Import selesai sebagian: ${sukses} berhasil, ${gagal} gagal`,'error');
  }
}

function renderImportResult(results, sukses, gagal){
  const box=document.getElementById('import-result');
  if(!box) return;
  const headerColor = gagal===0 ? '#10b981' : (sukses===0 ? '#ef4444' : '#eab308');
  const headerIcon = gagal===0 ? '✅' : (sukses===0 ? '❌' : '⚠️');
  const headerText = gagal===0
    ? `Semua data berhasil disimpan (${sukses} baris)`
    : sukses===0
      ? `Semua data GAGAL disimpan (${gagal} baris)`
      : `Sebagian berhasil: ${sukses} tersimpan, ${gagal} gagal`;

  const rowsHtml=results.map(r=>{
    const row=r.row;
    if(r.ok){
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border)">
        <span style="color:#10b981;font-size:14px">✅</span>
        <span style="font-size:11px;color:var(--muted);width:46px;flex-shrink:0">Baris ${row.line}</span>
        <span style="font-size:12px;color:var(--text);flex:1">
          <span class="badge badge-${esc(row.type)}">${row.type==='masuk'?'📥':'📤'} ${esc(row.type)}</span>
          &nbsp;${esc(row.tanggal)} • ${esc(row.region)} • ${esc(row.tabung)} • ${esc(row.status)} • Qty <b>${esc(row.qty)}</b>
        </span>
        <span style="font-size:11px;color:#10b981">Tersimpan</span>
      </div>`;
    }
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);background:rgba(239,68,68,.06)">
      <span style="color:#ef4444;font-size:14px">❌</span>
      <span style="font-size:11px;color:var(--muted);width:46px;flex-shrink:0">Baris ${row.line}</span>
      <span style="font-size:12px;color:var(--text);flex:1">
        <span class="badge badge-${esc(row.type)}">${row.type==='masuk'?'📥':'📤'} ${esc(row.type)}</span>
        &nbsp;${esc(row.tanggal)} • ${esc(row.region)} • ${esc(row.tabung)} • ${esc(row.status)} • Qty <b>${esc(row.qty)}</b>
        <div style="font-size:11px;color:#ef4444;margin-top:2px">⚠️ ${esc(r.errorMsg)||'Gagal tidak diketahui'}</div>
      </span>
    </div>`;
  }).join('');

  box.style.display='block';
  box.innerHTML=`
    <div class="card" style="border:1px solid ${headerColor}55">
      <div class="card-title" style="display:flex;align-items:center;gap:8px;color:${headerColor}">
        <span>${headerIcon} Hasil Import — ${headerText}</span>
      </div>
      <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:8px;max-height:360px;overflow-y:auto">
        ${rowsHtml}
      </div>
      ${gagal>0?`<p style="font-size:11px;color:var(--muted);margin-top:10px">
        Baris yang gagal ${importMode==='grid'?'masih ada di grid di atas — perbaiki lalu klik "✅ Proses Data" kembali untuk mencoba lagi.':'tidak otomatis dicoba ulang — perbaiki sumber datanya lalu import ulang.'}
      </p>`:''}
    </div>`;
}

/* ===== IMPORT MEKARI JURNAL (Excel/CSV penjualan) ===== */
let mekariEntries = [];

function mekariNormSj(v){ return String(v==null?'':v).replace(/\s+/g,' ').trim(); }

function mekariParseDate(v){
  if(v instanceof Date && !isNaN(v)){ return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`; }
  const s=String(v==null?'':v).replace(/\s+/g,' ').trim();
  let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);            // DD/MM/YYYY
  if(m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);                  // YYYY-MM-DD
  if(m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  return '';
}

/* "BRIGHT GAS ISI 5.5 KG" → {kind:'isi',tabung:'5.5 KG'}; "Pajak" → null */
function mekariParseProduk(v){
  const s=String(v==null?'':v).toUpperCase();
  const m=s.match(/(ISI|TABUNG)\s+([\d.,]+)\s*KG/);
  if(!m) return null;
  const kind=m[1]==='ISI'?'isi':'tabung';
  const num=parseFloat(m[2].replace(',','.'));
  const tabung=TABUNGS.find(t=>parseFloat(t)===num);
  if(!tabung) return null;
  return { kind, tabung };
}

/* rows = array-of-arrays (baris 0 = header). Gabung ISI+TABUNG per SJ+jenis,
   ISI − TABUNG = tabung balik (Beli Isi), sisanya Beli Isi + Tabung. */
function mekariBuildEntries(rows, region){
  const header=(rows[0]||[]).map(h=>String(h==null?'':h).trim().toLowerCase());
  const ci=n=>header.indexOf(n);
  const iTgl=ci('tanggal'), iPel=ci('pelanggan'), iNo=ci('no'), iProduk=ci('produk'), iQty=ci('kuantitas');
  const groups={};
  for(let r=1;r<rows.length;r++){
    const row=rows[r]||[];
    const p=mekariParseProduk(iProduk>=0?row[iProduk]:null);
    if(!p) continue;                                         // Pajak / tak dikenal
    const qty=parseInt(iQty>=0?row[iQty]:0); if(!qty||qty<=0) continue;
    const sj=mekariNormSj(iNo>=0?row[iNo]:'');
    const tgl=mekariParseDate(iTgl>=0?row[iTgl]:'');
    const pihak=String((iPel>=0?row[iPel]:'')==null?'':row[iPel]).replace(/\s+/g,' ').trim();
    const key=sj+'||'+p.tabung;
    if(!groups[key]) groups[key]={sj,tabung:p.tabung,tgl,pihak,isiQty:0,tabungQty:0};
    if(p.kind==='isi') groups[key].isiQty+=qty; else groups[key].tabungQty+=qty;
    if(!groups[key].tgl && tgl) groups[key].tgl=tgl;
    if(!groups[key].pihak && pihak) groups[key].pihak=pihak;
  }
  const entries=[];
  Object.keys(groups).forEach(k=>{
    const g=groups[k];
    if(g.isiQty<=0) return;                                  // penjualan hanya isi
    const withTabung=Math.min(g.tabungQty,g.isiQty);         // Beli Isi + Tabung (tanpa balik)
    const isiOnly=g.isiQty-withTabung;                       // Beli Isi (ada tabung balik)
    if(isiOnly>0)    entries.push(mekariMakeEntry(g,'isi',isiOnly,region));
    if(withTabung>0) entries.push(mekariMakeEntry(g,'isi_tabung',withTabung,region));
  });
  return entries;
}

/* Gudang penerbit barang dideteksi dari prefix No. SJ. */
const MEKARI_REGION_PREFIX=[
  {p:'TOB',    region:'Tobelo'},
  {p:'HALTIM', region:'Kalinof'},
  {p:'HALTE',  region:'Weda'},
  {p:'JLL',    region:'Jailolo'},
  {p:'SFF',    region:'Sofifi'},
];
function mekariRegionFromSj(sj){
  const s=String(sj||'').toUpperCase().replace(/\s+/g,'');
  for(let i=0;i<MEKARI_REGION_PREFIX.length;i++){
    if(s.startsWith(MEKARI_REGION_PREFIX[i].p)) return MEKARI_REGION_PREFIX[i].region;
  }
  return null;   // prefix tak dikenal (mis. "SJ…") → pakai region default
}

function mekariMakeEntry(g,purchaseType,qty,fallbackRegion){
  const matched=mekariRegionFromSj(g.sj);
  const region=matched||fallbackRegion;
  const e={tgl:g.tgl,sj:g.sj,pihak:g.pihak,tabung:g.tabung,region,regionFromSj:!!matched,purchaseType,qty,errors:[]};
  if(!e.sj) e.errors.push('No SJ kosong');
  if(!e.tgl) e.errors.push('Tanggal tidak valid');
  if(!e.pihak) e.errors.push('Customer kosong');
  if(!TABUNGS.includes(e.tabung)) e.errors.push('Jenis tabung tidak dikenal');
  if(!e.qty||e.qty<=0) e.errors.push('Qty tidak valid');
  /* SJ tidak boleh sama bila barang (tabung) sama — cek ke data sistem. */
  e.dup=S.transactions.some(t=>t.type==='keluar'&&t.saleType==='penjualan'&&t.noSj===e.sj&&t.tabung===e.tabung);
  if(e.dup) e.errors.push('SJ + jenis tabung sudah ada');
  e.valid=e.errors.length===0;
  return e;
}

function handleMekariDrop(ev){ const f=ev.dataTransfer.files[0]; if(f) parseMekariFile(f); }
function handleMekariFile(inp){ const f=inp.files[0]; if(f) parseMekariFile(f); inp.value=''; }

function parseMekariFile(file){
  const region=(document.getElementById('mekari-region')||{}).value||'';
  if(!region){ showAlert('❌ Pilih Region Tujuan dulu','error'); return; }
  if(typeof XLSX==='undefined'){ showAlert('❌ Pustaka Excel belum termuat. Refresh halaman.','error'); return; }
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
      mekariEntries=mekariBuildEntries(rows,region);
      renderMekariPreview(region);
    }catch(err){ console.error(err); showAlert('❌ Gagal membaca file: '+(err.message||err),'error'); }
  };
  reader.readAsArrayBuffer(file);
}

function renderMekariPreview(region){
  const box=document.getElementById('mekari-result'); if(!box) return;
  if(!mekariEntries.length){ box.innerHTML=`<div class="alert alert-info">Tidak ada baris penjualan terbaca dari file.</div>`; return; }
  const valid=mekariEntries.filter(e=>e.valid).length;
  const invalid=mekariEntries.length-valid;
  const totIsi=mekariEntries.filter(e=>e.valid&&e.purchaseType==='isi').reduce((a,e)=>a+e.qty,0);
  const totTab=mekariEntries.filter(e=>e.valid&&e.purchaseType==='isi_tabung').reduce((a,e)=>a+e.qty,0);
  const rows=mekariEntries.map(e=>`<tr style="${e.valid?'':'background:rgba(239,68,68,.06)'}">
    <td>${e.valid?'<span style="color:#10b981">✅</span>':`<span style="color:#ef4444" title="${escAttr(e.errors.join(', '))}">❌</span>`}</td>
    <td>${esc(e.tgl)||'-'}</td>
    <td style="font-size:11px">${esc(e.sj)||'-'}</td>
    <td style="font-size:11px">${esc(e.pihak)||'-'}</td>
    <td style="font-size:11px">${esc(e.region)}${e.regionFromSj?'':' <span style="color:var(--warn);font-size:9px">(default)</span>'}</td>
    <td>${esc(e.tabung)}</td>
    <td><span class="badge ${e.purchaseType==='isi'?'badge-kosong':'badge-isi'}" style="font-size:9px">${e.purchaseType==='isi'?'Beli Isi (balik)':'Isi + Tabung'}</span></td>
    <td><b>${e.qty}</b></td>
    <td style="font-size:10px;color:#ef4444">${esc(e.errors.join(', '))}</td>
  </tr>`).join('');
  box.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <div style="font-size:13px">Region: <b>${esc(region)}</b> &nbsp;·&nbsp; <span style="color:#10b981">✅ ${valid} valid</span> &nbsp;·&nbsp; <span style="color:#ef4444">❌ ${invalid} error</span> &nbsp;·&nbsp; Isi(balik): <b>${totIsi}</b> · Isi+Tabung: <b>${totTab}</b></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="resetImport()">✖ Batal</button>
        <button class="btn btn-primary btn-sm" ${valid===0?'disabled':''} onclick="confirmMekariImport()">✅ Import ${valid} Penjualan</button>
      </div>
    </div>
    <div class="monitor-wrap"><table class="riwayat-tbl">
      <tr><th>Status</th><th>Tanggal</th><th>No.SJ</th><th>Customer</th><th>Region</th><th>Tabung</th><th>Jenis</th><th>Qty</th><th>Catatan</th></tr>
      ${rows}
    </table></div>`;
}

function confirmMekariImport(){
  const valid=mekariEntries.filter(e=>e.valid);
  if(!valid.length){ showAlert('❌ Tidak ada data valid','error'); return; }
  showConfirm({
    ico:'📊', title:'Import Penjualan Mekari',
    msg:`Import <b>${valid.length}</b> baris penjualan ke Barang Keluar?<br><span style="font-size:11px;color:var(--muted)">Semua sebagai Penjualan, status ISI, Belum Terantar.</span>`,
    confirmLabel:'Ya, Import', confirmClass:'btn-primary',
    onConfirm:doMekariImport
  });
}

/* Pastikan region hasil deteksi SJ ada di sistem (auto-tambah bila belum ada). */
async function ensureRegions(names){
  const missing=names.filter(n=>n && !(S.regions||[]).includes(n));
  if(!missing.length) return;
  missing.forEach(n=>S.regions.push(n));
  REGIONS.splice(0,REGIONS.length,...S.regions);
  if(useSupabase){
    const rows=S.regions.map((name,i)=>({name,sort_order:i}));
    try{ await SB.from('lpg_regions').upsert(rows,{onConflict:'name'}); }catch(e){ console.error(e); }
  }
  await writeLog('TAMBAH_REGION','Region baru dari Import Mekari: '+missing.join(', '));
}

async function doMekariImport(){
  const valid=mekariEntries.filter(e=>e.valid);
  await ensureRegions([...new Set(valid.map(e=>e.region))]);
  let ok=0, gagal=0;
  for(const e of valid){
    try{
      const d=new Date(e.tgl);
      const tx={id:gid(),type:'keluar',region:e.region,tanggal:e.tgl,noSj:e.sj,pihak:e.pihak,
        tabung:e.tabung,status:'ISI',qty:e.qty,ket:'Import Mekari',
        monthIdx:d.getMonth(),year:d.getFullYear(),createdAt:Date.now(),
        saleType:'penjualan',purchaseType:e.purchaseType,deliveryStatus:'belum',deliveredQty:0,returnedQty:0,closed:false};
      await saveTx(tx);
      S.transactions.push(tx);
      ok++;
    }catch(err){ console.error('Mekari import gagal:',e,err); gagal++; }
  }
  await writeLog('IMPORT_CSV',`Import Mekari: ${ok} penjualan${gagal?', '+gagal+' gagal':''}`);
  mekariEntries=[];
  const box=document.getElementById('mekari-result');
  if(box) box.innerHTML=`<div class="alert alert-${gagal?'error':'success'}">${gagal?'⚠️':'✅'} Import selesai: ${ok} berhasil${gagal?', '+gagal+' gagal':''}. Cek menu Riwayat / Pengantaran.</div>`;
  showAlert(gagal?`⚠️ ${ok} berhasil, ${gagal} gagal`:`✅ ${ok} penjualan diimport`, gagal?'error':'success');
}
