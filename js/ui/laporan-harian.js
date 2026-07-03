/* ===== LAPORAN HARIAN (SATU REGION) ===== */
let lhFilter={month:new Date().getMonth(), dateFrom:'', dateTo:'', tabung:'all', status:'all'};
let lhSelectedDate=null;
let _lastLhRegion=null;

function renderLaporanHarian(region){
  const isSA=me.role==='superadmin';
  if(!isSA && me.region!==region) return `<div class="card"><p style="text-align:center;padding:32px;color:var(--muted)">🚫 Anda tidak memiliki akses ke region ini.</p></div>`;
  if(_lastLhRegion!==region){ lhSelectedDate=null; _lastLhRegion=region; }

  let txAll=S.transactions.filter(t=>t.region===region && t.year===CUR_YEAR);

  if(!lhFilter.dateFrom && !lhFilter.dateTo){
    txAll=txAll.filter(t=>t.monthIdx===lhFilter.month);
  }
  if(lhFilter.dateFrom) txAll=txAll.filter(t=>t.tanggal>=lhFilter.dateFrom);
  if(lhFilter.dateTo)   txAll=txAll.filter(t=>t.tanggal<=lhFilter.dateTo);
  if(lhFilter.tabung!=='all') txAll=txAll.filter(t=>t.tabung===lhFilter.tabung);
  if(lhFilter.status!=='all') txAll=txAll.filter(t=>t.status===lhFilter.status);

  const dates=[...new Set(txAll.map(t=>t.tanggal))].sort();

  let totM=0,totK=0;
  txAll.forEach(t=>{ if(t.type==='masuk')totM+=t.qty; else totK+=t.qty; });

  const monthOpts=MONTHS.map((m,i)=>`<option value="${i}"${lhFilter.month===i?'selected':''}>${m}</option>`).join('');
  const tabOpts=`<option value="all">Semua Jenis</option>`+TABUNGS.map(t=>`<option value="${t}"${lhFilter.tabung===t?'selected':''}>${t}</option>`).join('');
  const stOpts=`<option value="all">Semua Status</option>`+STATUSES.map(s=>`<option value="${s}"${lhFilter.status===s?'selected':''}>${s}</option>`).join('');

  const hasDateRange=lhFilter.dateFrom||lhFilter.dateTo;

  let tblBody='';
  let grandMasuk={}, grandKeluar={};
  TABUNGS.forEach(tb=>STATUSES.forEach(st=>{
    grandMasuk[tb+'_'+st]=0; grandKeluar[tb+'_'+st]=0;
  }));

  const txRegionAll=S.transactions.filter(t=>t.region===region&&t.year===CUR_YEAR);
  const firstDate=dates.length>0?dates[0]:'';
  const txSebelumPeriode=txRegionAll.filter(t=>t.tanggal<firstDate);
  const saldoAwalPeriode=txSebelumPeriode.reduce((acc,t)=>acc+(t.type==='masuk'?+(+t.qty||0):-(+t.qty||0)),0);

  if(dates.length===0){
    tblBody=`<tr><td colspan="16" class="empty"><div class="ico">📭</div>Tidak ada transaksi pada periode ini</td></tr>`;
  } else {
    let saldoBerjalan=saldoAwalPeriode;

    dates.forEach(tgl=>{
      const txDay=txAll.filter(t=>t.tanggal===tgl);
      const dayMasuk=txDay.filter(t=>t.type==='masuk').reduce((a,b)=>a+(+b.qty||0),0);
      const dayKeluar=txDay.filter(t=>t.type==='keluar').reduce((a,b)=>a+(+b.qty||0),0);

      const saldoAwalHari=saldoBerjalan;
      const saldoAkhirHari=saldoBerjalan+dayMasuk-dayKeluar;
      saldoBerjalan=saldoAkhirHari;

      let cells='';
      const displayTabungs=lhFilter.tabung==='all'?TABUNGS:[lhFilter.tabung];
      const displayStatuses=lhFilter.status==='all'?STATUSES:[lhFilter.status];

      displayTabungs.forEach(tb=>{
        displayStatuses.forEach(st=>{
          const m=txDay.filter(t=>t.type==='masuk'&&t.tabung===tb&&t.status===st).reduce((a,b)=>a+(+b.qty||0),0);
          const k=txDay.filter(t=>t.type==='keluar'&&t.tabung===tb&&t.status===st).reduce((a,b)=>a+(+b.qty||0),0);
          grandMasuk[tb+'_'+st]=(grandMasuk[tb+'_'+st]||0)+m;
          grandKeluar[tb+'_'+st]=(grandKeluar[tb+'_'+st]||0)+k;
          const mCell=m>0?`<span style="color:#34d399;font-weight:700">+${m}</span>`:`<span style="color:rgba(139,145,167,.4)">-</span>`;
          const kCell=k>0?`<span style="color:#f87171;font-weight:700">-${k}</span>`:`<span style="color:rgba(139,145,167,.4)">-</span>`;
          cells+=`<td style="text-align:center;padding:6px 8px">${mCell}</td><td style="text-align:center;padding:6px 8px">${kCell}</td>`;
        });
      });

      const d=new Date(tgl+'T00:00:00');
      const hariNama=['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()];
      const tglFmt=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      const saldoDay=dayMasuk-dayKeluar;
      const txCount=txDay.length;

      const detailId='det_'+tgl.replace(/-/g,'');
      const detailRows=txDay.map(t=>`
        <tr style="background:rgba(249,115,22,.03);font-size:11px">
          <td colspan="2" style="padding:3px 10px;color:var(--muted);text-align:right;font-size:10px">↳ ${esc(t.noSj)||'—'} · ${esc(t.pihak)||'—'}</td>
          <td style="padding:3px 8px;text-align:center"><span class="badge badge-${esc(t.type)}">${t.type==='masuk'?'📥':'📤'}</span></td>
          <td style="padding:3px 8px;text-align:center;font-size:10px">${esc(t.tabung)}</td>
          <td style="padding:3px 8px;text-align:center"><span class="badge badge-${esc(String(t.status).toLowerCase())}" style="font-size:9px">${esc(t.status)}</span></td>
          <td colspan="${cells.split('<td').length-1}" style="padding:3px 8px;color:${t.type==='masuk'?'#34d399':'#f87171'};font-weight:700;text-align:center">${t.type==='masuk'?'+':'-'}${esc(t.qty)} tabung &nbsp;<span style="color:var(--muted);font-weight:400">${esc(t.ket)||''}</span></td>
        </tr>`).join('');

      const isSelected = lhSelectedDate===tgl;
      tblBody+=`
        <tr style="cursor:pointer;transition:background .15s${isSelected?';background:rgba(249,115,22,.12);outline:2px solid rgba(249,115,22,.4);outline-offset:-1px':''}" onclick="selectLhDate('${tgl}','${region}')" title="Klik untuk lihat riwayat semua region pada tanggal ini">
          <td style="white-space:nowrap;padding:7px 10px;font-size:12px${isSelected?';color:var(--accent);font-weight:800':''}">
            <b>${tglFmt}</b> <span style="color:var(--muted);font-size:10px">${hariNama}</span>
            ${isSelected?'<span style="margin-left:4px;font-size:9px;color:var(--accent)">◀</span>':''}
          </td>
          <td style="padding:7px 8px;text-align:center">
            <span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:700">${txCount} tx</span>
          </td>
          <td style="padding:7px 8px;text-align:center;font-weight:700;color:${saldoAwalHari<0?'#ef4444':'#fbbf24'}">${saldoAwalHari}</td>
          <td style="padding:7px 8px;text-align:center;color:#34d399;font-weight:700">${dayMasuk>0?'+'+dayMasuk:'-'}</td>
          <td style="padding:7px 8px;text-align:center;color:#f87171;font-weight:700">${dayKeluar>0?'-'+dayKeluar:'-'}</td>
          <td style="padding:7px 8px;text-align:center;font-weight:800;color:${saldoAkhirHari<0?'#ef4444':saldoAkhirHari>0?'var(--accent)':'var(--muted)'}">
            ${saldoAkhirHari}
          </td>
          ${cells}
        </tr>
        <tr id="${detailId}" style="display:none">${detailRows}</tr>`;
    });

    // Grand total row
    const saldoAwalTotal=saldoAwalPeriode;
    const saldoAkhirTotal=saldoAwalPeriode+totM-totK;
    let grandCells='';
    const displayTabungs=lhFilter.tabung==='all'?TABUNGS:[lhFilter.tabung];
    const displayStatuses=lhFilter.status==='all'?STATUSES:[lhFilter.status];
    displayTabungs.forEach(tb=>{
      displayStatuses.forEach(st=>{
        const gm=grandMasuk[tb+'_'+st]||0;
        const gk=grandKeluar[tb+'_'+st]||0;
        grandCells+=`<td style="text-align:center;padding:7px 8px;color:#34d399;font-weight:800">${gm>0?'+'+gm:'-'}</td><td style="text-align:center;padding:7px 8px;color:#f87171;font-weight:800">${gk>0?'-'+gk:'-'}</td>`;
      });
    });
    tblBody+=`<tr style="background:var(--surface3);font-weight:800;border-top:2px solid var(--border)">
      <td style="padding:8px 10px;color:var(--text)">TOTAL</td>
      <td style="text-align:center;color:var(--muted)">${dates.length} hari</td>
      <td style="text-align:center;color:#fbbf24;font-weight:800">${saldoAwalTotal}</td>
      <td style="text-align:center;color:#34d399">+${totM}</td>
      <td style="text-align:center;color:#f87171">-${totK}</td>
      <td style="text-align:center;color:${saldoAkhirTotal>=0?'var(--accent)':'#ef4444'}">${saldoAkhirTotal>=0?'+':''}${saldoAkhirTotal}</td>
      ${grandCells}
    </tr>`;
  }

  // Build dynamic column headers
  const displayTabungs=lhFilter.tabung==='all'?TABUNGS:[lhFilter.tabung];
  const displayStatuses=lhFilter.status==='all'?STATUSES:[lhFilter.status];
  const tabColspan=displayStatuses.length*2;
  const headerColors={'50 KG':'rgba(249,115,22,.18)','12 KG':'rgba(59,130,246,.18)','5.5 KG':'rgba(16,185,129,.18)'};
  const headerTextColors={'50 KG':'#fb923c','12 KG':'#60a5fa','5.5 KG':'#34d399'};
  const stColors={ISI:'#34d399',KOSONG:'#9ca3af',BOCOR:'#f87171'};

  let thRow1='',thRow2='';
  displayTabungs.forEach(tb=>{
    thRow1+=`<th colspan="${tabColspan}" style="background:${headerColors[tb]||'rgba(100,100,100,.15)'};color:${headerTextColors[tb]||'#aaa'};padding:5px 8px;font-size:10px;text-align:center;border:1px solid var(--border)">${tb}</th>`;
    displayStatuses.forEach(st=>{
      thRow2+=`<th colspan="2" style="background:rgba(0,0,0,.15);color:${stColors[st]||'#aaa'};padding:4px 6px;font-size:9px;letter-spacing:.04em;border:1px solid var(--border)">${st}</th>`;
    });
  });
  let thRow3='';
  displayTabungs.forEach(()=>displayStatuses.forEach(()=>{
    thRow3+=`<th style="padding:4px 8px;font-size:9px;color:#34d399;border:1px solid var(--border)">Masuk</th><th style="padding:4px 8px;font-size:9px;color:#f87171;border:1px solid var(--border)">Keluar</th>`;
  }));

  // Ringkasan per tabung
  const ringkasanCards=displayTabungs.map(tb=>{
    const m=txAll.filter(t=>t.type==='masuk'&&t.tabung===tb).reduce((a,b)=>a+(+b.qty||0),0);
    const k=txAll.filter(t=>t.type==='keluar'&&t.tabung===tb).reduce((a,b)=>a+(+b.qty||0),0);
    const col=headerTextColors[tb]||'var(--accent)';
    return `<div class="stat-card" style="border-left:3px solid ${col}">
      <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:6px">${tb}</div>
      <div style="display:flex;gap:12px">
        <div><div style="font-size:18px;font-weight:800;color:#34d399">+${m}</div><div style="font-size:10px;color:var(--muted)">Masuk</div></div>
        <div><div style="font-size:18px;font-weight:800;color:#f87171">-${k}</div><div style="font-size:10px;color:var(--muted)">Keluar</div></div>
        <div><div style="font-size:18px;font-weight:800;color:${m-k>=0?'var(--accent)':'#ef4444'}">${m-k>=0?'+':''}${m-k}</div><div style="font-size:10px;color:var(--muted)">Saldo</div></div>
      </div>
    </div>`;
  }).join('');

  return `
  <!-- FILTER BAR -->
  <div class="card" style="margin-bottom:14px">
    <div class="card-title">🔍 Filter Laporan Harian – <span style="color:var(--accent)">${esc(region)}</span></div>
    <div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
      <div class="field" style="margin:0">
        <label>Bulan</label>
        <select ${hasDateRange?'disabled style="opacity:.5"':''} onchange="lhFilter.month=+this.value;lhFilter.dateFrom='';lhFilter.dateTo='';setContent(renderLaporanHarian(_lhRegion))">
          ${monthOpts}
        </select>
      </div>
      <div class="field" style="margin:0"><label>Dari Tanggal</label>
        <input type="date" value="${lhFilter.dateFrom}" onchange="lhFilter.dateFrom=this.value;setContent(renderLaporanHarian(_lhRegion))">
      </div>
      <div class="field" style="margin:0"><label>Sampai Tanggal</label>
        <input type="date" value="${lhFilter.dateTo}" onchange="lhFilter.dateTo=this.value;setContent(renderLaporanHarian(_lhRegion))">
      </div>
      <div class="field" style="margin:0"><label>Jenis Tabung</label>
        <select onchange="lhFilter.tabung=this.value;setContent(renderLaporanHarian(_lhRegion))">${tabOpts}</select>
      </div>
      <div class="field" style="margin:0"><label>Status Tabung</label>
        <select onchange="lhFilter.status=this.value;setContent(renderLaporanHarian(_lhRegion))">${stOpts}</select>
      </div>
      <div class="field" style="margin:0;display:flex;align-items:flex-end">
        <button class="btn btn-ghost btn-sm" style="width:100%" onclick="lhFilter={month:new Date().getMonth(),dateFrom:'',dateTo:'',tabung:'all',status:'all'};setContent(renderLaporanHarian(_lhRegion))">↺ Reset</button>
      </div>
    </div>
  </div>

  <!-- STATS -->
  <div class="stats-grid">
    <div class="stat-card stat-blue"><div class="val">${dates.length}</div><div class="lbl">Hari Aktif</div></div>
    <div class="stat-card" style="border-left:3px solid #fbbf24"><div class="val" style="color:#fbbf24">${saldoAwalPeriode}</div><div class="lbl">Saldo Awal</div></div>
    <div class="stat-card stat-green"><div class="val">${totM}</div><div class="lbl">Total Masuk</div></div>
    <div class="stat-card stat-red"><div class="val">${totK}</div><div class="lbl">Total Keluar</div></div>
    <div class="stat-card stat-orange"><div class="val" style="color:${(saldoAwalPeriode+totM-totK)>=0?'var(--accent)':'#ef4444'}">${saldoAwalPeriode+totM-totK>=0?'+':''}${saldoAwalPeriode+totM-totK}</div><div class="lbl">Saldo Akhir</div></div>
    <div class="stat-card" style="border-left:3px solid var(--warn)"><div class="val">${txAll.length}</div><div class="lbl">Total Transaksi</div></div>
  </div>

  <!-- RINGKASAN PER TABUNG -->
  <div class="stats-grid">${ringkasanCards}</div>

  <!-- TABEL UTAMA -->
  <div class="card" style="padding:0;overflow:hidden">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);display:flex;align-items:center;gap:8px">
        📅 Detail Per Tanggal
        <span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:2px 8px;border-radius:99px;font-size:10px">
          ${hasDateRange?(lhFilter.dateFrom||'...')+' s/d '+(lhFilter.dateTo||'...'):MONTHS[lhFilter.month]+' '+CUR_YEAR}
        </span>
        <span style="font-size:10px;color:var(--muted)">Klik baris untuk detail</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-warn btn-sm" onclick="downloadHarianXls('${region}')">📊 Excel</button>
        <button class="btn btn-blue btn-sm" onclick="downloadHarianCSV('${region}')">📄 CSV</button>
        <button class="btn btn-success btn-sm" onclick="printHarian('${region}')">🖨️ Cetak</button>
      </div>
    </div>
    <div class="monitor-wrap" style="margin:0">
      <table class="monitor-tbl" id="tbl-harian" style="min-width:700px">
        <thead>
          <tr>
            <th class="th-group" rowspan="3" style="min-width:70px">TANGGAL</th>
            <th class="th-group" rowspan="3">TX</th>
            <th class="th-group" rowspan="3" style="color:#fbbf24;background:rgba(234,179,8,.12)">SALDO AWAL</th>
            <th class="th-group" rowspan="3" style="color:#34d399">MASUK</th>
            <th class="th-group" rowspan="3" style="color:#f87171">KELUAR</th>
            <th class="th-group" rowspan="3" style="color:var(--accent);background:rgba(249,115,22,.1)">SALDO AKHIR</th>
            ${thRow1}
          </tr>
          <tr>${thRow2}</tr>
          <tr>${thRow3}</tr>
        </thead>
        <tbody>${tblBody}</tbody>
      </table>
    </div>
  </div>

  <!-- GRAFIK MINI (bar sederhana) -->
  ${dates.length>0?renderMiniChart(txAll,dates):''}

  <!-- PANEL DETAIL TANGGAL – SEMUA REGION -->
  ${lhSelectedDate?renderLhDatePanel(lhSelectedDate):''}
  `;
}

function toggleDayDetail(id){
  const el=document.getElementById(id);
  if(el) el.style.display=el.style.display==='none'?'table-row':'none';
}

function selectLhDate(tgl, currentRegion){
  if(lhSelectedDate===tgl){ lhSelectedDate=null; setContent(renderLaporanHarian(currentRegion)); return; }
  lhSelectedDate=tgl;
  setContent(renderLaporanHarian(currentRegion));
  setTimeout(()=>{
    const el=document.getElementById('lh-date-panel');
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
  },80);
}

function renderLhDatePanel(tgl){
  const isSA=me.role==='superadmin';
  const allRegions=isSA?(S.regions||REGIONS):[me.region];

  const d=new Date(tgl+'T00:00:00');
  const hariNames=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const hariNama=hariNames[d.getDay()];
  const tglFmt=d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});

  const txDate=S.transactions.filter(t=>t.tanggal===tgl&&allRegions.includes(t.region));

  let regSummaryRows='';
  allRegions.forEach(reg=>{
    const txReg=txDate.filter(t=>t.region===reg);
    const m=txReg.filter(t=>t.type==='masuk').reduce((a,b)=>a+(+b.qty||0),0);
    const k=txReg.filter(t=>t.type==='keluar').reduce((a,b)=>a+(+b.qty||0),0);
    const saldo=m-k;
    if(txReg.length===0) return;
    regSummaryRows+=`
      <tr>
        <td style="font-weight:700;color:var(--text);padding:8px 10px">${esc(reg)}</td>
        <td style="text-align:center;padding:8px 10px">
          <span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:700">${txReg.length} tx</span>
        </td>
        <td style="text-align:center;padding:8px 10px;color:#34d399;font-weight:700">${m>0?'+'+m:'-'}</td>
        <td style="text-align:center;padding:8px 10px;color:#f87171;font-weight:700">${k>0?'-'+k:'-'}</td>
        <td style="text-align:center;padding:8px 10px;font-weight:800;color:${saldo>0?'var(--accent)':saldo<0?'#ef4444':'var(--muted)'}">
          ${saldo>0?'+'+saldo:saldo}
        </td>
      </tr>`;
  });

  if(!regSummaryRows){
    regSummaryRows=`<tr><td colspan="5" class="empty"><div class="ico">📭</div>Tidak ada transaksi pada tanggal ini</td></tr>`;
  }

  const totM=txDate.filter(t=>t.type==='masuk').reduce((a,b)=>a+(+b.qty||0),0);
  const totK=txDate.filter(t=>t.type==='keluar').reduce((a,b)=>a+(+b.qty||0),0);
  const totSaldo=totM-totK;
  if(txDate.length>0){
    regSummaryRows+=`
      <tr style="background:var(--surface3);font-weight:800;border-top:2px solid var(--border)">
        <td style="padding:8px 10px;color:var(--text)">SEMUA REGION</td>
        <td style="text-align:center;padding:8px 10px;color:var(--muted)">${txDate.length} tx</td>
        <td style="text-align:center;padding:8px 10px;color:#34d399">+${totM}</td>
        <td style="text-align:center;padding:8px 10px;color:#f87171">-${totK}</td>
        <td style="text-align:center;padding:8px 10px;color:${totSaldo>=0?'var(--accent)':'#ef4444'}">${totSaldo>=0?'+':''}${totSaldo}</td>
      </tr>`;
  }

  let txRows='';
  if(txDate.length===0){
    txRows=`<tr><td colspan="9" class="empty"><div class="ico">📭</div>Tidak ada transaksi</td></tr>`;
  } else {
    const sorted=[...txDate].sort((a,b)=>a.region.localeCompare(b.region)||(a.type==='masuk'?-1:1));
    sorted.forEach((t,idx)=>{
      const prevReg=idx>0?sorted[idx-1].region:'';
      const isNewReg=t.region!==prevReg;
      if(isNewReg){
        txRows+=`<tr style="background:var(--surface3)"><td colspan="9" style="padding:5px 10px;font-size:11px;font-weight:700;color:var(--accent)">📍 ${esc(t.region)}</td></tr>`;
      }
      txRows+=`
        <tr>
          <td style="padding:7px 9px;font-size:11px;color:var(--muted)">${esc(t.noSj)||'—'}</td>
          <td style="padding:7px 9px">
            <span class="badge badge-${esc(t.type)}">${t.type==='masuk'?'📥 Masuk':'📤 Keluar'}</span>
          </td>
          <td style="padding:7px 9px;font-size:11px">${esc(t.tabung)}</td>
          <td style="padding:7px 9px">
            <span class="badge badge-${esc(String(t.status).toLowerCase())}">${esc(t.status)}</span>
          </td>
          <td style="padding:7px 9px;text-align:center;font-weight:800;color:${t.type==='masuk'?'#34d399':'#f87171'}">
            ${t.type==='masuk'?'+':'-'}${esc(t.qty)}
          </td>
          <td style="padding:7px 9px;font-size:11px;color:var(--muted)">${esc(t.pihak)||'—'}</td>
          <td style="padding:7px 9px;font-size:11px;color:var(--muted)">${esc(t.ket)||'—'}</td>
          <td style="padding:7px 9px">
            <span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:2px 7px;border-radius:99px;font-size:10px;font-weight:600">${esc(t.region)}</span>
          </td>
          ${isSA?`<td style="padding:7px 9px"><button class="btn btn-danger btn-sm" onclick="confirmDelTx('${t.id}')">🗑</button></td>`:'<td></td>'}
        </tr>`;
    });
  }

  return `
  <div id="lh-date-panel" style="margin-top:18px;animation:slideUp .3s ease">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:4px;height:32px;background:var(--accent);border-radius:2px;flex-shrink:0"></div>
        <div>
          <div style="font-size:14px;font-weight:800;color:var(--text)">📅 ${hariNama}, ${tglFmt}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px">Riwayat semua region pada tanggal ini</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="lhSelectedDate=null;setContent(renderLaporanHarian(_lhRegion))">✖ Tutup</button>
    </div>

    <div class="card" style="margin-bottom:14px;padding:0;overflow:hidden">
      <div style="padding:11px 16px;border-bottom:1px solid var(--border);background:var(--surface3)">
        <div class="card-title" style="margin:0">🗂️ Ringkasan Per Region
          <span style="margin-left:6px;font-size:10px;font-weight:400;color:var(--muted)">${allRegions.length} region</span>
        </div>
      </div>
      <div class="monitor-wrap" style="margin:0">
        <table class="riwayat-tbl" style="min-width:400px">
          <tr>
            <th style="min-width:100px">Region</th>
            <th style="text-align:center">Transaksi</th>
            <th style="text-align:center;color:#34d399">Masuk</th>
            <th style="text-align:center;color:#f87171">Keluar</th>
            <th style="text-align:center">Saldo</th>
          </tr>
          ${regSummaryRows}
        </table>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:11px 16px;border-bottom:1px solid var(--border);background:var(--surface3);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div class="card-title" style="margin:0">📋 Detail Transaksi
          <span style="margin-left:6px;font-size:10px;font-weight:400;color:var(--muted)">${txDate.length} transaksi</span>
        </div>
        ${txDate.length>0?`<button class="btn btn-warn btn-sm" onclick="exportLhDateCSV('${tgl}')">⬇ Export CSV</button>`:''}
      </div>
      <div class="monitor-wrap" style="margin:0">
        <table class="riwayat-tbl" style="min-width:650px">
          <tr>
            <th>No.SJ</th>
            <th>Tipe</th>
            <th>Jenis Tabung</th>
            <th>Status</th>
            <th style="text-align:center">QTY</th>
            <th>Pihak</th>
            <th>Keterangan</th>
            <th>Region</th>
            <th>Aksi</th>
          </tr>
          ${txRows}
        </table>
      </div>
    </div>
  </div>`;
}

function exportLhDateCSV(tgl){
  const isSA=me.role==='superadmin';
  const allRegions=isSA?(S.regions||REGIONS):[me.region];
  const txDate=S.transactions.filter(t=>t.tanggal===tgl&&allRegions.includes(t.region));
  if(!txDate.length){showAlert('Tidak ada data untuk diekspor','error');return;}
  const header='Tanggal,Region,Tipe,No.SJ,Pihak,Jenis Tabung,Status,QTY,Keterangan\n';
  const rows=txDate.map(t=>`"${t.tanggal}","${t.region}","${t.type}","${t.noSj||''}","${t.pihak||''}","${t.tabung}","${t.status}","${t.qty}","${(t.ket||'').replace(/"/g,"'")}"`).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(header+rows);
  a.download=`transaksi-${tgl}.csv`;
  a.click();
  showAlert(`✅ Data tanggal ${tgl} berhasil diekspor`);
}

function renderMiniChart(txAll, dates){
  if(dates.length===0) return '';
  const maxQty=Math.max(...dates.map(tgl=>{
    const m=txAll.filter(t=>t.tanggal===tgl&&t.type==='masuk').reduce((a,b)=>a+(+b.qty||0),0);
    const k=txAll.filter(t=>t.tanggal===tgl&&t.type==='keluar').reduce((a,b)=>a+(+b.qty||0),0);
    return Math.max(m,k);
  }),1);
  const BAR_H=60;
  const barW=Math.max(18,Math.min(40,Math.floor(600/dates.length)-4));
  const chartW=dates.length*(barW+4)+60;

  const bars=dates.map((tgl,i)=>{
    const m=txAll.filter(t=>t.tanggal===tgl&&t.type==='masuk').reduce((a,b)=>a+(+b.qty||0),0);
    const k=txAll.filter(t=>t.tanggal===tgl&&t.type==='keluar').reduce((a,b)=>a+(+b.qty||0),0);
    const mH=Math.round((m/maxQty)*BAR_H);
    const kH=Math.round((k/maxQty)*BAR_H);
    const x=40+i*(barW+4);
    const d=new Date(tgl+'T00:00:00');
    const lbl=String(d.getDate()).padStart(2,'0');
    return `
      <rect x="${x}" y="${BAR_H+10-mH}" width="${Math.floor(barW/2)-1}" height="${mH}" fill="rgba(52,211,153,.7)" rx="2"/>
      <rect x="${x+Math.floor(barW/2)}" y="${BAR_H+10-kH}" width="${Math.floor(barW/2)-1}" height="${kH}" fill="rgba(248,113,113,.7)" rx="2"/>
      <text x="${x+barW/2}" y="${BAR_H+22}" fill="#8b91a7" font-size="8" text-anchor="middle">${lbl}</text>
      ${m>0?`<text x="${x+Math.floor(barW/4)}" y="${BAR_H+10-mH-2}" fill="#34d399" font-size="7" text-anchor="middle">${m}</text>`:''}
      ${k>0?`<text x="${x+Math.floor(barW*3/4)}" y="${BAR_H+10-kH-2}" fill="#f87171" font-size="7" text-anchor="middle">${k}</text>`:''}`;
  }).join('');

  return `<div class="card" style="margin-top:14px">
    <div class="card-title">📈 Grafik Harian
      <span style="margin-left:8px;font-size:10px;font-weight:400">
        <span style="color:#34d399">■</span> Masuk &nbsp;
        <span style="color:#f87171">■</span> Keluar
      </span>
    </div>
    <div style="overflow-x:auto">
      <svg width="${chartW}" height="${BAR_H+34}" style="display:block">
        <line x1="38" y1="10" x2="38" y2="${BAR_H+12}" stroke="var(--border)" stroke-width="1"/>
        <text x="36" y="14" fill="#8b91a7" font-size="8" text-anchor="end">${maxQty}</text>
        <text x="36" y="${BAR_H+12}" fill="#8b91a7" font-size="8" text-anchor="end">0</text>
        ${bars}
      </svg>
    </div>
  </div>`;
}

function downloadHarianXls(region){
  const tbl=document.getElementById('tbl-harian');
  if(!tbl){showAlert('Tabel tidak ditemukan','error');return;}
  const clone=tbl.cloneNode(true);
  clone.querySelectorAll('button').forEach(b=>b.remove());
  clone.querySelectorAll('tr[id^="det_"]').forEach(r=>r.remove());
  const html=`<html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;font-size:11px}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #999;padding:5px 8px;text-align:center}
    th{background:#1a1a2e;color:#fff}
  </style></head><body>
    <h3>Laporan Harian LPG – ${region}</h3>
    ${clone.outerHTML}
    <p style="font-size:10px;margin-top:8px">Dicetak: ${new Date().toLocaleString('id-ID')}</p>
  </body></html>`;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([html],{type:'application/vnd.ms-excel;charset=utf-8'}));
  a.download=`LaporanHarian_${region}_${new Date().toISOString().split('T')[0]}.xls`;
  a.click();
}

function downloadHarianCSV(region){
  let txAll=S.transactions.filter(t=>t.region===region&&t.year===CUR_YEAR);
  if(!lhFilter.dateFrom&&!lhFilter.dateTo) txAll=txAll.filter(t=>t.monthIdx===lhFilter.month);
  if(lhFilter.dateFrom) txAll=txAll.filter(t=>t.tanggal>=lhFilter.dateFrom);
  if(lhFilter.dateTo)   txAll=txAll.filter(t=>t.tanggal<=lhFilter.dateTo);
  if(lhFilter.tabung!=='all') txAll=txAll.filter(t=>t.tabung===lhFilter.tabung);
  if(lhFilter.status!=='all') txAll=txAll.filter(t=>t.status===lhFilter.status);
  txAll.sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
  const header='Tanggal,Tipe,No.SJ,Pihak,Jenis Tabung,Status,QTY,Keterangan\n';
  const rows=txAll.map(t=>`"${t.tanggal}","${t.type}","${t.noSj||''}","${t.pihak||''}","${t.tabung}","${t.status}","${t.qty}","${t.ket||''}"`).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+header+rows],{type:'text/csv;charset=utf-8'}));
  a.download=`LaporanHarian_${region}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function printHarian(region){
  const tbl=document.getElementById('tbl-harian');
  if(!tbl)return;
  const clone=tbl.cloneNode(true);
  clone.querySelectorAll('button').forEach(b=>b.remove());
  clone.querySelectorAll('tr[id^="det_"]').forEach(r=>r.remove());
  const periode=lhFilter.dateFrom||lhFilter.dateTo
    ?((lhFilter.dateFrom||'...')+' s/d '+(lhFilter.dateTo||'...'))
    :MONTHS[lhFilter.month]+' '+CUR_YEAR;
  const w=window.open('','_blank');
  w.document.write(`<html><head><title>Laporan Harian LPG ${region}</title><style>
    body{font-family:Arial,sans-serif;font-size:11px}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #666;padding:5px 8px;text-align:center}
    th{background:#dde;font-weight:bold}
    @media print{@page{size:landscape;margin:10mm}}
  </style></head><body>
    <h3 style="margin-bottom:4px">📅 Laporan Harian LPG – ${region}</h3>
    <p style="font-size:11px;margin-bottom:10px;color:#555">Periode: ${periode} | Dicetak: ${new Date().toLocaleString('id-ID')}</p>
    ${clone.outerHTML}
  </body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),500);
}
