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
  const isSemua = regions.length > 1;
  const tabs=MONTHS.map((m,i)=>`<div class="month-tab${i===activeMonth?' active':''}" onclick="setRekapMonth(${i})">${m}</div>`).join('');
  const mi=activeMonth;
  let tbl=`<table class="monitor-tbl" id="tbl-monitor">
    <thead>
      <tr>
        <th class="th-group" rowspan="2">GUDANG</th>
        <th class="th-group" rowspan="2">JENIS</th>
        <th class="th-50" colspan="4">50 KG</th>
        <th class="th-12" colspan="4">12 KG</th>
        <th class="th-55" colspan="4">5.5 KG</th>
        <th class="th-group" rowspan="2">KETERANGAN</th>
      </tr>
      <tr>
        <th class="th-50">STOK AWAL</th><th class="th-50">MASUK</th><th class="th-50">KELUAR</th><th class="th-50">STOK AKHIR</th>
        <th class="th-12">STOK AWAL</th><th class="th-12">MASUK</th><th class="th-12">KELUAR</th><th class="th-12">STOK AKHIR</th>
        <th class="th-55">STOK AWAL</th><th class="th-55">MASUK</th><th class="th-55">KELUAR</th><th class="th-55">STOK AKHIR</th>
      </tr>
    </thead><tbody>`;
  regions.forEach(reg=>{
    if(me.role!=='superadmin'&&me.region!==reg) return;
    STATUSES.forEach((st,si)=>{
      const jenisCls=`jenis-${st.toLowerCase()}`;
      const jensIcon=st==='ISI'?'💧 ':st==='KOSONG'?'⬜ ':'🔴 ';
      let cells='';
      TABUNGS.forEach(tab=>{
        const d=computeCell(reg,tab,st,mi);
        const stokEl2=mi===0?`<input type="number" value="${d.stokAwal}" style="width:58px" onchange="setSA('${reg}','${tab}','${st}',${mi},this.value)">`:`<span>${d.stokAwal||'-'}</span>`;
        cells+=`<td class="stok-cell">${stokEl2}</td><td class="masuk-cell">${d.masuk||'-'}</td><td class="keluar-cell">${d.keluar||'-'}</td><td class="${d.stokAkhir<0?'akhir-neg':'akhir-cell'}">${d.stokAkhir}</td>`;
      });
      tbl+=`<tr>${si===0?`<td class="region-cell" rowspan="3">${esc(reg)}</td>`:''}<td class="${jenisCls}">${jensIcon}${esc(st)}</td>${cells}<td class="ket-cell">${si===0?'':`${st==='BOCOR'?'Proses klaim':''}`}</td></tr>`;
    });
  });
  tbl+=`</tbody></table>`;
  return `
  <div class="alert alert-info">💡 <b>Stok Awal bulan ${MONTHS[mi]}</b> – kotak kuning dapat diubah langsung di bulan Januari.</div>
  <div class="month-tabs">${tabs}</div>
  <div class="dl-bar">
    <span>⬇ Unduh Tabel:</span>
    <button class="btn btn-warn btn-sm" onclick="downloadTableById('tbl-monitor','Rekap_${MONTHS[mi]}')">📊 Excel (.xls)</button>
    <button class="btn btn-blue btn-sm" onclick="downloadCSV('${MONTHS[mi]}', _mtRegions)">📄 CSV</button>
    <button class="btn btn-success btn-sm" onclick="printTable()">🖨️ Cetak / PDF</button>
  </div>
  <div class="card" style="padding:0;overflow:hidden"><div class="monitor-wrap" style="margin:0">${tbl}</div></div>`;
}

async function setSA(region,tabung,status,monthIdx,val){ await saveStokAwal(region,tabung,status,monthIdx,parseInt(val)||0); }
