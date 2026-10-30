/* ===== EXPORT HELPERS ===== */
/* Export .xls dari DATA (bukan dari DOM) — supaya tetap mengekspor SELURUH
   data walau tabel di layar dibatasi per-halaman. headers=array judul kolom,
   rows=array of array nilai sel. */
function downloadXlsFromData(headers, rows, filename){
  const cell=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const thead='<tr>'+headers.map(h=>`<th>${cell(h)}</th>`).join('')+'</tr>';
  const tbody=rows.map(r=>'<tr>'+r.map(c=>`<td>${cell(c)}</td>`).join('')+'</tr>').join('');
  const html=`<html><head><meta charset="utf-8"><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px 10px;font-size:12px;text-align:center}th{background:#1a1a2e;color:#fff}</style></head><body><table>${thead}${tbody}</table></body></html>`;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([html],{type:'application/vnd.ms-excel;charset=utf-8'}));
  a.download=`${filename}_${localDate()}.xls`;
  a.click();
}

function downloadTableById(tableId,filename){
  const tbl=document.getElementById(tableId);
  if(!tbl){showAlert('Tabel tidak ditemukan','error');return;}
  const clone=tbl.cloneNode(true);
  clone.querySelectorAll('button').forEach(b=>b.closest('td')&&(b.closest('td').textContent=''));
  clone.querySelectorAll('input').forEach(inp=>{ const s=document.createElement('span'); s.textContent=inp.value; inp.replaceWith(s); });
  const html=`<html><head><meta charset="utf-8"><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px 10px;font-size:12px;text-align:center}th{background:#1a1a2e;color:#fff}.region-cell{background:#1e2538;font-weight:bold;text-align:left}</style></head><body>${clone.outerHTML}</body></html>`;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([html],{type:'application/vnd.ms-excel;charset=utf-8'}));
  a.download=`${filename}_${localDate()}.xls`;
  a.click();
}

function downloadCSV(monthName,regions){
  const mi=activeMonth;
  const rows=[['GUDANG','JENIS',...TABUNGS.flatMap(t=>[t+' SA',t+' M',t+' K',t+' AKH'])]];
  regions.forEach(reg=>{ STATUSES.forEach(st=>{ const row=[reg,st]; TABUNGS.forEach(tab=>{ const d=computeCell(reg,tab,st,mi); row.push(d.stokAwal,d.masuk,d.keluar,d.stokAkhir); }); rows.push(row); }); });
  const csv=rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));
  a.download=`Rekap_${catMeta().short}_${monthName}_${localDate()}.csv`;
  a.click();
}

function printTable(){
  const tbl=document.getElementById('tbl-monitor');
  if(!tbl)return;
  const clone=tbl.cloneNode(true);
  clone.querySelectorAll('input').forEach(inp=>{ const s=document.createElement('span'); s.textContent=inp.value; inp.replaceWith(s); });
  const w=window.open('','_blank');
  w.document.write(`<html><head><title>Rekap ${catMeta().label} ${MONTHS[activeMonth]}</title><style>body{font-family:Arial,sans-serif;font-size:11px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #666;padding:5px 8px;text-align:center}th{background:#dde;font-weight:bold}@media print{@page{size:landscape}}</style></head><body><h3>Monitoring ${catMeta().label} – ${MONTHS[activeMonth]} ${CUR_YEAR}</h3>${clone.outerHTML}<p style="margin-top:10px;font-size:10px">Dicetak: ${new Date().toLocaleString('id-ID')}</p></body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),500);
}
