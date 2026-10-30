/* ===== MONITOR TABLE (REKAP BULANAN) ===== */
/* Simpan daftar region aktif di variabel modul, supaya tombol/tab cukup
   memanggil helper tanpa menyisipkan array (yang berisi tanda kutip ganda)
   ke dalam atribut onclick="..." — penyebab tab bulan tidak bisa diklik. */
let _mtRegions = [];
function setRekapMonth(i){
  activeMonth = i;
  setContent(renderMonitorTable(_mtRegions));
}
function renderMonitorTable(regions, _arg){
  _mtRegions = regions;
  const tabs=MONTHS.map((m,i)=>`<div class="month-tab${i===activeMonth?' active':''}" onclick="setRekapMonth(${i})">${m}</div>`).join('');
  const mi=activeMonth;
  if(!TABUNGS.length) return `<div class="card"><div class="empty">Belum ada produk ${esc(catMeta().label)}. Tambahkan di menu Kelola Produk.</div></div>`;
  let tbl=`<table class="monitor-tbl" id="tbl-monitor">
    <thead>
      <tr>
        <th class="th-group" rowspan="2">GUDANG</th>
        <th class="th-group" rowspan="2">${esc(catMeta().statusLabel.toUpperCase())}</th>
        ${TABUNGS.map(t=>`<th class="th-group" colspan="4">${esc(t)}</th>`).join('')}
      </tr>
      <tr>${TABUNGS.map(()=>`<th>STOK AWAL</th><th>MASUK</th><th>KELUAR</th><th>STOK AKHIR</th>`).join('')}</tr>
    </thead><tbody>`;
  regions.forEach(reg=>{
    if(me.role!=='superadmin'&&me.region!==reg) return;
    STATUSES.forEach((st,si)=>{
      const jenisCls=`jenis-${st.toLowerCase()}`;
      let cells='';
      TABUNGS.forEach(tab=>{
        const d=computeCell(reg,tab,st,mi);
        const stokEl2=mi===0?`<input type="number" value="${d.stokAwal}" onchange="setSA(${jsArg(reg)},${jsArg(tab)},${jsArg(st)},${mi},this.value)">`:`<span>${d.stokAwal||'-'}</span>`;
        cells+=`<td class="stok-cell">${stokEl2}</td><td class="masuk-cell">${d.masuk||'-'}</td><td class="keluar-cell">${d.keluar||'-'}</td><td class="${d.stokAkhir<0?'akhir-neg':'akhir-cell'}">${d.stokAkhir}</td>`;
      });
      tbl+=`<tr>${si===0?`<td class="region-cell" rowspan="${STATUSES.length}">${esc(reg)}</td>`:''}<td class="${jenisCls}">${esc(st)}</td>${cells}</tr>`;
    });
  });
  tbl+=`</tbody></table>`;
  return `
  <div class="month-tabs">${tabs}</div>
  <div class="dl-bar">
    ${mi===0?`<span class="dl-note">Stok awal bisa diubah langsung di bulan Januari.</span>`:'<span></span>'}
    <div class="dl-actions">
      <button class="btn btn-ghost btn-sm" onclick="downloadTableById('tbl-monitor','Rekap_${MONTHS[mi]}')"><i class="bi bi-file-earmark-spreadsheet"></i> Excel</button>
      <button class="btn btn-ghost btn-sm" onclick="downloadCSV('${MONTHS[mi]}', _mtRegions)"><i class="bi bi-filetype-csv"></i> CSV</button>
      <button class="btn btn-ghost btn-sm" onclick="printTable()"><i class="bi bi-printer"></i> Cetak</button>
    </div>
  </div>
  <div class="card card-flush"><div class="monitor-wrap">${tbl}</div></div>`;
}

async function setSA(region,tabung,status,monthIdx,val){ await saveStokAwal(region,tabung,status,monthIdx,parseInt(val)||0); }
