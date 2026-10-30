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

/* Layar kecil: menu berupa laci di atas halaman. Layar lebar: menu melipat,
   dan pilihannya diingat antarhalaman. */
function _isDrawerSidebar() { return window.matchMedia('(max-width:768px)').matches; }
function _setSidebarFolded(closed) {
  document.documentElement.classList.toggle('sb-closed', closed);
  try { localStorage.setItem('lpg_sidebar', closed ? 'closed' : 'open'); } catch (e) {}
}
function toggleSidebar() {
  if (!_isDrawerSidebar()) {
    _setSidebarFolded(!document.documentElement.classList.contains('sb-closed'));
    return;
  }
  sidebarOpen = !sidebarOpen;
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  if (s) s.classList.toggle('open', sidebarOpen);
  if (o) o.classList.toggle('show', sidebarOpen);
}
function closeSidebar() {
  if (!_isDrawerSidebar()) { _setSidebarFolded(true); return; }
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
    'transfer':         'transfer',
    'sopir':            'sopir',
    'products':         'products',
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
          <div class="logo-mark"><i class="bi bi-boxes"></i></div>
          <div class="logo-text"><h2>Monitor Stok</h2><small>LPG &amp; Pelumas</small></div>
          <button class="icon-btn sidebar-close" onclick="closeSidebar()" title="Tutup menu" aria-label="Tutup menu"><i class="bi bi-layout-sidebar-inset"></i></button>
        </div>
        <nav id="sb-nav"></nav>
        <div class="sidebar-footer">
          <div class="user-badge" id="sb-user-badge"></div>
          <div class="sidebar-actions">
            <button class="icon-btn" id="theme-toggle-btn" onclick="toggleTheme()" title="Ganti tema"><i class="bi bi-sun" id="theme-toggle-ico"></i></button>
            <button class="icon-btn" onclick="logout()" title="Keluar"><i class="bi bi-box-arrow-right"></i></button>
          </div>
        </div>
      </div>`;
    buildSidebarNav();
  }
}

/* Selaraskan ikon tombol toggle dengan tema aktif. */
function updateThemeToggleUI(){
  const ico=document.getElementById('theme-toggle-ico');
  if(!ico) return;
  const light = (typeof getTheme==='function' ? getTheme() : 'dark')==='light';
  ico.className = 'bi ' + (light ? 'bi-moon' : 'bi-sun');
}

function buildSidebarNav() {
  const activePage = getActivePage();
  const isSA       = me && me.role === 'superadmin';
  const isDriver   = me && me.role === 'sopir';
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
        <div class="role">${esc(ROLE_LABEL[me.role] || me.role)}${me.region ? ' · ' + esc(me.region) : ''}</div>
      </div>`;
  }

  /* ── nav container ── */
  const nav = document.getElementById('sb-nav');
  if (!nav) return;

  document.querySelectorAll('.hamburger').forEach(b => b.setAttribute('aria-label', 'Buka atau tutup menu'));

  const ico = n => `<i class="bi ${n}"></i>`;
  const NAV_COLORS = { dashboard: 'blue', masuk: 'green', keluar: 'orange', riwayat: 'violet', import: 'teal',
    transfer: 'pink', pengantaran: 'blue', pinjaman: 'amber', penerimaan: 'teal', surabaya: 'teal',
    harian: 'green', bulanan: 'violet', products: 'orange', regions: 'teal', customers: 'blue', users: 'pink', actlog: 'amber', sopir: 'pink' };
  const navColor = k => NAV_COLORS[k] ? ` style="--c:var(--c-${NAV_COLORS[k]})"` : '';
  const nv = (href, icon, lbl, pageKey, badge) => {
    const active = activePage === pageKey ? ' active' : '';
    return `<a class="nav-item${active}" href="${href}"${navColor(pageKey)}>${ico(icon)}<span>${lbl}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ''}</a>`;
  };

  if (isDriver) {
    nav.innerHTML = `
      <div class="nav-section">Tugas Saya</div>
      ${nv(BASE_URL + '/pages/transfer/sopir.html', 'bi-qr-code-scan', 'Scan &amp; Muatan', 'sopir')}`;
    if (typeof updateThemeToggleUI === 'function') updateThemeToggleUI();
    return;
  }

  const sub = (active, href, icon, lbl) =>
    `<a class="nav-sub-item${active ? ' active' : ''}" href="${href}"><span>${lbl}</span></a>`;
  const group = (key, icon, lbl, isActive, children) => {
    const open = sidebarGroups[key] || isActive;
    return `
    <div class="nav-group">
      <div class="nav-group-header${isActive ? ' has-active' : ''}" onclick="toggleGroup('${key}')"${navColor(key)}>
        ${ico(icon)}<span>${lbl}</span>
        <i class="bi bi-chevron-right nav-group-arrow${open ? ' open' : ''}" id="sg-arr-${key}"></i>
      </div>
      <div class="nav-group-children${open ? ' open' : ''}" id="sg-${key}">${children}</div>
    </div>`;
  };

  /* ── dropdown harian ── */
  /* Dropdown yang sedang berisi halaman aktif SELALU tampil terbuka (supaya
     tidak tertutup lagi saat pindah ke halaman tujuan di dalamnya); di luar
     itu, buka/tutup mengikuti toggle manual pengguna. */
  const harianGroup = group('harian', 'bi-calendar3', 'Laporan Harian', activePage.startsWith('harian_'),
    (isSA ? sub(activePage === 'harian_semua', `${BASE_URL}/pages/laporan/harian-semua.html`, '', 'Semua Region') : '')
    + regs.map(r => sub(activePage === 'harian_' + r, `${BASE_URL}/pages/laporan/harian.html?region=${encodeURIComponent(r)}`, '', esc(r))).join(''));

  /* ── dropdown bulanan ── */
  const bulananGroup = group('bulanan', 'bi-calendar-month', 'Rekap Bulanan', activePage.startsWith('rekap_'),
    (isSA ? sub(activePage === 'rekap_semua', `${BASE_URL}/pages/laporan/rekap.html?region=semua`, '', 'Semua Region') : '')
    + regs.map(r => sub(activePage === 'rekap_' + r, `${BASE_URL}/pages/laporan/rekap.html?region=${encodeURIComponent(r)}`, '', esc(r))).join(''));

  /* ── dropdown Kontrol Surabaya (progress per tahap, sidebar khusus —
     masing-masing tahap adalah HALAMAN sendiri, bukan tab dalam 1 halaman) ── */
  const sbyLink = (pageKey, file, lbl) =>
    sub(activePage === 'surabaya_' + pageKey, `${BASE_URL}/pages/transaksi/${file}`, '', lbl);
  const surabayaGroup = isSA ? group('surabaya', 'bi-buildings', 'Kontrol Surabaya', activePage.startsWith('surabaya_'),
    sbyLink('kirim', 'surabaya-kirim.html', 'Perjalanan ke Surabaya')
    + sbyLink('bongkar', 'surabaya-bongkar.html', 'Bongkar Kontainer')
    + sbyLink('stok', 'surabaya-stok.html', 'Stok Gudang')
    + sbyLink('pengisian', 'surabaya-pengisian.html', 'Pengisian (LO)')
    + sbyLink('tebusan', 'surabaya-tebusan.html', 'Tebusan / SO')
    + sbyLink('tujuan', 'surabaya-tujuan.html', 'Perjalanan ke Tujuan')) : '';

  /* Jumlah transfer yang menunggu tindakan di gudang pengguna ini. */
  const trfBadge = S.schemaV3 && typeof transferNeedsAction === 'function'
    ? S.transfers.filter(transferNeedsAction).length : 0;
  /* Penerimaan lama hanya tampil selama masih ada pindahan non-barcode tertunda. */
  const legacyPending = S.transactions.some(t => t.type === 'masuk' && t.saleType === 'pindah_gudang'
    && (t.deliveryStatus || '') === 'belum' && regs.includes(t.region));

  nav.innerHTML = `
    ${nv(BASE_URL + '/pages/dashboard/dashboard.html', 'bi-grid-1x2', 'Dashboard', 'dashboard')}
    <div class="nav-section">Transaksi</div>
    ${nv(BASE_URL + '/pages/transaksi/masuk.html',     'bi-box-arrow-in-down', 'Barang Masuk', 'masuk')}
    ${nv(BASE_URL + '/pages/transaksi/keluar.html',    'bi-box-arrow-up', 'Barang Keluar', 'keluar')}
    ${nv(BASE_URL + '/pages/transaksi/riwayat.html',   'bi-clock-history', 'Riwayat', 'riwayat')}
    ${isSA ? nv(BASE_URL + '/pages/transaksi/import.html', 'bi-folder2-open', 'Import CSV', 'import') : ''}
    ${S.schemaV3 ? `<div class="nav-section">Pindah Gudang</div>
    ${nv(BASE_URL + '/pages/transfer/transfer.html', 'bi-qr-code', 'Transfer Barcode', 'transfer', trfBadge)}` : ''}
    <div class="nav-section">Penjualan</div>
    ${nv(BASE_URL + '/pages/transaksi/pengantaran.html', 'bi-truck', 'Pengantaran', 'pengantaran')}
    ${nv(BASE_URL + '/pages/transaksi/pinjaman.html',    'bi-arrow-return-left', 'Tabung Pinjaman', 'pinjaman')}
    ${legacyPending || !S.schemaV3 ? nv(BASE_URL + '/pages/transaksi/penerimaan.html', 'bi-inbox', 'Penerimaan Pindah', 'penerimaan') : ''}
    ${surabayaGroup}
    <div class="nav-section">Laporan</div>
    ${harianGroup}
    ${bulananGroup}
    ${isSA ? `
      <div class="nav-section">Admin</div>
      ${S.schemaV3 ? nv(BASE_URL + '/pages/admin/products.html', 'bi-tags', 'Kelola Produk', 'products') : ''}
      ${nv(BASE_URL + '/pages/admin/regions.html',   'bi-buildings', 'Kelola Region', 'regions')}
      ${nv(BASE_URL + '/pages/admin/customers.html', 'bi-person-lines-fill', 'Kelola Customer', 'customers')}
      ${nv(BASE_URL + '/pages/admin/users.html',     'bi-people', 'Kelola User', 'users')}
      ${nv(BASE_URL + '/pages/admin/actlog.html',    'bi-journal-text', 'Log Aktivitas', 'actlog')}
    ` : ''}`;

  if (typeof updateThemeToggleUI === 'function') updateThemeToggleUI();
}
