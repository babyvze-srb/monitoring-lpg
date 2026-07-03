/* ===== ACTIVITY LOG ===== */
const ACTION_LABELS={
  'LOGIN':{ico:'🔐',label:'Login',color:'#60a5fa'},
  'LOGOUT':{ico:'🚪',label:'Logout',color:'#8b91a7'},
  'BARANG_MASUK':{ico:'📥',label:'Barang Masuk',color:'#34d399'},
  'BARANG_KELUAR':{ico:'📤',label:'Barang Keluar',color:'#f87171'},
  'HAPUS_TRANSAKSI':{ico:'🗑️',label:'Hapus Transaksi',color:'#ef4444'},
  'TAMBAH_REGION':{ico:'🗂️',label:'Tambah Region',color:'#f97316'},
  'RENAME_REGION':{ico:'✏️',label:'Rename Region',color:'#f97316'},
  'HAPUS_REGION':{ico:'🗑️',label:'Hapus Region',color:'#ef4444'},
  'TAMBAH_USER':{ico:'👤',label:'Tambah User',color:'#a78bfa'},
  'EDIT_USER':{ico:'✏️',label:'Edit User',color:'#f59e0b'},
  'HAPUS_USER':{ico:'🗑️',label:'Hapus User',color:'#ef4444'},
  'IMPORT_CSV':{ico:'📂',label:'Import CSV',color:'#eab308'},
  'UBAH_STOK_AWAL':{ico:'📦',label:'Ubah Stok Awal',color:'#818cf8'},
  'UBAH_PENGANTARAN':{ico:'🚚',label:'Status Pengantaran',color:'#22d3ee'},
  'TABUNG_BALIK':{ico:'↩️',label:'Tabung Balik',color:'#34d399'},
  'PINDAH_GUDANG':{ico:'🔄',label:'Pindah Gudang',color:'#a78bfa'},
  'SBY_KIRIM':{ico:'🚢',label:'Kirim Surabaya',color:'#38bdf8'},
  'SBY_SO':{ico:'📋',label:'Buat SO',color:'#60a5fa'},
  'SBY_LO':{ico:'🏭',label:'LO Pengisian',color:'#34d399'},
  'TERIMA_PINDAH':{ico:'📥',label:'Terima Pindah Gudang',color:'#22d3ee'},
  'EDIT_TRANSAKSI':{ico:'✏️',label:'Edit Transaksi',color:'#f59e0b'},
};

let actLogData=[], actLogLoading=false;
let actLogFilter={user:'',action:'',dateFrom:'',dateTo:''};
let actLogPage=1; const ACTLOG_PER=25;
function actLogGoPage(p){ actLogPage=p; setContent(renderActivityLog()); }

async function loadActLog(){ actLogLoading=true; setContent(renderActivityLog()); const {data}=await SB.from('lpg_activity_log').select('*').order('created_at',{ascending:false}).limit(1000); actLogData=data||[]; actLogLoading=false; setContent(renderActivityLog()); }

function renderActivityLog(){
  if(me.role!=='superadmin') return `<div class="card"><p style="color:var(--muted);text-align:center;padding:32px">🚫 Hanya Super Admin yang bisa melihat log aktivitas.</p></div>`;
  if(actLogLoading) return `<div class="card"><p style="color:var(--muted);text-align:center;padding:32px">⏳ Memuat log aktivitas...</p></div>`;
  if(!actLogData.length&&!actLogLoading){ setTimeout(loadActLog,0); return `<div class="card"><p style="color:var(--muted);text-align:center;padding:32px">⏳ Memuat log aktivitas...</p></div>`; }
  let filtered=actLogData;
  if(actLogFilter.user) filtered=filtered.filter(l=>l.username===actLogFilter.user||l.name.toLowerCase().includes(actLogFilter.user.toLowerCase()));
  if(actLogFilter.action) filtered=filtered.filter(l=>l.action===actLogFilter.action);
  if(actLogFilter.dateFrom) filtered=filtered.filter(l=>l.created_at>=actLogFilter.dateFrom);
  if(actLogFilter.dateTo) filtered=filtered.filter(l=>l.created_at<=actLogFilter.dateTo+'T23:59:59');
  const users=[...new Set(actLogData.map(l=>l.username))];
  const actions=[...new Set(actLogData.map(l=>l.action))];
  const userOpts=`<option value="">Semua User</option>`+users.map(u=>`<option value="${escAttr(u)}" ${actLogFilter.user===u?'selected':''}>${esc(u)}</option>`).join('');
  const actionOpts=`<option value="">Semua Aksi</option>`+actions.map(a=>{ const lb=ACTION_LABELS[a]; return `<option value="${escAttr(a)}" ${actLogFilter.action===a?'selected':''}>${lb?lb.ico+' '+esc(lb.label):esc(a)}</option>`; }).join('');
  const pg=paginate(filtered, actLogPage, ACTLOG_PER); actLogPage=pg.page;
  const rows=pg.items.length?pg.items.map(l=>{
    const al=ACTION_LABELS[l.action]||{ico:'📌',label:l.action,color:'var(--muted)'};
    const dt=new Date(l.created_at);
    const tgl=dt.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
    const jam=dt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    return `<tr>
      <td style="white-space:nowrap;font-size:11px"><b>${tgl}</b><br><span style="color:var(--muted)">${jam}</span></td>
      <td><b style="color:var(--text)">${esc(l.name)}</b><br><span style="font-size:10px;color:var(--muted)">${esc(l.username)} · ${l.role==='superadmin'?'⚡ Super Admin':'👷 Operator'}</span></td>
      <td style="white-space:nowrap"><span style="font-size:11px;font-weight:600;color:${al.color}">${al.ico} ${esc(al.label)}</span></td>
      <td style="font-size:11px;color:var(--muted);max-width:300px">${esc(l.detail)||'-'}</td>
      <td style="font-size:11px;color:var(--muted)">${esc(l.region)||'—'}</td>
    </tr>`;
  }).join(''):`<tr><td colspan="5" class="empty"><div class="ico">📭</div>Tidak ada log ditemukan</td></tr>`;
  return `
  <div class="stats-grid" style="margin-bottom:14px">
    <div class="stat-card stat-blue"><div class="val">${actLogData.length}</div><div class="lbl">Total Log</div></div>
    <div class="stat-card stat-green"><div class="val">${actLogData.filter(l=>l.action==='LOGIN').length}</div><div class="lbl">Login</div></div>
    <div class="stat-card stat-orange"><div class="val">${actLogData.filter(l=>l.action==='BARANG_MASUK'||l.action==='BARANG_KELUAR').length}</div><div class="lbl">Transaksi</div></div>
    <div class="stat-card stat-red"><div class="val">${actLogData.filter(l=>l.action==='EDIT_USER'||l.action==='TAMBAH_USER'||l.action==='HAPUS_USER').length}</div><div class="lbl">Perubahan User</div></div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select style="padding:6px 10px;font-size:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text)" onchange="actLogFilter.user=this.value;setContent(renderActivityLog())">${userOpts}</select>
        <select style="padding:6px 10px;font-size:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text)" onchange="actLogFilter.action=this.value;setContent(renderActivityLog())">${actionOpts}</select>
        <input type="date" style="padding:5px 9px;font-size:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text)" value="${actLogFilter.dateFrom}" onchange="actLogFilter.dateFrom=this.value;setContent(renderActivityLog())">
        <input type="date" style="padding:5px 9px;font-size:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text)" value="${actLogFilter.dateTo}" onchange="actLogFilter.dateTo=this.value;setContent(renderActivityLog())">
        <button class="btn btn-ghost btn-sm" onclick="actLogFilter={user:'',action:'',dateFrom:'',dateTo:''};setContent(renderActivityLog())">↺ Reset</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="font-size:12px;color:var(--muted)">${filtered.length} / ${actLogData.length} log</span>
        <button class="btn btn-ghost btn-sm" onclick="actLogData=[];loadActLog()">🔄 Refresh</button>
        <button class="btn btn-warn btn-sm" onclick="exportLogCSV()">⬇ Export CSV</button>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="monitor-wrap">
      <table class="riwayat-tbl">
        <tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Detail</th><th>Region</th></tr>
        ${rows}
      </table>
    </div>
    ${pagerHtml(pg,'actLogGoPage')}
  </div>`;
}

function exportLogCSV(){
  if(!actLogData.length){showAlert('Tidak ada data log','error');return;}
  let filtered=actLogData;
  if(actLogFilter.user) filtered=filtered.filter(l=>l.username===actLogFilter.user||l.name.toLowerCase().includes(actLogFilter.user.toLowerCase()));
  if(actLogFilter.action) filtered=filtered.filter(l=>l.action===actLogFilter.action);
  if(actLogFilter.dateFrom) filtered=filtered.filter(l=>l.created_at>=actLogFilter.dateFrom);
  if(actLogFilter.dateTo) filtered=filtered.filter(l=>l.created_at<=actLogFilter.dateTo+'T23:59:59');
  const header='Waktu,Pengguna,Username,Role,Aksi,Detail,Region\n';
  const rows=filtered.map(l=>{
    const dt=new Date(l.created_at).toLocaleString('id-ID');
    const al=ACTION_LABELS[l.action]||{label:l.action};
    return `"${dt}","${l.name}","${l.username}","${l.role==='superadmin'?'Super Admin':'Operator'}","${al.label}","${(l.detail||'').replace(/"/g,"'")}","${l.region||'—'}"`;
  }).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(header+rows);
  a.download=`activity-log-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showAlert('✅ Log berhasil diekspor');
}
