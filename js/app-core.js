/* ===== APP CORE (shared across all pages) ===== */

/* Hitung base path project secara dinamis (sama seperti di sidebar.js).
   Didefinisikan ulang di sini supaya app-core.js tidak bergantung urutan
   load terhadap sidebar.js. */
function _coreBaseUrl() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('pages');
  return idx === -1 ? '.' : '../..';
}

/* ── boot: load data & sidebar, then call pageInit() ── */
async function boot(pageInit) {
  const sess = sessionStorage.getItem('lpg_me');
  if (sess) { try { me = JSON.parse(sess); } catch(e) { me = null; } }
  if (!me) { window.location.href = _coreBaseUrl() + '/login.html'; return; }

  SB = supabase.createClient(SB_URL, SB_ANON);

  /* ⚡ Render INSTAN dari cache (perpindahan antar halaman terasa realtime,
     tanpa menunggu jaringan). Data tetap disegarkan di latar belakang. */
  let shownFromCache = false;
  const cached = _readDataCache();
  if (cached) {
    _applyDataCache(cached);
    useSupabase = true;
    await loadSidebar();
    setTopbarUser();
    hideLoading();
    if (typeof pageInit === 'function') pageInit();
    shownFromCache = true;
  }

  /* Ambil data TERBARU dari server. */
  let connError = null;
  try {
    const { error } = await SB.from('lpg_regions').select('name').limit(1);
    if (error) throw error;
    await loadAllData();          /* loadAllData menulis ulang cache */
    useSupabase = true;
    setupRealtime();
    startAutoRefresh();
  } catch(e) {
    console.error(e);
    connError = e;
  }

  if (!shownFromCache) {
    /* Tidak ada cache → alur normal. */
    await loadSidebar();
    setTopbarUser();
    hideLoading();
    if (connError) { showPageError('❌ Gagal terhubung ke database. Periksa koneksi lalu refresh halaman.'); return; }
    if (typeof pageInit === 'function') pageInit();
  } else if (!connError) {
    /* Sudah tampil dari cache → perbarui dengan data segar. */
    setTopbarUser();
    if (typeof pageInit === 'function') pageInit();
  }
  /* shownFromCache && connError → biarkan tampilan dari cache (mode offline). */
}

/* ── Cache data di sessionStorage untuk navigasi instan ── */
function _writeDataCache() {
  try {
    sessionStorage.setItem('lpg_cache', JSON.stringify({
      t: Date.now(), regions: S.regions, users: S.users,
      transactions: S.transactions, stokAwal: S.stokAwal, customers: S.customers
    }));
  } catch(e) { /* kuota penuh / dll → abaikan */ }
}
function _readDataCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem('lpg_cache') || 'null');
    if (c && (Date.now() - (c.t || 0)) < 300000) return c;  /* maks 5 menit */
  } catch(e) {}
  return null;
}
function _applyDataCache(c) {
  S.regions = c.regions || [];
  S.users = c.users || [];
  S.transactions = c.transactions || [];
  S.stokAwal = c.stokAwal || {};
  S.customers = c.customers || [];
  if (Array.isArray(S.regions) && S.regions.length) REGIONS.splice(0, REGIONS.length, ...S.regions);
}

/* ── Auto-refresh (realtime fallback berbasis JS) ──
   Supabase Realtime menangani update INSTAN bila publication aktif. Sebagai
   jaminan (mis. publication belum diset), data dimuat ulang berkala lalu
   halaman diperbarui — TANPA mengganggu saat: tab tidak aktif, ada modal/
   dialog terbuka, atau pengguna sedang mengetik/memilih di sebuah input. */
/* Catat aktivitas pengguna terakhir → jangan refresh saat sedang aktif. */
let _lastUserActivity = Date.now();
['keydown','input','change','click','focusin'].forEach(ev =>
  document.addEventListener(ev, () => { _lastUserActivity = Date.now(); }, true));

/* True bila ada input teks/angka/textarea (form atau pencarian) yang SEDANG
   berisi data — supaya auto-refresh tidak menghapus ketikan pengguna. */
function _hasUnsavedInput() {
  const els = document.querySelectorAll('input[type=text],input[type=number],input[type=search],input:not([type]),textarea');
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    if (el.readOnly || el.disabled) continue;
    if ((el.value || '').trim() !== '') return true;
  }
  return false;
}
/* Aman untuk auto-refresh? (tidak akan mengganggu pekerjaan pengguna) */
function _safeToRefresh() {
  if (!useSupabase || document.hidden) return false;
  const modalOpen = ((document.getElementById('modal-root')||{}).innerHTML || '')
                 || ((document.getElementById('confirm-root')||{}).innerHTML || '');
  if (modalOpen) return false;
  const ae = document.activeElement;
  if (ae && ['INPUT','SELECT','TEXTAREA'].includes(ae.tagName)) return false; /* sedang fokus di input */
  if (_hasUnsavedInput()) return false;                                       /* ada data belum disimpan */
  if (Date.now() - _lastUserActivity < 25000) return false;                   /* baru berinteraksi */
  return true;
}

let _autoRefreshTimer = null;
function startAutoRefresh(interval = 15000) {
  if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
  _autoRefreshTimer = setInterval(async () => {
    if (!_safeToRefresh()) return;
    try {
      await loadAllData();
      if (typeof onRealtimeUpdate === 'function') onRealtimeUpdate();
    } catch(e) { /* diam: coba lagi siklus berikutnya */ }
  }, interval);
}
function stopAutoRefresh() {
  if (_autoRefreshTimer) { clearInterval(_autoRefreshTimer); _autoRefreshTimer = null; }
}
/* Segarkan begitu tab kembali aktif — tetap hormati guard di atas. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !useSupabase) return;
  const modalOpen = ((document.getElementById('modal-root')||{}).innerHTML || '')
                 || ((document.getElementById('confirm-root')||{}).innerHTML || '');
  const ae = document.activeElement;
  if (modalOpen || (ae && ['INPUT','SELECT','TEXTAREA'].includes(ae.tagName)) || _hasUnsavedInput()) return;
  loadAllData().then(() => { if (typeof onRealtimeUpdate === 'function') onRealtimeUpdate(); }).catch(()=>{});
});

function hideLoading() {
  const el = document.getElementById('loading-screen');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => el.style.display = 'none', 350);
}

function setTopbarUser() {
  const tag = document.getElementById('topbar-user-tag');
  if (!tag) return;
  const userTag = me
    ? (me.role === 'superadmin'
        ? `<span class="tag-region" style="background:rgba(59,130,246,.1);border-color:rgba(59,130,246,.3);color:#60a5fa">⚡ Super Admin</span>`
        : `<span class="tag-region">📍 ${esc(me.region)}</span>`)
    : '';
  tag.style.display = 'flex';
  tag.style.alignItems = 'center';
  tag.style.gap = '10px';
  tag.innerHTML =
    `<button class="topbar-theme-btn" onclick="toggleTheme()" title="Ganti mode terang/gelap">🌓</button>${userTag}`;
}

function showPageError(msg) {
  const c = document.getElementById('page-content');
  if (!c) return;
  c.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:32px;max-width:420px;width:100%;text-align:center">
        <div style="font-size:40px;margin-bottom:16px">🔌</div>
        <p style="color:var(--text);font-size:14px;line-height:1.6;margin-bottom:20px">${msg}</p>
        <button class="btn btn-primary" onclick="location.reload()" style="width:100%">🔄 Coba Lagi</button>
      </div>
    </div>`;
}

/* ── render helpers ── */
function setContent(html) {
  const el = document.getElementById('page-content');
  if (el) el.innerHTML = html;
}

function setModal(html) {
  const el = document.getElementById('modal-root');
  if (el) el.innerHTML = html;
}

/* ── alert / toast mengambang ──
   Notifikasi muncul sebagai toast fixed di pojok kanan-atas (mengambang di
   atas konten), bisa menumpuk, dengan animasi slide & auto-hilang. */
function _toastRoot() {
  let r = document.getElementById('toast-root');
  if (!r) { r = document.createElement('div'); r.id = 'toast-root'; document.body.appendChild(r); }
  return r;
}
function _removeToast(el) {
  if (!el) return;
  if (el._timer) clearTimeout(el._timer);
  el.classList.remove('show');
  el.classList.add('hide');
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
}
function showAlert(msg, type = 'success') {
  const ico = type === 'error' ? '⚠️' : (type === 'info' ? 'ℹ️' : '✅');
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML = `<span class="toast-ico">${ico}</span><span class="toast-msg">${msg}</span><button class="toast-close" aria-label="Tutup">✕</button>`;
  el.querySelector('.toast-close').addEventListener('click', () => _removeToast(el));
  _toastRoot().appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  el._timer = setTimeout(() => _removeToast(el), type === 'error' ? 5000 : 3500);
}
/* Tutup semua toast (kompatibilitas dengan pemanggil lama). */
function closeAlert() {
  const r = document.getElementById('toast-root');
  if (r) Array.prototype.slice.call(r.children).forEach(_removeToast);
}

/* ── konfirmasi dialog ── */
let confirmCb = null;
function showConfirm({ ico = '⚠️', title, msg, confirmLabel = 'Ya', confirmClass = 'btn-danger', onConfirm }) {
  confirmCb = onConfirm;
  const el = document.getElementById('confirm-root');
  if (!el) return;
  el.innerHTML = `
    <div class="confirm-bg">
      <div class="confirm-box">
        <div class="ico">${ico}</div>
        <h5>${title}</h5>
        <p>${msg}</p>
        <div class="confirm-btns">
          <button class="btn btn-ghost" onclick="closeConfirm()">Batal</button>
          <button class="btn ${confirmClass}" onclick="doConfirm()">${confirmLabel}</button>
        </div>
      </div>
    </div>`;
}
function closeConfirm() {
  const el = document.getElementById('confirm-root');
  if (el) el.innerHTML = '';
  confirmCb = null;
}
async function doConfirm() {
  const cb = confirmCb;   /* simpan dulu: closeConfirm() me-null-kan confirmCb */
  closeConfirm();
  if (cb) await cb();
}

/* ── logout ── */
function logout() {
  showConfirm({
    ico: '🚪', title: 'Keluar dari Aplikasi',
    msg: 'Apakah Anda yakin ingin keluar?',
    confirmLabel: 'Ya, Keluar', confirmClass: 'btn-danger',
    onConfirm: async () => {
      await writeLog('LOGOUT', 'Keluar dari aplikasi');
      sessionStorage.removeItem('lpg_me');
      sessionStorage.removeItem('lpg_cache');
      window.location.href = _coreBaseUrl() + '/login.html';
    }
  });
}

/* ── realtime re-render helper (tiap halaman override ini) ── */
function onRealtimeUpdate() { /* tiap halaman bisa override */ }
