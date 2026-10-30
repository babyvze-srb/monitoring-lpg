/* ===== DASHBOARD ===== */
let dashStatus=null;

function dashRegs(){
  return me.role==='superadmin'?(S.regions||REGIONS):(me.region?[me.region]:[]);
}
function renderDashboard(){
  const regs=dashRegs();
  const mi=activeMonth, today=localDate();
  const tx=catTx().filter(t=>regs.includes(t.region)&&t.year===CUR_YEAR);
  const inMonth=tx.filter(t=>t.monthIdx===mi);
  const tM=inMonth.filter(t=>t.type==='masuk').reduce((a,b)=>a+(+b.qty||0),0);
  const tK=inMonth.filter(t=>t.type==='keluar').reduce((a,b)=>a+(+b.qty||0),0);
  const txToday=tx.filter(t=>t.tanggal===today).length;
  const related=S.transfers.filter(x=>me.role==='superadmin'||regs.some(r=>r===x.origin||r===x.destination||r===x.currentLocation));
  const active=related.filter(x=>['menunggu','jalan','singgah'].includes(x.status));
  return `
  ${!S.schemaV3&&me.role==='superadmin'?`<div class="alert alert-info"><span><b>Fitur baru belum aktif.</b> Jalankan <code>supabase/migration_v3_multiproduk_transfer.sql</code> di Supabase SQL Editor untuk mengaktifkan pelumas dan transfer barcode.</span></div>`:''}
  ${S.schemaV3?`<div class="cat-tiles">${CATEGORY_KEYS.map(c=>catTile(c,regs)).join('')}</div>`:''}
  <div class="kpi-row">
    ${dashKpi(`Masuk ${MONTHS[mi]}`,tM,'bi-box-arrow-in-down','green')}
    ${dashKpi(`Keluar ${MONTHS[mi]}`,tK,'bi-box-arrow-up','orange')}
    ${dashKpi('Transaksi hari ini',txToday,'bi-receipt','blue')}
    ${dashKpi('Transfer aktif',active.length,'bi-truck','violet')}
  </div>
  <div class="dash-grid">
    <div class="card">
      <div class="card-title"><span>Arus barang 14 hari</span>
        <span class="legend"><span><i class="key key-in"></i>Masuk</span><span><i class="key key-out"></i>Keluar</span></span></div>
      ${flowChart(tx)}
    </div>
    <div class="card">
      <div class="card-title"><span>Transfer berjalan</span>${S.schemaV3?`<a class="link" href="${BASE_URL}/pages/transfer/transfer.html">Lihat semua</a>`:''}</div>
      ${transferFeed(active)}
    </div>
  </div>
  ${stockMatrix(regs)}
  <div class="card card-flush">
    <div class="card-title pad">Transaksi terbaru</div>
    <div class="monitor-wrap">${recentTable(tx)}</div>
  </div>`;
}
function dashKpi(label,val,icon,color){
  return `<div class="kpi" style="--c:var(--c-${color})"><div class="kpi-top"><span>${label}</span><i class="bi ${icon}"></i></div><div class="kpi-val">${fmtNum(val)}</div></div>`;
}
function catTile(c,regs){
  const st=goodStatus(c), meta=catMeta(c);
  const prods=productsOf(c).map(p=>p.name);
  const total=regs.reduce((a,r)=>a+prods.reduce((b,p)=>b+stockNow(r,p,st),0),0);
  const onDriver=stockInCustody('sopir',c);
  return `<button class="cat-tile cat-${c}${c===activeCategory?' active':''}" onclick="pickCategory('${c}')">
    <span class="cat-name"><i class="bi ${meta.icon}"></i>${meta.label}</span>
    <span class="cat-val">${fmtNum(total)}</span>
    <span class="cat-sub">${meta.unit} ${st.toLowerCase()}${onDriver?` · ${fmtNum(onDriver)} di sopir`:''}</span>
  </button>`;
}
/* Dua seri (masuk/keluar) per hari, satu sumbu. */
function flowChart(tx){
  const days=[]; const now=new Date();
  for(let i=13;i>=0;i--){ const d=new Date(now); d.setDate(now.getDate()-i); days.push(localDate(d)); }
  const data=days.map(day=>({day,
    m:tx.filter(t=>t.tanggal===day&&t.type==='masuk').reduce((a,b)=>a+(+b.qty||0),0),
    k:tx.filter(t=>t.tanggal===day&&t.type==='keluar').reduce((a,b)=>a+(+b.qty||0),0)}));
  const max=Math.max(...data.map(d=>Math.max(d.m,d.k)));
  if(!max) return `<div class="empty small-empty">Belum ada pergerakan barang pada 14 hari terakhir</div>`;
  const W=640,H=180,L=34,B=22,T=8,plot=H-B-T,slot=(W-L)/14,bw=Math.min(9,Math.floor(slot/2)-2);
  const top=Math.ceil(max/4)*4||4;
  const y=v=>T+plot-(v/top)*plot;
  const grid=[0,.5,1].map(f=>{const v=Math.round(top*f);return `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L-6}" y="${y(v)+3}" class="tick" text-anchor="end">${v}</text>`}).join('');
  const bar=(x,v,cls)=>{ if(!v) return ''; const h=Math.max((v/top)*plot,2),py=T+plot-h,r=Math.min(3,bw/2,h);
    return `<path class="${cls}" d="M${x},${T+plot}V${py+r}Q${x},${py} ${x+r},${py}H${x+bw-r}Q${x+bw},${py} ${x+bw},${py+r}V${T+plot}Z"/>`; };
  const bars=data.map((d,i)=>{
    const cx=L+slot*i+slot/2;
    const label=new Date(d.day+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'});
    return `<g class="bar-slot" data-tip="${escAttr(label)}|${d.m}|${d.k}" onmousemove="chartTip(event,this)" onmouseleave="chartTipHide()">
      <rect x="${L+slot*i}" y="${T}" width="${slot}" height="${plot}" fill="transparent"/>
      ${bar(cx-bw-1,d.m,'bar-in')}${bar(cx+1,d.k,'bar-out')}
      ${i%2===1?`<text x="${cx}" y="${H-6}" class="tick" text-anchor="middle">${new Date(d.day+'T00:00:00').getDate()}</text>`:''}
    </g>`;
  }).join('');
  return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Barang masuk dan keluar per hari selama 14 hari terakhir">${grid}${bars}</svg><div class="chart-tip" id="chart-tip" hidden></div></div>`;
}
function chartTip(e,g){
  const tip=document.getElementById('chart-tip'); if(!tip) return;
  const [label,m,k]=g.getAttribute('data-tip').split('|');
  tip.innerHTML=`<b>${esc(label)}</b><div><i class="key key-in"></i>Masuk <b>${fmtNum(m)}</b></div><div><i class="key key-out"></i>Keluar <b>${fmtNum(k)}</b></div>`;
  tip.hidden=false;
  const box=g.closest('.chart-wrap').getBoundingClientRect();
  const x=e.clientX-box.left;
  tip.style.left=Math.max(4,Math.min(x+12,box.width-tip.offsetWidth-4))+'px';
  tip.style.top=(e.clientY-box.top-tip.offsetHeight/2)+'px';
}
function chartTipHide(){ const t=document.getElementById('chart-tip'); if(t) t.hidden=true; }

function transferFeed(list){
  if(!S.schemaV3) return `<div class="empty small-empty">Tersedia setelah migrasi dijalankan</div>`;
  if(!list.length) return `<div class="empty small-empty">Tidak ada transfer yang sedang berjalan</div>`;
  return `<ul class="feed">${list.slice(0,5).map(x=>`<li>
    <a href="${BASE_URL}/pages/transfer/transfer.html">
      <div class="feed-top"><span class="mono">${esc(x.code)}</span>${statusBadge(x)}</div>
      ${routeHtml(x,true)}
      <div class="muted small">${esc(x.driverName)||'Belum ada sopir'}</div>
    </a></li>`).join('')}</ul>`;
}
function stockMatrix(regs){
  const prods=productsOf(activeCategory);
  const meta=catMeta();
  if(!STATUSES.includes(dashStatus)) dashStatus=STATUSES[0];
  const st=dashStatus;
  const low=[];
  const rows=regs.map(r=>`<tr><td class="td-strong">${esc(r)}</td>${prods.map(p=>{
    const v=stockNow(r,p.name,st);
    const isLow=st===STATUSES[0]&&p.minStock>0&&v<p.minStock;
    if(isLow) low.push(`${p.name} di ${r}`);
    return `<td class="num${v<0?' neg':''}${isLow?' low':''}">${isLow?'<i class="bi bi-exclamation-triangle"></i> ':''}${fmtNum(v)}</td>`;
  }).join('')}</tr>`).join('');
  const rowTotal=(label,fn)=>`<tr class="row-sub"><td>${label}</td>${prods.map(p=>{const v=fn(p);return `<td class="num">${v?fmtNum(v):'<span class="muted">-</span>'}</td>`}).join('')}</tr>`;
  const transit=S.schemaV3?rowTotal('Dibawa sopir',p=>stockInCustody('sopir',activeCategory,p.name,st))
    +rowTotal('Titipan singgah',p=>stockInCustody('titip',activeCategory,p.name,st)):'';
  return `<div class="card card-flush">
    <div class="card-title pad"><span>Stok ${esc(meta.label)} per gudang</span>
      <div class="seg seg-sm">${STATUSES.map(s=>`<button class="seg-btn${s===st?' active':''}" onclick="dashStatus='${s}';setContent(renderDashboard())">${s}</button>`).join('')}</div>
    </div>
    ${low.length?`<div class="low-note"><i class="bi bi-exclamation-triangle"></i> Di bawah batas minimum: ${esc(low.join(', '))}</div>`:''}
    <div class="monitor-wrap"><table class="riwayat-tbl stock-tbl">
      <tr><th>Gudang</th>${prods.map(p=>`<th class="num">${esc(p.name)}</th>`).join('')}</tr>
      ${prods.length?rows+transit:`<tr><td class="empty">Belum ada produk. Tambahkan di menu Kelola Produk.</td></tr>`}
    </table></div>
  </div>`;
}
function recentTable(tx){
  const recent=[...tx].sort((a,b)=>b.createdAt-a.createdAt).slice(0,8);
  const rows=recent.length?recent.map(t=>`<tr>
    <td class="muted">${esc(t.tanggal)}</td>
    <td><span class="badge badge-${esc(t.type)}">${t.type==='masuk'?'Masuk':'Keluar'}</span></td>
    <td>${esc(t.region)}</td><td>${esc(t.tabung)}</td>
    <td><span class="badge badge-${esc(String(t.status).toLowerCase())}">${esc(t.status)}</span></td>
    <td class="num"><b>${fmtNum(t.qty)}</b></td>
    <td class="muted">${t.transferId?`<span class="mono">${esc(t.noSj)}</span>`:(esc(t.pihak)||'-')}</td>
  </tr>`).join(''):`<tr><td colspan="7" class="empty"><div class="ico"><i class="bi bi-inbox"></i></div>Belum ada transaksi ${esc(catMeta().label)}</td></tr>`;
  return `<table class="riwayat-tbl"><tr><th>Tanggal</th><th>Tipe</th><th>Gudang</th><th>${catMeta().itemLabel}</th><th>Status</th><th class="num">Qty</th><th>Pihak / Kode</th></tr>${rows}</table>`;
}
