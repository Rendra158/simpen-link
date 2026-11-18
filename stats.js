// stats.js — Statistik pertandingan: pencetak gol (detik ke-berapa) + statistik lengkap.
// Dipanggil lewat hook window.MStats?.xxx() di game.js. Data disimpan di objek global `stats`
// (milik game.js) sehingga otomatis ikut tersinkron di mode online (getOnlineState / applyOnlineState).
(() => {
  'use strict';

  const LABEL_OPEN = 'Lihat statistik pertandingan';
  const LABEL_CLOSE = 'Sembunyikan statistik';
  const M_PER_PX = 0.035; // skala lapangan mini (px -> meter)
  const KMH_PER_SPEED = 60 * M_PER_PX * 3.6; // kecepatan bola (px/frame) -> km/jam

  const blank = () => ({
    shots: [0, 0], // tembakan
    poss: [0, 0], // penguasaan bola (frame)
    sot: [0, 0], // tembakan tepat sasaran
    saves: [0, 0], // penyelamatan (tembakan tepat sasaran yang disentuh lawan)
    touch: [0, 0], // sentuhan bola
    maxv: [0, 0], // tembakan terkeras (px/frame)
    dist: [0, 0], // jarak tempuh pemain (px)
    terr: [0, 0], // frame bola berada di sisi Merah [0] / sisi Biru [1] -> wilayah yang dikuasai
    goals: [], // {t: tim pencetak, n: slot pemain, e: detik, a, b: skor, og, bonus}
    ls: -1, // slot penyentuh bola terakhir
    gm: 0, // jumlah gol sebelum gol terakhir (untuk Batalkan Gol)
    pend: null, // tembakan tepat sasaran yang masih "hidup"
  });

  // Lengkapi objek stats lama/kosong (mis. dari host online versi lama) tanpa mengganti referensinya.
  function fix() {
    if (typeof stats !== 'object' || !stats) return null;
    const d = blank();
    for (const k in d) {
      if (!(k in stats) || Array.isArray(d[k]) !== Array.isArray(stats[k])) stats[k] = d[k];
    }
    return stats;
  }

  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // Nama pencetak: 1 vs 1 -> "Pemain"/"Bot" (tanpa angka); duo -> "Pemain 1/2", "Bot 1/2".
  function who(n, t) {
    if (n < 0) n = t; // tidak diketahui siapa -> pakai pemain utama tim
    const tm = n & 1;
    if (mode === 'duo') {
      const bot = ROLES[n] === 'B';
      const grp = [0, 2, 1, 3].filter((x) => ROLES[x] && (ROLES[x] === 'B') === bot);
      const base = bot ? 'Bot' : 'Pemain';
      return grp.length > 1 ? `${base} ${grp.indexOf(n) + 1}` : base;
    }
    const custom = names[tm];
    if (custom && custom.toUpperCase() !== 'YOU') return custom;
    if (mode === 'bot') return tm === 0 ? 'Pemain' : 'Bot';
    return 'Pemain ' + (tm + 1);
  }
  const teamName = (t) => (mode === 'duo' ? nm(t) : who(t, t));

  // ---------- Hook dari game.js ----------
  function onReset() {
    const s = fix();
    if (!s) return;
    s.ls = -1;
    s.pend = null;
  }

  // Setiap kontak pemain-bola. fresh = kontak baru (bukan kontak yang berlanjut).
  function touch(n, fresh) {
    const s = fix();
    if (!s) return;
    const tm = n & 1;
    s.ls = n;
    if (!fresh) return;
    s.touch[tm]++;
    const pd = s.pend;
    if (pd && pd.t !== tm && elapsed - pd.e < 5) s.saves[tm]++; // lawan menghentikan tembakan tepat sasaran
    s.pend = null;
  }

  // Kecepatan tendangan (hanya saat pemain bergerak menendang).
  function kick(tm, sp) {
    const s = fix();
    if (s && sp > s.maxv[tm]) s.maxv[tm] = sp;
  }

  // Tembakan baru: cek apakah lintasan bola (dengan pantulan dinding atas/bawah) masuk mulut gawang lawan.
  function shot(tm) {
    const s = fix();
    if (!s || !ball.vx) return;
    const gx = tm === 0 ? W - LX : LX;
    const t = (gx - ball.x) / ball.vx;
    if (t <= 0) return;
    const lo = LY + ball.r,
      hi = H - LY - ball.r,
      span = hi - lo;
    const m = (((ball.y + ball.vy * t - lo) % (2 * span)) + 2 * span) % (2 * span);
    const y = lo + (m > span ? 2 * span - m : m);
    const sd = tm === 0 ? 1 : 0; // gawang lawan
    if (y > goalTop(sd) && y < goalBot(sd)) {
      s.sot[tm]++;
      s.pend = { t: tm, e: elapsed };
    }
  }

  // Dipanggil di goal(s) setelah skor bertambah & Skills.onGoal (bonus Bayangan sudah masuk ke score).
  function onGoal(sc) {
    const s = fix();
    if (!s) return;
    s.gm = s.goals.length;
    s.pend = null;
    const ls = s.ls;
    const og = ls >= 0 && (ls & 1) !== sc; // penyentuh terakhir dari tim yang kebobolan = gol bunuh diri
    const e = Math.floor(elapsed);
    let a = preScore[0] + (sc === 0 ? 1 : 0),
      b = preScore[1] + (sc === 1 ? 1 : 0);
    s.goals.push({ t: sc, n: ls, e, a, b, og });
    const extra = score[sc] - (preScore[sc] + 1);
    for (let i = 0; i < extra; i++) {
      if (sc === 0) a++;
      else b++;
      s.goals.push({ t: sc, n: -1, e, a, b, og: false, bonus: true });
    }
  }

  // Gol dibatalkan (skill Batalkan Gol): hapus gol terakhir dari catatan.
  function undoGoal() {
    const s = fix();
    if (s) s.goals.length = Math.min(s.gm, s.goals.length);
  }

  // Dipanggil tiap langkah simulasi saat bola hidup.
  function tick() {
    const s = fix();
    if (!s || !ball) return;
    s.terr[ball.x > W / 2 ? 0 : 1]++;
    for (const [p, k] of [[p1, 'p1'], [p2, 'p2'], [p3, 'p3'], [p4, 'p4']]) {
      if (!p || !prevR[k]) continue;
      const d = Math.hypot(p.x - prevR[k].x, p.y - prevR[k].y);
      if (d < 45) s.dist[p.side === 'left' ? 0 : 1] += d; // loncatan besar (teleport skill) tidak dihitung
    }
  }

  // ---------- Tampilan ----------
  const pc = (a, b) => (a + b ? Math.round((a / (a + b)) * 100) : 50);
  const row = (a, l, b) => `<div class="stat"><b>${a}</b><span>${l}</span><b>${b}</b></div>`;
  const bar = (p) => `<div class="bar"><i style="width:${p}%"></i><i style="width:${100 - p}%"></i></div>`;

  function render(box) {
    const s = fix();
    if (!s) {
      box.innerHTML = '';
      return;
    }
    const T = teamName;
    const G = s.goals;
    const dur = Math.floor(elapsed);

    // 1) Pencetak gol
    let goals;
    if (!G.length) {
      goals = '<p class="ms-empty">Tidak ada gol di pertandingan ini.</p>';
    } else {
      goals =
        '<ul class="ms-goals">' +
        G.map((g, i) => {
          const note = g.og ? ' <small>(gol bunuh diri)</small>' : g.bonus ? ' <small>(bonus skill)</small>' : '';
          const clock = g.e >= 60 ? ` <small>(${fmt(g.e)})</small>` : '';
          return `<li class="${g.t === 0 ? 'b' : 'r'}"><i>${i + 1}</i><span>Gol ke-${i + 1} di detik ${g.e}${clock}</span><strong>${esc(
            g.bonus ? who(-1, g.t) : who(g.n, g.t),
          )}${note}</strong><em>${g.a}-${g.b}</em></li>`;
        }).join('') +
        '</ul>';
    }

    // 2) Statistik perbandingan
    const acc = (i) => (s.shots[i] ? Math.round((s.sot[i] / s.shots[i]) * 100) + '%' : '-');
    const conv = (i) => (s.shots[i] ? Math.round(Math.min(1, score[i] / s.shots[i]) * 100) + '%' : '-');
    const kmh = (v) => (v ? Math.round(v * KMH_PER_SPEED) + ' km/j' : '-');
    const meter = (px) => Math.round(px * M_PER_PX) + ' m';
    const tchP = pc(s.touch[0], s.touch[1]),
      terP = pc(s.terr[0], s.terr[1]);
    const table =
      `<div class="stat st-head"><b>${esc(T(0))}</b><span></span><b>${esc(T(1))}</b></div>` +
      row(s.sot[0], 'TEPAT SASARAN', s.sot[1]) +
      row(acc(0), 'AKURASI', acc(1)) +
      row(conv(0), 'KONVERSI GOL', conv(1)) +
      row(s.saves[0], 'PENYELAMATAN', s.saves[1]) +
      row(s.touch[0], 'SENTUHAN BOLA', s.touch[1]) +
      bar(tchP) +
      row(terP + '%', 'WILAYAH', 100 - terP + '%') +
      bar(terP) +
      row(kmh(s.maxv[0]), 'TEMBAKAN TERKERAS', kmh(s.maxv[1])) +
      row(meter(s.dist[0]), 'JARAK TEMPUH', meter(s.dist[1]));

    // 3) Sorotan
    const hl = [];
    const w = score[0] > score[1] ? 0 : score[0] < score[1] ? 1 : -1;
    let lead = [0, 0];
    for (const g of G) {
      lead[0] = Math.max(lead[0], g.a - g.b);
      lead[1] = Math.max(lead[1], g.b - g.a);
    }
    if (G.length) hl.push(`Gol pertama: ${esc(who(G[0].n, G[0].t))} di detik ${G[0].e}.`);
    if (G.length > 1) {
      let gap = 0,
        prev = 0;
      for (const t of [...G.map((g) => g.e), dur]) {
        gap = Math.max(gap, t - prev);
        prev = t;
      }
      hl.push(`Jeda terpanjang tanpa gol: ${gap} detik.`);
    }
    if (w >= 0 && lead[1 - w] > 0) hl.push(`Comeback! ${esc(T(w))} sempat tertinggal ${lead[1 - w]} gol.`);
    if (w >= 0 && score[1 - w] === 0 && score[w] > 0) hl.push(`${esc(T(w))} menang tanpa kebobolan (clean sheet).`);
    if (w >= 0 && score[w] - score[1 - w] >= 4) hl.push('Kemenangan telak!');
    if (!G.length && score[0] === 0 && score[1] === 0) hl.push('Skor kacamata 0-0, pertahanan sama-sama rapat.');
    const og = G.filter((g) => g.og).length;
    if (og) hl.push(`${og} gol bunuh diri tercatat.`);
    if (mode === 'duo' && G.length) {
      const tally = {};
      for (const g of G) {
        if (g.og || g.bonus) continue;
        const k = who(g.n, g.t);
        tally[k] = (tally[k] || 0) + 1;
      }
      const top = Object.entries(tally).sort((x, y) => y[1] - x[1]);
      if (top.length) hl.push('Top skor: ' + top.map(([k, v]) => `${esc(k)} (${v})`).join(', ') + '.');
    }

    box.innerHTML =
      '<h3 class="ms-title">Pencetak gol</h3>' +
      goals +
      '<h3 class="ms-title">Statistik</h3>' +
      table +
      (hl.length ? '<h3 class="ms-title">Sorotan</h3><ul class="ms-hl">' + hl.map((x) => `<li>${x}</li>`).join('') + '</ul>' : '');
  }

  // Dipanggil finish(): kembalikan panel ke kondisi tertutup.
  function onFinish() {
    const b = document.getElementById('statsToggleBtn'),
      x = document.getElementById('matchStats');
    if (!b || !x) return;
    x.hidden = true;
    x.innerHTML = '';
    b.textContent = LABEL_OPEN;
    b.setAttribute('aria-expanded', 'false');
  }

  const btn = document.getElementById('statsToggleBtn'),
    box = document.getElementById('matchStats');
  if (btn && box) {
    btn.addEventListener('click', () => {
      const open = box.hidden;
      if (open) render(box);
      box.hidden = !open;
      btn.textContent = open ? LABEL_CLOSE : LABEL_OPEN;
      btn.setAttribute('aria-expanded', String(open));
      if (open) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  window.MStats = { blank, fix, onReset, touch, kick, shot, onGoal, undoGoal, tick, onFinish, render };
})();
