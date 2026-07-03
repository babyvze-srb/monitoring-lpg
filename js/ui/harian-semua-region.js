/* ===== HARIAN SEMUA REGION ===== */
const HARI_NAMES_HSR=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

let hsrFilter={tgl:new Date().toISOString().split('T')[0],dari:'',sampai:'',tabung:'all',status:'all'};

function renderHarianSemuaRegion(){
  if(me.role!=='superadmin') return `<div class="card"><p style="color:var(--muted);text-align:center;padding:32px">🚫 Hanya Super Admin yang dapat mengakses halaman ini.</p></div>`;
  const allTx=S.transactions;
  const tx=getHsrFilteredTx(allTx);
  const allowedRegions=S.regions||REGIONS;
  const periode=getHsrPeriodeLabel();

  const filterHtml=`
  <div class="card" style="margin-bottom:16px">
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:14px;">🔍 Filter Laporan</div>
    <div class="form-grid" style="align-items:end">
      <div><label>Tanggal</label><input type="date" value="${hsrFilter.tgl}" onchange="hsrFilter.tgl=this.value;if(this.value){hsrFilter.dari='';hsrFilter.sampai='';}setContent(renderHarianSemuaRegion())"></div>
      <div><label>Dari Tanggal</label><input type="date" value="${hsrFilter.dari}" onchange="hsrFilter.dari=this.value;if(this.value)hsrFilter.tgl='';setContent(renderHarianSemuaRegion())"></div>
      <div><label>Sampai Tanggal</label><input type="date" value="${hsrFilter.sampai}" onchange="hsrFilter.sampai=this.value;if(this.value)hsrFilter.tgl='';setContent(renderHarianSemuaRegion())"></div>
      <div><label>Jenis Tabung</label>
        <select onchange="hsrFilter.tabung=this.value;setContent(renderHarianSemuaRegion())">
          <option value="all" ${hsrFilter.tabung==='all'?'selected':''}>Semua Jenis</option>
          <option value="50 KG" ${hsrFilter.tabung==='50 KG'?'selected':''}>50 KG</option>
          <option value="12 KG" ${hsrFilter.tabung==='12 KG'?'selected':''}>12 KG</option>
          <option value="5.5 KG" ${hsrFilter.tabung==='5.5 KG'?'selected':''}>5.5 KG</option>
        </select>
      </div>
      <div><label>Status Tabung</label>
        <select onchange="hsrFilter.status=this.value;setContent(renderHarianSemuaRegion())">
          <option value="all" ${hsrFilter.status==='all'?'selected':''}>Semua Status</option>
          <option value="ISI" ${hsrFilter.status==='ISI'?'selected':''}>ISI</option>
          <option value="KOSONG" ${hsrFilter.status==='KOSONG'?'selected':''}>KOSONG</option>
          <option value="BOCOR" ${hsrFilter.status==='BOCOR'?'selected':''}>BOCOR</option>
        </select>
      </div>
      <div><button class="btn btn-ghost" style="width:100%;font-size:11px" onclick="hsrFilter={tgl:new Date().toISOString().split('T')[0],dari:'',sampai:'',tabung:'all',status:'all'};setContent(renderHarianSemuaRegion())">↺ Reset</button></div>
    </div>
  </div>`;

  const dlBar=`<div class="dl-bar" style="margin-bottom:16px">
    <span>📥 Export:</span>
    <button class="btn btn-ghost btn-sm" onclick="hsrDownloadCSV()">⬇ CSV</button>
    <button class="btn btn-warn btn-sm" onclick="hsrDownloadExcel()">📊 Excel</button>
    <button class="btn btn-ghost btn-sm" style="border-color:#ef4444;color:#ef4444" onclick="window.print()">📄 Print / PDF</button>
  </div>`;

  if(tx.length===0){
    return filterHtml+`<div class="card"><div class="empty"><div class="ico">📭</div><p>Tidak ada transaksi ditemukan untuk filter yang dipilih.</p></div></div>`;
  }

  const dates=[...new Set(tx.map(t=>t.tanggal))].sort();
  let html=filterHtml+dlBar;
  html+=hsrRenderSummaryStats(tx,allowedRegions,periode);
  html+=hsrRenderRegionCards(tx,allowedRegions);
  html+=hsrRenderPerTabungTable(tx,allowedRegions);
  html+=hsrRenderDailyTable(tx,dates,allowedRegions);
  html+=hsrRenderDetailTable(tx,allowedRegions);
  return html;
}

function getHsrFilteredTx(allTx){
  let tx=[...allTx];
  if(hsrFilter.tgl) tx=tx.filter(t=>t.tanggal===hsrFilter.tgl);
  else{ if(hsrFilter.dari) tx=tx.filter(t=>t.tanggal>=hsrFilter.dari); if(hsrFilter.sampai) tx=tx.filter(t=>t.tanggal<=hsrFilter.sampai); }
  if(hsrFilter.tabung!=='all') tx=tx.filter(t=>t.tabung===hsrFilter.tabung);
  if(hsrFilter.status!=='all') tx=tx.filter(t=>t.status===hsrFilter.status);
  return tx;
}

function getHsrPeriodeLabel(){
  if(hsrFilter.tgl){const d=new Date(hsrFilter.tgl+'T00:00:00');return `${HARI_NAMES_HSR[d.getDay()]}, ${d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})}`;}
  if(hsrFilter.dari||hsrFilter.sampai){
    const f=hsrFilter.dari?new Date(hsrFilter.dari+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'...';
    const s=hsrFilter.sampai?new Date(hsrFilter.sampai+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'...';
    return `${f} s/d ${s}`;
  }
  return 'Semua data tahun '+CUR_YEAR;
}

function hsrRenderSummaryStats(tx,regions,periode){
  const totM=tx.filter(t=>t.type==='masuk').reduce((a,b)=>a+b.qty,0);
  const totK=tx.filter(t=>t.type==='keluar').reduce((a,b)=>a+b.qty,0);
  const dates=[...new Set(tx.map(t=>t.tanggal))];
  const saldo=totM-totK;
  const aktifReg=[...new Set(tx.map(t=>t.region))].length;
  return `<div class="stats-grid">
    <div class="stat-card stat-blue"><div class="val">${dates.length}</div><div class="lbl">Hari Aktif</div></div>
    <div class="stat-card stat-green"><div class="val">${totM.toLocaleString('id-ID')}</div><div class="lbl">Total Masuk</div></div>
    <div class="stat-card stat-red"><div class="val">${totK.toLocaleString('id-ID')}</div><div class="lbl">Total Keluar</div></div>
    <div class="stat-card stat-orange"><div class="val" style="color:${saldo>=0?'#f97316':'#ef4444'}">${saldo>=0?'+':''}${saldo.toLocaleString('id-ID')}</div><div class="lbl">Saldo Bersih</div></div>
    <div class="stat-card" style="border-left:3px solid var(--warn)"><div class="val">${tx.length}</div><div class="lbl">Total Transaksi</div></div>
    <div class="stat-card stat-blue"><div class="val">${aktifReg}</div><div class="lbl">Region Aktif</div></div>
  </div>`;
}

function hsrRenderRegionCards(tx,regions){
  const cards=regions.map(reg=>{
    const txReg=tx.filter(t=>t.region===reg);
    if(!txReg.length) return `<div class="stat-card" style="opacity:.5"><div class="lbl">📍 ${esc(reg)}</div><div style="font-size:11px;color:var(--muted);margin-top:6px">Tidak ada transaksi</div></div>`;
    const m=txReg.filter(t=>t.type==='masuk').reduce((a,b)=>a+b.qty,0);
    const k=txReg.filter(t=>t.type==='keluar').reduce((a,b)=>a+b.qty,0);
    const saldo=m-k;
    return `<div class="stat-card" style="border-left:3px solid var(--accent)">
      <div class="lbl">📍 ${esc(reg)}</div>
      <div style="margin-top:8px;font-size:11px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:var(--muted)">Masuk</span><span style="color:#34d399;font-weight:700">+${m.toLocaleString('id-ID')}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:var(--muted)">Keluar</span><span style="color:#f87171;font-weight:700">-${k.toLocaleString('id-ID')}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:var(--muted)">Saldo</span><span style="color:${saldo>=0?'var(--accent)':'#ef4444'};font-weight:800">${saldo>=0?'+':''}${saldo.toLocaleString('id-ID')}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Transaksi</span><span style="color:#60a5fa">${txReg.length} tx</span></div>
      </div>
    </div>`;
  }).join('');
  return `<div class="card-title" style="margin-bottom:10px">📍 Ringkasan Per Gudang / Region</div><div class="stats-grid" style="margin-bottom:18px">${cards}</div>`;
}

function hsrRenderDailyTable(tx,dates,regions){
  const displayTabs=hsrFilter.tabung==='all'?TABUNGS:[hsrFilter.tabung];
  const displaySts=hsrFilter.status==='all'?STATUSES:[hsrFilter.status];
  const hdrColors={'50 KG':'th-50','12 KG':'th-12','5.5 KG':'th-55'};
  const stColors={ISI:'#34d399',KOSONG:'#9ca3af',BOCOR:'#f87171'};
  let th1='',th2='',th3='';
  displayTabs.forEach(tb=>{
    th1+=`<th class="${hdrColors[tb]||''}" colspan="${displaySts.length*2}">${tb}</th>`;
    displaySts.forEach(st=>{ th2+=`<th style="background:rgba(0,0,0,.2);color:${stColors[st]};font-size:9px;border:1px solid var(--border)">${st}</th><th style="background:rgba(0,0,0,.2);color:${stColors[st]};font-size:9px;border:1px solid var(--border)">${st}</th>`; });
  });
  displayTabs.forEach(()=>displaySts.forEach(()=>{ th3+=`<th style="font-size:9px;color:#34d399;border:1px solid var(--border)">Masuk</th><th style="font-size:9px;color:#f87171;border:1px solid var(--border)">Keluar</th>`; }));

  let grandTotM=0,grandTotK=0;
  const grandByTab={};
  displayTabs.forEach(tb=>displaySts.forEach(st=>{grandByTab[tb+'_'+st]={m:0,k:0};}));
  let rows='';

  const allDatesInFilter=[...new Set(tx.map(t=>t.tanggal))].sort();
  const firstDateGlobal=allDatesInFilter.length>0?allDatesInFilter[0]:'';
  const txSebelumGlobal=S.transactions.filter(t=>t.tanggal<firstDateGlobal&&(S.regions||REGIONS).includes(t.region));
  let grandSaldoAwal=txSebelumGlobal.reduce((acc,t)=>acc+(t.type==='masuk'?+(+t.qty||0):-(+t.qty||0)),0);

  regions.forEach(reg=>{
    const txReg=tx.filter(t=>t.region===reg);
    const datesReg=[...new Set(txReg.map(t=>t.tanggal))].sort();
    if(!datesReg.length) return;
    let regTotM=0,regTotK=0;
    const regByTab={};
    displayTabs.forEach(tb=>displaySts.forEach(st=>{regByTab[tb+'_'+st]={m:0,k:0};}));

    const firstDateReg=datesReg[0];
    const txRegAll=S.transactions.filter(t=>t.region===reg&&t.year===CUR_YEAR);
    const txRegSebelum=txRegAll.filter(t=>t.tanggal<firstDateReg);
    let regSaldoBerjalan=txRegSebelum.reduce((acc,t)=>acc+(t.type==='masuk'?+(+t.qty||0):-(+t.qty||0)),0);
    const regSaldoAwal=regSaldoBerjalan;

    let dateRows='';
    datesReg.forEach(tgl=>{
      const txDay=txReg.filter(t=>t.tanggal===tgl);
      const dayM=txDay.filter(t=>t.type==='masuk').reduce((a,b)=>a+b.qty,0);
      const dayK=txDay.filter(t=>t.type==='keluar').reduce((a,b)=>a+b.qty,0);
      regTotM+=dayM; regTotK+=dayK; grandTotM+=dayM; grandTotK+=dayK;
      const d=new Date(tgl+'T00:00:00');
      const tglFmt=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
      const hariN=['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()];
      const saldoAwalHari=regSaldoBerjalan;
      const saldoAkhirHari=regSaldoBerjalan+dayM-dayK;
      regSaldoBerjalan=saldoAkhirHari;
      let cells='';
      displayTabs.forEach(tb=>displaySts.forEach(st=>{
        const m2=txDay.filter(t=>t.type==='masuk'&&t.tabung===tb&&t.status===st).reduce((a,b)=>a+b.qty,0);
        const k2=txDay.filter(t=>t.type==='keluar'&&t.tabung===tb&&t.status===st).reduce((a,b)=>a+b.qty,0);
        regByTab[tb+'_'+st].m+=m2; regByTab[tb+'_'+st].k+=k2;
        grandByTab[tb+'_'+st].m+=m2; grandByTab[tb+'_'+st].k+=k2;
        cells+=`<td class="${m2>0?'masuk-cell':''}"> ${m2>0?'+'+m2:'-'}</td><td class="${k2>0?'keluar-cell':''}">${k2>0?'-'+k2:'-'}</td>`;
      }));
      dateRows+=`<tr><td style="white-space:nowrap"><b>${tglFmt}</b> <span style="color:var(--muted);font-size:10px">${hariN}</span></td>
        <td><span style="background:rgba(59,130,246,.1);color:#60a5fa;padding:2px 6px;border-radius:99px;font-size:10px;font-weight:700">${txDay.length}</span></td>
        <td style="color:${saldoAwalHari<0?'#ef4444':'#fbbf24'};font-weight:700">${saldoAwalHari}</td>
        <td class="masuk-cell">${dayM>0?'+'+dayM:'-'}</td><td class="keluar-cell">${dayK>0?'-'+dayK:'-'}</td>
        <td class="${saldoAkhirHari>0?'akhir-cell':saldoAkhirHari<0?'akhir-neg':''}">${saldoAkhirHari>0?'+'+saldoAkhirHari:saldoAkhirHari}</td>${cells}</tr>`;
    });
    let regSubCells='';
    displayTabs.forEach(tb=>displaySts.forEach(st=>{
      const {m,k}=regByTab[tb+'_'+st];
      regSubCells+=`<td style="color:#34d399;font-weight:700">${m>0?'+'+m:'-'}</td><td style="color:#f87171;font-weight:700">${k>0?'-'+k:'-'}</td>`;
    }));
    const regSaldoAkhir=regSaldoAwal+regTotM-regTotK;
    rows+=`<tr style="background:rgba(249,115,22,.06)"><td colspan="${7+displayTabs.length*displaySts.length*2}" style="color:var(--accent);font-weight:800;font-size:11px;text-align:left;padding:6px 10px">📍 ${esc(reg)}</td></tr>
      ${dateRows}
      <tr class="monitor-tbl" style="background:var(--surface3);font-weight:800;border-top:2px solid var(--border)">
        <td style="text-align:left;padding:7px 10px;color:var(--text)">Total ${esc(reg)}</td>
        <td style="color:var(--muted)">${txReg.length}</td>
        <td style="color:#fbbf24;font-weight:700">${regSaldoAwal}</td>
        <td class="masuk-cell">+${regTotM}</td><td class="keluar-cell">-${regTotK}</td>
        <td class="${regSaldoAkhir>=0?'akhir-cell':'akhir-neg'}">${regSaldoAkhir>=0?'+':''}${regSaldoAkhir}</td>${regSubCells}
      </tr>`;
  });
  let grandCells='';
  displayTabs.forEach(tb=>displaySts.forEach(st=>{
    const {m,k}=grandByTab[tb+'_'+st];
    grandCells+=`<td style="color:#34d399;font-weight:800">${m>0?'+'+m:'-'}</td><td style="color:#f87171;font-weight:800">${k>0?'-'+k:'-'}</td>`;
  }));
  const grandSaldoAkhir=grandSaldoAwal+grandTotM-grandTotK;
  rows+=`<tr style="background:var(--surface4);font-weight:800;border-top:2px solid var(--accent)">
    <td style="text-align:left;padding:8px 10px;color:var(--accent)">GRAND TOTAL</td>
    <td style="color:var(--muted)">${tx.length}</td>
    <td style="color:#fbbf24;font-weight:800">${grandSaldoAwal}</td>
    <td style="color:#34d399;font-weight:800">+${grandTotM}</td><td style="color:#f87171;font-weight:800">-${grandTotK}</td>
    <td style="color:${grandSaldoAkhir>=0?'var(--accent)':'#ef4444'};font-weight:800">${grandSaldoAkhir>=0?'+':''}${grandSaldoAkhir}</td>${grandCells}
  </tr>`;
  return `<div class="card" style="padding:0;margin-bottom:18px;overflow:hidden">
    <div style="padding:11px 16px;border-bottom:1px solid var(--border);background:var(--surface3);display:flex;align-items:center;justify-content:space-between">
      <span class="card-title" style="margin:0">📅 Laporan Harian Per Region</span>
      <span style="font-size:11px;color:var(--muted)">${dates.length} hari aktif · ${tx.length} transaksi</span>
    </div>
    <div class="monitor-wrap" style="padding:0">
      <table class="monitor-tbl" style="min-width:900px">
        <thead>
          <tr><th class="th-group" rowspan="3" style="min-width:80px;text-align:left">TANGGAL</th><th class="th-group" rowspan="3">TX</th><th class="th-group" rowspan="3" style="color:#fbbf24;background:rgba(234,179,8,.12)">SALDO AWAL</th><th class="th-group" rowspan="3" style="color:#34d399">MASUK</th><th class="th-group" rowspan="3" style="color:#f87171">KELUAR</th><th class="th-group" rowspan="3">SALDO</th>${th1}</tr>
          <tr>${th2}</tr><tr>${th3}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function hsrRenderDetailTable(tx,regions){
  const sorted=[...tx].sort((a,b)=>a.tanggal.localeCompare(b.tanggal)||(a.region.localeCompare(b.region))||(a.type==='masuk'?-1:1));
  let rows='';
  sorted.forEach((t,idx)=>{
    const prev=idx>0?sorted[idx-1]:null;
    if(!prev||prev.tanggal!==t.tanggal){
      const d=new Date(t.tanggal+'T00:00:00');
      const tglFmt=d.toLocaleDateString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
      rows+=`<tr><td colspan="8" style="background:var(--surface4);color:#60a5fa;font-weight:700;font-size:11px;padding:6px 10px;text-align:left">📅 ${tglFmt}</td></tr>`;
    }
    rows+=`<tr>
      <td style="text-align:left;padding:6px 9px"><span style="background:rgba(59,130,246,.12);color:#60a5fa;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700">${esc(t.region)}</span></td>
      <td><span class="badge badge-${esc(t.type)}">${t.type==='masuk'?'📥 Masuk':'📤 Keluar'}</span></td>
      <td style="font-size:11px">${esc(t.tabung)}</td>
      <td><span class="badge badge-${esc(String(t.status).toLowerCase())}">${esc(t.status)}</span></td>
      <td style="color:${t.type==='masuk'?'#34d399':'#f87171'};font-weight:800">${t.type==='masuk'?'+':'-'}${esc(t.qty)}</td>
      <td style="font-size:11px;color:var(--muted)">${esc(t.noSj)||'—'}</td>
      <td style="font-size:11px;color:var(--muted)">${esc(t.pihak)||'—'}</td>
      <td style="font-size:11px;color:var(--muted);text-align:left">${esc(t.ket)||'—'}</td>
    </tr>`;
  });
  return `<div class="card" style="padding:0;margin-bottom:18px;overflow:hidden">
    <div style="padding:11px 16px;border-bottom:1px solid var(--border);background:var(--surface3);display:flex;align-items:center;justify-content:space-between">
      <span class="card-title" style="margin:0">📋 Detail Seluruh Transaksi</span>
      <span style="font-size:11px;color:var(--muted)">${tx.length} transaksi</span>
    </div>
    <div class="monitor-wrap" style="padding:0">
      <table class="riwayat-tbl" style="min-width:750px">
        <thead><tr><th style="text-align:left">Region</th><th>Tipe</th><th>Jenis Tabung</th><th>Status</th><th>QTY</th><th>No. SJ</th><th>Supplier / Customer</th><th style="text-align:left">Keterangan</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function hsrRenderPerTabungTable(tx,regions){
  const displayTabs=hsrFilter.tabung==='all'?TABUNGS:[hsrFilter.tabung];
  const displaySts=hsrFilter.status==='all'?STATUSES:[hsrFilter.status];
  const hdrColors={'50 KG':'th-50','12 KG':'th-12','5.5 KG':'th-55'};
  const stColors={ISI:'#34d399',KOSONG:'#9ca3af',BOCOR:'#f87171'};

  let firstDateFilter='';
  if(hsrFilter.tgl) firstDateFilter=hsrFilter.tgl;
  else if(hsrFilter.dari) firstDateFilter=hsrFilter.dari;
  else { const allDates=[...new Set(tx.map(t=>t.tanggal))].sort(); firstDateFilter=allDates[0]||''; }

  let th1='',th2='',th3='';
  displayTabs.forEach(tb=>{
    th1+=`<th class="${hdrColors[tb]||''}" colspan="${displaySts.length*4}">${tb}</th>`;
    displaySts.forEach(st=>{ th2+=`<th colspan="4" style="background:rgba(0,0,0,.2);color:${stColors[st]};font-size:9px;border:1px solid var(--border)">${st}</th>`; });
  });
  displayTabs.forEach(()=>displaySts.forEach(()=>{ th3+=`<th style="font-size:9px;color:#fbbf24;border:1px solid var(--border)">Saldo Awal</th><th style="font-size:9px;color:#34d399;border:1px solid var(--border)">Masuk</th><th style="font-size:9px;color:#f87171;border:1px solid var(--border)">Keluar</th><th style="font-size:9px;color:var(--accent);border:1px solid var(--border)">Saldo</th>`; }));

  let rows='';
  const grandSaldoAwal={};
  const grandMasuk={};
  const grandKeluar={};
  displayTabs.forEach(tb=>displaySts.forEach(st=>{
    const key=tb+'_'+st;
    grandSaldoAwal[key]=0; grandMasuk[key]=0; grandKeluar[key]=0;
  }));

  regions.forEach(reg=>{
    const txRegAll=S.transactions.filter(t=>t.region===reg);
    let cells=''; let hasData=false;
    displayTabs.forEach(tb=>displaySts.forEach(st=>{
      const key=tb+'_'+st;
      const saldoAwal=firstDateFilter
        ? txRegAll.filter(t=>t.tabung===tb&&t.status===st&&t.tanggal<firstDateFilter)
            .reduce((a,t)=>a+(t.type==='masuk'?(+t.qty||0):-(+t.qty||0)),0)
        : 0;
      const m=tx.filter(t=>t.region===reg&&t.type==='masuk'&&t.tabung===tb&&t.status===st).reduce((a,b)=>a+b.qty,0);
      const k=tx.filter(t=>t.region===reg&&t.type==='keluar'&&t.tabung===tb&&t.status===st).reduce((a,b)=>a+b.qty,0);
      const saldoAkhir=saldoAwal+m-k;
      if(m>0||k>0||saldoAwal!==0) hasData=true;
      grandSaldoAwal[key]+=saldoAwal; grandMasuk[key]+=m; grandKeluar[key]+=k;
      const saDisp=saldoAwal!==0?(saldoAwal>0?'+':'')+saldoAwal:'-';
      cells+=`<td style="color:#fbbf24;font-weight:700">${saDisp}</td><td class="${m>0?'masuk-cell':''}">${m>0?'+'+m:'-'}</td><td class="${k>0?'keluar-cell':''}">${k>0?'-'+k:'-'}</td><td class="${saldoAkhir>0?'akhir-cell':saldoAkhir<0?'akhir-neg':''}">${saldoAkhir!==0?(saldoAkhir>0?'+':'')+saldoAkhir:'-'}</td>`;
    }));
    rows+=`<tr style="${!hasData?'opacity:.5':''}"><td class="region-cell">📍 ${esc(reg)}</td>${cells}</tr>`;
  });

  let grandCells='';
  displayTabs.forEach(tb=>displaySts.forEach(st=>{
    const key=tb+'_'+st;
    const sa=grandSaldoAwal[key]; const m=grandMasuk[key]; const k=grandKeluar[key];
    const sAkhir=sa+m-k;
    const saDisp=sa!==0?(sa>0?'+':'')+sa:'-';
    grandCells+=`<td style="color:#fbbf24;font-weight:800">${saDisp}</td><td style="color:#34d399;font-weight:800">${m>0?'+'+m:'-'}</td><td style="color:#f87171;font-weight:800">${k>0?'-'+k:'-'}</td><td style="color:${sAkhir>=0?'var(--accent)':'#ef4444'};font-weight:800">${sAkhir!==0?(sAkhir>0?'+':'')+sAkhir:'-'}</td>`;
  }));
  rows+=`<tr style="background:var(--surface3);font-weight:800;border-top:2px solid var(--border)"><td style="text-align:left;padding:8px 12px;color:var(--accent)">TOTAL SEMUA REGION</td>${grandCells}</tr>`;
  return `<div class="card" style="padding:0;overflow:hidden">
    <div style="padding:11px 16px;border-bottom:1px solid var(--border);background:var(--surface3)">
      <span class="card-title" style="margin:0">🗂️ Rekap Per Jenis Tabung & Status</span>
    </div>
    <div class="monitor-wrap" style="padding:0">
      <table class="monitor-tbl" style="min-width:700px">
        <thead>
          <tr><th class="th-group" rowspan="3" style="text-align:left;min-width:120px">GUDANG / REGION</th>${th1}</tr>
          <tr>${th2}</tr><tr>${th3}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function hsrDownloadCSV(){
  const tx=getHsrFilteredTx(S.transactions);
  if(!tx.length){showAlert('Tidak ada data untuk diekspor','error');return;}
  const allowedRegions=S.regions||REGIONS;
  const displayTabs=hsrFilter.tabung==='all'?TABUNGS:[hsrFilter.tabung];
  const displaySts=hsrFilter.status==='all'?STATUSES:[hsrFilter.status];

  const sorted=[...tx].sort((a,b)=>a.tanggal.localeCompare(b.tanggal)||a.region.localeCompare(b.region));
  const header='Tanggal,Region,Tipe,Jenis Tabung,Status,QTY,No. SJ,Supplier/Customer,Keterangan\n';
  const rows=sorted.map(t=>{
    const d=new Date(t.tanggal+'T00:00:00');
    const tglFmt=d.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'});
    return `"${tglFmt}","${t.region}","${t.type}","${t.tabung}","${t.status}","${t.qty}","${t.noSj||''}","${t.pihak||''}","${(t.ket||'').replace(/"/g,"'")}"`;
  }).join('\n');

  let firstDateFilter='';
  if(hsrFilter.tgl) firstDateFilter=hsrFilter.tgl;
  else if(hsrFilter.dari) firstDateFilter=hsrFilter.dari;
  else{const allDates=[...new Set(tx.map(t=>t.tanggal))].sort();firstDateFilter=allDates[0]||'';}

  const rekapCols=[];
  displayTabs.forEach(tb=>displaySts.forEach(st=>{
    rekapCols.push(`"${tb} – ${st} – Saldo Awal"`,`"${tb} – ${st} – Masuk"`,`"${tb} – ${st} – Keluar"`,`"${tb} – ${st} – Saldo Akhir"`);
  }));
  let rekapSection='\n\n=== REKAP PER JENIS TABUNG & STATUS ===\n';
  rekapSection+='Gudang / Region,'+rekapCols.join(',')+'\n';

  const grandSAc={},grandMc={},grandKc={};
  displayTabs.forEach(tb=>displaySts.forEach(st=>{const k=tb+'_'+st;grandSAc[k]=0;grandMc[k]=0;grandKc[k]=0;}));

  allowedRegions.forEach(reg=>{
    const txRegAll=S.transactions.filter(t=>t.region===reg);
    const cells=[];
    displayTabs.forEach(tb=>displaySts.forEach(st=>{
      const key=tb+'_'+st;
      const sa=firstDateFilter?txRegAll.filter(t=>t.tabung===tb&&t.status===st&&t.tanggal<firstDateFilter).reduce((a,t)=>a+(t.type==='masuk'?(+t.qty||0):-(+t.qty||0)),0):0;
      const m=tx.filter(t=>t.region===reg&&t.type==='masuk'&&t.tabung===tb&&t.status===st).reduce((a,b)=>a+b.qty,0);
      const k=tx.filter(t=>t.region===reg&&t.type==='keluar'&&t.tabung===tb&&t.status===st).reduce((a,b)=>a+b.qty,0);
      const sAkhir=sa+m-k;
      grandSAc[key]+=sa;grandMc[key]+=m;grandKc[key]+=k;
      cells.push(sa,m,k,sAkhir);
    }));
    rekapSection+=`"📍 ${reg}",`+cells.join(',')+'\n';
  });
  const grandCells=[];
  displayTabs.forEach(tb=>displaySts.forEach(st=>{
    const key=tb+'_'+st;const sa=grandSAc[key];const m=grandMc[key];const k=grandKc[key];
    grandCells.push(sa,m,k,sa+m-k);
  }));
  rekapSection+='"TOTAL SEMUA REGION",'+grandCells.join(',')+'\n';

  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(header+rows+rekapSection);
  a.download=`LaporanHarian_SemuaRegion_${hsrFilter.tgl||new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showAlert('✅ File CSV berhasil diunduh');
}

function hsrDownloadExcel(){
  const tx=getHsrFilteredTx(S.transactions);
  if(!tx.length){showAlert('Tidak ada data untuk diekspor','error');return;}
  const periode=getHsrPeriodeLabel();
  const allowedRegions=S.regions||REGIONS;
  const displayTabs=hsrFilter.tabung==='all'?TABUNGS:[hsrFilter.tabung];
  const displaySts=hsrFilter.status==='all'?STATUSES:[hsrFilter.status];
  let html=`<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:11px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #aaa;padding:5px 8px;text-align:center;}th{background:#1a1a3a;color:#fff;font-weight:bold;}.th-50{background:#c2410c;color:#fff;}.th-12{background:#1d4ed8;color:#fff;}.th-55{background:#065f46;color:#fff;}.td-reg{background:#1e2538;font-weight:bold;text-align:left;}.td-reg-h{background:#ffe8d6;color:#c2410c;font-weight:bold;text-align:left;}.td-m{color:#065f46;font-weight:bold;}.td-k{color:#991b1b;font-weight:bold;}.td-s-pos{color:#c2410c;font-weight:bold;}.td-s-neg{color:#991b1b;font-weight:bold;}.tr-total{background:#dde;font-weight:bold;}.grand{background:#1a1a3a;color:#fff;font-weight:bold;}h2{font-size:14px;margin-bottom:4px;}h3{font-size:12px;margin:18px 0 6px;}p{font-size:10px;color:#555;margin-bottom:10px;}</style></head><body>`;
  html+=`<h2>🔥 Laporan Harian LPG – Semua Region</h2><p>Periode: ${periode} | Total: ${tx.length} transaksi | Dicetak: ${new Date().toLocaleString('id-ID')}</p>`;
  const stColors={ISI:'#065f46',KOSONG:'#6b7280',BOCOR:'#991b1b'};
  let th1e='',th2e='',th3e='';
  displayTabs.forEach(tb=>{
    th1e+=`<th class="th-${tb==='50 KG'?'50':tb==='12 KG'?'12':'55'}" colspan="${displaySts.length*2}">${tb}</th>`;
    displaySts.forEach(st=>{th2e+=`<th colspan="2" style="color:${stColors[st]};background:#eee">${st}</th>`;});
  });
  displayTabs.forEach(()=>displaySts.forEach(()=>{th3e+=`<th style="color:#065f46">M</th><th style="color:#991b1b">K</th>`;}));
  html+=`<h3>Laporan Harian Per Gudang</h3><table><thead><tr><th rowspan="3" style="text-align:left">Tanggal</th><th rowspan="3">TX</th><th rowspan="3" style="color:#065f46">Masuk</th><th rowspan="3" style="color:#991b1b">Keluar</th><th rowspan="3">Saldo</th>${th1e}</tr><tr>${th2e}</tr><tr>${th3e}</tr></thead><tbody>`;
  let grandTotM2=0,grandTotK2=0;
  const grandByTab2={};
  displayTabs.forEach(tb=>displaySts.forEach(st=>{grandByTab2[tb+'_'+st]={m:0,k:0};}));
  allowedRegions.forEach(reg=>{
    const txReg=tx.filter(t=>t.region===reg);
    const datesReg=[...new Set(txReg.map(t=>t.tanggal))].sort();
    if(!datesReg.length) return;
    let rM=0,rK=0;
    const rTab={};
    displayTabs.forEach(tb=>displaySts.forEach(st=>{rTab[tb+'_'+st]={m:0,k:0};}));
    html+=`<tr class="td-reg-h"><td colspan="${5+displayTabs.length*displaySts.length*2}" style="text-align:left;padding:5px 8px">📍 ${reg}</td></tr>`;
    datesReg.forEach(tgl=>{
      const txDay=txReg.filter(t=>t.tanggal===tgl);
      const dM=txDay.filter(t=>t.type==='masuk').reduce((a,b)=>a+b.qty,0);
      const dK=txDay.filter(t=>t.type==='keluar').reduce((a,b)=>a+b.qty,0);
      rM+=dM; rK+=dK; grandTotM2+=dM; grandTotK2+=dK;
      const d=new Date(tgl+'T00:00:00');
      const tglFmt=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      const hariN=['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()];
      const saldo=dM-dK;
      let cells='';
      displayTabs.forEach(tb=>displaySts.forEach(st=>{
        const m2=txDay.filter(t=>t.type==='masuk'&&t.tabung===tb&&t.status===st).reduce((a,b)=>a+b.qty,0);
        const k2=txDay.filter(t=>t.type==='keluar'&&t.tabung===tb&&t.status===st).reduce((a,b)=>a+b.qty,0);
        rTab[tb+'_'+st].m+=m2; rTab[tb+'_'+st].k+=k2; grandByTab2[tb+'_'+st].m+=m2; grandByTab2[tb+'_'+st].k+=k2;
        cells+=`<td class="td-m">${m2>0?'+'+m2:'-'}</td><td class="td-k">${k2>0?'-'+k2:'-'}</td>`;
      }));
      html+=`<tr><td style="text-align:left;white-space:nowrap">${tglFmt} (${hariN})</td><td>${txDay.length}</td><td class="td-m">${dM>0?'+'+dM:'-'}</td><td class="td-k">${dK>0?'-'+dK:'-'}</td><td class="${saldo>0?'td-s-pos':saldo<0?'td-s-neg':''}">${saldo>0?'+'+saldo:saldo}</td>${cells}</tr>`;
    });
    let rSubCells='';
    displayTabs.forEach(tb=>displaySts.forEach(st=>{const {m,k}=rTab[tb+'_'+st]; rSubCells+=`<td class="td-m">${m>0?'+'+m:'-'}</td><td class="td-k">${k>0?'-'+k:'-'}</td>`;}));
    const rS=rM-rK;
    html+=`<tr class="tr-total"><td style="text-align:left">Total ${reg}</td><td>${txReg.length}</td><td class="td-m">+${rM}</td><td class="td-k">-${rK}</td><td class="${rS>=0?'td-s-pos':'td-s-neg'}">${rS>=0?'+':''}${rS}</td>${rSubCells}</tr>`;
  });
  let grandC2='';
  displayTabs.forEach(tb=>displaySts.forEach(st=>{const {m,k}=grandByTab2[tb+'_'+st]; grandC2+=`<td class="td-m">${m>0?'+'+m:'-'}</td><td class="td-k">${k>0?'-'+k:'-'}</td>`;}));
  const gS=grandTotM2-grandTotK2;
  html+=`<tr class="grand"><td style="text-align:left">GRAND TOTAL</td><td>${tx.length}</td><td>+${grandTotM2}</td><td>-${grandTotK2}</td><td>${gS>=0?'+':''}${gS}</td>${grandC2}</tr></tbody></table>`;

  /* TABEL REKAP PER JENIS TABUNG & STATUS */
  let th1r='',th2r='',th3r='';
  displayTabs.forEach(tb=>{
    th1r+=`<th class="th-${tb==='50 KG'?'50':tb==='12 KG'?'12':'55'}" colspan="${displaySts.length*4}">${tb}</th>`;
    displaySts.forEach(st=>{th2r+=`<th colspan="4" style="color:${stColors[st]};background:#eee">${st}</th>`;});
  });
  displayTabs.forEach(()=>displaySts.forEach(()=>{th3r+=`<th style="color:#856404">Saldo Awal</th><th style="color:#065f46">Masuk</th><th style="color:#991b1b">Keluar</th><th style="color:#c2410c">Saldo Akhir</th>`;}));
  let firstDateFilter='';
  if(hsrFilter.tgl) firstDateFilter=hsrFilter.tgl;
  else if(hsrFilter.dari) firstDateFilter=hsrFilter.dari;
  else{const allDates=[...new Set(tx.map(t=>t.tanggal))].sort();firstDateFilter=allDates[0]||'';}
  const grandSAr={},grandMr={},grandKr={};
  displayTabs.forEach(tb=>displaySts.forEach(st=>{const k=tb+'_'+st;grandSAr[k]=0;grandMr[k]=0;grandKr[k]=0;}));
  html+=`<h3>🗂️ Rekap Per Jenis Tabung &amp; Status</h3><table><thead><tr><th rowspan="3" style="text-align:left">GUDANG / REGION</th>${th1r}</tr><tr>${th2r}</tr><tr>${th3r}</tr></thead><tbody>`;
  allowedRegions.forEach(reg=>{
    const txRegAll=S.transactions.filter(t=>t.region===reg);
    let rowCells='';
    displayTabs.forEach(tb=>displaySts.forEach(st=>{
      const key=tb+'_'+st;
      const sa=firstDateFilter?txRegAll.filter(t=>t.tabung===tb&&t.status===st&&t.tanggal<firstDateFilter).reduce((a,t)=>a+(t.type==='masuk'?(+t.qty||0):-(+t.qty||0)),0):0;
      const m=tx.filter(t=>t.region===reg&&t.type==='masuk'&&t.tabung===tb&&t.status===st).reduce((a,b)=>a+b.qty,0);
      const k=tx.filter(t=>t.region===reg&&t.type==='keluar'&&t.tabung===tb&&t.status===st).reduce((a,b)=>a+b.qty,0);
      const sAkhir=sa+m-k;
      grandSAr[key]+=sa;grandMr[key]+=m;grandKr[key]+=k;
      rowCells+=`<td style="color:#856404;font-weight:bold">${sa!==0?(sa>0?'+':'')+sa:'-'}</td><td class="td-m">${m>0?'+'+m:'-'}</td><td class="td-k">${k>0?'-'+k:'-'}</td><td style="color:${sAkhir>0?'#c2410c':sAkhir<0?'#991b1b':'#555'};font-weight:bold">${sAkhir!==0?(sAkhir>0?'+':'')+sAkhir:'-'}</td>`;
    }));
    html+=`<tr><td style="text-align:left;font-weight:bold">📍 ${reg}</td>${rowCells}</tr>`;
  });
  let grandRowR='';
  displayTabs.forEach(tb=>displaySts.forEach(st=>{
    const key=tb+'_'+st;const sa=grandSAr[key];const m=grandMr[key];const k=grandKr[key];const sAkhir=sa+m-k;
    grandRowR+=`<td style="color:#856404;font-weight:bold">${sa!==0?(sa>0?'+':'')+sa:'-'}</td><td class="td-m">${m>0?'+'+m:'-'}</td><td class="td-k">${k>0?'-'+k:'-'}</td><td style="color:${sAkhir>=0?'#c2410c':'#991b1b'};font-weight:bold">${sAkhir!==0?(sAkhir>0?'+':'')+sAkhir:'-'}</td>`;
  }));
  html+=`<tr class="grand"><td style="text-align:left">TOTAL SEMUA REGION</td>${grandRowR}</tr></tbody></table>`;

  const sortedDetail=[...tx].sort((a,b)=>a.tanggal.localeCompare(b.tanggal)||a.region.localeCompare(b.region));
  html+=`<h3>Detail Seluruh Transaksi</h3><table><thead><tr><th>Tanggal</th><th>Region</th><th>Tipe</th><th>Jenis Tabung</th><th>Status</th><th>QTY</th><th>No. SJ</th><th>Supplier/Customer</th><th>Keterangan</th></tr></thead><tbody>`;
  sortedDetail.forEach(t=>{
    const d=new Date(t.tanggal+'T00:00:00');
    html+=`<tr><td>${d.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'})}</td><td style="text-align:left">${t.region}</td><td>${t.type==='masuk'?'Masuk':'Keluar'}</td><td>${t.tabung}</td><td>${t.status}</td><td class="${t.type==='masuk'?'td-m':'td-k'}">${t.type==='masuk'?'+':'-'}${t.qty}</td><td>${t.noSj||'—'}</td><td style="text-align:left">${t.pihak||'—'}</td><td style="text-align:left">${t.ket||'—'}</td></tr>`;
  });
  html+=`</tbody></table><p style="margin-top:14px;font-size:10px;color:#888">Dibuat oleh: ${me?.name||'Sistem'} (${me?.role==='superadmin'?'Super Admin':'Operator'}) · ${new Date().toLocaleString('id-ID')}</p></body></html>`;
  const a=document.createElement('a');
  a.href='data:application/vnd.ms-excel;charset=utf-8,\uFEFF'+encodeURIComponent(html);
  a.download=`LaporanHarian_SemuaRegion_${hsrFilter.tgl||new Date().toISOString().split('T')[0]}.xls`;
  a.click();
  showAlert('✅ File Excel berhasil diunduh');
}
