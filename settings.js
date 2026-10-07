/* settings.js — halaman Settings. Butuh store.js. */

const sidebar = document.querySelector("#settings-sidebar");
const page = document.querySelector("#settings-page");
const infoBtn = document.querySelector("#p-info-btn");

function makeField(def) {
  const select = h("select", { id: `p-${def.key}` },
    ...def.options.map(([value, label]) => h("option", { value, text: label })));
  select.value = settings[def.key];
  select.addEventListener("change", () => {
    settings[def.key] = select.value;
    saveSettings();
  });
  return h("fieldset", { class: "s-field" },
    h("legend", { text: def.label }),
    h("div", { class: "s-select" }, select));
}

function setActiveSection(id) {
  for (const btn of sidebar.children) btn.classList.toggle("aktif", btn.dataset.section === id);
  infoBtn.classList.toggle("aktif", id === "info");
  for (const group of page.children) group.classList.toggle("active", group.dataset.section === id);
}

/* tab + panel setting */
SECTIONS.forEach((s) => {
  const btn = h("button", { type: "button", text: s.label, "data-section": s.id });
  btn.addEventListener("click", () => setActiveSection(s.id));
  sidebar.append(btn);

  page.append(h("div", { class: "s-group", "data-section": s.id },
    ...SETTING_DEFS.filter((d) => d.section === s.id).map(makeField)));
});

/* panel info (dari info.txt) */
const infoGroup = h("div", { class: "s-group s-info", "data-section": "info" });
page.append(infoGroup);
infoBtn.addEventListener("click", () => setActiveSection("info"));

fetch("image/info.txt", { cache: "no-cache" })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
  .then((t) => { infoGroup.textContent = t; })
  .catch(() => { infoGroup.textContent = "Info gagal dimuat."; });

/* tampilan awal: #info dari tombol Info di home, selain itu tab pertama */
setActiveSection(location.hash === "#info" ? "info" : SECTIONS[0].id);

document.querySelector("#p-back-btn").addEventListener("click", () => {
  window.location.href = "index.html";
});