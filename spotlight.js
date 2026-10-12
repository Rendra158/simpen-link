/* spotlight.js — panduan singkat (tour). Butuh store.js (h). */
const TOUR_KEY = "ShortcutTourDone";

const L = (v) => (v && typeof v === "object" ? v[settings.language] || v.id : v);

const TOUR_STEPS = [
  { target: null,
    title: { id: "Selamat datang di Simpen.Link", en: "Welcome to Simpen.Link" },
    text: {
      id: "Website untuk membuat, menyimpan, dan mengatur shortcut ke berbagai website.\nIkuti panduan singkat ini, atau lewati kapan saja.",
      en: "A website to create, save, and organize shortcuts to your favorite websites.\nFollow this short guide, or skip it any time." } },
  { target: ".textbox-wrapper",
    title: { id: "Textbox", en: "Textbox" },
    text: {
      id: "Pusat semua perintah. Ketik sesuatu lalu tekan Enter. Isinya diproses sesuai mode yang aktif (warna dan ikonnya berubah).",
      en: "The center of all commands. Type something and press Enter. It is processed according to the active mode (its color and icon change)." } },
  { target: ".mode-icon-box",
    title: { id: "Ganti Mode", en: "Switch Mode" },
    text: {
      id: "Klik ikon ini. Jika textbox berisi teks, perintah dijalankan. Jika kosong, mode berpindah (bisa juga dengan tombol ← →):\n• Add Link: buat shortcut. Nama & catatan boleh dikosongkan, nama dibuat otomatis dari website.\n• Add List: buat list baru.\n• Search: cari shortcut dari semua list.",
      en: "Click this icon. If the textbox has text, the command runs. If it is empty, the mode switches (you can also use the ← → keys):\n• Add Link: create a shortcut. Name & note are optional; the name is made automatically from the website.\n• Add List: create a new list.\n• Search: search shortcuts across all lists." } },
  { target: ".List",
    title: { id: "List", en: "List" },
    text: {
      id: "Kelompokkan shortcut ke dalam list. Home untuk yang sering dipakai.\n...",
      en: "Group shortcuts into lists. Home is for the ones you use often.\n..." } },
  { target: ".shortcuts-grid",
    title: { id: "Shortcut", en: "Shortcut" },
    text: {
      id: "Klik untuk membuka, dobel-klik untuk menyalin link.\nKlik kanan (di HP: tahan) untuk memilih. Dobel klik kanan untuk mengedit.\nSeret (drag & drop) untuk mengubah urutan atau memindahkan ke list lain.",
      en: "Click to open, double-click to copy the link.\nRight-click (on phones: press and hold) to select. Double right-click to edit.\nDrag & drop to reorder or move to another list." } },
  { target: ".bar .bar-group",
    title: { id: "Import, Settings & Info", en: "Import, Settings & Info" },
    text: {
      id: "Import untuk memasukkan data, Export (muncul saat list dipilih) untuk mencadangkan. Settings untuk mengatur urutan, tampilan, dan perilaku aplikasi.",
      en: "Import to bring in data, Export (appears when a list is selected) to back up. Settings to adjust ordering, appearance, and app behavior." } },
  { target: "#more-info",
    title: { id: "Butuh bantuan lagi?", en: "Need more help?" },
    text: {
      id: "Klik tombol Info kapan saja untuk membuka panduan ini lagi.",
      en: "Click the Info button any time to open this guide again." } },
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
  const skip = h("button", { type: "button", class: "bulk-btn sp-skip", text: "Lewati" });
  const back = h("button", { type: "button", class: "bulk-btn bulk-cancel", text: "Kembali" });
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
    back.style.display = tour.idx === 0 ? "none" : "";
    skip.style.display = last ? "none" : "";
    next.textContent = last ? "Selesai" : "Lanjut";
    place();
  };

  const place = () => {
    const step = TOUR_STEPS[tour.idx];
    const el = step.target && document.querySelector(step.target);
    const r = el ? el.getBoundingClientRect() : null;
    const ok = r && r.width > 0 && r.height > 0;
    const vw = window.innerWidth, vh = window.innerHeight, pad = 6, gap = 14;

    if (ok) {
      Object.assign(spot.style, {
        left: r.left - pad + "px", top: r.top - pad + "px",
        width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px",
      });
    } else {   // tanpa target: layar digelapkan penuh, kartu di tengah
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
    tip.style.top = top + "px";
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