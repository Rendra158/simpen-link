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
    { 
        target: null,
        title: { id: "Selamat datang di Simpen.Link!", en: "Welcome to Simpen.Link!" },
        text: {
            id: "Tempat menyimpan dan merapikan link website favoritmu. Data tersimpan aman di perangkatmu sendiri.\nIkuti panduan singkat ini, atau lewati kapan saja.",
            en: "A place to save and organize your favorite website links. Your data stays safely on your own device.\nFollow this short guide, or skip it any time." 
        } 
    },
    { 
        target: ".textbox-wrapper",
        title: { id: "Textbox (Pusat Perintah)", en: "Textbox (Command Center)" },
        text: {
            id: "Ini pusat semua perintah. Ketik atau tempel (paste) URL, lalu tekan Enter.\nKamu tidak perlu mengkliknya dulu: mengetik di mana saja langsung masuk ke sini.",
            en: "This is the center of all commands. Type or paste a URL, then press Enter.\nNo need to click it first: typing anywhere goes straight in here." 
        } 
    },
    { 
        target: ".mode-icon-box",
        title: { id: "Ganti Mode", en: "Switch Mode" },
        text: {
            id: "Klik ikon ini untuk mengganti mode. Jika textbox berisi teks, perintah dijalankan. Jika kosong, mode berpindah (bisa juga dengan tombol ← →):\n• Add Link: simpan website baru.\n• Search: cari shortcut dari semua list.",
            en: "Click this icon to switch modes. If the textbox has text, the command runs. If empty, the mode switches (you can also use ← → keys):\n• Add Link: save a new website.\n• Search: find shortcuts across all lists." 
        } 
    },
    { 
        target: "#folder-row",
        title: { id: "Folder (Wadah Utama)", en: "Folders (Main Containers)" },
        text: {
            id: "Folder adalah wadah terbesar untuk mengelompokkan List-mu.\n• Klik untuk berpindah ke Folder lain.\n• Tombol + di ujung kanan: tambah Folder baru.\n• Dobel-klik untuk mengganti nama Folder.\n• Klik kanan (atau tahan di HP) untuk memilih Folder.\n• Seret (drag & drop) untuk mengubah urutan Folder (jika diatur ke Custom).\n• Kalau Folder banyak, geser ke samping atau pakai roda mouse.",
            en: "Folders are the main containers to group your Lists.\n• Click to switch to another Folder.\n• The + button at the right end adds a new Folder.\n• Double-click to rename a Folder.\n• Right-click (or press and hold on phones) to select a Folder.\n• Drag & drop to reorder Folders (if set to Custom).\n• With many Folders, swipe sideways or use the mouse wheel." 
        } 
    },
    { 
        target: ".List",
        title: { id: "List (Sub-folder)", en: "Lists (Sub-folders)" },
        text: {
            id: "Di dalam setiap Folder, terdapat baris List. List ini berfungsi sebagai sub-folder.\n• Klik untuk membuka List dan melihat shortcut di dalamnya. (Favorite adalah halaman Home).\n• Dobel-klik untuk mengganti nama List.\n• Klik kanan (atau tahan di HP) untuk memilihnya.\n• Seret (drag & drop) untuk mengubah urutan List, atau memindahkan List ke Folder lain.",
            en: "Inside each Folder, there's a row of Lists. These act as sub-folders.\n• Click to open a List and see its shortcuts. (Favorite is your Home page).\n• Double-click to rename a List.\n• Right-click (or press and hold on phones) to select it.\n• Drag & drop to reorder Lists, or move a List to another Folder." 
        } 
    },
    { 
        target: ".shortcuts-grid",
        title: { id: "Kartu Shortcut", en: "Shortcut Cards" },
        text: {
            id: "Setiap kartu adalah satu website.\n• Klik: buka website.\n• Dobel-klik: salin link.\n• Klik kanan (atau tahan di HP): pilih kartu.\n• Seret (drag & drop): ubah urutan, atau jatuhkan ke List lain untuk memindahkan.\n• Klik ikon panah kecil di kanan kartu untuk melihat/menutup catatan (note).",
            en: "Each card is one website.\n• Click: open the website.\n• Double-click: copy the link.\n• Right-click (or press and hold on phones): select the card.\n• Drag & drop: reorder, or drop onto another List to move it.\n• Click the small arrow icon on the right to expand/collapse the note." 
        } 
    },
    { 
        target: ".home-reco-select",
        title: { id: "Panel Kanan Home", en: "Home Right Panel" },
        text: {
            id: "Di halaman Home, sisi kanan punya panel pintasan. Ganti isinya lewat menu ini:\n• Rekomendasi: website pilihan, tekan + untuk menambahkannya.\n• Sering dibuka, Baru ditambahkan, Terakhir dipakai: akses cepat ke shortcut-mu.\n• Pin: shortcut yang kamu sematkan.",
            en: "On the Home page, the right side has a quick access panel. Change its content via this menu:\n• Recommended: picked websites, press + to add one.\n• Most opened, Recently added, Recently used: quick access to your shortcuts.\n• Pin: shortcuts you have pinned." 
        } 
    },
    { 
        target: "#more-count",
        title: { id: "Jumlah & Pilih Semua", en: "Count & Select All" },
        text: {
            id: "Angka ini adalah jumlah shortcut di list yang sedang dibuka.\nKlik angka ini untuk memilih semua shortcut di list tersebut sekaligus.",
            en: "This number shows how many shortcuts are in the current list.\nClick it to select all shortcuts in that list at once." 
        } 
    },
    { 
        target: "#bar-select",
        title: { id: "Saat Ada yang Dipilih", en: "When Something Is Selected" },
        text: {
            id: "Begitu kamu memilih kartu, List, atau Folder, bar di atas berganti menjadi tombol aksi:\n• Delete: hapus yang dipilih.\n• Edit: ubah isi shortcut, atau ganti nama List/Folder.\n• Pin: sematkan shortcut agar tampil paling atas.\n• Export: simpan List/Folder sebagai file cadangan.\n• X: batal memilih.",
            en: "As soon as you select cards, Lists, or Folders, the top bar turns into action buttons:\n• Delete: remove selected items.\n• Edit: change a shortcut, or rename a List/Folder.\n• Pin: pin a shortcut to the top.\n• Export: save Lists/Folders as a backup file.\n• X: cancel selection." 
        } 
    },
    { 
        target: "#more-import",
        title: { id: "Impor Data", en: "Import Data" },
        text: {
            id: "Masukkan data dari file. Bisa dari file cadangan Simpen.Link (.json) atau file bookmark dari browser (.html).\nBookmark lamamu bisa langsung dipindahkan ke sini!",
            en: "Bring in data from a file. It can be a Simpen.Link backup (.json) or a bookmarks file exported from your browser (.html).\nYour old bookmarks can be moved here directly!" 
        } 
    },
    { 
        target: "#more-settings",
        title: { id: "Pengaturan (Settings)", en: "Settings" },
        text: {
            id: "Klik di sini untuk membuka halaman Settings.\nKamu bisa mengatur urutan Folder/List, tema gelap/terang, bahasa, hingga fitur backup otomatis ke file di perangkatmu.",
            en: "Click here to open the Settings page.\nYou can configure Folder/List order, dark/light theme, language, and even automatic backup to a file on your device." 
        } 
    },
    { 
        target: "#more-info",
        title: { id: "Butuh bantuan lagi?", en: "Need more help?" },
        text: {
            id: "Klik tombol Info kapan saja untuk membuka panduan ini lagi.\nSelamat mencoba dan merapikan link-linkmu!",
            en: "Click the Info button any time to open this guide again.\nEnjoy organizing your links!" 
        } 
    },
];

let tour = null; // { idx, blocker, spot, tip, onKey, onResize }

function startSpotlight() {
    if (tour) return;
    if (document.activeElement) document.activeElement.blur(); // tutup keyboard di HP

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
        const ok = r && r.width > 0 && r.height > 0; // target tidak ada / tersembunyi: kartu di tengah

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

    try { localStorage.setItem(TOUR_KEY, "1"); } catch {} // selesai atau dilewati = dianggap sudah lihat
}

/* otomatis muncul saat pertama kali memakai website */
if (!localStorage.getItem(TOUR_KEY)) {
    window.addEventListener("load", () => setTimeout(startSpotlight, 400));
}