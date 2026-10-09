/* store.js — helper dasar + pengaturan. Dimuat di index.html dan settings.html. */

const SETTINGS_KEY = "ShortcutSettings";
const ON_OFF = [["on", "Aktif"], ["off", "Nonaktif"]];

const SECTIONS = [
  { id: "shortcut", label: "Shortcut" },
  { id: "list", label: "List" },
  { id: "tampilan", label: "Tampilan" },
];

// Halaman Settings dibuat dari daftar ini. Tambah setting = tambah satu baris.
const SETTING_DEFS = [
  { key: "shortcutSort", section: "shortcut", label: "Urutan Shortcut", def: "custom",
    options: [["custom", "Custom"], ["az", "Nama A–Z"], ["za", "Nama Z–A"], ["newest", "Terbaru"], ["oldest", "Terlama"]] },
  { key: "openIn", section: "shortcut", label: "Buka Shortcut di", def: "new",
    options: [["new", "Tab Baru"], ["same", "Tab yang Sama"]] },
  { key: "allowDuplicate", section: "shortcut", label: "Shortcut Duplikat", def: "on", options: ON_OFF },
  { key: "moveMode", section: "shortcut", label: "Pindah Shortcut ke List Lain", def: "cut",
    options: [["cut", "Cut (Dipindah)"], ["copy", "Duplikat (Disalin)"]] },
  { key: "importMode", section: "list", label: "Import List Bernama Sama", def: "new",
    options: [["new", "Buat Baru"], ["overwrite", "Timpa yang Ada"]] },
  { key: "listSort", section: "list", label: "Urutan List", def: "custom",
    options: [["custom", "Custom"], ["number", "Number"], ["alphabet", "Alphabet"]] },
  { key: "confirmDelete", section: "list", label: "Konfirmasi Penghapusan", def: "on", options: ON_OFF },
  { key: "gridCols", section: "tampilan", label: "Kolom Grid", def: "3",
    options: [1, 2, 3, 4].map((n) => [String(n), `${n} Kolom`]) },
    { key: "theme", section: "tampilan", label: "Tema", def: "auto",
  options: [["auto", "Otomatis (ikut perangkat)"], ["light", "Terang"], ["dark", "Gelap"]] },
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