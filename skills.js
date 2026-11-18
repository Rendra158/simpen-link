// skills.js — Skill System MiniSoccer (khusus offline: Bot, Friend, Liga, Custom)
(() => {
  'use strict';

  // ---------- Konstanta ----------
  const NAME = { wall: 'TEMBOK', slow: 'PELAN', fast: 'CEPAT', big: 'BESAR', grow: 'BESAR DRASTIS', freeze: 'BEKU', shadow: 'BAYANGAN', dark: 'GELAP', bomb: 'BOM', orbit: 'ORBIT', swap: 'TUKAR', ghost: 'HANTU', dash: 'MELESAT', portal: 'PORTAL' };
  const COL = { wall: '#7FD1B9', slow: '#6EC6FF', fast: '#FFD166', big: '#C792EA', grow: '#FFB86B', freeze: '#BFF3FF', shadow: '#AAB4C0', dark: '#8C7CFF', bomb: '#FF8A3D', orbit: '#55D9FF', swap: '#FF6FB5', ghost: '#C9D6FF', dash: '#FF6B6B', portal: '#4DB6FF' };
  const DESC = {
    wall: 'Pasang tembok penghalang (2×). Cooldown 15 dtk, isi ulang setelah semua tembokmu hilang',
    slow: 'Tembak peluru, lawan jadi sangat pelan (6×). Cooldown 10 dtk setelah habis',
    fast: 'Lari lebih cepat dan tubuh mengecil 10% selama 10 detik. Cooldown 10 dtk',
    big: 'Tubuh membesar 20 detik. Cooldown 10 dtk',
    grow: 'Membesar 50% dengan cepat, diam sekejap, lalu kembali normal. 2× pemakaian, cooldown 15 dtk setelah keduanya terpakai',
    freeze: 'Tembak peluru, lawan beku 5 detik (6×). Cooldown 15 dtk setelah habis',
    shadow: 'Bayangan penyerang 20 detik (maks 4×, cooldown 25 dtk). Kebobolan = skor lawan naik sebesar skormu',
    dark: 'Jika bola di area lawan, setengah lapangan jadi hitam (maks 4×, cooldown 20 dtk)',
    bomb: 'Lempar bom yang memantul. Pemain yang terkena stun 10 detik. Cooldown 15 dtk setelah bom habis',
    orbit: 'Bola mengelilingi pemain, makin lama makin cepat dan tidak bisa lepas sendiri. Tekan lagi untuk melepas; kecepatan terbawa, tiap pantulan sedikit mengurangi kecepatan sampai normal (2×, cooldown 20 dtk)',
    swap: 'Posisi bola dan pemain langsung tertukar. Bola meluncur searah gerakan terakhirmu (1×, cooldown 10 dtk)',
    ghost: 'Lempar bola hantu (2×): tembus pemain & tembok, tapi membelokkan bola. Hilang 15 dtk. Cooldown 10 dtk setelah habis',
    dash: 'Melesat jauh ke arah gerakmu. Tanpa batas pemakaian, cooldown 5 dtk',
    portal: 'Pasang 2 portal (seperti tembok). Apa pun yang masuk keluar di portal satunya. Hilang setelah 2 gol, lalu bisa dipasang lagi',
  };
  const ICON_D = {
    wall: 'M3 6h18v12H3zM3 12h18M9 6v6M15 12v6',
    slow: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9',
    fast: 'M13 2L5 14h6l-1 8 8-12h-6z',
    big: 'M9 3H3v6M15 21h6v-6M3 3l7 7M21 21l-7-7',
    grow: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M12 7v10M7 12h10',
    freeze: 'M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17M9 4l3 2 3-2M9 20l3-2 3 2',
    shadow: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5 21c0-4 3-7 7-7s7 3 7 7',
    dark: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
    bomb: 'M11 8a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM15 7l3-3M18 3l1 1',
    orbit: 'M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5M19 3v5h-5',
    swap: 'M7 4v12M3 12l4 4 4-4M17 20V8M13 12l4-4 4 4',
    ghost: 'M5 21V11a7 7 0 0 1 14 0v10l-3-2-2 2-2-2-2 2-2-2zM9.5 11h.01M14.5 11h.01',
    dash: 'M3 7h5M3 17h5M5 12h10M11 6l6 6-6 6',
    portal: 'M12 3a5 9 0 1 0 0 18a5 9 0 1 0 0-18zM12 8a2 4 0 1 0 0 8a2 4 0 1 0 0-8z',
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_D[k]}"/></svg>`;
  const START = {
    wall: { uses: 2, dur: 0 },
    slow: { uses: 6, dur: 0 },
    fast: { uses: 1, dur: 600 },
    big: { uses: 1, dur: 1200 },
    grow: { uses: 2, dur: 16 }, // satu animasi cepat tiap tekan; cooldown setelah 2 pemakaian
    freeze: { uses: 6, dur: 0 },
    shadow: { uses: 1, dur: 1200 }, // 20 detik
    dark: { uses: 1, dur: 600 }, // 10 detik gelap total
    bomb: { uses: 1, dur: 0 },
    orbit: { uses: 2, dur: 0 }, // aktif sampai dilepas manual (2×)
    swap: { uses: 1, dur: 0 },
    ghost: { uses: 2, dur: 0 },
    dash: { uses: 1, dur: 0 },
    portal: { uses: 2, dur: 0 },
  };
  // Cooldown (frame, 60 = 1 detik) sebelum skill terisi lagi
  const CD = { wall: 900, slow: 600, fast: 600, big: 600, grow: 900, freeze: 900, shadow: 1500, dark: 1200, bomb: 900, orbit: 1200, swap: 600, ghost: 600, dash: 300, portal: 60 };
  // Batas total pemakaian per pertandingan (selain ini: tanpa batas)
  const LIMIT = { shadow: 4, dark: 4 };
  const TEAM = ['#3286F6', '#EF5354', '#3286F6', '#EF5354']; // indeks pemain: genap = Biru, ganjil = Merah

  const WALL_LEN = W * 0.2,
    WALL_T = 14,
    WALL_HP = 6, // ketebalan/daya tahan 6 benturan
    WALL_GAP = 30,
    WALL_CD = 6;
  const SHOT_SPD = 7,
    SHOT_R = 7,
    SLOW_FRAMES = 60,
    SLOW_STUN_FRAMES = 360, // 6 detik
    SLOW_MUL = 0.3, // jauh lebih lambat
    FAST_MUL = 1.3,
    BIG_SIZE = 1.44, // 1.2 × 1.2
    GROW_SIZE = 1.5, // Besar Drastis (+50%)
    GROW_IN = 6,
    GROW_HOLD = 12,
    GROW_OUT = 9,
    BIG_MUL = 0.9,
    FAST_SIZE = 0.9; // ukuran pemain saat Cepat aktif (−10%)
  const FREEZE_FRAMES = 300, // 5 detik
    BOMB_FRAMES = 600, // 10 detik
    BOMB_SPD = 7,
    BOMB_R = 9, // ukuran sekarang = 95% dari ukuran normal
    BOMB_BASE_SIZE = 0.95,
    BOMB_MIN_SIZE = 0.85,
    BOMB_MAX_SIZE = 1.15,
    BOMB_BOUNCE = 0.88,
    BOMB_CURVE = 0.16,
    BOMB_MAX_AGE = 900, // bom hilang setelah 15 detik jika tidak mengenai pemain
    DARK_CYCLE = 150, // 2,5 detik per siklus
    DARK_ON = 120, // 2 detik gelap + 0,5 detik terang
    ORBIT_RANGE = 135,
    ORBIT_START_V = 6.5, // kecepatan linear awal orbit (px/frame)
    ORBIT_ACCEL_V = 0.1, // tambahan kecepatan linear per frame, tanpa batas maksimal
    ORBIT_GRACE = 25, // frame setelah dilepas: sentuhan pemilik tidak mengakhiri efek
    BALL_MAX = 15.5, // batas kecepatan bola normal di game
    BALL_DECAY = 0.985, // pengurangan kecepatan per frame setelah orbit dilepas
    ORBIT_BOUNCE_K = 0.86, // tiap pantulan setelah dilepas: kecepatan dikalikan ini (sedikit berkurang)
    INTRO_FRAMES = 150;
  const GHOST_FRAMES = 900, // bola hantu hilang 15 detik setelah dikeluarkan
    GHOST_SPD = 8.4, // 20% lebih cepat dari kecepatan sebelumnya
    GHOST_WALL_BOUNCE = 0.88,
    GHOST_CURVE = 0.18,
    GHOST_E = 0.95, // kelentingan tumbukan bola hantu dengan bola
    DASH_FRAMES = 10,
    DASH_SPD = 17, // 10 frame × 17 = ±170 px
    PORTAL_R = 26,
    PORTAL_GOALS = 2, // portal hilang setelah 2 gol (tim atau lawan)
    PORTAL_GAP = 24;
  const PCOL = ['#4DB6FF', '#FF9F43'];

  // ---------- Skill tambahan: data ----------
  const NEW_SKILLS = ['back', 'brake', 'boost', 'slowbox', 'timestop', 'chain', 'undo', 'mirror'];
  const isNew = (k) => NEW_SKILLS.includes(k);
  const isBox = (k) => k === 'boost' || k === 'slowbox';
  Object.assign(NAME, { back: 'KEMBALI', brake: 'PELAMBAT', boost: 'MEMPERCEPAT', slowbox: 'MEMPERLAMBAT', timestop: 'WAKTU BERHENTI', chain: 'RANTAI' });
  Object.assign(COL, { back: '#7DE0C3', brake: '#9BB8FF', boost: '#B6FF5C', slowbox: '#8A9BFF', timestop: '#E6E0FF', chain: '#FFD27D' });
  Object.assign(DESC, {
    back: 'Tekan sekali: tandai posisi. Tekan lagi: kamu tertarik cepat ke tanda, lalu melambat 20% selama 3 detik. 2× pakai, cooldown 10 dtk',
    brake: 'Area sangat besar mengikutimu 5 detik. Bola yang masuk area melambat kuat sampai berhenti. Cooldown 15 dtk',
    boost: 'Pasang kotak di depanmu (maks 2, hilang 25 dtk). Panah = arah gerakmu saat memasang; bola di dalamnya makin cepat ke arah itu. Tak bisa di kotak penalti. Cooldown 10 dtk setelah kotak habis',
    slowbox: 'Pasang kotak besar (maks 2, hilang 25 dtk). Bola yang melewatinya jadi lambat, arah tetap. Tak bisa di kotak penalti. Cooldown 10 dtk setelah kotak habis',
    timestop: 'Bola di areamu: bola, bom, bola hantu & tembakan berhenti 3 detik. Bola tak bisa ditukar. Cooldown 15 dtk',
    chain: 'Rantai panjang otomatis mengarah ke lawan terdekat (2×). Kena: lawan STUN 2,5 dtk, kamu tetap bisa bergerak tapi hanya sejauh panjang rantai. Meleset: hangus. Cooldown 15 dtk (kena) / 10 dtk (meleset)',
  });
  Object.assign(ICON_D, {
    back: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    brake: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM8 12h8',
    boost: 'M5 6l6 6-6 6M12 6l6 6-6 6',
    slowbox: 'M3 4h18v16H3zM8 10l4 4 4-4',
    timestop: 'M6 3h12M6 21h12M7 3v4l5 5-5 5v4M17 3v4l-5 5 5 5v4',
    chain: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  });
  Object.assign(START, {
    back: { uses: 2, dur: 0 }, // 5 detik
    brake: { uses: 1, dur: 300 },
    boost: { uses: 2, dur: 0 },
    slowbox: { uses: 2, dur: 0 },
    timestop: { uses: 1, dur: 180 }, // 3 detik
    chain: { uses: 2, dur: 0 },
  });
  Object.assign(CD, { back: 600, brake: 900, boost: 600, slowbox: 600, timestop: 900, chain: 600, undo: 0 });
  NAME.undo = 'BATALKAN GOL';
  COL.undo = '#FF9F5C';
  ICON_D.undo = 'M3 4v6h6M4.5 15a9 9 0 1 0 2.1-9.4L3 10';
  START.undo = { uses: 2, dur: 0 };
  DESC.undo = 'Saat tim kebobolan, tombol Batalkan Gol muncul 5 detik setelah animasi gol; tekan untuk membatalkan gol itu. Bila lawan mencetak gol kemenangan, otomatis aktif. Bisa dipakai 2× per pertandingan, setelah itu diganti skill acak., lalu diganti skill acak.';
  
  // ---------- Skill Kaca ----------
  NAME.mirror = 'KACA';
  COL.mirror = '#9FE8FF';
  DESC.mirror = 'Muncul refleksi dirimu di seberang garis tengah horizontal: X mengikuti kamu, Y dibalik (kamu di atas, refleksi di bawah). Refleksi menembus pemain tetapi memantulkan bola. Aktif 10 detik, lalu kamu dan refleksi tertarik ke tengah lapangan (X tetap). Cooldown 10 dtk';
  ICON_D.mirror = 'M12 2.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 14.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM3 12h18';
  START.mirror = { uses: 1, dur: 600 }; // 10 detik
  CD.mirror = 600; // cooldown 10 detik
  const MIRROR_PULL_MAX = 70; // batas aman lama tarikan (frame)

    // ---------- Skill baru: Mundur, Meriam, Gawang Bergeser ----------
  NEW_SKILLS.push('rewind', 'cannon', 'goalmove'); // khusus offline
  Object.assign(NAME, { rewind: 'MUNDUR', cannon: 'MERIAM', goalmove: 'GAWANG BERGESER' });
  Object.assign(COL, { rewind: '#7AE7FF', cannon: '#FF7A59', goalmove: '#FFE066' });
  Object.assign(DESC, {
    rewind: 'Memutar balik waktu 3 detik dengan animasi mundur (diputar ulang terbalik): pemain, bola, bom, bola hantu & peluru bergerak mundur ke posisi lalu. Tembok/portal/kotak yang dipasang dalam 3 detik itu hilang dan skillnya terisi lagi. Cooldown 10 dtk, bisa dipakai terus',
    cannon: 'Tembakkan bola meriam lurus. Kena pemain: STUN 5 dtk. Kena bola/bom: arahnya dibelokkan (tepat di tengah = lurus searah meriam). Kena tembok: tembok hancur. Meriam hancur setelah kena pemain/tembok. Cooldown 10 dtk',
    goalmove: 'Gawang timmu naik-turun cepat selama 8 detik (gawang lawan diam). Cooldown 10 dtk setelah selesai, bisa dipakai lagi',
  });
  Object.assign(ICON_D, {
    rewind: 'M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
    cannon: 'M3 15h10l5-5 3 3-5 5H3zM7 15v4M12 15v3',
    goalmove: 'M12 3l-3 3M12 3l3 3M12 3v18M12 21l-3-3M12 21l3-3M5 8v8M19 8v8',
  });
  Object.assign(START, { rewind: { uses: 1, dur: 0 }, cannon: { uses: 1, dur: 0 }, goalmove: { uses: 1, dur: 480 } });
  Object.assign(CD, { rewind: 600, cannon: 600, goalmove: 600 });

  const REWIND_FRAMES = 180, REWIND_STEP = 3; // 3 detik, direkam tiap 3 frame
  const CANNON_R = 14, CANNON_SPD = 11, CANNON_STUN = 300, CANNON_MAX_AGE = 240;
  const GM_AMP = 130, GM_RATE = 1 / 22, GM_FADE = 1 / 30; // gawang bergeser: amplitudo, kecepatan, fade in/out
  let hist = [], histN = 0, gmPh = [0, 0], gmEnv = [0, 0]; // per tim: 0 = gawang kiri (Biru), 1 = gawang kanan (Merah)
  let rw = null; // animasi Mundur yang sedang diputar
  const gmOff = (ph, env) => Math.sin(ph * GM_RATE) * Math.min(GM_AMP, H / 2 - LY - GOAL_HALF - 6) * env;
  
  const AREA_R = { brake: 135 }; // radius area (px): Pelambat sangat besar
  const BACK_SLOW = 0.8, // slow 20%
    BACK_SLOW_FRAMES = 180, // 3 detik
    BACK_PULL_SPD = 24,
    BACK_PULL_MAX = 40,
    BACK_MARK_R = 16;
  const BRAKE_K = 0.86; // pengali kecepatan bola per frame di area Pelambat (lebih kuat)
  const BOX_HALF = 34, // kotak Mempercepat 68×68
    BOX_HALF_SLOW = 42, // kotak Memperlambat lebih besar (84×84)
    BOX_LIFE = 1500, // 25 detik
    BOOST_ADD = 4.5, // dorongan awal searah panah saat bola masuk
    BOOST_ACC = 0.45, // percepatan per frame searah panah selama bola di dalam kotak
    BOOST_MAX = 17,
    SLOWBOX_MUL = 0.45;
  const CHAIN_LEN = 360, // jangkauan lebih panjang
    CHAIN_SPD = 22,
    CHAIN_PULL = 2.4, // tarikan per frame saat tarik-menarik
    CHAIN_FAST_MUL = 1.8, // kekuatan tarik bila skill Cepat aktif
    CHAIN_DASH_MUL = 2.6, // kekuatan tarik bila sedang Melesat
    CHAIN_LOCK = 150, // lama terkunci (2,5 detik)
    CHAIN_CD_HIT = 900, // kena: cooldown 15 dtk
    CHAIN_CD_MISS = 600; // meleset semua: cooldown 10 dtk

  // ---------- State ----------
  const mkPl = () => ({
    skill: null, uses: 0, active: false, t: 0, tMax: 0,
    preview: false, pv: null, inv: 0,
    slowT: 0, stunT: 0, stunC: COL.freeze,
    vis: 0, fresh: 0, dir: { x: 1, y: 0 }, trail: [],
    botT: 30, botCool: 0, lastPress: 0,
    slowHits: 0, // jumlah kena slow; 3× = stun
    cd: 0, cdMax: 1, rp: false, left: 0, // cooldown, menunggu isi ulang, sisa pemakaian
    sh: null, // bayangan
    orbit: null, // kendali orbit bola sementara
    dashT: 0, dashV: { x: 0, y: 0 }, pgoals: 0, lock: 0, // melesat, hitung gol portal, kunci prediksi guest
    bk: null, pull: null, sl2: 0, lockT: 0, tsV: null, rIn: false, // skill tambahan
  });
  const st = { on: false, pl: [mkPl(), mkPl()], walls: [], shots: [], bombs: [], ghosts: [], portals: [], dying: [], rings: [], intro: 0, boxes: [], chains: [], boxes: [], chains: [], cannons: [], fx: [] };
  let tick = 0;
  let orbRel = null; // pelacak bola setelah orbit dilepas: { b: jumlah pantulan, pvx, pvy, slow }
  let syncSig = null, syncBurst = 0, syncAt = 0; // sinkron skill hemat (lihat getSyncNet)

  const offline = () => mode !== 'online';
  const online = () => mode === 'online';
  // Host (atau mode offline) = pemilik logika skill. Guest hanya mengirim permintaan & menampilkan hasil.
  const isAuth = () => mode !== 'online' || !!window.MSOnline?.isHost;
  const me = () => (mode === 'online' ? (window.MSOnline?.isHost ? 0 : 1) : -1); // indeks pemain lokal saat online
  const live = () => gameActive;
  // Mode VS 2 BOT: 4 pemain. Indeks 0 = P1 (Biru, WASD), 1 = Bot 1 (Merah), 2 = P2 (Biru, panah), 3 = Bot 2 (Merah).
  // Tim = indeks genap (Biru, kiri) / ganjil (Merah, kanan). Mode lain tetap memakai indeks 0 dan 1 saja.
  const duo = () => mode === 'duo';
  const want = () => (mode === 'online' ? 2 : 4); // panjang st.pl (offline selalu 4 slot; slot tanpa pemain dibiarkan kosong)
  const slots = () => (mode === 'online' ? [0, 1] : [0, 1, 2, 3].filter((n) => ROLES[n] && st.pl[n])); // slot yang dipakai
  const teamOf = (n) => n & 1;
  const foes = (n) => slots().filter((m) => (m & 1) !== (n & 1));
  const isBot = (n) => mode !== 'online' && ROLES[n] === 'B';
  const baseDir = (n) => ({ x: teamOf(n) === 0 ? 1 : -1, y: 0 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const P = (n) => [p1, p2, p3, p4][n];
  const allP = () => [p1, p2, p3, p4].filter(Boolean);
  const idxOf = (p) => [p1, p2, p3, p4].indexOf(p);
  // Lawan yang paling dekat ke titik `from`
  const nearestFoe = (n, from) => {
    const fs = foes(n);
    let best = fs[0];
    for (const m of fs) if (dist(P(m), from) < dist(P(best), from)) best = m;
    return best;
  };
  const pname = (n) => (duo() ? slotLabel(n) : tag(n));
  // Petunjuk tombol skill: pemain manusia pertama = Spasi, kedua = Enter
  const skKey = (n) => (online() ? (n === 0 ? 'Spasi' : null) : HUMANS.indexOf(n) === 0 ? 'Spasi' : HUMANS.indexOf(n) === 1 ? 'Enter' : null);

  function snap(vx, vy) {
    const a = Math.round(Math.atan2(vy, vx) / (Math.PI / 4)) * (Math.PI / 4);
    return { x: Math.round(Math.cos(a) * 1000) / 1000, y: Math.round(Math.sin(a) * 1000) / 1000 };
  }

  // ---------- Cooldown ----------
  function startCd(n) {
    const s = st.pl[n];
    if (!s.skill || s.cd > 0 || s.rp) return;
    // Tembok: cooldown tidak berjalan selama masih ada jatah atau tembok milik pemain.
    if (s.skill === 'wall' && (s.uses > 0 || st.walls.some((w) => w.n === n))) return;
    // Besar Drastis: cooldown baru dimulai setelah kedua aktivasi selesai dipakai.
    if (s.skill === 'grow' && s.uses > 0) return;
    if (s.skill === 'back' && s.uses > 0) return;
    if (isBox(s.skill) && (s.uses > 0 || st.boxes.some((b) => b.n === n))) return;
    if (LIMIT[s.skill] && s.left <= 0) return; // jatah habis, tidak terisi lagi
    if (window.SkillCfg && window.SkillCfg.nocd) { s.rp = true; return; } // opsi Custom: tanpa cooldown
    s.cd = s.cdMax = CD[s.skill];
  }
  function refill(n) {
    const s = st.pl[n], p = P(n);
    s.uses = START[s.skill].uses;
    s.fresh = 60;
    if (p) ring(p.x, p.y, COL[s.skill], 60);
    tone(700, 0.1, 0.03, 'triangle', 200);
  }

  // ---------- Geometri (OBB) ----------
  const mkObb = (x, y, a, hl, ht) => ({ x, y, a, c: Math.cos(a), s: Math.sin(a), hl, ht });
  function obbOverlap(a, b, m = 0) {
    const axes = [[a.c, a.s], [-a.s, a.c], [b.c, b.s], [-b.s, b.c]];
    for (const [ax, ay] of axes) {
      const ra = a.hl * Math.abs(a.c * ax + a.s * ay) + a.ht * Math.abs(-a.s * ax + a.c * ay);
      const rb = b.hl * Math.abs(b.c * ax + b.s * ay) + b.ht * Math.abs(-b.s * ax + b.c * ay);
      if (Math.abs((b.x - a.x) * ax + (b.y - a.y) * ay) > ra + rb + m) return false;
    }
    return true;
  }
  const corners = (o) => {
    const ux = o.c * o.hl, uy = o.s * o.hl, vx = -o.s * o.ht, vy = o.c * o.ht;
    return [[o.x + ux + vx, o.y + uy + vy], [o.x - ux + vx, o.y - uy + vy], [o.x - ux - vx, o.y - uy - vy], [o.x + ux - vx, o.y + uy - vy]];
  };
  function circleObb(o, x, y, r, px, py) {
    const dx = x - o.x, dy = y - o.y;
    const u = dx * o.c + dy * o.s, v = -dx * o.s + dy * o.c;
    const du = u - clamp(u, -o.hl, o.hl), dv = v - clamp(v, -o.ht, o.ht);
    const d2 = du * du + dv * dv;
    if (d2 >= r * r) return null;
    let nu, nv, depth;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nu = du / d; nv = dv / d; depth = r - d;
    } else {
      let sv = v;
      if (px !== undefined) sv = -(px - o.x) * o.s + (py - o.y) * o.c;
      const sg = sv >= 0 ? 1 : -1;
      nu = 0; nv = sg; depth = o.ht - sg * v + r;
    }
    return { nx: nu * o.c - nv * o.s, ny: nu * o.s + nv * o.c, d: depth };
  }

  // ---------- Tembok ----------
  function wallSpot(n) {
    const p = P(n), d = st.pl[n].dir;
    const dd = p.r + WALL_T / 2 + WALL_GAP;
    return { x: p.x + d.x * dd, y: p.y + d.y * dd, a: Math.atan2(d.y, d.x) + Math.PI / 2 };
  }
  function wallCheck(x, y, a) {
    const o = mkObb(x, y, a, WALL_LEN / 2, WALL_T / 2);
    for (const [cx, cy] of corners(o))
      if (cx < LX + 4 || cx > W - LX - 4 || cy < LY + 4 || cy > H - LY - 4) return 'bounds';
    for (const [x0, x1, sd] of [[LX - 20, LX + 105 + 4, 0], [W - LX - 105 - 4, W - LX + 20, 1]]) {
      const y0 = Math.min(155, goalTop(sd) - 8), y1 = Math.max(405, goalBot(sd) + 8);
      if (obbOverlap(o, mkObb((x0 + x1) / 2, (y0 + y1) / 2, 0, (x1 - x0) / 2, (y1 - y0) / 2))) return 'zone';
    }
    for (const w of st.walls) if (obbOverlap(o, w, 2)) return 'wall';
    for (const p of allP()) if (circleObb(o, p.x, p.y, p.r + 4)) return 'player';
    if (circleObb(o, ball.x, ball.y, ball.r + 4)) return 'ball';
    return null;
  }
  function updPreview(n) {
    if (isBox(st.pl[n].skill)) {
      const sp = boxSpot(n), why = boxCheck(sp.x, sp.y, st.pl[n].skill);
      st.pl[n].pv = { x: sp.x, y: sp.y, a: 0, ok: !why, why, d: st.pl[n].dir };
      return;
    }
    if (st.pl[n].skill === 'portal') {
      const s = portalSpot(n), why = portalCheck(s.x, s.y);
      st.pl[n].pv = { x: s.x, y: s.y, a: 0, ok: !why, why };
      return;
    }
    const s = wallSpot(n), why = wallCheck(s.x, s.y, s.a);
    st.pl[n].pv = { x: s.x, y: s.y, a: s.a, ok: !why, why };
  }

  // ---------- Portal ----------
  const isPlace = (k) => k === 'wall' || k === 'portal' || k === 'boost' || k === 'slowbox';
  function portalSpot(n) {
    const p = P(n), d = st.pl[n].dir, dd = p.r + PORTAL_R + PORTAL_GAP;
    return { x: p.x + d.x * dd, y: p.y + d.y * dd };
  }
  function portalCheck(x, y) {
    const R = PORTAL_R;
    if (x < LX + R + 4 || x > W - LX - R - 4 || y < LY + R + 4 || y > H - LY - R - 4) return 'bounds';
    for (const [x0, x1, sd] of [[LX - 20, LX + 105 + 4, 0], [W - LX - 105 - 4, W - LX + 20, 1]]) {
      const y0 = Math.min(155, goalTop(sd) - 8), y1 = Math.max(405, goalBot(sd) + 8);
      if (circleObb(mkObb((x0 + x1) / 2, (y0 + y1) / 2, 0, (x1 - x0) / 2, (y1 - y0) / 2), x, y, R)) return 'zone';
    }
    for (const q of st.portals) if (dist(q, { x, y }) < R * 2 + 6) return 'portal';
    for (const w of st.walls) if (circleObb(w, x, y, R + 2)) return 'wall';
    for (const p of allP()) if (dist(p, { x, y }) < p.r + R + 4) return 'player';
    if (dist(ball, { x, y }) < ball.r + R + 4) return 'ball';
    return null;
  }
  function placePortal(n, x, y) {
    const s = st.pl[n];
    if (s.skill !== 'portal' || s.uses <= 0 || portalCheck(x, y)) return false;
    const i = st.portals.filter((q) => q.n === n).length;
    if (i >= 2) return false;
    if (i === 0) s.pgoals = 0;
    s.uses--;
    st.portals.push({ n, i, x, y, pop: 1 });
    ring(x, y, PCOL[i], 80);
    burstParts(x, y, 16, [PCOL[i], '#ffffff', TEAM[n]], 3.4, 0.02, 0.05, 3);
    tone(300, 0.2, 0.05, 'sine', 500);
    return true;
  }
  function expirePortals(n) {
    for (const q of st.portals) if (q.n === n) {
      ring(q.x, q.y, PCOL[q.i], 90);
      burstParts(q.x, q.y, 14, [PCOL[q.i], '#ffffff'], 3.5, 0.04, 0.05, 3);
    }
    st.portals = st.portals.filter((q) => q.n !== n);
    const s = st.pl[n];
    s.pgoals = 0;
    s.preview = false;
    s.pv = null;
    refill(n); // portal terisi ulang setelah 2 gol
  }
  function segDist(ax, ay, bx, by, cx, cy) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 > 1e-9 ? clamp(((cx - ax) * dx + (cy - ay) * dy) / l2, 0, 1) : 0;
    return Math.hypot(ax + dx * t - cx, ay + dy * t - cy);
  }
  // Teleport entitas bila lintasannya (ox,oy → posisi sekarang) melewati portal. Arah gerak dipertahankan.
  function portalPass(e, r, ox, oy) {
    const ps = st.portals;
    if (ps.length < 2) return false;
    for (const a of ps) {
      if (e._pe === a) {
        if (Math.hypot(e.x - a.x, e.y - a.y) > PORTAL_R + r + 4) e._pe = null;
        continue;
      }
      const b = ps.find((q) => q.n === a.n && q !== a);
      if (!b) continue;
      if (segDist(ox, oy, e.x, e.y, a.x, a.y) >= PORTAL_R - 3) continue;
      const sp = Math.hypot(e.vx || 0, e.vy || 0);
      let dx, dy;
      if (sp > 0.05) { dx = e.vx / sp; dy = e.vy / sp; }
      else {
        dx = e.x - a.x; dy = e.y - a.y;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l; dy /= l;
      }
      const off = PORTAL_R + r + 3;
      ring(a.x, a.y, PCOL[a.i], 55);
      e.x = clamp(b.x + dx * off, LX + r + 1, W - LX - r - 1);
      e.y = clamp(b.y + dy * off, LY + r + 1, H - LY - r - 1);
      e._pe = b;
      ring(b.x, b.y, PCOL[b.i], 55);
      burstParts(b.x, b.y, 6, [PCOL[b.i], '#ffffff'], 2.5, 0, 0.08, 2.5);
      tone(420, 0.1, 0.03, 'sine', 420);
      return true;
    }
    return false;
  }
  // Bola & pemain (bola hantu, bom, dan peluru dicek di fungsi masing-masing)
  function portalStep() {
    if (st.portals.length < 2) return;
    if (orbitOwner() < 0 && ball && !tsOn()) {
      const bp = st.bp || ball;
      if (portalPass(ball, ball.r, bp.x, bp.y)) trail = [];
    }
    for (const n of slots()) {
      const p = P(n), pv = prevR['p' + (n + 1)];
      if (p && pv && portalPass(p, p.r, pv.x, pv.y)) {
        limit(p);
        collidePlayer(p);
      }
    }
  }
  function placeWall(n, x, y, a) {
    const s = st.pl[n];
    if (s.uses <= 0 || wallCheck(x, y, a)) return false;
    s.uses--;
    st.walls.push(Object.assign(mkObb(x, y, a, WALL_LEN / 2, WALL_T / 2), { n, hp: WALL_HP, cd: 0, flash: 0.6, pop: 1 }));
    // Cooldown akan dimulai oleh update() setelah tembok terakhir hancur.
    ring(x, y, TEAM[n], 70);
    burstParts(x, y, 14, ['#F3F0E7', COL.wall, TEAM[n]], 3.2, 0.05, 0.05, 3);
    fxWallPlace(x, y, a, n);
    tone(190, 0.12, 0.05, 'square', -60);
    noise(0.08, 0.04, 400);
    return true;
  }
  function ring(x, y, c, max) {
    st.rings.push({ x, y, c, max, t: 1 });
  }

  // =====================================================================
  //  EFEK VISUAL SKILL: debu, puing, percikan, api, es, petir, aura, bayangan
  //  Murni kosmetik: tidak memengaruhi fisika/gameplay dan tidak disinkronkan.
  //  Setiap efek = objek ringan di st.fx, di-update di tickFx() dan digambar
  //  oleh drawFx(layer): layer 0 = di bawah pemain, layer 1 = di atas pemain.
  // =====================================================================
  const FX_MAX = 560;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const DUST = ['#CDBF9F', '#B9AD90', '#A89C83', '#D8CDB2'];
  const SMOKE = ['#4A4F57', '#5B616B', '#3A3E45'];
  const SHADOWC = ['#1A1030', '#2A1B4A', '#0E0A1A', '#3A2468'];
  const FIRE_SPARK = ['#FFD166', '#FF8A3D', '#FFF3B0'];
  const ICE = { freeze: ['#FFFFFF', '#BFF3FF', '#8EDCFF'], slow: ['#6EC6FF', '#BFE9FF', '#FFFFFF'] };

  function fxAdd(o) {
    const l = st.fx || (st.fx = []);
    if (l.length >= FX_MAX) l.splice(0, l.length - FX_MAX + 1);
    o.age = o.age || 0;
    o.max = o.max || 30;
    l.push(o);
  }
  // Gumpalan lembut (debu / asap)
  function fxPuff(x, y, a, spd, r, cols, o = {}) {
    fxAdd({ k: 'puff', L: o.L ?? 0, x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd + (o.rise || 0), r, gr: o.gr ?? rnd(0.3, 0.6), c: pick(cols), a: o.a ?? 0.45, drag: o.drag ?? 0.93, max: o.max ?? Math.round(rnd(26, 42)) });
  }
  // Serpihan / puing yang berputar
  function fxChip(x, y, a, spd, size, cols, o = {}) {
    fxAdd({ k: 'chip', L: o.L ?? 0, x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, rot: rnd(0, TAU), vr: rnd(-0.4, 0.4), w: size, h: size * rnd(0.4, 0.9), c: pick(cols), drag: o.drag ?? 0.9, max: o.max ?? Math.round(rnd(34, 56)) });
  }
  // Percikan bercahaya berbentuk garis
  function fxSpark(x, y, a, spd, len, cols, o = {}) {
    fxAdd({ k: 'spark', L: o.L ?? 1, x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, len, w: o.w ?? 2, c: pick(cols), drag: o.drag ?? 0.9, g: o.g || 0, max: o.max ?? Math.round(rnd(12, 24)) });
  }
  // Api
  function fxFlame(x, y, a, spd, r, o = {}) {
    fxAdd({ k: 'flame', L: o.L ?? 1, x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd + (o.rise || 0), r, drag: o.drag ?? 0.92, max: o.max ?? Math.round(rnd(14, 24)) });
  }
  // Pecahan es
  function fxShard(x, y, a, spd, size, cols, o = {}) {
    fxAdd({ k: 'shard', L: o.L ?? 1, x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, rot: a, vr: rnd(-0.25, 0.25), w: size, h: size * 2.1, c: pick(cols), drag: o.drag ?? 0.9, max: o.max ?? Math.round(rnd(22, 36)) });
  }
  // Gelombang (cincin yang melebar)
  function fxWave(x, y, r0, r1, c, w, max, delay = 0) {
    fxAdd({ k: 'wave', L: 1, x, y, r0, r1, c, w, max, age: -delay });
  }
  // Petir bergerigi
  function fxBolt(x1, y1, x2, y2, c, o = {}) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    const n = Math.max(3, Math.round(len / 11)), jag = o.jag ?? 7, pts = [{ x: x1, y: y1 }];
    for (let i = 1; i < n; i++) {
      const t = i / n, off = rnd(-jag, jag) * Math.sin(Math.PI * t);
      pts.push({ x: x1 + (x2 - x1) * t + nx * off, y: y1 + (y2 - y1) * t + ny * off });
    }
    pts.push({ x: x2, y: y2 });
    fxAdd({ k: 'bolt', L: 1, pts, c, w: o.w ?? 2.4, max: o.max ?? 9 });
  }

  function tickFxList() {
    const l = st.fx;
    if (!l || !l.length) return;
    for (const f of l) {
      if (f.age < 0) { f.age++; continue; } // menunggu delay
      f.age++;
      if (f.vx !== undefined) {
        f.x += f.vx;
        f.y += f.vy;
        const d = f.drag === undefined ? 0.96 : f.drag;
        f.vx *= d;
        f.vy *= d;
        if (f.g) f.vy += f.g;
      }
      if (f.rot !== undefined) f.rot += f.vr || 0;
      if (f.gr) { f.r += f.gr; f.gr *= 0.95; }
    }
    st.fx = l.filter((f) => f.age < f.max);
  }

  function drawFx(layer) {
    const l = st.fx;
    if (!l || !l.length) return;
    ctx.save();
    const add = (on) => (ctx.globalCompositeOperation = on ? 'lighter' : 'source-over');
    for (const f of l) {
      if (f.age < 0 || (f.L || 0) !== layer) continue;
      const t = f.age / f.max, life = 1 - t;
      switch (f.k) {
        case 'puff': {
          add(false);
          const r = Math.max(1, f.r);
          ctx.globalAlpha = Math.max(0, (f.a ?? 0.45) * life * Math.min(1, 0.35 + f.age / 4));
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
          g.addColorStop(0, f.c);
          g.addColorStop(1, f.c + '00');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(f.x, f.y, r, 0, TAU);
          ctx.fill();
          break;
        }
        case 'chip': {
          add(false);
          ctx.globalAlpha = Math.min(1, life * 2.2);
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rot);
          ctx.fillStyle = f.c;
          ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
          ctx.restore();
          break;
        }
        case 'spark': {
          add(true);
          ctx.globalAlpha = Math.min(1, life * 1.5);
          ctx.strokeStyle = f.c;
          ctx.lineCap = 'round';
          ctx.lineWidth = Math.max(0.8, f.w * life + 0.3);
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x - f.vx * f.len, f.y - f.vy * f.len);
          ctx.stroke();
          break;
        }
        case 'flame': {
          add(true);
          const r = Math.max(1, f.r * (1 - t * 0.65)) * 1.4;
          const col = t < 0.3 ? '#FFF1A8' : t < 0.6 ? '#FFAA33' : '#FF5A1F';
          ctx.globalAlpha = Math.min(1, life * 1.1) * 0.85;
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
          g.addColorStop(0, col);
          g.addColorStop(1, col + '00');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(f.x, f.y, r, 0, TAU);
          ctx.fill();
          break;
        }
        case 'shard': {
          add(false);
          ctx.globalAlpha = Math.min(1, life * 1.8) * 0.92;
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rot + Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, -f.h / 2);
          ctx.lineTo(f.w / 2, 0);
          ctx.lineTo(0, f.h / 2);
          ctx.lineTo(-f.w / 2, 0);
          ctx.closePath();
          ctx.fillStyle = f.c;
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'wave': {
          add(true);
          const e = 1 - Math.pow(1 - t, 2.2);
          ctx.globalAlpha = Math.max(0, life * 0.85);
          ctx.strokeStyle = f.c;
          ctx.lineWidth = Math.max(0.6, f.w * life + 0.5);
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * e, 0, TAU);
          ctx.stroke();
          break;
        }
        case 'bolt': {
          add(true);
          const fl = f.age % 3 === 2 ? 0.45 : 1; // berkedip
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(f.pts[0].x, f.pts[0].y);
          for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
          ctx.globalAlpha = life * 0.4 * fl;
          ctx.strokeStyle = f.c;
          ctx.lineWidth = f.w * 3;
          ctx.stroke();
          ctx.globalAlpha = Math.min(1, life * 1.6) * fl;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = Math.max(0.8, f.w * 0.7);
          ctx.stroke();
          break;
        }
        case 'ghost': {
          add(false);
          const r = f.r * (0.85 + 0.15 * life);
          ctx.globalAlpha = life * 0.55;
          ctx.fillStyle = f.c;
          ctx.beginPath();
          ctx.arc(f.x, f.y, r, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = life * 0.85;
          ctx.strokeStyle = f.c2;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.globalAlpha = life * 0.3;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(f.x - r * 0.3, f.y - r * 0.3, r * 0.38, 0, TAU);
          ctx.fill();
          break;
        }
      }
    }
    ctx.restore();
  }

  // ---------- 1. Tembok: debu & puing ----------
  function fxWallPlace(x, y, a, n) {
    const c = Math.cos(a), s = Math.sin(a), na = Math.atan2(c, -s);
    const cols = ['#F3F0E7', COL.wall, TEAM[n], '#2b3a49'];
    for (let i = 0; i < 7; i++) {
      const u = ((i + 0.5) / 7 - 0.5) * WALL_LEN, px = x + u * c, py = y + u * s;
      for (const sg of [0, Math.PI]) fxPuff(px, py, na + sg + rnd(-0.5, 0.5), rnd(0.5, 1.6), rnd(5, 9), DUST, { a: 0.4, rise: -0.12 });
      if (i % 2 === 0) fxChip(px, py, na + (Math.random() < 0.5 ? 0 : Math.PI) + rnd(-0.6, 0.6), rnd(1.5, 3.2), rnd(2.5, 4), cols, { max: Math.round(rnd(26, 40)) });
    }
    for (const e of [-1, 1]) fxPuff(x + (e * WALL_LEN * c) / 2, y + (e * WALL_LEN * s) / 2, Math.atan2(e * s, e * c), rnd(0.6, 1.2), rnd(8, 12), DUST, { a: 0.45, max: 36 });
  }
  function fxWallBreak(w) {
    const cols = ['#F3F0E7', COL.wall, TEAM[w.n], '#2b3a49', '#9FB3C0'];
    for (let i = 0; i < 6; i++) {
      const u = ((i + 0.5) / 6 - 0.5) * WALL_LEN, px = w.x + u * w.c, py = w.y + u * w.s;
      for (let j = 0; j < 3; j++) fxChip(px, py, rnd(0, TAU), rnd(1.5, 5.2), rnd(3, 8), cols, { max: Math.round(rnd(36, 62)) });
      fxPuff(px, py, rnd(0, TAU), rnd(0.4, 1.6), rnd(8, 15), DUST, { a: 0.5, gr: rnd(0.4, 0.8), max: Math.round(rnd(30, 48)) });
    }
    fxPuff(w.x, w.y, 0, 0, 16, DUST, { a: 0.45, gr: 0.9, max: 44 });
  }
  function fxWallHit(x, y, w) {
    const cols = ['#F3F0E7', COL.wall, TEAM[w.n], '#2b3a49'];
    for (let i = 0; i < 4; i++) fxChip(x, y, rnd(0, TAU), rnd(1.2, 3.4), rnd(2, 4), cols, { max: Math.round(rnd(20, 32)) });
    for (let i = 0; i < 2; i++) fxPuff(x, y, rnd(0, TAU), rnd(0.4, 1), rnd(4, 7), DUST, { a: 0.35, max: 24 });
  }

  // ---------- 2. Pelan & Beku: es ----------
  function fxIceMuzzle(x, y, dx, dy, k) {
    const a0 = Math.atan2(dy, dx), cols = ICE[k] || ICE.slow;
    for (let i = 0; i < 9; i++) fxShard(x, y, a0 + rnd(-0.65, 0.65), rnd(2.2, 6), rnd(2, 3.6), cols, { max: Math.round(rnd(18, 30)) });
    for (let i = 0; i < 10; i++) fxSpark(x, y, a0 + rnd(-0.9, 0.9), rnd(1.5, 5), 1.6, ['#FFFFFF', cols[1]]);
    for (let i = 0; i < 4; i++) fxPuff(x, y, a0 + rnd(-0.7, 0.7), rnd(0.8, 2), rnd(4, 7), ['#DFF6FF', '#BFE9FF'], { L: 1, a: 0.4, gr: 0.35, max: 22 });
    fxWave(x, y, 4, 26, cols[1], 2, 14);
  }
  function fxIceTrail(sh) {
    const c = ICE[sh.k] || ICE.slow;
    fxSpark(sh.x + rnd(-3, 3), sh.y + rnd(-3, 3), rnd(0, TAU), rnd(0.2, 0.9), 2, c, { max: 12, w: 1.6 });
    if (sh.age % 3 === 0) fxPuff(sh.x - sh.vx * 0.5, sh.y - sh.vy * 0.5, rnd(0, TAU), rnd(0.1, 0.4), rnd(3, 5), ['#DFF6FF', '#BFE9FF'], { L: 1, a: 0.28, gr: 0.12, max: 18 });
  }
  function fxIceBlast(x, y, r, k) {
    const cols = ICE[k] || ICE.slow, big = k === 'freeze' ? 1.25 : 1, n = k === 'freeze' ? 18 : 13;
    fxWave(x, y, r * 0.8, r * 3.1 * big, cols[1], 4, 24);
    fxWave(x, y, r * 0.5, r * 2.2 * big, '#FFFFFF', 2.5, 18, 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd(-0.15, 0.15);
      fxShard(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, a, rnd(2.5, 6.5) * big, rnd(2.5, 5), cols, { max: Math.round(rnd(26, 42)) });
    }
    for (let i = 0; i < 14; i++) fxSpark(x, y, rnd(0, TAU), rnd(2, 7) * big, 1.7, ['#FFFFFF', cols[1], cols[2]]);
    for (let i = 0; i < 8; i++) fxPuff(x, y, rnd(0, TAU), rnd(0.8, 2.4), rnd(7, 12), ['#DFF6FF', '#BFE9FF', '#FFFFFF'], { L: 1, a: 0.42, gr: 0.5, max: 30 });
    for (let i = 0; i < 5; i++) fxShard(x + rnd(-r, r) * 0.7, y + rnd(-r, r) * 0.7, rnd(0, TAU), rnd(0.3, 1), rnd(4, 6), cols, { max: 54, drag: 0.8 });
  }

  // ---------- 3. Besar Drastis: gelombang kecil ----------
  function fxGrowWave(p) {
    const r = p.r;
    fxWave(p.x, p.y, r * 0.9, r * 2.3, COL.grow, 3, 20);
    fxWave(p.x, p.y, r * 0.7, r * 1.9, '#FFE2C4', 2, 18, 5);
    fxWave(p.x, p.y, r * 0.6, r * 1.6, '#FFFFFF', 1.5, 16, 10);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + rnd(-0.2, 0.2);
      fxSpark(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, a, rnd(1.5, 3.5), 1.5, [COL.grow, '#FFE2C4'], { max: 16, w: 1.8 });
    }
  }

  // ---------- 4. Bayangan: aura gelap ----------
  function fxShadowBurst(x, y) {
    for (let i = 0; i < 12; i++) fxPuff(x, y, rnd(0, TAU), rnd(0.6, 2.2), rnd(8, 14), SHADOWC, { L: 1, a: 0.6, gr: 0.5, max: 38 });
    for (let i = 0; i < 8; i++) fxSpark(x, y, rnd(0, TAU), rnd(1.5, 4), 1.5, ['#8C7CFF', '#C792EA'], { max: 16, w: 1.6 });
  }
  function fxShadowWisp(p) {
    const a = rnd(0, TAU), d = rnd(0.2, 1) * p.r;
    fxPuff(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, -Math.PI / 2 + rnd(-0.8, 0.8), rnd(0.2, 0.7), rnd(5, 9), SHADOWC, { L: 1, a: 0.4, gr: 0.25, drag: 0.96, max: 34 });
    if (Math.random() < 0.35) fxSpark(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, rnd(0, TAU), rnd(0.3, 1), 2, ['#8C7CFF', '#C792EA'], { max: 14, w: 1.4 });
  }

  // ---------- 5. Bom: api ----------
  function fxFirePop(x, y, d) {
    const a0 = Math.atan2(d.y, d.x);
    for (let i = 0; i < 8; i++) fxFlame(x, y, a0 + rnd(-0.7, 0.7), rnd(1.5, 4), rnd(5, 9));
    for (let i = 0; i < 14; i++) fxSpark(x, y, a0 + rnd(-0.9, 0.9), rnd(2, 7), 1.8, FIRE_SPARK);
    for (let i = 0; i < 3; i++) fxPuff(x, y, a0 + rnd(-0.6, 0.6), rnd(0.6, 1.4), rnd(5, 8), SMOKE, { L: 1, a: 0.35, gr: 0.4, max: 30 });
  }
  function fxBombTrail(b) {
    const sp = Math.hypot(b.vx, b.vy), back = sp > 0.3 ? Math.atan2(-b.vy, -b.vx) : rnd(0, TAU);
    const bx = b.x - b.vx * 0.6, by = b.y - b.vy * 0.6, r = b.r || BOMB_R;
    fxFlame(bx + rnd(-2, 2), by + rnd(-2, 2), back + rnd(-0.5, 0.5), rnd(0.3, 1.2), r * rnd(0.55, 0.9), { max: Math.round(rnd(12, 20)) });
    if (Math.random() < 0.55) fxSpark(b.x, b.y, back + rnd(-1.1, 1.1), rnd(0.8, 2.8), 1.5, FIRE_SPARK, { max: 14, w: 1.6 });
    if (b.age % 4 === 0) fxPuff(bx, by, back, 0.3, r * 0.6, SMOKE, { L: 1, a: 0.22, gr: 0.25, max: 22, rise: -0.1 });
  }
  function fxExplosion(x, y, weak) {
    const n = weak ? 8 : 22;
    for (let i = 0; i < n; i++) fxFlame(x, y, rnd(0, TAU), rnd(1, weak ? 3 : 5), rnd(6, weak ? 10 : 15), { max: Math.round(rnd(16, 28)) });
    for (let i = 0; i < n * 1.5; i++) fxSpark(x, y, rnd(0, TAU), rnd(2, weak ? 5 : 9), 1.8, FIRE_SPARK);
    for (let i = 0; i < (weak ? 3 : 7); i++) fxPuff(x, y, rnd(0, TAU), rnd(0.5, 1.8), rnd(8, 14), SMOKE, { L: 1, a: 0.4, gr: 0.5, max: 40 });
    fxWave(x, y, 6, weak ? 44 : 96, '#FFB347', 3.5, 20);
  }

  // ---------- 7. Tukar: debu teleport ----------
  function fxTeleport(x, y) {
    for (let i = 0; i < 14; i++) fxPuff(x, y, rnd(0, TAU), rnd(0.8, 2.4), rnd(6, 11), ['#CDBF9F', '#D9B8C9', '#B9AD90', '#E8C3D8'], { L: 1, a: 0.45, gr: 0.5, max: 34 });
    for (let i = 0; i < 8; i++) fxSpark(x, y, rnd(0, TAU), rnd(1.5, 4.5), 1.6, [COL.swap, '#FFFFFF'], { max: 16, w: 1.6 });
    fxWave(x, y, 6, 46, COL.swap, 2.5, 16);
  }

  // ---------- 8. Melesat: petir ----------
  function fxDashBurst(p, d) {
    const back = Math.atan2(-d.y, -d.x);
    for (let i = 0; i < 5; i++) {
      const a = back + rnd(-1.1, 1.1), L = rnd(26, 52);
      fxBolt(p.x, p.y, p.x + Math.cos(a) * L, p.y + Math.sin(a) * L, i % 2 ? '#FFE66D' : COL.dash, { w: 2.6, max: 10, jag: 8 });
    }
    for (let i = 0; i < 16; i++) fxSpark(p.x, p.y, back + rnd(-1.2, 1.2), rnd(2, 8), 1.6, ['#FFE66D', '#FFFFFF', COL.dash], { max: 16 });
  }
  function fxDashStep(p, s) {
    const back = Math.atan2(-s.dashV.y, -s.dashV.x), a = back + rnd(-1.3, 1.3), L = rnd(18, 38);
    const ox = p.x + rnd(-p.r, p.r) * 0.6, oy = p.y + rnd(-p.r, p.r) * 0.6;
    fxBolt(ox, oy, ox + Math.cos(a) * L, oy + Math.sin(a) * L, Math.random() < 0.5 ? '#FFE66D' : COL.dash, { w: 2, max: 7, jag: 6 });
    if (Math.random() < 0.7) fxSpark(ox, oy, back + rnd(-0.8, 0.8), rnd(1.5, 4), 1.6, ['#FFE66D', '#FFFFFF'], { max: 12, w: 1.6 });
  }

  // ---------- 9. Kembali: tubuh tertinggal ----------
  function fxBackGhost(p, n) {
    fxAdd({ k: 'ghost', L: 0, x: p.x, y: p.y, r: p.r, c: TEAM[n], c2: COL.back, max: 13 });
    if (Math.random() < 0.8) fxSpark(p.x + rnd(-p.r, p.r) * 0.6, p.y + rnd(-p.r, p.r) * 0.6, rnd(0, TAU), rnd(0.4, 1.4), 2, [COL.back, '#FFFFFF'], { max: 14, w: 1.6 });
  }

  // ---------- 10. Meriam: api & debu ----------
  function fxMuzzle(x, y, d, px, py) {
    const a0 = Math.atan2(d.y, d.x);
    for (let i = 0; i < 8; i++) fxFlame(x, y, a0 + rnd(-0.5, 0.5), rnd(2, 6), rnd(6, 11));
    for (let i = 0; i < 20; i++) fxSpark(x, y, a0 + rnd(-0.8, 0.8), rnd(3, 9), 1.8, [COL.cannon, '#FFD166', '#FFFFFF']);
    for (let i = 0; i < 6; i++) fxPuff(x, y, a0 + rnd(-0.6, 0.6), rnd(0.8, 2.4), rnd(7, 11), SMOKE, { L: 1, a: 0.4, gr: 0.5, max: 36 });
    for (let i = 0; i < 10; i++) fxPuff(px, py, a0 + Math.PI + rnd(-1.4, 1.4), rnd(1, 2.6), rnd(6, 11), DUST, { L: 0, a: 0.5, gr: 0.5, max: 36 });
    fxFlame(x, y, a0, 0, 16, { max: 6, drag: 1 });
    fxWave(x, y, 6, 40, COL.cannon, 3, 12);
  }

  // Dipanggil tiap tickFx: efek yang menempel pada pemain
  function fxPlayerLoop(n, s, p) {
    if (!p) return;
    if (s.dashT > 0 && s.dashV) fxDashStep(p, s);
    if (s.sh && tick % 3 === 0) fxShadowWisp(s.sh.p);
    if (s.mr && tick % 5 === 0) fxMirrorGlint(s.mr.p);
  }

  // =====================================================================
  //  SKILL TAMBAHAN: Kembali, Balik Arah, Pelambat, Mengarah Bola,
  //  Mempercepat, Memperlambat, Magnet, Waktu Berhenti, Rantai
  // =====================================================================
  const tsOn = () => st.on && st.pl.some((s) => s.skill === 'timestop' && s.active);
  function setCd(n, frames) {
    const s = st.pl[n];
    if (!s.skill || s.cd > 0 || s.rp) return;
    if (window.SkillCfg && window.SkillCfg.nocd) { s.rp = true; return; }
    s.cd = s.cdMax = frames;
  }

  // ----- Waktu Berhenti: bola dibekukan, pemain didorong keluar bila menempel -----
  function holdBall() {
    ball.vx = 0;
    ball.vy = 0;
    for (const p of allP()) {
      const dx = p.x - ball.x, dy = p.y - ball.y, d = Math.hypot(dx, dy), min = p.r + ball.r;
      if (d >= min) continue;
      const nx = d > 0.001 ? dx / d : p.side === 'left' ? -1 : 1, ny = d > 0.001 ? dy / d : 0;
      p.x = ball.x + nx * min;
      p.y = ball.y + ny * min;
      limit(p);
    }
  }
  function startTimeStop(n) {
    const s = st.pl[n];
    s.uses = 0;
    s.active = true;
    s.t = s.tMax;
    s.tsV = { vx: ball.vx, vy: ball.vy };
    ring(ball.x, ball.y, COL.timestop, 110);
    burstParts(ball.x, ball.y, 22, [COL.timestop, '#ffffff', TEAM[n]], 4, 0.01, 0.04, 3);
    tone(900, 0.5, 0.05, 'sine', -700);
    noise(0.2, 0.04, 2000);
    return true;
  }

  // ----- Kotak Mempercepat / Memperlambat -----
  const boxH = (k) => (k === 'slowbox' ? BOX_HALF_SLOW : BOX_HALF);
  function boxSpot(n) {
    const p = P(n), d = st.pl[n].dir, dd = p.r + boxH(st.pl[n].skill) + 26;
    return { x: p.x + d.x * dd, y: p.y + d.y * dd };
  }
  function boxCheck(x, y, k) {
    const h = boxH(k);
    if (x < LX + h + 4 || x > W - LX - h - 4 || y < LY + h + 4 || y > H - LY - h - 4) return 'bounds';
    // Tidak boleh dipasang di kotak penalti (kedua sisi)
    for (const [x0, x1] of [[LX, LX + 105], [W - LX - 105, W - LX]])
      if (x + h > x0 && x - h < x1 && y + h > 155 && y - h < 405) return 'zone';
    for (const b of st.boxes) if (Math.abs(b.x - x) < h + boxH(b.k) + 4 && Math.abs(b.y - y) < h + boxH(b.k) + 4) return 'box';
    return null;
  }
  // dir = arah panah kotak Mempercepat (default: arah gerak terakhir pemain)
  function placeBox(n, x, y, dir) {
    const s = st.pl[n];
    if (!isBox(s.skill) || s.uses <= 0 || boxCheck(x, y, s.skill)) return false;
    s.uses--;
    const d = dir || s.dir;
    st.boxes.push({ n, k: s.skill, x, y, dx: d.x, dy: d.y, t: BOX_LIFE, in: false, pop: 1 });
    ring(x, y, COL[s.skill], 70);
    burstParts(x, y, 14, [COL[s.skill], '#ffffff', TEAM[n]], 3.2, 0.03, 0.05, 3);
    tone(s.skill === 'boost' ? 520 : 260, 0.12, 0.045, 'triangle', s.skill === 'boost' ? 300 : -120);
    return true;
  }
  function boxStep() {
    if (!st.boxes.length) return;
    for (const b of st.boxes) {
      b.t--;
      b.pop = Math.max(0, b.pop - 0.06);
      if (b.t <= 0) {
        ring(b.x, b.y, COL[b.k], 60);
        burstParts(b.x, b.y, 10, [COL[b.k], '#ffffff'], 3, 0.03, 0.06, 2.5);
      }
    }
    st.boxes = st.boxes.filter((b) => b.t > 0);
    if (tsOn() || orbitOwner() >= 0) return;
    for (const b of st.boxes) {
      const h = boxH(b.k), inside = Math.abs(ball.x - b.x) <= h && Math.abs(ball.y - b.y) <= h;
      if (inside && b.k === 'boost') {
        // Mempercepat: bola makin cepat searah panah kotak (dorongan awal + percepatan selama di dalam)
        const add = b.in ? BOOST_ACC : BOOST_ADD;
        const v0 = Math.hypot(ball.vx, ball.vy);
        ball.vx += b.dx * add;
        ball.vy += b.dy * add;
        const v = Math.hypot(ball.vx, ball.vy), cap = Math.max(BOOST_MAX, v0);
        if (v > cap) { ball.vx *= cap / v; ball.vy *= cap / v; }
        if (!b.in) {
          ball.pop = Math.max(ball.pop || 0, 0.6);
          ring(ball.x, ball.y, COL.boost, 50);
          burstParts(ball.x, ball.y, 8, [COL.boost, '#ffffff'], 3, 0.02, 0.06, 2.5);
          tone(800, 0.1, 0.04, 'triangle', 400);
        }
      } else if (inside && !b.in) {
        const sp = Math.hypot(ball.vx, ball.vy);
        if (sp > 0.3) {
          const ns = sp * SLOWBOX_MUL;
          ball.vx *= ns / sp; // arah tidak berubah
          ball.vy *= ns / sp;
          ball.pop = Math.max(ball.pop || 0, 0.6);
          ring(ball.x, ball.y, COL[b.k], 50);
          burstParts(ball.x, ball.y, 8, [COL[b.k], '#ffffff'], 3, 0.02, 0.06, 2.5);
          tone(b.k === 'boost' ? 800 : 220, 0.1, 0.04, 'triangle', b.k === 'boost' ? 400 : -100);
        }
      }
      b.in = inside;
    }
  }

  // ----- Area di sekitar pemain: Pelambat -----
  function areaAll() {
    if (tsOn() || orbitOwner() >= 0) return;
    for (const n of slots()) {
      const s = st.pl[n], p = P(n), R = AREA_R[s.skill];
      if (!R || !s.active || !p) continue;
      if (s.skill === 'brake' && dist(p, ball) < R) {
        ball.vx *= BRAKE_K;
        ball.vy *= BRAKE_K;
        if (Math.hypot(ball.vx, ball.vy) < 0.25) ball.vx = ball.vy = 0;
      }
    }
  }

  // Dipanggil saat efek skill berdurasi habis
  function onSkillEnd(n) {
    const s = st.pl[n];
    if (s.skill === 'timestop' && s.tsV) {
      ball.vx = s.tsV.vx; // bola lanjut dengan kecepatan sebelum berhenti
      ball.vy = s.tsV.vy;
      s.tsV = null;
      ring(ball.x, ball.y, COL.timestop, 90);
      tone(500, 0.3, 0.04, 'sine', 600);
    }
    s.rIn = false;
  }

  // ----- Rantai -----
  function chainDir(n) {
    // Rantai otomatis mengarah ke posisi lawan terdekat saat diaktifkan (lurus, tidak mengejar)
    const p = P(n), o = P(nearestFoe(n, p));
    const dx = o.x - p.x, dy = o.y - p.y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }
  function fireChain(n) {
    const s = st.pl[n], p = P(n);
    if (s.uses <= 0 || st.chains.some((c) => c.n === n)) return false;
    s.uses--;
    const d = chainDir(n);
    st.chains.push({ n, m: -1, dx: d.x, dy: d.y, len: 0, mode: 'out', t: 0, done: false });
    ring(p.x, p.y, COL.chain, 70);
    tone(300, 0.12, 0.04, 'sawtooth', 500);
    noise(0.08, 0.03, 1800);
    return true;
  }
  function chainStep() {
    if (!st.chains.length) return;
    for (const c of st.chains) {
      const n = c.n, s = st.pl[n], p = P(n);
      if (c.mode === 'out') {
        c.len = Math.min(CHAIN_LEN, c.len + CHAIN_SPD);
        const tx = p.x + c.dx * c.len, ty = p.y + c.dy * c.len;
        // Lawan pertama (di antara semua lawan) yang terkena rantai
        const m = foes(n).find((q) => {
          const o = P(q);
          return segDist(p.x, p.y, tx, ty, o.x, o.y) < o.r + 5;
        });
        if (m !== undefined) {
          const o = P(m), so = st.pl[m];
          c.m = m;
          {
            c.mode = 'lock';
            c.t = CHAIN_LOCK;
            c.tl = Math.max(110, Math.min(CHAIN_LEN, Math.hypot(o.x - p.x, o.y - p.y))); // batas tarikan = jarak saat kena
            s.lockT = Math.max(s.lockT, CHAIN_LOCK);
            applyStun(m, CHAIN_LOCK, COL.chain); // musuh stun
            s.uses = 0; // berhasil: sisa jatah hangus, cooldown penuh
            ring(o.x, o.y, COL.chain, 90);
            burstParts(o.x, o.y, 20, [COL.chain, '#ffffff', TEAM[n]], 4.5, 0.03, 0.05, 3);
            noise(0.15, 0.06, 900);
            tone(180, 0.2, 0.06, 'square', -60);
            shake = Math.max(shake, 5);
          }
        } else if (c.len >= CHAIN_LEN) {
          c.mode = 'burn'; // meleset: hangus
          c.t = 14;
          burstParts(tx, ty, 10, [COL.chain, '#FF8A3D', '#ffffff'], 3.5, 0.05, 0.06, 2.5);
          tone(220, 0.15, 0.03, 'sawtooth', -120);
        }
      } else if (c.mode === 'lock') {
        const m = c.m >= 0 ? c.m : 1 - n, o = P(m), so = st.pl[m];
        c.t--;
        // Pemilik bebas bergerak, tapi tidak boleh lebih jauh dari panjang rantai (c.tl) dari musuh yang stun.
        const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy);
        if (d > c.tl && d > 0.001) {
          const k = (d - c.tl) / d;
          p.x += dx * k; p.y += dy * k;
          limit(p); collidePlayer(p);
        }
        if (c.t <= 0 || s.lockT <= 0 || so.stunT <= 0) {
          c.done = true;
          s.lockT = 0;
          setCd(n, CHAIN_CD_HIT);
          ring(p.x, p.y, COL.chain, 60);
          ring(o.x, o.y, COL.chain, 60);
          tone(500, 0.12, 0.04, 'triangle', 300);
        }
      } else {
        c.t--;
        if (c.t <= 0) {
          c.done = true;
          if (s.uses <= 0) setCd(n, CHAIN_CD_MISS); // kedua rantai meleset
        }
      }
    }
    st.chains = st.chains.filter((c) => !c.done);
  }

    // ----- Mundur: rekam kondisi tiap REWIND_STEP frame, simpan 3 detik terakhir -----
  const deep = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
  function snapNow() {
    const pl = slots().map((n) => {
      const p = P(n), s = st.pl[n];
      return { n, x: p.x, y: p.y, vx: p.vx, vy: p.vy, skill: s.skill, uses: s.uses, cd: s.cd, cdMax: s.cdMax, rp: s.rp, active: s.active, t: s.t, stunT: s.stunT, slowT: s.slowT, slowHits: s.slowHits, left: s.left };
    });
    return {
      pl,
      b: { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy },
      o: deep({ walls: st.walls, portals: st.portals, boxes: st.boxes, shots: st.shots, bombs: st.bombs, ghosts: st.ghosts, cannons: st.cannons }),
      gm: [gmPh.slice(), gmEnv.slice()],
    };
  }
  function histRecord() {
    if (++histN % REWIND_STEP) return;
    hist.push(snapNow());
    if (hist.length > REWIND_FRAMES / REWIND_STEP + 1) hist.shift();
  }
  // Mulai Mundur: bukan teleport. Kondisi 3 detik terakhir diputar ulang TERBALIK (±1 detik) oleh rewindStep();
  // selama animasi, permainan berhenti. Setelah selesai, skill/cooldown dipulihkan (finishRewind).
  function doRewind(n) {
    if (!hist.length) { tone(150, 0.12, 0.04, 'sawtooth'); return false; }
    // lepas semua kendali sementara
    for (const m of slots()) {
      const q = st.pl[m];
      if (q.orbit) cancelOrbit(m);
      q.pull = null; q.bk = null; q.dashT = 0; q.preview = false; q.pv = null; q.lockT = 0;
    }
    st.chains = [];
    orbRel = null;
    window.Ach?.endTrack?.();
    const fr = [snapNow(), ...hist.slice().reverse()]; // dari sekarang -> 3 detik lalu
    hist = [];
    rw = { n, fr, pos: 0, rate: Math.min(1, fr.length / 30), tk: 0, hold: 14 };
    trail = [];
    ring(ball.x, ball.y, COL.rewind, 130);
    burstParts(ball.x, ball.y, 20, [COL.rewind, '#ffffff'], 4.5, 0.02, 0.04, 3);
    tone(900, 0.9, 0.05, 'sine', -650);
    noise(0.25, 0.04, 1800);
    shake = Math.max(shake, 3);
    return true;
  }
  function applyFrame(h) {
    for (const e of h.pl) {
      const p = P(e.n);
      if (!p) continue;
      p.x = e.x; p.y = e.y; p.vx = 0; p.vy = 0; p.touching = false;
    }
    ball.x = h.b.x; ball.y = h.b.y; ball.vx = 0; ball.vy = 0;
    Object.assign(st, h.o);
    for (const t of [0, 1]) GOAL_OFF[t] = gmOff(h.gm[0][t], h.gm[1][t]);
  }
  function finishRewind() {
    const n = rw.n, h = rw.fr[rw.fr.length - 1];
    for (const e of h.pl) {
      const p = P(e.n), q = st.pl[e.n];
      ring(p.x, p.y, COL.rewind, 70);
      p.vx = e.vx; p.vy = e.vy; p.touching = false;
      if (e.n === n || q.skill !== e.skill || q.skill === 'rewind' || q.skill === 'undo') continue; // skill Mundur & Batalkan Gol tidak dimundurkan
      Object.assign(q, { uses: e.uses, cd: e.cd, cdMax: e.cdMax, rp: e.rp, stunT: e.stunT, slowT: e.slowT, slowHits: e.slowHits, left: e.left });
      if (!['shadow', 'orbit', 'timestop', 'mirror'].includes(q.skill)) { q.active = e.active; q.t = e.t; }
    }
    ball.vx = h.b.vx; ball.vy = h.b.vy; ball.pop = 1;
    trail = [];
    gmPh = h.gm[0].slice(); gmEnv = h.gm[1].slice();
    hist = []; // riwayat dimulai lagi dari sini
    rw = null;
    for (const p of allP()) collidePlayer(p);
    ring(ball.x, ball.y, COL.rewind, 120);
    burstParts(ball.x, ball.y, 24, [COL.rewind, '#ffffff'], 4.5, 0.02, 0.04, 3);
    tone(500, 0.35, 0.05, 'sine', 700);
    noise(0.2, 0.04, 1800);
    shake = Math.max(shake, 4);
  }
  // Dipanggil game.js tiap langkah. true = animasi Mundur sedang berjalan (permainan dibekukan).
  function rewindStep() {
    if (!rw) return false;
    try {
      const fr = rw.fr, last = fr.length - 1, i = Math.min(last, Math.floor(rw.pos));
      applyFrame(fr[i]);
      rw.tk++;
      if (rw.tk % 5 === 0) tone(420 + 380 * (1 - i / Math.max(1, last)), 0.05, 0.02, 'triangle');
      if (rw.tk % 7 === 0) ring(ball.x, ball.y, COL.rewind, 55);
      if (i < last) rw.pos += rw.rate;
      else if (--rw.hold <= 0) finishRewind();
    } catch (e) {
      console.error('[Skills.rewindStep]', e);
      rw = null;
      return false;
    }
    return true;
  }

  // ----- Meriam -----
  function fireCannon(n) {
    const s = st.pl[n], me = P(n);
    if (s.uses <= 0) return false;
    s.uses--;
    startCd(n);
    const d = bombDir(n); // manusia: arah gerak terakhir; bot: membidik lawan
    const off = me.r + CANNON_R + 4;
    st.cannons.push({ n, x: me.x + d.x * off, y: me.y + d.y * off, vx: d.x * CANNON_SPD, vy: d.y * CANNON_SPD, r: CANNON_R, age: 0, rot: 0, bt: 0, hist: [], dead: false });
    ring(me.x + d.x * off, me.y + d.y * off, COL.cannon, 70);
    burstParts(me.x + d.x * off, me.y + d.y * off, 12, [COL.cannon, '#FFD166', '#ffffff'], 4, 0.03, 0.05, 3);
    fxMuzzle(me.x + d.x * off, me.y + d.y * off, d, me.x, me.y);
    tone(160, 0.2, 0.07, 'sawtooth', -90);
    noise(0.12, 0.06, 500);
    shake = Math.max(shake, 3);
    return true;
  }
  // Arah baru = campuran arah tumbukan & arah meriam. Tepat di tengah = lurus searah meriam.
  function cannonKnock(c, e, spd) {
    const dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy) || 1, cs = Math.hypot(c.vx, c.vy) || 1;
    let nx = dx / d + (c.vx / cs) * 0.6, ny = dy / d + (c.vy / cs) * 0.6;
    const l = Math.hypot(nx, ny) || 1;
    e.vx = (nx / l) * spd;
    e.vy = (ny / l) * spd;
    ring(e.x, e.y, COL.cannon, 60);
    burstParts(e.x, e.y, 10, [COL.cannon, '#ffffff'], 3.5, 0.03, 0.05, 2.8);
    tone(240, 0.12, 0.05, 'square', -80);
  }
  function updateCannons() {
    if (!st.cannons.length || tsOn()) return;
    for (const b of st.bombs) if (b.ckT > 0) b.ckT--;
    for (const c of st.cannons) {
      const ox = c.x, oy = c.y;
      c.x += c.vx; c.y += c.vy;
      portalPass(c, c.r, ox, oy);
      c.age++; c.rot += 0.25;
      if (c.bt > 0) c.bt--;
      c.hist.push({ x: c.x, y: c.y });
      if (c.hist.length > 8) c.hist.shift();
      if (!isAuth()) continue;
      // 1) pemain: stun 5 detik, meriam hancur
      const hitP = slots().find((m) => !(m === c.n && c.age < 20) && !(duo() && m !== c.n && teamOf(m) === teamOf(c.n)) && dist(P(m), c) < P(m).r + c.r);
      if (hitP !== undefined) {
        c.dead = true;
        applyStun(hitP, CANNON_STUN, COL.cannon);
        ring(c.x, c.y, COL.cannon, 100);
        burstParts(c.x, c.y, 26, [COL.cannon, '#FFD166', '#ffffff'], 5, 0.05, 0.04, 3.5);
        noise(0.3, 0.08, 300);
        tone(120, 0.3, 0.06, 'sawtooth', -60);
        shake = Math.max(shake, 6);
        continue;
      }
      // 2) tembok: tembok hancur, meriam hancur
      const w = st.walls.find((q) => q.hp > 0 && circleObb(q, c.x, c.y, c.r, ox, oy));
      if (w) {
        w.hp = 0;
        c.dead = true;
        removeBrokenWalls();
        burstParts(c.x, c.y, 14, [COL.cannon, '#ffffff'], 4, 0.05, 0.04, 3);
        continue;
      }
      // 3) bola: dibelokkan (meriam tetap jalan)
      if (c.bt <= 0 && orbitOwner() < 0 && dist(c, ball) < c.r + ball.r) {
        orbRel = null;
        cannonKnock(c, ball, Math.max(Math.hypot(c.vx, c.vy) * 1.4, Math.hypot(ball.vx, ball.vy)));
        ball.pop = 1;
        c.bt = 12;
      }
      // 4) bom: dibelokkan
      for (const b of st.bombs) {
        if (b.ckT > 0 || dist(c, b) >= c.r + (b.r || BOMB_R)) continue;
        cannonKnock(c, b, Math.max(Math.hypot(b.vx, b.vy), Math.hypot(c.vx, c.vy) * 0.9));
        b.ckT = 12;
      }
      if (c.x < LX - 2 || c.x > W - LX + 2 || c.y < LY || c.y > H - LY || c.age > CANNON_MAX_AGE) {
        c.dead = true;
        burstParts(c.x, c.y, 6, [COL.cannon, '#ffffff'], 2.5, 0, 0.1, 2);
      }
    }
    st.cannons = st.cannons.filter((c) => !c.dead);
  }
  function drawCannon(c) {
    ctx.save();
    for (let i = 0; i < c.hist.length; i++) {
      const h = c.hist[i], k = (i + 1) / c.hist.length;
      ctx.globalAlpha = k * 0.35;
      ctx.fillStyle = COL.cannon;
      ctx.beginPath();
      ctx.arc(h.x, h.y, c.r * (0.4 + 0.5 * k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.translate(c.x, c.y);
    const g = ctx.createRadialGradient(-c.r * 0.35, -c.r * 0.35, 2, 0, 0, c.r);
    g.addColorStop(0, '#6b7785');
    g.addColorStop(1, '#1b232c');
    ctx.fillStyle = g;
    ctx.strokeStyle = COL.cannon;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ----- Gawang Bergeser: gawang naik-turun saat ada pemain dengan skill ini aktif -----
  // Hanya gawang TIM YANG MENGAKTIFKAN skill yang bergerak; gawang lawan diam.
  function goalMoveStep() {
    if (GOAL_MOVE) return; // opsi Custom sudah menggerakkan gawang
    for (const t of [0, 1]) {
      const on = slots().some((n) => teamOf(n) === t && st.pl[n].skill === 'goalmove' && st.pl[n].active);
      if (!on && gmEnv[t] <= 0) { GOAL_OFF[t] = 0; continue; }
      gmEnv[t] = clamp(gmEnv[t] + (on ? GM_FADE : -GM_FADE), 0, 1);
      gmPh[t]++;
      GOAL_OFF[t] = gmOff(gmPh[t], gmEnv[t]);
      if (!on && gmEnv[t] <= 0) { gmPh[t] = 0; GOAL_OFF[t] = 0; }
    }
  }

  // Kick-off setelah gol: bersihkan efek posisi/gerak sesaat
  function resetNew() {
    for (const n of slots()) {
      const s = st.pl[n];
      if (s.skill === 'chain' && s.uses <= 0) setCd(n, s.lockT > 0 ? CHAIN_CD_HIT : CHAIN_CD_MISS);
      s.lockT = 0;
      s.pull = null;
      s.bk = null;
      s.rIn = false;
      if (s.skill === 'timestop' && s.active) {
        s.active = false;
        s.t = 0;
        s.tsV = null;
        startCd(n);
      }
    }
    st.chains = [];
  }

  // ---------- Layar perkenalan skill sebelum kick-off ----------
  const introEl = document.createElement('div');
  introEl.className = 'skill-intro';
  introEl.hidden = true;
  $('field').appendChild(introEl);
  function showIntro() {
    const card = (n) => {
      const sk = st.pl[n];
      return `<div class="sk-card t${n}"><small>${esc(pname(n))}</small><span class="sk-big" style="--sk:${COL[sk.skill]}">${icon(sk.skill)}</span><b>${NAME[sk.skill]}</b><p>${DESC[sk.skill]}</p>` +
        '</div>';
    };
    const team = (t) => slots().filter((n) => teamOf(n) === t).map(card).join('');
    introEl.innerHTML = `<h3>SKILL PERTANDINGAN</h3><div class="sk-cards${slots().length > 2 ? ' four' : ''}">${team(0)}<i>VS</i>${team(1)}</div>`;
    introEl.hidden = false;
  }

  // ---------- Siklus pertandingan ----------
  function clearAll() {
    Object.assign(st, { walls: [], shots: [], bombs: [], ghosts: [], portals: [], dying: [], rings: [], intro: 0, boxes: [], chains: [], cannons: [], fx: [], pl: Array.from({ length: want() }, mkPl) });
    hist = []; gmPh = [0, 0]; gmEnv = [0, 0]; GOAL_OFF[0] = GOAL_OFF[1] = 0; rw = null;
    if (!GOAL_MOVE) { GOAL_TOP = H / 2 - GOAL_HALF; GOAL_BOTTOM = H / 2 + GOAL_HALF; }
    syncSig = null; syncBurst = 0; syncAt = 0;
    slots().forEach((n) => (st.pl[n].dir = baseDir(n)));
    allP().forEach((q) => (q.r = PR));
    introEl.hidden = true;
  }

  // Pertandingan BARU / rematch: acak skill kedua tim
  function newMatch() {
    orbRel = null;
    clearAll();
    const cfg = window.SkillCfg;
    const pool = cfg ? (online() ? cfg.pool.filter((x) => !isNew(x)) : cfg.pool) : []; // skill baru khusus offline
    st.on = !!cfg && cfg.on && pool.length > 0;
    if (online() && !isAuth()) {
      // Guest: skill diacak host dan datang lewat applySync().
      syncUI(true);
      return;
    }
    if (st.on) {
      usedUndo = [0, 0, 0, 0];
      for (const n of slots()) {
        giveSkill(n, pickSkill(n, pool));
      }
      st.intro = INTRO_FRAMES;
      showIntro();
      announceSkills();
    }
    syncUI(true);
  }
  function announceSkills() {
    if (duo()) say('Skill: ' + slots().map((n) => `${pname(n)} = ${NAME[st.pl[n].skill]}`).join(' · '));
    else say(`Skill: ${nm(0)} = ${NAME[st.pl[0].skill]} · ${nm(1)} = ${NAME[st.pl[1].skill]}`);
  }
  function giveSkill(n, k) {
    const s = st.pl[n];
    s.skill = k;
    s.uses = START[k].uses;
    s.tMax = START[k].dur;
    s.left = LIMIT[k] || 0;
    s.fresh = 100;
  }
  // Pilih skill acak untuk slot n. Batalkan Gol tidak muncul lagi bila slot itu sudah memakainya (1× per pertandingan).
  function pickSkill(n, pool) {
    const base = pool || (window.SkillCfg ? window.SkillCfg.pool : []);
    const list = base.filter((k) => k !== 'undo' || (usedUndo[n] | 0) < 2);
    const use = list.length ? list : base.filter((k) => k !== 'undo');
    return use.length ? use[(Math.random() * use.length) | 0] : null;
  }
  // Opsi Custom "skill diacak tiap gol": dipanggil game.js sebelum kick-off berikutnya
  function rerollAll() {
    const cfg = window.SkillCfg;
    if (!cfg || !cfg.reroll || !st.on || online()) return;
    orbRel = null;
    clearAll();
    for (const n of slots()) {
      const k = pickSkill(n);
      if (!k) continue;
      giveSkill(n, k);
    }
    st.intro = INTRO_FRAMES;
    showIntro();
    announceSkills();
    syncUI(true);
  }

  // ----- Batalkan Gol -----
  let usedUndo = [0, 0, 0, 0];
  let undoSt = null; // { holders: [slot pemain manusia] } selama jendela 5 detik
  const undoEl = document.createElement('div');
  undoEl.className = 'undo-box';
  undoEl.hidden = true;
  undoEl.innerHTML = '<button type="button" class="undo-btn"><span>BATALKAN GOL</span><b>5</b></button><i class="undo-bar"><u></u></i>';
  $('field').appendChild(undoEl);
  undoEl.querySelector('.undo-btn').addEventListener('click', () => {
    if (undoSt && undoSt.holders.length) cancelGoal(undoSt.holders[0]);
  });
  // Dipanggil game.js setelah animasi gol. null = tidak ada; {auto:true,n} = langsung dibatalkan; {auto:false} = jendela 5 dtk dibuka.
  function undoOffer(scorer) {
    if (!st.on || online()) return null;
    const holders = slots().filter((n) => teamOf(n) === 1 - scorer && st.pl[n].skill === 'undo' && st.pl[n].uses > 0);
    if (!holders.length) return null;
    if (score[scorer] >= WINS) return { auto: true, n: holders[0] }; // gol akhir lawan: otomatis aktif
    const bot = holders.find((n) => isBot(n));
    if (bot !== undefined && score[scorer] >= Math.max(2, WINS - 3)) return { auto: true, n: bot }; // bot memakainya saat lawan hampir menang
    const hum = holders.filter((n) => humanControlled(n));
    if (!hum.length) return null;
    undoSt = { holders: hum };
    undoEl.hidden = false;
    undoEl.querySelector('b').textContent = '5';
    undoEl.querySelector('u').style.width = '100%';
    syncUI(true);
    return { auto: false };
  }
  function undoTick(sec) {
    if (!undoSt) return;
    undoEl.querySelector('b').textContent = String(Math.max(1, Math.ceil(sec)));
    undoEl.querySelector('u').style.width = Math.max(0, (sec / 5) * 100).toFixed(1) + '%';
  }
  function undoClose() {
    if (!undoSt && undoEl.hidden) return;
    undoSt = null;
    undoEl.hidden = true;
    syncUI(true);
  }
  // Skill terpakai: diganti skill acak lain
  function undoUsed(n) {
    usedUndo[n] = (usedUndo[n] | 0) + 1;
    const s = st.pl[n], p = P(n);
    const left = 2 - usedUndo[n];
    let k = null;
    if (left > 0) {
      s.uses = left; // masih ada sisa jatah, skill tetap Batalkan Gol
    } else {
      const keep = { dir: s.dir, lastPress: s.lastPress };
      st.pl[n] = Object.assign(mkPl(), keep);
      k = pickSkill(n);
      if (k) giveSkill(n, k);
    }
    if (p) ring(p.x, p.y, COL.undo, 90);
    const f = document.createElement('div');
    f.className = 'undo-flash';
    f.textContent = left > 0 ? 'GOL DIBATALKAN! Sisa ' + left + '×' : 'GOL DIBATALKAN!';
    $('field').appendChild(f);
    setTimeout(() => f.remove(), 1800);
    if (k) say(`Skill baru ${pname(n)}: ${NAME[k]}`);
    syncUI(true);
  }

  // Kick-off setelah gol: skill, tembok, slow, cooldown & durasi aktif TETAP. Hanya stun hilang.
  function onKickoffReset() {
    gmPh = [0, 0]; gmEnv = [0, 0]; GOAL_OFF[0] = GOAL_OFF[1] = 0;
    orbRel = null;
    st.shots = [];
    // Bola hantu yang terlalu dekat titik tengah digeser agar tidak mendorong bola saat kick-off.
    for (const g of st.ghosts) {
      g._pe = null;
      const dx = g.x - ball.x, dy = g.y - ball.y, d = Math.hypot(dx, dy), safe = ball.r + gr() + 70;
      if (d < safe) {
        const a = d > 1 ? Math.atan2(dy, dx) : teamOf(g.n) === 0 ? Math.PI : 0;
        g.x = clamp(ball.x + Math.cos(a) * safe, LX + ball.r, W - LX - ball.r);
        g.y = clamp(ball.y + Math.sin(a) * safe, LY + ball.r, H - LY - ball.r);
      }
      g.px = g.x; g.py = g.y;
    }
    // Bom aktif dibawa ke titik bola saat kick-off berikutnya, lalu bergerak
    // berlawanan arah dengan bola utama. Bom yang sudah habis tetap hilang.
    const kickoffSpeed = Math.hypot(ball.vx, ball.vy) || 1;
    for (const b of st.bombs) {
      b.x = ball.x;
      b.y = ball.y;
      b.px = ball.x;
      b.py = ball.y;
      const ownSpeed = b.speed || BOMB_SPD;
      b.vx = -(ball.vx / kickoffSpeed) * ownSpeed;
      b.vy = -(ball.vy / kickoffSpeed) * ownSpeed;
      b.age = 0;
      b.dead = false;
      b.onBall = true;
    }
    for (const n of slots()) {
      const s = st.pl[n];
      // Jangan mengubah kecepatan kick-off yang baru saja dibuat game.js.
      if (s.orbit) {
        s.orbit = null;
        s.active = false;
        s.t = 0;
        if (s.uses <= 0) startCd(n);
      }
      s.preview = false;
      s.pv = null;
      s.trail = [];
      s.stunT = 0;
      s.dashT = 0;
      s.dir = baseDir(n);
      if (s.sh && P(n)) {
        s.sh.p.x = P(n).x + (teamOf(n) === 0 ? 45 : -45);
        s.sh.p.y = P(n).y;
        s.sh.p.vx = s.sh.p.vy = 0;
      }
    }
    resetNew();
    syncRadius(true);
    for (const p of allP()) collidePlayer(p);
  }

  // s = tim yang mencetak gol
  function onGoal(s) {
    st.shots = []; st.cannons = []; hist = [];
    // Bom yang masih aktif tidak dihapus saat gol; posisinya dipindah ke bola
    // dan arahnya dibalik ketika kick-off baru dimulai.
    for (const n of slots()) {
      const q = st.pl[n];
      if (q.orbit) cancelOrbit(n);
      q.preview = false;
      q.pv = null;
      q.dashT = 0;
    }
    // Portal hilang setelah 2 gol (gol tim maupun lawan), lalu bisa dipasang lagi.
    for (const n of slots()) {
      const q = st.pl[n];
      if (q.skill === 'portal' && st.portals.some((pt) => pt.n === n) && ++q.pgoals >= PORTAL_GOALS) expirePortals(n);
    }
    const c = 1 - s;
    // Bayangan milik tim yang kebobolan gagal (pada VS 2 BOT bisa lebih dari satu; tambahan skor dihitung sekali)
    const sh = slots().filter((n) => teamOf(n) === c && st.pl[n].skill === 'shadow' && st.pl[n].active);
    if (st.on && sh.length) {
      const extra = Math.max(0, score[c] - 1);
      score[s] += extra;
      sh.forEach((n) => endShadow(n));
      say(`Bayangan gagal! ${nm(s)} dapat +${extra + 1} skor`);
    }
  }

  function onFinish() {
    if (!st.on) return;
    clearAll();
    st.on = false;
    syncUI(true);
  }

  function growScale(s) {
    if (!s.active || s.skill !== 'grow' || !s.tMax) return 1;
    const elapsedFrames = clamp(s.tMax - s.t, 0, s.tMax);
    if (elapsedFrames < GROW_IN) return 1 + (GROW_SIZE - 1) * (elapsedFrames / GROW_IN);
    if (elapsedFrames < GROW_IN + GROW_HOLD) return GROW_SIZE;
    const down = (elapsedFrames - GROW_IN - GROW_HOLD) / GROW_OUT;
    return 1 + (GROW_SIZE - 1) * (1 - clamp(down, 0, 1));
  }
  function syncRadius(now) {
    for (const n of slots()) {
      const p = P(n), s = st.pl[n];
      if (!p) continue;
      const factor = s.active ? (s.skill === 'big' ? BIG_SIZE : s.skill === 'fast' ? FAST_SIZE : s.skill === 'grow' ? growScale(s) : 1) : 1;
      const target = PR * factor;
      // Besar Drastis mengikuti kurva animasi tepat agar mencapai +40% penuh.
      if (now || s.skill === 'grow' || Math.abs(target - p.r) < 0.05) p.r = target;
      else p.r += (target - p.r) * 0.18;
    }
  }

  // ---------- Efek status ----------
  function applySlow(t) {
    const s = st.pl[t];
    s.slowT = s.slowT > 0 ? s.slowT + SLOW_FRAMES : SLOW_FRAMES;
    // Kena slow 3 kali = stun 6 detik
    if (++s.slowHits >= 3) {
      s.slowHits = 0;
      applyStun(t, SLOW_STUN_FRAMES, COL.slow);
    }
  }
  function applyStun(t, frames, c) {
    const s = st.pl[t];
    s.stunT = Math.max(s.stunT, frames);
    s.stunC = c;
  }

  // ---------- Penggunaan skill ----------
  const humanControlled = (n) => (online() ? n === me() : HUMANS.includes(n));
  function baseOk() {
    return st.on && live() && !paused && !over && kickoff <= 0 && goalTimer <= 0 && st.intro <= 0 && !rw;
  }
  function canUse(n) {
    const s0 = st.pl[n];
    if (s0 && s0.skill === 'undo') return !!undoSt && undoSt.holders.includes(n) && st.on && !paused && !over;
    if (!baseOk()) return false;
    const s = st.pl[n];
    if (!s || !s.skill) return false;
    if (isPlace(s.skill)) return s.preview || s.uses > 0;
    if (s.skill === 'slow' || s.skill === 'freeze' || s.skill === 'bomb' || s.skill === 'ghost') return s.uses > 0;
    if (s.skill === 'dash') return s.uses > 0 && s.stunT <= 0 && s.dashT <= 0 && !s.pull && (isAuth() || s.lock <= performance.now());
    if (s.skill === 'orbit') return !!s.orbit || (s.uses > 0 && !s.active && canOrbit(n));
    if (s.skill === 'swap') return s.uses > 0 && orbitOwner() < 0 && !tsOn();
    if (s.skill === 'back') return s.uses > 0 && !s.pull && (!s.bk || s.stunT <= 0);
    if (s.skill === 'rewind') return s.uses > 0 && !tsOn() && hist.length > 0;
    if (s.skill === 'chain') return s.uses > 0 && !st.chains.some((c) => c.n === n);
    if (s.skill === 'timestop') return s.uses > 0 && !s.active && !tsOn() && orbitOwner() < 0;
    return s.uses > 0 && !s.active;
  }
  const canPress = (n) => humanControlled(n) && canUse(n);

  const ballInOppHalf = (n) => (teamOf(n) === 0 ? ball.x > W / 2 : ball.x < W / 2);
  const ballInOwnHalf = (n) => (teamOf(n) === 0 ? ball.x < W / 2 : ball.x > W / 2);
  const orbitOwner = () => st.pl.findIndex((s) => !!s.orbit);

  function canOrbit(n) {
    const p = P(n);
    if (!p || !ballInOwnHalf(n) || orbitOwner() !== -1 || tsOn()) return false;
    const d = dist(p, ball);
    return d <= ORBIT_RANGE && d >= p.r + ball.r - 0.5;
  }

  function beginOrbit(n) {
    if (!canOrbit(n)) return false;
    const s = st.pl[n], p = P(n);
    const dx = ball.x - p.x, dy = ball.y - p.y;
    s.uses--;
    s.active = true;
    s.t = 0;
    s.tMax = 0; // Orbit tidak memiliki batas waktu
    const radius = Math.max(p.r + ball.r + 1, Math.hypot(dx, dy));
    s.orbit = {
      angle: Math.atan2(dy, dx),
      radius,
      v: ORBIT_START_V, // kecepatan linear (px/frame): terus bertambah sampai dilepas
      speed: ORBIT_START_V / radius, // kecepatan sudut (rad/frame)
      frames: 0,
    };
    ring(p.x, p.y, COL.orbit, 90);
    burstParts(ball.x, ball.y, 14, [COL.orbit, '#ffffff'], 3.5, 0.03, 0.05, 3);
    tone(520, 0.12, 0.045, 'triangle', 280);
    return true;
  }

  function cancelOrbit(n) {
    const s = st.pl[n];
    if (!s.orbit) return;
    s.orbit = null;
    s.active = false;
    s.t = 0;
    if (s.uses <= 0) startCd(n);
    orbRel = null;
    if (ball) ball.vx = ball.vy = 0;
  }

  function releaseOrbit(n) {
    const s = st.pl[n], o = s.orbit;
    if (!o) return;
    // Kecepatan lepas = kecepatan linear orbit saat ini (tanpa batas atas). Kecepatan ini TIDAK meluruh sendiri;
    // hanya pantulan yang mengurangi sedikit demi sedikit sampai kembali ke kecepatan normal.
    const speed = Math.max(6, o.v != null ? o.v : o.speed * o.radius);
    // Arah pelepasan mengikuti garis singgung orbit; salah timing dapat mengarah ke gawang sendiri.
    ball.vx = -Math.sin(o.angle) * speed;
    ball.vy = Math.cos(o.angle) * speed;
    s.orbit = null;
    s.active = false;
    s.t = 0;
    orbRel = { b: 0, pvx: ball.vx, pvy: ball.vy, slow: false, n, g: ORBIT_GRACE };
    if (n === 0) window.Ach?.startTrack();
    if (s.uses <= 0) startCd(n);
    ring(ball.x, ball.y, COL.orbit, 75);
    burstParts(ball.x, ball.y, 18, [COL.orbit, '#ffffff', TEAM[n]], 4.5, 0.06, 0.04, 3.5);
    tone(760, 0.16, 0.05, 'triangle', -260);
    return true;
  }

  // Dipanggil game.js sebelum fisika bola. Return true berarti bola sedang dikendalikan Orbit.
  function updateBallSkill() {
    if (tsOn()) { // Waktu Berhenti: bola diam di tempat
      holdBall();
      return true;
    }
    const n = orbitOwner();
    if (n < 0) return false;
    const s = st.pl[n], o = s.orbit, p = P(n);
    if (!o || !p) return false;

    // Orbit TIDAK bisa terlepas sendiri (lawan/tembok tidak memutusnya): hanya lepas saat pemilik menekan skill lagi.
    o.frames++;
    o.v = (o.v != null ? o.v : o.speed * o.radius) + ORBIT_ACCEL_V; // makin lama makin cepat, tanpa batas
    o.speed = o.v / o.radius;
    o.angle += o.speed;
    const sideMin = teamOf(n) === 0 ? LX + ball.r : W / 2 + 25 + ball.r;
    const sideMax = teamOf(n) === 0 ? W / 2 - 25 - ball.r : W - LX - ball.r;
    const nextX = p.x + Math.cos(o.angle) * o.radius;
    const nextY = p.y + Math.sin(o.angle) * o.radius;
    ball.x = clamp(nextX, sideMin, sideMax);
    ball.y = clamp(nextY, LY + ball.r, H - LY - ball.r);
    const tangent = o.v;
    ball.vx = -Math.sin(o.angle) * tangent;
    ball.vy = Math.cos(o.angle) * tangent;
    ball.spin = (ball.spin || 0) + o.speed * 2;

    return true; // bola menembus tembok selama orbit; tidak ada yang bisa memutusnya
  }

  // Tukar posisi pemain & bola. Pemain bergerak: bola meluncur searah geraknya.
  // Pemain diam: bola tetap membawa arah lajunya sebelum tertukar.
  function doSwap(n) {
    const s = st.pl[n], p = P(n);
    const bs = Math.hypot(ball.vx, ball.vy), ps = Math.hypot(p.vx, p.vy);
    let vx = ball.vx, vy = ball.vy;
    if (ps > 0.5) {
      const sp = Math.max(bs, 5);
      vx = (p.vx / ps) * sp;
      vy = (p.vy / ps) * sp;
    }
    const ox = p.x, oy = p.y, bx = ball.x, by = ball.y;
    ring(ox, oy, COL.swap, 80);
    ring(bx, by, COL.swap, 80);
    burstParts(ox, oy, 14, [COL.swap, '#ffffff'], 4, 0.03, 0.05, 3);
    burstParts(bx, by, 14, [COL.swap, '#ffffff'], 4, 0.03, 0.05, 3);
    fxTeleport(ox, oy);
    fxTeleport(bx, by);
    p.x = bx;
    p.y = by;
    limit(p); // pemain tetap di area sendiri
    collidePlayer(p);
    p.vx = p.vy = 0;
    p.touching = false;
    ball.x = ox;
    ball.y = oy;
    ball.vx = vx;
    ball.vy = vy;
    ball.pop = 1;
    trail = [];
    s.uses = 0;
    startCd(n);
    tone(600, 0.1, 0.045, 'triangle', 300);
    tone(900, 0.1, 0.04, 'triangle', -300, 0.08);
    return true;
  }

  function use(n) {
    const s = st.pl[n], p = P(n);
    switch (s.skill) {
      case 'undo':
        if (undoSt && undoSt.holders.includes(n)) { cancelGoal(n); return true; }
        return false;
      case 'wall':
      case 'portal':
      case 'boost':
      case 'slowbox':
        if (!s.preview) {
          s.preview = true;
          updPreview(n);
          tone(520, 0.05, 0.03, 'triangle');
          return true;
        }
        updPreview(n);
        if (s.pv && s.pv.ok && (s.skill === 'wall' ? placeWall(n, s.pv.x, s.pv.y, s.pv.a) : isBox(s.skill) ? placeBox(n, s.pv.x, s.pv.y) : placePortal(n, s.pv.x, s.pv.y))) {
          s.preview = false;
          s.pv = null;
          return true;
        }
        s.inv = 18;
        tone(150, 0.12, 0.04, 'sawtooth');
        return false;
      case 'back':
        if (!s.bk) {
          // Klik pertama: lingkaran muncul di posisi pemain (diam di tempat)
          s.bk = { x: p.x, y: p.y };
          ring(p.x, p.y, COL.back, 60);
          tone(520, 0.06, 0.03, 'triangle');
          return true;
        }
        // Klik kedua: pemain tertarik cepat ke lingkaran
        if (s.stunT > 0) {
          s.inv = 18;
          tone(150, 0.12, 0.04, 'sawtooth');
          return false;
        }
        s.uses--;
        s.pull = { x: s.bk.x, y: s.bk.y, n: 0 };
        s.bk = null;
        ring(p.x, p.y, COL.back, 80);
        burstParts(p.x, p.y, 12, [COL.back, '#ffffff'], 3.5, 0.02, 0.05, 3);
        tone(300, 0.14, 0.05, 'sawtooth', 500);
        if (s.uses <= 0) startCd(n);
        return true;
      case 'rewind':
        if (!doRewind(n)) return false;
        s.uses = 0;
        startCd(n);
        return true;
      case 'cannon':
        return fireCannon(n);  
      case 'chain':
        return fireChain(n);
      case 'timestop':
        if (!ballInOwnHalf(n) || tsOn() || orbitOwner() >= 0) {
          s.inv = 40;
          tone(150, 0.12, 0.04, 'sawtooth');
          return false;
        }
        return startTimeStop(n);
      case 'ghost':
        throwGhost(n);
        return true;
      case 'grow':
        if (s.uses <= 0 || s.active) return false;
        s.uses--;
        s.active = true;
        s.tMax = s.t = GROW_IN + GROW_HOLD + GROW_OUT;
        ring(p.x, p.y, COL.grow, 100);
        fxGrowWave(p);
        burstParts(p.x, p.y, 22, [COL.grow, '#FFE2C4', '#FFFFFF'], 4.8, 0.02, 0.035, 3.4);
        tone(240, 0.12, 0.055, 'triangle', 420);
        tone(740, 0.1, 0.035, 'sine', -260, 0.08);
        return true;
      case 'dash':
        return doDash(n);
      case 'slow':
      case 'freeze':
        fire(n, s.skill);
        return true;
      case 'bomb':
        throwBomb(n);
        return true;
      case 'mirror':
        return startMirror(n);
      case 'swap':
        return doSwap(n);
      case 'orbit':
        // Tekan tombol skill sekali lagi untuk melepas bola.
        if (s.orbit) return releaseOrbit(n);
        return beginOrbit(n);
      case 'dark':
        if (!ballInOppHalf(n)) {
          s.inv = 40;
          tone(150, 0.12, 0.04, 'sawtooth');
          return false;
        }
      // lanjut ke aktivasi
      case 'goalmove':
      case 'brake':
      case 'fast':
      case 'big':
      case 'shadow':
        s.uses = 0;
        if (LIMIT[s.skill]) s.left--;
        s.active = true;
        s.t = s.tMax;
        ring(p.x, p.y, COL[s.skill], s.skill === 'big' ? 90 : 70);
        burstParts(p.x, p.y, 18, [COL[s.skill], '#F3F0E7'], 4, 0.02, 0.04, 3);
        if (s.skill === 'shadow') spawnShadow(n);
        if (s.skill === 'fast') [400, 600, 900].forEach((f, i) => tone(f, 0.1, 0.035, 'triangle', 0, i * 0.06));
        else if (s.skill === 'dark') tone(80, 0.5, 0.06, 'sawtooth', -30);
        else tone(110, 0.3, 0.06, 'sawtooth', 60);
        return true;
    }
    return false;
  }


  // Tombol/keyboard "pemain 0" = pemain lokal. Saat online, itu menjadi Biru (host) atau Merah (guest).
  function press(n) {
    if (online()) {
      if (n !== 0) return false;
      n = me();
    }
    if (!canPress(n)) return false;
    const now = performance.now(), s = st.pl[n];
    if (now - s.lastPress < 120) return false;
    s.lastPress = now;
    const ok = isAuth() ? use(n) : guestPress(n);
    syncUI(true);
    return ok;
  }

  // ---------- Online ----------
  // Guest: validasi ringan di sisi lokal lalu kirim permintaan ke host (host yang menjalankan skill).
  function guestPress(n) {
    const s = st.pl[n];
    if (s.skill === 'dash') {
      // Prediksi lokal: guest langsung melesat tanpa menunggu host; host menjalankan hal yang sama.
      if (s.stunT > 0) return false;
      startDash(n);
      s.uses = 0;
      s.lock = performance.now() + (net.rtt || 120) + 500;
      window.MSOnline?.sendSkill({ a: 'use' });
      return true;
    }
    if (isPlace(s.skill)) {
      if (!s.preview) {
        s.preview = true;
        updPreview(n);
        tone(520, 0.05, 0.03, 'triangle');
        return true;
      }
      updPreview(n);
      if (s.pv && s.pv.ok) {
        if (s.skill === 'wall') window.MSOnline?.sendSkill({ a: 'wall', x: q1(s.pv.x), y: q1(s.pv.y), g: q3(s.pv.a) });
        else window.MSOnline?.sendSkill({ a: 'portal', x: q1(s.pv.x), y: q1(s.pv.y) });
        s.preview = false;
        s.pv = null;
        tone(190, 0.12, 0.05, 'square', -60);
        return true;
      }
      s.inv = 18;
      tone(150, 0.12, 0.04, 'sawtooth');
      return false;
    }
    if (s.skill === 'dark' && !ballInOppHalf(n)) {
      s.inv = 40;
      tone(150, 0.12, 0.04, 'sawtooth');
      return false;
    }
    window.MSOnline?.sendSkill({ a: 'use' });
    tone(620, 0.06, 0.03, 'triangle', 120);
    return true;
  }

  // Host: menjalankan permintaan skill dari guest (pemain Merah = indeks 1).
  function remote(d) {
    if (!d || !st.on || !online() || !isAuth()) return;
    const n = 1, s = st.pl[n];
    if (!s) return;
    if (!canUse(n)) return;
    const now = performance.now();
    if (now - s.lastPress < 100) return;
    s.lastPress = now;
    if (d.a === 'wall') {
      const x = +d.x, y = +d.y, g = +d.g;
      if (s.skill !== 'wall' || s.uses <= 0) return;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(g)) return;
      if (dist(P(n), { x, y }) > 170) return; // tembok harus dekat pemain
      if (placeWall(n, x, y, g)) {
        s.preview = false;
        s.pv = null;
      }
    } else if (d.a === 'portal') {
      const x = +d.x, y = +d.y;
      if (s.skill !== 'portal' || s.uses <= 0) return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (dist(P(n), { x, y }) > 170) return;
      if (placePortal(n, x, y)) {
        s.preview = false;
        s.pv = null;
      }
    } else if (d.a === 'use' && !isPlace(s.skill)) use(n);
    syncUI(true);
  }

  // Penanda perubahan diskret skill; host memakainya untuk mengirim state lebih cepat saat ada kejadian.
  function sig() {
    if (!st.on) return '';
    let r = '';
    for (const s of st.pl)
      r += (s.uses | 0) + (s.active ? 'a' : '') + (s.stunT > 0 ? 's' : '') + (s.slowT > 0 ? 'l' : '') + (s.cd > 0 ? 'c' : '') + (s.rp ? 'r' : '') + (s.orbit ? 'o' : '') + (s.sh ? 'h' : '') + '|';
    for (const w of st.walls) r += w.hp;
    r += 'P' + st.portals.length;
    return r + ':' + st.shots.length + ':' + (st.bombs.length + st.ghosts.length);
  }

  const q1 = (v) => Math.round(v * 10) / 10;
  const q2 = (v) => Math.round(v * 100) / 100;
  const q3 = (v) => Math.round(v * 1000) / 1000;
  const q5 = (v) => Math.round(v * 100000) / 100000;
  const wkey = (n, x, y) => n + ':' + Math.round(x) + ':' + Math.round(y);

  // Kondisi skill ringkas untuk dikirim host / disimpan snapshot.
  function getSync() {
    if (!st.on) return null;
    return {
      i: st.intro,
      p: st.pl.map((s) => ({
        k: s.skill, u: s.uses, a: s.active ? 1 : 0, t: s.t, m: s.tMax,
        sl: s.slowT, sn: s.stunT, c: s.stunC,
        cd: s.cd, cm: s.cdMax, rp: s.rp ? 1 : 0, l: s.left, pg: s.pgoals,
        o: s.orbit ? [q5(s.orbit.angle), q1(s.orbit.radius), q5(s.orbit.speed), s.orbit.frames] : 0,
        w: s.sh ? [q1(s.sh.p.x), q1(s.sh.p.y), q2(s.sh.p.vx), q2(s.sh.p.vy)] : 0,
      })),
      w: st.walls.map((w) => [q1(w.x), q1(w.y), q3(w.a), w.hp, w.n]),
      s: st.shots.map((b) => [b.n, b.k === 'freeze' ? 1 : 0, q1(b.x), q1(b.y), q2(b.vx), q2(b.vy), b.age]),
      b: st.bombs.map((b) => [b.n, q1(b.x), q1(b.y), q2(b.vx), q2(b.vy), b.age, q2(b.r || BOMB_R), q2(b.speed || Math.hypot(b.vx, b.vy)), b.curve === -1 ? -1 : 1]),
      gh: st.ghosts.map((g) => [g.n, q1(g.x), q1(g.y), q2(g.vx), q2(g.vy), g.age, g.curve === -1 ? -1 : 1]),
      po: st.portals.map((pt) => [pt.n, pt.i, q1(pt.x), q1(pt.y)]),
    };
  }

  // Versi hemat untuk dikirim tiap paket state: data lengkap hanya saat ada perubahan diskret,
  // ada objek bergerak (peluru/bom/bola hantu/orbit/bayangan), atau tiap 0,5 detik sebagai pengaman.
  function getSyncNet() {
    if (!st.on) return null;
    const now = performance.now(), sg = sig();
    if (sg !== syncSig) { syncSig = sg; syncBurst = 4; } // beberapa paket berturut-turut: paket bisa hilang
    const dyn = st.shots.length || st.bombs.length || st.ghosts.length || st.pl.some((s) => s.orbit || s.sh);
    if (dyn || syncBurst > 0 || now - syncAt >= 500) {
      if (syncBurst > 0) syncBurst--;
      syncAt = now;
      return getSync();
    }
    return null;
  }

  function wallBreakFx(w) {
    fxWallBreak(w);
    st.dying.push({ x: w.x, y: w.y, a: w.a, c: w.c, s: w.s, n: w.n, hp: 0, flash: 1, t: 1 });
    for (let i = 0; i < 5; i++) {
      const u = ((i + 0.5) / 5 - 0.5) * WALL_LEN;
      burstParts(w.x + u * w.c, w.y + u * w.s, 4, ['#F3F0E7', COL.wall, TEAM[w.n], '#2b3a49'], 4.5, 0.12, 0.03, 4);
    }
    ring(w.x, w.y, TEAM[w.n], 90);
    noise(0.3, 0.08, 500);
  }

  // Menerapkan state skill dari host (guest) atau memulihkan snapshot (host, restore = true).
  function applySync(d, restore) {
    if (!d) return;
    const fx = !isAuth() && !restore; // efek suara/partikel hanya di guest saat ada perubahan
    const lf = !isAuth() ? lagFrames() + net.qd / 16.667 : 0; // maju setengah RTT + antrean paket agar objek cepat tidak tertinggal
    const hadSkills = !!st.pl[0].skill && !!st.pl[1].skill;
    st.on = true;

    d.p.forEach((q, n) => {
      const s = st.pl[n], p = P(n);
      const o = { active: s.active, uses: s.uses, stun: s.stunT, orbit: !!s.orbit };
      s.skill = q.k; s.uses = q.u; s.active = !!q.a; s.t = q.t; s.tMax = q.m;
      s.slowT = q.sl; s.stunT = q.sn; s.stunC = q.c || COL.freeze;
      s.cd = q.cd; s.cdMax = q.cm || 1; s.rp = !!q.rp; s.left = q.l; s.pgoals = q.pg | 0;
      s.orbit = q.o ? { angle: q.o[0] + q.o[2] * lf, radius: q.o[1], speed: q.o[2], frames: q.o[3] + lf } : null;
      if (q.w) {
        const x = q.w[0] + q.w[2] * lf, y = q.w[1] + q.w[3] * lf;
        if (s.sh) {
          const sp = s.sh.p;
          if (restore || Math.hypot(x - sp.x, y - sp.y) > 60) { sp.x = x; sp.y = y; }
          else { sp.x += (x - sp.x) * 0.5; sp.y += (y - sp.y) * 0.5; }
          sp.vx = q.w[2]; sp.vy = q.w[3];
        } else {
          const sp = mk(x, n === 0 ? 'left' : 'right', 0);
          sp.y = y; sp.r = PR; sp.vx = q.w[2]; sp.vy = q.w[3];
          s.sh = { p: sp };
        }
      } else s.sh = null;
      if (!hadSkills) s.fresh = 100;
      if (!isAuth() && (kickoff > 0 || goalTimer > 0)) { s.preview = false; s.pv = null; }

      if (fx && hadSkills && p) {
        if (!o.active && s.active && s.skill !== 'orbit') {
          ring(p.x, p.y, COL[s.skill], s.skill === 'big' ? 90 : 70);
          burstParts(p.x, p.y, 10, [COL[s.skill], '#F3F0E7'], 4, 0.02, 0.04, 3);
          tone(s.skill === 'fast' ? 600 : 110, 0.2, 0.05, s.skill === 'fast' ? 'triangle' : 'sawtooth', s.skill === 'fast' ? 300 : 60);
        } else if (o.active && !s.active && !o.orbit && s.skill !== 'orbit') endFx(n, s.skill);
        if (!o.orbit && s.orbit) {
          ring(p.x, p.y, COL.orbit, 90);
          tone(520, 0.12, 0.045, 'triangle', 280);
        } else if (o.orbit && !s.orbit) {
          ring(ball.x, ball.y, COL.orbit, 75);
          tone(760, 0.16, 0.05, 'triangle', -260);
        }
        if (o.stun <= 0 && s.stunT > 0) ring(p.x, p.y, s.stunC, 50);
        if (q.u > o.uses && o.uses === 0) s.fresh = 60;
      }
    });

    // Perkenalan skill (muncul sekali di guest saat skill pertama kali diterima)
    if (restore) {
      st.intro = 0;
      introEl.hidden = true;
    } else if (!hadSkills && st.pl[0].skill && st.pl[1].skill && d.i > 0) {
      st.intro = d.i;
      showIntro();
    } else if (d.i <= 0) {
      st.intro = 0;
      introEl.hidden = true;
    } else if (Math.abs(st.intro - d.i) > 12) st.intro = d.i;

    // Tembok: dibangun ulang, animasi (flash/pop) dipertahankan
    const oldW = new Map(st.walls.map((w) => [wkey(w.n, w.x, w.y), w]));
    const walls = [];
    for (const [x, y, a, hp, n] of d.w) {
      const k = wkey(n, x, y), o = oldW.get(k);
      const w = Object.assign(mkObb(x, y, a, WALL_LEN / 2, WALL_T / 2), { n, hp, cd: o ? o.cd : 0, flash: o ? o.flash : 0, pop: o ? o.pop : 0 });
      if (fx && !o) {
        w.flash = 0.6; w.pop = 1;
        ring(x, y, TEAM[n], 70);
        burstParts(x, y, 8, ['#F3F0E7', COL.wall, TEAM[n]], 3.2, 0.05, 0.05, 3);
        fxWallPlace(x, y, a, n);
        tone(190, 0.12, 0.05, 'square', -60);
      } else if (fx && o && hp < o.hp) {
        w.flash = 1;
        tone(300, 0.07, 0.04, 'square', -60);
      }
      oldW.delete(k);
      walls.push(w);
    }
    if (fx) for (const w of oldW.values()) wallBreakFx(w);
    st.walls = walls;

    // Peluru (pelan/beku)
    const oldS = st.shots;
    st.shots = d.s.map(([n, fz, x, y, vx, vy, age]) => {
      const k = fz ? 'freeze' : 'slow', px = x + vx * lf, py = y + vy * lf;
      const o = oldS.find((e) => !e._m && e.n === n && e.k === k && Math.hypot(e.x - px, e.y - py) < 50);
      if (o) o._m = true;
      else if (fx) {
        burstParts(px, py, 6, [COL[k], '#ffffff'], 2.5, 0, 0.08, 2.5);
        { const vl = Math.hypot(vx, vy) || 1; fxIceMuzzle(px, py, vx / vl, vy / vl, k); }
        tone(k === 'freeze' ? 1100 : 900, 0.09, 0.03, 'triangle', -500);
      }
      return { n, k, x: px, y: py, vx, vy, age, rot: o ? o.rot : 0, hist: o ? o.hist : [], dead: false };
    });
    if (fx)
      for (const o of oldS)
        if (!o._m) {
          ring(o.x, o.y, COL[o.k], 46);
          { const hp = slots().map((m) => P(m)).find((q) => q && Math.hypot(q.x - o.x, q.y - o.y) < q.r + SHOT_R + 30); if (hp) fxIceBlast(hp.x, hp.y, hp.r, o.k); }
          tone(520, 0.14, 0.04, 'sine', -240);
        }

    // Bom
    const oldB = st.bombs;
    st.bombs = d.b.map((entry) => {
      const [n, x, y, vx, vy, age, radius, speed, curve] = entry;
      const px = x + vx * lf, py = y + vy * lf;
      const o = oldB.find((e) => !e._m && e.n === n && Math.hypot(e.x - px, e.y - py) < 60);
      if (o) o._m = true;
      else if (fx) tone(260, 0.15, 0.04, 'square', -120);
      return { n, x: px, y: py, px, py, vx, vy, age, r: radius || BOMB_R, speed: speed || Math.hypot(vx, vy), curve: curve === -1 ? -1 : 1, rot: o ? o.rot : 0, dead: false, onBall: false };
    });
    if (fx) {
      const hurt = st.pl.some((s) => s.stunT > BOMB_FRAMES - 120 && s.stunC === COL.bomb);
      for (const o of oldB) if (!o._m) explode(o.x, o.y, !hurt);
    }

    // Bola hantu: objek dipertahankan & ditarik halus ke posisi host (tanpa lompatan)
    const oldG = st.ghosts;
    st.ghosts = (d.gh || []).map((entry) => {
      const [n, x, y, vx, vy, age, curve] = entry;
      const px = x + vx * lf, py = y + vy * lf;
      const o = oldG.find((e) => !e._m && e.n === n && Math.hypot(e.x - px, e.y - py) < 90);
      if (o) {
        o._m = true;
        if (restore || Math.hypot(px - o.x, py - o.y) > 50) { o.x = px; o.y = py; }
        else { o.x += (px - o.x) * 0.4; o.y += (py - o.y) * 0.4; }
        o.vx = vx; o.vy = vy; o.age = age; o.curve = curve === -1 ? -1 : 1;
        return o;
      }
      if (fx) { ring(px, py, COL.ghost, 60); tone(480, 0.15, 0.035, 'sine', 240); }
      return { n, x: px, y: py, px, py, vx, vy, age, curve: curve === -1 ? -1 : 1, spin: 0, dead: false };
    });
    if (fx) for (const o of oldG) if (!o._m) { ring(o.x, o.y, COL.ghost, 60); burstParts(o.x, o.y, 10, [COL.ghost, '#ffffff'], 3, 0.02, 0.06, 2.5); }

    // Portal: objek dipertahankan agar animasi & penanda keluar-portal tidak hilang
    const oldP = st.portals;
    st.portals = (d.po || []).map(([n, i, x, y]) => {
      const o = oldP.find((e) => e.n === n && e.i === i && Math.hypot(e.x - x, e.y - y) < 1);
      if (o) { o._m = true; return o; }
      if (fx) { ring(x, y, PCOL[i], 80); tone(300, 0.2, 0.05, 'sine', 500); }
      return { n, i, x, y, pop: fx ? 1 : 0 };
    });
    if (fx) for (const o of oldP) if (!o._m) ring(o.x, o.y, PCOL[o.i], 90);
  }

  // Guest: animasi/pengatur waktu lokal antar state host (tanpa keputusan gameplay).
  function guestUpdate() {
    if (!st.on) return;
    const m = me();
    for (const n of slots()) {
      const p = P(n), s = st.pl[n];
      if (n === m && Math.hypot(p.vx, p.vy) > 0.5) s.dir = snap(p.vx, p.vy);
      if (s.active && s.skill !== 'orbit' && s.t > 0) {
        s.t--;
        if (s.skill === 'fast') {
          s.trail.push({ x: p.x, y: p.y, l: 1 });
          if (s.trail.length > 10) s.trail.shift();
        }
      }
      if (s.slowT > 0) s.slowT--;
      if (s.stunT > 0) s.stunT--;
      if (s.cd > 0) s.cd--;
      stepShadow(n);
    }
    updateShots();
    updateBombs();
    updateGhosts();
    portalStep();
    limitBallSpeed();
    if (m >= 0 && st.pl[m].preview) updPreview(m);
    syncRadius(false);
  }

  // ---------- Peluru (Pelan / Beku) ----------
  function fire(n, k) {
    const s = st.pl[n], me = P(n), op = P(nearestFoe(n, me));
    if (s.uses <= 0) return;
    s.uses--;
    if (s.uses <= 0) startCd(n);
    let tx = op.x, ty = op.y;
    if (isBot(n)) { // Bot membidik dengan memperkirakan gerak lawan
      const t = Math.min(45, Math.hypot(op.x - me.x, op.y - me.y) / SHOT_SPD);
      tx += op.vx * t;
      ty += op.vy * t;
    }
    let dx = tx - me.x, dy = ty - me.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const off = me.r + SHOT_R + 2;
    st.shots.push({ n, k, x: me.x + dx * off, y: me.y + dy * off, vx: dx * SHOT_SPD, vy: dy * SHOT_SPD, age: 0, rot: 0, hist: [], dead: false });
    burstParts(me.x + dx * off, me.y + dy * off, 8, [COL[k], '#ffffff'], 2.5, 0, 0.08, 2.5);
    fxIceMuzzle(me.x + dx * off, me.y + dy * off, dx, dy, k);
    tone(k === 'freeze' ? 1100 : 900, 0.09, 0.03, 'triangle', -500);
  }
  function updateShots() {
    if (tsOn()) return;
    for (const sh of st.shots) {
      sh.x += sh.vx;
      sh.y += sh.vy;
      portalPass(sh, SHOT_R, sh.x - sh.vx, sh.y - sh.vy);
      sh.age++;
      sh.rot += 0.3;
      sh.hist.push({ x: sh.x, y: sh.y });
      if (sh.hist.length > 7) sh.hist.shift();
      fxIceTrail(sh);
      if (!isAuth()) continue; // guest hanya menggerakkan; tabrakan diputuskan host
      const tn = foes(sh.n).find((m) => {
        const g = P(m);
        return Math.hypot(g.x - sh.x, g.y - sh.y) < g.r + SHOT_R;
      });
      if (tn !== undefined) {
        sh.dead = true;
        if (sh.k === 'freeze') applyStun(tn, FREEZE_FRAMES, COL.freeze);
        else applySlow(tn);
        ring(sh.x, sh.y, COL[sh.k], 46);
        fxIceBlast(P(tn).x, P(tn).y, P(tn).r, sh.k);
        burstParts(sh.x, sh.y, 16, [COL[sh.k], '#ffffff', '#BFE9FF'], 4, 0.04, 0.04, 3);
        tone(520, 0.14, 0.04, 'sine', -240);
      } else if (sh.x < LX - 2 || sh.x > W - LX + 2 || sh.y < LY || sh.y > H - LY || sh.age > 300) {
        sh.dead = true;
        burstParts(sh.x, sh.y, 5, [COL[sh.k], '#ffffff'], 2, 0, 0.1, 2);
      }
    }
    st.shots = st.shots.filter((s) => !s.dead);
  }

  // ---------- Bom: fisika bola kecil yang memantul, tetapi tidak bisa mencetak gol ----------
  function varyLaunchDir(direction, curve) {
    const a = Math.atan2(direction.y, direction.x);
    // Sedikit sebaran dua arah (± sekitar 4–8°), termasuk saat aim horizontal/vertikal.
    const spread = (0.07 + Math.random() * 0.07) * curve;
    return { x: Math.cos(a + spread), y: Math.sin(a + spread) };
  }
  function bombDir(n) {
    const me = P(n), op = P(nearestFoe(n, me));
    if (isBot(n)) {
      const d = dist(me, op), t = Math.min(40, d / BOMB_SPD);
      const dx = op.x + op.vx * t - me.x, dy = op.y + op.vy * t - me.y, l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    }
    return st.pl[n].dir;
  }
  function throwBomb(n) {
    const s = st.pl[n], me = P(n);
    if (s.uses <= 0) return;
    s.uses--;
    const curve = Math.random() < 0.5 ? -1 : 1;
    const d = varyLaunchDir(bombDir(n), curve);
    const sizeRatio = BOMB_MIN_SIZE + Math.random() * (BOMB_MAX_SIZE - BOMB_MIN_SIZE);
    const radius = (BOMB_R / BOMB_BASE_SIZE) * sizeRatio;
    // Semakin kecil ukuran bom, semakin cepat; ukuran terbesar bergerak lebih lambat.
    const speed = BOMB_SPD * (BOMB_BASE_SIZE / sizeRatio);
    const off = me.r + radius + 4;
    st.bombs.push({
      n, x: me.x + d.x * off, y: me.y + d.y * off,
      px: me.x + d.x * off, py: me.y + d.y * off,
      vx: d.x * speed, vy: d.y * speed,
      r: radius, speed, curve, age: 0, rot: 0, dead: false,
    });
    fxFirePop(me.x + d.x * off, me.y + d.y * off, d);
    tone(260, 0.15, 0.04, 'square', -120);
  }
  function bounceEntity(entity, nx, ny, restitution, curveAmount) {
    const dot = entity.vx * nx + entity.vy * ny;
    if (dot >= 0) return;
    const impact = -dot;
    entity.vx -= (1 + restitution) * dot * nx;
    entity.vy -= (1 + restitution) * dot * ny;
    if (curveAmount) {
      const sign = entity.curve === -1 ? -1 : 1;
      const bend = Math.min(1.35, impact * curveAmount) * sign;
      // Komponen tangensial membuat pantulan sedikit menyamping, lalu sisi lengkung berganti.
      entity.vx += -ny * bend;
      entity.vy += nx * bend;
      entity.curve = -sign;
    }
  }
  function reflectBombPost(b, px, py) {
    const dx = b.x - px, dy = b.y - py;
    const d = Math.hypot(dx, dy) || 0.001;
    const r = b.r || BOMB_R, min = r + POST;
    if (d >= min) return;
    const nx = dx / d, ny = dy / d;
    b.x = px + nx * min;
    b.y = py + ny * min;
    const before = b.vx * nx + b.vy * ny;
    bounceEntity(b, nx, ny, BOMB_BOUNCE, BOMB_CURVE);
    if (before < 0) tone(950, 0.07, 0.025, 'triangle', -180);
  }
  function updateBombs() {
    if (tsOn()) return;
    for (const b of st.bombs) {
      b.onBall = false;
      b.px = b.x;
      b.py = b.y;
      b.r = b.r || BOMB_R;
      b.curve = b.curve === -1 ? -1 : 1;
      b.x += b.vx;
      b.y += b.vy;
      portalPass(b, b.r, b.px, b.py);
      b.age++;
      b.rot += Math.hypot(b.vx, b.vy) * 0.035;
      fxBombTrail(b);
      const f = Math.pow(FRIC, 0.8);
      b.vx *= f;
      b.vy *= f;

      // Pantulan sisi atas dan bawah lapangan.
      const minY = LY + b.r, maxY = H - LY - b.r;
      if (b.y < minY) {
        b.y = minY;
        bounceEntity(b, 0, 1, BOMB_BOUNCE, BOMB_CURVE);
      } else if (b.y > maxY) {
        b.y = maxY;
        bounceEntity(b, 0, -1, BOMB_BOUNCE, BOMB_CURVE);
      }

      // Tiang gawang memantulkan bom seperti memantulkan bola.
      for (const sd of [0, 1]) {
        for (const py of [goalTop(sd), goalBot(sd)]) reflectBombPost(b, sd ? W - LX : LX, py);
      }

      // Bom selalu memantul di garis gawang; bom tidak pernah masuk ke jaring atau mencetak gol.
      const minX = LX + b.r, maxX = W - LX - b.r;
      if (b.x < minX) {
        b.x = minX;
        bounceEntity(b, 1, 0, BOMB_BOUNCE, BOMB_CURVE);
      } else if (b.x > maxX) {
        b.x = maxX;
        bounceEntity(b, -1, 0, BOMB_BOUNCE, BOMB_CURVE);
      }

      // Tembok skill juga menjadi permukaan pantul bom dengan sedikit pembelokan.
      collideBombWalls(b);

      if (!isAuth()) continue; // guest: bom hanya bergerak & memantul
      let hitP = -1;
      for (const n of slots()) {
        if (n === b.n && b.age < 25) continue; // aman dari tabrakan langsung setelah dilempar
        if (duo() && n !== b.n && teamOf(n) === teamOf(b.n)) continue; // rekan satu tim kebal bom
        if (dist(P(n), b) < P(n).r + b.r) {
          hitP = n;
          break;
        }
      }
      if (hitP >= 0) {
        b.dead = true;
        applyStun(hitP, BOMB_FRAMES, COL.bomb);
        explode(b.x, b.y, false);
        startCd(b.n); // cooldown dimulai setelah bom kena seseorang
      } else if (b.age > BOMB_MAX_AGE || Math.hypot(b.vx, b.vy) < 0.12 && b.age > 180) {
        b.dead = true;
        explode(b.x, b.y, true);
        startCd(b.n); // bom habis tanpa kena: tetap cooldown agar skill tidak macet
      }
    }
    st.bombs = st.bombs.filter((b) => !b.dead);
  }
  function explode(x, y, weak) {
    ring(x, y, COL.bomb, weak ? 50 : 110);
    fxExplosion(x, y, weak);
    burstParts(x, y, weak ? 10 : 30, [COL.bomb, '#FFD166', '#ffffff'], 5, 0.05, 0.04, 3.5);
    noise(0.3, 0.08, 300);
    tone(120, 0.3, 0.06, 'sawtooth', -60);
    if (!weak) shake = Math.max(shake, 6);
  }

  // ---------- Bola Hantu: seperti bola, tembus pemain & tembok skill, tapi saling mendorong dengan bola ----------
  const GHOST_SCALE = 1.7; // bola hantu lebih besar dari bola biasa
  const gr = () => (ball ? ball.r : BR) * GHOST_SCALE;
  function ghostDir(n) {
    if (isBot(n)) {
      const me = P(n), dx = ball.x - me.x, dy = ball.y - me.y, l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    }
    return st.pl[n].dir;
  }
  function throwGhost(n) {
    const s = st.pl[n], me = P(n);
    if (s.uses <= 0) return;
    s.uses--;
    const curve = Math.random() < 0.5 ? -1 : 1;
    const d = varyLaunchDir(ghostDir(n), curve), r = gr(), off = me.r + r + 4;
    const x = clamp(me.x + d.x * off, LX + r, W - LX - r), y = clamp(me.y + d.y * off, LY + r, H - LY - r);
    st.ghosts.push({ n, x, y, px: x, py: y, vx: d.x * GHOST_SPD, vy: d.y * GHOST_SPD, curve, age: 0, spin: 0, dead: false });
    ring(x, y, COL.ghost, 60);
    burstParts(x, y, 10, [COL.ghost, '#ffffff'], 3, 0.02, 0.06, 2.5);
    tone(480, 0.18, 0.04, 'sine', 260);
  }
  function postBounce(e, px, py, r) {
    const dx = e.x - px, dy = e.y - py, d = Math.hypot(dx, dy) || 0.001, min = r + POST;
    if (d >= min) return;
    const nx = dx / d, ny = dy / d, dot = e.vx * nx + e.vy * ny;
    e.x = px + nx * min;
    e.y = py + ny * min;
    if (dot < 0) {
      bounceEntity(e, nx, ny, GHOST_WALL_BOUNCE, GHOST_CURVE);
      tone(1000, 0.1, 0.02, 'triangle', -150);
    }
  }
  function ghostBall(g, r) {
    const dx = ball.x - g.x, dy = ball.y - g.y, d = Math.hypot(dx, dy), min = r + ball.r;
    if (d >= min) return;
    const nx = d > 0.001 ? dx / d : 1, ny = d > 0.001 ? dy / d : 0, ov = min - d;
    // Saling dorong: bola tidak tembus bola hantu dan sebaliknya.
    ball.x += nx * ov * 0.5; ball.y += ny * ov * 0.5;
    g.x -= nx * ov * 0.5; g.y -= ny * ov * 0.5;
    const rv = (ball.vx - g.vx) * nx + (ball.vy - g.vy) * ny;
    if (rv < 0) {
      const j = (-(1 + GHOST_E) * rv) / 2;
      ball.vx += j * nx; ball.vy += j * ny;
      g.vx -= j * nx; g.vy -= j * ny;
      ball.pop = Math.max(ball.pop || 0, 0.6);
      burstParts((ball.x + g.x) / 2, (ball.y + g.y) / 2, 5, [COL.ghost, '#ffffff'], 3, 0, 0.08, 2.2);
      tone(560, 0.06, 0.03, 'triangle', -120);
    }
  }
  function updateGhosts() {
    if (tsOn()) return;
    const r = gr(), orb = orbitOwner() >= 0;
    for (const g of st.ghosts) {
      g.px = g.x;
      g.py = g.y;
      g.x += g.vx;
      g.y += g.vy;
      g.age++;
      g.vx *= FRIC;
      g.vy *= FRIC;
      g.spin += Math.hypot(g.vx, g.vy) * 0.025;
      portalPass(g, r, g.px, g.py);
      const minY = LY + r, maxY = H - LY - r;
      if (g.y < minY) { g.y = minY; bounceEntity(g, 0, 1, GHOST_WALL_BOUNCE, GHOST_CURVE); }
      else if (g.y > maxY) { g.y = maxY; bounceEntity(g, 0, -1, GHOST_WALL_BOUNCE, GHOST_CURVE); }
      for (const sd of [0, 1]) for (const py of [goalTop(sd), goalBot(sd)]) postBounce(g, sd ? W - LX : LX, py, r);
      // Garis gawang: bola hantu selalu memantul, tidak pernah menjadi gol.
      const minX = LX + r, maxX = W - LX - r;
      if (g.x < minX) { g.x = minX; bounceEntity(g, 1, 0, GHOST_WALL_BOUNCE, GHOST_CURVE); }
      else if (g.x > maxX) { g.x = maxX; bounceEntity(g, -1, 0, GHOST_WALL_BOUNCE, GHOST_CURVE); }
      if (!orb) ghostBall(g, r);
      if (isAuth() && g.age > GHOST_FRAMES) {
        g.dead = true;
        ring(g.x, g.y, COL.ghost, 60);
        burstParts(g.x, g.y, 12, [COL.ghost, '#ffffff'], 3, 0.02, 0.06, 2.5);
        tone(380, 0.18, 0.03, 'sine', -200);
      }
    }
    st.ghosts = st.ghosts.filter((g) => !g.dead);
    if (isAuth())
      for (const n of slots()) {
        const s = st.pl[n];
        if (s.skill === 'ghost' && s.uses <= 0 && !st.ghosts.some((g) => g.n === n)) startCd(n); // cooldown setelah semua terpakai
      }
  }

  // ---------- Melesat (dash) ----------
  function dashDir(n) {
    const p = P(n), s = st.pl[n];
    if (isBot(n)) {
      const c = bctx(), t = c && c.tgt ? c.tgt : ball; // ikuti rencana bot, bukan asal ke bola
      const dx = t.x - p.x, dy = t.y - p.y, l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    }
    const sp = Math.hypot(p.vx, p.vy);
    return sp > 0.5 ? { x: p.vx / sp, y: p.vy / sp } : s.dir;
  }
  function startDash(n) {
    const s = st.pl[n], p = P(n), d = dashDir(n);
    s.dashT = DASH_FRAMES;
    s.dashV = { x: d.x * DASH_SPD, y: d.y * DASH_SPD };
    ring(p.x, p.y, COL.dash, 60);
    burstParts(p.x - d.x * p.r, p.y - d.y * p.r, 12, [COL.dash, '#ffffff'], 3.5, 0, 0.06, 3);
    fxDashBurst(p, d);
    tone(380, 0.14, 0.04, 'sawtooth', 500);
    noise(0.1, 0.04, 1400);
  }
  function doDash(n) {
    const s = st.pl[n];
    if (s.stunT > 0) return false;
    startDash(n);
    s.uses = 0;
    startCd(n); // cooldown 5 dtk langsung berjalan
    return true;
  }
  // Dipanggil game.js dari movePlayer/moveBot: perpindahan tambahan per frame saat melesat.
  function dashMove(p) {
    if (!st.on) return null;
    const n = idxOf(p);
    if (n < 0) return null;
    const s = st.pl[n];
    if (s.stunT > 0) { // stun: semua gerak otomatis batal
      s.dashT = 0;
      s.pull = null;
      return null;
    }
    if (s.dashT > 0) {
      s.dashT--;
      return s.dashV;
    }
    // Kembali: tertarik cepat ke lingkaran, lalu slow 20% selama 3 detik
    if (s.pull) {
      const dx = s.pull.x - p.x, dy = s.pull.y - p.y, d = Math.hypot(dx, dy);
      s.pull.n++;
      if (s.pull.mirror) { // Kaca: tertarik lurus ke garis tengah (X tidak berubah), makin dekat makin pelan
        const ay = Math.abs(dy);
        if (ay <= 3) { s.pull = null; return { x: 0, y: dy }; }
        if (s.pull.n > MIRROR_PULL_MAX) { s.pull = null; return null; }
        fxMirrorPull(p);
        return { x: 0, y: Math.sign(dy) * Math.min(ay, clamp(ay * 0.16, 3.5, 15)) };
      }
      if (d <= 4 || s.pull.n > BACK_PULL_MAX) {
        s.pull = null;
        s.sl2 = BACK_SLOW_FRAMES;
        ring(p.x, p.y, COL.back, 60);
        return null;
      }
      const stp = Math.min(BACK_PULL_SPD, d);
      fxBackGhost(p, n);
      return { x: (dx / d) * stp, y: (dy / d) * stp };
    }
    return null;
  }
  // Dipanggil game.js (guest) setelah koreksi: dorong bola keluar dari tembok tanpa mengubah kecepatan.
  function pushOut(e) {
    for (const w of st.walls) {
      const r = circleObb(w, e.x, e.y, e.r);
      if (r) { e.x += r.nx * (r.d + 0.01); e.y += r.ny * (r.d + 0.01); }
    }
  }
  const guestHold = () => st.on && me() >= 0 && st.pl[me()].lock > performance.now();

  // ---------- Bayangan ----------
  function spawnShadow(n) {
    const me = P(n);
    // Perbaikan bug: sebelumnya argumen mk() salah urut sehingga "side" bernilai angka
    // dan bayangan selalu dibatasi ke setengah lapangan kanan.
    const p = mk(me.x + (teamOf(n) === 0 ? 45 : -45), me.side, 0);
    p.y = me.y;
    p.r = PR;
    limit(p);
    st.pl[n].sh = { p };
    fxShadowBurst(p.x, p.y);
  }
  function endShadow(n) {
    const s = st.pl[n];
    if (s.sh) { ring(s.sh.p.x, s.sh.p.y, COL.shadow, 60); fxShadowBurst(s.sh.p.x, s.sh.p.y); }
    s.sh = null;
    s.active = false;
    s.t = 0;
    startCd(n);
  }
  // =====================================================================
  //  SKILL KACA: refleksi pemain di seberang garis tengah horizontal.
  //  X refleksi = X pemain, Y refleksi = H - Y pemain (pemain atas -> refleksi bawah).
  //  Menembus pemain (dan tembok), tetapi memantulkan bola seperti pemain biasa.
  //  Setelah 10 detik: pemain & refleksi tertarik ke tengah lapangan (X tetap).
  // =====================================================================
  function startMirror(n) {
    const s = st.pl[n], p = P(n);
    if (!p || s.active || s.pull || s.mr) return false;
    s.uses = 0;
    s.active = true;
    s.t = s.tMax;
    const m = mk(p.x, p.side, 0);
    m.y = H - p.y;
    m.r = p.r;
    s.mr = { p: m, pulling: false };
    ring(p.x, p.y, COL.mirror, 70);
    ring(m.x, m.y, COL.mirror, 90);
    fxMirrorSpawn(p.x, p.y);
    fxMirrorSpawn(m.x, m.y);
    tone(1200, 0.1, 0.035, 'sine', -400);
    tone(1800, 0.12, 0.03, 'sine', -600, 0.07);
    return true;
  }
  // Waktu habis: tarik pemain ke garis tengah (hanya sumbu Y); refleksi ikut bergerak dari posisi pemain
  function beginMirrorPull(n) {
    const s = st.pl[n], p = P(n);
    if (!s.mr || !p || s.stunT > 0 || Math.abs(p.y - H / 2) < 3) { endMirror(n); return; }
    s.mr.pulling = true;
    s.pull = { x: p.x, y: H / 2, n: 0, mirror: true };
    ring(p.x, p.y, COL.mirror, 80);
    tone(500, 0.2, 0.045, 'triangle', 500);
  }
  function endMirror(n) {
    const s = st.pl[n], m = s.mr, p = P(n);
    if (m) {
      fxMirrorShatter(m.p.x, m.p.y);
      ring(m.p.x, m.p.y, COL.mirror, 90);
      tone(1500, 0.14, 0.04, 'triangle', -900);
      noise(0.12, 0.04, 3000);
    }
    if (p && m) ring(p.x, p.y, COL.mirror, 50);
    if (s.pull && s.pull.mirror) s.pull = null;
    s.mr = null;
    s.active = false;
    s.t = 0;
    startCd(n); // cooldown 10 dtk dimulai setelah refleksi hilang
  }
  function stepMirror(n) {
    const s = st.pl[n], m = s.mr;
    if (!m) return;
    const me = P(n);
    if (!me) return;
    if (m.pulling && !(s.pull && s.pull.mirror)) { endMirror(n); return; } // tiba di tengah / dibatalkan (stun, gol)
    const p = m.p, ox = p.x, oy = p.y;
    p.r = me.r;
    p.x = me.x;
    p.y = H - me.y;
    p.vx = p.x - ox;
    p.vy = p.y - oy;
    if (!tsOn()) hit(p, n); // memantulkan bola dengan fisika tendangan pemain biasa
  }
  function fxMirrorSpawn(x, y) {
    for (let i = 0; i < 12; i++) fxShard(x, y, rnd(0, TAU), rnd(2, 6), rnd(2.5, 5), ['#FFFFFF', '#9FE8FF', '#D8F6FF'], { max: Math.round(rnd(18, 30)) });
    for (let i = 0; i < 8; i++) fxSpark(x, y, rnd(0, TAU), rnd(1.5, 4.5), 1.6, ['#FFFFFF', '#9FE8FF'], { w: 1.8 });
    fxWave(x, y, 6, 52, COL.mirror, 3, 18);
    fxWave(x, y, 4, 36, '#FFFFFF', 2, 14, 4);
  }
  function fxMirrorShatter(x, y) {
    for (let i = 0; i < 20; i++) fxShard(x, y, rnd(0, TAU), rnd(2, 7.5), rnd(3, 6), ['#FFFFFF', '#9FE8FF', '#D8F6FF', '#7FD0F0'], { max: Math.round(rnd(24, 42)) });
    for (let i = 0; i < 14; i++) fxSpark(x, y, rnd(0, TAU), rnd(2, 8), 1.7, ['#FFFFFF', '#9FE8FF']);
    fxWave(x, y, 8, 74, COL.mirror, 3.5, 20);
  }
  function fxMirrorGlint(p) {
    const a = rnd(0, TAU), d = rnd(0.2, 0.9) * p.r;
    fxSpark(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, -Math.PI / 4 + rnd(-0.3, 0.3), rnd(0.4, 1.2), 2.2, ['#FFFFFF', COL.mirror], { max: 12, w: 1.4 });
  }
  function fxMirrorPull(p) {
    for (const y of [p.y, H - p.y]) {
      const a = H / 2 - y > 0 ? Math.PI / 2 : -Math.PI / 2;
      fxSpark(p.x + rnd(-p.r, p.r) * 0.7, y, a, rnd(2, 5), 2.4, ['#FFFFFF', COL.mirror], { max: 12, w: 1.8 });
    }
  }
  function drawMirror(n) {
    const s = st.pl[n], m = s.mr, me = P(n);
    if (!m || !me) return;
    const p = m.p, R = p.r;
    const blink = !m.pulling && s.t < 120 && Math.floor(tick / 6) % 2 === 0; // berkedip 2 detik terakhir
    const k = blink ? 0.45 : 1;
    ctx.save();
    // Sumbu cermin: garis tengah horizontal yang berkilau
    const lg = ctx.createLinearGradient(me.x - 90, 0, me.x + 90, 0);
    lg.addColorStop(0, 'rgba(159,232,255,0)');
    lg.addColorStop(0.5, 'rgba(159,232,255,1)');
    lg.addColorStop(1, 'rgba(159,232,255,0)');
    ctx.globalAlpha = 0.3 * k;
    ctx.strokeStyle = lg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(me.x - 90, H / 2);
    ctx.lineTo(me.x + 90, H / 2);
    ctx.stroke();
    // Tali tipis penghubung pemain dan refleksinya
    ctx.globalAlpha = 0.22 * k;
    ctx.strokeStyle = COL.mirror;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 6]);
    ctx.lineDashOffset = -tick * 0.6;
    ctx.beginPath();
    ctx.moveTo(me.x, me.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // Pendar kaca
    const gl = ctx.createRadialGradient(p.x, p.y, R * 0.5, p.x, p.y, R * 2.3);
    gl.addColorStop(0, 'rgba(159,232,255,.35)');
    gl.addColorStop(1, 'rgba(159,232,255,0)');
    ctx.globalAlpha = k;
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R * 2.3, 0, Math.PI * 2);
    ctx.fill();
    // Tubuh: warna tim tembus pandang + lapisan kaca
    ctx.globalAlpha = 0.6 * k;
    ctx.fillStyle = TEAM[n];
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.fill();
    const gb = ctx.createLinearGradient(p.x - R, p.y + R, p.x + R, p.y - R);
    gb.addColorStop(0, 'rgba(255,255,255,.05)');
    gb.addColorStop(0.5, 'rgba(190,240,255,.4)');
    gb.addColorStop(1, 'rgba(255,255,255,.12)');
    ctx.globalAlpha = k;
    ctx.fillStyle = gb;
    ctx.fill();
    // Kilau diagonal yang menyapu tubuh kaca
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.7);
    const off = ((tick * 0.9) % (R * 5)) - R * 2.5;
    ctx.globalAlpha = 0.55 * k;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(off, -R * 2, R * 0.35, R * 4);
    ctx.fillRect(off + R * 0.55, -R * 2, R * 0.15, R * 4);
    ctx.restore();
    // Bingkai kaca
    ctx.globalAlpha = 0.95 * k;
    ctx.strokeStyle = COL.mirror;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R - 1.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.7 * k;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R - 4.5, Math.PI * 1.05, Math.PI * 1.6);
    ctx.stroke();
    ctx.restore();
  }

  function stepShadow(n) {
    const sh = st.pl[n].sh;
    if (!sh) return;
    const p = sh.p, gx = teamOf(n) === 0 ? W - LX : LX, gy = H / 2;
    let ax = gx - ball.x, ay = gy - ball.y;
    const al = Math.hypot(ax, ay) || 1;
    ax /= al;
    ay /= al;
    const bx = ball.x + ball.vx * 6, by = ball.y + ball.vy * 6;
    const rx = p.x - bx, ry = p.y - by;
    const behind = rx * ax + ry * ay < -6, off = Math.abs(rx * ay - ry * ax);
    let tx, ty;
    if (behind && off < 26) {
      tx = bx + ax * 40;
      ty = by + ay * 40;
    } else {
      const d = ball.r + p.r + 16;
      tx = bx - ax * d;
      ty = by - ay * d;
    }
    // Bola di area lawan: bayangan bersiaga di depan garis tengah, siap menyerang
    if (!ballInOwnHalf(n)) {
      tx = W / 2 + (teamOf(n) === 0 ? -70 : 70);
      ty = ball.y;
    }
    const ox = p.x, oy = p.y, d = Math.hypot(tx - p.x, ty - p.y);
    if (d > 0.5) {
      const stp = Math.min(d, PSPD * 0.95);
      p.x += ((tx - p.x) / d) * stp;
      p.y += ((ty - p.y) / d) * stp;
    }
    // Bayangan hanya boleh bergerak di area tim pemiliknya; tidak bisa melewati garis tengah.
    limit(p);
    for (let it = 0; it < 3; it++)
      for (const w of st.walls) {
        const r = circleObb(w, p.x, p.y, p.r);
        if (r) {
          p.x += r.nx * r.d;
          p.y += r.ny * r.d;
        }
      }
    // Pastikan dorongan dari tembok pun tidak pernah menggeser bayangan ke area lawan.
    limit(p);
    p.vx = p.x - ox;
    p.vy = p.y - oy;
    if (!tsOn()) hit(p, n); // pakai fisika tendangan pemain biasa
  }

  // ---------- Collision (dipanggil dari game.js) ----------
  function speedMul(p) {
    if (!st.on) return 1;
    const n = idxOf(p);
    if (n < 0) return 1;
    const s = st.pl[n];
    if (s.stunT > 0 || s.dashT > 0 || s.pull) return 0; // stun / melesat / tertarik: gerak normal ditiadakan (rantai tidak mengunci gerak)
    let m = 1;
    if (s.active) {
      if (s.skill === 'fast') m *= FAST_MUL;
      else if (s.skill === 'big') m *= BIG_MUL;
      else if (s.skill === 'grow' && growScale(s) > 1.001) m *= 0.8; // hanya saat ukuran sudah mulai membesar
      else if (s.skill === 'orbit') m *= 0.8;
    }
    if (s.slowT > 0) m *= SLOW_MUL;
    if (s.sl2 > 0) m *= BACK_SLOW; // efek setelah Kembali
    return m;
  }

  function collidePlayer(p) {
    if (!st.walls.length) return;
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const w of st.walls) {
        const r = circleObb(w, p.x, p.y, p.r);
        if (!r) continue;
        p.x += r.nx * r.d;
        p.y += r.ny * r.d;
        moved = true;
      }
      limit(p);
      if (!moved) break;
    }
  }

  function removeBrokenWalls() {
    const broken = st.walls.filter((w) => w.hp <= 0);
    if (!broken.length) return;
    for (const w of broken) {
      st.dying.push({ x: w.x, y: w.y, a: w.a, c: w.c, s: w.s, n: w.n, hp: 0, flash: 1, t: 1 });
      for (let i = 0; i < 5; i++) {
        const u = ((i + 0.5) / 5 - 0.5) * WALL_LEN;
        burstParts(w.x + u * w.c, w.y + u * w.s, 8, ['#F3F0E7', COL.wall, TEAM[w.n], '#2b3a49'], 4.5, 0.12, 0.03, 4);
      }
      ring(w.x, w.y, TEAM[w.n], 90);
      fxWallBreak(w);
      noise(0.3, 0.08, 500);
      shake = Math.max(shake, 5);
    }
    st.walls = st.walls.filter((w) => w.hp > 0);
  }

  function collideEntityWalls(entity, radius, previous, bounce = null) {
    if (!st.walls.length) return;
    for (const w of st.walls) {
      if (w.hp <= 0) continue;
      const r = circleObb(w, entity.x, entity.y, radius, previous?.x, previous?.y);
      if (!r) continue;
      entity.x += r.nx * (r.d + 0.01);
      entity.y += r.ny * (r.d + 0.01);
      const vn = entity.vx * r.nx + entity.vy * r.ny;
      if (vn >= 0) continue;
      if (bounce) bounceEntity(entity, r.nx, r.ny, bounce.restitution, bounce.curve);
      else {
        entity.vx -= 2 * vn * r.nx;
        entity.vy -= 2 * vn * r.ny;
      }
      if (-vn > 0.35 && w.cd <= 0 && isAuth()) {
        w.cd = WALL_CD;
        w.hp--;
        w.flash = 1;
        burstParts(entity.x - r.nx * radius, entity.y - r.ny * radius, 6, ['#ffffff', COL.wall, TEAM[w.n]], 3, 0.04, 0.07, 2.5);
        fxWallHit(entity.x - r.nx * radius, entity.y - r.ny * radius, w);
        tone(300 + Math.min(300, -vn * 25), 0.07, 0.04, 'square', -60);
      }
    }
    if (isAuth()) removeBrokenWalls();
  }

  function collideBall(b) {
    const previous = st.bp || { x: b.x - b.vx, y: b.y - b.vy };
    collideEntityWalls(b, b.r, previous);
  }

  function collideBombWalls(b) {
    collideEntityWalls(b, b.r || BOMB_R, { x: b.px, y: b.py }, { restitution: BOMB_BOUNCE, curve: BOMB_CURVE });
  }

  // ---------- Update ----------
  // Animasi/efek: tiap langkah (termasuk saat selebrasi gol)
  function tickFx() {
    if (!st.on) return;
    tick++;
    if (st.intro > 0) {
      st.intro--; // tahan kick-off selama perkenalan skill
      if (isAuth()) {
        kickoff = 2.4;
        lastCount = st.intro > 0 ? 3 : 4; // tanpa bunyi tiap frame selama perkenalan; bunyi "3" tepat setelahnya
      }
      if (st.intro <= 0) introEl.hidden = true;
    }
    st.bp = { x: ball.x, y: ball.y };
    for (const w of st.walls) {
      w.flash = Math.max(0, w.flash - 0.08);
      w.pop = Math.max(0, w.pop - 0.08);
      if (w.cd > 0) w.cd--;
    }
    for (const d of st.dying) {
      d.t -= 0.06;
      d.flash = Math.max(0, d.flash - 0.1);
    }
    st.dying = st.dying.filter((d) => d.t > 0);
    for (const r of st.rings) r.t -= 0.05;
    tickFxList();
    st.rings = st.rings.filter((r) => r.t > 0);
    for (const pt of st.portals) pt.pop = Math.max(0, pt.pop - 0.06);
    for (const n of slots()) {
      const s = st.pl[n], p = P(n);
      fxPlayerLoop(n, s, p);
      if (s.skill === 'dash' && p && Math.hypot(p.vx, p.vy) > 9) {
        s.trail.push({ x: p.x, y: p.y, l: 1 });
        if (s.trail.length > 10) s.trail.shift();
      }
      s.vis += ((s.active ? 1 : 0) - s.vis) * 0.1;
      if (s.vis < 0.01) s.vis = 0;
      for (const t of s.trail) t.l -= 0.07;
      s.trail = s.trail.filter((t) => t.l > 0);
      if (s.inv > 0) s.inv--;
      if (s.fresh > 0) s.fresh--;
    }
    syncRadius(false);
  }

  function endFx(n, k) {
    const p = P(n);
    ring(p.x, p.y, COL[k], 50);
    tone(k === 'fast' ? 500 : 140, 0.18, 0.035, 'triangle', k === 'fast' ? -250 : 40);
  }

  // Bola hasil lepasan Orbit: tiap pantulan (dinding/tiang/tembok) SEDIKIT mengurangi kecepatan
  // sampai akhirnya kembali ke kecepatan normal game. Sentuhan pemain mengakhiri efek.
  function orbitFreeStep() {
    const r = orbRel;
    if (!r) return;
    const v = Math.hypot(ball.vx, ball.vy);
    if (v < 0.3 || v <= BALL_MAX || orbitOwner() >= 0) { orbRel = null; return; }
    if (r.g > 0) r.g--; // masa tenggang: pemilik yang baru melepas tidak mengakhiri efek
    for (const q of allP()) {
      if (r.g > 0 && idxOf(q) === r.n) continue;
      if (dist(q, ball) < q.r + ball.r + 2) { orbRel = null; return; }
    }
    let bounced = false;
    if (r.pvx * ball.vx < 0 && Math.abs(r.pvx) > 2) bounced = true;
    if (r.pvy * ball.vy < 0 && Math.abs(r.pvy) > 2) bounced = true;
    if (bounced) {
      r.b++;
      ball.vx *= ORBIT_BOUNCE_K;
      ball.vy *= ORBIT_BOUNCE_K;
    }
    r.pvx = ball.vx;
    r.pvy = ball.vy;
  }

  function limitBallSpeed() {
    if (tsOn()) return;
    if (orbitOwner() >= 0) { orbRel = null; return; }
    orbitFreeStep();
    if (orbRel) return; // bola hasil Orbit: kecepatan dijaga, hanya pantulan yang mengurangi
    const v = Math.hypot(ball.vx, ball.vy);
    if (v > BALL_MAX) {
      const k = Math.max(BALL_MAX / v, BALL_DECAY);
      ball.vx *= k;
      ball.vy *= k;
    }
  }

  function update() {
    if (!st.on) return;
    histRecord();
    for (const n of slots()) {
      const p = P(n), s = st.pl[n];
      if (Math.hypot(p.vx, p.vy) > 0.5) s.dir = snap(p.vx, p.vy);
      if (s.active && s.skill !== 'orbit' && !(s.mr && s.mr.pulling)) {
        if (--s.t <= 0) {
          s.t = 0;
          if (s.skill === 'shadow') endShadow(n);
          else if (s.skill === 'mirror') beginMirrorPull(n);
          else {
            s.active = false;
            onSkillEnd(n);
            endFx(n, s.skill);
            startCd(n); // cooldown dimulai setelah efek selesai
          }
        } else if (s.skill === 'fast') {
          s.trail.push({ x: p.x, y: p.y, l: 1 });
          if (s.trail.length > 10) s.trail.shift();
        }
      }
      if (s.slowT > 0) s.slowT--;
      if (s.stunT > 0) s.stunT--;
      if (s.lockT > 0) s.lockT--;
      if (s.sl2 > 0) s.sl2--;
      // Tembok: jangan mulai menghitung cooldown sampai semua jatah dipakai
      // dan seluruh tembok milik pemain hancur/hilang.
      if (s.skill === 'wall' && s.uses <= 0 && !st.walls.some((w) => w.n === n) && s.cd <= 0 && !s.rp) startCd(n);
      if (isBox(s.skill) && s.uses <= 0 && !st.boxes.some((b) => b.n === n) && s.cd <= 0 && !s.rp) startCd(n);
      // Cooldown berjalan; isi ulang saat selesai.
      if (s.cd > 0 && --s.cd <= 0) {
        s.cd = 0;
        s.rp = true;
      }
      if (s.rp && !(s.skill === 'wall' && st.walls.some((w) => w.n === n))) {
        s.rp = false;
        refill(n);
      }
      stepShadow(n);
      stepMirror(n);
    }
    updateShots();
    updateBombs();
    updateCannons();
    updateGhosts();
    portalStep();
    areaAll();
    boxStep();
    chainStep();
    goalMoveStep();
    limitBallSpeed();
    for (const n of slots()) if (isBot(n)) botThink(n);
    for (const n of slots()) if (st.pl[n].preview) updPreview(n);
  }

  // ---------- Bot ----------
  // Konteks rencana dari bot.js (BotAI.ctx); dianggap basi bila lebih dari 8 frame tidak diperbarui.
  function bctx() {
    const a = window.BotAI;
    if (mode !== 'bot') return null; // rencana bot.js hanya untuk mode Play vs Bot (1 lawan 1)
    return a && a.ctx && a.frame - a.ctx.frame <= 8 ? a.ctx : null;
  }
  // Prediksi titik bola menembus gawang Bot (kanan), dengan pantulan atas/bawah. null = tidak mengancam.
  // Ancaman tembakan ke gawang tim n. Tim kiri dihitung dengan cermin horizontal (lapangan simetris).
  function ballThreat(n = 1) {
    const mir = teamOf(n) === 0, vx = mir ? -ball.vx : ball.vx, bxv = mir ? W - ball.x : ball.x;
    if (vx < 1) return null;
    const gx = W - LX - ball.r, t = (gx - bxv) / vx;
    if (t < 0 || t > 90) return null;
    const lo = LY + ball.r, span = H - LY - ball.r - lo;
    let y = (ball.y + ball.vy * t - lo) % (2 * span);
    if (y < 0) y += 2 * span;
    if (y > span) y = 2 * span - y;
    y += lo;
    const sd = teamOf(n); // gawang milik tim n
    if (y < goalTop(sd) - 25 || y > goalBot(sd) + 25) return null;
    return { x: mir ? W - gx : gx, y, t };
  }

  function botThink(n) {
    const s = st.pl[n], me = P(n);
    if (!s || !me) return;
    // Koordinat 'cermin': bot tim kiri dihitung seolah-olah menyerang ke kiri seperti tim kanan
    const X = (x) => (teamOf(n) === 0 ? W - x : x);
    const bx = X(ball.x), mx = X(me.x);
    if (s.botCool > 0) s.botCool--;
    const oi = nearestFoe(n, ball), o = st.pl[oi], op = P(oi); // lawan terdekat ke bola
    if (s.orbit) { botOrbit(s, n, op); return; } // dicek tiap frame agar pelepasan tepat
    if (--s.botT > 0) return;
    s.botT = 3;
    if (elapsed < 1) return;

    const bc = bctx();
    // Ancaman: pakai prediksi bot.js (gesekan+pantulan) bila ada, kalau tidak pakai perkiraan lama
    const th = bc ? bc.threat : ballThreat(n);
    const dB = dist(me, ball), dO = dist(op, ball), dOP = dist(op, me);
    const oFree = o.stunT < 30;
    const late = !!(bc && bc.late); // bot diperkirakan telat sampai titik cegat
    const attacking = !!(bc && bc.mode === 'attack');
    const nearOwnGoal = bx > W - LX - 110;
    const myScore = score[n & 1];

    if (!s.skill || s.botCool > 0 || !canUse(n)) return;

    const go = (cool) => { use(n); s.botCool = cool; };
    // Saat lawan hampir menyentuh bola: paling merusak untuk skill yang menghambat lawan
    const oAboutToPlay = dO < 190 && (bx < W * 0.7 || th);

    switch (s.skill) {
      case 'fast':
        // Cepat dipakai saat telat mengejar bola / harus menutup tembakan
        if (bc ? ((late && attacking && dB > 120) || (bc.mode === 'block' && bc.late)) : ((bx > W * 0.4 && dB > 100) || (th && dB > 70))) go(30);
        break;
      case 'big':
        // Tubuh besar = tameng gawang (tapi lebih lambat): pakai saat bertahan
        if ((th && dB < 230) || (bc && bc.mode === 'guard' && bx > W * 0.55 && dO < 260) || (!bc && ((dB < 150 && dO < 260) || (bx > W * 0.6 && dB < 260)))) go(30);
        break;
      case 'grow':
        // Darurat: tembakan menuju gawang & bot sudah dekat
        if ((th && dB < 170) || (dOP < 110 && dB < 150 && bx > W * 0.6)) go(20);
        break;
      case 'slow':
        if (dOP > 90 && dOP < 520 && o.slowT < 20 && (oAboutToPlay || (late && dO < 320) || th)) go(40);
        break;
      case 'freeze':
        if (dOP > 100 && dOP < 480 && oFree && ((dO < 170 && bx < W * 0.65) || th || (late && dO < 300))) go(60);
        break;
      case 'bomb':
        if (dOP > 90 && dOP < 380 && oFree && (oAboutToPlay || th)) go(40);
        break;
      case 'orbit':
        // canUse() sudah memastikan bola di area sendiri & dalam jangkauan
        if (dO > 110 || th) go(30);
        break;
      case 'shadow':
        if (myScore <= 1 && !th && bx < W * 0.55 && dB < 280) go(60);
        break;
      case 'dark':
        if (!th && bx < W * 0.45 && dB < 380) go(40);
        break;
      case 'swap':
        if (bc ? (bc.mode === 'block' && late && dB > 160) || (bx > W * 0.7 && mx < W * 0.62 && dB > 130 && !th)
               : ((th && dB > 140) || (bx > W * 0.7 && mx < W * 0.62 && dB > 130))) go(30);
        break;
      case 'ghost':
        if ((bx > W * 0.55 && dO < 320) || th || (dB < 300 && bx < W * 0.6)) go(90);
        break;
      case 'dash': {
        if (!bc) {
          if ((bx > W / 2 - 15 && dB > 110 && dB < 420) || (th && dB > 100)) go(20);
          break;
        }
        if (!bc.tgt) break;
        const dT = dist(me, bc.tgt);
        // Melesat ±170 px: hanya bila jaraknya cukup (tidak melewati target) dan bot memang telat
        if (dT > 190 && !bc.commit && (bc.mode === 'block' || (attacking && late && !nearOwnGoal))) go(20);
        break;
      }
      case 'back':
        if (!s.bk) {
          if (!th && bx < W * 0.6 && mx > W * 0.68 && dB > 120) go(60); // tandai posisi jaga
        } else if (dist(me, s.bk) > 130 && (th || late)) go(60);
        else if (dist(me, s.bk) > 220 && bx < W * 0.4) go(60);
        break;
      case 'brake':
        if (th && dB < 260) go(60);
        break;
      case 'boost':
      case 'slowbox':
        botBox(s, th, dB, n);
        break;
      case 'timestop':
        if (th && ballInOwnHalf(n) && dB > 100) go(60);
        break;
      case 'chain':
        if (dOP > 70 && dOP < 330 && oFree && (oAboutToPlay || th || dO < 200)) go(40);
        break;
      case 'rewind': {
        // Pakai saat bola mengancam gawang sendiri dan bola jauh lebih dekat ke gawang sendiri dibanding 3 detik lalu
        const h0 = hist[0];
        if (h0 && th && th.t < 45 && X(h0.b.x) < bx - 100) go(60);
        break;
      }
      case 'cannon':
        if (dOP > 120 && dOP < 520 && oFree && (oAboutToPlay || th || dO < 260)) go(40);
        break;
      case 'goalmove':
        if (ballInOppHalf(n) && dB < 220 && dO > 100) go(60);
        break;
      case 'mirror':
        // Dua badan menutup gawang: pakai saat bola di area sendiri / mengancam, atau saat bola dekat
        if (th || (bx > W * 0.5 && dB < 260) || dB < 150) go(40);
        break;
      case 'wall':
        botWall(s, th, n, op);
        break;
      case 'portal':
        botPortal(s, th, dB, dO, n, me);
        break;
    }
  }

  // Bot hanya boleh memasang di sisinya + sedikit melewati garis tengah (60px)
  const botSide = (n, x) => (teamOf(n) === 0 ? W - x : x) >= W / 2 - 60;

  // Kotak: Mempercepat di depan bola (arah gawang lawan); Memperlambat di jalur tembakan ke gawang sendiri.
  function botBox(s, th, dB, n) {
    if (s.uses <= 0 || st.boxes.filter((b) => b.n === n).length >= 2) return;
    const X = (x) => (teamOf(n) === 0 ? W - x : x), bxv = X(ball.x);
    const c = [];
    if (s.skill === 'boost') {
      if (th || dB > 150 || bxv < W * 0.4) return;
      for (const f of [115, 150, 190]) c.push([X(bxv - f), ball.y + (H / 2 - ball.y) * 0.2]);
    } else {
      if (!th) return;
      for (const f of [150, 200, 110]) c.push([X(W - LX - f), th.y]);
    }
    for (const [x, y] of c) if (botSide(n, x) && placeBox(n, x, y, { x: teamOf(n) === 0 ? 1 : -1, y: 0 })) { s.botCool = 90; return; }
    s.botCool = 30;
  }

  // Orbit: lepas saat arah singgung tepat menuju pojok gawang yang jauh dari pemain lawan
  function botOrbit(s, n, op) {
    if (s.botCool > 0) return;
    const mir = teamOf(n) === 0, o = s.orbit;
    const tx = -Math.sin(o.angle) * (mir ? -1 : 1), ty = Math.cos(o.angle), bxv = mir ? W - ball.x : ball.x;
    const sd = 1 - teamOf(n), GT = goalTop(sd), GB = goalBot(sd); // gawang lawan
    const gy = op.y < (GT + GB) / 2 ? GB - 26 : GT + 26; // pojok yang jauh dari pemain lawan
    let aimed = false;
    if (tx < -0.25) {
      const t = (LX - bxv) / tx, yh = ball.y + ty * t; // garis lurus (tanpa pantulan)
      const tol = o.frames < 200 ? 10 : o.frames < 400 ? 22 : 34;
      aimed = Math.abs(yh - gy) < tol && yh > GT + 12 && yh < GB - 12;
    }
    const danger = foes(n).some((m) => dist(P(m), ball) < 110) && tx < -0.6; // lawan mendekat: lepas lebih awal
    if ((o.frames > 30 && aimed) || danger || o.frames > 600) {
      use(n);
      s.botCool = 30;
    }
  }

  // Tembok: dipasang di jalur bola menuju titik tembus gawang yang diprediksi.
  function botWall(s, th, n, op) {
    if (s.uses <= 0) return;
    const mir = teamOf(n) === 0, X = (x) => (mir ? W - x : x), bxv = X(ball.x), vxv = mir ? -ball.vx : ball.vx;
    const hot = th || (bxv > W * 0.6 && vxv > -1 && dist(op, ball) < 200);
    if (!hot) return;
    const gx = W - LX, gy = th ? th.y : H / 2;
    let ang = Math.atan2(gy - ball.y, gx - bxv) + Math.PI / 2;
    if (mir) ang = Math.PI - ang;
    for (const f of [0.5, 0.62, 0.38, 0.28, 0.72, 0.85]) {
      const cx = Math.min(bxv + (gx - bxv) * f, W - LX - 105 - 14), cy = ball.y + (gy - ball.y) * f;
      if (cx - bxv < ball.r + 45) continue;
      if (placeWall(n, X(cx), cy, ang)) { s.botCool = 90; return; }
    }
    s.botCool = 30;
  }

  // Portal: dipasang langsung (tanpa preview) di titik valid.
  // A di depan bola (arah serangan, atau arah datangnya bola saat bertahan), B di depan gawang lawan.
  function botPortal(s, th, dB, dO, n, me) {
    const mir = teamOf(n) === 0, X = (x) => (mir ? W - x : x), bxv = X(ball.x), mxv = X(me.x);
    const mine = () => st.portals.filter((q) => q.n === n).length;
    if (s.uses <= 0 || mine() >= 2) return;
    const tryPlace = (cands) => {
      for (const [x, y] of cands) if (botSide(n, X(x)) && placePortal(n, X(x), y)) return true;
      return false;
    };
    if (mine() === 0) {
      let dx, dy;
      if (th) {
        const vx = mir ? -ball.vx : ball.vx, l = Math.hypot(vx, ball.vy) || 1;
        dx = vx / l; dy = ball.vy / l;
      } else if (bxv > W * 0.3 && bxv < W * 0.8 && bxv < mxv && dB < 200 && dO > 90) {
        dx = LX - bxv; dy = H / 2 - ball.y;
        const l = Math.hypot(dx, dy) || 1;
        dx /= l; dy /= l;
      } else return;
      const c = [];
      for (const d of [110, 140, 90, 170]) for (const off of [0, 30, -30])
        c.push([bxv + dx * d - dy * off, ball.y + dy * d + dx * off]);
      if (!tryPlace(c)) { s.botCool = 30; return; }
    }
    const m = H / 2, c0 = W / 2;
    tryPlace([[c0 + 10, m], [c0 + 10, m - 90], [c0 + 10, m + 90], [c0 - 40, m], [c0 - 40, m - 100], [c0 - 40, m + 100]]);
    s.botCool = 60;
  }

  // ---------- Gambar ----------
  const pathCache = {};
  const path = (k) => (pathCache[k] = pathCache[k] || new Path2D(ICON_D[k]));
  function rectPath(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }
  function drawIcon(k, x, y, size, color, lw = 2.2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.stroke(path(k));
    ctx.restore();
  }

  function drawWall(w, alpha = 1, k = 1) {
    const hl = WALL_LEN / 2, ht = WALL_T / 2;
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.a);
    const sc = k * (1 - 0.25 * (w.pop || 0));
    if (sc !== 1) ctx.scale(sc, sc);
    ctx.globalAlpha = alpha * (1 - 0.5 * (w.pop || 0));
    rectPath(-hl, -ht, WALL_LEN, WALL_T, 3);
    ctx.fillStyle = '#2b3a49';
    ctx.fill();
    ctx.strokeStyle = 'rgba(243,240,231,.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      const x = -hl + (i * WALL_LEN) / 6;
      ctx.moveTo(x, -ht);
      ctx.lineTo(x, ht);
    }
    ctx.stroke();
    const dmg = WALL_HP - w.hp;
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < dmg; i++) {
      const u = -hl + ((i + 0.7) * WALL_LEN) / WALL_HP;
      ctx.moveTo(u, -ht);
      ctx.lineTo(u + 3, -1);
      ctx.lineTo(u - 3, 2);
      ctx.lineTo(u + 1, ht);
    }
    ctx.stroke();
    rectPath(-hl, -ht, WALL_LEN, WALL_T, 3);
    ctx.strokeStyle = TEAM[w.n];
    ctx.lineWidth = 3;
    ctx.stroke();
    if (w.flash > 0) {
      rectPath(-hl, -ht, WALL_LEN, WALL_T, 3);
      ctx.fillStyle = `rgba(255,255,255,${w.flash * 0.85})`;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPreview(n) {
    const s = st.pl[n];
    if (!s.preview || !s.pv) return;
    const v = s.pv, bad = !v.ok, hl = WALL_LEN / 2, ht = WALL_T / 2;
    const col = bad ? '#FF5C5C' : '#7CFFB2';
    if (isBox(s.skill)) {
      const hh = boxH(s.skill);
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.globalAlpha = 0.3 + 0.1 * Math.sin(tick * 0.2) + (s.inv > 0 ? 0.25 : 0);
      rectPath(-hh, -hh, hh * 2, hh * 2, 6);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.setLineDash([8, 5]);
      ctx.lineWidth = s.inv > 0 ? 4 : 2.5;
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.setLineDash([]);
      if (bad) {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-9, -9); ctx.lineTo(9, 9);
        ctx.moveTo(9, -9); ctx.lineTo(-9, 9);
        ctx.stroke();
      } else if (s.skill === 'boost' && v.d) {
        // panah arah kotak = arah gerak pemain saat ini
        ctx.rotate(Math.atan2(v.d.y, v.d.x));
        ctx.lineWidth = 4; ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.moveTo(5, -9); ctx.lineTo(14, 0); ctx.lineTo(5, 9);
        ctx.stroke();
      } else drawIcon(s.skill, -9, -9, 18, '#ffffff', 2.4);
      ctx.restore();
      return;
    }
    if (s.skill === 'portal') {
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.globalAlpha = 0.3 + 0.1 * Math.sin(tick * 0.2) + (s.inv > 0 ? 0.25 : 0);
      ctx.beginPath();
      ctx.arc(0, 0, PORTAL_R, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.setLineDash([8, 5]);
      ctx.lineWidth = s.inv > 0 ? 4 : 2.5;
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.setLineDash([]);
      if (bad) {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-9, -9); ctx.lineTo(9, 9);
        ctx.moveTo(9, -9); ctx.lineTo(-9, 9);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.a);
    ctx.globalAlpha = 0.35 + 0.1 * Math.sin(tick * 0.2) + (s.inv > 0 ? 0.25 : 0);
    rectPath(-hl, -ht, WALL_LEN, WALL_T, 3);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.setLineDash([8, 5]);
    ctx.lineWidth = s.inv > 0 ? 4 : 2.5;
    ctx.strokeStyle = col;
    ctx.stroke();
    ctx.setLineDash([]);
    if (bad) {
      ctx.rotate(-v.a);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-9, -9);
      ctx.lineTo(9, 9);
      ctx.moveTo(9, -9);
      ctx.lineTo(-9, 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShot(sh) {
    const c = COL[sh.k];
    sh.hist.forEach((h, i) => {
      ctx.globalAlpha = (i / sh.hist.length) * 0.4;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(h.x, h.y, SHOT_R * (0.3 + i / 12), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(sh.x, sh.y, 1, sh.x, sh.y, SHOT_R * 2.2);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(1, 'rgba(110,198,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, SHOT_R * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.rotate(sh.rot);
    ctx.fillStyle = sh.k === 'freeze' ? '#FFFFFF' : '#E8F7FF';
    ctx.strokeStyle = TEAM[sh.n];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -SHOT_R);
    ctx.lineTo(SHOT_R * 0.7, 0);
    ctx.lineTo(0, SHOT_R);
    ctx.lineTo(-SHOT_R * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawGhost(g) {
    const R = gr(), blink = g.age > GHOST_FRAMES - 120 && Math.floor(tick / 6) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.18 : 0.55;
    const gl = ctx.createRadialGradient(g.x, g.y, 2, g.x, g.y, R * 2.6);
    gl.addColorStop(0, 'rgba(201,214,255,.55)');
    gl.addColorStop(1, 'rgba(201,214,255,0)');
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(g.x, g.y, R * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EEF2FF';
    ctx.beginPath();
    ctx.arc(g.x, g.y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = blink ? 0.3 : 0.95;
    ctx.strokeStyle = TEAM[g.n];
    ctx.lineWidth = 2.2;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -tick * 0.4;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#6F7FB8';
    ctx.beginPath();
    ctx.arc(g.x + Math.cos(g.spin) * R * 0.45, g.y + Math.sin(g.spin) * R * 0.45, R * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPortal(pt) {
    const linked = st.portals.some((q) => q.n === pt.n && q !== pt), col = PCOL[pt.i];
    const R = PORTAL_R * (1 - 0.35 * pt.pop), dir = pt.i ? -1 : 1;
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.globalAlpha = linked ? 1 : 0.5;
    const g = ctx.createRadialGradient(0, 0, R * 0.3, 0, 0, R * 1.9);
    g.addColorStop(0, col + 'AA');
    g.addColorStop(1, col + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(8,14,28,.7)';
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const a0 = tick * 0.08 * dir + (k * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(0, 0, R * (0.3 + 0.22 * k), a0, a0 + Math.PI * 1.1);
      ctx.stroke();
    }
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = TEAM[pt.n];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, R + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBomb(b) {
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.5);
    // Saat kick-off, bom tampak menempel di atas bola utama; dibuat lebih kecil
    // agar pola bola tetap terlihat. Setelah bergerak, tampil dengan ukuran normal.
    const baseRadius = b.r || BOMB_R;
    const r = b.onBall ? 6.5 * (baseRadius / BOMB_R) : baseRadius;
    const glow = r * 2.6;
    const g = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, glow);
    g.addColorStop(0, `rgba(255,138,61,${0.5 + 0.3 * pulse})`);
    g.addColorStop(1, 'rgba(255,138,61,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, glow, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1f2a';
    ctx.strokeStyle = TEAM[b.n];
    ctx.lineWidth = b.onBall ? 1.8 : 2.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pulse > 0.5 ? '#FFD166' : '#FF8A3D';
    ctx.beginPath();
    ctx.arc(b.x + r * 0.33, b.y - r + 1, b.onBall ? 1.8 : 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const BOBM = () => BOMB_R * 2.6;

  function drawBadge(n) {
    const p = P(n), s = st.pl[n];
    if (!s.skill) return;
    let label = s.orbit ? 'LEPAS' : s.bk ? 'TARIK' : s.active ? Math.ceil(s.t / 60) + 's' : isPlace(s.skill) && s.preview ? 'PASANG' : s.cd > 0 ? 'CD ' + Math.ceil(s.cd / 60) + 's' : s.rp ? 'TUNGGU' : '×' + s.uses;
    ctx.font = '700 11px system-ui, sans-serif';
    const w = 26 + ctx.measureText(label).width + 8, h = 18;
    const x = clamp(p.x - w / 2, LX, W - LX - w);
    let y = p.y - p.r - h - 10;
    if (y < LY) y = p.y + p.r + 10;
    ctx.globalAlpha = s.uses > 0 || s.active ? 0.95 : 0.5;
    rectPath(x, y, w, h, 4);
    ctx.fillStyle = 'rgba(16,27,37,.82)';
    ctx.fill();
    ctx.strokeStyle = TEAM[n];
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawIcon(s.skill, x + 5, y + 2, 14, COL[s.skill], 2.4);
    ctx.fillStyle = '#F3F0E7';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 24, y + h / 2 + 0.5);
    ctx.globalAlpha = 1;
  }

  function drawOrbit(n) {
    const s = st.pl[n], o = s.orbit;
    if (!o) return;
    const p = P(n), R = o.radius;
    // --- Isi orbit: galaksi samar (nebula, lengan spiral, bintang, planet kecil) ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.clip();
    const neb = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
    neb.addColorStop(0, 'rgba(140,124,255,.16)');
    neb.addColorStop(0.55, 'rgba(85,217,255,.08)');
    neb.addColorStop(1, 'rgba(199,146,234,.03)');
    ctx.fillStyle = neb;
    ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2);
    const rot = tick * 0.012;
    ctx.fillStyle = '#DDEBFF';
    for (let arm = 0; arm < 3; arm++) {
      for (let i = 1; i <= 16; i++) {
        const t = i / 16, ang = arm * 2.094 + t * 3.4 + rot, rad = t * R * 0.92;
        ctx.globalAlpha = 0.1 + 0.2 * (1 - t) * (0.6 + 0.4 * Math.sin(tick * 0.1 + i + arm));
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(ang) * rad, p.y + Math.sin(ang) * rad, 0.9 + (1 - t) * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < 14; i++) { // bintang berkelip (posisi tetap berdasarkan indeks)
      const a = i * 2.399 + 1, rad = R * (((i * 37) % 100) / 100) * 0.95;
      ctx.globalAlpha = 0.08 + 0.2 * (0.5 + 0.5 * Math.sin(tick * 0.07 + i * 1.7));
      ctx.fillRect(p.x + Math.cos(a) * rad - 0.7, p.y + Math.sin(a) * rad - 0.7, 1.4, 1.4);
    }
    const sc = Math.max(0.55, Math.min(1, R / 100));
    const planets = [
      { rf: 0.34, sp: 0.035, r: 3.2, c: '#FFB86B', ring: false },
      { rf: 0.58, sp: -0.022, r: 4.4, c: '#8C7CFF', ring: true },
      { rf: 0.8, sp: 0.014, r: 2.8, c: '#55D9FF', ring: false },
    ];
    planets.forEach((pl, i) => {
      const ang = i * 2.1 + tick * pl.sp, orR = R * pl.rf, px = p.x + Math.cos(ang) * orR, py = p.y + Math.sin(ang) * orR, r = pl.r * sc;
      ctx.globalAlpha = 0.09;
      ctx.strokeStyle = '#DDEBFF';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, orR, 0, Math.PI * 2);
      ctx.stroke();
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2.6);
      g.addColorStop(0, pl.c + '66');
      g.addColorStop(1, pl.c + '00');
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = pl.c;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      if (pl.ring) {
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#FFE2F5';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(px, py, r * 1.9, r * 0.6, ang * 0.5 + 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    ctx.restore();

    // --- Cincin orbit (seperti semula) ---
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = COL.orbit;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.lineDashOffset = -tick * 1.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.2 + 0.12 * Math.sin(tick * 0.25);
    ctx.fillStyle = COL.orbit;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShadow(n) {
    const s = st.pl[n];
    if (!s.sh) return;
    const p = s.sh.p;
    const blink = s.t < 120 && Math.floor(tick / 6) % 2 === 0; // berkedip 2 detik terakhir
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.12);
    ctx.save();
    // Aura gelap yang berdenyut
    const R = p.r * (2.5 + 0.25 * pulse);
    const au = ctx.createRadialGradient(p.x, p.y, p.r * 0.5, p.x, p.y, R);
    au.addColorStop(0, 'rgba(8,4,20,.65)');
    au.addColorStop(0.55, 'rgba(36,16,72,.32)');
    au.addColorStop(1, 'rgba(36,16,72,0)');
    ctx.globalAlpha = blink ? 0.4 : 1;
    ctx.fillStyle = au;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.fill();
    // Cincin aura ungu yang bergerak
    ctx.globalAlpha = (blink ? 0.2 : 0.55) * (0.7 + 0.3 * pulse);
    ctx.strokeStyle = '#8C64FF';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 7]);
    ctx.lineDashOffset = tick * 0.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 8 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Tubuh bayangan (digelapkan)
    ctx.globalAlpha = blink ? 0.25 : 0.55;
    ctx.fillStyle = TEAM[n];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,6,24,.38)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#101B25';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -tick * 0.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawIcon('shadow', p.x - 8, p.y - 8, 16, '#F3F0E7', 2.2);
  }

  // ---------- Gambar skill tambahan ----------
  function drawBox(b) {
    const h = boxH(b.k), c = COL[b.k], life = clamp(b.t / BOX_LIFE, 0, 1);
    const blink = b.t < 180 && Math.floor(tick / 6) % 2 === 0;
    ctx.save();
    ctx.translate(b.x, b.y);
    const sc = 1 - 0.2 * b.pop;
    ctx.scale(sc, sc);
    ctx.globalAlpha = blink ? 0.35 : 1;
    rectPath(-h, -h, h * 2, h * 2, 6);
    ctx.fillStyle = c + '33';
    ctx.fill();
    ctx.save();
    rectPath(-h, -h, h * 2, h * 2, 6);
    ctx.clip();
    ctx.strokeStyle = c + 'AA';
    ctx.lineCap = ctx.lineJoin = 'round';
    if (b.k === 'boost') {
      // chevron bergerak searah panah kotak
      ctx.lineWidth = 3;
      ctx.rotate(Math.atan2(b.dy, b.dx));
      const off = (tick * 0.9) % 24;
      for (let j = -3; j <= 3; j++)
        for (let i = -4; i < 5; i++) {
          const x = i * 24 + off, y = j * 28;
          ctx.beginPath();
          ctx.moveTo(x, y - 12);
          ctx.lineTo(x + 10, y);
          ctx.lineTo(x, y + 12);
          ctx.stroke();
        }
    } else {
      ctx.lineWidth = 2;
      const off = (tick * 0.5) % 16;
      for (let i = -8; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(-h + i * 16 + off, h);
        ctx.lineTo(-h + i * 16 + off + h * 2, -h);
        ctx.stroke();
      }
    }
    ctx.restore();
    rectPath(-h, -h, h * 2, h * 2, 6);
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 5]);
    ctx.lineDashOffset = -tick * 0.4;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = TEAM[b.n];
    ctx.fillRect(-h + 4, h - 7, (h * 2 - 8) * life, 3);
    ctx.restore();
  }

  function drawArea(n) {
    const s = st.pl[n], p = P(n), R = AREA_R[s.skill], c = COL[s.skill];
    const base = s.t < 90 && Math.floor(tick / 6) % 2 === 0 ? 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = base;
    const g = ctx.createRadialGradient(p.x, p.y, R * 0.2, p.x, p.y, R);
    g.addColorStop(0, c + '10');
    g.addColorStop(1, c + '40');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -tick * 0.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    if (s.skill === 'brake') {
      ctx.setLineDash([]);
      ctx.globalAlpha = base * 0.55;
      for (const f of [0.6, 0.3]) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, R * f, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawBackMark(n) {
    const s = st.pl[n], p = P(n), c = COL.back;
    const m = s.bk || s.pull;
    if (!m) return;
    ctx.save();
    ctx.strokeStyle = c;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -tick * 0.8;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c + '33';
    ctx.strokeStyle = TEAM[n];
    ctx.lineWidth = 3;
    const r = BACK_MARK_R + Math.sin(tick * 0.15) * 1.5;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawZonesBack() {
    for (const b of st.boxes) drawBox(b);
    for (const n of slots()) {
      const s = st.pl[n];
      if (!s.skill || !P(n)) continue;
      if (s.active && AREA_R[s.skill]) drawArea(n);
      if (s.bk || s.pull) drawBackMark(n);
    }
  }

  function drawChain(c) {
    const p = P(c.n), o = P(c.m >= 0 ? c.m : 1 - c.n);
    let ex, ey;
    if (c.mode === 'lock') {
      ex = o.x;
      ey = o.y;
    } else {
      ex = p.x + c.dx * c.len;
      ey = p.y + c.dy * c.len;
    }
    ctx.save();
    ctx.globalAlpha = c.mode === 'burn' ? clamp(c.t / 14, 0, 1) : 1;
    ctx.lineCap = 'round';
    const line = () => {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    };
    ctx.strokeStyle = 'rgba(255,210,125,.25)';
    ctx.lineWidth = 12;
    line();
    ctx.strokeStyle = c.mode === 'burn' ? '#FF8A3D' : COL.chain;
    ctx.lineWidth = 6;
    ctx.setLineDash([11, 6]);
    ctx.lineDashOffset = -tick * (c.mode === 'lock' ? 0.2 : 1.5);
    line();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#FFF3D6';
    ctx.lineWidth = 2;
    line();
    ctx.fillStyle = COL.chain;
    ctx.strokeStyle = TEAM[c.n];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ex, ey, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawTimeStop() {
    const s = st.pl.find((q) => q.skill === 'timestop' && q.active);
    if (!s) return;
    ctx.save();
    ctx.fillStyle = 'rgba(140,160,255,.10)';
    ctx.fillRect(-12, -12, W + 24, H + 24);
    const f = clamp(s.t / (s.tMax || 1), 0, 1), rr = ball.r + 12;
    ctx.lineWidth = 3;
    ctx.strokeStyle = COL.timestop;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
    ctx.stroke();
    ctx.restore();
    drawIcon('timestop', ball.x - 9, ball.y - ball.r - 34, 18, COL.timestop, 2.4);
  }

  function drawFrontNew() {
    for (const c of st.chains) drawChain(c);
    for (const n of slots()) {
      const s = st.pl[n], p = P(n);
      if (!p) continue;
      if (s.sl2 > 0) {
        ctx.save();
        ctx.strokeStyle = COL.back;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -tick * 0.5;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (s.lockT > 0) {
        ctx.save();
        ctx.strokeStyle = COL.chain;
        ctx.lineWidth = 3.5;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -tick * 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.font = '800 11px system-ui, sans-serif';
        ctx.fillStyle = COL.chain;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TERIKAT ' + (s.lockT / 60).toFixed(1) + 's', p.x, p.y + p.r + 14);
      }
    }
    if (tsOn()) drawTimeStop();
  }

  function drawBack() {
    if (!st.on) return;
    for (const d of st.dying) drawWall(d, d.t, 1 + (1 - d.t) * 0.18);
    for (const w of st.walls) drawWall(w);
    for (const pt of st.portals) drawPortal(pt);
    drawFx(0);
    drawZonesBack();
    for (const n of slots()) {
      const p = P(n), s = st.pl[n];
      if (s.skill === 'dash')
        for (const t of s.trail) {
          ctx.globalAlpha = Math.max(0, t.l) * 0.4;
          ctx.fillStyle = COL.dash;
          ctx.beginPath();
          ctx.arc(t.x, t.y, p.r * (0.5 + 0.5 * t.l), 0, Math.PI * 2);
          ctx.fill();
        }
      if (s.skill === 'fast') {
        for (const t of s.trail) {
          ctx.globalAlpha = Math.max(0, t.l) * 0.35;
          ctx.fillStyle = COL.fast;
          ctx.beginPath();
          ctx.arc(t.x, t.y, p.r * (0.5 + 0.5 * t.l), 0, Math.PI * 2);
          ctx.fill();
        }
        if (s.vis > 0.02) {
          const g = ctx.createRadialGradient(p.x, p.y, p.r * 0.6, p.x, p.y, p.r * 2.1);
          g.addColorStop(0, `rgba(255,209,102,${0.55 * s.vis})`);
          g.addColorStop(1, 'rgba(255,209,102,0)');
          ctx.globalAlpha = 1;
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if ((s.skill === 'big' || s.skill === 'grow') && s.vis > 0.02) {
        ctx.globalAlpha = (s.skill === 'grow' ? 0.62 : 0.45) * s.vis;
        ctx.strokeStyle = COL[s.skill];
        ctx.lineWidth = (s.skill === 'grow' ? 5 : 4) + Math.sin(tick * 0.15);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + (s.skill === 'grow' ? 7 : 5), 0, Math.PI * 2);
        ctx.stroke();
        if (s.skill === 'grow') {
          ctx.globalAlpha *= 0.65;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + 13 + Math.sin(tick * 0.5) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      drawOrbit(n);
      drawShadow(n);
      drawMirror(n);
    }
  }

  function drawRewindFx() {
    if (!rw) return;
    const last = Math.max(1, rw.fr.length - 1), prog = clamp(rw.pos / last, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(122,231,255,.10)';
    ctx.fillRect(-12, -12, W + 24, H + 24);
    ctx.fillStyle = COL.rewind;
    ctx.globalAlpha = 0.13;
    const off = (tick * 12) % 64;
    for (let y = H + 64 - off; y > -64; y -= 64) ctx.fillRect(-12, y, W + 24, 7); // garis kaset bergerak ke atas
    ctx.globalAlpha = 1;
    drawIcon('rewind', W / 2 - 74, 30, 26, COL.rewind, 2.6);
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillStyle = '#E6FBFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('MUNDUR', W / 2 - 40, 43);
    const bw = 220, bx = W / 2 - bw / 2, by = 64;
    ctx.fillStyle = 'rgba(16,27,37,.7)';
    ctx.fillRect(bx, by, bw, 6);
    ctx.fillStyle = COL.rewind;
    ctx.fillRect(bx, by, bw * (1 - prog), 6);
    ctx.restore();
  }

  function drawFront() {
    if (!st.on) {
      syncUI();
      return;
    }
    for (const n of slots()) drawPreview(n);
    drawFrontNew();
    for (const sh of st.shots) drawShot(sh);
    for (const c of st.cannons) drawCannon(c);
    for (const g of st.ghosts) drawGhost(g);
    for (const b of st.bombs) drawBomb(b);
    drawFx(1);
    for (const n of slots()) {
      const p = P(n), s = st.pl[n];
      if (s.slowT > 0) {
        ctx.save();
        ctx.strokeStyle = COL.slow;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -tick * 0.5;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        drawIcon('slow', p.x + p.r * 0.55, p.y - p.r - 14, 14, COL.slow, 2.4);
      }
      if (s.stunT > 0) {
        ctx.save();
        ctx.fillStyle = s.stunC === COL.bomb ? 'rgba(255,138,61,.28)' : 'rgba(191,243,255,.4)';
        ctx.strokeStyle = s.stunC;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.font = '800 11px system-ui, sans-serif';
        ctx.fillStyle = s.stunC;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('STUN ' + (s.stunT / 60).toFixed(1) + 's', p.x, p.y + p.r + 14);
      }
      if (s.active && s.tMax) {
        const f = clamp(s.t / s.tMax, 0, 1), rr = p.r + 9;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = COL[s.skill];
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
        ctx.stroke();
      }
      drawBadge(n);
    }
    for (const r of st.rings) {
      ctx.globalAlpha = Math.max(0, r.t);
      ctx.strokeStyle = r.c;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 8 + (1 - r.t) * r.max, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawRewindFx();
    syncUI();
  }

  // Gelap mengikuti sisi lapangan tempat bola berada. Empat siklus:
  // 2 detik hitam total, lalu 0,5 detik terang.
  function drawDarkOverlay() {
    if (!st.on) return;
    const dark = st.pl.find((s) => s.skill === 'dark' && s.active);
    if (!dark || dark.tMax <= 0) return;
    const elapsedFrames = dark.tMax - dark.t;
    if (elapsedFrames % DARK_CYCLE >= DARK_ON) return;
    const side = ball.x < W / 2 ? 0 : 1;
    ctx.save();
    ctx.fillStyle = '#000000';
    if (side === 0) ctx.fillRect(-12, -12, W / 2 + 12, H + 24);
    else ctx.fillRect(W / 2, -12, W / 2 + 12, H + 24);
    ctx.restore();
    // Bola tetap terlihat jelas di atas area gelap (pemain & gawang tetap tersembunyi)
    ctx.save();
    const g = ctx.createRadialGradient(ball.x, ball.y, ball.r, ball.x, ball.y, ball.r * 3.2);
    g.addColorStop(0, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawBall(ball);
  }

  // ---------- Tombol / UI ----------
  const items = []; // {el, n}
  function setupBtn(el, n) {
    el.innerHTML =
      '<span class="sk-ic"></span><span class="sk-tx"><b class="sk-name"></b><small class="sk-st"></small></span><i class="sk-bar"></i>';
    el._ic = el.querySelector('.sk-ic');
    el._nm = el.querySelector('.sk-name');
    el._st = el.querySelector('.sk-st');
    el._held = false;
    el.title = skKey(n) ? 'Skill (' + skKey(n) + ')' : 'Skill Bot';
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (el._held) return;
      el._held = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) { }
      press(n);
      el.blur();
    });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, () => (el._held = false));
    el.addEventListener('click', (e) => e.preventDefault());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
    });
    items.push({ el, n });
  }
  for (const el of document.querySelectorAll('[data-skill-btn]')) setupBtn(el, +el.dataset.skillBtn);

  function statusText(n) {
    const s = st.pl[n];
    if (s.orbit) return 'TEKAN LAGI UNTUK LEPAS';
    if (s.skill === 'undo') return undoSt && undoSt.holders.includes(n) ? 'BATALKAN!' : s.uses > 0 ? 'SIAP' : 'HABIS';
    if (s.skill === 'back' && s.bk) return 'TARIK?';
    if (s.skill === 'chain' && st.chains.some((c) => c.n === n)) return 'RANTAI...';
    if (s.rp) return 'SIAP DIISI';
    if (s.cd > 0) return 'CD ' + Math.ceil(s.cd / 60) + 's';
    if (s.skill === 'grow') return s.active ? 'MEMBESAR' : `SISA ×${s.uses}`;
    if (s.skill === 'back' || s.skill === 'chain') return s.uses > 0 ? `SISA ×${s.uses}` : 'HABIS';
    if (isPlace(s.skill)) return s.preview ? (s.pv && !s.pv.ok ? 'TIDAK VALID' : 'PASANG?') : s.uses > 0 ? `SISA ×${s.uses}` : s.skill === 'portal' ? `AKTIF · ${Math.max(0, PORTAL_GOALS - s.pgoals)} GOL` : isBox(s.skill) ? (st.boxes.some((b) => b.n === n) ? 'KOTAK AKTIF' : 'HABIS') : st.walls.some((w) => w.n === n) ? 'TEMBOK AKTIF' : 'HABIS';
    if (s.skill === 'slow' || s.skill === 'freeze' || s.skill === 'bomb' || s.skill === 'ghost') return s.uses > 0 ? `SISA ×${s.uses}` : s.skill === 'bomb' ? 'BOM JALAN' : s.skill === 'ghost' && st.ghosts.length ? 'HANTU JALAN' : 'HABIS';
    if (s.skill === 'orbit' && s.uses > 0 && !canOrbit(n)) return ballInOwnHalf(n) ? 'DEKATKAN BOLA' : 'AREA SENDIRI';
    if (s.active) return (s.t / 60).toFixed(1) + 's';
    if ((s.skill === 'dark' || s.skill === 'timestop') && s.inv > 0) return 'BOLA DI SINI?';
    if (LIMIT[s.skill]) return s.uses > 0 ? `SIAP · SISA ${s.left}×` : 'HABIS';
    return s.uses > 0 ? 'SIAP' : 'HABIS';
  }

  function syncUI(force) {
    const show = st.on && live();
    for (const it of items) {
      const { el } = it;
      // Online: hanya satu tombol (milik pemain lokal); tombol "pemain 1" disembunyikan.
      const n = online() ? (it.n === 0 ? me() : -1) : it.n;
      // Tombol pemain yang tidak ada di mode ini disembunyikan; pad sentuh bot (VS 2 BOT) juga disembunyikan.
      if (n < 0 || !slots().includes(n) || (!online() && el.classList.contains('sk-pad') && !humanControlled(n))) {
        if (!el.hidden) {
          el.hidden = true;
          el._key = null;
        }
        continue;
      }
      const s = st.pl[n];
      const vis = show && !!s.skill;
      const dis = !canPress(n);
      const ro = show && !humanControlled(n);
      const key = [vis, s.skill, s.uses, s.active, Math.ceil(s.t / 6), s.preview, s.pv && s.pv.ok, dis, ro, s.fresh > 0, s.inv > 0, Math.ceil(s.cd / 6), s.rp, s.left, !!s.bk, s.lockT > 0, st.chains.some((c) => c.n === n), st.boxes.some((b) => b.n === n), mode].join('|');
      if (!force && el._key === key) continue;
      el._key = key;
      el.hidden = !vis;
      if (!vis) continue;
      el.disabled = dis;
      el.classList.toggle('readonly', ro);
      if (el._sk !== s.skill) {
        el._sk = s.skill;
        el.dataset.skill = s.skill;
        el._ic.innerHTML = icon(s.skill);
        el._nm.textContent = NAME[s.skill];
      }
      el._st.textContent = statusText(n);
      el.classList.toggle('active', s.active);
      el.classList.toggle('preview', s.preview);
      el.classList.toggle('bad', (s.preview && !!s.pv && !s.pv.ok) || ((s.skill === 'dark' || s.skill === 'timestop') && s.inv > 0));
      el.classList.toggle('used', s.uses <= 0 && !s.active && !s.preview);
      el.classList.toggle('fresh', s.fresh > 0);
      const max = START[s.skill] ? START[s.skill].uses : 1;
      el.style.setProperty(
        '--p',
        s.active && s.tMax ? (s.t / s.tMax).toFixed(3) : s.cd > 0 ? (1 - s.cd / s.cdMax).toFixed(3) : (s.uses / max).toFixed(2),
      );
      el.title = s.orbit
        ? (skKey(n) === 'Enter' ? 'Tekan Enter lagi untuk melepas Orbit' : 'Tekan Spasi lagi untuk melepas Orbit')
        : (skKey(n) ? 'Skill (' + skKey(n) + ')' : 'Skill Bot') + ' — ' + NAME[s.skill];
    }
  }

  // ---------- Keyboard: Spasi/E = P1, Enter/Shift kanan = P2 (Friend) ----------
  const notTyping = (e) => !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
  const handles = (e) =>
    gameActive && !over && notTyping(e) &&
    (e.code === 'Space' || e.key === ' ' || (!online() && HUMANS.length > 1 && e.key === 'Enter'));
  window.addEventListener('keydown', (e) => {
    if (!handles(e)) return;
    e.preventDefault();
    if (e.repeat) return;
    press(online() ? 0 : e.key === 'Enter' ? HUMANS[1] : HUMANS[0]);
    const a = document.activeElement;
    if (a && a !== document.body && a.blur) a.blur();
  });
  window.addEventListener('keyup', (e) => {
    if (handles(e)) e.preventDefault();
  });

  window.Skills = {
    newMatch, onKickoffReset, onGoal, onFinish, tickFx, update, updateBallSkill,
    speedMul, collidePlayer, collideBall, drawBack, drawFront, drawDarkOverlay, press, rewindStep, rewinding: () => !!rw,
    getSync, getSyncNet, applySync, guestUpdate, guestHold, dashMove, pushOut, remote, sig,
    debugState: () => st, botOrbiting: () => !!st.pl[1].orbit, botOrbitingN: (n) => !!(st.pl[n] && st.pl[n].orbit),
    list: () => Object.keys(START), skillOf: (n) => st.pl[n].skill,
    rerollAll, undoOffer, undoTick, undoClose, undoUsed,
    catalog: () => Object.keys(START).map((k) => ({ k, name: NAME[k], desc: DESC[k], col: COL[k], svg: icon(k), uses: START[k].uses, dur: START[k].dur, cd: CD[k] || 0, limit: LIMIT[k] || 0, isNew: isNew(k) })),
    // Untuk prediksi bola bot.js: normal tembok yang menabrak lingkaran (x,y,r), atau null
    wallHit: (x, y, r) => { for (const w of st.walls) { if (w.hp <= 0) continue; const h = circleObb(w, x, y, r); if (h) return h; } return null; },
  };
  // ---------- Halaman Daftar Skill ----------
  (() => {
    const scr = document.getElementById('skillsScreen'), grid = document.getElementById('skillsGrid');
    const openB = document.getElementById('skillsModeBtn'), backB = document.getElementById('skillsBack'), find = document.getElementById('skillsFind');
    if (!scr || !grid || !openB || !backB) return;
    const sec = (f) => String(+(f / 60).toFixed(1)).replace('.', ',');
    const card = (it, extra) => {
      const chips = [];
      if (it.uses > 0) chips.push(`Pakai ${it.uses}×`);
      if (it.dur > 0) chips.push(`Durasi ${sec(it.dur)} dtk`);
      if (it.cd > 0) chips.push(`Cooldown ${sec(it.cd)} dtk`);
      if (it.limit > 0) chips.push(`Jatah ${it.limit}× / game`);
      if (extra) chips.push(extra);
      return `<div class="sks-item" style="--sk:${it.col}"><span class="sks-ic">${it.svg}</span><div><b>${esc(it.name)}</b><p>${esc(it.desc)}</p><div class="sks-chips">${chips.map((c) => `<span>${esc(c)}</span>`).join('')}</div></div></div>`;
    };
    function render() {
      const q = (find.value || '').trim().toLowerCase();
      const items = window.Skills.catalog().filter((it) => !q || (it.name + ' ' + it.desc).toLowerCase().includes(q));
      const html = items.map((it) => card(it, it.isNew ? 'Hanya offline' : '')).join('');
      grid.innerHTML = html || '<p class="sks-empty">Tidak ada skill yang cocok.</p>';
    }
    openB.addEventListener('click', () => {
      document.getElementById('startScreen').hidden = true;
      scr.hidden = false;
      find.value = '';
      render();
      window.scrollTo(0, 0);
    });
    backB.addEventListener('click', () => {
      scr.hidden = true;
      document.getElementById('startScreen').hidden = false;
    });
    find.addEventListener('input', render);
  })();

  // Pelindung: error di satu fungsi skill hanya dicatat di console, tidak menghentikan render/permainan.
  const warned = {};
  for (const [k, fb] of [['tickFx'], ['update'], ['updateBallSkill', false], ['drawBack'], ['drawFront'], ['drawDarkOverlay'], ['dashMove', null], ['speedMul', 1], ['onKickoffReset'], ['onGoal'], ['undoOffer', null], ['rerollAll'], ['undoTick'], ['rewindStep', false]]) {
    const f = window.Skills[k];
    window.Skills[k] = (...a) => {
      try {
        return f(...a);
      } catch (e) {
        if (!warned[k]) { warned[k] = 1; console.error('[Skills.' + k + ']', e); }
        return fb;
      }
    };
  }
})();