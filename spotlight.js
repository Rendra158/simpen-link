/* spotlight.js — panduan singkat (tour). Butuh store.js (h). */
const TOUR_KEY = "ShortcutTourDone";

const L = (v) => (v && typeof v === "object" ? v[settings.language] || v.id : v);

const UI = {
  skip: { id: "Lewati", en: "Skip" },
  back: { id: "Kembali", en: "Back" },
  next: { id: "Lanjut", en: "Next" },
  done: { id: "Selesai", en: "Done" },
};

const TOUR_STEPS = [
  { target: null,
    title: { id: "Selamat datang di Simpen.Link", en: "Welcome to Simpen.Link" },
    text: {
      id: "Tempat menyimpan dan merapikan link website favoritmu, tanpa perlu akun.\nData tersimpan di perangkatmu sendiri.\nIkuti panduan singkat ini, atau lewati kapan saja.",
      en: "A place to save and organize your favorite website links, no account needed.\nYour data stays on your own device.\nFollow this short guide, or skip it any time." } },

  { target: ".textbox-wrapper",
    title: { id: "Textbox", en: "Textbox" },
    text: {
      id: "Ini pusat semua perintah. Ketik atau tempel (paste) sesuatu, lalu tekan Enter.\nKamu tidak perlu mengkliknya dulu: mengetik di mana saja langsung masuk ke sini.\nWarna dan ikonnya berubah sesuai mode yang aktif.",
      en: "This is the center of all commands. Type or paste something, then press Enter.\nNo need to click it first: typing anywhere goes straight in here.\nIts color and icon change with the active mode." } },

  { target: ".mode-icon-box",
    title: { id: "Ganti Mode", en: "Switch Mode" },
    text: {
      id: "Klik ikon ini. Jika textbox berisi teks, perintah dijalankan. Jika kosong, mode berpindah (bisa juga dengan tombol ← →):\n• Add Link: simpan website baru. Isi alamatnya saja, nama dan catatan boleh dikosongkan (nama dibuat otomatis).\n• Add List: buat list (kelompok) baru.\n• Search: cari shortcut dari semua list.",
      en: "Click this icon. If the textbox has text, the command runs. If it is empty, the mode switches (you can also use the ← → keys):\n• Add Link: save a new website. Just enter the address; name and note are optional (the name is made automatically).\n• Add List: create a new list (group).\n• Search: find shortcuts across all lists." } },

  { target: ".List",
    title: { id: "List (Kelompok)", en: "Lists (Groups)" },
    text: {
      id: "Kelompokkan shortcut ke dalam list, misalnya Kerja, Belajar, atau Hiburan. Favorite adalah halaman Home.\n• Klik untuk berpindah list.\n• Dobel-klik untuk mengganti nama.\n• Klik kanan (di HP: tahan) untuk memilih.\n• Tahan lalu geser untuk mengubah urutan list.\nDi mode Search, bagian ini berubah menjadi pilihan cari berdasarkan Nama, URL, Note, atau List.",
      en: "Group shortcuts into lists, like Work, Study, or Fun. Favorite is your Home page.\n• Click to switch lists.\n• Double-click to rename.\n• Right-click (on phones: press and hold) to select.\n• Hold, then drag to reorder lists.\nIn Search mode, this area becomes the choice to search by Name, URL, Note, or List." } },

  { target: ".shortcuts-grid",
    title: { id: "Shortcut", en: "Shortcuts" },
    text: {
      id: "Setiap kartu adalah satu website.\n• Klik: buka website.\n• Dobel-klik: salin link.\n• Klik kanan (di HP: tahan): pilih kartu.\n• Dobel klik kanan: edit.\n• Seret (drag & drop): ubah urutan, atau jatuhkan ke list lain untuk memindahkan.\nJika ada ikon panah kecil di kanan kartu, klik untuk melihat catatannya.",
      en: "Each card is one website.\n• Click: open the website.\n• Double-click: copy the link.\n• Right-click (on phones: press and hold): select the card.\n• Double right-click: edit.\n• Drag & drop: reorder, or drop onto another list to move it.\nIf a small arrow icon appears on the right of a card, click it to see its note." } },

  { target: ".home-reco-select",
    title: { id: "Panel di Home", en: "Home Panel" },
    text: {
      id: "Di halaman Home, sisi kanan punya panel yang bisa diganti lewat menu ini:\n• Rekomendasi: website pilihan, tekan + untuk menambahkannya.\n• Sering dibuka, Baru ditambahkan, Terakhir dipakai: jalan pintas ke shortcut-mu.\n• Pin: shortcut yang kamu sematkan.",
      en: "On the Home page, the right side has a panel you can change with this menu:\n• Recommended: picked websites, press + to add one.\n• Most opened, Recently added, Recently used: quick access to your shortcuts.\n• Pin: shortcuts you have pinned." } },

  { target: "#more-count",
    title: { id: "Jumlah & Pilih Semua", en: "Count & Select All" },
    text: {
      id: "Angka ini adalah jumlah shortcut di list yang sedang dibuka.\nKlik angka ini untuk memilih semua shortcut di list tersebut sekaligus.",
      en: "This number is how many shortcuts are in the current list.\nClick it to select all shortcuts in that list at once." } },

  { target: ".bar .bar-group",
    title: { id: "Saat Ada yang Dipilih", en: "When Something Is Selected" },
    text: {
      id: "Begitu kamu memilih kartu atau list, bar di atas berganti menjadi tombol aksi:\n• Delete: hapus.\n• Edit: ubah isi shortcut atau ganti nama list.\n• Pin: sematkan shortcut agar tampil paling atas (tekan lagi untuk melepas).\n• Export: simpan list sebagai file cadangan.\n• X: batal memilih.\nDi HP, selama ada yang dipilih, mengetuk kartu berarti memilih, bukan membuka link.",
      en: "As soon as you select cards or lists, the top bar turns into action buttons:\n• Delete: remove.\n• Edit: change a shortcut or rename a list.\n• Pin: pin a shortcut to the top (press again to unpin).\n• Export: save lists as a backup file.\n• X: cancel selection.\nOn phones, while something is selected, tapping a card selects it instead of opening the link." } },

  { target: "#more-import",
    title: { id: "Import", en: "Import" },
    text: {
      id: "Masukkan data dari file. Bisa dari file cadangan Simpen.Link (.json) atau file bookmark dari browser (.html).\nBookmark lamamu bisa langsung dipindahkan ke sini.",
      en: "Bring in data from a file. It can be a Simpen.Link backup (.json) or a bookmarks file exported from your browser (.html).\nYour old bookmarks can be moved here directly." } },

  { target: ".sl-account-select",
    title: { id: "Akun Google", en: "Google Account" },
    text: {
      id: "Punya beberapa akun Google? Pilih akun di sini, lalu link Google dan YouTube akan terbuka dengan akun itu.\n\"Otomatis\" berarti browser yang memilih. Pilih \"+ Tambah akun…\" untuk mendaftarkan email baru.",
      en: "Have several Google accounts? Pick one here, and Google and YouTube links will open with that account.\n\"Otomatis\" (Auto) lets the browser decide. Choose \"+ Add account…\" to register a new email." } },

  { target: "#more-settings",
    title: { id: "Akun Google (opsional)", en: "Google Account (optional)" },
    text: {
      id: "Punya beberapa akun Google? Aktifkan \"Buka Shortcut dengan Akun Berbeda\" di Settings > Advanced. Setelah aktif, pilihan akun muncul di bar atas dan link Google/YouTube terbuka dengan akun yang dipilih.",
      en: "Have several Google accounts? Turn on \"Open Shortcuts with Different Accounts\" in Settings > Advanced. Once on, an account picker appears in the top bar and Google/YouTube links open with the chosen account." } },

  { target: "#more-info",
    title: { id: "Butuh bantuan lagi?", en: "Need more help?" },
    text: {
      id: "Klik tombol Info kapan saja untuk membuka panduan ini lagi.\nSelamat mencoba!",
      en: "Click the Info button any time to open this guide again.\nEnjoy!" } },
];

let tour = null;   // { idx, blocker, spot, tip, onKey, onResize }

function startSpotlight() {
  if (tour) return;
  if (document.activeElement) document.activeElement.blur();   // tutup keyboard di HP

  const blocker = h("div", { class: "sp-blocker" });
  const spot = h("div", { class: "sp-spot" });
  const title = h("h3", { class: "sp-title" });
  const text = h("p", { class: "sp-text" });
  const count = h("span", { class: "sp-count" });
  const skip = h("button", { type: "button", class: "bulk-btn sp-skip" });
  const back = h("button", { type: "button", class: "bulk-btn bulk-cancel" });
  const next = h("button", { type: "button", class: "bulk-btn bulk-export" });
  const tip = h("div", { class: "sp-tip", role: "dialog", "aria-modal": "true" },
    title, text, h("div", { class: "sp-foot" }, count, skip, back, next));
  document.body.append(blocker, spot, tip);

  tour = { idx: 0, blocker, spot, tip };

  const render = () => {
    const step = TOUR_STEPS[tour.idx];
    const last = tour.idx === TOUR_STEPS.length - 1;
    title.textContent = L(step.title);
    text.textContent = L(step.text);
    count.textContent = `${tour.idx + 1}/${TOUR_STEPS.length}`;
    skip.textContent = L(UI.skip);
    back.textContent = L(UI.back);
    next.textContent = last ? L(UI.done) : L(UI.next);
    back.style.display = tour.idx === 0 ? "none" : "";
    skip.style.display = last ? "none" : "";
    place();
  };

  const place = () => {
    const step = TOUR_STEPS[tour.idx];
    const el = step.target && document.querySelector(step.target);
    const r = el ? el.getBoundingClientRect() : null;
    const ok = r && r.width > 0 && r.height > 0;   // target tidak ada / tersembunyi: kartu di tengah
    const vw = window.innerWidth, vh = window.innerHeight, pad = 6, gap = 14;

    if (ok) {
      Object.assign(spot.style, {
        left: r.left - pad + "px", top: r.top - pad + "px",
        width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px",
      });
    } else {
      Object.assign(spot.style, { left: vw / 2 + "px", top: vh / 2 + "px", width: "0px", height: "0px" });
    }

    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let top = (vh - th) / 2;
    let left = (vw - tw) / 2;
    if (ok) {
      left = Math.min(Math.max(r.left + r.width / 2 - tw / 2, 10), vw - tw - 10);
      if (r.bottom + pad + gap + th < vh) top = r.bottom + pad + gap;          // di bawah target
      else if (r.top - pad - gap - th > 0) top = r.top - pad - gap - th;       // di atas target
      /* target terlalu besar (mis. grid): kartu tetap di tengah layar */
    }
    tip.style.left = left + "px";
    tip.style.top = Math.max(10, top) + "px";
  };

  const go = (d) => {
    const n = tour.idx + d;
    if (n < 0) return;
    if (n >= TOUR_STEPS.length) return endSpotlight();
    tour.idx = n;
    render();
  };

  tour.onKey = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); endSpotlight(); }
    else if (e.key === "ArrowRight") { e.stopPropagation(); go(1); }
    else if (e.key === "ArrowLeft") { e.stopPropagation(); go(-1); }
    /* Enter/Spasi dibiarkan: ditangani tombol yang sedang fokus */
  };
  tour.onResize = place;
  document.addEventListener("keydown", tour.onKey, true);
  window.addEventListener("resize", tour.onResize);

  next.addEventListener("click", () => go(1));
  back.addEventListener("click", () => go(-1));
  skip.addEventListener("click", endSpotlight);

  render();
  next.focus();
}

function endSpotlight() {
  if (!tour) return;
  document.removeEventListener("keydown", tour.onKey, true);
  window.removeEventListener("resize", tour.onResize);
  tour.blocker.remove();
  tour.spot.remove();
  tour.tip.remove();
  tour = null;
  try { localStorage.setItem(TOUR_KEY, "1"); } catch {}   // selesai atau dilewati = dianggap sudah lihat
}

/* otomatis muncul saat pertama kali memakai website */
if (!localStorage.getItem(TOUR_KEY)) {
  window.addEventListener("load", () => setTimeout(startSpotlight, 400));
}