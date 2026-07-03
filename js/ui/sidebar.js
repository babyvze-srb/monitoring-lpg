/* ===== SIDEBAR (MPA version) ===== */
let sidebarOpen = false;
/* Default TERTUTUP — dropdown tidak otomatis terbuka saat masuk halaman.
   Pengguna membuka manual lewat klik header. */
let sidebarGroups = { harian: false, bulanan: false, surabaya: false };

/* Hitung base path project secara dinamis, supaya aplikasi tetap jalan
   walau ditaruh di subfolder server (mis. http://localhost/lpg-monitor-final/)
   ataupun di root domain.
   Struktur halaman yang didukung:
     - /login.html                          → kedalaman 0 dari root project
     - /pages/{kategori}/{file}.html        → kedalaman 2 dari root project
*/
function getBaseUrl() {
  const path  = window.location.pathname;
  const parts = path.split('/').filter(Boolean); // hilangkan string kosong
  // cari index segmen 'pages' di path
  const idx = parts.indexOf('pages');
  if (idx === -1) {
    // tidak ada 'pages' di path → kita di root project (mis. login.html)
    return '.';
  }
  // ada di pages/{kategori}/{file}.html → naik 2 level
  return '../..';
}
const BASE_URL = getBaseUrl();

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  if (s) s.classList.toggle('open', sidebarOpen);
  if (o) o.classList.toggle('show', sidebarOpen);
}
function closeSidebar() {
  sidebarOpen = false;
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  if (s) s.classList.remove('open');
  if (o) o.classList.remove('show');
}

function toggleGroup(g) {
  sidebarGroups[g] = !sidebarGroups[g];
  const el  = document.getElementById('sg-' + g);
  const arr = document.getElementById('sg-arr-' + g);
  if (el)  el.classList.toggle('open', sidebarGroups[g]);
  if (arr) arr.classList.toggle('open', sidebarGroups[g]);
}

/* Deteksi halaman aktif dari pathname.
   Struktur path: .../pages/{kategori}/{file}.html  atau  .../login.html */
function getActivePage() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const p = (parts[parts.length - 1] || '').replace('.html', '');
  const q = new URLSearchParams(window.location.search);
  const region = q.get('region') || '';
  // map filename → page key
  const map = {
    'dashboard':        'dashboard',
    'masuk':            'masuk',
    'keluar':           'keluar',
    'riwayat':          'riwayat',
    'import':           'import',
    'rekap':            region ? 'rekap_' + region : 'rekap_semua',
    'harian':           region ? 'harian_' + region : '',
    'harian-semua':     'harian_semua',
    'surabaya-kirim':      'surabaya_kirim',
    'surabaya-bongkar':    'surabaya_bongkar',
    'surabaya-stok':       'surabaya_stok',
    'surabaya-pengisian':  'surabaya_pengisian',
    'surabaya-tebusan':    'surabaya_tebusan',
    'surabaya-tujuan':     'surabaya_tujuan',
    'regions':          'regions',
    'customers':        'customers',
    'users':            'users',
    'actlog':           'actlog',
  };
  return map[p] || p;
}

async function loadSidebar() {
  const wrap = document.getElementById('sidebar-wrap');
  if (!wrap) return;
  try {
    const res = await fetch(BASE_URL + '/partials/sidebar.html');
    if (!res.ok) throw new Error('fetch sidebar gagal: ' + res.status);
    const html = await res.text();
    wrap.innerHTML = html;
    buildSidebarNav();
  } catch (e) {
    console.error('Gagal memuat sidebar via fetch, pakai fallback inline:', e);
    // Fallback: sidebar tetap muncul walau fetch gagal (mis. dibuka via file://)
    wrap.innerHTML = `
      <div class="sidebar-overlay" id="sidebar-overlay" onclick="closeSidebar()"></div>
      <div class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <div class="logo-mark">🔥</div>
          <div class="logo-text">
            <h2>LPG <span>Monitor</span></h2>
            <small>Bright Gas Pertamina</small>
          </div>
        </div>
        <div class="sidebar-user">
          <div class="user-badge" id="sb-user-badge"></div>
        </div>
        <nav id="sb-nav"></nav>
        <div class="sidebar-footer">
          <button class="theme-toggle" id="theme-toggle-btn" onclick="toggleTheme()"><span class="ico" id="theme-toggle-ico">☀️</span><span id="theme-toggle-lbl">Mode Terang</span></button>
          <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center" onclick="logout()"><span style="font-size:14px">🚪</span> Keluar</button>
        </div>
      </div>`;
    buildSidebarNav();
  }
}

/* Selaraskan label/ikon tombol toggle dengan tema aktif.
   Tombol menampilkan mode yang akan dituju saat diklik. */
function updateThemeToggleUI(){
  const ico=document.getElementById('theme-toggle-ico');
  const lbl=document.getElementById('theme-toggle-lbl');
  if(!ico||!lbl) return;
  const light = (typeof getTheme==='function' ? getTheme() : 'dark')==='light';
  ico.textContent = light ? '🌙' : '☀️';
  lbl.textContent = light ? 'Mode Gelap' : 'Mode Terang';
}

function buildSidebarNav() {
  const activePage = getActivePage();
  const isSA       = me && me.role === 'superadmin';
  const regs       = isSA ? (S.regions || REGIONS) : (me && me.region ? [me.region] : []);

  /* ── user badge ── */
  const ubEl = document.getElementById('sb-user-badge');
  if (ubEl && me) {
    const initials = (me.name || '?')
      .trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    ubEl.innerHTML = `
      <div class="avatar">${esc(initials)}</div>
      <div class="info">
        <div class="name">${esc(me.name)}</div>
        <div class="role">${me.role === 'superadmin' ? '⚡ Super Admin' : '👷 ' + esc(me.region || 'Operator')}</div>
      </div>`;
  }

  /* ── nav container ── */
  const nav = document.getElementById('sb-nav');
  if (!nav) return;

  const nv = (href, ico, lbl, pageKey) => {
    const active = activePage === pageKey ? ' active' : '';
    return `<a class="nav-item${active}" href="${href}"><span class="ico">${ico}</span><span>${lbl}</span></a>`;
  };

  /* ── dropdown harian ── */
  const harianAktif  = activePage.startsWith('harian_');
  /* Dropdown yang sedang berisi halaman aktif SELALU tampil terbuka (supaya
     tidak tertutup lagi saat pindah ke halaman tujuan di dalamnya); di luar
     itu, buka/tutup mengikuti toggle manual pengguna. */
  const harianOpen   = sidebarGroups.harian || harianAktif;
  const harianAllItem = isSA
    ? `<a class="nav-sub-item${activePage === 'harian_semua' ? ' active' : ''}" href="${BASE_URL}/pages/laporan/harian-semua.html"><span class="ico">🗺️</span><span>Semua Region</span></a>`
    : '';
  const harianChildren = harianAllItem + regs.map(r =>
    `<a class="nav-sub-item${activePage === 'harian_' + r ? ' active' : ''}" href="${BASE_URL}/pages/laporan/harian.html?region=${encodeURIComponent(r)}"><span class="ico">📅</span><span>${esc(r)}</span></a>`
  ).join('');
  const harianGroup = `
    <div class="nav-group">
      <div class="nav-group-header${harianAktif ? ' has-active' : ''}" onclick="toggleGroup('harian')">
        <span class="ico" style="font-size:14px;width:20px;text-align:center">📅</span>
        <span>Laporan Harian</span>
        <span class="nav-group-arrow${harianOpen ? ' open' : ''}" id="sg-arr-harian">▶</span>
      </div>
      <div class="nav-group-children${harianOpen ? ' open' : ''}" id="sg-harian">${harianChildren}</div>
    </div>`;

  /* ── dropdown bulanan ── */
  const bulananAktif = activePage.startsWith('rekap_');
  const bulananOpen  = sidebarGroups.bulanan || bulananAktif;
  const bulananChildren = [
    ...(isSA ? [`<a class="nav-sub-item${activePage === 'rekap_semua' ? ' active' : ''}" href="${BASE_URL}/pages/laporan/rekap.html?region=semua"><span class="ico">🗺️</span><span>Semua Region</span></a>`] : []),
    ...regs.map(r =>
      `<a class="nav-sub-item${activePage === 'rekap_' + r ? ' active' : ''}" href="${BASE_URL}/pages/laporan/rekap.html?region=${encodeURIComponent(r)}"><span class="ico">📊</span><span>${esc(r)}</span></a>`
    )
  ].join('');
  const bulananGroup = `
    <div class="nav-group">
      <div class="nav-group-header${bulananAktif ? ' has-active' : ''}" onclick="toggleGroup('bulanan')">
        <span class="ico" style="font-size:14px;width:20px;text-align:center">📆</span>
        <span>Rekap Bulanan</span>
        <span class="nav-group-arrow${bulananOpen ? ' open' : ''}" id="sg-arr-bulanan">▶</span>
      </div>
      <div class="nav-group-children${bulananOpen ? ' open' : ''}" id="sg-bulanan">${bulananChildren}</div>
    </div>`;

  /* ── dropdown Kontrol Surabaya (progress per tahap, sidebar khusus —
     masing-masing tahap adalah HALAMAN sendiri, bukan tab dalam 1 halaman) ── */
  const surabayaAktif = activePage.startsWith('surabaya_');
  const surabayaOpen  = sidebarGroups.surabaya || surabayaAktif;
  const sbyLink = (pageKey, file, ico, lbl) =>
    `<a class="nav-sub-item${activePage === 'surabaya_' + pageKey ? ' active' : ''}" href="${BASE_URL}/pages/transaksi/${file}"><span class="ico">${ico}</span><span>${lbl}</span></a>`;
  const surabayaChildren = isSA
    ? sbyLink('kirim', 'surabaya-kirim.html', '🚢', 'Perjalanan ke Surabaya')
      + sbyLink('bongkar', 'surabaya-bongkar.html', '📦', 'Bongkar Kontainer')
      + sbyLink('stok', 'surabaya-stok.html', '📊', 'Stok Gudang')
      + sbyLink('pengisian', 'surabaya-pengisian.html', '⛽', 'Pengisian (LO)')
      + sbyLink('tebusan', 'surabaya-tebusan.html', '🧾', 'Tebusan / SO')
      + sbyLink('tujuan', 'surabaya-tujuan.html', '🚚', 'Perjalanan ke Tujuan')
    : '';
  const surabayaGroup = isSA ? `
    <div class="nav-group">
      <div class="nav-group-header${surabayaAktif ? ' has-active' : ''}" onclick="toggleGroup('surabaya')">
        <span class="ico" style="font-size:14px;width:20px;text-align:center">🏭</span>
        <span>Kontrol Surabaya</span>
        <span class="nav-group-arrow${surabayaOpen ? ' open' : ''}" id="sg-arr-surabaya">▶</span>
      </div>
      <div class="nav-group-children${surabayaOpen ? ' open' : ''}" id="sg-surabaya">${surabayaChildren}</div>
    </div>` : '';

  nav.innerHTML = `
    <div class="nav-section">Menu Utama</div>
    ${nv(BASE_URL + '/pages/dashboard/dashboard.html', '🏠', 'Dashboard', 'dashboard')}
    ${nv(BASE_URL + '/pages/transaksi/masuk.html',     '📥', 'Barang Masuk', 'masuk')}
    ${nv(BASE_URL + '/pages/transaksi/keluar.html',    '📤', 'Barang Keluar', 'keluar')}
    ${isSA ? nv(BASE_URL + '/pages/transaksi/import.html', '📂', 'Import CSV', 'import') : ''}
    ${nv(BASE_URL + '/pages/transaksi/riwayat.html',  '📋', 'Riwayat', 'riwayat')}
    <div class="nav-section">Penjualan</div>
    ${nv(BASE_URL + '/pages/transaksi/pengantaran.html', '🚚', 'Pengantaran', 'pengantaran')}
    ${nv(BASE_URL + '/pages/transaksi/penerimaan.html',  '📥', 'Penerimaan Pindah', 'penerimaan')}
    ${nv(BASE_URL + '/pages/transaksi/pinjaman.html',    '↩️', 'Tabung Pinjaman', 'pinjaman')}
    ${surabayaGroup}
    <div class="nav-section">Monitor Rekap</div>
    ${harianGroup}
    ${bulananGroup}
    ${isSA ? `
      <div class="nav-section">Admin</div>
      ${nv(BASE_URL + '/pages/admin/regions.html',   '🗂️', 'Kelola Region',   'regions')}
      ${nv(BASE_URL + '/pages/admin/customers.html', '🧑‍🤝‍🧑', 'Kelola Customer', 'customers')}
      ${nv(BASE_URL + '/pages/admin/users.html',     '👥', 'Kelola User',     'users')}
      ${nv(BASE_URL + '/pages/admin/actlog.html',  '🕵️', 'Log Aktivitas', 'actlog')}
    ` : ''}`;

  if (typeof updateThemeToggleUI === 'function') updateThemeToggleUI();
}
