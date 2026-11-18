// bot.js — AI Bot MiniSoccer v3 (menggantikan updateBot() di game.js)
// Pasang SETELAH game.js dan skills.js:  <script src="bot.js"></script>
//
// Ide utama:
//  1. Memprediksi lintasan bola (gesekan + pantulan dinding + tembok skill + portal) dan mencari titik/waktu cegat paling awal.
//  2. Menimbang banyak kandidat tembakan (langsung, pantul dinding, sapuan ke sisi) memakai model tendangan
//     yang sama dengan hit() di game.js, lalu memilih yang paling sulit dijangkau pemain.
//  3. Mendekati bola lewat "jalur" aman: geser ke samping dulu (tidak pernah memotong bola), baru ke belakang bola,
//     lalu menembus bola. Setelah "commit" tidak batal-batal sampai bola berubah arah.
//  4. Bertahan sebagai kiper: berdiri di garis gawang–bola, mengantisipasi arah tembakan, belajar jalur favorit
//     pemain, dan menekan di tengah lapangan saat bola lambat.
//  5. Sadar skor & waktu (lebih berani saat tertinggal, lebih hati-hati saat unggul).
//  6. Kecerdasan terpisah dari kecepatan: BotAI.setLevel('easy' | 'normal' | 'hard' | 'pro' | 0..1).
//     Tanpa setLevel, level mengikuti "Kekuatan Bot" (100% ≈ hard+).
//  7. Dadu (galat bidikan & "blunder") dilempar SEKALI per tendangan, bukan tiap frame → tidak plin-plan.
//  8. Menghindar peluru/bom dengan arah terkunci + histeresis → tidak naik-turun di tepi jalur.
//  9. Mengekspor konteks rencana ke skills.js (BotAI.ctx) supaya skill bot dipakai sesuai situasi.
(() => {
  'use strict';

  const legacy = window.updateBot; // bot lama, dipakai hanya jika ada error tak terduga
  const hyp = Math.hypot;
  const lerp = (a, b, t) => a + (b - a) * t;
  const sig = (x) => 1 / (1 + Math.exp(-x));
  const unit = (x, y) => {
    const l = hyp(x, y) || 1;
    return { x: x / l, y: y / l };
  };
  const wrapPI = (a) => {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  };
  const randn = () => {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const newRoll = () => ({ n: randn(), m: Math.random() });
  const PORTAL_RAD = 26; // sama dengan PORTAL_R di skills.js
  const DASH_REACH = 120; // jarak tambahan yang diperhitungkan bila lawan punya Melesat siap

  // ---------- Pengaturan ----------
  const PRESET = { easy: 0.3, normal: 0.6, hard: 0.85, pro: 1 };
  const BotAI = (window.BotAI = {
    state: null, // memori internal (untuk debug)
    level: null, // null = otomatis dari "Kekuatan Bot"
    frame: 0, // penghitung frame (dibaca skills.js untuk mendeteksi konteks basi)
    ctx: null, // konteks rencana untuk skills.js
    setLevel(v) {
      this.level = v == null ? null : typeof v === 'string' ? (PRESET[v] ?? null) : clamp(+v, 0, 1);
    },
  });

  function params() {
    const iq = BotAI.level ?? clamp(0.95 + (BSPD / 4.9 - 1) * 0.9, 0.1, 1);
    const q = iq * iq; // kurva: level rendah benar-benar mudah, level tinggi nyaris sempurna
    return {
      iq,
      think: Math.round(lerp(26, 2, q)), // jeda antar keputusan (frame)
      react: Math.round(lerp(30, 1, q)), // jeda bereaksi saat bola berubah arah
      noise: lerp(160, 5, q), // galat bidikan (px di garis gawang)
      mistake: lerp(0.8, 0.02, q), // peluang memilih opsi kedua/ketiga
      horizon: Math.round(lerp(30, 100, q)), // jauh prediksi (frame)
      anticip: lerp(0, 1, q), // bobot antisipasi tembakan
    };
  }

  // ---------- Memori ----------
  const M = {
    t: 0, nextThink: 0, plan: null, lab: '',
    prevElapsed: 0, bvx: 0, bvy: 0, pvx: 0, pvy: 0, px: 0, py: 0,
    lanes: [1, 1, 1], // jalur gawang (atas/tengah/bawah) yang sering ditembak pemain
    roll: newRoll(), // dadu per tendangan (galat bidikan & blunder)
    sg: null, // sisi putar terkunci (+1 / -1)
    commit: false, // sudah berkomitmen menembus bola
  };
  BotAI.state = M;
  function resetMemory() {
    M.plan = null; M.lab = ''; M.nextThink = 0; M.lanes = [1, 1, 1];
    M.roll = newRoll(); M.sg = null; M.commit = false;
  }

  // ---------- Dunia skill (tembok & portal) ----------
  const X = { walls: false, portals: null };
  function readWorld() {
    const sk = window.Skills?.debugState?.();
    const on = !!(sk && sk.on);
    X.walls = on && sk.walls.length > 0 && !!window.Skills.wallHit;
    X.portals = on && sk.portals.length >= 2 ? sk.portals : null;
  }
  function segDist(ax, ay, bx, by, cx, cy) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 > 1e-9 ? clamp(((cx - ax) * dx + (cy - ay) * dy) / l2, 0, 1) : 0;
    return hyp(ax + dx * t - cx, ay + dy * t - cy);
  }
  function portalPass(o, r, ox, oy) {
    const ps = X.portals;
    for (const a of ps) {
      if (o.pe === a) {
        if (hyp(o.x - a.x, o.y - a.y) > PORTAL_RAD + r + 4) o.pe = null;
        continue;
      }
      const b = ps.find((q) => q.n === a.n && q !== a);
      if (!b) continue;
      if (segDist(ox, oy, o.x, o.y, a.x, a.y) >= PORTAL_RAD - 3) continue;
      const sp = hyp(o.vx, o.vy);
      let dx, dy;
      if (sp > 0.05) { dx = o.vx / sp; dy = o.vy / sp; }
      else {
        dx = o.x - a.x; dy = o.y - a.y;
        const l = hyp(dx, dy) || 1;
        dx /= l; dy /= l;
      }
      const off = PORTAL_RAD + r + 3;
      o.x = clamp(b.x + dx * off, LX + r + 1, W - LX - r - 1);
      o.y = clamp(b.y + dy * off, LY + r + 1, H - LY - r - 1);
      o.pe = b;
      return;
    }
  }

  // ---------- Fisika ----------
  // Satu langkah bola (identik dengan updateBall: gesekan, pantulan atas/bawah, dinding belakang di luar gawang,
  // ditambah tembok skill & portal). Mengubah o in-place; mengembalikan -1 / 1 bila masuk gawang.
  function stepBall(o, r) {
    const ox = o.x, oy = o.y;
    o.x += o.vx; o.y += o.vy; o.vx *= FRIC; o.vy *= FRIC;
    if (o.y < LY + r) { o.y = LY + r; o.vy = Math.abs(o.vy) * 0.9; }
    else if (o.y > H - LY - r) { o.y = H - LY - r; o.vy = -Math.abs(o.vy) * 0.9; }
    let goal = 0;
    const mL = o.y > goalTop(0) && o.y < goalBot(0), mR = o.y > goalTop(1) && o.y < goalBot(1);
    if (o.x < LX + r && !mL) { o.x = LX + r; o.vx = Math.abs(o.vx) * 0.88; }
    else if (o.x > W - LX - r && !mR) { o.x = W - LX - r; o.vx = -Math.abs(o.vx) * 0.88; }
    else if (o.x < LX) goal = -1;
    else if (o.x > W - LX) goal = 1;
    if (X.walls) {
      const h = window.Skills.wallHit(o.x, o.y, r);
      if (h) {
        o.x += h.nx * (h.d + 0.01); o.y += h.ny * (h.d + 0.01);
        const vn = o.vx * h.nx + o.vy * h.ny;
        if (vn < 0) { o.vx -= 2 * vn * h.nx; o.vy -= 2 * vn * h.ny; }
      }
    }
    if (X.portals) portalPass(o, r, ox, oy);
    return goal;
  }

  // Lintasan bola. goal: -1 gawang pemain, 1 gawang bot, 0 tidak ada.
  function traj(x, y, vx, vy, n, pe) {
    const r = ball.r, o = { x, y, vx, vy, pe: pe || null }, pts = [{ x, y, vx, vy }];
    let goal = 0;
    for (let i = 1; i <= n; i++) {
      goal = stepBall(o, r);
      pts.push({ x: o.x, y: o.y, vx: o.vx, vy: o.vy });
      if (goal) break;
    }
    return { pts, goal };
  }

  // Kecepatan bola setelah disentuh pemain bergerak (salinan rumus hit()).
  function outV(bv, n, pv) {
    let vx = bv.vx, vy = bv.vy;
    const inc = vx * n.x + vy * n.y;
    if (inc < 0) { vx -= 1.72 * inc * n.x; vy -= 1.72 * inc * n.y; }
    const ps = hyp(pv.x, pv.y), ap = Math.max(0, pv.x * n.x + pv.y * n.y);
    const pw = (5 + Math.min(4, ps * 0.78 + ap * 0.35)) * KP;
    vx += n.x * pw + pv.x * 0.48;
    vy += n.y * pw + pv.y * 0.48;
    const sp = hyp(vx, vy), mx = 15.5 * KP;
    if (sp > mx) { vx *= mx / sp; vy *= mx / sp; }
    return { vx, vy };
  }

  // Arah sentuhan n supaya bola keluar menuju (tx,ty), memperhitungkan kecepatan bola yang datang.
  // Memindai sudut (bola cepat membuat hubungan sudut-sentuhan → sudut-keluar tidak linear), lalu menghaluskan.
  function solveN(bv, P, tx, ty, sp) {
    const want = Math.atan2(ty - P.y, tx - P.x);
    const err = (a) => {
      const n = { x: Math.cos(a), y: Math.sin(a) };
      const o = outV(bv, n, { x: n.x * sp, y: n.y * sp });
      return wrapPI(Math.atan2(o.vy, o.vx) - want);
    };
    let bestA = null, bestE = 1e9;
    for (let i = 0; i < 48; i++) {
      const a = -Math.PI + (i * 2 * Math.PI) / 48;
      if (Math.cos(a) > -0.1) continue; // jangan pernah menendang ke gawang sendiri
      const e = Math.abs(err(a)) + 0.02 * Math.abs(wrapPI(a - want)); // tie-break: dekat arah langsung
      if (e < bestE) { bestE = e; bestA = a; }
    }
    if (bestA === null) bestA = Math.PI;
    let step = Math.PI / 48;
    for (let i = 0; i < 7; i++) {
      for (const a of [bestA - step, bestA + step]) {
        if (Math.cos(a) > -0.1) continue;
        const e = Math.abs(err(a)) + 0.02 * Math.abs(wrapPI(a - want));
        if (e < bestE) { bestE = e; bestA = a; }
      }
      step /= 2;
    }
    return { x: Math.cos(bestA), y: Math.sin(bestA) };
  }

  // Kecepatan efektif pemain lawan (memperhitungkan skill Cepat/Pelan) + bonus bila Melesat siap.
  function oppReach() {
    const sk = window.Skills;
    const mul = sk?.speedMul?.(p1) ?? 1;
    const st = sk?.debugState?.();
    const dash = !!(st && st.on && st.pl[0].skill === 'dash' && st.pl[0].uses > 0 && st.pl[0].stunT <= 0);
    return { spd: PSPD * mul, bonus: dash ? DASH_REACH : 0 };
  }

  // Simulasi tembakan: apakah masuk gawang lawan, dan seberapa jauh pemain bisa menghadangnya.
  // slack > 0 → pemain (kasus terburuk) tidak sempat menjangkau.
  function shotEval(px, py, ov, react, reach) {
    const o = { x: px, y: py, vx: ov.vx, vy: ov.vy, pe: null };
    let slack = 1e9, goal = 0, x50 = px;
    const r = ball.r, mid = W / 2, rr = p1.r + r;
    for (let f = 1; f <= 120; f++) {
      goal = stepBall(o, r);
      if (f <= 50) x50 = o.x;
      const qx = clamp(o.x, LX + p1.r, mid - 25), qy = clamp(o.y, LY + p1.r, H - LY - p1.r);
      const d = hyp(p1.x - qx, p1.y - qy) + Math.max(0, hyp(o.x - qx, o.y - qy) - rr);
      const s = d - reach.bonus - reach.spd * Math.max(0, f - react);
      if (s < slack) slack = s;
      if (goal || (f > 20 && o.vx * o.vx + o.vy * o.vy < 0.25)) break;
    }
    return { goal, slack, cy: o.y, x50 };
  }

  const clampP = (c) => ({
    x: clamp(c.x, W / 2 + 25, W - LX - p2.r),
    y: clamp(c.y, LY + p2.r, H - LY - p2.r),
  });

  // ---------- Konteks permainan ----------
  function riskNow() {
    let r = 0.5 + 0.2 * (score[0] - score[1]); // tertinggal → lebih berani
    if (TL > 0 && TL - elapsed < 45) r += score[0] > score[1] ? 0.3 : score[0] < score[1] ? -0.3 : 0;
    if (score[0] >= WINS - 1 && score[0] > score[1]) r += 0.15;
    return clamp(r, 0, 1);
  }

  // Pelajari jalur tembakan pemain (dipakai untuk posisi kiper).
  function observe() {
    const dv = hyp(ball.vx - M.bvx, ball.vy - M.bvy);
    if (dv > 3.5 && lastTouch === 0 && ball.vx > 1.5) {
      const t = traj(ball.x, ball.y, ball.vx, ball.vy, 110, ball._pe);
      if (t.goal === 1) {
        const e = t.pts[t.pts.length - 1].y;
        const i = clamp(Math.floor((e - goalTop(1)) / ((goalBot(1) - goalTop(1)) / 3)), 0, 2);
        for (let k = 0; k < 3; k++) M.lanes[k] *= 0.85;
        M.lanes[i] += 1;
      }
    }
    M.bvx = ball.vx; M.bvy = ball.vy;
  }

  // ---------- Keputusan ----------
  function chooseAim(Pt, bv, sp, P, risk) {
    const R = p2.r + ball.r, gm = ball.r + POST + 7;
    const gt = goalTop(0) + gm, gb = goalBot(0) - gm; // gawang lawan (kiri)
    const reach = oppReach();
    const cands = [];
    for (let i = 0; i < 9; i++) cands.push({ lab: 'd' + i, tx: LX, ty: lerp(gt, gb, i / 8) });
    for (let i = 0; i < 5; i++) {
      const ty = lerp(gt, gb, i / 4);
      cands.push({ lab: 't' + i, tx: LX, ty: 2 * (LY + ball.r) - ty, bank: 1 });
      cands.push({ lab: 'b' + i, tx: LX, ty: 2 * (H - LY - ball.r) - ty, bank: 1 });
    }
    cands.push({ lab: 'cu', tx: Pt.x - 260, ty: LY + 14 }, { lab: 'cd', tx: Pt.x - 260, ty: H - LY - 14 });
    // Bola menempel gawang sendiri: kontak "di belakang bola" mustahil → sapu ke samping menyusuri dinding
    if (Pt.x > W - LX - 100) {
      cands.push({ lab: 'su', sweep: 1, n: unit(-0.15, -1) }, { lab: 'sd', sweep: 1, n: unit(-0.15, 1) });
    }

    const dA = lerp(0.3, 0.12, P.iq); // galat arah kontak yang diperhitungkan (rad)
    const scoreN = (n, c, risk) => {
      const o = outV(bv, n, { x: n.x * sp, y: n.y * sp });
      const ev = shotEval(Pt.x, Pt.y, o, 12, reach);
      if (ev.goal === -1) {
        const edge = Math.min(ev.cy - goalTop(0), goalBot(0) - ev.cy);
        return 100 * sig(ev.slack / 35) + Math.min(edge, 30) * 0.5 + Math.min(hyp(o.vx, o.vy), 15.5) * 0.8 +
          12 * (risk - 0.5) - (c.bank ? 8 : 0);
      }
      if (ev.goal === 1) return -1000;
      return 8 + (W - ev.x50) * 0.04;
    };
    const rot = (n, a) => ({ x: n.x * Math.cos(a) - n.y * Math.sin(a), y: n.x * Math.sin(a) + n.y * Math.cos(a) });
    for (const c of cands) {
      const n = c.n || solveN(bv, Pt, c.tx, c.ty, sp);
      const cc = { x: Pt.x - n.x * R, y: Pt.y - n.y * R };
      const cp = clampP(cc);
      const infeas = hyp(cc.x - cp.x, cc.y - cp.y);
      // Rata-rata di sekitar arah kontak yang diinginkan: pilih tembakan yang tahan terhadap meleset sedikit
      let val = 0.5 * scoreN(n, c, risk) + 0.25 * scoreN(rot(n, dA), c, risk) + 0.25 * scoreN(rot(n, -dA), c, risk);
      val -= infeas * (c.sweep ? 1 : 5);
      if (c.lab === M.lab) val += 14; // histeresis: jangan plin-plan
      c.val = val;
    }
    cands.sort((a, b) => b.val - a.val);
    let pick = cands[0];
    // "Blunder" ditentukan oleh dadu per tendangan (M.roll), bukan dilempar ulang tiap keputusan
    if (M.roll.m < P.mistake) pick = cands[1 + Math.floor((M.roll.m / P.mistake) * 2)] || pick;
    return pick;
  }

  function decide(P, sp, risk) {
    const R = p2.r + ball.r;
    const g = { x: LX, y: (goalTop(0) + goalBot(0)) / 2 };
    const tr = traj(ball.x, ball.y, ball.vx, ball.vy, P.horizon, ball._pe);
    const pts = tr.pts, last = tr.goal === 1 ? pts.length - 1 : pts.length;
    const s = Math.max(sp, 0.01);
    // Histeresis: yang sedang menyerang lebih sulit membatalkan serangan (tidak bolak-balik attack ↔ guard)
    const slackF = M.plan && M.plan.mode === 'attack' ? 4 : 2; // kecil: bola cepat menempuh jauh per frame

    // Waktu cegat paling awal yang masih terjangkau
    let k = -1;
    for (let i = 0; i < last; i++) {
      const b = pts[i], d0 = unit(g.x - b.x, g.y - b.y);
      const c0 = { x: b.x - d0.x * R, y: b.y - d0.y * R }, cc = clampP(c0);
      if (hyp(c0.x - cc.x, c0.y - cc.y) > 14) continue;
      const behind = (p2.x - b.x) * d0.x + (p2.y - b.y) * d0.y < -R * 0.5;
      const L = hyp(p2.x - cc.x, p2.y - cc.y) + (behind ? 0 : R * 1.8);
      if (L / s <= i + slackF) { k = i; break; }
    }
    if (k < 0) {
      if (tr.goal === 1) return { mode: 'block', y: pts[pts.length - 1].y, t0: M.t };
      return { mode: 'guard', t0: M.t };
    }
    const b = pts[k];
    const pick = chooseAim(b, { vx: b.vx, vy: b.vy }, sp, P, risk);
    M.lab = pick.lab;
    const ty = pick.lab[0] === 'c' || pick.sweep ? pick.ty : pick.ty + M.roll.n * P.noise;
    return { mode: 'attack', k, tx: pick.tx, ty, n: pick.n || null, t0: M.t };
  }

  // ---------- Eksekusi ----------
  function runAttack(plan, sp) {
    const R = p2.r + ball.r, mid = W / 2;
    const kRem = Math.max(0, plan.k - (M.t - plan.t0));
    const tr = traj(ball.x, ball.y, ball.vx, ball.vy, kRem, ball._pe);
    const b = tr.pts[tr.pts.length - 1];
    const n = plan.n || solveN({ vx: b.vx, vy: b.vy }, b, plan.tx, plan.ty, sp);
    const perp = { x: -n.y, y: n.x };
    const rx = p2.x - b.x, ry = p2.y - b.y;
    const along = rx * n.x + ry * n.y; // negatif = sudah di belakang bola
    const lat = rx * perp.x + ry * perp.y;
    if (along > -R * 0.55) {
      // Belum di belakang bola: putar lewat samping, jangan pernah memotong bola
      M.commit = false;
      const side = R + 40;
      const okSide = (sg) => {
        const xx = b.x + perp.x * sg * side, yy = b.y + perp.y * sg * side;
        return xx > mid + 25 && xx < W - LX - p2.r && yy > LY + p2.r && yy < H - LY - p2.r;
      };
      if (M.sg == null) M.sg = lat >= 0 ? 1 : -1; // sisi dikunci sampai bola berubah arah
      if (!okSide(M.sg) && okSide(-M.sg)) M.sg = -M.sg;
      const sg = M.sg;
      if (lat * sg < side - 6) {
        // Tahap 1: geser ke samping dulu (menjaga jarak dari bola)
        const al = Math.max(along * 0.6, R * 1.15);
        return { x: b.x + n.x * al + perp.x * sg * side, y: b.y + n.y * al + perp.y * sg * side };
      }
      // Tahap 2: lewati samping bola menuju belakangnya
      return { x: b.x + perp.x * sg * side - n.x * R * 0.9, y: b.y + perp.y * sg * side - n.y * R * 0.9 };
    }
    // Sudah di belakang: commit dikunci sampai bola berubah arah
    if (!M.commit && (Math.abs(lat) <= Math.max(4, 0.07 * Math.abs(along)) || kRem <= 3)) M.commit = true;
    if (M.commit) return { x: b.x + n.x * 48, y: b.y + n.y * 48 };
    const lead = clamp(100 - 1.2 * Math.abs(lat), 20, 100);
    const s = Math.min(along + lead, -(R + 55));
    return { x: b.x + n.x * s, y: b.y + n.y * s };
  }

  function guardTarget(P, risk) {
    const gx = W - LX, gy = (goalTop(1) + goalBot(1)) / 2, mid = W / 2;
    const fut = traj(ball.x, ball.y, ball.vx, ball.vy, 14, ball._pe).pts;
    const b = fut[fut.length - 1];
    const dx = b.x - gx, dy = b.y - gy, l = hyp(dx, dy) || 1;
    const D = clamp(l * 0.26 + 60 * risk - 20, 85, 230);
    let tx = gx + (dx / l) * D, ty = gy + (dy / l) * D;
    // Antisipasi: pemain sedang menyiapkan tembakan
    if (ball.x < mid + 40 && hyp(p1.x - ball.x, p1.y - ball.y) < 90 && hyp(ball.vx, ball.vy) < 5) {
      const u = unit(ball.x - p1.x, ball.y - p1.y);
      if (u.x > 0.2) {
        const t = traj(ball.x, ball.y, u.x * 11, u.y * 11, 100);
        if (t.goal === 1) ty = lerp(ty, t.pts[t.pts.length - 1].y, 0.6 * P.anticip);
      }
    }
    // Kebiasaan tembakan pemain
    const sum = M.lanes[0] + M.lanes[1] + M.lanes[2];
    if (sum > 3) {
      const h = (goalBot(1) - goalTop(1)) / 3;
      let by = 0;
      for (let i = 0; i < 3; i++) by += (M.lanes[i] / sum) * (goalTop(1) + h * (i + 0.5));
      ty = lerp(ty, by, 0.18 * P.anticip);
    }
    // Menekan: hanya saat tertinggal/perlu gol (risk tinggi) dan bola lambat di dekat garis tengah
    if (risk > 0.7 && ball.x < mid + 60 && hyp(ball.vx, ball.vy) < 5) {
      const w = 0.3 * risk;
      tx = lerp(tx, mid + 45, w);
      ty = lerp(ty, ball.y, 0.5 * w);
    }
    return { x: clamp(tx, mid + 30, gx - 30), y: clamp(ty, goalTop(1) - 35, goalBot(1) + 35) };
  }

  function think(dt, sp) {
    const P = params();
    if (elapsed < M.prevElapsed - 0.5) resetMemory();
    M.prevElapsed = elapsed;
    readWorld();
    observe();
    M.t++;
    const risk = riskNow();
    // Bola berubah arah / loncat (tendangan, kick-off): bereaksi setelah jeda reaksi, lempar dadu baru
    if (hyp(ball.vx - M.pvx, ball.vy - M.pvy) > 1.2 || hyp(ball.x - M.px, ball.y - M.py) > 60) {
      M.nextThink = Math.min(M.nextThink, M.t + P.react);
      M.roll = newRoll();
      M.sg = null;
      M.commit = false;
    }
    M.pvx = ball.vx; M.pvy = ball.vy; M.px = ball.x; M.py = ball.y;
    if (!M.plan || M.t >= M.nextThink) {
      M.plan = decide(P, sp, risk);
      M.nextThink = M.t + P.think;
      if (M.plan.mode !== 'attack') M.commit = false;
    }
    const pl = M.plan;
    let tgt, spd = sp;
    if (pl.mode === 'attack') tgt = runAttack(pl, sp);
    else if (pl.mode === 'block') tgt = { x: W - LX - p2.r - 4, y: clamp(pl.y, goalTop(1) - 10, goalBot(1) + 10) };
    else {
      tgt = guardTarget(P, risk);
      spd = Math.min(sp, hyp(tgt.x - p2.x, tgt.y - p2.y) * 0.5 + 0.4); // melambat halus saat tiba
    }

    // Konteks untuk skills.js (skill bot dipakai sesuai rencana, bukan sekadar jarak)
    const tr0 = traj(ball.x, ball.y, ball.vx, ball.vy, 100, ball._pe);
    const threat = tr0.goal === 1 ? { x: W - LX, y: tr0.pts[tr0.pts.length - 1].y, t: tr0.pts.length - 1 } : null;
    const dT = hyp(tgt.x - p2.x, tgt.y - p2.y), sps = Math.max(sp, 0.01);
    let late = false;
    if (pl.mode === 'attack') late = dT / sps > Math.max(0, pl.k - (M.t - pl.t0)) + 2;
    else if (pl.mode === 'block' && threat) late = dT / sps > threat.t - 2;
    BotAI.ctx = { frame: BotAI.frame, mode: pl.mode, tgt, late, commit: M.commit, threat };

    moveBot(p2, tgt.x, tgt.y, dt, spd);
  }

  // ---------- Menghindar peluru/bom ----------
  // Arah terkunci + histeresis: begitu mulai menghindar, margin diperlebar sampai peluru lewat,
  // jadi bot tidak naik-turun di tepi jalur peluru.
  const DG = { sg: 0, until: 0, F: 0 };
  function dodge() {
    const sk = window.Skills?.debugState?.();
    DG.F++;
    if (!sk || !sk.on) { DG.sg = 0; return null; }
    const active = DG.until > DG.F, extra = active ? 20 : 0;
    let best = null;
    for (const o of [...sk.shots, ...sk.bombs]) {
      if (o.n !== 0) continue;
      const v2 = o.vx * o.vx + o.vy * o.vy || 1, rx = p2.x - o.x, ry = p2.y - o.y;
      const t = (rx * o.vx + ry * o.vy) / v2; // frame sampai titik terdekat
      if (t < -2 || t > 45) continue;
      const cx = rx - o.vx * t, cy = ry - o.vy * t; // vektor terdekat (bot − peluru)
      const dd = hyp(cx, cy), need = p2.r + (o.r || 9) + 16 + extra;
      if (dd < need && (!best || t < best.t)) best = { t, o, cx, cy, dd, need, v: Math.sqrt(v2) };
    }
    if (!best) return active ? { x: p2.x, y: p2.y } : null;
    const { o, v } = best, px = -o.vy / v, py = o.vx / v; // tegak lurus arah peluru
    if (!DG.sg || !active) {
      DG.sg = best.cx * px + best.cy * py >= 0 ? 1 : -1;
      if (best.dd < 3) DG.sg = p2.y < H / 2 ? -1 : 1; // tepat di jalur: pilih sisi yang lapang
    }
    // sisi terpilih mentok dinding → pindah ke sisi lain (hanya saat mulai)
    const room = (sg) => {
      const y = p2.y + py * sg * 60, x = p2.x + px * sg * 60;
      return y > LY + p2.r && y < H - LY - p2.r && x > W / 2 + 25 && x < W - LX - p2.r;
    };
    if (!active && !room(DG.sg) && room(-DG.sg)) DG.sg = -DG.sg;
    DG.until = DG.F + 18;
    const push = best.need - best.dd + 22;
    return { x: p2.x + px * DG.sg * push, y: p2.y + py * DG.sg * push };
  }

  window.updateBot = function (dt) {
    BotAI.frame++;
    const sk = window.Skills;
    if (sk?.botOrbiting?.()) {
      M.t++;
      M.nextThink = 0; // setelah orbit selesai, putuskan ulang segera
      moveBot(p2, W * 0.72, H / 2, dt, BSPD * 0.6 * (sk?.speedMul(p2) ?? 1));
      return;
    }
    const sp = BSPD * (sk?.speedMul(p2) ?? 1);
    const dg = dodge();
    if (dg) {
      M.t++;
      M.nextThink = Math.min(M.nextThink, M.t); // setelah menghindar, putuskan ulang segera
      moveBot(p2, dg.x, dg.y, dt, sp);
      return;
    }
    try {
      think(dt, sp);
    } catch (e) {
      console.warn('BotAI error, memakai bot lama:', e);
      if (legacy) legacy(dt);
    }
  };
})();
// ============================================================================
//  Mode multi (VS 2 BOT & Custom) — AI tim untuk bot di tim mana pun (Biru/kiri atau Merah/kanan).
//  Semua logika ditulis dari sudut pandang tim Merah (gawang sendiri di kanan, menyerang ke kiri);
//  untuk tim Biru dunia dicerminkan secara horizontal (lapangan simetris), lalu hasilnya dicerminkan balik.
//  Peran: PENYERANG (anggota tim yang paling cepat sampai ke bola; bisa pemain manusia, maka bot menjaga)
//  dan BEK/KIPER. Bot yang sendirian di timnya bermain bertahan/menyerang sesuai posisi bola.
//  Skill tiap bot diputuskan di skills.js (botThink(n)). Dipanggil game.js lewat window.updateBotsDuo(dt).
// ============================================================================
(() => {
  'use strict';
  const hyp = Math.hypot;
  const unit = (x, y) => {
    const l = hyp(x, y) || 1;
    return { x: x / l, y: y / l };
  };
  const D = { att: [-1, -1], swap: [0, 0], F: 0, dg: {} };
  const ent = (n) => [p1, p2, p3, p4][n];
  const VX = (t, x) => (t === 0 ? W - x : x); // cermin horizontal untuk tim Biru (involusi)

  // Bola (nyata atau prediksi) dalam sudut pandang tim t
  const viewBall = (t) => ({ x: VX(t, ball.x), y: ball.y, vx: t === 0 ? -ball.vx : ball.vx, vy: ball.vy, r: ball.r });
  const predictV = (t, f) => {
    const q = predictBall(f);
    return { x: VX(t, q.x), y: q.y, vx: t === 0 ? -q.vx : q.vx, vy: q.vy };
  };

  // Menghindar peluru/bom lawan (arah terkunci + histeresis agar tidak naik-turun di tepi jalur)
  function dodgeFor(t, n, p) {
    const sk = window.Skills?.debugState?.();
    const G = D.dg[n] || (D.dg[n] = { sg: 0, until: 0 });
    if (!sk || !sk.on || !sk.pl[n]) {
      G.sg = 0;
      return null;
    }
    const active = G.until > D.F, extra = active ? 20 : 0;
    let best = null;
    for (const o of [...sk.shots, ...sk.bombs]) {
      if ((o.n & 1) === t) continue; // hanya serangan dari tim lawan
      const v2 = o.vx * o.vx + o.vy * o.vy || 1, rx = p.x - o.x, ry = p.y - o.y;
      const tt = (rx * o.vx + ry * o.vy) / v2; // frame sampai titik terdekat
      if (tt < -2 || tt > 45) continue;
      const cx = rx - o.vx * tt, cy = ry - o.vy * tt;
      const dd = hyp(cx, cy), need = p.r + (o.r || 9) + 16 + extra;
      if (dd < need && (!best || tt < best.t)) best = { t: tt, o, cx, cy, dd, need, v: Math.sqrt(v2) };
    }
    if (!best) return active ? { x: p.x, y: p.y } : null;
    const { o, v } = best, px = -o.vy / v, py = o.vx / v;
    if (!G.sg || !active) {
      G.sg = best.cx * px + best.cy * py >= 0 ? 1 : -1;
      if (best.dd < 3) G.sg = p.y < H / 2 ? -1 : 1;
    }
    const room = (sg) => {
      const y = p.y + py * sg * 60, x = p.x + px * sg * 60;
      const mx = t === 1 ? x : W - x; // sisi sendiri dalam sudut pandang tim
      return y > LY + p.r && y < H - LY - p.r && mx > W / 2 + 25 && mx < W - LX - p.r;
    };
    if (!active && !room(G.sg) && room(-G.sg)) G.sg = -G.sg;
    G.until = D.F + 18;
    const push = best.need - best.dd + 22;
    return { x: p.x + px * G.sg * push, y: p.y + py * G.sg * push };
  }

  // Titik tujuan (sudut pandang tim) agar bot berada di belakang bola (arah tembak a) lalu menembus bola.
  function strike(p, pb, a, bx) {
    const rx = p.x - pb.x, ry = p.y - pb.y;
    const behind = rx * a.x + ry * a.y < -6, off = Math.abs(rx * a.y - ry * a.x);
    if (behind && off < 26) return { x: pb.x + a.x * 55, y: pb.y + a.y * 55 }; // dorong menembus bola
    if (bx > p.x + 4 && Math.abs(p.y - pb.y) < p.r + ball.r + 14) {
      // bola di belakang bot: putar lewat samping dulu
      return { x: pb.x + 30, y: pb.y + (p.y < pb.y ? -1 : 1) * (p.r + ball.r + 26) };
    }
    const d = ball.r + p.r + 16;
    return { x: pb.x - a.x * d, y: pb.y - a.y * d };
  }

  // Bidik pojok gawang lawan yang jauh dari kiper lawan (lawan yang paling dekat gawangnya)
  function aimDir(t, pb, foes) {
    const os = 1 - t, hg = (goalBot(os) - goalTop(os)) / 2, gc = (goalTop(os) + goalBot(os)) / 2; // gawang lawan
    let kp = null;
    for (const f of foes) if (!kp || VX(t, f.x) < VX(t, kp.x)) kp = f;
    const gy = kp ? gc + (kp.y < gc ? 1 : -1) * hg * 0.6 : gc;
    return unit(LX - pb.x, gy - pb.y);
  }

  // Perkiraan "jarak sampai ke bola" (sudut pandang tim): makin kecil makin cocok jadi penyerang.
  function eta(t, p, sp) {
    const vp = { x: VX(t, p.x), y: p.y };
    const d = hyp(ball.x - p.x, ball.y - p.y);
    const pb = predictV(t, Math.round(clamp(d / Math.max(sp, 1), 0, 40)));
    return hyp(pb.x - vp.x, pb.y - vp.y) + (pb.x > vp.x + 4 ? 70 : 0) + (sp <= 0.01 ? 600 : 0);
  }

  // Titik bola menembus gawang sendiri (kanan dalam sudut pandang tim); null = tidak mengancam.
  function threat(t) {
    const vb = viewBall(t);
    if (vb.vx <= 1) return null;
    const gx = W - LX, q = predictV(t, Math.round(clamp((gx - vb.x) / vb.vx, 0, 90)));
    return q.x > gx - 60 && q.y > goalTop(t) - 30 && q.y < goalBot(t) + 30 ? q : null;
  }

  function attack(t, vp, sp, foes) {
    const mid = W / 2, vb = viewBall(t);
    const dB = hyp(vb.x - vp.x, vb.y - vp.y);
    const pb = predictV(t, Math.round(clamp(dB / Math.max(sp, 1), 0, 40)));
    const inPlay = vb.x > mid - 15 || (pb.x > mid + 20 && vb.vx > 0.5);
    const gc = (goalTop(1 - t) + goalBot(1 - t)) / 2;
    if (!inPlay) {
      // Bola di setengah lapangan lawan: bersiaga dekat garis tengah untuk menyambar
      return { x: mid + 70, y: clamp(H / 2 + (vb.y - H / 2) * 0.6, gc - 140, gc + 140) };
    }
    return strike(vp, pb, aimDir(t, pb, foes), vb.x);
  }

  function defend(t, vp, sp) {
    const mid = W / 2, gx = W - LX, vb = viewBall(t), gc = (goalTop(t) + goalBot(t)) / 2;
    const th = threat(t), dB = hyp(vb.x - vp.x, vb.y - vp.y);
    if (th) {
      if (dB < 110) {
        // Tembakan keras tapi bola sudah dekat: tepis ke depan
        const pb = predictV(t, Math.round(clamp(dB / Math.max(sp, 1), 0, 20)));
        return strike(vp, pb, unit(mid - pb.x, (H / 2 - pb.y) * 0.6), vb.x);
      }
      return { x: gx - 55, y: clamp(th.y, goalTop(t) - 5, goalBot(t) + 5) }; // tutup titik masuknya
    }
    // Jaga gawang: berdiri di garis antara gawang dan bola
    const dx = vb.x - gx, dy = vb.y - gc, l = hyp(dx, dy) || 1;
    const d0 = clamp(l * 0.26, 85, 175);
    return {
      x: clamp(gx + (dx / l) * d0, mid + 40, gx - 30),
      y: clamp(gc + (dy / l) * d0, goalTop(t) - 25, goalBot(t) + 25),
    };
  }

  function teamAI(t, dt) {
    const sk = window.Skills;
    const mem = [t, t + 2].filter((n) => ROLES[n] && ent(n));
    const bots = mem.filter((n) => ROLES[n] === 'B');
    if (!bots.length) return;
    const foes = [1 - t, 3 - t].filter((n) => ROLES[n] && ent(n)).map(ent);
    const spd = (n) => (ROLES[n] === 'B' ? BSPD : PSPD) * (sk?.speedMul(ent(n)) ?? 1);
    const orb = (n) => !!sk?.botOrbitingN?.(n);

    // Pembagian peran
    let att = D.att[t];
    const orbiter = bots.find(orb);
    if (orbiter !== undefined) att = orbiter; // yang sedang Orbit selalu "penyerang"
    else if (mem.length > 1) {
      if (D.swap[t] > 0) D.swap[t]--;
      const sc = {};
      for (const n of mem) sc[n] = eta(t, ent(n), spd(n));
      if (!mem.includes(att)) att = mem.reduce((a, b) => (sc[b] < sc[a] ? b : a));
      else {
        const other = mem.filter((n) => n !== att).reduce((a, b) => (sc[b] < sc[a] ? b : a));
        if (D.swap[t] <= 0 && sc[other] + 45 < sc[att]) {
          att = other;
          D.swap[t] = 40;
        }
      }
    }
    D.att[t] = att;

    for (const n of bots) {
      const p = ent(n), sp = spd(n), vp = { x: VX(t, p.x), y: p.y, r: p.r };
      if (orb(n)) {
        // Orbit: bergerak pelan ke posisi tembak; pelepasan diputuskan skills.js (botOrbit)
        moveBot(p, VX(t, W * 0.72), H / 2, dt, BSPD * 0.6 * (sk?.speedMul(p) ?? 1));
        continue;
      }
      const dg = dodgeFor(t, n, p);
      if (dg) {
        moveBot(p, dg.x, dg.y, dt, sp);
        continue;
      }
      let target;
      if (mem.length === 1) {
        // Bot sendirian: serang bila bola di sisinya / mengancam, kalau tidak jaga gawang
        const vb = viewBall(t);
        target = vb.x > W / 2 - 15 || threat(t) ? attack(t, vp, sp, foes) : defend(t, vp, sp);
      } else target = n === att ? attack(t, vp, sp, foes) : defend(t, vp, sp);
      moveBot(p, VX(t, target.x), target.y, dt, sp);
    }
  }

  window.updateBotsDuo = function (dt) {
    D.F++;
    teamAI(0, dt);
    teamAI(1, dt);
  };
})();
