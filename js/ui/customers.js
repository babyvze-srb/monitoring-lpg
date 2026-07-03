/* ===== KELOLA CUSTOMER ===== */
let custSearch='';

function _custTxCount(name){
  return S.transactions.filter(t=>t.type==='keluar' && t.pihak===name).length;
}

function renderCustomers(){
  if(!me) return '';
  if(me.role!=='superadmin') return `<div class="card"><p style="text-align:center;padding:32px;color:var(--muted)">🚫 Hanya Super Admin yang dapat mengelola customer.</p></div>`;
  const q=custSearch.trim().toLowerCase();
  const list=(S.customers||[]).filter(c=>!q ||
    (c.name||'').toLowerCase().includes(q) ||
    (c.phone||'').toLowerCase().includes(q) ||
    (c.address||'').toLowerCase().includes(q)
  ).sort((a,b)=>(a.name||'').localeCompare(b.name||''));

  const rows=list.length?list.map((c,i)=>{
    const n=_custTxCount(c.name);
    return `<tr>
      <td><b>${i+1}</b></td>
      <td><b style="color:var(--text)">${esc(c.name)}</b></td>
      <td>${esc(c.phone)||'-'}</td>
      <td style="font-size:12px">${esc(c.address)||'-'}</td>
      <td>${esc(c.region)||'-'}</td>
      <td style="color:var(--muted)">${n} transaksi</td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-blue btn-sm" onclick="openEditCustomer('${c.id}')">✏️ Edit</button>
        ${n===0?`<button class="btn btn-danger btn-sm" onclick="confirmDeleteCustomer('${c.id}')">🗑 Hapus</button>`:`<span style="font-size:11px;color:var(--muted);padding:5px 4px">Ada transaksi</span>`}
      </div></td>
    </tr>`;
  }).join(''):`<tr><td colspan="7" class="empty"><div class="ico">📭</div>Belum ada customer${q?' yang cocok':''}</td></tr>`;

  return `
  <div class="card">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span>🧑‍🤝‍🧑 Daftar Customer <span style="font-size:11px;color:var(--muted);font-weight:400">(${(S.customers||[]).length})</span></span>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input placeholder="🔍 Cari nama / telp / alamat..." value="${escAttr(custSearch)}" oninput="custSearch=this.value;setContent(renderCustomers())" style="padding:7px 10px;font-size:13px;min-width:200px">
        <button class="btn btn-warn btn-sm" onclick="openImportCustomer()">📤 Upload Customer</button>
        <button class="btn btn-primary btn-sm" onclick="openAddCustomer()">+ Tambah Customer</button>
      </div>
    </div>
    <div class="monitor-wrap">
      <table class="riwayat-tbl">
        <tr><th>#</th><th>Nama</th><th>Telepon</th><th>Alamat</th><th>Region</th><th>Transaksi</th><th>Aksi</th></tr>
        ${rows}
      </table>
    </div>
  </div>
  <div class="alert alert-info">ℹ️ Nama customer di sini muncul sebagai pilihan (autocomplete) saat input <b>Barang Keluar → Penjualan</b>, sehingga semua transaksi sinkron dengan customer yang sama. Customer yang sudah punya transaksi tidak bisa dihapus.</div>`;
}

/* ── Modal tambah ── */
function openAddCustomer(){
  const regOpts=`<option value="">— (opsional) —</option>`+(S.regions||REGIONS).map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('');
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeCustModal()">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header"><h4>🧑‍🤝‍🧑 Tambah Customer</h4><button class="modal-close" onclick="closeCustModal()">✕</button></div>
      <div class="field"><label>Nama Customer <span style="color:var(--danger)">*</span></label><input id="c-name" placeholder="Nama customer..." autofocus></div>
      <div class="form-grid">
        <div class="field"><label>Telepon</label><input id="c-phone" placeholder="08..."></div>
        <div class="field"><label>Region Langganan</label><select id="c-region">${regOpts}</select></div>
      </div>
      <div class="field"><label>Alamat</label><input id="c-address" placeholder="Alamat..."></div>
      <div class="field"><label>Catatan</label><input id="c-note" placeholder="Opsional..."></div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-primary" onclick="submitAddCustomer()">💾 Simpan</button>
        <button class="btn btn-ghost" onclick="closeCustModal()">Batal</button>
      </div>
    </div>
  </div>`);
}
function closeCustModal(){ setModal(''); }

async function submitAddCustomer(){
  const g=id=>(document.getElementById(id)||{}).value||'';
  const name=g('c-name').trim();
  if(!name){ showAlert('❌ Nama customer wajib diisi','error'); return; }
  if((S.customers||[]).some(c=>(c.name||'').toLowerCase()===name.toLowerCase())){ showAlert('❌ Customer dengan nama itu sudah ada','error'); return; }
  const c={ id:gid(), name, phone:g('c-phone').trim(), address:g('c-address').trim(), region:g('c-region'), note:g('c-note').trim() };
  try{ await saveCustomer(c); }catch(e){ showAlert('❌ Gagal simpan: '+(e.message||e),'error'); return; }
  await writeLog('TAMBAH_CUSTOMER',`Customer baru: "${name}"`);
  closeCustModal(); setContent(renderCustomers()); showAlert(`✅ Customer "${esc(name)}" ditambahkan`);
}

/* ── Modal edit ── */
function openEditCustomer(id){
  const c=(S.customers||[]).find(x=>x.id===id); if(!c) return;
  const regOpts=`<option value="">— (opsional) —</option>`+(S.regions||REGIONS).map(r=>`<option value="${escAttr(r)}"${c.region===r?' selected':''}>${esc(r)}</option>`).join('');
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeCustModal()">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header"><h4>✏️ Edit Customer</h4><button class="modal-close" onclick="closeCustModal()">✕</button></div>
      <div class="field"><label>Nama Customer <span style="color:var(--danger)">*</span></label><input id="c-name" value="${escAttr(c.name)}" autofocus></div>
      <p style="font-size:11px;color:var(--muted);margin-bottom:10px">Mengubah nama akan otomatis memperbarui semua transaksi keluar milik customer ini.</p>
      <div class="form-grid">
        <div class="field"><label>Telepon</label><input id="c-phone" value="${escAttr(c.phone)}"></div>
        <div class="field"><label>Region Langganan</label><select id="c-region">${regOpts}</select></div>
      </div>
      <div class="field"><label>Alamat</label><input id="c-address" value="${escAttr(c.address)}"></div>
      <div class="field"><label>Catatan</label><input id="c-note" value="${escAttr(c.note)}"></div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-primary" onclick="submitEditCustomer('${c.id}')">💾 Simpan Perubahan</button>
        <button class="btn btn-ghost" onclick="closeCustModal()">Batal</button>
      </div>
    </div>
  </div>`);
}
async function submitEditCustomer(id){
  const c=(S.customers||[]).find(x=>x.id===id); if(!c) return;
  const g=x=>(document.getElementById(x)||{}).value||'';
  const newName=g('c-name').trim();
  if(!newName){ showAlert('❌ Nama customer wajib diisi','error'); return; }
  if((S.customers||[]).some(x=>x.id!==id && (x.name||'').toLowerCase()===newName.toLowerCase())){ showAlert('❌ Nama customer sudah dipakai','error'); return; }
  const oldName=c.name;
  const upd={ id, name:newName, phone:g('c-phone').trim(), address:g('c-address').trim(), region:g('c-region'), note:g('c-note').trim() };
  try{
    await saveCustomer(upd);
    if(newName!==oldName) await renameCustomer(id,oldName,newName);
  }catch(e){ showAlert('❌ Gagal simpan: '+(e.message||e),'error'); return; }
  await writeLog('EDIT_CUSTOMER',`"${oldName}" → "${newName}"`);
  closeCustModal(); setContent(renderCustomers()); showAlert('✅ Customer diperbarui');
}

function confirmDeleteCustomer(id){
  const c=(S.customers||[]).find(x=>x.id===id); if(!c) return;
  showConfirm({
    ico:'🗑️', title:'Hapus Customer',
    msg:`Yakin hapus customer <b>"${esc(c.name)}"</b>?<br>Tindakan ini tidak bisa dibatalkan.`,
    confirmLabel:'Ya, Hapus', confirmClass:'btn-danger',
    onConfirm:async()=>{
      await deleteCustomerById(id);
      await writeLog('HAPUS_CUSTOMER',`Customer "${c.name}" dihapus`);
      setContent(renderCustomers()); showAlert('🗑️ Customer dihapus');
    }
  });
}

/* ============================================================
   UPLOAD / IMPORT CUSTOMER  (mirip menu Import CSV)
   Kolom: nama (wajib), telepon, alamat, region, catatan.
   Dua cara: upload file .csv, atau paste dari Excel/Spreadsheet.
   ============================================================ */
let custImportRows=[];
let custImpMode='file';

/* ── Header mapping (sinonim → key kanonik) ── */
function custCanonHeader(h){
  const s=String(h||'').trim().toLowerCase();
  if(['nama','name','customer','nama customer'].includes(s)) return 'name';
  if(['telepon','telp','phone','hp','no hp','nomor','no telp','no. telp'].includes(s)) return 'phone';
  if(['alamat','address'].includes(s)) return 'address';
  if(['region','gudang','wilayah'].includes(s)) return 'region';
  if(['catatan','note','keterangan','ket'].includes(s)) return 'note';
  return '';
}
function custDetectDelim(line){
  const counts={',':0,';':0,'\t':0}; let inQ=false;
  for(const ch of line){ if(ch==='"'){inQ=!inQ;continue;} if(!inQ&&counts[ch]!==undefined)counts[ch]++; }
  let best=',',n=-1; for(const d of [',',';','\t']){ if(counts[d]>n){n=counts[d];best=d;} } return n>0?best:',';
}
function custSplitLine(line,delim){
  const out=[];let cur='';let inQ=false;
  for(let i=0;i<line.length;i++){const ch=line[i];
    if(inQ){ if(ch==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else inQ=false; } else cur+=ch; }
    else { if(ch==='"')inQ=true; else if(ch===delim){out.push(cur);cur='';} else cur+=ch; } }
  out.push(cur); return out.map(v=>v.trim());
}
/* Ubah teks (CSV/TSV) → {headers,dataLines}. Header dideteksi otomatis;
   bila tak ada header, dipakai urutan tetap: nama, telepon, alamat, region, catatan. */
function custBuildRows(text){
  const t=String(text).replace(/^﻿/,'').replace(/\r\n?/g,'\n');
  const lines=t.split('\n').filter(l=>l.trim()!=='');
  if(!lines.length) return null;
  const delim=custDetectDelim(lines[0]);
  const first=custSplitLine(lines[0],delim);
  const hasHeader=first.some(c=>custCanonHeader(c)!=='');
  if(hasHeader) return {headers:first.map(custCanonHeader), dataLines:lines.slice(1).map(l=>custSplitLine(l,delim))};
  return {headers:['name','phone','address','region','note'], dataLines:lines.map(l=>custSplitLine(l,delim))};
}

function openImportCustomer(){
  const regs=S.regions||REGIONS;
  const tabBtn=(id,lbl,active)=>`<button id="${id}" onclick="switchCustImportMode('${id==='ci-tab-file'?'file':'paste'}')" style="padding:8px 14px;font-size:13px;background:none;border:none;border-bottom:2px solid ${active?'var(--accent)':'transparent'};color:${active?'var(--text)':'var(--muted)'};cursor:pointer;font-weight:600">${lbl}</button>`;
  custImportRows=[]; custImpMode='file';
  setModal(`<div class="modal-bg" onclick="if(event.target===this)closeCustModal()">
    <div class="modal" onclick="event.stopPropagation()" style="max-width:820px;width:96%">
      <div class="modal-header"><h4>📤 Upload / Import Customer</h4><button class="modal-close" onclick="closeCustModal()">✕</button></div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:8px;line-height:1.6">
        Kolom: <code>nama</code> <span style="color:#10b981">(wajib)</span>, <code>telepon</code>, <code>alamat</code>, <code>region</code>, <code>catatan</code>.
        Region opsional — bila diisi harus salah satu: ${regs.map(r=>`<b style="color:var(--text)">${esc(r)}</b>`).join(', ')||'-'}.
      </p>
      <div style="margin-bottom:10px"><button class="btn btn-ghost btn-sm" onclick="downloadContohCustomerCSV()">⬇ Download Contoh CSV</button></div>
      <div style="display:flex;gap:6px;margin-bottom:14px;border-bottom:1px solid var(--border)">
        ${tabBtn('ci-tab-file','📄 Upload File CSV',true)}
        ${tabBtn('ci-tab-paste','📋 Paste dari Excel',false)}
      </div>
      <div id="ci-mode-file">
        <div id="ci-dropzone" onclick="document.getElementById('ci-file-input').click()"
          ondragover="event.preventDefault();this.style.borderColor='var(--accent)'"
          ondragleave="this.style.borderColor='var(--border)'"
          ondrop="event.preventDefault();this.style.borderColor='var(--border)';custHandleCSVDrop(event)"
          style="border:2px dashed var(--border);border-radius:10px;padding:26px;text-align:center;cursor:pointer">
          <div style="font-size:32px;margin-bottom:8px">📄</div>
          <p style="color:var(--muted);font-size:13px">Klik atau drag &amp; drop file CSV di sini</p>
          <p style="color:var(--muted);font-size:11px;margin-top:4px">Format: .csv, maksimal 5MB</p>
        </div>
        <input type="file" id="ci-file-input" accept=".csv" style="display:none" onchange="custHandleCSVFile(this)">
      </div>
      <div id="ci-mode-paste" style="display:none">
        <p style="font-size:12px;color:var(--muted);margin-bottom:8px">Salin kolom dari Excel/Google Sheets (urutan: <b>Nama · Telepon · Alamat · Region · Catatan</b>, boleh dengan baris judul) lalu tempel di bawah. Satu baris = satu customer.</p>
        <textarea id="ci-paste-area" placeholder="Agen ABC	0811xxxx	Jl. Merdeka 1	Ternate	Langganan" style="width:100%;min-height:130px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:10px;font-size:12px;font-family:inherit;box-sizing:border-box"></textarea>
        <div style="margin-top:8px"><button class="btn btn-primary btn-sm" onclick="processCustPaste()">✅ Proses Data</button></div>
      </div>
      <div id="ci-preview" style="display:none;margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <div id="ci-summary" style="font-size:13px;color:var(--text)"></div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="custResetImport()">✖ Batal</button>
            <button class="btn btn-primary btn-sm" id="ci-confirm-btn" onclick="confirmImportCustomers()">✅ Import Data Valid</button>
          </div>
        </div>
        <div id="ci-errlist" style="margin-bottom:10px"></div>
        <div class="monitor-wrap" style="max-height:320px;overflow:auto">
          <table class="riwayat-tbl" id="ci-tbl"></table>
        </div>
      </div>
      <div id="ci-result" style="display:none;margin-top:14px"></div>
    </div>
  </div>`);
}

function switchCustImportMode(mode){
  custImpMode=mode;
  const f=document.getElementById('ci-mode-file'), p=document.getElementById('ci-mode-paste');
  if(f) f.style.display=mode==='file'?'block':'none';
  if(p) p.style.display=mode==='paste'?'block':'none';
  const bf=document.getElementById('ci-tab-file'), bp=document.getElementById('ci-tab-paste');
  if(bf){ bf.style.borderBottomColor=mode==='file'?'var(--accent)':'transparent'; bf.style.color=mode==='file'?'var(--text)':'var(--muted)'; }
  if(bp){ bp.style.borderBottomColor=mode==='paste'?'var(--accent)':'transparent'; bp.style.color=mode==='paste'?'var(--text)':'var(--muted)'; }
  custResetImport();
}

function downloadContohCustomerCSV(){
  const regs=S.regions||REGIONS;
  const csv=`nama,telepon,alamat,region,catatan\nAgen ABC,08110000001,Jl. Merdeka 1,${regs[0]||'Ternate'},Langganan\nToko Sinar,08120000002,Jl. Pasar 5,${regs[1]||'Tobelo'},\nUD Maju,,Jl. Raya 10,,Baru`;
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,﻿'+encodeURIComponent(csv);
  a.download='contoh-customer.csv';
  a.click();
}

function custHandleCSVDrop(e){ const f=e.dataTransfer.files[0]; if(f) parseCustCSVFile(f); }
function custHandleCSVFile(inp){ const f=inp.files[0]; if(f) parseCustCSVFile(f); inp.value=''; }
function parseCustCSVFile(file){
  if(!file.name.toLowerCase().endsWith('.csv')){ showAlert('❌ File harus berformat .csv','error'); return; }
  if(file.size>5*1024*1024){ showAlert('❌ File terlalu besar (maks 5MB)','error'); return; }
  const reader=new FileReader();
  reader.onload=e=>{ validateCustPreview(custBuildRows(String(e.target.result))); };
  reader.readAsText(file,'UTF-8');
}
function processCustPaste(){
  const txt=(document.getElementById('ci-paste-area')||{}).value||'';
  if(!txt.trim()){ showAlert('❌ Belum ada data yang ditempel','error'); return; }
  validateCustPreview(custBuildRows(txt));
}

function validateCustPreview(parsed){
  if(!parsed || !parsed.dataLines.length){ showAlert('❌ Data kosong','error'); return; }
  const {headers,dataLines}=parsed;
  if(!headers.includes('name')){ showAlert('❌ Kolom "nama" wajib ada','error'); return; }
  const validRegions=S.regions||REGIONS;
  const existing=new Set((S.customers||[]).map(c=>(c.name||'').toLowerCase()));
  const seen=new Set();
  const rows=dataLines.map((vals,i)=>{
    const get=k=>{ const idx=headers.indexOf(k); return idx>=0?String(vals[idx]||'').trim():''; };
    const name=get('name');
    const row={line:i+1,name,phone:get('phone'),address:get('address'),region:get('region'),note:get('note'),errors:[]};
    if(!name) row.errors.push('nama kosong');
    if(row.region && !validRegions.includes(row.region)) row.errors.push(`region "${row.region}" tidak ada`);
    const key=name.toLowerCase();
    if(name){
      if(existing.has(key)) row.errors.push('sudah ada di master');
      else if(seen.has(key)) row.errors.push('duplikat di file');
      else seen.add(key);
    }
    row.valid=row.errors.length===0;
    return row;
  });
  custImportRows=rows;
  const valid=rows.filter(r=>r.valid).length, invalid=rows.length-valid;
  const pv=document.getElementById('ci-preview'); if(pv) pv.style.display='block';
  const res=document.getElementById('ci-result'); if(res){ res.style.display='none'; res.innerHTML=''; }
  const sum=document.getElementById('ci-summary');
  if(sum) sum.innerHTML=`<b>Total: ${rows.length} baris</b> &nbsp;|&nbsp; <span style="color:#10b981">✅ Valid: ${valid}</span> &nbsp;|&nbsp; <span style="color:#ef4444">❌ Error: ${invalid}</span>`;
  const errBox=document.getElementById('ci-errlist');
  if(errBox){
    if(invalid>0){
      const errHtml=rows.filter(r=>!r.valid).slice(0,6).map(r=>`<div style="font-size:11px;color:#ef4444;margin-bottom:3px">⚠️ Baris ${r.line}${r.name?` (${esc(r.name)})`:''}: ${esc(r.errors.join(', '))}</div>`).join('')
        +(invalid>6?`<div style="font-size:11px;color:var(--muted)">...dan ${invalid-6} error lainnya</div>`:'');
      errBox.innerHTML=`<div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:10px 12px">${errHtml}</div>`;
    } else errBox.innerHTML='';
  }
  const tbl=document.getElementById('ci-tbl');
  if(tbl){
    const body=rows.map(r=>`<tr style="${r.valid?'':'background:rgba(239,68,68,.06)'}">
      <td>${r.line}</td>
      <td>${r.valid?'<span style="color:#10b981">✅</span>':`<span style="color:#ef4444" title="${escAttr(r.errors.join(', '))}">❌</span>`}</td>
      <td><b>${esc(r.name)||'-'}</b></td>
      <td>${esc(r.phone)||'-'}</td>
      <td style="font-size:11px">${esc(r.address)||'-'}</td>
      <td>${esc(r.region)||'-'}</td>
      <td style="font-size:11px">${esc(r.note)||'-'}</td>
    </tr>`).join('');
    tbl.innerHTML=`<tr><th>#</th><th>Status</th><th>Nama</th><th>Telepon</th><th>Alamat</th><th>Region</th><th>Catatan</th></tr>${body}`;
  }
  const cb=document.getElementById('ci-confirm-btn'); if(cb) cb.disabled=valid===0;
}

function custResetImport(){
  custImportRows=[];
  const pv=document.getElementById('ci-preview'); if(pv) pv.style.display='none';
  const eb=document.getElementById('ci-errlist'); if(eb) eb.innerHTML='';
}

function confirmImportCustomers(){
  const valid=custImportRows.filter(r=>r.valid);
  if(!valid.length){ showAlert('❌ Tidak ada data valid untuk diimport','error'); return; }
  showConfirm({
    ico:'📤', title:'Konfirmasi Import Customer',
    msg:`Akan menambahkan <b>${valid.length} customer</b> ke master. Lanjutkan?`,
    confirmLabel:'Ya, Import', confirmClass:'btn-primary',
    onConfirm:doImportCustomers
  });
}

async function doImportCustomers(){
  const valid=custImportRows.filter(r=>r.valid);
  let ok=0,gagal=0;
  for(const r of valid){
    try{
      await saveCustomer({id:gid(),name:r.name,phone:r.phone,address:r.address,region:r.region,note:r.note});
      ok++;
    }catch(e){ console.error('Gagal simpan customer:',r,e); gagal++; }
  }
  await writeLog('IMPORT_CUSTOMER',`Import ${ok} customer${gagal?', '+gagal+' gagal':''}`);
  custImportRows=[];
  setContent(renderCustomers());                 /* segarkan daftar di belakang modal */
  const pv=document.getElementById('ci-preview'); if(pv) pv.style.display='none';
  const box=document.getElementById('ci-result');
  if(box){ box.style.display='block'; box.innerHTML=`<div class="alert alert-${gagal?'error':'success'}">${gagal?'⚠️':'✅'} Import selesai: <b>${ok}</b> customer ditambahkan${gagal?`, ${gagal} gagal`:''}.</div>`; }
  showAlert(gagal?`⚠️ ${ok} berhasil, ${gagal} gagal`:`✅ ${ok} customer diimport`, gagal?'error':'success');
}
