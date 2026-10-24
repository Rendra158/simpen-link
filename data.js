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
        pinned: r.pinned === true,
        opens: Number.isFinite(r.opens) ? r.opens : 0,
        lastOpen: Number.isFinite(r.lastOpen) ? r.lastOpen : 0,
        pinOrder: Number.isFinite(r.pinOrder) ? r.pinOrder : 0,
    };
}
function cleanList(r) {
    if (!r || typeof r.name !== "string" || !Array.isArray(r.items)) return null;
    const isDefault = r.isDefault === true;
    // list lama belum punya "added": id dari uid() menyimpan waktu pembuatan (base36)
    const fromId = typeof r.id === "string" ? parseInt(r.id.slice(0, 8), 36) : NaN;
    const added = Number.isFinite(r.added) ? r.added : (fromId > 1e12 && fromId < 4e12 ? fromId : 0);
    return {
        id: typeof r.id === "string" ? r.id : uid(),
        added,
        name: isDefault ? "Home" : r.name,
        isDefault,
        items: r.items.map(cleanItem).filter(Boolean),
        isDefault,
        folderId: typeof r.folderId === "string" ? r.folderId : null,   // BARU
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
    result.forEach((l) => {   // list tanpa folder (data lama) masuk folder pertama
        if (!l.isDefault && !folders.some((f) => f.id === l.folderId)) l.folderId = folders[0].id;
    });
    return result;
}

/* ---------- folder ---------- */
const FOLDER_KEY = "ShortcutFolders";
const CURFOLDER_KEY = "ShortcutCurrentFolder";
const LASTLISTS_KEY = "ShortcutLastLists";   // { idFolder: id list terakhir dibuka }

function loadFolders() {
    const saved = readJSON(FOLDER_KEY);
    const out = (Array.isArray(saved) ? saved : [])
        .filter((f) => f && typeof f.id === "string" && typeof f.name === "string" && f.name.trim())
        .map((f) => ({ id: f.id, name: f.name.trim(), added: Number.isFinite(f.added) ? f.added : 0 }));
    if (!out.length) {
        out.push({ id: uid(), name: "Main", added: Date.now() });
        try { localStorage.setItem(FOLDER_KEY, JSON.stringify(out)); } catch {}
    }
    return out;
}
let folders = loadFolders();
let currentFolderId = null;
let lastLists = readJSON(LASTLISTS_KEY) || {};

let lists = loadLists();
let currentId = null;

const findFolder = (id) => folders.find((f) => f.id === id);
const homeId = () => lists.find((l) => l.isDefault).id;

function ensureCurrent() {
    if (!findList(currentId)) {
        const saved = localStorage.getItem(CURRENT_KEY);
        currentId = findList(saved) ? saved : homeId();
    }
    const cur = findList(currentId);
    if (cur && !cur.isDefault) currentFolderId = cur.folderId;
    else if (!findFolder(currentFolderId)) {
        const sf = localStorage.getItem(CURFOLDER_KEY);
        currentFolderId = findFolder(sf) ? sf : folders[0].id;
    }
}
function setCurrent(id) {
    currentId = id;
    const l = findList(id);
    if (l && !l.isDefault && findFolder(l.folderId)) {   // list biasa: folder & "terakhir dibuka" ikut
        currentFolderId = l.folderId;
        lastLists[l.folderId] = id;
    } else if (l && l.isDefault && findFolder(currentFolderId)) {
        lastLists[currentFolderId] = id;                 // BARU: terakhir di Home
    }
    try {
        localStorage.setItem(CURRENT_KEY, id);
        localStorage.setItem(CURFOLDER_KEY, currentFolderId);
        localStorage.setItem(LASTLISTS_KEY, JSON.stringify(lastLists));
    } catch {}
}
// Pindah ke folder: Home kalau terakhir di Home, atau sub folder terakhir, atau yang pertama
function openFolder(fid) {
    if (!findFolder(fid)) return;
    currentFolderId = fid;
    const subs = getOrderedLists(fid).filter((l) => !l.isDefault);
    const last = lastLists[fid];
    const target = last === homeId() ? null : (subs.find((l) => l.id === last) || subs[0]);
    setCurrent(target ? target.id : homeId());
}
function reloadState() {
    folders = loadFolders();
    lastLists = readJSON(LASTLISTS_KEY) || {};
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

function getOrderedLists(fid = null) {
    const rest = lists.filter((l) => !l.isDefault && (fid === null || l.folderId === fid));
    const s = settings.listSort;
    if (s === "az") rest.sort((a, b) => cmpText(a.name, b.name));
    else if (s === "za") rest.sort((a, b) => cmpText(b.name, a.name));
    else if (s === "newest") rest.sort((a, b) => b.added - a.added);
    else if (s === "oldest") rest.sort((a, b) => a.added - b.added);
    return [...lists.filter((l) => l.isDefault), ...rest];
}
function sortPinned(rows) {
    if (settings.pinSort === "custom") return rows;
    const s = settings.pinSort;
    const byName = (a, b) => cmpText(a.item.name, b.item.name);
    const isNum = (r) => /^\d/.test(r.item.name);
    if (s === "za") return [...rows].sort((a, b) => byName(b, a));
    if (s === "09" || s === "90") {
        const dir = s === "09" ? 1 : -1;
        return [...rows].sort((a, b) =>
            isNum(a) !== isNum(b) ? (isNum(a) ? -1 : 1) : dir * byName(a, b));
    }
    return [...rows].sort(byName);   // "az"
}
function sortItems(rows) {
    const pins = rows.filter((r) => r.item.pinned);
    const rest = rows.filter((r) => !r.item.pinned);
    const s = settings.shortcutSort;
    const byName = (a, b) => cmpText(a.item.name, b.item.name);
    let sorted = rest;
    if (s === "az") sorted = [...rest].sort(byName);
    else if (s === "za") sorted = [...rest].sort((a, b) => byName(b, a));
    else if (s === "newest") sorted = [...rest].sort((a, b) => b.item.added - a.item.added);
    else if (s === "oldest") sorted = [...rest].sort((a, b) => a.item.added - b.item.added);
    return [...sortPinned(pins), ...sorted];   // pin selalu di atas
}
function hasDuplicate(listId, url, exceptId = null) {
    const target = normUrl(url);
    return !!findList(listId)?.items.some((it) => it.id !== exceptId && normUrl(it.url) === target);
}

/* ---------- ubah data ---------- */
const nameTaken = (name, exceptId = null, fid = null) =>
    lists.some((l) => l.id !== exceptId && l.name === name && (l.isDefault || fid === null || l.folderId === fid));
function addList(name, fid = currentFolderId) {
    name = name.trim();
    if (!name || nameTaken(name, null, fid)) return null;
    const list = { id: uid(), name, isDefault: false, added: Date.now(), folderId: fid, items: [] };
    lists.push(list);
    saveLists();
    return list;   // objek list (atau null kalau gagal)
}
function renameList(id, name) {
    name = name.trim();
    const list = findList(id);
    if (!list || list.isDefault || !name || name === list.name || nameTaken(name, id, list.folderId)) return false;
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
const folderNameTaken = (name, exceptId = null) => folders.some((f) => f.id !== exceptId && f.name === name);
function uniqueFolderName(base) {
    let name = base;
    for (let n = 1; folderNameTaken(name); n++) name = `${base} (${n})`;
    return name;
}
function saveFolders() {
    try { localStorage.setItem(FOLDER_KEY, JSON.stringify(folders)); }
    catch { alert("Data gagal disimpan (penyimpanan penuh atau diblokir)."); }
}
function addFolder(name) {
    name = name.trim();
    if (!name || folderNameTaken(name)) return null;
    const f = { id: uid(), name, added: Date.now() };
    folders.push(f);
    saveFolders();
    return f;
}
function renameFolder(id, name) {
    name = name.trim();
    const f = findFolder(id);
    if (!f || !name || name === f.name || folderNameTaken(name, id)) return false;
    f.name = name;
    saveFolders();
    return true;
}
function deleteFolder(id) {
    if (folders.length <= 1 || !findFolder(id)) return false;
    folders = folders.filter((f) => f.id !== id);
    lists = lists.filter((l) => l.isDefault || l.folderId !== id);   // isi folder ikut terhapus
    delete lastLists[id];
    if (currentFolderId === id || !findList(currentId)) openFolder(folders[0].id);
    saveLists();
    saveFolders();
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

function setPinned(listId, itemIds, value) {
    const list = findList(listId);
    if (!list) return;
    list.items.forEach((i) => { if (itemIds.includes(i.id)) i.pinned = value; });
    saveLists();
}

// Simpan urutan pin di panel kanan Home (hanya dipakai saat pinSort = custom)
function setPinOrder(ids) {
    lists.forEach((l) => l.items.forEach((i) => {
        const n = ids.indexOf(i.id);
        if (n !== -1) i.pinOrder = n + 1;
    }));
    saveLists();
}

function trackOpen(listId, itemId) {
    const item = findItem(listId, itemId);
    if (!item) return;
    item.opens = (item.opens || 0) + 1;
    item.lastOpen = Date.now();
    saveLists();
}

/* Urutkan ulang (satu atau banyak). Geser ke depan = sisip sebelum target,
   geser ke belakang = sisip sesudah target, jadi bisa dipindah ke posisi paling akhir.
   Item yang dipindah mengikuti urutan aslinya, bukan urutan klik. */
function reorderShortcuts(listId, fromIds, toId) {
    const list = findList(listId);
    if (!list) return;
    const target = list.items.find((i) => i.id === toId);
    if (!target) return;
    // pin hanya bisa dipindah ke sesama pin (saat urutan pin = Custom), non-pin ke sesama non-pin
    if (target.pinned && settings.pinSort !== "custom") return;
    fromIds = fromIds.filter((id) => !!list.items.find((i) => i.id === id)?.pinned === !!target.pinned);
    const moving = list.items.filter((i) => fromIds.includes(i.id));
    const toIdx = list.items.findIndex((i) => i.id === toId);
    if (!moving.length || toIdx === -1 || moving.some((i) => i.id === toId)) return;
    const forward = list.items.indexOf(moving[0]) < toIdx;
    const rest = list.items.filter((i) => !fromIds.includes(i.id));
    rest.splice(rest.findIndex((i) => i.id === toId) + (forward ? 1 : 0), 0, ...moving);
    list.items = rest;
    saveLists();
}

// toId = list tujuan (sisip di situ); null = taruh di akhir folder fid
function reorderLists(fromIds, toId, fid = currentFolderId) {
    const moving = lists.filter((l) => fromIds.includes(l.id) && !l.isDefault);
    const target = lists.find((l) => l.id === toId && !l.isDefault);
    const dest = target ? target.folderId : fid;
    if (!moving.length || !findFolder(dest) || moving.some((l) => l.id === toId)) return false;
    const forward = !!target && moving[0].folderId === dest && lists.indexOf(moving[0]) < lists.indexOf(target);
    moving.forEach((l) => {
        if (l.folderId !== dest) l.name = uniqueName(l.name, dest, l.id);   // hindari nama kembar di folder tujuan
        l.folderId = dest;
    });
    const rest = lists.filter((l) => !moving.includes(l));
    let at;
    if (target) at = rest.indexOf(target) + (forward ? 1 : 0);
    else {
        const last = rest.map((l) => !l.isDefault && l.folderId === dest).lastIndexOf(true);
        at = last === -1 ? rest.length : last + 1;
    }
    rest.splice(at, 0, ...moving);
    lists = rest;
    saveLists();
    return true;
}

/* ---------- Urutan & Reorder Folder ---------- */
function getOrderedFolders() {
    const s = settings.folderSort || "custom";
    if (s === "custom") return folders; // Kembalikan urutan asli untuk Drag & Drop
    
    const isNum = (f) => /^\d/.test(f.name);
    const byName = (a, b) => cmpText(a.name, b.name);
    let sorted = [...folders];

    if (s === "az") sorted.sort(byName);
    else if (s === "za") sorted.sort((a, b) => byName(b, a));
    else if (s === "09" || s === "90") {
        const dir = s === "09" ? 1 : -1;
        sorted.sort((a, b) =>
            isNum(a) !== isNum(b) ? (isNum(a) ? -1 : 1) : dir * byName(a, b)
        );
    }
    return sorted;
}

function reorderFolders(fromIds, toId) {
    const moving = folders.filter((f) => fromIds.includes(f.id));
    const target = folders.find((f) => f.id === toId);
    if (!moving.length || !target || moving.some((f) => f.id === toId)) return false;

    const forward = folders.indexOf(moving[0]) < folders.indexOf(target);
    const rest = folders.filter((f) => !moving.includes(f));
    
    // Sisipkan folder yang dipindah ke posisi target
    rest.splice(rest.indexOf(target) + (forward ? 1 : 0), 0, ...moving);
    
    folders = rest;
    saveFolders();
    return true;
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
            l.items.map(({ name, url, note, added, pinned }) => ({ name, url, note, added, pinned })),
        ]));
}
function uniqueName(base, fid = currentFolderId, exceptId = null) {
    base = String(base).trim() || "List";
    let name = base;
    for (let n = 1; nameTaken(name, exceptId, fid); n++) name = `${base} (${n})`;
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
        const same = settings.importMode === "overwrite"
            ? lists.find((l) => l.name === name.trim() && (l.isDefault || l.folderId === currentFolderId)) : null;
        if (same) same.items = items;
        else lists.push({ id: uid(), name: uniqueName(name), isDefault: false, added: Date.now(), folderId: currentFolderId, items });
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