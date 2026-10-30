/* ===== ACTIVITY LOG ===== */
const ACTION_LABELS={
  'LOGIN':{ico:'<i class="bi bi-lock"></i>',label:'Login',color:'var(--info)'},
  'LOGOUT':{ico:'<i class="bi bi-box-arrow-right"></i>',label:'Logout',color:'var(--muted)'},
  'BARANG_MASUK':{ico:'<i class="bi bi-box-arrow-in-down"></i>',label:'Barang Masuk',color:'var(--ok)'},
  'BARANG_KELUAR':{ico:'<i class="bi bi-box-arrow-up"></i>',label:'Barang Keluar',color:'var(--bad)'},
  'HAPUS_TRANSAKSI':{ico:'<i class="bi bi-trash3"></i>',label:'Hapus Transaksi',color:'var(--bad)'},
  'TAMBAH_REGION':{ico:'<i class="bi bi-buildings"></i>',label:'Tambah Region',color:'var(--accent)'},
  'RENAME_REGION':{ico:'<i class="bi bi-pencil"></i>',label:'Rename Region',color:'var(--accent)'},
  'HAPUS_REGION':{ico:'<i class="bi bi-trash3"></i>',label:'Hapus Region',color:'var(--bad)'},
  'TAMBAH_USER':{ico:'<i class="bi bi-person"></i>',label:'Tambah User',color:'var(--muted)'},
  'EDIT_USER':{ico:'<i class="bi bi-pencil"></i>',label:'Edit User',color:'var(--muted)'},
  'HAPUS_USER':{ico:'<i class="bi bi-trash3"></i>',label:'Hapus User',color:'var(--bad)'},
  'IMPORT_CSV':{ico:'<i class="bi bi-folder2-open"></i>',label:'Import CSV',color:'var(--warn)'},
  'UBAH_STOK_AWAL':{ico:'<i class="bi bi-box-seam"></i>',label:'Ubah Stok Awal',color:'var(--muted)'},
  'UBAH_PENGANTARAN':{ico:'<i class="bi bi-truck"></i>',label:'Status Pengantaran',color:'var(--muted)'},
  'TABUNG_BALIK':{ico:'<i class="bi bi-arrow-return-left"></i>',label:'Tabung Balik',color:'var(--ok)'},
  'PINDAH_GUDANG':{ico:'<i class="bi bi-arrow-left-right"></i>',label:'Pindah Gudang',color:'var(--muted)'},
  'SBY_KIRIM':{ico:'<i class="bi bi-water"></i>',label:'Kirim Surabaya',color:'var(--muted)'},
  'SBY_SO':{ico:'<i class="bi bi-card-list"></i>',label:'Buat SO',color:'var(--info)'},
  'SBY_LO':{ico:'<i class="bi bi-buildings"></i>',label:'LO Pengisian',color:'var(--ok)'},
  'TERIMA_PINDAH':{ico:'<i class="bi bi-box-arrow-in-down"></i>',label:'Terima Pindah Gudang',color:'var(--muted)'},
  'TRANSFER_DIBUAT':{ico:'<i class="bi bi-qr-code"></i>',label:'Transfer Dibuat',color:'var(--info)'},
  'TRANSFER_MUAT':{ico:'<i class="bi bi-box-arrow-up"></i>',label:'Transfer Dimuat Sopir',color:'var(--accent)'},
  'TRANSFER_SINGGAH_MASUK':{ico:'<i class="bi bi-signpost-split"></i>',label:'Singgah Gudang',color:'var(--warn)'},
  'TRANSFER_SINGGAH_KELUAR':{ico:'<i class="bi bi-signpost-2"></i>',label:'Lanjut dari Singgah',color:'var(--warn)'},
  'TRANSFER_GANTI_SOPIR':{ico:'<i class="bi bi-person-gear"></i>',label:'Ganti Sopir',color:'var(--warn)'},
  'TRANSFER_BONGKAR':{ico:'<i class="bi bi-box-arrow-in-down"></i>',label:'Transfer Dibongkar',color:'var(--ok)'},
  'TRANSFER_BATAL':{ico:'<i class="bi bi-x-circle"></i>',label:'Transfer Dibatalkan',color:'var(--bad)'},
  'TRANSFER_ALIH_TUJUAN':{ico:'<i class="bi bi-sign-turn-right"></i>',label:'Alih Tujuan',color:'var(--warn)'},
  'TAMBAH_PRODUK':{ico:'<i class="bi bi-tags"></i>',label:'Tambah Produk',color:'var(--muted)'},
  'EDIT_PRODUK':{ico:'<i class="bi bi-tags"></i>',label:'Edit Produk',color:'var(--muted)'},
  'HAPUS_PRODUK':{ico:'<i class="bi bi-trash3"></i>',label:'Hapus Produk',color:'var(--bad)'},
  'EDIT_TRANSAKSI':{ico:'<i class="bi bi-pencil"></i>',label:'Edit Transaksi',color:'var(--muted)'},
};

let actLogData=[], actLogLoading=false;
let actLogFilter={user:'',action:'',dateFrom:'',dateTo:''};
let actLogPage=1; const ACTLOG_PER=25;
function actLogGoPage(p){ actLogPage=p; setContent(renderActivityLog()); }

async function loadActLog(){ actLogLoading=true; setContent(renderActivityLog()); const {data}=await SB.from('lpg_activity_log').select('*').order('created_at',{ascending:false}).limit(1000); actLogData=data||[]; actLogLoading=false; setContent(renderActivityLog()); }

function renderActivityLog(){
  if(me.role!=='superadmin') return `<div class="card"><p style="color:var(--muted);text-align:center;padding:32px"><i class="bi bi-slash-circle"></i> Hanya Super Admin yang bisa melihat log aktivitas.</p></div>`;
  if(actLogLoading) return `<div class="card"><p style="color:var(--muted);text-align:center;padding:32px"><i class="bi bi-hourglass-split"></i> Memuat log aktivitas...</p></div>`;
  if(!actLogData.length&&!actLogLoading){ setTimeout(loadActLog,0); return `<div class="card"><p style="color:var(--muted);text-align:center;padding:32px"><i class="bi bi-hourglass-split"></i> Memuat log aktivitas...</p></div>`; }
  let filtered=actLogData;
  if(actLogFilter.user) filtered=filtered.filter(l=>l.username===actLogFilter.user||l.name.toLowerCase().includes(actLogFilter.user.toLowerCase()));
  if(actLogFilter.action) filtered=filtered.filter(l=>l.action===actLogFilter.action);
  if(actLogFilter.dateFrom) filtered=filtered.filter(l=>l.created_at>=actLogFilter.dateFrom);
  if(actLogFilter.dateTo) filtered=filtered.filter(l=>l.created_at<=actLogFilter.dateTo+'T23:59:59');
  const users=[...new Set(actLogData.map(l=>l.username))];
  const actions=[...new Set(actLogData.map(l=>l.action))];
  const userOpts=`<option value="">Semua User</option>`+users.map(u=>`<option value="${escAttr(u)}" ${actLogFilter.user===u?'selected':''}>${esc(u)}</option>`).join('');
  const actionOpts=`<option value="">Semua Aksi</option>`+actions.map(a=>{ const lb=ACTION_LABELS[a]; return `<option value="${escAttr(a)}" ${actLogFilter.action===a?'selected':''}>${lb?esc(lb.label):esc(a)}</option>`; }).join('');
  const pg=paginate(filtered, actLogPage, ACTLOG_PER); actLogPage=pg.page;
  const rows=pg.items.length?pg.items.map(l=>{
    const al=ACTION_LABELS[l.action]||{ico:'<i class="bi bi-pin-angle"></i>',label:l.action,color:'var(--muted)'};
    const dt=new Date(l.created_at);
    const tgl=dt.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
    const jam=dt.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    return `<tr>
      <td style="white-space:nowrap;font-size:11px"><b>${tgl}</b><br><span style="color:var(--muted)">${jam}</span></td>
      <td><b style="color:var(--text)">${esc(l.name)}</b><br><span style="font-size:10px;color:var(--muted)">${esc(l.username)} · ${l.role==='superadmin'?'<i class="bi bi-shield-check"></i> Super Admin':'<i class="bi bi-person-badge"></i> Operator'}</span></td>
      <td style="white-space:nowrap"><span style="font-size:11px;font-weight:600;color:${al.color}">${al.ico} ${esc(al.label)}</span></td>
      <td style="font-size:11px;color:var(--muted);max-width:300px">${esc(l.detail)||'-'}</td>
      <td style="font-size:11px;color:var(--muted)">${esc(l.region)||'—'}</td>
    </tr>`;
  }).join(''):`<tr><td colspan="5" class="empty"><div class="ico"><i class="bi bi-inbox"></i></div>Tidak ada log ditemukan</td></tr>`;
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
        <button class="btn btn-ghost btn-sm" onclick="actLogFilter={user:'',action:'',dateFrom:'',dateTo:''};setContent(renderActivityLog())"><i class="bi bi-arrow-counterclockwise"></i> Reset</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="font-size:12px;color:var(--muted)">${filtered.length} / ${actLogData.length} log</span>
        <button class="btn btn-ghost btn-sm" onclick="actLogData=[];loadActLog()"><i class="bi bi-arrow-left-right"></i> Refresh</button>
        <button class="btn btn-warn btn-sm" onclick="exportLogCSV()"><i class="bi bi-download"></i> Export CSV</button>
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
  a.download=`activity-log-${localDate()}.csv`;
  a.click();
  showAlert('Log berhasil diekspor');
}
