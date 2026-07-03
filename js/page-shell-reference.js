/**
 * Ini BUKAN file yang dijalankan browser.
 * Ini adalah catatan struktur shell HTML yang diulang di setiap halaman.
 *
 * Setiap file halaman (dashboard.html, masuk.html, dst) memakai pola:
 *
 * <!DOCTYPE html>
 * <html lang="id">
 * <head>
 *   <meta charset="UTF-8">
 *   <meta name="viewport" content="width=device-width, initial-scale=1.0">
 *   <title>[JUDUL] – Monitoring LPG</title>
 *   <link rel="stylesheet" href="css/base.css">
 *   <link rel="stylesheet" href="css/components.css">
 *   <link rel="stylesheet" href="css/tables.css">
 *   <link rel="stylesheet" href="css/forms.css">
 *   <link rel="stylesheet" href="css/responsive.css">
 * </head>
 * <body>
 *   <!-- loading screen -->
 *   <div id="loading-screen">...</div>
 *
 *   <div class="app">
 *     <!-- sidebar inject point -->
 *     <div id="sidebar-wrap"></div>
 *
 *     <!-- main area -->
 *     <div class="main">
 *       <div class="topbar">
 *         <div style="display:flex;align-items:center;gap:10px">
 *           <button class="hamburger" onclick="toggleSidebar()">☰</button>
 *           <h3>[JUDUL HALAMAN]</h3>
 *         </div>
 *         <div id="topbar-user-tag"></div>
 *       </div>
 *       <div class="content">
 *         <div id="alert-bar"></div>
 *         <div id="page-content"><!-- konten dirender JS --></div>
 *       </div>
 *     </div>
 *   </div>
 *
 *   <div id="modal-root"></div>
 *   <div id="confirm-root"></div>
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <!-- shared scripts -->
 *   <script src="js/config.js"></script>
 *   <script src="js/state.js"></script>
 *   <script src="js/supabase-client.js"></script>
 *   <script src="js/data-service.js"></script>
 *   <script src="js/compute.js"></script>
 *   <script src="js/utils/dom-helpers.js"></script>
 *   <script src="js/utils/export-helpers.js"></script>
 *   <script src="js/ui/sidebar.js"></script>
 *   <script src="js/app-core.js"></script>
 *   <!-- page-specific scripts -->
 *   <script src="js/ui/[MODULE].js"></script>
 *   <script>
 *     boot(function pageInit() {
 *       setContent([RENDER_FUNCTION]());
 *     });
 *   </script>
 * </body>
 * </html>
 */
