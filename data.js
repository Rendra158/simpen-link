/* data.js — data list & shortcut. Butuh store.js (settings, readJSON). */
const DATA_KEY = "ShortcutData2";
const CURRENT_KEY = "ShortcutCurrent";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const cmpText = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
// Host tidak peka huruf besar/kecil, path & query tetap (case-sensitive).
function normUrl(u) {
    try {
        const x = new URL(u);
        return x.origin + x.pathname.replace(/\/+$/, "") + x.search + x.hash;
    } catch {
        return u;
    }
}

/* ---------- URL & validasi ---------- */
function parseUrl(v) {
    v = String(v).trim();
    if (!v || /\s/.test(v)) return null;
    const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(v);
    const isLocal = /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(v);
    const full = hasScheme ? v : (isLocal ? "http://" : "https://") + v;
    try {
        const u = new URL(full);
        const hostOk = u.hostname.includes(".") || u.hostname === "localhost";
        return /^https?:$/.test(u.protocol) && hostOk ? full : null;
    } catch {
        return null;
    }
}
function nameFromUrl(url) {
    const base = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    return base.charAt(0).toUpperCase() + base.slice(1);
}
function cleanItem(r) {
    if (!r || typeof r !== "object" || typeof r.url !== "string") return null;
    const url = parseUrl(r.url);
    if (!url) return null;
    return {
        id: typeof r.id === "string" ? r.id : uid(),
        name: typeof r.name === "string" && r.name.trim() ? r.name.trim() : nameFromUrl(url),
        url,
        note: typeof r.note === "string" ? r.note : "",
        added: Number.isFinite(r.added) ? r.added : Date.now(),
    };
}
function cleanList(r) {
    if (!r || typeof r.name !== "string" || !Array.isArray(r.items)) return null;
    const isDefault = r.isDefault === true;
    return {
        id: typeof r.id === "string" ? r.id : uid(),
        name: isDefault ? "Home" : r.name,
        isDefault,
        items: r.items.map(cleanItem).filter(Boolean),
    };
}

/* ---------- muat data ---------- */
function migrateOld() {
    const old = readJSON("ShortcutData");
    const order = readJSON("ShortcutOrder");
    if (!old || typeof old !== "object" || Array.isArray(old)) return [];
    const keys = Object.keys(old);
    const names = ["Home", ...(Array.isArray(order) ? order : []), ...keys]
        .filter((n, i, a) => keys.includes(n) && a.indexOf(n) === i);
    return names
        .map((n) => cleanList({ name: n, isDefault: n === "Home", items: old[n] }))
        .filter(Boolean);
}
// Kalau data tersimpan rusak, salin dulu ke kunci cadangan supaya tidak hilang saat ditimpa.
function backupBroken() {
    try {
        const raw = localStorage.getItem(DATA_KEY);
        if (raw) localStorage.setItem(DATA_KEY + "Backup", raw);
    } catch {}
}
function loadLists() {
    const saved = readJSON(DATA_KEY);
    if (!Array.isArray(saved)) backupBroken();
    const result = Array.isArray(saved) ? saved.map(cleanList).filter(Boolean) : migrateOld();
    if (!result.some((l) => l.isDefault)) {
        result.unshift({ id: uid(), name: "Home", isDefault: true, items: [] });
    }
    return result;
}
let lists = loadLists();
let currentId = null;
function ensureCurrent() {
    const saved = localStorage.getItem(CURRENT_KEY);
    if (!findList(currentId)) currentId = findList(saved) ? saved : lists.find((l) => l.isDefault).id;
}
function setCurrent(id) {
    currentId = id;
    try { localStorage.setItem(CURRENT_KEY, id); } catch {}
}
function reloadState() {
    lists = loadLists();
    settings = loadSettings();
    ensureCurrent();
}
function saveLists() {
    try {
        localStorage.setItem(DATA_KEY, JSON.stringify(lists));
    } catch {
        alert("Data gagal disimpan (penyimpanan penuh atau diblokir).");
    }
}

/* ---------- pencarian & urutan ---------- */
const findList = (id) => lists.find((l) => l.id === id);
const findItem = (listId, itemId) => findList(listId)?.items.find((i) => i.id === itemId);
function getOrderedLists() {
    const rest = lists.filter((l) => !l.isDefault);
    if (settings.listSort !== "custom") {
        const isNum = (s) => /^\d/.test(s);
        const numFirst = settings.listSort === "number" ? 1 : -1;
        rest.sort((a, b) =>
            isNum(a.name) !== isNum(b.name) ? (isNum(a.name) ? -1 : 1) * numFirst : cmpText(a.name, b.name));
    }
    return [...lists.filter((l) => l.isDefault), ...rest];
}
function sortItems(rows) {
    const s = settings.shortcutSort;
    const byName = (a, b) => cmpText(a.item.name, b.item.name);
    if (s === "az") return [...rows].sort(byName);
    if (s === "za") return [...rows].sort((a, b) => byName(b, a));
    if (s === "newest") return [...rows].sort((a, b) => b.item.added - a.item.added);
    if (s === "oldest") return [...rows].sort((a, b) => a.item.added - b.item.added);
    return rows;
}
function hasDuplicate(listId, url, exceptId = null) {
    const target = normUrl(url);
    return !!findList(listId)?.items.some((it) => it.id !== exceptId && normUrl(it.url) === target);
}

/* ---------- ubah data ---------- */
const nameTaken = (name, exceptId = null) => lists.some((l) => l.id !== exceptId && l.name === name);
function addList(name) {
    name = name.trim();
    if (!name || nameTaken(name)) return false;
    lists.push({ id: uid(), name, isDefault: false, items: [] });
    saveLists();
    return true;
}
function renameList(id, name) {
    name = name.trim();
    const list = findList(id);
    if (!list || list.isDefault || !name || name === list.name || nameTaken(name, id)) return false;
    list.name = name;
    saveLists();
    return true;
}
function deleteList(id) {
    const list = findList(id);
    if (!list || list.isDefault) return false;
    lists = lists.filter((l) => l.id !== id);
    if (currentId === id) setCurrent(lists.find((l) => l.isDefault).id);
    saveLists();
    return true;
}
function addShortcut(listId, { name, url, note }) {
    findList(listId).items.push({ id: uid(), name, url, note, added: Date.now() });
    saveLists();
}
function editShortcut(listId, itemId, fields) {
    const item = findItem(listId, itemId);
    if (!item) return false;
    Object.assign(item, fields);
    saveLists();
    return true;
}
function deleteShortcuts(listId, itemIds) {
    const list = findList(listId);
    if (!list) return;
    list.items = list.items.filter((i) => !itemIds.includes(i.id));
    saveLists();
}
/* Urutkan ulang (satu atau banyak). Geser ke depan = sisip sebelum target,
   geser ke belakang = sisip sesudah target, jadi bisa dipindah ke posisi paling akhir.
   Item yang dipindah mengikuti urutan aslinya, bukan urutan klik. */
function reorderShortcuts(listId, fromIds, toId) {
    const list = findList(listId);
    if (!list) return;
    const moving = list.items.filter((i) => fromIds.includes(i.id));
    const toIdx = list.items.findIndex((i) => i.id === toId);
    if (!moving.length || toIdx === -1 || moving.some((i) => i.id === toId)) return;
    const forward = list.items.indexOf(moving[0]) < toIdx;
    const rest = list.items.filter((i) => !fromIds.includes(i.id));
    rest.splice(rest.findIndex((i) => i.id === toId) + (forward ? 1 : 0), 0, ...moving);
    list.items = rest;
    saveLists();
}

function reorderLists(fromIds, toId) {
    const moving = lists.filter((l) => fromIds.includes(l.id) && !l.isDefault);
    const toIdx = lists.findIndex((l) => l.id === toId);
    if (!moving.length || toIdx === -1 || lists[toIdx].isDefault || moving.some((l) => l.id === toId)) return;
    const forward = lists.indexOf(moving[0]) < toIdx;
    const rest = lists.filter((l) => !moving.includes(l));
    rest.splice(rest.findIndex((l) => l.id === toId) + (forward ? 1 : 0), 0, ...moving);
    lists = rest;
    saveLists();
}

function moveShortcut(fromId, itemId, toId) {
    const from = findList(fromId);
    const to = findList(toId);
    const item = findItem(fromId, itemId);
    if (!from || !to || !item || from === to) return false;
    if (settings.allowDuplicate === "off" && hasDuplicate(toId, item.url)) return "duplicate";
    if (settings.moveMode === "copy") {
        to.items.push({ ...item, id: uid() });
    } else {
        from.items = from.items.filter((i) => i !== item);
        to.items.push(item);
    }
    saveLists();
    return true;
}

/* ---------- export / import ---------- */
function exportData(ids) {
    return Object.fromEntries(
        lists.filter((l) => ids.includes(l.id)).map((l) => [
            l.name,
            l.items.map(({ name, url, note, added }) => ({ name, url, note, added })),
        ]));
}
function uniqueName(base) {
    base = String(base).trim() || "List";
    let name = base;
    for (let n = 1; nameTaken(name); n++) name = `${base} (${n})`;
    return name;
}
function importLists(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const entries = Object.entries(obj);
    if (!entries.length || !entries.every(([, arr]) => Array.isArray(arr))) return null;
    let skipped = 0;
    entries.forEach(([name, arr]) => {
        const items = arr.map(cleanItem).filter(Boolean);
        skipped += arr.length - items.length;
        const same = settings.importMode === "overwrite" ? lists.find((l) => l.name === name.trim()) : null;
        if (same) same.items = items;
        else lists.push({ id: uid(), name: uniqueName(name), isDefault: false, items });
    });
    saveLists();
    return { count: entries.length, skipped };
}

ensureCurrent();

/* ---------- import bookmark browser (bookmarks.html) ---------- */
// Folder jadi list ("Induk / Anak" kalau bersarang), link jadi shortcut.
function parseBookmarksHtml(text) {
    const doc = new DOMParser().parseFromString(text, "text/html");
    const folderName = (dl) => {
        const prev = dl.previousElementSibling;
        const h3 = prev?.tagName === "H3" ? prev : dl.parentElement?.querySelector(":scope > h3");
        return h3 ? h3.textContent.trim() : "";
    };
    const pathOf = (a) => {
        const names = [];
        for (let dl = a.closest("dl"); dl; dl = dl.parentElement?.closest("dl")) {
            const n = folderName(dl);
            if (n) names.unshift(n);
        }
        return names.join(" / ") || "Bookmark";
    };
    const out = {};
    doc.querySelectorAll("a[href]").forEach((a) => {
        const date = Number(a.getAttribute("add_date"));
        (out[pathOf(a)] ||= []).push({
            name: a.textContent.trim(),
            url: a.getAttribute("href"),
            note: "",
            added: date > 0 ? date * 1000 : Date.now(),
        });
    });
    return out;
}