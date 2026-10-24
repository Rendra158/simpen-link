/* store.js — helper dasar + pengaturan. Dimuat di index.html dan settings.html. */

const SETTINGS_KEY = "ShortcutSettings";
const ON_OFF = [["on", "Aktif"], ["off", "Nonaktif"]];
const YES_NO = [["on", "Ya"], ["off", "Tidak"]];

const SECTIONS = [
    { id: "shortcut", label: "Shortcut" },
    { id: "list_folder", label: "List / Folder" },
    { id: "tampilan", label: "Tampilan" },
    { id: "advanced", label: "other" },
];

// Halaman Settings dibuat dari daftar ini. Tambah setting = tambah satu baris.
const SETTING_DEFS = [
  { key: "shortcutSort", section: "shortcut", label: "Urutan Shortcut", def: "custom",
    options: [["custom", "Custom"], ["az", "Nama A–Z"], ["za", "Nama Z–A"], ["newest", "Terbaru"], ["oldest", "Terlama"]] },
  { key: "pinSort", section: "shortcut", label: "Urutan Shortcut Pin", def: "az",
    options: [["az", "A–Z"], ["za", "Z–A"], ["09", "0–9"], ["90", "9–0"], ["custom", "Custom"]] },
  { key: "openIn", section: "shortcut", label: "Buka Shortcut di", def: "new",
    options: [["new", "Tab Baru"], ["same", "Tab yang Sama"]] },
  { key: "showLink", section: "shortcut", label: "Link ditampilkan", def: "on", options: YES_NO },
  { key: "cardHeight", section: "shortcut", label: "Tinggi Shortcut", def: "fit",
    options: [["fit", "Menyesuaikan"], ["even", "Rapi (Sama Tinggi)"]] },
  { key: "showLogo", section: "shortcut", label: "Tampilkan Logo Website", def: "on", options: YES_NO },
  { key: "alwaysNote", section: "shortcut", label: "Selalu tampilkan note", def: "off", options: YES_NO },
  { key: "allowDuplicate", section: "shortcut", label: "Shortcut Duplikat", def: "on", options: ON_OFF },
  { key: "moveMode", section: "shortcut", label: "Pindah Shortcut ke List Lain", def: "cut",
    options: [["cut", "Cut (Dipindah)"], ["copy", "Duplikat (Disalin)"]] },
  { key: "folderSort", section: "list_folder", group: "folder", label: "Urutan Folder", def: "custom",
    options: [["custom", "Custom (Drag & Drop)"], ["az", "Nama A–Z"], ["za", "Nama Z–A"], ["09", "0–9"], ["90", "9–0"]] },
  { key: "confirmDeleteFolder", section: "list_folder", group: "folder", label: "Konfirmasi Hapus Folder", def: "on", options: ON_OFF },
  { key: "listSort", section: "list_folder", group: "list", label: "Urutan List", def: "custom",
    options: [["custom", "Custom"], ["az", "Nama A–Z"], ["za", "Nama Z–A"], ["newest", "Terbaru"], ["oldest", "Terlama"]] },
  { key: "importMode", section: "list_folder", group: "list", label: "Import List Bernama Sama", def: "new",
    options: [["new", "Buat Baru"], ["overwrite", "Timpa yang Ada"]] },
  { key: "confirmDelete", section: "list_folder", group: "list", label: "Konfirmasi Penghapusan", def: "on", options: ON_OFF },
  { key: "gridCols", section: "tampilan", label: "Kolom Grid", def: "3",
    options: [1, 2, 3, 4, 5].map((n) => [String(n), `${n} Kolom`]) },
  { key: "theme", section: "tampilan", label: "Tema", def: "auto",
    options: [["auto", "Otomatis (ikut perangkat)"], ["light", "Terang"], ["dark", "Gelap"]] },
  { key: "language", section: "tampilan", label: "Bahasa / Language",
    def: ((navigator.languages && navigator.languages[0]) || navigator.language || "en").toLowerCase().startsWith("id") ? "id" : "en",
    options: [["id", "Indonesia"], ["en", "English"]] },
  { key: "accountPicker", section: "advanced", label: "Buka Shortcut dengan Akun Berbeda", def: "off", options: ON_OFF },
];

/* ---------- helper ---------- */

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

// Buat elemen tanpa innerHTML: teks selalu lewat textContent, jadi aman dari injeksi.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
}

/* ---------- pengaturan (satu kunci localStorage) ---------- */

// Data lama (6 kunci terpisah) dibaca sekali kalau kunci baru belum ada.
function legacySettings() {
  const get = (k) => localStorage.getItem(k);
  const flag = (k, yes, no) => (get(k) === "false" ? no : yes);
  return {
    shortcutSort: get("ShortcutSortShortcut"),
    listSort: get("ShortcutSortMode"),
    gridCols: get("ShortcutGridCols"),
    openIn: flag("ShortcutOpenNewTab", "new", "same"),
    confirmDelete: flag("ShortcutConfirmDelete", "on", "off"),
    allowDuplicate: flag("ShortcutAllowDuplicate", "on", "off"),
  };
}

function loadSettings() {
  let saved = readJSON(SETTINGS_KEY);
  if (!saved || typeof saved !== "object") {
    try { saved = legacySettings(); } catch { saved = {}; }
  }
  // nilai lama "number"/"alphabet" -> A–Z
  if (saved.listSort === "number" || saved.listSort === "alphabet") saved.listSort = "az";
  const s = {};
  for (const d of SETTING_DEFS) {
    s[d.key] = d.options.some(([v]) => v === saved[d.key]) ? saved[d.key] : d.def;
  }
  return s;
}

let settings = loadSettings();

function applyTheme() {
    const t = settings.theme;
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
}
applyTheme();

function saveSettings() {
  applyTheme();
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    alert("Pengaturan gagal disimpan (penyimpanan penuh atau diblokir).");
  }
}

/* ---------- bahasa: teks Indonesia = kunci, Inggris = terjemahan ---------- */
const EN = {
  // Settings
  "Bahasa / Language": "Bahasa / Language",
  "Tampilan": "Display",
  "Aktif": "On",
  "Nonaktif": "Off",
  "Urutan Shortcut": "Shortcut Order",
  "Nama A–Z": "Name A–Z",
  "Nama Z–A": "Name Z–A",
  "Terbaru": "Newest",
  "Terlama": "Oldest",
  "Urutan Shortcut Pin": "Pinned Shortcut Order",
  "Buka Shortcut di": "Open Shortcuts in",
  "Tab Baru": "New Tab",
  "Tab yang Sama": "Same Tab",
  "Shortcut Duplikat": "Duplicate Shortcuts",
  "Pindah Shortcut ke List Lain": "Move Shortcut to Another List",
  "Cut (Dipindah)": "Cut (Move)",
  "Duplikat (Disalin)": "Duplicate (Copy)",
  "Import List Bernama Sama": "Import Lists with Same Name",
  "Buat Baru": "Create New",
  "Timpa yang Ada": "Overwrite Existing",
  "Urutan List": "List Order",
  "Konfirmasi Penghapusan": "Confirm Deletion",
  "Kolom Grid": "Grid Columns",
  "Tema": "Theme",
  "Otomatis (ikut perangkat)": "Auto (follow device)",
  "Terang": "Light",
  "Gelap": "Dark",
  "Pengaturan gagal disimpan (penyimpanan penuh atau diblokir).": "Settings could not be saved (storage full or blocked).",
  "Ya": "Yes",
  "Tidak": "No",
  "Link ditampilkan": "Show link",
  "Selalu tampilkan note": "Always show note",
  "Tinggi Shortcut": "Shortcut Height",
  "Menyesuaikan": "Fit to Content",
  "Rapi (Sama Tinggi)": "Even (Same Height)",
  "Tampilkan Logo Website": "Show Website Logo",
  "Buka Shortcut dengan Akun Berbeda": "Open Shortcuts with Different Accounts",
  "Hapus Semua Data": "Delete All Data",
  "List / Folder": "List / Folder",
  "Urutan Folder": "Folder Order",
  "Konfirmasi Hapus Folder": "Confirm Folder Deletion",
  // Akun
  "Otomatis": "Auto",
  "+ Tambah akun…": "+ Add account…",
  "− Hapus akun ini": "− Remove this account",
  "Email akun Google:": "Google account email:",
  "Nama tampilan:": "Display name:",
  "Email tidak valid.": "Invalid email.",
  "Pilih akun untuk membuka shortcut": "Choose an account to open shortcuts",
  "Pilih akun": "Choose account",
  // Advanced / backup
  "Backup Otomatis": "Automatic Backup",
  "Pilih file backup": "Choose backup file",
  "Backup sekarang": "Back up now",
  "Unduh backup sekarang": "Download backup now",
  "Ganti file": "Change file",
  "Putuskan": "Disconnect",
  "Gagal memilih file.": "Failed to choose file.",
  "Putuskan file backup? File-nya tidak dihapus, hanya tidak diperbarui lagi.": "Disconnect the backup file? The file is not deleted, it just won't be updated anymore.",
  "Browser ini tidak bisa menulis file otomatis. Backup diunduh otomatis maksimal seminggu sekali.": "This browser can't write files automatically. A backup is downloaded automatically at most once a week.",
  "Belum ada file backup. Pilih file, lalu backup berjalan otomatis setiap ada perubahan.": "No backup file yet. Choose a file, then backups run automatically on every change.",
  "Pulihkan dari backup": "Restore from backup",
  "Data saat ini akan diganti dengan isi file backup. Lanjut?": "Current data will be replaced with the backup file. Continue?",
  "Ada file backup tapi data kosong. Menambah shortcut akan menimpa file backup. Lanjut? (Batal = pulihkan lewat Settings > Advanced)": "A backup file exists but data is empty. Adding a shortcut will overwrite the backup file. Continue? (Cancel = restore via Settings > Advanced)",
  "File backup tidak valid.": "Invalid backup file.",
  "Backup dipulihkan.": "Backup restored.",
  "Gagal memulihkan backup.": "Failed to restore backup.",
  "Info gagal dimuat.": "Failed to load info.",
  // Halaman utama
  "Data gagal disimpan (penyimpanan penuh atau diblokir).": "Data could not be saved (storage full or blocked).",
  "URL tidak valid.": "Invalid URL.",
  "Shortcut dengan URL ini sudah ada di list.": "A shortcut with this URL already exists in the list.",
  "List dengan nama itu sudah ada.": "A list with that name already exists.",
  "Nama list sudah dipakai.": "That list name is already in use.",
  "File tidak valid.": "Invalid file.",
  "Tidak ada bookmark di file ini.": "No bookmarks found in this file.",
  "Belum ada shortcut.": "No shortcuts yet.",
  "Belum ada rekomendasi.": "No recommendations yet.",
  "Tidak ada yang cocok.": "No matches.",
  "Rekomendasi": "Recommended",
  "Sering dibuka": "Most opened",
  "Baru ditambahkan": "Recently added",
  "Terakhir dipakai": "Recently used",
  "Belum ada data.": "No data yet.",
  "Nama": "Name",
  "Nama folder sudah dipakai.": "That folder name is already in use.",
  "Minimal harus ada satu folder.": "At least one folder is required.",
  // Tour
  "Lewati": "Skip",
  "Kembali": "Back",
  "Lanjut": "Next",
  "Selesai": "Done",
};

// teks yang mengandung angka/nama
const EN_RE = [
  [/^Hapus (\d+) shortcut\?$/, "Delete $1 shortcuts?"],
  [/^Hapus (\d+) list\?$/, "Delete $1 lists?"],
  [/^(\d+) Kolom$/, "$1 Columns"],
  [/^Dibuka (\d+)x$/, "Opened $1x"],
  [/^Kau memiliki (\d+) shortcut saat ini$/, "You currently have $1 shortcuts"],
  [/^(\d+) shortcut dilewati karena URL sama sudah ada di list tujuan\.$/, "$1 shortcuts skipped (same URL already in the target list)."],
  [/^(\d+) link dari (\d+) list diimpor\.(?: (\d+) dilewati \(URL tidak valid\)\.)?$/,
    (m, a, b, c) => `${a} links from ${b} lists imported.` + (c ? ` ${c} skipped (invalid URL).` : "")],
  [/^File: (.*) — aktif$/, "File: $1 — active"],
  [/^File: (.*) — perlu izin \(buka halaman utama, klik sekali, lalu izinkan\)$/, "File: $1 — permission needed (open the main page, click once, then allow)"],
  [/^Hapus akun (.*) dari daftar\?$/, "Remove account $1 from the list?"],
  [/^Hapus (\d+) folder beserta isinya\?$/, "Delete $1 folders and their contents? "],
];

const tr = (s) => {
  if (settings.language !== "en" || typeof s !== "string") return s;
  if (EN[s]) return EN[s];
  for (const [re, to] of EN_RE) if (re.test(s)) return s.replace(re, to);
  return s;
};

document.documentElement.lang = settings.language;

if (settings.language === "en") {
  // alert & confirm otomatis diterjemahkan
  const _alert = window.alert.bind(window), _confirm = window.confirm.bind(window), _prompt = window.prompt.bind(window);
  window.alert = (m) => _alert(tr(m));
  window.confirm = (m) => _confirm(tr(m));
  window.prompt = (m, d) => _prompt(tr(m), d);

  // teks di halaman otomatis diterjemahkan (data buatan pengguna dilewati)
  const SKIP = ".shortcut-name, .shortcut-url, .shortcut-note, .list-tag, .rename-input, .List button, textarea, script, style, .folder-row button";
  const fix = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) {
      const p = n.parentElement;
      if (!p || p.closest(SKIP)) continue;
      const v = n.nodeValue.trim(), out = tr(v);
      if (v && out !== v) n.nodeValue = n.nodeValue.replace(v, () => out);
    }
  };
  const run = () => {
    fix(document.body);
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType === 3) { if (n.parentElement) fix(n.parentElement); }
      else if (n.nodeType === 1) fix(n);
    }))).observe(document.body, { childList: true, subtree: true });
  };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", run) : run();
}

/* ---------- hapus seluruh data ---------- */
async function wipeAllData() {
  const wait = (req) => new Promise((ok) => {
    req.onsuccess = req.onerror = req.onblocked = () => ok();
    setTimeout(ok, 1500);
  });
  try { localStorage.clear(); sessionStorage.clear(); } catch {}
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) || [];
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {}
  try {
    const keys = (await window.caches?.keys()) || [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {}
  try {
    const dbs = (await indexedDB.databases?.()) || [];
    await Promise.all(dbs.filter((d) => d.name).map((d) => wait(indexedDB.deleteDatabase(d.name))));
  } catch {}
  location.replace("index.html");   // data kosong + panduan (spotlight) muncul lagi
}

function askWipeAll() {
  const en = settings.language === "en";
  const word = en ? "DELETE" : "HAPUS";
  if (!confirm(en
    ? "Delete ALL data (shortcuts, lists, settings, accounts)? This cannot be undone. Backup files already saved on your device are NOT deleted."
    : "Hapus SEMUA data (shortcut, list, pengaturan, akun)? Tindakan ini tidak bisa dibatalkan. File backup yang sudah tersimpan di perangkat TIDAK ikut terhapus.")) return;
  const v = prompt(en ? `Type "${word}" to confirm:` : `Ketik "${word}" untuk memastikan:`);
  if ((v || "").trim().toUpperCase() !== word) {
    alert(en ? "Cancelled. Nothing was deleted." : "Dibatalkan. Tidak ada yang dihapus.");
    return;
  }
  wipeAllData();
}