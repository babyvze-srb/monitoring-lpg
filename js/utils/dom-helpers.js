/* ===== DOM HELPERS =====
   Dimuat di SEMUA halaman (sebelum modul UI), jadi semua fungsi di sini
   tersedia secara global saat render dipanggil.
   (gid() ada di data-service.js karena dipakai lebih dulu di sana.) */

/* ── esc(): escape HTML untuk mencegah stored XSS ──
   WAJIB dipakai membungkus SEMUA data dinamis (input user, isi DB) yang
   disisipkan ke template HTML via innerHTML. Tanpa ini, teks seperti
   "<img src=x onerror=...>" pada field Keterangan/Pihak akan dieksekusi
   di browser admin saat membuka Riwayat / Log Aktivitas. */
function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

/* Alias eksplisit saat nilai dipakai di dalam atribut HTML (value="...",
   title="..."). Implementasinya sama karena esc() sudah meng-escape kutip. */
const escAttr = esc;

/* Format angka ribuan ala Indonesia (mis. 1234 → "1.234"). */
function fmtNum(n) {
  return (Number(n) || 0).toLocaleString('id-ID');
}

/* ── PAGINATION ──
   paginate(): potong array sesuai halaman (otomatis clamp bila halaman
   melebihi total). pagerHtml(): render kontrol halaman; tiap tombol memanggil
   fnName(nomorHalaman). */
function paginate(arr, page, per) {
  arr = arr || [];
  per = per || 25;
  const total = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / per));
  const p = Math.min(Math.max(1, page || 1), totalPages);
  return {
    items: arr.slice((p - 1) * per, p * per),
    page: p, totalPages, total, per,
    from: total === 0 ? 0 : (p - 1) * per + 1,
    to: Math.min(p * per, total)
  };
}
function pagerHtml(meta, fnName) {
  if (!meta || meta.totalPages <= 1) {
    return meta && meta.total ? `<div class="pager"><span class="pager-info">Total ${meta.total} baris</span></div>` : '';
  }
  const { page, totalPages, from, to, total } = meta;
  const win = 2, nums = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - win && i <= page + win)) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  const btn = (lbl, p, active, disabled) =>
    `<button class="pager-btn${active ? ' active' : ''}"${disabled ? ' disabled' : ''} onclick="${fnName}(${p})">${lbl}</button>`;
  const numHtml = nums.map(n => n === '…' ? `<span class="pager-ellipsis">…</span>` : btn(n, n, n === page, false)).join('');
  return `<div class="pager">
    <span class="pager-info">Menampilkan ${from}–${to} dari ${total}</span>
    <div class="pager-ctrl">${btn('‹', page - 1, false, page <= 1)}${numHtml}${btn('›', page + 1, false, page >= totalPages)}</div>
  </div>`;
}
