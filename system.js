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
const bulkDeleteBtn = document.querySelector("#bulk-delete");
const bulkExportBtn = document.querySelector("#bulk-export");
const bulkCancelBtn = document.querySelector("#bulk-cancel");
const moreImportBtn = document.querySelector("#more-import");
const moreSettingsBtn = document.querySelector("#more-settings");
const moreInfoBtn = document.querySelector("#more-info");
const showBar = (el, on) => el.classList.toggle("bar-hide", !on);
const barLV = document.querySelector("#bar-lv");

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
    {
        id: "list", icon: "Image/list.svg", hint: "Add List... ", editable: true,
        run(v) {
            if (!addList(v)) { alert("List dengan nama itu sudah ada."); return false; }
            renderLists();
            return true;
        },
    },
    { id: "search", icon: "Image/search.svg", hint: "Search Shortcuts... ", editable: false, run: () => false },
];

const mode = () => modes[modeIndex];

function setMode(n) {
    modeIndex = n;
    editing = null;
    clearSelection();
    const m = mode();
    icon.src = m.icon;
    textbox.placeholder = m.hint;
    wrapper.className = `textbox-wrapper mode-${m.id}`;
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
    if (textbox.value.trim()) {
        if (mode().id === "search") {   // hasil sudah tampil saat mengetik: Enter = pindah mode
            textbox.value = "";
            setMode((modeIndex + 1) % modes.length);
            flashMode();
            return;
        }
        if (mode().run(textbox.value.trim())) {
            textbox.value = "";
            refreshUI();
        }
        return;
    }
    setMode(editing ? 0 : (modeIndex + 1) % modes.length);
    flashMode();
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
        } else if (selectedShortcuts.size > 0 || selectedLists.size > 0) {
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
    updateSelectionUI();
}

function updateSelectionUI() {
    const hasShortcuts = selectedShortcuts.size > 0;
    const hasLists = selectedLists.size > 0;
    const hasAny = hasShortcuts || hasLists;

    showBar(bulkCount, hasAny);
    showBar(bulkCancelBtn, hasAny);
    showBar(barLV, hasAny); 
    showBar(moreInfoBtn, !hasAny);
    bulkCount.textContent = `${selectedShortcuts.size + selectedLists.size} selects`;
    
    // list default (Favorite) tidak bisa dihapus, jadi tombol Delete disembunyikan kalau hanya itu yang dipilih
    const hasDeletable = hasShortcuts || [...selectedLists].some((id) => !findList(id)?.isDefault);
    showBar(bulkDeleteBtn, hasDeletable);
    showBar(bulkExportBtn, hasLists);
    
    // Edit: tepat 1 shortcut (ubah isi) atau tepat 1 list biasa (ganti nama; pengganti dobel-klik di HP)
    const oneShortcut = selectedShortcuts.size === 1 && !hasLists;
    const oneList = selectedLists.size === 1 && !hasShortcuts && mode().editable
        && !findList([...selectedLists][0])?.isDefault;
    showBar(bulkEditBtn, oneShortcut || oneList);

    document.querySelectorAll(".shortcut-box").forEach(card => {
        card.classList.toggle("selected", selectedShortcuts.has(card.dataset.id));
    });
    document.querySelectorAll(".List button").forEach(btn => {
        btn.classList.toggle("selected", selectedLists.has(btn.dataset.id));
    });
}

function toggleShortcutSelection(itemId) {
    selectedLists.clear();   // list dan shortcut tidak boleh terpilih bersamaan
    if (selectedShortcuts.has(itemId)) selectedShortcuts.delete(itemId);
    else selectedShortcuts.add(itemId);
    updateSelectionUI();
}

function toggleListSelection(listId) {
    selectedShortcuts.clear();   // list dan shortcut tidak boleh terpilih bersamaan
    if (selectedLists.has(listId)) selectedLists.delete(listId);
    else selectedLists.add(listId);
    updateSelectionUI();
}

bulkDeleteBtn.addEventListener("click", () => {
    if (selectedShortcuts.size > 0) {
        if (settings.confirmDelete === "on" && !confirm(`Hapus ${selectedShortcuts.size} shortcut?`)) return;
        deleteShortcuts(currentId, [...selectedShortcuts]);
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

bulkExportBtn.addEventListener("click", async () => {
    if (selectedLists.size === 0) return;
    const json = JSON.stringify(exportData([...selectedLists]), null, 2);
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
    listEl.classList.toggle("List-hidden", !!editing || isSearch || (isLink && hasValue));
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
        href: item.url,
        target: settings.openIn === "new" ? "_blank" : "_self",
        rel: "noopener noreferrer",
        draggable: "false",
        "aria-label": item.name,
        title: item.note ? `${item.url}\n\n${item.note}` : item.url,
    });
}

function renderLists() {
    listEl.replaceChildren(...getOrderedLists().map((list) => {
        const btn = h("button", { type: "button", class: list.isDefault ? "favorite" : "", "data-id": list.id });
        if (list.isDefault) btn.append(h("img", { src: "Image/star.svg", alt: "" }), list.name);
        else btn.textContent = list.name;
        btn.draggable = !list.isDefault;
        return btn;
    }));
    updateActive();
    updateSelectionUI();
}

function updateActive() {
    for (const btn of listEl.children) {
        const on = btn.dataset.id === currentId;
        btn.classList.toggle("aktif", on);
        btn.tabIndex = on ? 0 : -1;
    }
}

function makeCard(item, listId, listName = null) {
    const top = h("div", { class: "shortcut-top" },
        h("div", { class: "shortcut-logo-wrap" }, faviconImg(item.url, "shortcut-logo")),
        h("div", { class: "shortcut-name", text: item.name }));

    const hasNote = item.note.trim() !== "";
    if (hasNote) {
        top.append(h("button", { class: "note-toggle", type: "button", "aria-label": "Tampilkan catatan" },
            h("img", { class: "oc-note", src: "Image/open-close-note.svg", alt: "" })));
    }

    // hasil pencarian: nama list di paling atas kartu (klik = buka list itu)
    const tag = listName === null ? [] : [h("button", { class: "list-tag", type: "button", text: listName, title: listName })];
    const card = h("div", { class: `shortcut-box ui-3d${listName === null ? "" : " has-tag"}`, "data-id": item.id, "data-list": listId },
        h("div", { class: "shortcut-main" }, top, h("div", { class: "shortcut-url", text: item.url })),
        ...tag,
        linkOverlay(item));

    if (hasNote) card.insertBefore(h("div", { class: "shortcut-note", text: item.note }), card.lastChild);
    card.draggable = true;
    return card;
}

// skor kecocokan: makin besar makin sesuai (0 = tidak cocok)
function matchScore({ name, url }, q) {
    name = name.toLowerCase();
    if (name === q) return 5;
    if (name.startsWith(q)) return 4;
    if (name.includes(q)) return 3;
    return 0;
}

function renderSearch() {
    const q = textbox.value.trim().toLowerCase();
    if (!q) { gridEl.replaceChildren(); return; }   // belum mengetik: kosong
    const rows = getOrderedLists()
        .flatMap((list) => list.items.map((item) => ({ item, list, s: matchScore(item, q) })))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s);                 // skor sama = urutan lama tetap
    gridEl.replaceChildren(...(rows.length
        ? rows.map(({ item, list }) => makeCard(item, list.id, list.name))
        : [h("div", { class: "shortcuts-empty", text: "Tidak ada yang cocok." })]));
}

function renderShortcuts() {
    if (mode().id === "search") { renderSearch(); updateSelectionUI(); return; }
    const rows = sortItems(findList(currentId).items.map((item) => ({ item })));
    gridEl.replaceChildren(...(rows.length
        ? rows.map(({ item }) => makeCard(item, currentId))
        : [h("div", { class: "shortcuts-empty", text: "Belum ada shortcut." })]));
    updateSelectionUI();
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
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    if (e.target.classList.contains("rename-input")) return;
    const btns = [...listEl.children];
    const next = btns.findIndex((b) => b.dataset.id === currentId) + (e.key === "ArrowRight" ? 1 : -1);
    if (next < 0 || next >= btns.length) return;
    e.preventDefault();
    switchList(btns[next].dataset.id);
    btns[next].style.visibility = "visible";
    btns[next].focus({ preventScroll: true });
});

listEl.addEventListener("wheel", (e) => {
    if (!e.deltaY || e.shiftKey) return;
    const max = Number(listEl.dataset.max) || Infinity;
    listEl.scrollLeft = Math.min(listEl.scrollLeft + e.deltaY, max);
    e.preventDefault();
}, { passive: false });

/* ---------- kartu shortcut ---------- */
const cardOf = (e) => e.target.closest?.(".shortcut-box");

let openTimer = null;
gridEl.addEventListener("click", (e) => {
    const card = cardOf(e);
    if (e.target.closest(".note-toggle")) {
        card?.classList.toggle("note-open");
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
    if (!e.target.closest("a.stretch") || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    clearTimeout(openTimer);
    const item = findItem(card.dataset.list, card.dataset.id);
    if (!item) return;
    if (e.detail > 1) {
        copyText(item.url).then((ok) => flashCopied(card, ok));
    } else {
        openTimer = setTimeout(() => {
            if (settings.openIn === "new") window.open(item.url, "_blank", "noopener,noreferrer");
            else window.location.href = item.url;
        }, 250);
    }
});

gridEl.addEventListener("contextmenu", (e) => {
    const card = cardOf(e);
    if (!card || !mode().editable) return;   // mode search: tanpa seleksi/edit
    e.preventDefault();

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

// --- List Drag ---
listEl.addEventListener("dragstart", (e) => {
    const btn = listBtn(e);
    const list = btn && findList(btn.dataset.id);
    if (!list || list.isDefault || settings.listSort !== "custom" || !mode().editable) {
        e.preventDefault();
        return;
    }
    
    // Jika list yang di-drag sedang terseleksi, drag semua list yang terseleksi
    let listIds = [];
    if (selectedLists.has(list.id)) {
        listIds = Array.from(selectedLists).filter(id => !findList(id).isDefault);
    } else {
        listIds = [list.id];
    }
    
    drag = { type: "list", listIds: listIds };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", list.name);
    
    // Feedback visual untuk semua item yang di-drag
    listIds.forEach(id => {
        const el = listEl.querySelector(`button[data-id="${id}"]`);
        if (el) el.classList.add("dragging");
    });
});

listEl.addEventListener("dragover", (e) => {
    if (!drag || !mode().editable) return;
    edgeScroll(listEl, e, "x");
    const btn = listBtn(e);
    if (!btn) return;
    const id = btn.dataset.id;
    
    // Validasi drop target
    const ok = drag.type === "list" 
        ? (!drag.listIds.includes(id) && !findList(id).isDefault)
        : (id !== drag.listId);
        
    if (!ok) return;
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
    const btn = listBtn(e);
    const d = drag;
    endDrag();
    if (!btn || !d || !mode().editable) return;
    const id = btn.dataset.id;
    
    if (d.type === "list") {
        if (d.listIds.includes(id)) return;
        reorderLists(d.listIds, id);
        renderLists();
    } else {
        // Memindahkan shortcut massal ke list lain
        const targetListId = id;
        let duplicateCount = 0;
        
        const itemsToMove = d.itemIds.map(itemId => findItem(d.listId, itemId)).filter(Boolean);
        
        for (const item of itemsToMove) {
            const res = moveShortcut(d.listId, item.id, targetListId);
            if (res === "duplicate") duplicateCount++;
        }
        
        if (duplicateCount > 0) {
            alert(`${duplicateCount} shortcut dilewati karena URL sama sudah ada di list tujuan.`);
        }
        
        // Hapus dari seleksi karena sudah dipindah
        itemsToMove.forEach(item => selectedShortcuts.delete(item.id));
        updateSelectionUI();
        
        renderShortcuts();
    }
});

// --- Shortcut Drag ---
gridEl.addEventListener("dragstart", (e) => {
    const card = cardOf(e);
    if (!card || !mode().editable) { e.preventDefault(); return; }
    
    // Jika shortcut yang di-drag sedang terseleksi, drag semua shortcut yang terseleksi
    let itemIds = [];
    if (selectedShortcuts.has(card.dataset.id)) {
        itemIds = Array.from(selectedShortcuts);
    } else {
        itemIds = [card.dataset.id];
    }
    
    drag = { type: "item", listId: currentId, itemIds: itemIds };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.dataset.id);
    
    // Feedback visual
    itemIds.forEach(id => {
        const el = gridEl.querySelector(`.shortcut-box[data-id="${id}"]`);
        if (el) el.classList.add("dragging");
    });
});

gridEl.addEventListener("dragover", (e) => {
    if (drag?.type !== "item") return;
    edgeScroll(gridEl, e, "y");
    const card = cardOf(e);
    if (!card || settings.shortcutSort !== "custom" || drag.listId !== currentId) return;
    e.preventDefault();
    card.classList.add("dragover");
});

gridEl.addEventListener("dragleave", (e) => {
    cardOf(e)?.classList.remove("dragover");
    if (!gridEl.contains(e.relatedTarget)) stopAutoScroll();
});

gridEl.addEventListener("drop", (e) => {
    e.preventDefault();
    const card = cardOf(e);
    const d = drag;
    endDrag();
    if (!card || d?.type !== "item" || d.listId !== currentId || settings.shortcutSort !== "custom") return;
    
    const targetId = card.dataset.id;
    if (d.itemIds.includes(targetId)) return; // Jangan drop di diri sendiri
    
    // Gunakan fungsi reorder massal baru
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
        const res = importLists(JSON.parse(await file.text()));
        if (!res) { alert("File tidak valid."); return; }
        renderLists();
        renderShortcuts();
        alert(`${res.count} list diimpor.` + (res.skipped ? ` ${res.skipped} shortcut dilewati (URL tidak valid).` : ""));
    } catch {
        alert("File tidak valid.");
    }
});
moreSettingsBtn.addEventListener("click", () => { window.location.href = "settings.html"; });
moreInfoBtn.addEventListener("click", () => { window.location.href = "settings.html#info"; });

/* ---------- sinkron dengan tab lain / halaman Settings ---------- */
function syncFromStorage() {
    reloadState();
    gridEl.dataset.cols = settings.gridCols;
    selectedShortcuts.clear();
    selectedLists.clear();
    renderLists();
    renderShortcuts();
}
window.addEventListener("storage", (e) => {
    if (e.key === null || e.key === DATA_KEY || e.key === SETTINGS_KEY) syncFromStorage();
});
// halaman dipulihkan dari cache tombol Back: skrip tidak jalan ulang, jadi muat ulang data
window.addEventListener("pageshow", (e) => { if (e.persisted) syncFromStorage(); });

/* ---------- mulai ---------- */
gridEl.dataset.cols = settings.gridCols;
setMode(0);

/* ---------- lebar list menyesuaikan ---------- */
(() => {
    let lastLeft = 0;
    let dir = "right";
    let lastActive = null;
    let selfScroll = false;
    let userScrolled = false;
    let timer = null;
    let touching = false;
    
    function setScroll(v) {
        const before = listEl.scrollLeft;
        listEl.scrollLeft = v;
        if (listEl.scrollLeft === before) return false;
        selfScroll = true;
        return true;
    }
    
    function fitList() {
        if (touching) return;
        const btns = [...listEl.querySelectorAll("button")];
        btns.forEach((b) => {
            b.style.transition = "width 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease, outline-color 0.15s ease";
            b.style.paddingLeft = "";
            b.style.paddingRight = "";
            b.style.minWidth = "";
            b.style.transform = "";
            b.style.visibility = "visible";
        });
        const box = listEl.getBoundingClientRect();
        const act = listEl.querySelector("button.aktif");
        
        if (act && act.dataset.id !== lastActive) {
            lastActive = act.dataset.id;
            userScrolled = false;
            const r = act.getBoundingClientRect();
            const d = r.left < box.left ? r.left - box.left : r.right > box.right ? r.right - box.right : 0;
            if (Math.abs(d) > 1 && r.width <= box.width && setScroll(listEl.scrollLeft + d)) {
                dir = d < 0 ? "left" : "right";
                lastLeft = listEl.scrollLeft;
                return;
            }
        }
        if (listEl.scrollLeft < lastLeft) dir = "left";
        else if (listEl.scrollLeft > lastLeft) dir = "right";
        
        const isFull = (b) => {
            const r = b.getBoundingClientRect();
            return r.left >= box.left - 1 && r.right <= box.right + 1;
        };
        let vis = btns.filter(isFull);
        if (!vis.length) return;
        
        const first = dir === "left"
            ? btns.find((b) => b.getBoundingClientRect().right > box.left + 1)
            : vis[0];
        let shift = first.getBoundingClientRect().left - box.left;
        
        if (act && !userScrolled && shift < 0 && act.getBoundingClientRect().right - shift > box.right + 1) {
            shift = vis[0].getBoundingClientRect().left - box.left;
        }
        if (Math.abs(shift) > 1 && setScroll(listEl.scrollLeft + shift)) {
            lastLeft = listEl.scrollLeft;
            return;
        }
        vis = btns.filter(isFull);
        btns.forEach((b) => {
            const keep = vis.includes(b) || b === act || b === document.activeElement;
            b.style.visibility = keep ? "visible" : "hidden";
        });
        listEl.dataset.max = listEl.scrollWidth - listEl.clientWidth;   // batas scroll asli
        
        const leftGap = Math.max(0, vis[0].getBoundingClientRect().left - box.left);
        const rightGap = Math.max(0, box.right - vis[vis.length - 1].getBoundingClientRect().right);
        const add = (leftGap + rightGap) / vis.length;
        if (add > 0) {
            const pad = parseFloat(getComputedStyle(vis[0]).paddingLeft) || 0;
            vis.forEach((b) => {
                if (b.classList.contains("aktif")) {
                    b.style.minWidth = b.getBoundingClientRect().width + add + "px";
                } else {
                    b.style.paddingLeft = pad + add / 2 + "px";
                    b.style.paddingRight = pad + add / 2 + "px";
                }
            });
            if (leftGap > 0) vis.forEach((b) => (b.style.transform = `translateX(${-leftGap}px)`));
        }
        lastLeft = listEl.scrollLeft;
    }
    
    listEl.addEventListener("scroll", () => {
        const max = Number(listEl.dataset.max);
        if (max && listEl.scrollLeft > max) listEl.scrollLeft = max;
        if (selfScroll) selfScroll = false;
        else userScrolled = true;
        listEl.querySelectorAll("button").forEach((b) => (b.style.visibility = "visible"));
        clearTimeout(timer);
        if (!touching) timer = setTimeout(fitList, 120);
    });
    listEl.addEventListener("touchstart", () => { touching = true; clearTimeout(timer); }, { passive: true });
    const endTouch = () => { touching = false; clearTimeout(timer); timer = setTimeout(fitList, 150); };
    listEl.addEventListener("touchend", endTouch);
    listEl.addEventListener("touchcancel", endTouch);
    listEl.addEventListener("transitionend", (e) => {
        if (e.propertyName === "width") fitList();
    });
    window.addEventListener("resize", fitList);
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

    const SEL_LIST = ".List button[data-id]";
    const at = (t) => document.elementFromPoint(t.clientX, t.clientY);
    const okList = (btn) => drag.type === "list"
        ? !drag.listIds.includes(btn.dataset.id) && !findList(btn.dataset.id).isDefault
        : btn.dataset.id !== drag.listId;
    const okCard = (card) => settings.shortcutSort === "custom" && !drag.itemIds.includes(card.dataset.id);

    function canDrag(kind, id) {
        if (!mode().editable) return false;
        if (kind === "list") {
            const list = findList(id);
            return !!list && !list.isDefault && settings.listSort === "custom";
        }
        return true;
    }
    function toggle(kind, id) {
        if (kind === "list") toggleListSelection(id);
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
        } else {
            const ids = selectedShortcuts.has(id) ? [...selectedShortcuts] : [id];
            drag = { type: "item", listId: currentId, itemIds: ids };
            ids.forEach((i) => gridEl.querySelector(`.shortcut-box[data-id="${i}"]`)?.classList.add("dragging"));
        }
        navigator.vibrate?.(30);
    }

    document.addEventListener("touchstart", (e) => {
        touching = true;
        held = false;
        moved = false;
        const el = e.target.closest?.(`${SEL_LIST}, .shortcut-box`);
        if (e.touches.length !== 1 || !el || !mode().editable || e.target.closest(".note-toggle, .rename-input, .list-tag")) return;
        startPt = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        pending = { kind: el.matches(".shortcut-box") ? "item" : "list", el };
        timer = setTimeout(onHold, HOLD);
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
        const t = e.touches[0];
        if (!held) {  // geser sebelum 400 ms = swipe/scroll biasa
            if (timer && Math.hypot(t.clientX - startPt.x, t.clientY - startPt.y) > MOVE) {
                clearTimeout(timer);
                timer = null;
                pending = null;
            }
            return;
        }
        if (!drag) return;   // sudah dipilih saat tahan: biarkan scroll biasa
        if (!moved && Math.hypot(t.clientX - startPt.x, t.clientY - startPt.y) > MOVE) moved = true;
        if (e.cancelable) e.preventDefault();
        document.querySelectorAll(".dragover, .drop-target").forEach((n) => n.classList.remove("dragover", "drop-target"));
        const over = at(t);
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
        endDrag();
        if (!d) return;                         // sudah dipilih saat tahan
        if (!wasMoved) {                        // tahan lalu lepas: pilih / lepas pilihan
            if (drop && p) toggle(p.kind, p.el.dataset.id);
            return;
        }
        if (!over) return;
        const btn = over.closest(SEL_LIST);
        const card = over.closest(".shortcut-box");

        if (d.type === "list") {
            if (!btn || d.listIds.includes(btn.dataset.id) || findList(btn.dataset.id).isDefault) return;
            reorderLists(d.listIds, btn.dataset.id);
            renderLists();
        } else if (btn) {
            if (btn.dataset.id === d.listId) return;
            let dup = 0;
            d.itemIds.forEach((id) => {
                const res = moveShortcut(d.listId, id, btn.dataset.id);
                if (res === "duplicate") dup++;
                else if (res) selectedShortcuts.delete(id);
            });
            if (dup) alert(`${dup} shortcut dilewati karena URL sama sudah ada di list tujuan.`);
            updateSelectionUI();
            renderShortcuts();
        } else if (card && settings.shortcutSort === "custom" && !d.itemIds.includes(card.dataset.id)) {
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