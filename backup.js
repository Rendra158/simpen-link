/* backup.js — backup PENUH otomatis ke file di perangkat + pulihkan saat data kosong.
   Dimuat PALING AKHIR di index.html (setelah store.js, data.js, system.js).
   File dipilih lewat Settings > Advanced. Isi file: list & shortcut + salinan penuh data + pengaturan. */
(() => {
    const APP = "simpen.link";
    const FS = "showSaveFilePicker" in window;   // Chrome/Edge/Opera desktop
    const IDB_NAME = "ShortcutBackup", IDB_STORE = "kv", HANDLE_KEY = "handle";
    const LAST_KEY = "ShortcutLastBackup";       // dipakai browser tanpa File System Access
    const NOW_KEY = "ShortcutBackupNow";         // diisi oleh Settings: "backup sekarang" / "file baru dipilih"
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const FILE_TYPES = [{ description: "JSON File", accept: { "application/json": [".json"] } }];

    let handle = null;          // pegangan ke file backup
    let restorePending = false; // data kosong & belum dipulihkan/diabaikan: JANGAN timpa backup
    let timer = null;

    /* ---------- data ---------- */
    const allIds = () => getOrderedLists().map((l) => l.id);
    const isEmpty = () => getOrderedLists().every((l) => l.items.length === 0);
    const countItems = (data) =>
        data && typeof data === "object"
            ? Object.values(data).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0)
            : 0;

    // Backup penuh = versi terbaca (lists) + salinan persis isi localStorage (dataRaw, settingsRaw)
    function snapshot() {
        return {
            app: APP,
            version: 2,
            savedAt: new Date().toISOString(),
            lists: exportData(allIds()),                  // terbaca & bisa dibuka tombol Import
            dataRaw: localStorage.getItem(DATA_KEY),      // semua data persis (urutan, id, dll.)
            settingsRaw: localStorage.getItem(SETTINGS_KEY),
        };
    }
    const snapshotOk = (s) => typeof s.dataRaw === "string" && countItems(s.lists) > 0;

    /* ---------- IndexedDB: simpan pegangan file supaya tahan refresh ---------- */
    function idb() {
        return new Promise((res, rej) => {
            const r = indexedDB.open(IDB_NAME, 1);
            r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        });
    }
    async function idbGet(key) {
        const db = await idb();
        return new Promise((res, rej) => {
            const q = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
            q.onsuccess = () => res(q.result);
            q.onerror = () => rej(q.error);
        });
    }
    async function idbSet(key, val) {
        const db = await idb();
        return new Promise((res, rej) => {
            const tx = db.transaction(IDB_STORE, "readwrite");
            tx.objectStore(IDB_STORE).put(val, key);
            tx.oncomplete = res;
            tx.onerror = () => rej(tx.error);
        });
    }

    /* ---------- izin file ---------- */
    async function perm(ask) {
        if (!handle) return false;
        const o = { mode: "readwrite" };
        try {
            if ((await handle.queryPermission(o)) === "granted") return true;
            return ask && (await handle.requestPermission(o)) === "granted";
        } catch {
            return false;   // requestPermission tanpa klik pengguna
        }
    }

    /* ---------- tulis backup ---------- */
    async function writeBackup() {
        // PENGAMAN: jangan pernah menimpa backup dengan data kosong
        if (!handle || restorePending || isEmpty()) return;
        if (!(await perm(false))) return;   // izin diminta di klik pertama (lihat init)
        try {
            const snap = snapshot();
            if (!snapshotOk(snap)) return;
            const w = await handle.createWritable();   // ditulis ke file sementara, baru diganti saat close()
            await w.write(JSON.stringify(snap, null, 2));
            await w.close();
        } catch (err) {
            console.error("Backup gagal:", err);
        }
    }

    // Browser tanpa File System Access: unduh file bertanggal
    function downloadBackup() {
        if (isEmpty()) return;
        const snap = snapshot();
        if (!snapshotOk(snap)) return;
        const a = h("a", {
            href: URL.createObjectURL(new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" })),
            download: `shortcuts-${new Date().toISOString().slice(0, 10)}.json`,
        });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        localStorage.setItem(LAST_KEY, String(Date.now()));
    }
    // otomatis maksimal seminggu sekali
    function weeklyDownload() {
        if (Date.now() - (Number(localStorage.getItem(LAST_KEY)) || 0) >= WEEK) downloadBackup();
    }

    function scheduleBackup() {
        clearTimeout(timer);
        timer = setTimeout(FS ? writeBackup : weeklyDownload, 1000);   // gabung banyak perubahan jadi satu tulis
    }

    // Setiap data shortcut disimpan ke localStorage -> jadwalkan backup
    const origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
        origSetItem.call(this, key, value);
        if (this === localStorage && key === DATA_KEY) scheduleBackup();
    };

    /* ---------- pulihkan ---------- */
    async function restore(b) {
        restorePending = false;
        if (b && b.app === APP && typeof b.dataRaw === "string" && countItems(b.lists) > 0) {
            // backup penuh: kembalikan data persis + pengaturan
            JSON.parse(b.dataRaw);   // validasi, error kalau rusak
            if (typeof b.settingsRaw === "string") {
                JSON.parse(b.settingsRaw);
                localStorage.setItem(SETTINGS_KEY, b.settingsRaw);
                settings = loadSettings();
                applyTheme();
            }
            localStorage.setItem(DATA_KEY, b.dataRaw);
            syncFromStorage();   // dari system.js: muat ulang & render
        } else if (countItems(b) > 0 && importLists(b)) {
            // file Export biasa (tanpa pengaturan)
            renderLists();
            renderShortcuts();
        } else {
            restorePending = FS;
            alert("File backup tidak valid.");
            return false;
        }
        document.querySelector("#backup-banner")?.remove();
        alert("Backup dipulihkan.");
        return true;
    }

    async function restoreFlow() {
        if (!FS) { document.querySelector("#import-file-input").click(); return; }   // pakai Import biasa
        try {
            // 1) file backup yang pegangannya masih tersimpan
            if (handle && (await perm(true))) {
                const b = JSON.parse(await (await handle.getFile()).text());
                if (await restore(b)) return;
            }
            // 2) pegangan hilang (data browser terhapus): pilih filenya lagi
            const [fh] = await window.showOpenFilePicker({ types: FILE_TYPES });
            const b = JSON.parse(await (await fh.getFile()).text());
            if (!(await restore(b))) return;
            handle = fh;   // backup berikutnya otomatis ke file yang sama
            await idbSet(HANDLE_KEY, handle).catch(() => {});
            await perm(true);
            scheduleBackup();
        } catch (err) {
            if (err.name !== "AbortError") { console.error(err); alert("Gagal memulihkan backup."); }
        }
    }

    function showBanner() {
        const bar = h("div", {
            id: "backup-banner",
            style: "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;" +
                "display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;" +
                "padding:10px 14px;border-radius:12px;background:#222;color:#fff;font:14px system-ui,sans-serif;" +
                "box-shadow:0 4px 20px rgba(0,0,0,.35);max-width:calc(100% - 24px)",
        });
        const mk = (text, fn) => {
            const b = h("button", { type: "button", text, style: "padding:6px 12px;border-radius:8px;border:0;cursor:pointer;font:inherit" });
            b.addEventListener("click", fn);
            return b;
        };
        bar.append(
            h("span", { text: "Data shortcut kosong. Pulihkan dari file backup?" }),
            mk("Pulihkan", restoreFlow),
            mk("Mulai baru", () => {
                if (FS && handle && !confirm("File backup lama akan ditimpa begitu kamu menambah shortcut. Lanjut?")) return;
                restorePending = false;
                bar.remove();
            })
        );
        document.body.append(bar);
    }

    /* ---------- mulai ---------- */
    (async function init() {
        navigator.storage?.persist?.().catch(() => {});   // minta browser jangan hapus data otomatis

        // Settings meminta backup (file baru dipilih / tombol "Backup sekarang")
        const now = localStorage.getItem(NOW_KEY) !== null;
        if (now) localStorage.removeItem(NOW_KEY);

        if (FS) {
            try { handle = (await idbGet(HANDLE_KEY)) || null; } catch {}
            // setelah browser dibuka ulang, izin file perlu 1 klik; minta di klik pertama
            if (handle) {
                document.addEventListener("click", async () => {
                    if (await perm(true)) scheduleBackup();
                }, { once: true });
            }
        }

        if (isEmpty()) {
            restorePending = FS;   // selama banner belum dijawab, backup lama tidak boleh ditimpa
            showBanner();
            return;
        }
        if (now) await (FS ? writeBackup() : Promise.resolve(downloadBackup()));
    })();
})();
