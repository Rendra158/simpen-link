/* settings.js — halaman Settings. Butuh store.js. */

const sidebar = document.querySelector("#settings-sidebar");
const page = document.querySelector("#settings-page");
const infoBtn = document.querySelector("#p-info-btn");

function makeField(def) {
  const id = `p-${def.key}`;
  const select = h("select", { id },
    ...def.options.map(([value, label]) => h("option", { value, text: label })));
  select.value = settings[def.key];
  select.addEventListener("change", () => {
    settings[def.key] = select.value;
    saveSettings();
  });
  return h("div", { class: "s-row" },
    h("label", { class: "s-label", for: id, text: def.label }),
    h("div", { class: "s-select" }, select));
}

function setActiveSection(id) {
  for (const btn of sidebar.children) btn.classList.toggle("aktif", btn.dataset.section === id);
  infoBtn.classList.toggle("aktif", id === "info");
  for (const group of page.children) group.classList.toggle("active", group.dataset.section === id);
}

/* ---------- Advanced: backup otomatis ---------- */
const BK = { db: "ShortcutBackup", store: "kv", key: "handle", now: "ShortcutBackupNow" };
const BTN_STYLE = "padding:8px 14px;border-radius:10px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;cursor:pointer";

function bkRun(mode, fn) {
  return new Promise((res, rej) => {
    const open = indexedDB.open(BK.db, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(BK.store);
    open.onerror = () => rej(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(BK.store, mode);
      const req = fn(tx.objectStore(BK.store));
      tx.oncomplete = () => res(req.result);
      tx.onerror = () => rej(tx.error);
    };
  });
}

function makeAdvancedRows() {
  const FS = "showSaveFilePicker" in window;
  const status = h("div", { style: "opacity:.7;font-size:.9em;line-height:1.4" });
  const actions = h("div", { style: "display:flex;gap:8px;flex-wrap:wrap" });
  const btn = (text, fn) => {
    const b = h("button", { type: "button", text, style: BTN_STYLE });
    b.addEventListener("click", fn);
    return b;
  };

  async function pick() {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: "shortcuts-backup.json",
        types: [{ description: "JSON File", accept: { "application/json": [".json"] } }],
      });
      await bkRun("readwrite", (s) => s.put(handle, BK.key));
      localStorage.setItem(BK.now, "1");   // halaman utama menulis backup pertama saat dibuka
    } catch (err) {
      if (err.name !== "AbortError") alert("Gagal memilih file.");
    }
    refresh();
  }
  function backupNow() {
    localStorage.setItem(BK.now, "1");
    window.location.href = "index.html";
  }
  async function unlink() {
    if (!confirm("Putuskan file backup? File-nya tidak dihapus, hanya tidak diperbarui lagi.")) return;
    await bkRun("readwrite", (s) => s.delete(BK.key)).catch(() => {});
    refresh();
  }

  async function refresh() {
    actions.replaceChildren();
    if (!FS) {
      status.textContent = "Browser ini tidak bisa menulis file otomatis. Backup diunduh otomatis maksimal seminggu sekali.";
      actions.append(btn("Unduh backup sekarang", backupNow));
      return;
    }
    let handle = null;
    try { handle = await bkRun("readonly", (s) => s.get(BK.key)); } catch {}
    if (!handle) {
      status.textContent = "Belum ada file backup. Pilih file, lalu backup berjalan otomatis setiap ada perubahan.";
      actions.append(btn("Pilih file backup", pick));
      return;
    }
    let ok = false;
    try { ok = (await handle.queryPermission({ mode: "readwrite" })) === "granted"; } catch {}
    status.textContent = `File: ${handle.name} — ` + (ok ? "aktif" : "perlu izin (buka halaman utama, klik sekali, lalu izinkan)");
    actions.append(btn("Backup sekarang", backupNow), btn("Ganti file", pick), btn("Putuskan", unlink));
  }

  refresh();
  return [
    h("div", { class: "s-row" }, h("div", { class: "s-label", text: "Backup Otomatis" }), actions),
    h("div", { class: "s-row" }, status),
  ];
}

/* tab + panel setting */
SECTIONS.forEach((s) => {
  const btn = h("button", { type: "button", text: s.label, "data-section": s.id });
  if (s.badge) btn.append(h("span", { text: s.badge, style: "margin-left:6px;font-size:.7em;padding:1px 6px;border-radius:999px;background:#7fb3ff;color:#000" }));
  btn.addEventListener("click", () => setActiveSection(s.id));
  sidebar.append(btn);

  page.append(h("div", { class: "s-group", "data-section": s.id },
    h("div", { class: "s-list" },
      ...SETTING_DEFS.filter((d) => d.section === s.id).map(makeField),
      ...(s.id === "advanced" ? makeAdvancedRows() : []))));
});

/* panel info (dari info.txt) */
const infoGroup = h("div", { class: "s-group s-info", "data-section": "info" });
page.append(infoGroup);
infoBtn.addEventListener("click", () => setActiveSection("info"));

fetch("Image/info.txt", { cache: "no-cache" })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
  .then((t) => { infoGroup.textContent = t; })
  .catch(() => { infoGroup.textContent = "Info gagal dimuat."; });

/* tampilan awal: #info dari tombol Info di home, selain itu tab pertama */
setActiveSection(location.hash === "#info" ? "info" : SECTIONS[0].id);

document.querySelector("#p-back-btn").addEventListener("click", () => {
  window.location.href = "index.html";
});