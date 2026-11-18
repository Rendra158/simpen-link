const S = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const IC = {
  back: S('<path d="M15 5l-7 7 7 7"/>'),
  pause: S('<path d="M8 5v14M16 5v14"/>'),
  play: S('<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"/>'),
  reset: S('<path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  full: S('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  son: S('<path d="M4 10v4h4l5 4V6L8 10zM16.5 9a4 4 0 0 1 0 6"/>'),
  soff: S('<path d="M4 10v4h4l5 4V6L8 10zM17 9l5 6M22 9l-5 6"/>'),
  music: S(
    '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  ),
};
// system.js — konstanta, pengaturan, penyimpanan lokal, state global, dan audio
('use strict');

// Ukuran lapangan (W×H). LX/LY = garis tepi lapangan.
const W = 900,
  H = 560,
  HUD = 0,
  LX = 30,
  LY = 16,
  NET = 25,
  POST = 5;
let GOAL_TOP = 205,
  GOAL_BOTTOM = 355,
  WINS = 5,
  TL = 0,
  PSPD = 4.45,
  PR = 20,
  BR = 11,
  FRIC = 0.99905,
  KP = 1,
  BSPD = 4.9;
// Pergeseran gawang per sisi (0 = gawang kiri/Biru, 1 = gawang kanan/Merah). Dipakai skill Gawang Bergeser:
// hanya gawang tim yang mengaktifkan skill yang bergeser.
const GOAL_OFF = [0, 0];
const goalTop = (s) => GOAL_TOP + GOAL_OFF[s];
const goalBot = (s) => GOAL_BOTTOM + GOAL_OFF[s];
const FIELDS = {
  green: ['#1d8f52', '#1a8449', '#126b3a'],
  blue: ['#2f7fd0', '#2872c0', '#1f5c9e'],
  night: ['#2a3348', '#252d41', '#1b2132'],
  clay: ['#c8683a', '#bb5f33', '#9a4b27'],
};
const DEF = {
  opp: 'bot',
  team1: '1', // komposisi tim kiri (Biru): 1 = 1 pemain, 2h = 2 pemain, hb = pemain + bot
  team2: '1b', // tim kanan (Merah): 1b = 1 bot, 2b = 2 bot, 1h = 1 teman, hb = teman + bot
  nocd: 0, // tanpa cooldown
  reroll: 0, // skill diacak ulang tiap gol
  movegoal: 0, // gawang bergeser naik-turun
  win: 5,
  time: 0,
  pspeed: 100,
  psize: 100,
  bsize: 100,
  kick: 100,
  fric: 100,
  goal: 100,
  bot: 100,
  field: 'green',
  n1: '',
  n2: '',
  skills: 1,
  sk_wall: 1,
  sk_slow: 1,
  sk_fast: 1,
  sk_big: 1,
  sk_grow: 1,
  sk_freeze: 1,
  sk_shadow: 1,
  sk_dark: 1,
  sk_bomb: 1,
  sk_orbit: 1,
  sk_swap: 1,
  sk_ghost: 1,
  sk_dash: 1,
  sk_portal: 1,
  sk_back: 1,
  sk_brake: 1,
  sk_boost: 1,
  sk_slowbox: 1,
  sk_timestop: 1,
  sk_chain: 1,
  sk_undo: 1,
  sk_rewind: 1,
  sk_cannon: 1,
  sk_goalmove: 1,
  sk_mirror: 1,
};
let FC = FIELDS.green;
const DUO_CFG = Object.assign({}, DEF, { win: 8, bot: 92 }); // VS 2 BOT: sampai 8 gol
const $ = (id) => document.getElementById(id);
const canvas = $('pitch'),
  ctx = canvas.getContext('2d');
const gameShell = $('gameShell'),
  site = document.querySelector('.site');
const keys = Object.create(null),
  joy = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------- Penyimpanan lokal ----------
const store = {
  get(k, d) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch (_) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (_) { }
  },
};
let cfg = store.get('ms_cfg', { sound: true, music: true, mode: null });
let record = store.get('ms_rec', { w: 0, l: 0, fast: null });
let matches = store.get('ms_hist', []);
let CS = Object.assign({}, DEF, store.get('ms_custom', {})),
  isCustom = false,
  names = ['', ''];
let points = store.get('ms_pts', 0);

// ---------- State ----------
let mode = 'friend',
  gameActive = false,
  paused = false,
  over = false;
let score = [0, 0],
  p1,
  p2,
  p3 = null, // mode multi (VS 2 BOT / Custom): pemain tim Biru ke-2
  p4 = null, // mode multi: pemain tim Merah ke-2
  ball,
  stats,
  parts = [],
  trail = [];

// Sinkronisasi online (sisi guest): estimasi latensi + koreksi halus (tanpa buffer delay).
const net = {
  rtt: 120, // ms, diukur lewat ping/pong
  since: 0, // langkah sejak state host terakhir
  kick: 0,
  touchT: 0, // sisa langkah setelah tendangan lokal: koreksi bola dilemahkan
  pk: null, // paket state host terakhir (target koreksi)
  at: 0, // waktu paket itu tiba (ms), sudah dikoreksi jitter
  qd: 0, // ms keterlambatan paket di atas paket tercepat (jitter jaringan)
  dmin: null, // selisih jam terkecil (Date.now guest - q host) = lintasan tercepat
};
const isGuest = () => mode === 'online' && !window.MSOnline?.isHost;
const lagFrames = () => (mode === 'online' ? clamp(net.rtt / 2, 0, 220) / 16.667 : 0);
const prevR = { p1: null, p2: null, p3: null, p4: null, ball: null }; // posisi sebelum langkah terakhir (interpolasi render)
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
let kickoff = 0,
  lastCount = 4,
  goalTimer = 0,
  lastScorer = 0;
let elapsed = 0,
  shake = 0,
  restT = 0,
  lastTouch = -1;
let lgMatch = false;
let scale = 1,
  acc = 0,
  lastFrame = 0,
  raf = 0,
  confirmT = 0;

const nm = (s) =>
  names[s]
    ? names[s]
    : mode === 'duo'
      ? s === 0
        ? 'Tim Biru'
        : 'Tim Merah'
    : s === 0
      ? mode === 'bot'
        ? 'Kamu'
        : 'Pemain 1'
      : mode === 'bot'
        ? 'Bot'
        : 'Pemain 2';
const tag = (s) =>
  names[s]
    ? names[s].toUpperCase()
    : mode === 'duo'
      ? teamSlots(s).map(slotLabel).join(' & ')
    : s === 0
      ? mode === 'bot'
        ? 'YOU'
        : 'PLAYER 1'
      : mode === 'bot'
        ? 'BOT'
        : 'PLAYER 2';
const say = (msg) => {
  $('gameStatus').textContent = msg;
};
const mk = (x, side, face) => ({
  x,
  y: H / 2,
  vx: 0,
  vy: 0,
  r: PR,
  side,
  face,
  kick: 0,
  touching: false,
});
const pauseLabel = (v) => {
  $('pauseBtn').innerHTML = v ? IC.play : IC.pause;
  $('pauseBtn').title = v ? 'Lanjutkan (P)' : 'Jeda (P)';
};

const isDuo = () => mode === 'duo';
const players = () => [p1, p2, p3, p4].filter(Boolean);

// ---------- Peran pemain (VS 2 BOT & Custom) ----------
// Slot n: 0 = Biru #1, 1 = Merah #1, 2 = Biru #2, 3 = Merah #2 (genap = tim Biru/kiri, ganjil = tim Merah/kanan).
// ROLES[n]: 'W' = pemain WASD, 'A' = pemain panah, 'WA' = satu-satunya pemain (kedua layout), 'B' = bot, '' = tidak ada.
// HUMANS = slot pemain manusia berurutan: pertama = WASD/Spasi/E, kedua = panah/Enter/Shift kanan.
let ROLES = ['W', 'A', '', ''];
let HUMANS = [0, 1];
function setRoles(r) {
  ROLES = r.slice();
  HUMANS = [0, 2, 1, 3].filter((n) => ROLES[n] && ROLES[n] !== 'B');
}
const teamSlots = (t) => [t, t + 2].filter((n) => ROLES[n]);
const slotLabel = (n) => {
  if (ROLES[n] === 'B') {
    const b = [0, 2, 1, 3].filter((x) => ROLES[x] === 'B');
    return b.length > 1 ? 'BOT ' + (b.indexOf(n) + 1) : 'BOT';
  }
  return 'P' + (HUMANS.indexOf(n) + 1);
};
// left/right: daftar 'H' (pemain) / 'B' (bot) per tim -> ROLES
function rolesFrom(left, right) {
  const humans = [...left, ...right].filter((x) => x === 'H').length;
  const r = ['', '', '', ''];
  let hi = 0;
  const put = (n, c) => {
    if (!c) return;
    r[n] = c === 'B' ? 'B' : humans === 1 ? 'WA' : hi++ === 0 ? 'W' : 'A';
  };
  put(0, left[0]); put(2, left[1]); put(1, right[0]); put(3, right[1]); // urutan = urutan HUMANS
  return r;
}
const TEAM_L = { '1': ['H'], '2h': ['H', 'H'], hb: ['H', 'B'] };
const TEAM_R = { '1b': ['B'], '2b': ['B', 'B'], '1h': ['H'], hb: ['H', 'B'] };
const vsBotsOnly = () => mode === 'bot' || (mode === 'duo' && ![1, 3].some((n) => HUMANS.includes(n)));

// Gawang bergeser (opsi Custom)
let GOAL_HALF = 75, GOAL_MOVE = false, goalPh = 0;
function updateGoals() {
  goalPh++;
  const amp = Math.min(130, H / 2 - LY - GOAL_HALF - 6);
  const off = Math.sin(goalPh / 45) * amp; // periode ±4,7 dtk, kecepatan maks ±2,9 px/frame
  GOAL_TOP = H / 2 - GOAL_HALF + off;
  GOAL_BOTTOM = H / 2 + GOAL_HALF + off;
}
function resetGoals() {
  goalPh = 0;
  GOAL_TOP = H / 2 - GOAL_HALF;
  GOAL_BOTTOM = H / 2 + GOAL_HALF;
  GOAL_OFF[0] = GOAL_OFF[1] = 0;
}

// Batalkan Gol: alur setelah animasi gol
let preScore = [0, 0], undoWait = 0;
function proceedAfterGoal() {
  if (score[lastScorer] >= WINS) finish();
  else {
    window.Skills?.rerollAll?.(); // opsi Custom: skill diacak tiap gol
    resetPositions(lastScorer === 0 ? 1 : -1);
    say('Kick-off sebentar lagi');
  }
}
function afterGoalAnim() {
  endCelebrate();
  const u = window.Skills?.undoOffer?.(lastScorer);
  if (u && u.auto) cancelGoal(u.n);
  else if (u) {
    undoWait = 300; // 5 detik untuk menekan tombol Batalkan Gol
    say('Batalkan gol?');
  } else proceedAfterGoal();
}
function cancelGoal(n) {
  undoWait = 0;
  score[0] = preScore[0];
  score[1] = preScore[1];
  window.MStats?.undoGoal();
  window.Skills?.undoUsed?.(n);
  window.Skills?.undoClose?.();
  tone(520, 0.2, 0.06, 'triangle', -240);
  say('Gol dibatalkan!');
  resetPositions(lastScorer === 0 ? 1 : -1);
}

// ---------- Audio ----------
let AC = null,
  noiseB = null,
  crowdG = null,
  musicT = 0,
  musicStep = 0;
const ac = () => {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
  } catch (_) { }
  return AC;
};
const nbuf = (a) => {
  if (!noiseB) {
    noiseB = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noiseB.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseB;
};
function tone(f, d = 0.08, v = 0.04, type = 'sine', slide = 0, delay = 0, music = false) {
  if (!(music ? cfg.music : cfg.sound)) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay,
    o = a.createOscillator(),
    g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g);
  g.connect(a.destination);
  o.start(t);
  o.stop(t + d);
}
function noise(d = 0.06, v = 0.05, f = 900) {
  if (!cfg.sound) return;
  const a = ac();
  if (!a) return;
  const s = a.createBufferSource(),
    fl = a.createBiquadFilter(),
    g = a.createGain();
  s.buffer = nbuf(a);
  fl.type = 'bandpass';
  fl.frequency.value = f;
  g.gain.setValueAtTime(v, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + d);
  s.connect(fl);
  fl.connect(g);
  g.connect(a.destination);
  s.start();
  s.stop(a.currentTime + d);
}
const whistle = (long) => {
  const d = long ? 0.6 : 0.22;
  tone(2600, d, 0.03, 'triangle');
  tone(2690, d, 0.025, 'triangle');
  if (long) {
    tone(2600, d, 0.03, 'triangle', 0, 0.75);
    tone(2690, d, 0.025, 'triangle', 0, 0.75);
  }
};
const wallHit = (v) => {
  if (Math.abs(v) > 0.5) window.Ach?.bounce();
  if (Math.abs(v) > 2.5) tone(220, 0.05, 0.03, 'sine', -60);
};
function crowdTo(v, t = 0.3) {
  if (!crowdG) {
    if (v <= 0) return;
    const a = ac();
    if (!a) return;
    const s = a.createBufferSource(),
      f = a.createBiquadFilter();
    s.buffer = nbuf(a);
    s.loop = true;
    f.type = 'bandpass';
    f.frequency.value = 700;
    f.Q.value = 0.5;
    crowdG = a.createGain();
    crowdG.gain.value = 0;
    s.connect(f);
    f.connect(crowdG);
    crowdG.connect(a.destination);
    s.start();
  }
  crowdG.gain.setTargetAtTime(v, AC.currentTime, t);
}
const ambient = () => (cfg.sound && gameActive && !paused && !over && !document.hidden ? 0.02 : 0);
const MELODY = [0, 2, 4, 7, 4, 2, 0, -3, 0, 4, 7, 9, 7, 4, 2, 0];
function musicTick() {
  const n = MELODY[musicStep++ % MELODY.length],
    f = 220 * Math.pow(2, n / 12);
  tone(f, 0.35, 0.012, 'triangle', 0, 0, true);
  if (musicStep % 4 === 1) tone(f / 2, 0.6, 0.014, 'sine', 0, 0, true);
}
function syncAudio() {
  crowdTo(ambient());
  const on = cfg.music && gameActive && !paused && !over && !document.hidden;
  if (on && !musicT) musicT = setInterval(musicTick, 260);
  else if (!on && musicT) {
    clearInterval(musicT);
    musicT = 0;
  }
}

// game.js — logika permainan: partikel, alur pertandingan, input, bot, bola, update
('use strict');

// ---------- Efek partikel ----------
function burstParts(x, y, n, colors, spd, g, d, size, bias = 0) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2,
      s = Math.random() * spd;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * s + bias,
      vy: Math.sin(a) * s,
      g,
      life: 1,
      d,
      c: colors[i % colors.length],
      s: size * (0.6 + Math.random() * 0.8),
    });
  }
}
// Hujan konfeti berputar dari atas lapangan
function confetti(s) {
  const cols =
    s === 0
      ? ['#3286F6', '#8CB9FA', '#F3F0E7', '#FFD166']
      : ['#EF5354', '#F6A1A2', '#F3F0E7', '#FFD166'];
  for (let i = 0; i < 120; i++) {
    parts.push({
      x: Math.random() * W,
      y: -10 - Math.random() * 140,
      vx: (Math.random() - 0.5) * 3,
      vy: 1 + Math.random() * 3,
      g: 0.06,
      life: 1,
      d: 0.0065 + Math.random() * 0.003,
      c: cols[i % cols.length],
      s: 6 + Math.random() * 6,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.4,
    });
  }
}

// ---------- Alur pertandingan ----------
function resetPositions(dir = 1) {
  window.Ach?.endTrack();
  if (mode === 'duo') {
    // Tim dengan 2 pemain: satu di atas & satu di bawah; tim dengan 1 pemain: di tengah
    const place = (n) => {
      const t = n & 1, two = teamSlots(t).length === 2;
      const q = mk(t === 0 ? LX + (two ? 170 : 140) : W - LX - (two ? 170 : 140), t === 0 ? 'left' : 'right', t === 0 ? 0 : Math.PI);
      q.y = H / 2 + (two ? (t === 0 ? -1 : 1) * (n >= 2 ? -1 : 1) * 110 : 0);
      return q;
    };
    p1 = place(0);
    p2 = place(1);
    p3 = ROLES[2] ? place(2) : null;
    p4 = ROLES[3] ? place(3) : null;
  } else {
    p1 = mk(LX + 140, 'left', 0);
    p2 = mk(W - LX - 140, 'right', Math.PI);
    p3 = p4 = null;
  }
  ball = {
    x: W / 2,
    y: H / 2,
    vx: dir * (3.8 + Math.random() * 0.8),
    vy: (Math.random() - 0.5) * 2.8,
    r: BR,
    spin: 0,
    pop: 0,
  };
  trail = [];
  kickoff = 2.4;
  lastCount = 4;
  restT = 0;
  lastTouch = -1;
  window.MStats?.onReset();
  window.Skills?.onKickoffReset();
}

function resetMatch() {
  Object.keys(keys).forEach((k) => (keys[k] = false));
  score = [0, 0];
  over = false;
  paused = false;
  elapsed = 0;
  goalTimer = 0;
  undoWait = 0;
  resetGoals();
  window.Skills?.undoClose?.();
  parts = [];
  shake = 0;
  endCelebrate();
  stats = window.MStats?.blank() || { shots: [0, 0], poss: [0, 0] };
  resetPositions(Math.random() < 0.5 ? -1 : 1);
  window.Skills?.newMatch();
  $('endCard').hidden = true;
  $('pauseBtn').disabled = false;
  pauseLabel(false);
  clearConfirm();
  say('Kick-off sebentar lagi');
  syncAudio();
}

function setPaused(v) {
  paused = v;
  pauseLabel(v);
  say(v ? 'Pertandingan dijeda' : 'Pertandingan berlangsung');
  syncAudio();
  if (mode === 'online' && window.MSOnline?.isHost) {
    window.MSOnline.publishState();
  }
}

const togglePause = () => {
  if (mode === 'online' && !window.MSOnline?.isHost) {
    window.MSOnline?.requestPause();
    return;
  }

  if (!over && gameActive) {
    setPaused(!paused);
  }
};

// Papan skor: warna tim memenuhi seluruh papan; lapangan: banner GOOOL + konfeti
function showGoalCelebration(s) {
  const board = $('board'),
    ov = $('goalCelebration'),
    f = $('field');
  f.classList.remove('glow-b', 'glow-r');
  f.classList.add(s === 0 ? 'glow-b' : 'glow-r');
  flip(() => {
    board.classList.remove('win-b', 'win-r');
    void board.offsetWidth;
    board.classList.add(s === 0 ? 'win-b' : 'win-r');
  });
  ov.classList.toggle('red-goal', s === 1);
  $('goalTitle').innerHTML = [...'GOOOL']
    .map((c, i) => `<span style="--i:${i}">${c}</span>`)
    .join('');
  ov.hidden = false;
}
// Animasi geser halus: ukur posisi sebelum & sesudah, lalu luncurkan elemen dari posisi lama
function flip(change) {
  const els = [$('scoreBlue'), $('scoreOrange'), $('nameBlue'), $('nameRed')];
  const edge = (e) => (e.id === 'nameRed' ? 'right' : 'left');
  const first = els.map((e) => {
    const r = e.getBoundingClientRect();
    return { w: r.width, x: r[edge(e)] };
  });
  change();
  els.forEach((e, i) => {
    const r = e.getBoundingClientRect();
    if (!r.width) return;
    const dx = first[i].x - r[edge(e)];
    if (!first[i].w)
      e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 200, fill: 'backwards' });
    else if (Math.abs(dx) > 1)
      e.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], {
        duration: 600,
        easing: 'cubic-bezier(.7,0,.2,1)',
      });
  });
}
function endCelebrate() {
  const bd = $('board');
  if (bd.classList.contains('win-b') || bd.classList.contains('win-r'))
    flip(() => bd.classList.remove('win-b', 'win-r'));
  $('field').classList.remove('glow-b', 'glow-r');
  $('goalCelebration').hidden = true;
}

function goal(s) {
  preScore = [score[0], score[1]];
  window.Ach?.onGoal(s);
  score[s]++;
  window.Skills?.onGoal(s);
  window.MStats?.onGoal(s);
  lastScorer = s;
  goalTimer = 1.7;
  goalFx(s);
}

// Efek gol: dipakai host (saat gol terjadi) dan guest (saat state host membawa gol baru).
function goalFx(s) {
  shake = 12;
  trail = [];
  showGoalCelebration(s);
  const cols = ['#FFD166', '#F3F0E7', s === 0 ? '#3286F6' : '#EF5354'];
  burstParts(s === 0 ? W - LX : LX, H / 2, 90, cols, 9, 0.18, 0.012, 4, s === 0 ? -3 : 3);
  [
    [0.2, 0.14],
    [0.5, 0.1],
    [0.8, 0.14],
    [0.35, 0.9],
    [0.65, 0.9],
  ].forEach(([fx, fy]) => burstParts(W * fx, H * fy, 45, cols, 6, 0.12, 0.014, 3.5));
  confetti(s);
  whistle(false);
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 0.04, 'triangle', 0, 0.15 + i * 0.12));
  noise(1, 0.07, 1300);
  crowdTo(0.1, 0.05);
  setTimeout(() => crowdTo(ambient()), 1700);
  say(`${nm(s)} mencetak gol!`);
}

function finish(fromOnline = false) {
  const skill0 = window.Skills?.skillOf(0);
  over = true;
  window.Skills?.onFinish();
  let gained = false;
  const w = score[0] > score[1] ? 0 : score[0] < score[1] ? 1 : -1;
  matches.unshift({
    l: lgMatch,
    c: isCustom,
    m: mode,
    a: score[0],
    b: score[1],
    d: Math.round(elapsed),
    t: Date.now(),
  });
  matches = matches.slice(0, 8);
  store.set('ms_hist', matches);
  if (mode === 'bot' && !isCustom && !lgMatch && w >= 0) {
    if (w === 0) {
      points += 50;
      store.set('ms_pts', points);
      gained = true;
      record.w++;
      if (record.fast == null || elapsed < record.fast) record.fast = Math.round(elapsed);
    } else record.l++;
    store.set('ms_rec', record);
  }
  window.Ach?.onMatchEnd(skill0);
  const t = stats.poss[0] + stats.poss[1],
    p = t ? Math.round((stats.poss[0] / t) * 100) : 50;
  $('endTitle').textContent =
    w < 0 ? 'DRAW' : vsBotsOnly() ? (w === 0 ? 'WIN' : 'LOSE') : `${nm(w).toUpperCase()} WINS`;
  $('endCard').className = 'endcard ' + (w < 0 ? 'draw' : w === 0 ? 'win-b' : 'win-r');
  $('endScore').innerHTML = `<b class="b">${score[0]}</b><i>:</i><b class="r">${score[1]}</b>`;
  const row = (a, l, b) => `<div class="stat"><b>${a}</b><span>${l}</span><b>${b}</b></div>`;
  $('endStats').innerHTML =
    row(p + '%', 'POSSESSION', 100 - p + '%') +
    `<div class="bar"><i style="width:${p}%"></i><i style="width:${100 - p}%"></i></div>` +
    row(stats.shots[0], 'SHOTS', stats.shots[1]) +
    `<div class="stat solo"><span>TIME ${fmt(elapsed)}</span></div>` +
    (gained ? `<div class="stat solo gain"><span>+50 POINTS</span></div>` : '');
  $('rematchBtn').textContent = lgMatch ? 'KLASEMEN' : 'REMATCH';
  if (lgMatch)
    $('endStats').innerHTML += `<div class="stat solo gain"><span>${leagueResult()}</span></div>`;
  window.MStats?.onFinish();
  $('endCard').hidden = false;
  $('pauseBtn').disabled = true;
  say(w < 0 ? 'Pertandingan berakhir seri' : `${nm(w)} memenangkan pertandingan!`);
  whistle(true);
  syncAudio();

  if (mode === 'online') {
    $('rematchBtn').textContent = 'MAIN MENU';

    if (fromOnline) {
      window.MSOnline?.claimReward();
    } else {
      window.MSOnline?.saveFinalResult(getOnlineState());
    }
  }
}

// ---------- Input & gerak ----------

function readLocalMovement() {
  const right = keys.d || keys.arrowright;
  const left = keys.a || keys.arrowleft;
  const down = keys.s || keys.arrowdown;
  const up = keys.w || keys.arrowup;

  let x = (right ? 1 : 0) - (left ? 1 : 0);
  let y = (down ? 1 : 0) - (up ? 1 : 0);

  const j = joy[0];

  if (Math.hypot(j.x, j.y) > 0.08) {
    x = j.x;
    y = j.y;
  }

  const length = Math.hypot(x, y);

  return length > 1
    ? { x: x / length, y: y / length }
    : { x, y };
}

function input(n) {
  if (mode === 'online') {
    if (n === 0) return readLocalMovement();

    return window.MSOnline?.remoteInput || { x: 0, y: 0 };
  }
  const r = ROLES[n] || 'W';
  const wasd = r === 'W' || r === 'WA', arr = r === 'A' || r === 'WA';
  const right = (wasd && keys.d) || (arr && keys.arrowright),
    left = (wasd && keys.a) || (arr && keys.arrowleft);
  const down = (wasd && keys.s) || (arr && keys.arrowdown),
    up = (wasd && keys.w) || (arr && keys.arrowup);
  let x = (right ? 1 : 0) - (left ? 1 : 0),
    y = (down ? 1 : 0) - (up ? 1 : 0);
  const j = joy[Math.max(0, HUMANS.indexOf(n))] || joy[0];
  if (Math.hypot(j.x, j.y) > 0.08) {
    x = j.x;
    y = j.y;
  }
  const l = Math.hypot(x, y);
  return l > 1 ? { x: x / l, y: y / l } : { x, y };
}

function limit(p) {
  const mid = W / 2;
  p.x = p.side === 'left' ? clamp(p.x, LX + p.r, mid - 25) : clamp(p.x, mid + 25, W - LX - p.r);
  p.y = clamp(p.y, LY + p.r, H - LY - p.r);
}

function movePlayer(p, v, dt) {
  const ox = p.x,
    oy = p.y;
  const sm = window.Skills?.speedMul(p) ?? 1;
  p.x += v.x * PSPD * sm * dt;
  p.y += v.y * PSPD * sm * dt;
  const dm = window.Skills?.dashMove(p); // skill Melesat
  if (dm) {
    p.x += dm.x;
    p.y += dm.y;
  }
  limit(p);
  window.Skills?.collidePlayer(p);
  p.vx = (p.x - ox) / dt;
  p.vy = (p.y - oy) / dt;
}

function moveBot(p, tx, ty, dt, speed) {
  const ox = p.x,
    oy = p.y,
    d = Math.hypot(tx - p.x, ty - p.y);
  if (d > 0.5) {
    const st = Math.min(d, speed * dt);
    p.x += ((tx - p.x) / d) * st;
    p.y += ((ty - p.y) / d) * st;
  }
  const dm = window.Skills?.dashMove(p); // skill Melesat
  if (dm) {
    p.x += dm.x;
    p.y += dm.y;
  }
  limit(p);
  window.Skills?.collidePlayer(p);
  p.vx = (p.x - ox) / dt;
  p.vy = (p.y - oy) / dt;
}

// Prediksi bola f frame ke depan (dengan gesekan dan pantulan dinding)
function predictBall(f) {
  let x = ball.x,
    y = ball.y,
    vx = ball.vx,
    vy = ball.vy;
  const r = ball.r;
  for (let i = 0; i < f; i++) {
    x += vx;
    y += vy;
    vx *= FRIC;
    vy *= FRIC;
    if (y < LY + r) {
      y = LY + r;
      vy = Math.abs(vy) * 0.9;
    } else if (y > H - LY - r) {
      y = H - LY - r;
      vy = -Math.abs(vy) * 0.9;
    }
    if (x < LX + r && !(y > goalTop(0) && y < goalBot(0))) {
      x = LX + r;
      vx = Math.abs(vx) * 0.88;
    } else if (x > W - LX - r && !(y > goalTop(1) && y < goalBot(1))) {
      x = W - LX - r;
      vx = -Math.abs(vx) * 0.88;
    }
  }
  return { x, y, vx, vy };
}

// Menghindar dari peluru/bom milik pemain
function botDodge() {
  const S = window.Skills?.debugState?.();
  if (!S || !S.on) return null;
  for (const o of [...S.shots, ...S.bombs]) {
    if (o.n !== 0) continue;
    const rx = p2.x - o.x,
      ry = p2.y - o.y,
      sp = Math.hypot(o.vx, o.vy) || 1;
    const along = (rx * o.vx + ry * o.vy) / sp;
    const side = (-rx * o.vy + ry * o.vx) / sp;
    if (along > 0 && along < 170 && Math.abs(side) < p2.r + (o.r || 9) + 14) {
      const sg = side >= 0 ? 1 : -1;
      return { x: p2.x + (-o.vy / sp) * sg * 70, y: p2.y + (o.vx / sp) * sg * 70 };
    }
  }
  return null;
}

// Bot: prediksi bola, bidik pojok gawang, putar bila bola di belakang, jaga gawang, hindari serangan.
function updateBot(dt) {
  if (window.Skills?.botOrbiting?.()) {
    moveBot(p2, W * 0.72, H / 2, dt, BSPD * 0.6 * (window.Skills?.speedMul(p2) ?? 1));
    return;
  }
  const mid = W / 2,
    gx = W - LX,
    sp = BSPD * (window.Skills?.speedMul(p2) ?? 1);
  const dg = botDodge();
  if (dg) {
    moveBot(p2, dg.x, dg.y, dt, sp);
    return;
  }

  const dB = Math.hypot(ball.x - p2.x, ball.y - p2.y);
  const pb = predictBall(Math.round(clamp(dB / Math.max(sp, 1), 0, 40)));
  // Bidik pojok gawang yang jauh dari pemain lawan
  const hg = (goalBot(0) - goalTop(0)) / 2,
    gc0 = (goalTop(0) + goalBot(0)) / 2,
    gc1 = (goalTop(1) + goalBot(1)) / 2;
  const gy = gc0 + (p1.y < gc0 ? 1 : -1) * hg * 0.6;
  let ax = LX - pb.x,
    ay = gy - pb.y;
  const al = Math.hypot(ax, ay) || 1;
  ax /= al;
  ay /= al;

  // Ancaman ke gawang bot
  let threat = null;
  if (ball.vx > 1) {
    const q = predictBall(Math.round(clamp((gx - ball.x) / ball.vx, 0, 90)));
    if (q.x > gx - 60 && q.y > goalTop(1) - 30 && q.y < goalBot(1) + 30) threat = q;
  }
  const attack = ball.x > mid - 15 || (pb.x > mid + 20 && ball.vx > 0.5);
  let tx, ty;

  if (threat && ball.x < W * 0.62) {
    // Tembakan keras dari jauh: tutup titik masuknya
    tx = gx - 55;
    ty = clamp(threat.y, goalTop(1) - 5, goalBot(1) + 5);
  } else if (attack) {
    const bx = pb.x,
      by = pb.y,
      rx = p2.x - bx,
      ry = p2.y - by;
    const behind = rx * ax + ry * ay < -6,
      off = Math.abs(rx * ay - ry * ax);
    if (behind && off < 26) {
      tx = bx + ax * 55; // dorong menembus bola
      ty = by + ay * 55;
    } else if (ball.x > p2.x + 4 && Math.abs(p2.y - by) < p2.r + ball.r + 14) {
      tx = bx + 30; // bola di belakang: putar dulu
      ty = by + (p2.y < by ? -1 : 1) * (p2.r + ball.r + 26);
    } else {
      const d = ball.r + p2.r + 16;
      tx = bx - ax * d;
      ty = by - ay * d;
    }
  } else if (ball.x > mid - 230) {
    // Jaga gawang: berdiri di garis antara gawang dan bola
    const dx = ball.x - gx,
      dy = ball.y - gc1,
      l = Math.hypot(dx, dy) || 1;
    tx = gx + (dx / l) * 120;
    ty = clamp(gc1 + (dy / l) * 120, goalTop(1) - 20, goalBot(1) + 20);
  } else {
    // Bola jauh: tunggu di dekat garis tengah untuk menyambar
    tx = mid + 60;
    ty = clamp(gc1 + (ball.y - gc1) * 0.6, goalTop(1) - 40, goalBot(1) + 40);
  }
  moveBot(p2, tx, ty, dt, sp);
}

const aim = (p) => {
  p.face =
    Math.hypot(p.vx, p.vy) > 0.6 ? Math.atan2(p.vy, p.vx) : Math.atan2(ball.y - p.y, ball.x - p.x);
};

// ---------- Bola ----------
function hitPost(px, py) {
  const dx = ball.x - px,
    dy = ball.y - py,
    d = Math.hypot(dx, dy) || 0.001,
    min = ball.r + POST;
  if (d >= min) return;
  const nx = dx / d,
    ny = dy / d,
    dot = ball.vx * nx + ball.vy * ny;
  ball.x = px + nx * min;
  ball.y = py + ny * min;
  if (dot < 0) {
    window.Ach?.bounce();
    ball.vx -= 1.9 * dot * nx;
    ball.vy -= 1.9 * dot * ny;
    tone(1200, 0.25, 0.04, 'triangle', -200);
    shake = Math.max(shake, 3);
  }
}

function updateBall(dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  const f = Math.pow(FRIC, dt);
  ball.vx *= f;
  ball.vy *= f;
  ball.spin += Math.hypot(ball.vx, ball.vy) * 0.025 * dt;
  const r = ball.r,
    mx = LX + r,
    my = LY + r;
  window.Skills?.collideBall(ball);
  if (ball.y < my) {
    ball.y = my;
    wallHit(ball.vy);
    ball.vy = Math.abs(ball.vy) * 0.9;
  } else if (ball.y > H - my) {
    ball.y = H - my;
    wallHit(ball.vy);
    ball.vy = -Math.abs(ball.vy) * 0.9;
  }
  for (const sd of [0, 1]) for (const py of [goalTop(sd), goalBot(sd)]) hitPost(sd ? W - LX : LX, py);
  const mouthL = ball.y > goalTop(0) && ball.y < goalBot(0),
    mouthR = ball.y > goalTop(1) && ball.y < goalBot(1);
  if (ball.x < mx && !mouthL) {
    ball.x = mx;
    wallHit(ball.vx);
    ball.vx = Math.abs(ball.vx) * 0.88;
  } else if (ball.x > W - mx && !mouthR) {
    ball.x = W - mx;
    wallHit(ball.vx);
    ball.vx = -Math.abs(ball.vx) * 0.88;
  } else if (ball.x < LX) {
    if (isGuest()) ball.x = Math.max(ball.x, LX - NET + r); // gol diputuskan host
    else {
      goal(1);
      return;
    }
  } else if (ball.x > W - LX) {
    if (isGuest()) ball.x = Math.min(ball.x, W - LX + NET - r);
    else {
      goal(0);
      return;
    }
  }

  if (Math.hypot(ball.vx, ball.vy) < 0.22) ball.vx = ball.vy = 0;
  if (Math.hypot(ball.vx, ball.vy) > 1.8) {
    trail.push({ x: ball.x, y: ball.y, life: 1 });
    if (trail.length > 9) trail.shift();
  }
  trail.forEach((t) => (t.life -= 0.1 * dt));
  trail = trail.filter((t) => t.life > 0);
}

// Setelah gol, bola menggelinding pelan di dalam jaring.
function netBall() {
  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.vx *= 0.93;
  ball.vy *= 0.93;
  ball.x =
    lastScorer === 0
      ? clamp(ball.x, W - LX + 2, W - LX + NET - ball.r)
      : clamp(ball.x, LX - NET + ball.r, LX - 2);
  const gs = lastScorer === 0 ? 1 : 0; // gawang yang kemasukan
  ball.y = clamp(ball.y, goalTop(gs) + ball.r, goalBot(gs) - ball.r);
}

function hit(p, n) {
  const dx = ball.x - p.x,
    dy = ball.y - p.y,
    d = Math.hypot(dx, dy) || 0.001,
    min = p.r + ball.r;
  if (d >= min) {
    p.touching = false;
    return;
  }
  const nx = dx / d,
    ny = dy / d;
  ball.x = p.x + nx * (min + 0.7);
  ball.y = p.y + ny * (min + 0.7);
  const ps = Math.hypot(p.vx, p.vy),
    ap = Math.max(0, p.vx * nx + p.vy * ny),
    fresh = !p.touching;
  const tm = n & 1; // tim: 0 = Biru, 1 = Merah (pemain 3/4 ikut tim pemain 1/2)
  lastTouch = tm;
  window.Ach?.touch();
  window.MStats?.touch(n, fresh);
  if (fresh || ap > 0.72) {
    const still = ps < 0.55,
      inc = ball.vx * nx + ball.vy * ny;
    if (inc < 0) {
      const re = still ? 1.08 : 1.72;
      ball.vx -= re * inc * nx;
      ball.vy -= re * inc * ny;
    }
    // Pemain diam hanya menyentuh bola; pemain bergerak menendang lebih keras.
    const pw = still ? 1.15 : (5 + Math.min(4, ps * 0.78 + ap * 0.35)) * KP,
      cr = still ? 0.02 : 0.48;
    ball.vx += nx * pw + p.vx * cr;
    ball.vy += ny * pw + p.vy * cr;
    const sp = Math.hypot(ball.vx, ball.vy),
      mx = still ? 10.5 : 15.5 * KP;
    if (sp > mx) {
      ball.vx *= mx / sp;
      ball.vy *= mx / sp;
    }
    if (!still) {
      p.kick = 1;
      ball.pop = 1;
      burstParts(ball.x, ball.y, 6, ['#ffffff', '#ffe08a'], 3.5, 0, 0.08, 2.5);
      noise(0.05, 0.05, 220);
    }
    if (!still) window.MStats?.kick(tm, Math.min(sp, mx));
    if (fresh && sp > 8 && (tm === 0 ? ball.vx > 0 : ball.vx < 0)) {
      stats.shots[tm]++;
      window.MStats?.shot(tm);
    }
    tone(still ? 300 : 390 + Math.min(260, sp * 12), 0.055, 0.03);
  }
  p.touching = true;
}

// Rekan satu tim tidak saling menembus (mode VS 2 BOT).
function separateMates() {
  for (const [a, b] of [
    [p1, p3],
    [p2, p4],
  ]) {
    if (!a || !b) continue;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      d = Math.hypot(dx, dy),
      min = a.r + b.r;
    if (d >= min) continue;
    const nx = d > 0.001 ? dx / d : 0,
      ny = d > 0.001 ? dy / d : 1,
      push = (min - d) / 2;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    limit(a);
    limit(b);
    window.Skills?.collidePlayer(a);
    window.Skills?.collidePlayer(b);
  }
}

// ---------- Update (langkah tetap 1/60 detik) ----------
function step() {
  snapPrev();
  if (!gameActive || paused) return;

  // Guest menjalankan simulasi lokal (prediksi) yang dikoreksi state host.
  if (isGuest()) {
    guestStep();
    return;
  }

  const dt = 1,
    sec = 1 / 60;
  shake *= 0.9;
  if (shake < 0.2) shake = 0;
  ball.pop = Math.max(0, ball.pop - 0.1);
  p1.kick = Math.max(0, p1.kick - 0.08);
  p2.kick = Math.max(0, p2.kick - 0.08);
  if (p3) p3.kick = Math.max(0, p3.kick - 0.08);
  if (p4) p4.kick = Math.max(0, p4.kick - 0.08);
  parts.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.g;
    p.life -= p.d;
    if (p.vr) p.rot += p.vr;
  });
  parts = parts.filter((p) => p.life > 0);
  window.Skills?.tickFx();
  if (over) return;
  if (GOAL_MOVE) updateGoals();

  if (goalTimer > 0) {
    netBall();
    goalTimer -= sec;
    if (goalTimer <= 0) {
      goalTimer = 0;
      afterGoalAnim();
    }
    return;
  }
  if (undoWait > 0) {
    // Jendela Batalkan Gol (5 detik): permainan menunggu
    netBall();
    undoWait--;
    window.Skills?.undoTick?.(undoWait / 60);
    if (undoWait <= 0) {
      window.Skills?.undoClose?.();
      proceedAfterGoal();
    }
    return;
  }
  if (kickoff > 0) {
    kickoff -= sec;
    const n = Math.ceil(kickoff / 0.8);
    if (n > 0 && n < lastCount) {
      lastCount = n;
      tone(660, 0.09, 0.04);
    }
    if (kickoff <= 0) {
      kickoff = 0;
      whistle(false);
      say('Pertandingan berlangsung');
    }
    return;
  }

  if (window.Skills?.rewindStep?.()) return; // animasi skill Mundur: permainan berhenti sementara

  elapsed += sec;
  if (TL && elapsed >= TL) {
    elapsed = TL;
    finish();
    return;
  }
  movePlayer(p1, input(0), dt);
  if (mode === 'duo') {
    // Pemain manusia sesuai ROLES; bot dikendalikan AI tim (bot.js)
    if (ROLES[1] !== 'B') movePlayer(p2, input(1), dt);
    if (p3 && ROLES[2] !== 'B') movePlayer(p3, input(2), dt);
    if (p4 && ROLES[3] !== 'B') movePlayer(p4, input(3), dt);
    if (window.updateBotsDuo) window.updateBotsDuo(dt);
    separateMates();
  } else if (mode === 'friend' || mode === 'online') {
    movePlayer(p2, input(1), dt);
  }
  else updateBot(dt);
  aim(p1);
  aim(p2);
  if (p3) aim(p3);
  if (p4) aim(p4);
  // Orbit mengambil alih lintasan bola sementara; lawan masih dapat mematahkan orbit dengan menyentuhnya.
  const orbiting = window.Skills?.updateBallSkill?.() ?? false;
  if (!orbiting) updateBall(dt);
  if (goalTimer > 0) return;
  if (!orbiting) {
    hit(p1, 0);
    hit(p2, 1);
    if (p3) hit(p3, 2);
    if (p4) hit(p4, 3);
  }
  if (lastTouch >= 0) stats.poss[lastTouch]++;
  window.MStats?.tick();
  if (!orbiting) window.Skills?.collideBall(ball);
  window.Skills?.update();

  // Bola diam terlalu lama di dekat tepi: dorong pelan ke tengah.
  if (Math.hypot(ball.vx, ball.vy) < 0.6) {
    restT += sec;
    if (
      restT > 2.2 &&
      (ball.x < LX + 55 || ball.x > W - LX - 55 || ball.y < LY + 55 || ball.y > H - LY - 55)
    ) {
      const dx = W / 2 - ball.x,
        dy = H / 2 - ball.y,
        l = Math.hypot(dx, dy) || 1;
      ball.vx = (dx / l) * 4;
      ball.vy = (dy / l) * 4;
      restT = 0;
    }
  } else restT = 0;
}

// ---------- Online (guest): simulasi lokal + koreksi halus ----------
function snapPrev() {
  if (!p1 || !p2 || !ball) return;
  prevR.p1 = { x: p1.x, y: p1.y };
  prevR.p2 = { x: p2.x, y: p2.y };
  prevR.p3 = p3 ? { x: p3.x, y: p3.y } : null;
  prevR.p4 = p4 ? { x: p4.x, y: p4.y } : null;
  prevR.ball = { x: ball.x, y: ball.y };
}

// Tiap langkah: tarik entitas ke target host yang diproyeksikan ke "sekarang"
// (umur paket + setengah RTT). Target selalu dihitung ulang -> tidak ada gigi gergaji.
function blend(e, t, g, big, vel) {
  const dx = t.x - e.x,
    dy = t.y - e.y;
  if (Math.hypot(dx, dy) > big) {
    e.x = t.x;
    e.y = t.y;
    e.vx = t.vx;
    e.vy = t.vy;
    return;
  }
  e.x += dx * g;
  e.y += dy * g;
  if (vel) {
    e.vx += (t.vx - e.vx) * g;
    e.vy += (t.vy - e.vy) * g;
  }
}
function follow() {
  const n = net.pk;
  if (!n) return;
  const f = Math.min(lagFrames() + (performance.now() - net.at) / 16.667, 40);
  blend(p1, projectPlayer(n.p1, f, p1), 0.25, 100, true);
  if (!window.Skills?.guestHold?.()) blend(p2, projectPlayer(n.p2, f, p2), 0.05, 140, false); // pemain sendiri: prediksi lokal didahulukan (ditahan saat Melesat)
  blend(ball, projectBall(n.b, f, ball.r), net.touchT > 0 ? 0.08 : 0.22, 90, true);
  limit(p1);
  limit(p2);
  window.Skills?.collidePlayer(p1);
  window.Skills?.collidePlayer(p2);
  separate();
}

// Setelah koreksi jaringan, bola tidak boleh terlihat menembus pemain/tembok (hanya posisi, kecepatan tidak diubah).
function separate() {
  for (const p of [p1, p2]) {
    const dx = ball.x - p.x,
      dy = ball.y - p.y,
      d = Math.hypot(dx, dy),
      min = p.r + ball.r;
    if (d >= min) continue;
    const nx = d > 0.001 ? dx / d : p === p1 ? 1 : -1,
      ny = d > 0.001 ? dy / d : 0;
    ball.x = p.x + nx * min;
    ball.y = p.y + ny * min;
  }
  window.Skills?.pushOut?.(ball);
  ball.y = clamp(ball.y, LY + ball.r, H - LY - ball.r);
  const sd = ball.x < W / 2 ? 0 : 1;
  if (!(ball.y > goalTop(sd) && ball.y < goalBot(sd))) ball.x = clamp(ball.x, LX + ball.r, W - LX - ball.r);
}

function guestStep() {
  shake *= 0.9;
  if (shake < 0.2) shake = 0;
  ball.pop = Math.max(0, ball.pop - 0.1);
  p1.kick = Math.max(0, p1.kick - 0.08);
  p2.kick = Math.max(0, p2.kick - 0.08);
  parts.forEach((q) => {
    q.x += q.vx;
    q.y += q.vy;
    q.vy += q.g;
    q.life -= q.d;
    if (q.vr) q.rot += q.vr;
  });
  parts = parts.filter((q) => q.life > 0);
  window.Skills?.tickFx();
  if (over) return;
  net.since++;
  if (net.touchT > 0) net.touchT--;

  // Jam (kickoff/goalTimer/elapsed) dijalankan online.js; di sini hanya mengikuti.
  if (goalTimer > 0) {
    netBall();
    return;
  }
  if (kickoff > 0) {
    const n = Math.ceil(kickoff / 0.8);
    if (n > 0 && n < lastCount) {
      lastCount = n;
      tone(660, 0.09, 0.04);
    }
    net.kick = 1;
    return;
  }
  if (net.kick) {
    net.kick = 0;
    whistle(false);
    say('Pertandingan berlangsung');
  }

  // P2 = pemain kita: bergerak langsung dari input (tanpa menunggu host).
  movePlayer(p2, readLocalMovement(), 1);
  // P1 = pemain host: diteruskan dengan kecepatan terakhir, diredam bila state host terlambat.
  const ox = p1.x,
    oy = p1.y,
    damp = net.since > 24 ? 0.9 : 1;
  p1.x += p1.vx;
  p1.y += p1.vy;
  limit(p1);
  window.Skills?.collidePlayer(p1);
  p1.vx = (p1.x - ox) * damp;
  p1.vy = (p1.y - oy) * damp;

  // Fisika bola yang sama dengan host -> tidak tembus pemain/tembok/tiang dan tendangan terasa langsung.
  const orbiting = window.Skills?.updateBallSkill?.() ?? false;
  if (!orbiting) {
    updateBall(1);
    hit(p1, 0);
    hit(p2, 1);
    // Tendangan lokal: beri waktu host (sekitar 1 RTT) menyusul sebelum bola ditarik kembali.
    if (p2.touching) net.touchT = Math.ceil(lagFrames() * 2) + 4;
    window.Skills?.collideBall(ball);
  }
  window.Skills?.guestUpdate();
  follow();
}

// Proyeksi posisi bola dari host ke "sekarang" (menambah setengah RTT), dengan pantulan dinding.
function projectBall(a, f, r) {
  let x = a[0],
    y = a[1],
    vx = a[2],
    vy = a[3];
  for (let n = f; n > 0; n -= 1) {
    const k = Math.min(1, n);
    x += vx * k;
    y += vy * k;
    const fr = Math.pow(FRIC, k);
    vx *= fr;
    vy *= fr;
    if (y < LY + r) {
      y = LY + r;
      vy = Math.abs(vy) * 0.9;
    } else if (y > H - LY - r) {
      y = H - LY - r;
      vy = -Math.abs(vy) * 0.9;
    }
    if (x < LX + r && !(y > goalTop(0) && y < goalBot(0))) {
      x = LX + r;
      vx = Math.abs(vx) * 0.88;
    } else if (x > W - LX - r && !(y > goalTop(1) && y < goalBot(1))) {
      x = W - LX - r;
      vx = -Math.abs(vx) * 0.88;
    }
  }
  return { x, y, vx, vy };
}
function projectPlayer(a, f, e) {
  const o = { x: a[0] + a[2] * f, y: a[1] + a[3] * f, side: e.side, r: e.r };
  limit(o);
  return { x: o.x, y: o.y, vx: a[2], vy: a[3] };
}
// render.js — gambar lapangan/pemain/bola, papan skor (HUD), canvas, dan game loop
('use strict');

// ---------- Gambar ----------
function drawGoal(x, toRight) {
  const sd = toRight ? 1 : 0,
    gt = goalTop(sd),
    gb = goalBot(sd),
    x0 = toRight ? x : x - NET,
    h = gb - gt;
  ctx.fillStyle = 'rgba(8,16,30,.35)';
  ctx.fillRect(x0, gt, NET, h);
  ctx.strokeStyle = 'rgba(255,255,255,.2)';
  ctx.lineWidth = 1;
  for (let y = gt + 15; y < gb; y += 15) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + NET, y);
    ctx.stroke();
  }
  for (let xx = x0 + 8; xx < x0 + NET; xx += 8) {
    ctx.beginPath();
    ctx.moveTo(xx, gt);
    ctx.lineTo(xx, gb);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.92)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x0, gt, NET, h);
  if (goalTimer > 0 && (lastScorer === 0) === toRight) {
    ctx.fillStyle = `rgba(255,236,150,${0.3 + 0.2 * Math.sin(goalTimer * 24)})`;
    ctx.fillRect(x0, gt, NET, h);
  }
}

function drawPitch() {
  ctx.fillStyle = FC[2];
  ctx.fillRect(-12, -12, W + 24, H + 24);
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 ? FC[1] : FC[0];
    ctx.fillRect((i * W) / 10, 0, W / 10, H);
  }

  ctx.strokeStyle = 'rgba(243,240,231,.92)';
  ctx.fillStyle = 'rgba(243,240,231,.92)';
  ctx.lineWidth = 3;
  ctx.strokeRect(LX, LY, W - 2 * LX, H - 2 * LY);
  ctx.beginPath();
  ctx.moveTo(W / 2, LY);
  ctx.lineTo(W / 2, H - LY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 76, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeRect(LX, 155, 105, 250);
  ctx.strokeRect(W - LX - 105, 155, 105, 250);
  ctx.strokeRect(LX, 220, 43, 120);
  ctx.strokeRect(W - LX - 43, 220, 43, 120);
  // Titik penalti dan busur sudut
  for (const x of [LX + 78, W - LX - 78]) {
    ctx.beginPath();
    ctx.arc(x, H / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  [
    [LX, LY, 0, Math.PI / 2],
    [W - LX, LY, Math.PI / 2, Math.PI],
    [W - LX, H - LY, Math.PI, Math.PI * 1.5],
    [LX, H - LY, Math.PI * 1.5, Math.PI * 2],
  ].forEach(([x, y, a, b]) => {
    ctx.beginPath();
    ctx.arc(x, y, 14, a, b);
    ctx.stroke();
  });
  drawGoal(LX, false);
  drawGoal(W - LX, true);
  ctx.fillStyle = '#ffffff';
  for (const sd of [0, 1])
    for (const y of [goalTop(sd), goalBot(sd)]) {
      ctx.beginPath();
      ctx.arc(sd ? W - LX : LX, y, POST, 0, Math.PI * 2);
      ctx.fill();
    }
}

// Pemain: lingkaran polos (tanpa wajah, arah, nomor, atau penanda lain).
function drawPlayer(p, n, label) {
  ctx.fillStyle = n === 1 ? '#3286F6' : '#EF5354';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#F3F0E7';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r - 1.2, 0, Math.PI * 2);
  ctx.stroke();
  if (label) {
    // Mode VS 2 BOT: penanda "1" / "2" agar dua pemain Biru mudah dibedakan
    ctx.fillStyle = '#F3F0E7';
    ctx.font = "800 " + Math.round(p.r * 0.95) + "px system-ui, sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y + 1);
  }
}

function drawBall(drawState = ball) {
  trail.forEach((t, i) => {
    ctx.globalAlpha = Math.max(0, t.life * 0.2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(t.x, t.y, drawState.r * (0.45 + i / 20), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  const R = drawState.r * (1 + 0.3 * drawState.pop);
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.ellipse(drawState.x + 2, drawState.y + R * 0.8 + 2, R * 0.9, R * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(drawState.x, drawState.y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#101B25';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Satu bintik kecil yang berputar agar gerak guling bola terlihat.
  ctx.fillStyle = '#101B25';
  ctx.beginPath();
  ctx.arc(
    drawState.x + Math.cos(drawState.spin) * R * 0.45,
    drawState.y + Math.sin(drawState.spin) * R * 0.45,
    R * 0.2,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function drawParts() {
  parts.forEach((p) => {
    ctx.globalAlpha = clamp(p.life * 1.5, 0, 1);
    ctx.fillStyle = p.c;
    if (p.rot !== undefined) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    } else ctx.fillRect(p.x, p.y, p.s, p.s);
  });
  ctx.globalAlpha = 1;
}

function drawOverlays() {
  if (kickoff > 0 && !paused && goalTimer <= 0) {
    const q = kickoff / 0.8,
      n = Math.ceil(q),
      fr = q - (n - 1);
    ctx.fillStyle = 'rgba(16,27,37,.6)';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.4 + 0.6 * fr;
    ctx.fillStyle = '#FFD166';
    ctx.font = `${60 + 36 * fr}px Impact, 'Arial Black', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), W / 2, H / 2 + 3);
    ctx.globalAlpha = 1;
  }
  if (paused) {
    ctx.fillStyle = 'rgba(16,27,37,.85)';
    ctx.fillRect(-12, -12, W + 24, H + 24);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "46px Impact, 'Arial Black', sans-serif";
    ctx.fillText('DIJEDA', W / 2, H / 2 - 18);
    ctx.fillStyle = '#F3F0E7';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText('Tekan ▶ atau P untuk kembali bermain', W / 2, H / 2 + 27);
  }
}

// Papan skor berupa elemen HTML (presentasi saja); nilai diambil dari state game.
const hud = {
  b: $('scoreBlue'),
  o: $('scoreOrange'),
  t: $('timer'),
  n: $('nameRed'),
  l: $('nameBlue'),
},
  hudLast = {};
function hudSet(k, v) {
  if (hudLast[k] === v) return;
  const first = hudLast[k] === undefined;
  hudLast[k] = v;
  hud[k].textContent = v;
  if (!first && (k === 'b' || k === 'o') && v !== '0') {
    hud[k].classList.remove('pop');
    void hud[k].offsetWidth;
    hud[k].classList.add('pop');
  }
}
function drawHUD() {
  hudSet('b', String(score[0]));
  hudSet('o', String(score[1]));
  hudSet('t', TL ? fmt(Math.ceil(Math.max(0, TL - elapsed))) : fmt(elapsed));
  hudSet('l', tag(0));
  hudSet('n', tag(1));
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawHUD();
  ctx.save();
  ctx.translate(0, HUD);
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  const visual = getOnlineRenderEntities();
  drawPitch();
  window.Skills?.drawBack();
  drawPlayer(visual.p1, 1, isDuo() && HUMANS.length > 1 ? '1' : '');
  const humanMark = (n) => (isDuo() && HUMANS.length > 1 && HUMANS.includes(n) ? String(HUMANS.indexOf(n) + 1) : '');
  drawPlayer(visual.p2, 2, humanMark(1));
  if (visual.p3) drawPlayer(visual.p3, 1, humanMark(2));
  if (visual.p4) drawPlayer(visual.p4, 2, humanMark(3));
  drawBall(visual.ball);
  window.Skills?.drawFront();
  drawParts();
  drawOverlays();
  window.Skills?.drawDarkOverlay?.();
  ctx.restore();
}

// Canvas tajam di layar retina / ukuran apa pun
function fit() {
  const w = canvas.clientWidth;
  if (!w) return;
  scale = clamp((w * (window.devicePixelRatio || 1)) / W, 0.6, 3);
  const cw = Math.round(W * scale),
    ch = Math.round((H + HUD) * scale);
  if (canvas.width !== cw) {
    canvas.width = cw;
    canvas.height = ch;
  }
}
new ResizeObserver(fit).observe(canvas);

function loop(now) {
  raf = requestAnimationFrame(loop);
  if (!lastFrame) lastFrame = now;
  acc = Math.min(acc + (now - lastFrame) / 16.667, 5);
  lastFrame = now;
  while (acc >= 1) {
    step();
    acc -= 1;
  }
  if (gameActive) render();
  if (mode === 'online' && gameActive) {
    window.MSOnline?.tick(now);
  }
}

// Hemat baterai: hentikan loop & jeda otomatis saat tab tidak aktif
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
    if (gameActive && !over && !paused) {
      if (mode === 'online' && !window.MSOnline?.isHost) {
        window.MSOnline?.requestPause();
      } else {
        setPaused(true);
      }
    }
    if (AC && AC.suspend) AC.suspend();
  } else {
    if (AC && AC.resume) AC.resume();
    if (!raf) {
      lastFrame = 0;
      raf = requestAnimationFrame(loop);
    }
  }
  syncAudio();
});

// league.js — mode Liga: 10 klub, round-robin 9 matchday, klasemen, hadiah poin
('use strict');
const LG_WIN = 3,
  LG_DRAW = 1,
  LG_REWARD = { 1: 200, 2: 100 },
  LG_KEY = 'ms_league',
  LG_VER = 1;
// b = kekuatan Bot (%) memakai pengaturan "Kekuatan Bot" yang sudah ada; r = bintang
const TEAMS = [
  { n: 'MyClub FC', s: 'YOU', b: 100 },
  { n: 'Bintang Timur FC', s: 'BINTANG', b: 110, r: 5, d: 'Klub terkuat di liga' },
  { n: 'Naga Selatan FC', s: 'NAGA', b: 104, r: 4, d: 'Pertahanan kuat dan disiplin' },
  { n: 'Elang Perkasa', s: 'ELANG', b: 100, r: 3, d: 'Menyerang cepat dan berbahaya' },
  { n: 'Garuda Muda', s: 'GARUDA', b: 97, r: 3, d: 'Tim seimbang dan solid' },
  { n: 'Rimba Jaya', s: 'RIMBA', b: 94, r: 2, d: 'Rapat di belakang, serangan biasa' },
  { n: 'Samudra FC', s: 'SAMUDRA', b: 92, r: 2, d: 'Mengandalkan permainan sabar' },
  { n: 'Cakra Dwipa', s: 'CAKRA', b: 90, r: 2, d: 'Serangan lumayan, belakang standar' },
  { n: 'Macan Putih', s: 'MACAN', b: 88, r: 1, d: 'Tim berkembang' },
  { n: 'Pelita Nusa', s: 'PELITA', b: 85, r: 1, d: 'Klub yang masih belajar' },
];
let lg = null,
  lgOpIdx = 0;
const emptySt = () => ({ p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
function mkFixtures() {
  // round-robin tunggal: 9 matchday, tiap klub bertemu semua klub sekali
  const o = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = o.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [o[i], o[j]] = [o[j], o[i]];
  }
  let a = [0, ...o];
  const rs = [];
  for (let r = 0; r < 9; r++) {
    const pr = [];
    for (let i = 0; i < 5; i++) pr.push([a[i], a[9 - i]]);
    rs.push(pr);
    a = [a[0], a[9], ...a.slice(1, 9)];
  }
  return rs;
}
const saveLg = () => store.set(LG_KEY, lg);
function newSeason(keep) {
  lg = {
    v: LG_VER,
    season: keep ? keep.season + 1 : 1,
    round: 0,
    st: TEAMS.map(emptySt),
    fx: mkFixtures(),
    last: [],
    done: false,
    pos: 0,
    reward: 0,
    titles: keep ? keep.titles : 0,
  };
  saveLg();
}
function loadLg() {
  const s = store.get(LG_KEY, null);
  if (
    s &&
    s.v === LG_VER &&
    Array.isArray(s.st) &&
    s.st.length === 10 &&
    Array.isArray(s.fx) &&
    s.fx.length === 9 &&
    Number.isInteger(s.round)
  ) {
    lg = s;
    lg.titles |= 0;
    lg.last = lg.last || [];
    return;
  }
  newSeason(
    s ? { season: Math.max(0, +s.season || 0), titles: Math.max(0, +s.titles || 0) } : null,
  );
}
const lgSorted = () =>
  lg.st
    .map((s, i) => ({ i, ...s }))
    .sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.i - b.i);
function pois(l) {
  const L = Math.exp(-l);
  let k = 0,
    p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}
function simMatch(a, b) {
  // laga antar-AI: kekuatan memengaruhi peluang, faktor acak tetap dominan
  const e = (TEAMS[a].b - TEAMS[b].b) * 0.012,
    cap = 5;
  return [
    Math.min(cap, pois(clamp(2.2 + e, 1.5, 2.95))),
    Math.min(cap, pois(clamp(2.2 - e, 1.5, 2.95))),
  ];
}
function addRes(i, gf, ga) {
  const s = lg.st[i];
  s.p++;
  s.gf += gf;
  s.ga += ga;
  if (gf > ga) {
    s.w++;
    s.pts += LG_WIN;
  } else if (gf === ga) {
    s.d++;
    s.pts += LG_DRAW;
  } else s.l++;
}
// Dipanggil sekali per laga liga (saat pertandingan selesai). Mengembalikan teks ringkasan.
function leagueResult(reason) {
  const o = lgOpIdx,
    a = score[0],
    b = score[1],
    rd = lg.round;
  addRes(0, a, b);
  addRes(o, b, a);
  const last = [{ h: 0, a: o, hs: a, as: b }];
  for (const [x, y] of lg.fx[rd]) {
    if (x === 0 || y === 0) continue;
    const [gx, gy] = simMatch(x, y);
    addRes(x, gx, gy);
    addRes(y, gy, gx);
    last.push({ h: x, a: y, hs: gx, as: gy });
  }
  lg.last = last;
  lg.round++;
  const pos = lgSorted().findIndex((t) => t.i === 0) + 1;
  let note = '';
  if (lg.round >= lg.fx.length) {
    lg.done = true;
    lg.pos = pos;
    lg.reward = LG_REWARD[pos] || 0;
    if (lg.reward) {
      points += lg.reward;
      store.set('ms_pts', points);
    }
    if (pos === 1) lg.titles++;
    note = ` · MUSIM SELESAI${pos === 1 ? ' (JUARA!)' : ''}${lg.reward ? ' · +' + lg.reward + ' POIN' : ''}`;
  }
  saveLg();
  const d = a - b;
  return `MATCHDAY ${rd + 1}/9${reason === 'forfeit' ? ' (MENYERAH)' : ''} · +${d > 0 ? LG_WIN : d === 0 ? LG_DRAW : 0} POIN LIGA · POSISI ${pos}/10${note}`;
}
function renderLeague() {
  const tb = lgSorted(),
    done = lg.done;
  $('lgTitle').textContent = `LIGA · MUSIM ${lg.season}`;
  $('lgSub').textContent =
    `${done ? 'Selesai' : 'Matchday ' + (lg.round + 1) + '/9'} · Juara ${lg.titles}×`;
  $('lgInfo').textContent = done
    ? `Peringkat akhir: ${lg.pos}${lg.reward ? ' · +' + lg.reward + ' poin' : ''}`
    : `Juara +${LG_REWARD[1]} poin · Peringkat 2 +${LG_REWARD[2]} poin · Menang ${LG_WIN}, seri ${LG_DRAW}`;
  let h =
    '<tr><th>#</th><th class="tn">Tim</th><th>Main</th><th>M</th><th>S</th><th>K</th><th>GM</th><th>GK</th><th>SG</th><th>Poin</th></tr>';
  tb.forEach((t, r) => {
    const sd = t.gf - t.ga;
    h += `<tr class="${t.i === 0 ? 'me ' : ''}${r === 0 ? 'z1' : r === 1 ? 'z2' : ''}"><td>${r + 1}</td><td class="tn">${TEAMS[t.i].n}</td><td>${t.p}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf}</td><td>${t.ga}</td><td>${sd > 0 ? '+' : ''}${sd}</td><td class="pt">${t.pts}</td></tr>`;
  });
  $('lgTable').innerHTML = h;
  const nx = $('lgNext');
  if (done)
    nx.innerHTML = `<h3 class="grp">Musim ${lg.season} selesai</h3><button class="btn btn-primary big" id="lgNew" type="button">MUSIM BARU</button>`;
  else {
    const pr = lg.fx[lg.round].find((p) => p.includes(0)),
      o = pr[0] === 0 ? pr[1] : pr[0],
      T = TEAMS[o];
    nx.innerHTML =
      `<h3 class="grp">Laga berikutnya</h3><div class="vs"><b class="b">${TEAMS[0].n}</b><span>VS</span><b class="r">${T.n}</b></div>` +
      `<p class="lg-d">${'★'.repeat(T.r)}${'☆'.repeat(5 - T.r)} · ${T.d}</p><button class="btn btn-primary big" id="lgPlay" type="button">MAIN</button>`;
  }
  $('lgLast').innerHTML = lg.last.length
    ? lg.last
      .map(
        (m) =>
          `<div class="rr${m.h === 0 || m.a === 0 ? ' me' : ''}"><span>${TEAMS[m.h].n}</span><b>${m.hs} - ${m.as}</b><span>${TEAMS[m.a].n}</span></div>`,
      )
      .join('')
    : '<p class="lg-d">Belum ada laga</p>';
}
function openLeague() {
  if (!lg) loadLg();
  $('startScreen').hidden = true;
  gameShell.hidden = true;
  $('leagueScreen').hidden = false;
  renderLeague();
}
function startLeagueMatch() {
  if (!lg || lg.done) return;
  const pr = lg.fx[lg.round].find((p) => p.includes(0));
  lgOpIdx = pr[0] === 0 ? pr[1] : pr[0];
  const T = TEAMS[lgOpIdx];
  $('leagueScreen').hidden = true;
  startGame(
    'bot',
    false,
    Object.assign({}, DEF, { win: 5, time: 3, bot: T.b, n1: 'YOU', n2: T.s }),
  );
}
$('leagueModeBtn').addEventListener('click', openLeague);
$('lgBack').addEventListener('click', () => {
  $('leagueScreen').hidden = true;
  $('startScreen').hidden = false;
  renderMenu();
});
$('lgNext').addEventListener('click', (e) => {
  if (e.target.closest('#lgPlay')) startLeagueMatch();
  else if (e.target.closest('#lgNew')) {
    newSeason(lg);
    renderLeague();
  }
});

// ui.js — kontrol, menu, mode custom, layar penuh, dan inisialisasi
('use strict');

// ---------- Kontrol ----------
const MOVE = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']);
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (MOVE.has(k) && gameActive) {
    // WASD dan arrow sama-sama menjadi kontrol pemain saat melawan Bot.
    e.preventDefault();
    keys[k] = true;
  }
  if (k === 'p' && !e.repeat) togglePause();
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (MOVE.has(k)) keys[k] = false;
});
window.addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

// Joystick analog virtual (pointer events, dua pemain bisa sekaligus)
document.querySelectorAll('.stick').forEach((el) => {
  const n = +el.dataset.p,
    knob = el.firstElementChild;
  const set = (x, y) => {
    joy[n].x = x;
    joy[n].y = y;
    knob.style.transform = `translate(${x * el.offsetWidth * 0.3}px,${y * el.offsetWidth * 0.3}px)`;
  };
  const move = (e) => {
    const r = el.getBoundingClientRect(),
      R = r.width * 0.3;
    let x = (e.clientX - r.left - r.width / 2) / R,
      y = (e.clientY - r.top - r.height / 2) / R;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    set(x, y);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    move(e);
  });
  el.addEventListener('pointermove', (e) => {
    if (el.hasPointerCapture(e.pointerId)) move(e);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) =>
    el.addEventListener(t, () => set(0, 0)),
  );
  el.addEventListener('contextmenu', (e) => e.preventDefault());
});

// ---------- Menu & UI ----------
function renderMenu() {
  $('pts').textContent = `${points} POIN`;
  const items = matches
    .map(
      (h) =>
        `<li><span>${h.l ? 'Liga' : h.c ? 'Custom' : h.m === 'bot' ? 'Lawan Bot' : h.m === 'duo' ? '2 vs 2 Bot' : '2 Pemain'} · <b>${h.a}–${h.b}</b></span>` +
        `<span>${fmt(h.d)} · ${new Date(h.t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span></li>`,
    )
    .join('');
  $('historyBox').innerHTML =
    `<div>Rekor vs Bot: <b>${record.w}</b> menang · <b>${record.l}</b> kalah` +
    `${record.fast != null ? ` · kemenangan tercepat <b>${fmt(record.fast)}</b>` : ''}</div>` +
    (items
      ? `<ul>${items}</ul><button class="linkbtn" id="clearHist" type="button">Hapus riwayat</button>`
      : '<div style="margin-top:6px">Belum ada pertandingan.</div>');
  const c = $('clearHist');
  if (c)
    c.onclick = () => {
      matches = [];
      record = { w: 0, l: 0, fast: null };
      store.set('ms_hist', matches);
      store.set('ms_rec', record);
      renderMenu();
    };
  $('botModeBtn').classList.toggle('last', cfg.mode === 'bot');
  $('friendModeBtn').classList.toggle('last', cfg.mode === 'friend');
  $('duoModeBtn').classList.toggle('last', cfg.mode === 'duo');
  $('customModeBtn').classList.toggle('last', cfg.mode === 'custom');
  $('leagueModeBtn').classList.toggle('last', cfg.mode === 'league');
}


function configure() {
  const bot = mode === 'bot';
  const online = mode === 'online';

  const K = (a) => a.map((k) => `<kbd>${k}</kbd>`).join('');

  const skOn = !!window.SkillCfg && window.SkillCfg.on && window.SkillCfg.pool.length > 0;

  if (bot) {
    $('controlsInfo').innerHTML =
      `<span>${K(['W', 'A', 'S', 'D'])} / ${K(['↑', '←', '↓', '→'])} — Move</span>` +
      (skOn ? `<span>${K(['SPACE'])} — Skill</span>` : '');

  } else if (online) {
    $('controlsInfo').innerHTML =
      `<span>${K(['W', 'A', 'S', 'D'])} — Your Player</span>` +
      (skOn ? `<span>${K(['SPACE'])} — Skill</span>` : '');

  } else {
    $('controlsInfo').innerHTML =
      `<span><i class="b"></i>${K(['W', 'A', 'S', 'D'])}${skOn ? ' ' + K(['SPACE']) : ''} — Player 1</span>
       <span><i class="o"></i>${K(['↑', '←', '↓', '→'])}${skOn ? ' ' + K(['ENTER']) : ''} — Player 2</span>`;
  }

  $('mobileControls').classList.toggle('bot-mode', bot || (mode === 'duo' && HUMANS.length === 1));
  $('mobileControls').classList.toggle('online-mode', online);

  if (mode === 'duo') {
    const cls = (n) => (n & 1 ? 'o' : 'b');
    if (HUMANS.length === 1) {
      $('controlsInfo').innerHTML =
        `<span>${K(['W', 'A', 'S', 'D'])} / ${K(['↑', '←', '↓', '→'])} — Move</span>` + (skOn ? `<span>${K(['SPACE'])} — Skill</span>` : '');
    } else {
      $('controlsInfo').innerHTML =
        `<span><i class="${cls(HUMANS[0])}"></i>${K(['W', 'A', 'S', 'D'])}${skOn ? ' ' + K(['SPACE']) : ''} — Player 1</span>
         <span><i class="${cls(HUMANS[1])}"></i>${K(['↑', '←', '↓', '→'])}${skOn ? ' ' + K(['ENTER']) : ''} — Player 2</span>`;
    }
  }
  // Judul pad sentuh mengikuti tim pemain kedua
  const padHead = (i) => $('mobileControls').querySelector(`[data-player="${i}"] .pad-heading`);
  if (!online && padHead(0) && padHead(1)) {
    const second = mode === 'duo' ? HUMANS[1] : 1;
    padHead(0).textContent = 'P1 · BIRU';
    padHead(0).style.color = 'var(--blue)';
    padHead(1).textContent = second & 1 ? 'P2 · MERAH' : 'P2 · BIRU';
    padHead(1).style.color = second & 1 ? 'var(--red)' : 'var(--blue)';
  }

  if (online) {
    const pad = $('mobileControls').querySelector(
      '[data-player="0"] .pad-heading'
    );

    if (pad) {
      pad.textContent = window.MSOnline?.isHost
        ? 'KAMU · BIRU'
        : 'KAMU · MERAH';
    }
  }
}


function startGame(m, custom = false, lgCfg = null) {
  mode = m;
  if (m === 'bot') setRoles(['WA', 'B', '', '']);
  else if (m === 'friend') setRoles(['W', 'A', '', '']);
  else if (m === 'duo') setRoles(custom ? rolesFrom(TEAM_L[CS.team1] || ['H'], TEAM_R[CS.team2] || ['B']) : ['W', 'B', 'A', 'B']);
  isCustom = custom;
  lgMatch = !!lgCfg;
  cfg.mode = lgCfg ? 'league' : custom ? 'custom' : m;
  applySettings(lgCfg || (custom ? CS : m === 'duo' ? DUO_CFG : DEF));
  $('newMatchBtn').disabled = lgMatch;
  store.set('ms_cfg', cfg);
  configure();
  gameActive = true;
  $('audioSlotGame').appendChild($('audio'));
  $('startScreen').hidden = true;
  gameShell.hidden = false;
  site.classList.add('playing');
  fit();
  resetMatch();
  say(m === 'bot' ? 'Kamu vs Bot · Bersiap...' : m === 'duo' ? `${tag(0)} vs ${tag(1)} · Bersiap...` : 'Friend mode · Bersiap...');
}


function startOnlineMatch({
  hostName,
  guestName,
  isHost,
  restoreState = null
}) {
  mode = 'online';
  isCustom = false;
  lgMatch = false;

  cfg.mode = 'online';
  store.set('ms_cfg', cfg);

  applySettings({
    ...DEF,
    n1: hostName,
    n2: guestName
  });

  $('newMatchBtn').disabled = false; // online: ulang pertandingan (2 klik)

  configure();

  gameActive = true;

  $('audioSlotGame').appendChild($('audio'));

  $('startScreen').hidden = true;
  $('onlineScreen').hidden = true;
  gameShell.hidden = false;

  site.classList.add('playing');

  fit();
  resetMatch();
  net.pk = null;
  net.since = 0;

  if (restoreState) {
    applyOnlineState(restoreState);
    setPaused(true);
    say('Terhubung kembali. Menunggu lawan...');
  } else if (!isHost) {
    setPaused(true);
    say('Menunggu sinkronisasi pertandingan...');
  } else {
    say('Pertandingan online dimulai!');
  }
}


// Kondisi lengkap: dipakai untuk snapshot (resume host) dan hasil akhir.
function getOnlineState() {
  return JSON.parse(JSON.stringify({
    p1, p2, ball, score, stats, elapsed, kickoff, lastCount, goalTimer, lastScorer,
    shake, restT, lastTouch, paused, over,
    k: window.Skills?.getSync?.() || null,
  }));
}

// Kondisi ringkas yang dikirim host saat pertandingan berjalan (hemat bandwidth).
function getNetState() {
  const e = (o) => [r1(o.x), r1(o.y), r2(o.vx), r2(o.vy)];
  return {
    p1: e(p1), p2: e(p2), b: e(ball),
    sc: [score[0], score[1]],
    el: r2(elapsed), ko: r2(kickoff), gt: r2(goalTimer), ls: lastScorer,
    pa: paused ? 1 : 0, ov: over ? 1 : 0,
    k: window.Skills?.getSyncNet?.() || 0, // hemat: skill hanya dikirim saat perlu
  };
}

// Posisi p2 dari guest (sudah diproyeksikan ke waktu tiba). Host hanya menerima jika wajar.
function nudgeRemote(x, y) {
  if (!p2 || over || paused || kickoff > 0 || goalTimer > 0) return;
  if ((window.Skills?.speedMul(p2) ?? 1) <= 0) return;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (Math.hypot(x - p2.x, y - p2.y) > 140) return;
  // Ikuti posisi guest secara halus (bukan loncat) agar kecepatan p2 tidak melonjak.
  p2.x += (x - p2.x) * 0.4;
  p2.y += (y - p2.y) * 0.4;
  limit(p2);
  window.Skills?.collidePlayer(p2);
}

// Guest: menerima state host. Tidak ada buffer; posisi dikoreksi pelan oleh guestStep().
function applyNetState(n, q) {
  if (!n || mode !== 'online' || !p1) return;
  // Hilangkan jitter: umur paket dihitung dari waktu kirim host (q), bukan dari waktu tiba.
  // Selisih jam (skew) saling menghilang karena yang dipakai hanya selisih terhadap paket tercepat.
  let qd = 0;
  if (q) {
    const d = Date.now() - q;
    if (net.dmin === null || d < net.dmin || d - net.dmin > 3000) net.dmin = d;
    else net.dmin += (d - net.dmin) * 0.005;
    qd = clamp(d - net.dmin, 0, 200);
  }
  net.qd = qd;
  const oldScore = [...score],
    oldGT = goalTimer,
    oldKick = kickoff;
  score = [n.sc[0], n.sc[1]];
  // Nilai host sudah "basi" sebesar setengah RTT: kompensasi agar guest mulai/berhenti bersamaan dengan host.
  const lag = clamp(net.rtt / 2, 0, 220) / 1000;
  elapsed = n.el + (n.ko > 0 || n.gt > 0 || n.pa || n.ov ? 0 : lag);
  kickoff = n.ko > 0 ? Math.max(0, n.ko - lag) : 0;
  goalTimer = n.gt > 0 ? Math.max(0, n.gt - lag) : 0;
  lastScorer = n.ls;
  paused = !!n.pa;
  over = !!n.ov;
  if (kickoff > oldKick + 0.5) lastCount = 4;

  const snap = n.ko > 0 || n.pa || n.ov || (n.gt > 0 && !(oldGT > 0));
  if (snap || n.gt > 0) {
    // Kondisi khusus (kick-off/jeda/gol): langsung ikut host, tanpa koreksi.
    net.pk = null;
    for (const [e, a] of [[p1, n.p1], [p2, n.p2], [ball, n.b]]) {
      e.x = a[0];
      e.y = a[1];
      e.vx = a[2];
      e.vy = a[3];
    }
  } else {
    net.pk = n;
    net.at = performance.now() - qd;
  }
  net.since = 0;

  const scoreChanged = score[0] > oldScore[0] || score[1] > oldScore[1];
  if (scoreChanged && goalTimer > 0) goalFx(score[0] > oldScore[0] ? 0 : 1);
  if (goalTimer <= 0 && (oldGT > 0 || scoreChanged || !$('goalCelebration').hidden)) endCelebrate();

  window.Skills?.applySync(n.k);
  pauseLabel(paused);
  syncAudio();
}

// Interpolasi render antar langkah simulasi: mulus di layar 60/90/120/144 Hz tanpa menambah beban jaringan.
function lerpE(e, pv, a) {
  if (!pv) return e;
  const dx = e.x - pv.x,
    dy = e.y - pv.y;
  if ((dx === 0 && dy === 0) || dx * dx + dy * dy > 3600) return e; // diam / teleport
  return Object.assign({}, e, { x: pv.x + dx * a, y: pv.y + dy * a });
}
function getOnlineRenderEntities() {
  if (!gameActive || paused || !p1 || !p2 || !ball) return { p1, p2, p3, p4, ball };
  const a = clamp(acc, 0, 1);
  return {
    p1: lerpE(p1, prevR.p1, a),
    p2: lerpE(p2, prevR.p2, a),
    p3: p3 ? lerpE(p3, prevR.p3, a) : null,
    p4: p4 ? lerpE(p4, prevR.p4, a) : null,
    ball: lerpE(ball, prevR.ball, a),
  };
}

// Kondisi lengkap (hasil akhir / resume host): diterapkan langsung tanpa koreksi.
function applyOnlineState(s) {
  if (!s || mode !== 'online') return;
  const oldScore = [...score],
    oldGoalTimer = goalTimer;
  p1 = Object.assign(p1 || {}, s.p1);
  p2 = Object.assign(p2 || {}, s.p2);
  ball = Object.assign(ball || {}, s.ball);
  score = [...s.score];
  stats = s.stats;
  elapsed = s.elapsed;
  kickoff = s.kickoff;
  lastCount = s.lastCount;
  goalTimer = s.goalTimer;
  lastScorer = s.lastScorer;
  shake = s.shake;
  restT = s.restT;
  lastTouch = s.lastTouch;
  net.pk = null;
  if (s.k) window.Skills?.applySync(s.k, true);

  const scoreChanged = score[0] > oldScore[0] || score[1] > oldScore[1];
  if (scoreChanged && goalTimer > 0) {
    const scorer = score[0] > oldScore[0] ? 0 : 1;
    showGoalCelebration(scorer);
    confetti(scorer);
  }
  if (goalTimer <= 0 && (oldGoalTimer > 0 || scoreChanged || !$('goalCelebration').hidden)) endCelebrate();
  paused = !!s.paused;
  over = !!s.over;
  pauseLabel(paused);
  syncAudio();
}

function backToMenu(toLg = false, fromOnline = false) {
  if (mode === 'online' && !fromOnline) {
    window.MSOnline?.leaveToMenu();
    return;
  }
  if (lgMatch && gameActive && !over && (elapsed > 3 || score[0] + score[1] > 0)) {
    if (!confirm('Keluar dari laga liga? Dihitung kalah menyerah.')) return;
    score = [0, Math.max(WINS, score[1])];
    leagueResult('forfeit');
  }
  lgMatch = false;
  $('newMatchBtn').disabled = false;
  if (gameShell.classList.contains('fs')) toggleFS();
  gameActive = false;
  paused = false;
  over = false;
  Object.keys(keys).forEach((k) => (keys[k] = false));
  joy.forEach((j) => {
    j.x = j.y = 0;
  });
  gameShell.hidden = true;
  $('startScreen').hidden = false;
  $('audioSlotMenu').appendChild($('audio'));
  site.classList.remove('playing');
  renderMenu();
  syncAudio();
  if (toLg) openLeague();
}

async function toggleFS() {
  const on = !gameShell.classList.contains('fs');
  gameShell.classList.toggle('fs', on);
  document.body.style.overflow = on ? 'hidden' : '';
  try {
    if (on) {
      await gameShell.requestFullscreen();
      await screen.orientation.lock('landscape');
    } else {
      if (document.fullscreenElement) await document.exitFullscreen();
      screen.orientation.unlock();
    }
  } catch (_) {
    /* iOS: tetap memakai layar penuh semu (CSS) */
  }
}
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && gameShell.classList.contains('fs')) {
    gameShell.classList.remove('fs');
    document.body.style.overflow = '';
  }
});

// Tombol "Match baru" meminta klik kedua jika pertandingan masih berjalan
function clearConfirm() {
  clearTimeout(confirmT);
  confirmT = 0;
  const b = $('newMatchBtn');
  b.innerHTML = IC.reset;
  b.title = 'Match baru';
  b.classList.remove('warn');
}
$('newMatchBtn').addEventListener('click', () => {
  if (mode === 'online' && over) return; // room sudah selesai: gunakan MAIN MENU
  const running = !over && (score[0] + score[1] > 0 || elapsed > 3);
  if (running && !confirmT) {
    const b = $('newMatchBtn');
    b.innerHTML = IC.check;
    b.title = 'Klik lagi untuk konfirmasi';
    b.classList.add('warn');
    confirmT = setTimeout(clearConfirm, 2500);
    return;
  }
  if (mode === 'online') {
    clearConfirm();
    window.MSOnline?.requestRestart(); // host mengulang langsung; guest meminta host
    return;
  }
  resetMatch();
});

function syncToggles() {
  $('soundBtn').innerHTML = cfg.sound ? IC.son : IC.soff;
  $('soundBtn').classList.toggle('off', !cfg.sound);
  $('musicBtn').classList.toggle('off', !cfg.music);
}
$('soundBtn').addEventListener('click', () => {
  cfg.sound = !cfg.sound;
  store.set('ms_cfg', cfg);
  syncToggles();
  syncAudio();
  if (cfg.sound) tone(520, 0.06, 0.025);
});
$('musicBtn').addEventListener('click', () => {
  cfg.music = !cfg.music;
  store.set('ms_cfg', cfg);
  syncToggles();
  syncAudio();
});

// ---------- Mode custom ----------
function applySettings(c) {
  WINS = c.win;
  TL = c.time * 60;
  PSPD = (4.45 * c.pspeed) / 100;
  PR = (20 * c.psize) / 100;
  BR = (11 * c.bsize) / 100;
  FRIC = 1 - ((1 - 0.99905) * c.fric) / 100;
  KP = c.kick / 100;
  BSPD = (4.9 * c.bot) / 100;
  GOAL_HALF = (75 * c.goal) / 100;
  GOAL_MOVE = !!+c.movegoal;
  resetGoals();
  FC = FIELDS[c.field] || FIELDS.green;
  names = [String(c.n1).trim(), String(c.n2).trim()];
  // Pengaturan Skill System (default: aktif, keempat skill ikut pengacakan)
  const skOn = (k) => (c[k] === undefined ? 1 : +c[k]) !== 0;
  window.SkillCfg = {
    on: skOn('skills'),
    nocd: !!+c.nocd, // tanpa cooldown
    reroll: !!+c.reroll, // skill diacak ulang tiap gol
    pool: ['wall', 'slow', 'fast', 'big', 'grow', 'freeze', 'shadow', 'dark', 'bomb', 'orbit', 'swap', 'ghost', 'dash', 'portal', 'back', 'brake', 'boost', 'slowbox', 'timestop', 'chain', 'undo', 'rewind', 'cannon', 'goalmove', 'mirror'].filter((k) => skOn('sk_' + k)),
  };
}
const rng = (k, l, min, max, step, u = '%') => ({ k, l, min, max, step, u });
const SPEC = [
  {
    k: 'team1',
    l: 'Tim kiri (Biru)',
    t: 'seg',
    o: [
      ['1', '1 Pemain'],
      ['2h', '2 Pemain'],
      ['hb', 'Pemain + Bot'],
    ],
  },
  {
    k: 'team2',
    l: 'Tim kanan (Merah)',
    t: 'seg',
    o: [
      ['1b', '1 Bot'],
      ['2b', '2 Bot'],
      ['1h', '1 Teman'],
      ['hb', 'Teman + Bot'],
    ],
  },
  { k: 'nocd', l: 'Tanpa cooldown skill', t: 'seg', o: [[1, 'ON'], [0, 'OFF']] },
  { k: 'reroll', l: 'Skill diacak tiap gol', t: 'seg', o: [[1, 'ON'], [0, 'OFF']] },
  { k: 'movegoal', l: 'Gawang bergeser naik-turun', t: 'seg', o: [[1, 'ON'], [0, 'OFF']] },
  rng('win', 'Gol untuk menang', 1, 15, 1, ''),
  {
    k: 'time',
    l: 'Batas waktu',
    t: 'seg',
    o: [
      [0, 'Tanpa'],
      [1, '1 mnt'],
      [2, '2 mnt'],
      [3, '3 mnt'],
      [5, '5 mnt'],
    ],
  },
  rng('pspeed', 'Kecepatan pemain', 50, 170, 5),
  rng('psize', 'Ukuran pemain', 60, 150, 5),
  rng('bsize', 'Ukuran bola', 60, 160, 5),
  rng('kick', 'Kekuatan tendangan', 50, 200, 5),
  rng('fric', 'Gesekan bola (licin ↔ berat)', 20, 250, 10),
  rng('goal', 'Lebar gawang', 50, 180, 5),
  rng('bot', 'Kekuatan Bot', 40, 150, 5),
  {
    k: 'skills',
    l: 'Skill System',
    t: 'seg',
    o: [
      [1, 'ON'],
      [0, 'OFF'],
    ],
  },
  ...[
    ['sk_wall', 'Tembok'],
    ['sk_slow', 'Pelan'],
    ['sk_fast', 'Cepat'],
    ['sk_big', 'Besar'],
    ['sk_grow', 'Besar Drastis'],
    ['sk_freeze', 'Beku'],
    ['sk_shadow', 'Bayangan'],
    ['sk_dark', 'Gelap'],
    ['sk_bomb', 'Bom'],
    ['sk_orbit', 'Orbit'],
    ['sk_swap', 'Tukar'],
    ['sk_ghost', 'Bola Hantu'],
    ['sk_dash', 'Melesat'],
    ['sk_portal', 'Portal'],
    ['sk_back', 'Kembali'],
    ['sk_brake', 'Pelambat'],
    ['sk_boost', 'Mempercepat'],
    ['sk_slowbox', 'Memperlambat'],
    ['sk_timestop', 'Waktu Berhenti'],
    ['sk_chain', 'Rantai'],
    ['sk_undo', 'Batalkan Gol'],
    ['sk_rewind', 'Mundur'],
    ['sk_cannon', 'Meriam'],
    ['sk_goalmove', 'Gawang Bergeser'],
    ['sk_mirror', 'Kaca'],
  ].map(([k, l]) => ({
    k,
    l,
    t: 'seg',
    o: [
      [1, 'ON'],
      [0, 'OFF'],
    ],
  })),
  {
    k: 'field',
    l: 'Warna lapangan',
    t: 'seg',
    o: [
      ['green', 'Hijau'],
      ['blue', 'Biru'],
      ['night', 'Malam'],
      ['clay', 'Tanah'],
    ],
  },
  { k: 'n1', l: 'Nama tim kiri', t: 'txt', ph: 'YOU / PLAYER 1' },
  { k: 'n2', l: 'Nama tim kanan', t: 'txt', ph: 'BOT / PLAYER 2' },
];
const esc = (v) =>
  String(v).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
function renderCustom() {
  const GR = {
    team1: 'Match Settings',
    pspeed: 'Physics Settings',
    bot: 'AI Settings',
    skills: 'Skill Settings',
    field: 'Appearance',
  };
  $('cform').innerHTML = SPEC.map(
    (p) =>
      (GR[p.k] ? `<h3 class="grp">${GR[p.k]}</h3>` : '') +
      ((p) => {
        const v = CS[p.k];
        if (p.t === 'seg')
          return `<div class="crow"><label>${p.l}</label><div class="seg" data-k="${p.k}">${p.o.map(([o, t]) => `<button type="button" class="btn${o == v ? ' on' : ''}" data-v="${o}">${t}</button>`).join('')}</div></div>`;
        if (p.t === 'txt')
          return `<div class="crow"><label>${p.l}</label><input type="text" maxlength="10" placeholder="${p.ph}" data-k="${p.k}" value="${esc(v)}"></div>`;
        return `<div class="crow"><label>${p.l}<output>${v}${p.u}</output></label><input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}" data-k="${p.k}" data-u="${p.u}"></div>`;
      })(p),
  ).join('');
}
const saveCS = () => store.set('ms_custom', CS);
$('cform').addEventListener('click', (e) => {
  const b = e.target.closest('.seg button');
  if (!b) return;
  const k = b.parentNode.dataset.k;
  CS[k] = typeof DEF[k] === 'number' ? +b.dataset.v : b.dataset.v;
  if (k === 'team1' || k === 'team2') {
    // Maksimal 2 pemain manusia (WASD + panah): bila lebih, tim lawan diganti komposisi tanpa pemain
    const hc = () => TEAM_L[CS.team1].filter((x) => x === 'H').length + TEAM_R[CS.team2].filter((x) => x === 'H').length;
    if (hc() > 2) {
      if (k === 'team1') CS.team2 = '1b';
      else CS.team1 = '1';
    }
  }
  saveCS();
  renderCustom();
});
$('cform').addEventListener('input', (e) => {
  const i = e.target,
    k = i.dataset.k;
  if (!k) return;
  if (i.type === 'range') {
    CS[k] = +i.value;
    i.parentNode.querySelector('output').textContent = i.value + i.dataset.u;
  } else CS[k] = i.value;
  saveCS();
});
$('customModeBtn').addEventListener('click', () => {
  $('startScreen').hidden = true;
  $('customScreen').hidden = false;
  renderCustom();
});
$('cBack').addEventListener('click', () => {
  $('customScreen').hidden = true;
  $('startScreen').hidden = false;
});
$('cReset').addEventListener('click', () => {
  CS = Object.assign({}, DEF);
  saveCS();
  renderCustom();
});
$('cStart').addEventListener('click', () => {
  $('customScreen').hidden = true;
  const L = TEAM_L[CS.team1] || ['H'], R = TEAM_R[CS.team2] || ['B'];
  // 1 lawan 1 memakai mode lama (Bot / Teman); selain itu memakai mode multi
  if (L.length + R.length === 2) startGame(R[0] === 'H' ? 'friend' : 'bot', true);
  else startGame('duo', true);
});

$('pauseBtn').addEventListener('click', togglePause);
$('botModeBtn').addEventListener('click', () => startGame('bot'));
$('friendModeBtn').addEventListener('click', () => startGame('friend'));
$('duoModeBtn').addEventListener('click', () => startGame('duo'));

$('rematchBtn').addEventListener('click', () => {
  if (mode === 'online') {
    window.MSOnline?.leaveToMenu();
    return;
  }

  if (lgMatch) backToMenu(true);
  else resetMatch();
});

$('endMenuBtn').addEventListener('click', () => backToMenu(false));
$('backMenuBtn').addEventListener('click', () => backToMenu(lgMatch));
$('fsBtn').addEventListener('click', toggleFS);

document.querySelectorAll('[data-ic]').forEach((b) => (b.innerHTML = IC[b.dataset.ic]));
syncToggles();
renderMenu();
resetMatch();
raf = requestAnimationFrame(loop);


function addOnlinePoints(amount) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));

  if (!amount) return;

  points += amount;
  store.set('ms_pts', points);

  renderMenu();

  if (!$('endCard').hidden) {
    const line = document.createElement('div');

    line.className = 'stat solo gain online-payout';
    line.textContent = `+${amount} POINTS`;

    $('endStats').appendChild(line);
  }
}


// API yang digunakan online.js.
window.MSGame = {
  startOnline: startOnlineMatch,

  getState: getOnlineState,

  applyState: applyOnlineState,

  applyNetState,

  getNetState,

  nudgeRemote,

  remoteSkill: (d) => window.Skills?.remote(d),

  skillSig: () => window.Skills?.sig() || '',

  setRtt(v) {
    if (Number.isFinite(v)) net.rtt = clamp(v, 10, 800);
  },

  // Input lokal + posisi pemain sendiri yang diproyeksikan ke waktu tiba di host.
  getInputPacket() {
    const v = readLocalMovement(),
      sm = window.Skills?.speedMul(p2) ?? 1,
      f = lagFrames();
    const o = { x: p2.x + v.x * PSPD * sm * f, y: p2.y + v.y * PSPD * sm * f, side: p2.side, r: p2.r };
    limit(o);
    return { v, x: r1(o.x), y: r1(o.y) };
  },

  finishOnline(state) {
    applyOnlineState(state);
    finish(true);
  },

  getInput: readLocalMovement,

  setPaused,

  togglePause,

  setStatus: say,

  restart() {
    resetMatch();
    net.pk = null;
    net.touchT = 0;
  },

  isOver: () => over,

  addPoints: addOnlinePoints,

  backToMenu() {
    backToMenu(false, true);
  }
};