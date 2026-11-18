// achievements.js — Pencapaian MiniSoccer (hanya Play vs Bot biasa)
(() => {
  'use strict';
  const KEY = 'ms_ach', NEED = { goat: 10, lose: 20, tim: 20, win: 5, cs: 1 };
  const A = Object.assign({ goat: {}, lose: 0, tim: 0, win: 0, cs: 0, done: {} }, store.get(KEY, {}));
  const crewOk = () => typeof CREW === 'undefined' || (CREW.own === 1 && CREW.foe === 1); // CREW hanya ada di versi 2v2
  const std = () => mode === 'bot' && !isCustom && !lgMatch && crewOk();
  const save = () => store.set(KEY, A);
  const list = () => window.Skills?.list?.() || [];
  let track = null;

  const box = document.createElement('details');
  box.className = 'hist';
  document.querySelector('.menu-foot').appendChild(box);

  function toast(t) {
    const d = document.createElement('div');
    d.textContent = '🏆 ' + t;
    d.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99;padding:12px 20px;background:#FFD166;color:#101B25;font:800 .9rem system-ui;border-radius:8px;box-shadow:0 8px 24px #0006';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }
  function unlock(id, name) {
    if (A.done[id]) return;
    A.done[id] = 1;
    toast('Pencapaian: ' + name);
  }
  function render() {
    const ok = list().filter((k) => (A.goat[k] || 0) >= NEED.goat).length, all = list().length;
    const rows = [
      ['win', '🥇', 'Juara Pemula', `Menangkan ${NEED.win} pertandingan lawan Bot`, Math.min(A.win, NEED.win), NEED.win],
      ['cs', '🧱', 'Tembok Baja', 'Menang tanpa kebobolan 1 kali', Math.min(A.cs, NEED.cs), NEED.cs],
      ['tim', '🎯', 'Rajanya Timing', `${NEED.tim} gol Orbit beruntun`, Math.min(A.tim, NEED.tim), NEED.tim],
      ['lose', '😅', 'Pemain < Bot', `Kalah ${NEED.lose}× beruntun`, Math.min(A.lose, NEED.lose), NEED.lose],
      ['goat', '🐐', 'The Goat ?', `Menang ${NEED.goat}× tanpa kebobolan di setiap skill`, ok, all],
    ];
    const got = rows.filter((r) => A.done[r[0]]).length;
    box.innerHTML =
      `<summary>Pencapaian <span class="ach-count">${got}/${rows.length}</span></summary><div class="history ach-list">` +
      rows.map(([id, ic, n, txt, v, max]) => {
        const done = !!A.done[id], pct = max ? Math.round((v / max) * 100) : 0;
        return `<div class="ach-card${done ? ' done' : ''}">
          <span class="ach-ic">${done ? ic : '🔒'}</span>
          <div class="ach-body">
            <b>${n}</b><small>${txt}</small>
            <div class="ach-bar"><i style="width:${done ? 100 : pct}%"></i></div>
          </div>
          <span class="ach-num">${done ? '✔' : v + '/' + max}</span>
        </div>`;
      }).join('') +
      '</div>';
  }

  function fail() {
    if (!track) return;
    track = null;
    A.tim = 0;
    save();
    render();
  }

  window.Ach = {
    startTrack() { if (std()) track = { b: 0 }; },
    bounce() { if (track && ++track.b > 1) fail(); },
    touch: fail,
    endTrack: fail,
    onGoal(s) {
      if (!track) return;
      const ok = s === 0 && track.b <= 1;
      track = null;
      A.tim = ok ? A.tim + 1 : 0;
      if (A.tim >= NEED.tim) unlock('tim', 'Rajanya Timing');
      save();
      render();
    },
    onMatchEnd(skill) {
      fail();
      if (!std()) return;
      const w = score[0] > score[1] ? 0 : score[0] < score[1] ? 1 : -1;
      A.lose = w === 1 ? A.lose + 1 : 0;
      if (A.lose >= NEED.lose) unlock('lose', 'Pemain < Bot');
      if (w === 0) {
        A.win++;
        if (score[1] === 0) A.cs++;
      }
      if (A.win >= NEED.win) unlock('win', 'Juara Pemula');
      if (A.cs >= NEED.cs) unlock('cs', 'Tembok Baja');
      if (skill) {
        A.goat[skill] = w === 0 && score[1] === 0 ? (A.goat[skill] || 0) + 1 : 0;
        const l = list();
        if (l.length && l.every((k) => (A.goat[k] || 0) >= NEED.goat)) unlock('goat', 'The Goat ?');
      }
      save();
      render();
    },
  };
  render();
})();