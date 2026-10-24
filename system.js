/* ---------- akun Google untuk membuka shortcut (harus di atas) ---------- */
const SL_ACC_LIST = "sl_accounts";
const SL_ACC_ACTIVE = "sl_account_active";
const SL_ACC_NEW = "__new__";
const SL_ACC_DEL = "__del__";
const SL_GOOGLE_RE = /(^|\.)google\.[a-z.]+$|(^|\.)youtube\.com$/i;

function accLoad() { try { return JSON.parse(localStorage.getItem(SL_ACC_LIST)) || []; } catch { return []; } }
function accSave(list) { try { localStorage.setItem(SL_ACC_LIST, JSON.stringify(list)); } catch {} }
function accActive() { try { return localStorage.getItem(SL_ACC_ACTIVE) || ""; } catch { return ""; } }
function accSetActive(email) { try { localStorage.setItem(SL_ACC_ACTIVE, email); } catch {} }

// Link Google/YouTube diberi ?authuser=email. Link lain dikembalikan apa adanya.
function withAccount(url) {
    if (settings.accountPicker === "off") return url;
    const acc = accActive();
    if (!acc) return url;
    try {
        const u = new URL(url);
        if (!SL_GOOGLE_RE.test(u.hostname)) return url;
        u.pathname = u.pathname.replace(/\/u\/\d+(?=\/|$)/, "");
        u.searchParams.set("authuser", acc);
        return u.toString();
    } catch { return url; }
}

// Dropdown akun. onChange dipanggil setelah akun berganti.
function accountPicker(onChange) {
    const sel = document.createElement("select");
    sel.className = "sl-account-select";
    sel.title = tr("Pilih akun untuk membuka shortcut");
    sel.setAttribute("aria-label", tr("Pilih akun"));

    const add = (value, label) => {
        const o = document.createElement("option");
        o.value = value;
        o.textContent = label;
        sel.append(o);
    };
    add("", "Otomatis");
    accLoad().forEach((a) => add(a.email, a.name));
    add(SL_ACC_NEW, "+ Tambah akun…");
    if (accActive()) add(SL_ACC_DEL, "− Hapus akun ini");

    const cur = accActive();
    sel.value = [...sel.options].some((o) => o.value === cur) ? cur : "";

    sel.addEventListener("change", () => {
        if (sel.value === SL_ACC_NEW) {
            const email = (prompt("Email akun Google:") || "").trim();
            if (/^\S+@\S+\.\S+$/.test(email)) {
                const name = (prompt("Nama tampilan:", email.split("@")[0]) || email).trim();
                const list = accLoad();
                if (!list.some((a) => a.email === email)) list.push({ name, email });
                accSave(list);
                accSetActive(email);
            } else if (email) alert("Email tidak valid.");
        } else if (sel.value === SL_ACC_DEL) {
            const cur = accActive();
            if (confirm(`Hapus akun ${cur} dari daftar?`)) {
                accSave(accLoad().filter((a) => a.email !== cur));
                accSetActive("");
            }
        } else {
            accSetActive(sel.value);
        }
        onChange?.();
    });
    return sel;
}

/* system.js — logika halaman utama. Butuh store.js dan data.js. */
const wrapper = document.querySelector(".textbox-wrapper");
const textbox = document.querySelector(".main");
const icon = document.querySelector(".mode-icon");
const modeIconBox = document.querySelector(".mode-icon-box");
const cancelBtn = document.querySelector(".cancel");
const copyBtn = document.querySelector(".copy");
const listEl = document.querySelector(".List");
const gridEl = document.querySelector(".shortcuts-grid");
const nameField = document.querySelector(".a-name-field");
const noteField = document.querySelector(".a-note-field");
const nameInput = document.querySelector(".a-name");
const noteInput = document.querySelector(".a-note");
const importInput = document.querySelector("#import-file-input");

// Elemen bar atas
const bulkCount = document.querySelector("#bulk-count");
const bulkEditBtn = document.querySelector("#bulk-edit");
const bulkPinBtn = document.querySelector("#bulk-pin");
const bulkDeleteBtn = document.querySelector("#bulk-delete");
const bulkExportBtn = document.querySelector("#bulk-export");
const bulkCancelBtn = document.querySelector("#bulk-cancel");
const moreImportBtn = document.querySelector("#more-import");
const moreSettingsBtn = document.querySelector("#more-settings");
const moreCountBtn = document.querySelector("#more-count");
const moreInfoBtn = document.querySelector("#more-info");
const showBar = (el, on) => el.classList.toggle("bar-hide", !on);
const barHome = document.querySelector("#bar-home");
const barSelect = document.querySelector("#bar-select");

const folderEl = document.querySelector("#folder-row");
const selectedFolders = new Set();
let viewFolderId = null;


// Pasang dropdown akun di bar atas, di antara Settings dan angka total.
function mountAccountPicker() {
    barHome.querySelector(".sl-account-select")?.remove();
    if (settings.accountPicker === "off") return;
    const sel = accountPicker(() => { mountAccountPicker(); renderShortcuts(); });
    sel.classList.add("bar-item");
    barHome.insertBefore(sel, moreCountBtn);
}

const NO_LOGO = "Image/no-logo.svg";
let modeIndex = 0;
let editing = null;
let drag = null;
const coarse = window.matchMedia("(pointer: coarse)");   // layar sentuh (HP/tablet)

// State untuk seleksi
const selectedShortcuts = new Set();
const selectedLists = new Set();
let lastRightClick = { id: null, time: 0, type: null };

/* ---------- mode textbox ---------- */
const modes = [
    {
        id: "link", icon: "Image/link.svg", hint: "Add Shortcut... ", editable: true,
        run(v) {
            const url = parseUrl(v);
            if (!url) { alert("URL tidak valid."); return false; }
            const fields = { name: nameInput.value.trim() || nameFromUrl(url), url, note: noteInput.value.trim() };
            const listId = editing ? editing.listId : currentId;
            if (settings.allowDuplicate === "off" && hasDuplicate(listId, url, editing?.itemId)) {
                alert("Shortcut dengan URL ini sudah ada di list.");
                return false;
            }
            if (editing) {
                editShortcut(listId, editing.itemId, fields);
                setMode(0);
            } else {
                addShortcut(listId, fields);
                renderShortcuts();
            }
            return true;
        },
    },
    { id: "search", icon: "Image/search.svg", hint: "Search Shortcuts... ", editable: false, run: () => false },
];

const mode = () => modes[modeIndex];

/* ---------- pilihan pencarian ---------- */
const SEARCH_OPTS = [["name", "Nama"], ["url", "URL"], ["note", "Note"], ["list", "List"]];
let searchBy = "name";
const matchedLists = (q) => getOrderedLists().filter((l) => l.name.toLowerCase().includes(q));

function setMode(n) {
    modeIndex = n;
    editing = null;
    clearSelection();
    const m = mode();
    icon.src = m.icon;
    textbox.placeholder = m.hint;
    wrapper.className = `textbox-wrapper mode-${m.id}`;
    renderFolders();
    renderLists();
    renderShortcuts();
    refreshUI();
}

function enterEditMode(item, listId) {
    editing = { listId, itemId: item.id };
    modeIndex = 0;
    clearSelection();
    renderShortcuts();   // buang sisa hasil pencarian
    icon.src = "Image/edit.svg";
    textbox.placeholder = "Edit Shortcut...";
    textbox.readOnly = false;
    wrapper.className = "textbox-wrapper mode-edit";
    textbox.value = item.url;
    nameInput.value = item.name;
    noteInput.value = item.note;
    refreshUI();
    textbox.focus();
}

function flashMode() {
    wrapper.animate(
        [{ outline: "2px solid var(--mode-color)" }, { outline: "2px solid transparent" }],
        { duration: 1100, easing: "ease" }
    );
}

function submitOrNextMode() {
    const v = textbox.value.trim();
    if (mode().id === "search") {
        // search List: Enter memilih list yang cocok (1 list = buka list itu juga)
        const ids = searchBy === "list" ? matchedLists(v.toLowerCase()).map((l) => l.id) : [];
        textbox.value = "";
        if (ids.length) {
            if (ids.length === 1) setCurrent(ids[0]);
            setMode(0);
            ids.forEach((id) => selectedLists.add(id));
            updateSelectionUI();
            return;
        }
        setMode((modeIndex + 1) % modes.length);
        flashMode();
        return;
    }
    if (!v) {                      // kosong: Enter / klik ikon = ganti mode
        if (editing) return;       // sedang edit: batalkan lewat Esc atau tombol X
        setMode((modeIndex + 1) % modes.length);
        flashMode();
        return;
    }
    if (mode().run(v)) {           // berhasil: kosongkan textbox, sembunyikan field Name/Note
        textbox.value = "";
        refreshUI();
    }
}

textbox.addEventListener("keydown", (e) => {
    if (e.isComposing || e.repeat) return;
    const empty = textbox.value.trim() === "";
    if (e.key === "Enter") {
        e.preventDefault();
        submitOrNextMode();
    } else if (e.key === "Escape") {
        if (editing) {
            textbox.value = "";
            setMode(0);
            flashMode();
        } else if (selectedShortcuts.size > 0 || selectedLists.size > 0 || selectedFolders.size > 0) {
            clearSelection();
        }
    } else if (empty && !editing && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        setMode((modeIndex + (e.key === "ArrowRight" ? 1 : -1) + modes.length) % modes.length);
        flashMode();
    }
});

textbox.addEventListener("input", refreshUI);
modeIconBox.addEventListener("mousedown", (e) => e.preventDefault());
modeIconBox.addEventListener("click", () => { textbox.focus(); submitOrNextMode(); });
cancelBtn.addEventListener("click", () => {
    textbox.value = "";
    if (editing) { setMode(0); flashMode(); }   // di HP tidak ada Escape: X = batal edit
    else refreshUI();
    textbox.focus();
});
copyBtn.addEventListener("click", async () => {
    const text = textbox.value.trim();
    if (text) flashCopied(copyBtn, await copyText(text));
});

/* ---------- SELEKSI & BULK ACTION ---------- */
function clearSelection() {
    selectedShortcuts.clear();
    selectedLists.clear();
    selectedFolders.clear();
    updateSelectionUI();
}

function updateSelectionUI() {
    const hasShortcuts = selectedShortcuts.size > 0;
    const hasLists = selectedLists.size > 0;
    const hasFolders = selectedFolders.size > 0;
    const hasAny = hasShortcuts || hasLists || hasFolders;

    showBar(bulkCount, hasAny);
    showBar(bulkCancelBtn, hasAny);
    showBar(barHome, !hasAny);
    showBar(barSelect, hasAny);
    bulkCount.textContent = `${selectedShortcuts.size + selectedLists.size + selectedFolders.size} selects`;

    const hasDeletable = hasShortcuts || hasFolders || [...selectedLists].some((id) => !findList(id)?.isDefault);
    showBar(bulkDeleteBtn, hasDeletable);
    showBar(bulkExportBtn, hasLists || hasFolders);

    const oneShortcut = selectedShortcuts.size === 1 && !hasLists && !hasFolders;
    const oneList = selectedLists.size === 1 && !hasShortcuts && mode().editable
        && !findList([...selectedLists][0])?.isDefault;
    const oneFolder = selectedFolders.size === 1 && mode().editable;
    showBar(bulkEditBtn, oneShortcut || oneList || oneFolder);

    // Pin: tampil kalau ada shortcut terpilih. Semua sudah pin = tombol "lepas pin".
    showBar(bulkPinBtn, hasShortcuts && !hasLists);
    if (hasShortcuts) {
        const allPinned = [...selectedShortcuts].every((id) => findItem(currentId, id)?.pinned);
        bulkPinBtn.querySelector("img").src = allPinned ? "Image/n-pin.svg" : "Image/pin.svg";
        bulkPinBtn.setAttribute("aria-label", allPinned ? "Lepas pin" : "Pin");
    }

    document.querySelectorAll(".shortcut-box:not(.reco)").forEach(card => {
        card.classList.toggle("selected", selectedShortcuts.has(card.dataset.id));
    });
    document.querySelectorAll(".List button").forEach(btn => {
        btn.classList.toggle("selected", selectedLists.has(btn.dataset.id));
    });

    folderEl.querySelectorAll("button[data-id]").forEach((b) => {
        b.classList.toggle("selected", selectedFolders.has(b.dataset.id));
    });
}

function toggleShortcutSelection(itemId) {
    selectedFolders.clear();
    selectedLists.clear();   // list dan shortcut tidak boleh terpilih bersamaan
    if (selectedShortcuts.has(itemId)) selectedShortcuts.delete(itemId);
    else selectedShortcuts.add(itemId);
    updateSelectionUI();
}

function toggleListSelection(listId) {
    selectedFolders.clear();
    selectedShortcuts.clear();   // list dan shortcut tidak boleh terpilih bersamaan
    if (selectedLists.has(listId)) selectedLists.delete(listId);
    else selectedLists.add(listId);
    updateSelectionUI();
}

function toggleFolderSelection(id) {
    selectedShortcuts.clear();
    selectedLists.clear();
    if (selectedFolders.has(id)) selectedFolders.delete(id);
    else selectedFolders.add(id);
    updateSelectionUI();
}

bulkDeleteBtn.addEventListener("click", () => {
    if (selectedFolders.size > 0) {
        const ids = [...selectedFolders];
        if (ids.length >= folders.length) { alert("Minimal harus ada satu folder."); return; }
        
        // TAMBAHAN: Cek pengaturan konfirmasi hapus folder
        if (settings.confirmDeleteFolder === "on" && !confirm(`Hapus ${ids.length} folder beserta isinya?`)) return;
        
        ids.forEach((id) => deleteFolder(id));
        selectedFolders.clear();
        renderFolders(); renderLists(); renderShortcuts();
    }
    if (selectedShortcuts.size > 0) {
        const all = [...selectedShortcuts];
        const isPin = (id) => !!findItem(currentId, id)?.pinned;
        // semua terpilih pin -> boleh dihapus; campur -> hanya yang non-pin
        const ids = all.every(isPin) ? all : all.filter((id) => !isPin(id));
        if (settings.confirmDelete === "on" && !confirm(`Hapus ${ids.length} shortcut?`)) return;
        deleteShortcuts(currentId, ids);
        selectedShortcuts.clear();
        renderShortcuts();
    }
    const listIds = [...selectedLists].filter((id) => !findList(id)?.isDefault);
    if (listIds.length > 0) {
        if (settings.confirmDelete === "on" && !confirm(`Hapus ${listIds.length} list?`)) return;
        listIds.forEach(deleteList);
        selectedLists.clear();
        renderLists();
        renderShortcuts();
    }
    updateSelectionUI();
});

bulkPinBtn.addEventListener("click", () => {
    const ids = [...selectedShortcuts];
    if (!ids.length) return;
    const allPinned = ids.every((id) => findItem(currentId, id)?.pinned);
    setPinned(currentId, ids, !allPinned);
    renderShortcuts();   // otomatis memperbarui seleksi & ikon tombol
});

bulkExportBtn.addEventListener("click", async () => {
    const listIds = selectedFolders.size
        ? lists.filter((l) => !l.isDefault && selectedFolders.has(l.folderId)).map((l) => l.id)
        : [...selectedLists];
    if (!listIds.length) return;
    const json = JSON.stringify(exportData(listIds), null, 2);
    try {
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: "shortcuts-export.json",
                types: [{ description: "JSON File", accept: { "application/json": [".json"] } }],
            });
            const w = await handle.createWritable();
            await w.write(json);
            await w.close();
        } else {
            const a = h("a", {
                href: URL.createObjectURL(new Blob([json], { type: "application/json" })),
                download: "shortcuts-export.json",
            });
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }
    } catch (err) {
        if (err.name !== "AbortError") console.error(err);
    }
    selectedLists.clear();
    selectedFolders.clear();
    updateSelectionUI();
    renderLists();
});

bulkEditBtn.addEventListener("click", () => {
    if (selectedShortcuts.size === 1) {
        const item = findItem(currentId, [...selectedShortcuts][0]);
        if (item) enterEditMode(item, currentId);   // otomatis clearSelection()
    } else if (selectedLists.size === 1) {
        const id = [...selectedLists][0];
        const list = findList(id);
        const btn = listEl.querySelector(`button[data-id="${id}"]`);
        if (!list || list.isDefault || !btn || !mode().editable) return;
        clearSelection();
        startRename(btn, list);
    } else if (selectedFolders.size === 1) {
        const id = [...selectedFolders][0];
        const btn = folderEl.querySelector(`button[data-id="${id}"]`);
        if (!btn || !mode().editable) return;
        clearSelection();
        startRenameFolder(btn, findFolder(id));
    }
});

// tombol batal seleksi
bulkCancelBtn.addEventListener("click", () => {
    clearSelection();
});

/* ---------- tampilan yang bergantung pada isi textbox ---------- */
function refreshUI() {
    const hasValue = textbox.value.trim() !== "";
    const isLink = mode().id === "link";
    const isSearch = mode().id === "search";
    listEl.classList.toggle("List-hidden", !!editing || (isLink && hasValue));
    const showFields = isLink && (hasValue || !!editing);
    nameField.classList.toggle("visible", showFields);
    noteField.classList.toggle("visible", showFields);
    if (!showFields) { nameInput.value = ""; noteInput.value = ""; }
    if (isSearch) renderShortcuts();
}

/* ---------- clipboard ---------- */
async function copyText(text) {
    try {
        if (window.isSecureContext && navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {}
    const prev = document.activeElement;
    const ta = h("textarea", { style: "position:fixed;top:0;left:0;opacity:0" });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    ta.remove();
    prev?.focus?.();
    return ok;
}
function flashCopied(el, ok) {
    el.style.opacity = ok ? "0.4" : "1";
    setTimeout(() => (el.style.opacity = ""), 800);
}

/* ---------- render ---------- */
function faviconSources(url) {
    const u = new URL(url);
    const direct = u.origin + "/favicon.ico";
    const local = u.hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname);
    return local
        ? [direct, NO_LOGO]
        : [`https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`, direct, NO_LOGO];
}

function faviconImg(url, cls = "") {
    const srcs = faviconSources(url);
    let i = 0;
    const img = h("img", {
        class: cls, alt: "", loading: "lazy", decoding: "async",
        referrerpolicy: "no-referrer", src: srcs[0],
    });
    img.addEventListener("error", () => { if (++i < srcs.length) img.src = srcs[i]; });
    return img;
}

function linkOverlay(item) {
    return h("a", {
        class: "stretch",
        href: withAccount(item.url),
        target: settings.openIn === "new" ? "_blank" : "_self",
        rel: "noopener noreferrer",
        draggable: "false",
        "aria-label": item.name,
        title: item.note ? `${item.url}\n\n${item.note}` : item.url,
    });
}


function renderLists() {
    if (mode().id === "search") {   // mode search: list diganti pilihan pencarian
        listEl.replaceChildren(...SEARCH_OPTS.map(([k, label]) =>
            h("button", { type: "button", "data-opt": k, text: tr(label) })));
        updateActive();
        updateSelectionUI();
        return;
    }

    listEl.replaceChildren(
        ...getOrderedLists(viewFolderId || currentFolderId).map((list) => {
            const btn = h("button", {
                type: "button",
                class: list.isDefault ? "favorite" : "",
                "data-id": list.id
            });

            if (list.isDefault) {
                btn.append(
                    h("img", {
                        src: "Image/star.svg",
                        alt: "",
                        draggable: "false"
                    }),
                    list.name
                );
            } else {
                btn.textContent = list.name;
            }

            btn.draggable = false;   // urutan list digeser dengan mouse/sentuh buatan sendiri (blok fitList & sentuh)
            return btn;
        }),

        h("button", {
            type: "button",
            class: "add-btn",
            "aria-label": "Tambah list",
            text: "+"
        })
    );

    updateActive();
    updateSelectionUI();
}

let lastAktif = null;   // folder aktif pada render sebelumnya

function renderFolders() {
    const cur = viewFolderId || currentFolderId;
    const turun = cur !== lastAktif;   // animasi hanya saat folder aktif berganti
    lastAktif = cur;

    folderEl.replaceChildren(
        ...getOrderedFolders().map((f) => h("button", {
            type: "button",
            class: f.id === cur ? (turun ? "aktif turun" : "aktif") : "",
            "data-id": f.id,
            text: f.name
        })),
        h("button", { type: "button", class: "add-btn", "aria-label": "Tambah folder", text: "+" })
    );
    const a = folderEl.querySelector(".aktif");
    if (a) {
        const kiri = a.offsetLeft, kanan = kiri + a.offsetWidth;
        const lihatKiri = folderEl.scrollLeft, lihatKanan = lihatKiri + folderEl.clientWidth;
        if (kiri < lihatKiri) folderEl.scrollLeft = kiri;                                  // terpotong di kiri
        else if (kanan > lihatKanan) folderEl.scrollLeft = kanan - folderEl.clientWidth;   // terpotong di kanan
    }
    updateSelectionUI();
}

function updateActive() {
    const search = mode().id === "search";
    for (const btn of listEl.children) {
        const on = search ? btn.dataset.opt === searchBy : btn.dataset.id === currentId;
        btn.classList.toggle("aktif", on);
        btn.tabIndex = on ? 0 : -1;
    }
}

function makeCard(item, listId, listName = null, opens = null) {
    const alwaysNote = settings.alwaysNote === "on";
    const hasNote = item.note.trim() !== "";
    const top = h("div", { class: "shortcut-top" },
        ...(settings.showLogo === "on"
            ? [h("div", { class: "shortcut-logo-wrap" }, faviconImg(item.url, "shortcut-logo"))] : []),
        h("div", { class: "shortcut-name", text: item.name }));

    // note selalu tampil: tidak perlu tombol buka/tutup (oc-note)
    if (hasNote && !alwaysNote) {
        top.append(h("button", { class: "note-toggle", type: "button", "aria-label": "Tampilkan catatan" },
            h("img", { class: "oc-note", src: "Image/open-close-note.svg", alt: "" })));
    }

    // hasil pencarian: nama list di paling atas kartu (klik = buka list itu)
    const tag = listName === null ? [] : [h("button", { class: "list-tag", type: "button", text: listName, title: listName })];
    if (tag.length && item.pinned) tag[0].prepend(h("img", { class: "tag-pin", src: "Image/pin.svg", alt: "Dipin" }));
    // panel "Sering dibuka": jumlah dibuka di paling atas kartu (biru, tidak bisa diklik)
    if (opens !== null) tag.push(h("div", { class: "count-tag", text: `Dibuka ${opens}x` }));

    const main = [top];
    if (settings.showLink === "on") main.push(h("div", { class: "shortcut-url", text: item.url }));
    const open = hasNote && alwaysNote ? " note-open" : "";

    const card = h("div", { class: `shortcut-box ui-3d${tag.length ? " has-tag" : ""}${item.pinned ? " pinned" : ""}${open}${settings.showLogo === "on" ? "" : " no-logo"}`, "data-id": item.id, "data-list": listId },
        h("div", { class: "shortcut-main" }, ...main),
        ...tag,
        linkOverlay(item));

    if (hasNote) card.insertBefore(h("div", { class: "shortcut-note", text: item.note }), card.lastChild);
    card.draggable = true;
    return card;
}

// skor kecocokan: makin besar makin sesuai (0 = tidak cocok)
function matchScore({ name, url, note }, q, by) {
    if (by === "list") return 1;   // list sudah disaring di renderSearch
    const text = (by === "url" ? url.replace(/^https?:\/\/(www\.)?/i, "") : by === "note" ? note : name).toLowerCase();
    if (text === q) return 5;
    if (text.startsWith(q)) return 4;
    if (text.includes(q)) return 3;
    return 0;
}

function renderSearch() {
    const listLabel = (l) => {
        const f = findFolder(l.folderId)?.name;
        return l.isDefault || !f ? l.name : `${f}/${l.name}`;
    };
    const q = textbox.value.trim().toLowerCase();
    if (!q) { gridEl.replaceChildren(); return; }   // belum mengetik: kosong
    const rows = getOrderedLists()
        .filter((list) => searchBy !== "list" || list.name.toLowerCase().includes(q))
        .flatMap((list) => list.items.map((item) => ({ item, list, s: matchScore(item, q, searchBy) })))
        .filter((r) => r.s > 0)
        .sort((a, b) => (b.item.pinned ? 1 : 0) - (a.item.pinned ? 1 : 0) || b.s - a.s);   // pin dulu, lalu skor
    gridEl.replaceChildren(...(rows.length
        ? rows.map(({ item, list }) => makeCard(item, list.id, listLabel(list)))
        : [h("div", { class: "shortcuts-empty", text: "Tidak ada yang cocok." })]));
}

/* ---------- Home: judul + shortcut (kiri) + rekomendasi (kanan) ---------- */
let recoItems = [];
fetch("recommend.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : []))
    .then((a) => {
        recoItems = (Array.isArray(a) ? a : []).map(cleanItem).filter(Boolean);
        if (mode().id !== "search") renderShortcuts();
    })
    .catch(() => {});

const VIEW_KEY = "ShortcutHomeView";
const HOME_VIEWS = [
    ["reco", "Rekomendasi"], ["frequent", "Sering dibuka"], ["newest", "Baru ditambahkan"],
    ["recent", "Terakhir dipakai"], ["pin", "Pin"],
];
const getHomeMode = () => {
    const v = localStorage.getItem(VIEW_KEY);
    return HOME_VIEWS.some(([k]) => k === v) ? v : "reco";
};

function panelItems(mode) {
    const all = lists.flatMap((l) => l.items.map((item) => ({ item, listId: l.id })));
    if (mode === "frequent") return all.filter((r) => r.item.opens > 0).sort((a, b) => b.item.opens - a.item.opens).slice(0, 10);
    if (mode === "newest") return [...all].sort((a, b) => b.item.added - a.item.added).slice(0, 10);
    if (mode === "recent") return all.filter((r) => r.item.lastOpen > 0).sort((a, b) => b.item.lastOpen - a.item.lastOpen).slice(0, 10);
    const pins = all.filter((r) => r.item.pinned);
    if (settings.pinSort === "custom") {   // urutan hasil drag di panel (yang belum pernah diurutkan ke belakang)
        const o = (r) => (r.item.pinOrder > 0 ? r.item.pinOrder : 1e15);
        return pins.sort((a, b) => o(a) - o(b));
    }
    const isNum = (r) => /^\d/.test(r.item.name);
    return pins.sort((a, b) =>
        isNum(a) !== isNum(b) ? (isNum(a) ? 1 : -1) : cmpText(a.item.name, b.item.name));   // huruf A-Z dulu, lalu angka 0-9
}

function recoCards() {
    const mode = getHomeMode();
    const empty = (text) => [h("div", { class: "shortcuts-empty", text })];

    if (mode !== "reco") {
        const rows = panelItems(mode);
        if (!rows.length) return empty("Belum ada data.");
        const canPinDrag = mode === "pin" && settings.pinSort === "custom";
        return rows.map(({ item, listId }) => {
            const card = makeCard({ ...item, note: "" }, listId, null, mode === "frequent" ? item.opens : null);
            card.classList.add("reco");
            card.draggable = canPinDrag;
            if (canPinDrag) card.classList.add("pin-card");
            return card;
        });
    }

    const shown = recoItems.filter((r) => !hasDuplicate(currentId, r.url));   // yang sudah ada di Home disembunyikan
    if (!shown.length) return empty("Belum ada rekomendasi.");
    return shown.map((item) => {
        const card = makeCard({ ...item, note: "" }, "reco");
        card.classList.add("reco");
        card.draggable = false;
        const add = h("button", { class: "reco-add", type: "button", title: "Tambah ke Home", "aria-label": "Tambah ke Home", text: "+" });
        add.addEventListener("click", () => {
            addShortcut(currentId, { name: item.name, url: item.url, note: item.note });
            renderShortcuts();
        });
        card.append(add);
        return card;
    });
}

function homeView(cards) {
    const total = lists.reduce((n, l) => n + l.items.length, 0);   // total semua list
    const sel = h("select", { class: "home-reco-select", "aria-label": "Panel" },
        ...HOME_VIEWS.map(([v, label]) => h("option", { value: v, text: label })));
    sel.value = getHomeMode();
    sel.addEventListener("change", () => {
        try { localStorage.setItem(VIEW_KEY, sel.value); } catch {}
        renderShortcuts();
    });
    return [
        h("div", { class: "home-head" },
            h("h1", { class: "home-title", text: "Simpen.Link" }),
            h("p", { class: "home-sub", text: `Kau memiliki ${total} shortcut saat ini` })),
        h("div", { class: "home-body" },
            h("div", { class: "home-left" }, ...cards),
            h("div", { class: "home-lv" }),
            h("div", { class: "home-reco" }, sel, ...recoCards())),
    ];
}

// note yang selalu tampil: hitung ulang tinggi kartunya (2-3 baris grid)
function fitAllNotes() {
    if (settings.alwaysNote !== "on") return;
    gridEl.querySelectorAll(".shortcut-box.note-open").forEach(fitNote);
}
window.addEventListener("resize", fitAllNotes);
document.fonts?.ready.then(fitAllNotes);

// mode "Rapi": semua kartu dalam satu baris setinggi kartu tertinggi (note tampil utuh)
function equalizeRows() {
    const cards = [...gridEl.querySelectorAll(".shortcut-box:not(.reco):not(.has-tag)")];
    cards.forEach((c) => (c.style.minHeight = ""));
    if (settings.cardHeight !== "even" || !cards.length) return;
    const rows = new Map();
    for (const c of cards) {
        const k = Math.round(c.getBoundingClientRect().top);
        (rows.get(k) || rows.set(k, []).get(k)).push(c);
    }
    for (const row of rows.values()) {
        const tallest = Math.max(...row.map((c) => c.scrollHeight));
        row.forEach((c) => (c.style.minHeight = tallest + "px"));
    }
}
const equalizeLater = () => requestAnimationFrame(equalizeRows);
window.addEventListener("resize", equalizeLater);
document.fonts?.ready.then(equalizeLater);

function renderShortcuts() {
    updateCount();
    if (mode().id === "search") { renderSearch(); updateSelectionUI(); renderIndex(); return; }
    const list = findList(currentId);
    const rows = sortItems(list.items.map((item) => ({ item })));
    const cards = rows.length
        ? rows.map(({ item }) => makeCard(item, currentId))
        : [h("div", { class: "shortcuts-empty", text: "Belum ada shortcut." })];
    gridEl.replaceChildren(...(list.isDefault ? homeView(cards) : cards));
    updateSelectionUI();
    fitAllNotes();
    equalizeLater();
    renderIndex();
}

// dari hasil pencarian: buka list-nya, pilih shortcut-nya, mode kembali ke Add Link
function goToList(listId, itemId) {
    textbox.value = "";
    setCurrent(listId);
    setMode(0);
    toggleShortcutSelection(itemId);
    gridEl.querySelector(`.shortcut-box[data-id="${itemId}"]`)?.scrollIntoView({ block: "center" });
}

/* ---------- list kategori ---------- */
const listBtn = (e) => e.target.closest?.("button[data-id]");

function switchList(id) {
    if (id !== currentId) selectedShortcuts.clear();
    setCurrent(id);
    updateActive();
    renderShortcuts();
}

listEl.addEventListener("click", (e) => {
    const btn = listBtn(e);
    if (!btn || e.target.closest(".rename-input")) return;
    if (coarse.matches && selectedLists.size > 0) { toggleListSelection(btn.dataset.id); return; }
    switchList(btn.dataset.id);
    btn.focus();
});

listEl.addEventListener("click", (e) => {
    const opt = e.target.closest("button[data-opt]");
    if (!opt) return;
    searchBy = opt.dataset.opt;
    updateActive();
    renderSearch();
    textbox.focus();
});

listEl.addEventListener("contextmenu", (e) => {
    const btn = listBtn(e);
    if (!btn || e.target.closest(".rename-input")) return;
    e.preventDefault();
    toggleListSelection(btn.dataset.id);
});

listEl.addEventListener("dblclick", (e) => {
    const btn = listBtn(e);
    const list = btn && findList(btn.dataset.id);
    if (list && !list.isDefault && mode().editable && selectedLists.size === 0) startRename(btn, list);
});

function startRename(btn, list) {
    const input = h("input", { class: "rename-input" });
    input.value = list.name;
    btn.draggable = false;
    btn.textContent = "";
    btn.append(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (save) => {
        if (done) return;
        done = true;
        const v = input.value.trim();
        if (save && v && v !== list.name && !renameList(list.id, v)) alert("Nama list sudah dipakai.");
        renderLists();
        renderShortcuts();
        textbox.focus();
    };
    input.addEventListener("keydown", (e) => {
        if (e.isComposing) return;
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
}

listEl.addEventListener("keydown", (e) => {
    if (mode().id === "search") return;
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    if (e.target.classList.contains("rename-input")) return;
    const btns = [...listEl.querySelectorAll("button[data-id]")];   // sebelumnya [...listEl.children]
    const next = btns.findIndex((b) => b.dataset.id === currentId) + (e.key === "ArrowRight" ? 1 : -1);
    if (next < 0 || next >= btns.length) return;
    e.preventDefault();
    switchList(btns[next].dataset.id);
    btns[next].style.visibility = "visible";
    btns[next].focus({ preventScroll: true });
});

listEl.addEventListener("wheel", (e) => {
    if (!e.deltaY || e.shiftKey) return;
    listEl.scrollLeft += e.deltaY;   // browser sendiri membatasi di ujung
    e.preventDefault();
}, { passive: false });

/* ---------- tombol + (list) ---------- */
listEl.addEventListener("click", (e) => {
    if (!e.target.closest(".add-btn")) return;
    const list = addList(uniqueName("New List"));
    if (!list) return;
    setCurrent(list.id);
    renderLists();
    renderShortcuts();
    const btn = listEl.querySelector(`button[data-id="${list.id}"]`);
    if (btn) startRename(btn, list);   // langsung bisa ketik nama
});

/* ---------- baris folder ---------- */
const folderBtn = (e) => e.target.closest?.("button[data-id]");

function goFolder(fid) {
    if (fid === currentFolderId && !viewFolderId) return;   // BARU: folder sama = jangan render ulang
    if (fid !== currentFolderId) { selectedShortcuts.clear(); selectedLists.clear(); }   // GANTI baris lama
    openFolder(fid);
    renderFolders();
    renderLists();
    renderShortcuts();
}

function addFolderInline() {
    const f = addFolder(uniqueFolderName("New Folder"));
    if (!f) return;
    goFolder(f.id);
    const btn = folderEl.querySelector(`button[data-id="${f.id}"]`);
    if (btn) startRenameFolder(btn, f);
}

function startRenameFolder(btn, folder) {
    const input = h("input", { class: "rename-input" });
    input.value = folder.name;
    btn.textContent = "";
    btn.append(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (save) => {
        if (done) return;
        done = true;
        const v = input.value.trim();
        if (save && v && v !== folder.name && !renameFolder(folder.id, v)) alert("Nama folder sudah dipakai.");
        renderFolders();
        textbox.focus();
    };
    input.addEventListener("keydown", (e) => {
        if (e.isComposing) return;
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") finish(false);
    });
    input.addEventListener("blur", () => finish(true));
}

folderEl.addEventListener("click", (e) => {
    if (e.target.closest(".add-btn")) { if (mode().editable) addFolderInline(); return; }
    const btn = folderBtn(e);
    if (!btn || e.target.closest(".rename-input")) return;
    if (coarse.matches && selectedFolders.size > 0) { toggleFolderSelection(btn.dataset.id); return; }
    goFolder(btn.dataset.id);
});
folderEl.addEventListener("contextmenu", (e) => {
    const btn = folderBtn(e);
    if (!btn || e.target.closest(".rename-input")) return;
    e.preventDefault();
    if (mode().editable) toggleFolderSelection(btn.dataset.id);
});
folderEl.addEventListener("dblclick", (e) => {
    const btn = folderBtn(e);
    if (btn && mode().editable && selectedFolders.size === 0) startRenameFolder(btn, findFolder(btn.dataset.id));
});
folderEl.addEventListener("wheel", (e) => {
    if (!e.deltaY || e.shiftKey) return;
    folderEl.scrollLeft += e.deltaY;
    e.preventDefault();
}, { passive: false });

/* ---------- Drag & Drop Folder ---------- */
folderEl.addEventListener("dragstart", (e) => {
    if (settings.folderSort !== "custom" || !mode().editable) { e.preventDefault(); return; }
    const btn = folderBtn(e);
    if (!btn) return;
    const id = btn.dataset.id;
    const ids = selectedFolders.has(id) ? [...selectedFolders] : [id];
    
    drag = { type: "folder", folderIds: ids };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    ids.forEach(fid => folderEl.querySelector(`button[data-id="${fid}"]`)?.classList.add("dragging"));
});

folderEl.addEventListener("dragover", (e) => {
    if (drag?.type !== "folder" || settings.folderSort !== "custom") return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const btn = folderBtn(e);
    folderEl.querySelectorAll(".drop-target").forEach(n => n.classList.remove("drop-target"));
    if (btn && !drag.folderIds.includes(btn.dataset.id)) {
        btn.classList.add("drop-target");
    }
});

folderEl.addEventListener("drop", (e) => {
    if (drag?.type !== "folder") return;
    e.preventDefault();
    const btn = folderBtn(e);
    const d = drag;
    endDrag();
    if (!btn || d.folderIds.includes(btn.dataset.id)) return;

    reorderFolders(d.folderIds, btn.dataset.id);
    renderFolders();
    renderLists();
});

folderEl.addEventListener("dragend", () => {
    if (drag?.type === "folder") endDrag();
});

// geser folder dengan mouse: langsung geser = scroll, tahan 300 ms lalu geser = urutkan
(() => {
    const HOLD_MS = 300, SCROLL_PX = 5, DRAG_PX = 4;
    let md = null, timer = null, block = false;
    const btnAt = (e) => document.elementFromPoint(e.clientX, e.clientY)?.closest("#folder-row button[data-id]");
    const clearDrop = () => folderEl.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));

    folderEl.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || e.sourceCapabilities?.firesTouchEvents || e.target.closest(".rename-input")) return;
        const btn = e.target.closest("button[data-id]");
        md = {
            x: e.clientX, y: e.clientY, left: folderEl.scrollLeft, armed: false, mode: null, btn,
            canDnD: !!btn && settings.folderSort === "custom" && mode().editable,
        };
        clearTimeout(timer);
        timer = setTimeout(() => { if (md && !md.mode) md.armed = true; }, HOLD_MS);
    });

    document.addEventListener("mousemove", (e) => {
        if (!md) return;
        if (!(e.buttons & 1)) { end(e, false); return; }
        const dx = e.clientX - md.x;
        if (!md.mode) {
            if (md.armed && md.canDnD) {
                if (Math.hypot(dx, e.clientY - md.y) < DRAG_PX) return;
                md.mode = "drag";
                const id = md.btn.dataset.id;
                const ids = selectedFolders.has(id) ? [...selectedFolders] : [id];
                drag = { type: "folder", folderIds: ids };
                ids.forEach((i) => folderEl.querySelector(`button[data-id="${i}"]`)?.classList.add("dragging"));
            } else {
                if (Math.abs(dx) < SCROLL_PX) return;
                md.mode = "scroll";
                clearTimeout(timer);
            }
        }
        if (md.mode === "drag") {
            clearDrop();
            edgeScroll(folderEl, e, "x");
            const t = btnAt(e);
            if (t && !drag.folderIds.includes(t.dataset.id)) t.classList.add("drop-target");
        } else {
            folderEl.scrollLeft = md.left - dx;
        }
    });

    function end(e, drop) {
        if (!md) return;
        clearTimeout(timer);
        const m = md;
        md = null;
        if (m.mode === "drag" && drag?.type === "folder") {
            const t = drop ? btnAt(e) : null;
            const ids = drag.folderIds;
            endDrag();
            if (t && !ids.includes(t.dataset.id)) {
                reorderFolders(ids, t.dataset.id);
                renderFolders();
                renderLists();
            }
        }
        if (m.mode) { block = true; setTimeout(() => (block = false), 50); }   // cegah klik setelah geser
    }
    document.addEventListener("mouseup", (e) => end(e, true));
    window.addEventListener("blur", (e) => end(e, false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && md?.mode === "drag") end(e, false); });
    folderEl.addEventListener("click", (e) => {
        if (block) { e.stopPropagation(); e.preventDefault(); }
    }, true);
})();

// drag bawaan (kartu shortcut) di atas folder: tidak boleh dilepas di sini, hanya memindahkan halaman
folderEl.addEventListener("dragover", (e) => {
    if (drag?.type !== "item") return;
    edgeScroll(folderEl, e, "x");
    hoverFolder(folderBtn(e));
    if (folderBtn(e) && mode().editable) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }   // BARU
});
folderEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const btn = folderBtn(e);
    const d = drag;
    endDrag();
    if (!btn || d?.type !== "item" || !mode().editable) return;
    dropItemsOnList(d, folderLanding(btn.dataset.id));
});
folderEl.addEventListener("dragleave", (e) => {
    if (!folderEl.contains(e.relatedTarget)) { hoverFolder(null); stopAutoScroll(); }
});

/* ---------- kartu shortcut ---------- */
const cardOf = (e) => e.target.closest?.(".shortcut-box:not(.reco)");

// Kartu dengan note terbuka mengambil 2 baris grid, naik jadi 3 kalau note belum muat.
function fitNote(card) {
    card.style.gridRow = "";
    if (settings.cardHeight === "even") return;   // mode rapi: tinggi diatur CSS, tanpa span baris
    const note = card.querySelector(".shortcut-note");
    if (!note || !card.classList.contains("note-open") || card.classList.contains("has-tag")) return;
    for (const n of [2, 3]) {
        card.style.gridRow = `span ${n}`;
        if (note.scrollHeight <= note.clientHeight + 1) break;
    }
}

let openTimer = null;
gridEl.addEventListener("click", (e) => {
    const ra = e.target.closest(".reco a.stretch");   // klik kartu di panel kanan Home: catat saja, link terbuka biasa
    if (ra) {
        const c = ra.closest(".shortcut-box");
        trackOpen(c.dataset.list, c.dataset.id);
        return;
    }
    const card = cardOf(e);
    if (e.target.closest(".note-toggle")) {
        if (card) {
            card.classList.toggle("note-open");
            fitNote(card);
            equalizeLater();
        }
        return;
    }
    if (!card) {
        if (selectedShortcuts.size > 0) clearSelection();
        return;
    }
    if (e.target.closest(".list-tag")) { goToList(card.dataset.list, card.dataset.id); return; }
    // Layar sentuh: selama ada yang terpilih, ketuk kartu = pilih/lepas (bukan buka link)
    if (coarse.matches && selectedShortcuts.size > 0) {
        e.preventDefault();
        toggleShortcutSelection(card.dataset.id);
        return;
    }
    // Klik 1x = buka link (ditunda sebentar), klik 2x = salin link
    if (!e.target.closest("a.stretch")) return;
    const listId = card.dataset.list, itemId = card.dataset.id;
    if (e.ctrlKey || e.metaKey || e.shiftKey) { trackOpen(listId, itemId); return; }
    e.preventDefault();
    clearTimeout(openTimer);
    const item = findItem(listId, itemId);
    if (!item) return;
    if (e.detail > 1) {
        copyText(item.url).then((ok) => flashCopied(card, ok));
    } else {
        openTimer = setTimeout(() => {
            trackOpen(listId, itemId);
            if (settings.openIn === "new") window.open(withAccount(item.url), "_blank", "noopener,noreferrer");
            else window.location.href = withAccount(item.url);
        }, 250);
    }
});

gridEl.addEventListener("contextmenu", (e) => {
    // panel kanan Home: klik kanan = buka list asalnya + pilih shortcut-nya
    const side = e.target.closest?.(".shortcut-box.reco");
    if (side) {
        e.preventDefault();
        if (mode().editable && side.dataset.list !== "reco") goToList(side.dataset.list, side.dataset.id);
        return;
    }

    const card = cardOf(e);
    if (!card || !mode().editable) return;   // mode search: tanpa seleksi/edit
    e.preventDefault();
    if (editing) return;                     // sedang edit: klik kanan tidak mengubah seleksi

    const now = Date.now();
    const itemId = card.dataset.id;

    if (lastRightClick.id === itemId && lastRightClick.type === "shortcut" && now - lastRightClick.time < 400) {
        enterEditMode(findItem(currentId, itemId), currentId);
        lastRightClick.id = null;
    } else {
        toggleShortcutSelection(itemId);
        lastRightClick = { id: itemId, time: now, type: "shortcut" };
    }
});

/* ---------- drag & drop (DIPERBARUI UNTUK MASSAL) ---------- */
function endDrag() {
    document.querySelectorAll(".dragging, .dragover, .drop-target")
        .forEach((el) => el.classList.remove("dragging", "dragover", "drop-target"));
    drag = null;
    stopAutoScroll();
    cancelHoverFolder();
}

const folderHover = { id: null, timer: null };
function hoverFolder(btn) {
    const id = btn?.dataset.id || null;
    if (id === folderHover.id) return;
    clearTimeout(folderHover.timer);
    folderEl.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
    folderHover.id = id;
    if (!id) return;
    if (id !== (viewFolderId || currentFolderId)) btn.classList.add("drop-target");
    folderHover.timer = setTimeout(() => {   // tahan 0,6 detik di atas folder = pindah halaman
        if (!drag) return;
        viewFolderId = id === currentFolderId ? null : id;
        renderFolders();
        renderLists();
        listEl.scrollLeft = 0;
    }, 600);
}
function cancelHoverFolder() {   // drag selesai/batal: kembali ke folder semula
    clearTimeout(folderHover.timer);
    folderHover.id = null;
    folderEl.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
    if (viewFolderId) { viewFolderId = null; renderFolders(); renderLists(); }
}
// setelah drop sukses: kalau pindah folder, ikut berpindah ke list tujuan
function afterDrop(vf, landId) {
    if (vf && vf !== currentFolderId && landId) setCurrent(landId);
    renderFolders();
    renderLists();
    renderShortcuts();
}

// target jatuh di sebuah folder: sub folder terakhir dibuka, atau yang pertama, atau buat baru
function folderLanding(fid) {
    const subs = getOrderedLists(fid).filter((l) => !l.isDefault);
    const last = subs.find((l) => l.id === lastLists[fid]);
    return (last || subs[0] || addList(uniqueName("New List", fid), fid))?.id || null;
}
// pindahkan shortcut yang diseret ke list tujuan, lalu tetap di list asal
function dropItemsOnList(d, toId) {
    if (!toId || toId === d.listId) return;
    let dup = 0;
    d.itemIds.forEach((id) => {
        const res = moveShortcut(d.listId, id, toId);
        if (res === "duplicate") dup++;
        else if (res) selectedShortcuts.delete(id);
    });
    if (dup) alert(`${dup} shortcut dilewati karena URL sama sudah ada di list tujuan.`);
    renderFolders(); renderLists(); renderShortcuts();
}

// tujuan jatuh sebuah list: list lain, atau bagian kosong/Home/+ di baris list (= akhir folder)
function listDropTarget(over) {
    if (!over?.closest(".List")) return null;
    const b = over.closest("button[data-id]");
    if (b && !findList(b.dataset.id)?.isDefault) return { id: b.dataset.id };
    return { id: null };
}

document.addEventListener("dragend", endDrag, true);

const auto = { el: null, dx: 0, dy: 0, raf: null };
function autoTick() {
    if (!drag || (!auto.dx && !auto.dy)) { auto.raf = null; return; }
    auto.el.scrollLeft += auto.dx;
    auto.el.scrollTop += auto.dy;
    auto.raf = requestAnimationFrame(autoTick);
}
function stopAutoScroll() {
    auto.dx = auto.dy = 0;
    if (auto.raf) cancelAnimationFrame(auto.raf);
    auto.raf = null;
}
function edgeScroll(el, e, axis) {
    const r = el.getBoundingClientRect();
    const [pos, lo, hi] = axis === "x" ? [e.clientX, r.left, r.right] : [e.clientY, r.top, r.bottom];
    const d = pos < lo + 40 ? -14 : pos > hi - 40 ? 14 : 0;
    auto.el = el;
    auto.dx = axis === "x" ? d : 0;
    auto.dy = axis === "y" ? d : 0;
    if (d && !auto.raf) auto.raf = requestAnimationFrame(autoTick);
}

// --- Jatuhkan shortcut ke list (drag bawaan browser, hanya untuk kartu shortcut) ---
// Urutan list TIDAK memakai drag bawaan: digeser dengan mouse/sentuh buatan sendiri
// supaya tidak bentrok dengan geser/scroll list.
listEl.addEventListener("dragstart", (e) => e.preventDefault());

listEl.addEventListener("dragover", (e) => {
    if (drag?.type !== "item" || !mode().editable) return;
    edgeScroll(listEl, e, "x");
    const btn = listBtn(e);
    listEl.querySelectorAll(".drop-target").forEach((n) => { if (n !== btn) n.classList.remove("drop-target"); });
    if (!btn || btn.dataset.id === drag.listId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    btn.classList.add("drop-target");
});

listEl.addEventListener("dragleave", (e) => {
    listBtn(e)?.classList.remove("drop-target");
    if (!listEl.contains(e.relatedTarget)) stopAutoScroll();
});

listEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const btn = listBtn(e), d = drag, vf = viewFolderId;
    endDrag();
    if (!btn || d?.type !== "item" || !mode().editable) return;
    dropItemsOnList(d, btn.dataset.id);
    afterDrop(vf, btn.dataset.id);
});

// --- Shortcut Drag ---
// boleh dijatuhkan di kartu ini? pin butuh pinSort = custom, non-pin butuh shortcutSort = custom,
// dan yang diseret harus sejenis (pin dengan pin)
function canDropOn(card, d = drag) {
    const pinned = card.classList.contains("pinned");
    if (pinned ? settings.pinSort !== "custom" : settings.shortcutSort !== "custom") return false;
    return d.itemIds.some((id) => !!findItem(d.listId, id)?.pinned === pinned);
}

// Panel Pin di kanan Home: urutan hanya berubah di dalam panel itu
const pinCardOf = (e) => e.target.closest?.(".shortcut-box.pin-card");
function dropPin(fromIds, toId) {
    const order = panelItems("pin").map((r) => r.item.id);
    const moving = order.filter((id) => fromIds.includes(id));
    const toIdx = order.indexOf(toId);
    if (!moving.length || toIdx === -1 || moving.includes(toId)) return;
    const forward = order.indexOf(moving[0]) < toIdx;
    const rest = order.filter((id) => !moving.includes(id));
    rest.splice(rest.indexOf(toId) + (forward ? 1 : 0), 0, ...moving);
    setPinOrder(rest);
    renderShortcuts();
}

gridEl.addEventListener("dragstart", (e) => {
    const pin = pinCardOf(e);
    if (pin) {
        if (!mode().editable) { e.preventDefault(); return; }
        drag = { type: "pin", itemIds: [pin.dataset.id] };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", pin.dataset.id);
        pin.classList.add("dragging");
        return;
    }

    const card = cardOf(e);
    if (!card || !mode().editable) { e.preventDefault(); return; }

    // Jika shortcut yang di-drag sedang terseleksi, drag semua shortcut yang terseleksi
    const itemIds = selectedShortcuts.has(card.dataset.id) ? Array.from(selectedShortcuts) : [card.dataset.id];

    drag = { type: "item", listId: currentId, itemIds };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.dataset.id);

    itemIds.forEach(id => {
        const el = gridEl.querySelector(`.shortcut-box[data-id="${id}"]:not(.reco)`);
        if (el) el.classList.add("dragging");
    });
});

gridEl.addEventListener("dragover", (e) => {
    if (drag?.type === "pin") {
        edgeScroll(gridEl, e, "y");
        const pc = pinCardOf(e);
        if (!pc || drag.itemIds.includes(pc.dataset.id)) return;
        e.preventDefault();
        pc.classList.add("dragover");
        return;
    }
    if (drag?.type !== "item") return;
    edgeScroll(gridEl, e, "y");
    const card = cardOf(e);
    if (!card || drag.listId !== currentId || !canDropOn(card)) return;
    e.preventDefault();
    card.classList.add("dragover");
});

gridEl.addEventListener("dragleave", (e) => {
    (cardOf(e) || pinCardOf(e))?.classList.remove("dragover");
    if (!gridEl.contains(e.relatedTarget)) stopAutoScroll();
});

gridEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const pc = pinCardOf(e);
    const card = cardOf(e);
    const d = drag;
    endDrag();
    if (d?.type === "pin") {
        if (pc) dropPin(d.itemIds, pc.dataset.id);
        return;
    }
    if (!card || d?.type !== "item" || d.listId !== currentId || !canDropOn(card, d)) return;

    const targetId = card.dataset.id;
    if (d.itemIds.includes(targetId)) return; // Jangan drop di diri sendiri

    reorderShortcuts(currentId, d.itemIds, targetId);
    renderShortcuts();
});

/* ---------- import / settings (selalu tampil di bar atas) ---------- */
moreImportBtn.addEventListener("click", () => importInput.click());
importInput.addEventListener("change", async () => {
    const file = importInput.files[0];
    importInput.value = "";
    if (!file) return;
    try {
        const text = await file.text();
        const isHtml = /\.html?$/i.test(file.name) || /^\s*<(!doctype|html|dl)/i.test(text);
        let data = isHtml ? parseBookmarksHtml(text) : JSON.parse(text);
        if (data?.app === "simpen.link" && data.lists) data = data.lists;   // file backup penuh: ambil bagian list-nya
        const res = importLists(data);
        if (!res) { alert(isHtml ? "Tidak ada bookmark di file ini." : "File tidak valid."); return; }
        const total = Object.values(data).reduce((n, a) => n + a.length, 0) - res.skipped;
        renderLists();
        renderShortcuts();
        alert(`${total} link dari ${res.count} list diimpor.` + (res.skipped ? ` ${res.skipped} dilewati (URL tidak valid).` : ""));
    } catch {
        alert("File tidak valid.");
    }
});
moreSettingsBtn.addEventListener("click", () => { window.location.href = "settings.html"; });
moreInfoBtn.addEventListener("click", () => startSpotlight());

function updateCount() {
    moreCountBtn.textContent = findList(currentId).items.length;
}
moreCountBtn.addEventListener("click", () => {
    if (!mode().editable) return;   // mode search: tanpa seleksi
    selectedLists.clear();
    selectedFolders.clear();
    findList(currentId).items.forEach((i) => selectedShortcuts.add(i.id));
    updateSelectionUI();            // bar otomatis pindah ke grup seleksi
});

/* ---------- sinkron dengan tab lain / halaman Settings ---------- */
function syncFromStorage() {
    reloadState();
    applyGridPrefs();
    mountAccountPicker();
    selectedShortcuts.clear();
    selectedLists.clear();
    selectedFolders.clear();
    renderFolders();
    renderLists();
    renderShortcuts();
}
window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === DATA_KEY || e.key === FOLDER_KEY || e.key === SETTINGS_KEY || e.key === SL_ACC_LIST || e.key === SL_ACC_ACTIVE) syncFromStorage();
});
// halaman dipulihkan dari cache tombol Back: skrip tidak jalan ulang, jadi muat ulang data
window.addEventListener("pageshow", (e) => { if (e.persisted) syncFromStorage(); });

/* ---------- bar indeks A–Z / 0–9 di pinggir kanan ---------- */
const indexBar = h("nav", { class: "az-bar", "aria-label": "Lompat ke huruf" });
indexBar.hidden = true;
document.body.append(indexBar);

const AZ = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"], NUM = [..."0123456789"];
let azFirst = {};

const initialOf = (name) => {
    const c = (name || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
    return /[A-Z0-9]/.test(c) ? c : "";
};

// elemen yang benar-benar bisa di-scroll (grid, atau panel kiri di Home)
function scrollerOf(el) {
    for (let p = el?.parentElement; p; p = p.parentElement) {
        const oy = getComputedStyle(p).overflowY;
        if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight + 1) return p;
    }
    return gridEl;
}
const firstCard = () => gridEl.querySelector(".shortcut-box:not(.reco)");

function jumpTo(card) {
    const sc = scrollerOf(card);
    const top = sc.scrollTop + card.getBoundingClientRect().top - sc.getBoundingClientRect().top;
    sc.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
}

function renderIndex() {
    const cards = [...gridEl.querySelectorAll(".shortcut-box:not(.reco)")];
    const custom = settings.shortcutSort === "custom";
    const show = mode().id !== "search" && cards.length > 0;
    document.body.classList.toggle("has-az", show);
    indexBar.hidden = !show;
    indexBar.classList.toggle("az-mini", custom);
    azFirst = {};
    if (!show) { indexBar.replaceChildren(); return; }

    const btn = (label, key, aria, on = true) =>
        h("button", { type: "button", class: "az-btn", "data-k": key, "aria-label": aria, text: label, ...(on ? {} : { disabled: "" }) });

    if (custom) {   // urutan custom: hanya tombol ke paling atas / paling bawah
        indexBar.replaceChildren(btn("▲", "__top", "Ke atas"), btn("▼", "__bottom", "Ke bawah"));
        return;
    }

    for (const c of cards) {
        const k = initialOf(c.querySelector(".shortcut-name")?.textContent);
        if (k && !azFirst[k]) azFirst[k] = c;
    }
    const keys = settings.shortcutSort === "za"
        ? [...AZ].reverse().concat([...NUM].reverse())
        : AZ.concat(NUM);
    indexBar.replaceChildren(
        btn("▲", "__top", "Ke atas"),
        ...keys.map((k) => btn(k, k, k, !!azFirst[k])),
        btn("▼", "__bottom", "Ke bawah"));
}

indexBar.addEventListener("click", (e) => {
    const k = e.target.closest("button[data-k]")?.dataset.k;
    if (!k) return;
    if (k === "__top" || k === "__bottom") {
        const sc = scrollerOf(firstCard());
        sc.scrollTo({ top: k === "__top" ? 0 : sc.scrollHeight, behavior: "smooth" });
    } else if (azFirst[k]?.isConnected) jumpTo(azFirst[k]);
});

/* ---------- mulai ---------- */
function applyGridPrefs() {
    gridEl.dataset.cols = settings.gridCols;
    gridEl.dataset.fit = settings.cardHeight;
    equalizeLater();
}

applyGridPrefs();
navigator.storage?.persist?.();
mountAccountPicker();
setMode(0);

/* ---------- lebar list menyesuaikan: geser per tombol, tidak ada yang terpotong ---------- */
(() => {
    let timer = null, touching = false, lastActive = null, lastSet = -1;

    function fitList() {
        if (touching || drag) return;
        const btns = [...listEl.querySelectorAll("button")];
        const isAdd = (b) => b.classList.contains("add-btn");
        const W = listEl.clientWidth;
        const n = btns.length;
        if (!n || !W) return;

        // 1) ukur ukuran asli (tanpa regangan)
        btns.forEach((b) => {
            b.style.paddingLeft = b.style.paddingRight = b.style.minWidth = b.style.transform = "";
            b.style.visibility = "visible";
        });
        const box = listEl.getBoundingClientRect();
        const base = listEl.scrollLeft - box.left;
        const rects = btns.map((b) => b.getBoundingClientRect());
        const L = rects.map((r) => r.left + base);
        const R = rects.map((r) => r.right + base);
        listEl.dataset.max = Math.max(0, R[n - 1] - W);

        // 2) tombol pertama yang tampil: yang paling dekat posisi scroll sekarang
        let maxStart = n - 1;   // paling kanan yang masih membuat sisa tombol muat semua
        while (maxStart > 0 && R[n - 1] - L[maxStart - 1] <= W + 1) maxStart--;
        // titik snap: awal tiap tombol, kecuali maxStart = ujung kanan sebenarnya.
        // Dulu ujung kanan dibulatkan ke tombol sebelumnya, jadi list terakhir terpotong & sulit dicapai.
        const maxScroll = Math.max(0, R[n - 1] - W);
        const cur = listEl.scrollLeft;
        let s = 0, bestDist = Infinity;
        for (let i = 0; i <= maxStart; i++) {
            const dist = Math.abs((i === maxStart ? maxScroll : L[i]) - cur);
            if (dist < bestDist) { bestDist = dist; s = i; }
        }

        // 3) list aktif berganti: pastikan terlihat dengan geseran sesedikit mungkin
        const ai = btns.findIndex((b) => b.classList.contains("aktif"));
        if (ai >= 0 && btns[ai].dataset.id !== lastActive) {
            lastActive = btns[ai].dataset.id;
            if (ai < s) s = ai;
            else if (R[ai] - L[s] > W + 1) {
                s = ai;
                while (s > 0 && R[ai] - L[s - 1] <= W + 1) s--;
            }
        }
        s = Math.min(s, maxStart);

        // 4) tombol yang tampil: dari s sampai end (semua yang muat utuh)
        let end = s;
        while (end + 1 < n && R[end + 1] - L[s] <= W + 1) end++;
        const count = Math.max(1, end - s + 1 - (isAdd(btns[end]) ? 1 : 0));
        const add = Math.max(0, (W - (R[end] - L[s])) / count);   // sisa ruang dibagi rata
        const pad = parseFloat(getComputedStyle(btns[s]).paddingLeft) || 0;

        btns.forEach((b, i) => {
            const on = i >= s && i <= end;
            b.style.visibility = on || b === document.activeElement ? "visible" : "hidden";
            if (!on || add < 0.5 || isAdd(b)) return;
            if (b.classList.contains("aktif")) b.style.minWidth = R[i] - L[i] + add + "px";
            else {
                b.style.paddingLeft = pad + add / 2 + "px";
                b.style.paddingRight = pad + add / 2 + "px";
            }
        });

        // 5) geser SETELAH diregangkan, supaya area scroll sudah cukup panjang
        listEl.scrollLeft = L[s];
        lastSet = listEl.scrollLeft;   // untuk mengenali event scroll buatan sendiri
    }

    const later = (ms) => { clearTimeout(timer); timer = setTimeout(fitList, ms); };

    listEl.addEventListener("scroll", () => {
        if (Math.abs(listEl.scrollLeft - lastSet) < 1) return;   // scroll dari fitList sendiri: abaikan
        listEl.querySelectorAll("button").forEach((b) => (b.style.visibility = "visible"));
        if (!touching && !drag) later(120);
    });
    listEl.addEventListener("touchstart", () => { touching = true; clearTimeout(timer); }, { passive: true });
    const endTouch = () => { touching = false; later(150); };
    listEl.addEventListener("touchend", endTouch);
    listEl.addEventListener("touchcancel", endTouch);

    /* geser kategori pakai mouse: SATU alur untuk geser & pindah urutan
       - langsung geser            = scroll list
       - tahan 300 ms lalu geser   = drag & drop urutan list (hanya list yang boleh dipindah)
       - Esc / lepas di luar       = batal */
    const HOLD_MS = 300, SCROLL_PX = 5, DRAG_PX = 4;
    let md = null, mdTimer = null, blockClick = false, locked = false;
    const saved = { snap: "", behavior: "" };

    // selama menggeser: matikan snap/smooth-scroll CSS & seleksi teks supaya tidak "melawan" mouse
    function lockScroll(on) {
        if (on === locked) return;
        locked = on;
        if (on) {
            saved.snap = listEl.style.scrollSnapType;
            saved.behavior = listEl.style.scrollBehavior;
            listEl.style.scrollSnapType = "none";
            listEl.style.scrollBehavior = "auto";
            listEl.style.userSelect = "none";
        } else {
            listEl.style.scrollSnapType = saved.snap;
            listEl.style.scrollBehavior = saved.behavior;
            listEl.style.userSelect = "";
        }
    }
    const suppressClick = () => {   // cegah klik (ganti list) setelah geser / drop
        blockClick = true;
        setTimeout(() => (blockClick = false), 50);
    };

    listEl.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || e.sourceCapabilities?.firesTouchEvents || e.target.closest(".rename-input")) return;
        const btn = e.target.closest("button[data-id]");
        const list = btn && findList(btn.dataset.id);
        const canDnD = !!list && !list.isDefault && mode().editable;
        md = { x: e.clientX, y: e.clientY, left: listEl.scrollLeft, armed: false, mode: null, canDnD, btn };
        touching = true;             // tahan fitList selama mouse ditekan
        clearTimeout(timer);
        listEl.querySelectorAll("button").forEach((b) => (b.style.visibility = "visible"));
        clearTimeout(mdTimer);
        mdTimer = setTimeout(() => { if (md && !md.mode) md.armed = true; }, HOLD_MS);
    });

    const dropTarget = (e) => {
        if (drag?.type !== "list") return null;
        const t = listDropTarget(document.elementFromPoint(e.clientX, e.clientY));
        return t && !drag.listIds.includes(t.id) ? t : null;
    };
    function moveListDrag(e) {
        listEl.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
        edgeScroll(listEl, e, "x");
        hoverFolder(document.elementFromPoint(e.clientX, e.clientY)?.closest("#folder-row button[data-id]"));
        const t = dropTarget(e);
        if (t?.id) listEl.querySelector(`button[data-id="${t.id}"]`)?.classList.add("drop-target");
    }

    function startListDrag() {
        const id = md.btn.dataset.id;
        const ids = selectedLists.has(id) ? [...selectedLists].filter((i) => !findList(i)?.isDefault) : [id];
        drag = { type: "list", listIds: ids };
        ids.forEach((i) => listEl.querySelector(`button[data-id="${i}"]`)?.classList.add("dragging"));
    }

    document.addEventListener("mousemove", (e) => {
        if (!md) return;
        if (!(e.buttons & 1)) { endMouse({ type: "cancel" }); return; }   // tombol dilepas di luar jendela
        const dx = e.clientX - md.x;
        if (!md.mode) {
            if (md.armed && md.canDnD) {
                if (Math.hypot(dx, e.clientY - md.y) < DRAG_PX) return;
                md.mode = "drag";
                startListDrag();
            } else {
                if (Math.abs(dx) < SCROLL_PX) return;
                md.mode = "scroll";
                clearTimeout(mdTimer);
            }
            listEl.classList.add("grabbing");
            lockScroll(true);
        }
        if (md.mode === "drag") moveListDrag(e);
        else listEl.scrollLeft = md.left - dx;
    });

    function endMouse(e) {
        if (!md) return;
        clearTimeout(mdTimer);
        const m = md;
        md = null;
        touching = false;
        listEl.classList.remove("grabbing");
        lockScroll(false);
        if (m.mode === "drag" && drag?.type === "list") {
            const target = e.type === "mouseup" ? dropTarget(e) : null;   // batal = tidak ada drop
            const ids = drag.listIds, vf = viewFolderId;
            endDrag();
            suppressClick();
            if (target) {
                reorderLists(ids, target.id, vf || currentFolderId);
                afterDrop(vf, ids[0]);
            }
        } else if (m.mode) {
            suppressClick();
        }
        later(150);                  // rapikan posisi ke tombol terdekat (ujung kanan ikut dihitung)
    }
    document.addEventListener("mouseup", endMouse);
    window.addEventListener("blur", () => endMouse({ type: "cancel" }));
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && md?.mode === "drag") endMouse({ type: "cancel" });
    });
    listEl.addEventListener("click", (e) => {
        if (blockClick) { e.stopPropagation(); e.preventDefault(); }
    }, true);

    window.addEventListener("resize", fitList);
    window.addEventListener("load", fitList);
    document.fonts?.ready.then(fitList);
    new MutationObserver(fitList).observe(listEl, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
    });
    fitList();
})();

/* ---------- sentuh (HP) ----------
   Tahan 400 ms:
   - lepas tanpa geser  -> pilih / lepas pilihan (pengganti klik kanan)
   - tahan lalu geser   -> drag (urutkan atau pindah list)
   - tidak bisa di-drag (mode search, list Favorite, urutan bukan custom) -> langsung pilih
   Geser sebelum 400 ms = scroll / swipe biasa. */
(() => {
    const HOLD = 400, MOVE = 10;
    let timer = null, startPt = null, pending = null;
    let held = false, moved = false, touching = false, suppressUntil = 0;

    const SEL_FOLDER = "#folder-row button[data-id]";
    const SEL_LIST = ".List button[data-id]";
    const at = (t) => document.elementFromPoint(t.clientX, t.clientY);
    const okList = (btn) => drag.type === "pin" ? false
        : drag.type === "list"
            ? !drag.listIds.includes(btn.dataset.id) && !findList(btn.dataset.id).isDefault
            : btn.dataset.id !== drag.listId;
    const okCard = (card) => canDropOn(card) && !drag.itemIds.includes(card.dataset.id);

    function canDrag(kind, id) {
    if (!mode().editable) return false;
    if (kind === "folder") return settings.folderSort === "custom"; 
    if (kind === "pin") return settings.pinSort === "custom";
    if (kind === "list") { const list = findList(id); return !!list && !list.isDefault; }
    return true;
}
    function toggle(kind, id) {
        if (kind === "pin") return;
        if (kind === "folder") toggleFolderSelection(id);
        else if (kind === "list") toggleListSelection(id);
        else toggleShortcutSelection(id);
        navigator.vibrate?.(30);
    }

    function onHold() {
        timer = null;
        if (!pending) return;
        held = true;
        const { kind, el } = pending, id = el.dataset.id;
        if (!canDrag(kind, id)) { toggle(kind, id); return; }
        if (kind === "list") {
            const ids = selectedLists.has(id) ? [...selectedLists].filter((i) => !findList(i).isDefault) : [id];
            drag = { type: "list", listIds: ids };
            ids.forEach((i) => listEl.querySelector(`button[data-id="${i}"]`)?.classList.add("dragging"));
        } else if (kind === "pin") {
            drag = { type: "pin", itemIds: [id] };
            el.classList.add("dragging");
        } else if (kind === "folder") {
            const ids = selectedFolders.has(id) ? [...selectedFolders] : [id];
            drag = { type: "folder", folderIds: ids };
            ids.forEach((i) => folderEl.querySelector(`button[data-id="${i}"]`)?.classList.add("dragging"));
        } else {
            const ids = selectedShortcuts.has(id) ? [...selectedShortcuts] : [id];
            drag = { type: "item", listId: currentId, itemIds: ids };
            ids.forEach((i) => gridEl.querySelector(`.shortcut-box[data-id="${i}"]:not(.reco)`)?.classList.add("dragging"));
    }
    navigator.vibrate?.(30);
    }

    document.addEventListener("touchstart", (e) => {
        touching = true;
        held = false;
        moved = false;
        const el = e.target.closest?.(`${SEL_LIST}, ${SEL_FOLDER}, .shortcut-box:not(.reco), .pin-card`);
        if (e.touches.length !== 1 || !el || !mode().editable || e.target.closest(".note-toggle, .rename-input, .list-tag")) return;
        startPt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        pending = { kind: el.matches(".pin-card") ? "pin" : el.matches(".shortcut-box") ? "item" : el.matches(SEL_FOLDER) ? "folder" : "list", el };
        timer = setTimeout(onHold, HOLD);
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
        const t = e.touches[0];
        if (!held) {
            if (timer && Math.hypot(t.clientX - startPt.x, t.clientY - startPt.y) > MOVE) {
                clearTimeout(timer);
                timer = null;
                pending = null;
            }
            return;
        }
        if (!drag) return;
        if (!moved && Math.hypot(t.clientX - startPt.x, t.clientY - startPt.y) > MOVE) moved = true;
        if (e.cancelable) e.preventDefault();
        document.querySelectorAll(".dragover, .drop-target").forEach((n) => n.classList.remove("dragover", "drop-target"));
        const over = at(t);
        if (drag.type === "pin") {
            const pc = over?.closest(".pin-card");
            if (pc && !drag.itemIds.includes(pc.dataset.id)) pc.classList.add("dragover");
            edgeScroll(gridEl, t, "y");
            return;
        }
        if (drag.type === "folder") {
            const btn = over?.closest(SEL_FOLDER);
            if (btn && !drag.folderIds.includes(btn.dataset.id)) btn.classList.add("drop-target");
            edgeScroll(folderEl, t, "x");
            return;
        }
        hoverFolder(over?.closest(SEL_FOLDER));
        const btn = over?.closest(SEL_LIST);
        const card = over?.closest(".shortcut-box");
        if (btn && okList(btn)) btn.classList.add("drop-target");
        else if (!btn && card && drag.type === "item" && okCard(card)) card.classList.add("dragover");
        if (over?.closest(".List")) edgeScroll(listEl, t, "x");
        else if (drag.type === "item") edgeScroll(gridEl, t, "y");
        else stopAutoScroll();
    }, { passive: false });

    function finish(e, drop) {
        clearTimeout(timer);
        timer = null;
        touching = false;
        const wasHeld = held, d = drag, p = pending, wasMoved = moved;
        held = false;
        pending = null;
        if (!wasHeld) return;
        suppressUntil = Date.now() + 600;       // cegah menu tahan-lama yang telat muncul
        if (e.cancelable) e.preventDefault();   // cegah klik (buka link) setelah tahan/drag
        const t = e.changedTouches?.[0];
        const over = drop && t && wasMoved ? at(t) : null;
        const vf = viewFolderId;
        endDrag();
        if (!d) return;                         // sudah dipilih saat tahan
        if (!wasMoved) {                        // tahan lalu lepas: pilih / lepas pilihan
            if (drop && p) toggle(p.kind, p.el.dataset.id);
            return;
        }
        if (!over) return;
        if (d.type === "folder") {
            const tg = over.closest(SEL_FOLDER);
            if (!tg || d.folderIds.includes(tg.dataset.id)) return;
            reorderFolders(d.folderIds, tg.dataset.id);
            renderFolders();
            renderLists();
            return;
        }
        if (d.type === "pin") {
            const pc = over.closest(".pin-card");
            if (pc) dropPin(d.itemIds, pc.dataset.id);
            return;
        }
        const btn = over.closest(SEL_LIST);
        const card = over.closest(".shortcut-box");

        if (d.type === "list") {
            const tg = listDropTarget(over);
            if (!tg || d.listIds.includes(tg.id)) return;
            reorderLists(d.listIds, tg.id, vf || currentFolderId);
            afterDrop(vf, d.listIds[0]);
        } else if (btn) {
            if (btn.dataset.id === d.listId) return;
            let dup = 0;
            d.itemIds.forEach((id) => {
                const res = moveShortcut(d.listId, id, btn.dataset.id);
                if (res === "duplicate") dup++;
                else if (res) selectedShortcuts.delete(id);
            });
            if (dup) alert(`${dup} shortcut dilewati karena URL sama sudah ada di list tujuan.`);
            afterDrop(vf, btn.dataset.id);
        } else if (over.closest(SEL_FOLDER) && d.type === "item") {   // BARU: jatuh langsung di folder
            dropItemsOnList(d, folderLanding(over.closest(SEL_FOLDER).dataset.id));
        } else if (card && canDropOn(card, d) && !d.itemIds.includes(card.dataset.id)) {
            reorderShortcuts(d.listId, d.itemIds, card.dataset.id);
            renderShortcuts();
        }
    }
    document.addEventListener("touchend", (e) => finish(e, true));
    document.addEventListener("touchcancel", (e) => finish(e, false));

    // Cegah drag bawaan browser & menu tahan-lama bentrok dengan gestur sentuh di atas
    document.addEventListener("dragstart", (e) => {
        if (touching) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    document.addEventListener("contextmenu", (e) => {
        if (held || Date.now() < suppressUntil) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
})();

/* ---------- ketik / Enter / paste di mana saja langsung ke textbox ---------- */
(() => {
    const typing = (el) => !!el && (el.matches?.("input, textarea, select, [contenteditable]") || el.isContentEditable);
    const touring = () => typeof tour !== "undefined" && tour;   // sedang spotlight

    document.addEventListener("keydown", (e) => {
        if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
        const a = document.activeElement;
        if (typing(a) || touring()) return;   // termasuk saat rename list (itu input)
        const byKeyboard = a !== document.body && a.matches(":focus-visible");   // fokus hasil Tab: biarkan
        if (e.key === "Enter") {
            if (byKeyboard) return;
            e.preventDefault();
            textbox.focus();
            submitOrNextMode();
        } else if (e.key.length === 1 && !(e.key === " " && byKeyboard)) {
            textbox.focus();   // huruf pertama ikut terketik di textbox
        }
    });

    document.addEventListener("paste", (e) => {
        if (typing(document.activeElement) || touring()) return;
        const t = (e.clipboardData?.getData("text") || "").replace(/[\r\n]+/g, " ");
        if (!t.trim()) return;
        e.preventDefault();
        textbox.focus();
        textbox.setRangeText(t, textbox.selectionStart, textbox.selectionEnd, "end");
        refreshUI();
    });
})();

/* ---------- Ctrl+A: blok semua folder / list / shortcut yang sedang dipilih ---------- */
document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "a" || !mode().editable) return;
    const a = document.activeElement;
    if (a?.matches?.("input, textarea, select") && !(a === textbox && !textbox.value)) return;
    if (selectedFolders.size) folders.forEach((f) => selectedFolders.add(f.id));
    else if (selectedLists.size) getOrderedLists(viewFolderId || currentFolderId).forEach((l) => selectedLists.add(l.id));
    else if (selectedShortcuts.size) findList(currentId).items.forEach((i) => selectedShortcuts.add(i.id));
    else return;
    e.preventDefault();
    updateSelectionUI();
});