/* ===== DASHBOARD ===== */
function renderDashboard(){
  const isSA=me.role==='superadmin';
  const regs=isSA?(S.regions||REGIONS):(me.region?[me.region]:[]);
  const mi=activeMonth;
  let tM=0,tK=0,txToday=0;
  S.transactions.forEach(t=>{
    if(!regs.includes(t.region)||t.year!==CUR_YEAR) return;
    if(t.monthIdx===mi){ if(t.type==='masuk')tM+=(+t.qty||0); else tK+=(+t.qty||0); }
    if(t.tanggal===new Date().toISOString().split('T')[0])txToday++;
  });
  const regRows=regs.map(r=>{
    const m=S.transactions.filter(t=>t.region===r&&t.type==='masuk'&&t.monthIdx===mi&&t.year===CUR_YEAR).reduce((a,b)=>a+(+b.qty||0),0);
    const k=S.transactions.filter(t=>t.region===r&&t.type==='keluar'&&t.monthIdx===mi&&t.year===CUR_YEAR).reduce((a,b)=>a+(+b.qty||0),0);
    return `<tr><td><b>${esc(r)}</b></td><td style="color:#34d399">${m}</td><td style="color:#f87171">${k}</td><td style="color:${m-k>=0?'var(--accent)':'#ef4444'}"><b>${m-k}</b></td></tr>`;
  }).join('');
  const recent=[...S.transactions].filter(t=>regs.includes(t.region)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,8);
  const recRows=recent.length?recent.map(t=>`<tr>
    <td>${esc(t.tanggal)}</td>
    <td><span class="badge badge-${esc(t.type)}">${t.type==='masuk'?'📥':'📤'} ${esc(t.type)}</span></td>
    <td>${esc(t.region)}</td><td style="font-size:11px">${esc(t.tabung)}</td>
    <td><span class="badge badge-${esc(String(t.status).toLowerCase())}">${esc(t.status)}</span></td>
    <td><b>${esc(t.qty)}</b></td>
  </tr>`).join(''):`<tr><td colspan="6" class="empty"><div class="ico">📭</div>Belum ada transaksi</td></tr>`;
  return `
  <div class="stats-grid">
    <div class="stat-card stat-green"><div class="val">${tM}</div><div class="lbl">Masuk ${MONTHS[mi]}</div></div>
    <div class="stat-card stat-red"><div class="val">${tK}</div><div class="lbl">Keluar ${MONTHS[mi]}</div></div>
    <div class="stat-card stat-orange"><div class="val">${txToday}</div><div class="lbl">Transaksi Hari Ini</div></div>
    <div class="stat-card stat-blue"><div class="val">${S.transactions.filter(t=>regs.includes(t.region)).length}</div><div class="lbl">Total Transaksi</div></div>
  </div>
  <div class="dashboard-grid" style="display:grid;grid-template-columns:1fr 1.6fr;gap:16px">
    <div class="card">
      <div class="card-title">📍 Per Region – ${MONTHS[mi]}</div>
      <table class="riwayat-tbl"><tr><th>Region</th><th>Masuk</th><th>Keluar</th><th>Saldo</th></tr>${regRows}</table>
    </div>
    <div class="card">
      <div class="card-title">🕐 Transaksi Terbaru</div>
      <table class="riwayat-tbl"><tr><th>Tanggal</th><th>Tipe</th><th>Region</th><th>Tabung</th><th>Status</th><th>Qty</th></tr>${recRows}</table>
    </div>
  </div>`;
}
