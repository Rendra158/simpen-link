(() => {
  'use strict';

  // =========================================================
  // SUPABASE CONFIGURATION
  // =========================================================
  const SUPABASE_URL = 'https://muozkxadlkwovpiundcb.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6HTZ7lj4Y5BgTkLTl6r1kw_lw8wHol5';

  const configured =
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_PUBLISHABLE_KEY.length > 20 &&
    !SUPABASE_PUBLISHABLE_KEY.includes('PASTE_');

  if (!window.supabase?.createClient) {
    console.error('[MiniSoccer] Supabase JS belum dimuat.');
  }

  const sb = configured && window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        },
        realtime: { params: { eventsPerSecond: 40 } }
      })
    : null;

  const $ = (id) => document.getElementById(id);
  const SESSION_KEY = 'ms_online_session';
  const SNAPSHOT_KEY = 'ms_online_snapshot';
  const NAME_KEY = 'ms_player_name';

  const CFG = {
    stateActiveMs: 50,    // Host: state ~20x/detik saat ada gerakan (jalur relay)
    stateIdleMs: 1000,    // Host: 1x/detik saat semua diam
    stateEventMs: 33,     // Host: kirim lebih cepat saat tendangan/pantulan/skill berubah
    inputMs: 33,          // Jarak minimal antar input guest (hanya dikirim jika berubah)
    inputKeepMs: 1500,    // Input pengaman saat diam (jalur broadcast)
    fastStateMs: 33,      // DataChannel: state ~30x/detik saat bergerak
    fastEventMs: 16,      // DataChannel: kiriman cepat saat tendangan/pantulan
    fastInputMs: 16,      // DataChannel: jarak minimal antar input
    fastMoveKeepMs: 33,   // DataChannel: input + posisi saat bergerak
    fastIdleKeepMs: 250,  // DataChannel: pengaman saat diam (paket bisa hilang)
    inputMoveKeepMs: 66,  // Input + posisi saat bergerak (koreksi posisi di host)
    inputStaleMs: 2500,   // Host: input guest dianggap basi (pemain berhenti)
    pingMs: 700,          // Guest: ukur RTT
    frameTol: 6,          // Toleransi (ms) karena pengiriman terikat frame layar (hindari 33→50 ms acak)
    heartbeatMs: 5000,
    snapshotMs: 1000,
    hostSilenceMs: 7000,
    reconnectMs: 30000,
    retryMs: 5000,
    snapshotMaxAgeMs: 5 * 60 * 1000
  };

  const online = {
    userId: null,
    room: null,
    code: null,
    isHost: false,
    hostId: null,
    guestId: null,
    hostName: 'Player',
    guestName: 'Player',
    channel: null,
    channelReady: false,
    peerPresent: false,
    peerEverSeen: false,
    matchStarted: false,
    launched: false,
    remoteInput: { x: 0, y: 0 },
    lastInput: 0,
    lastInputSent: { x: 0, y: 0 },
    lastState: 0,
    lastVel: [0, 0, 0, 0, 0, 0],
    stateBusy: true,
    clockAt: 0,
    lastSnapshot: 0,
    lastHeartbeat: 0,
    lastHostState: 0,
    lastInputRecv: 0,
    lastPing: 0,
    lastSig: '',
    recvQ: 0,
    inQ: 0,
    rtt: 0,
    autoPaused: false,
    disconnectDeadline: 0,
    finalizing: false,
    rewardClaiming: false,
    forfeitClaiming: false,
    leaving: false,
    finished: false
  };

  // =========================================================
  // HELPERS
  // =========================================================
  function cleanName(value) {
    return String(value || 'Player')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim()
      .slice(0, 16) || 'Player';
  }

  function getName() {
    return cleanName(localStorage.getItem(NAME_KEY));
  }

  function setError(message = '') {
    const el = $('onlineError');
    if (el) el.textContent = message;
  }

  function saveSession() {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ code: online.code }));
  }

  function clearSavedRoom() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SNAPSHOT_KEY);
  }

  function saveSnapshot() {
    if (!online.isHost || !online.room || !window.MSGame) return;
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
        code: online.code,
        state: window.MSGame.getState(),
        savedAt: Date.now()
      }));
    } catch (error) {
      console.warn('[MiniSoccer] Snapshot gagal:', error);
    }
  }

  function readSnapshot(code) {
    try {
      const data = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || 'null');
      if (!data || data.code !== code || !data.state) return null;
      if (Date.now() - data.savedAt > CFG.snapshotMaxAgeMs) return null;
      return data.state;
    } catch (_) {
      return null;
    }
  }

  function resetRoomState() {
    Object.assign(online, {
      room: null, code: null, isHost: false, hostId: null, guestId: null,
      hostName: 'Player', guestName: 'Player', channelReady: false,
      peerPresent: false, peerEverSeen: false, matchStarted: false,
      launched: false, remoteInput: { x: 0, y: 0 }, lastInput: 0,
      lastInputSent: { x: 0, y: 0 }, lastState: 0, lastVel: [0, 0, 0, 0, 0, 0],
      stateBusy: true, clockAt: 0, lastSnapshot: 0, lastHeartbeat: 0,
      lastHostState: 0, lastInputRecv: 0, lastPing: 0, lastSig: '', recvQ: 0, inQ: 0, rtt: 0,
      autoPaused: false, disconnectDeadline: 0, finalizing: false,
      rewardClaiming: false, forfeitClaiming: false, leaving: false,
      finished: false
    });
  }

  // =========================================================
  // GUEST: simulasi lokal ada di game.js (guestStep). Di sini hanya jam & penanda sesi.
  // =========================================================
  function resetView() {
    online.lastPing = 0;
    online.rtt = 0;
    if (netEl) netEl.hidden = true;
  }

  // Indikator kecil di lapangan: jalur (P2P/RELAY) dan ping.
  let netEl = null,
    netAt = 0;
  function netInfo(now) {
    if (now - netAt < 500) return;
    netAt = now;
    if (!netEl) {
      netEl = document.createElement('div');
      netEl.style.cssText =
        'position:absolute;top:6px;right:8px;z-index:8;font:700 11px system-ui,sans-serif;color:#fff;opacity:.7;pointer-events:none;text-shadow:0 1px 2px #000';
      $('field').appendChild(netEl);
    }
    netEl.hidden = !online.matchStarted || online.finished;
    netEl.textContent = (fast() ? 'P2P' : 'RELAY') + (!online.isHost && online.rtt ? ' · ' + Math.round(online.rtt) + ' ms' : '');
  }

  // Jam lokal guest agar countdown, timer gol, dan waktu main berjalan halus di antara snapshot.
  function guestClock(now) {
    const dt = Math.min(0.1, (now - (online.clockAt || now)) / 1000);
    online.clockAt = now;
    if (online.isHost || paused || over) return;
    if (goalTimer > 0) {
      goalTimer = Math.max(0, goalTimer - dt);
      if (goalTimer <= 0) {
        endCelebrate();
        // Host langsung kick-off lagi kecuali pertandingan selesai; guest menahan simulasi sampai state host tiba.
        if (score[lastScorer] < WINS) {
          kickoff = 2.4;
          lastCount = 4;
        }
      }
    } else if (kickoff > 0) kickoff = Math.max(0, kickoff - dt);
    else elapsed += dt;
  }

  // =========================================================
  // SUPABASE AUTH & RPC
  // =========================================================
  async function ensureUser() {
    if (!sb) throw new Error('Supabase belum dikonfigurasi. Isi URL dan Publishable Key.');
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (data.session?.user?.id) return data.session.user.id;

    const result = await sb.auth.signInAnonymously();
    if (result.error) throw result.error;
    if (!result.data?.user?.id) throw new Error('Anonymous Auth gagal.');
    return result.data.user.id;
  }

  async function rpc(name, args = {}) {
    if (!sb) throw new Error('Supabase belum dikonfigurasi.');
    const { data, error } = await sb.rpc(name, args);
    if (error) throw error;
    return data;
  }

  // =========================================================
  // REALTIME
  // =========================================================
  // ---- WebRTC DataChannel (P2P, tanpa urutan/retransmit) untuk state & input ----
  // Supabase hanya dipakai untuk signaling & kejadian penting; jika P2P gagal, otomatis jatuh ke broadcast.
  const FAST = new Set(['state', 'input', 'ping', 'pong']);
  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  const rtc = { pc: null, dc: null, open: false, q: Promise.resolve() };
  const fast = () => rtc.open && rtc.dc?.readyState === 'open';

  function rtcClose() {
    try { rtc.dc?.close(); rtc.pc?.close(); } catch (_) {}
    rtc.pc = rtc.dc = null;
    rtc.open = false;
  }

  function rtcSetup() {
    rtcClose();
    const pc = (rtc.pc = new RTCPeerConnection(ICE));
    pc.onicecandidate = (e) => e.candidate && send('rtc', { from: online.userId, c: e.candidate.toJSON() });
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState) && rtc.pc === pc) rtcClose();
    };
    const bind = (dc) => {
      rtc.dc = dc;
      dc.onopen = () => { rtc.open = true; };
      dc.onclose = () => { if (rtc.dc === dc) rtc.open = false; };
      dc.onmessage = (e) => {
        try { const m = JSON.parse(e.data); if (FAST.has(m.e)) dispatch(m.e, m.p); } catch (_) {}
      };
    };
    if (online.isHost) bind(pc.createDataChannel('g', { ordered: false, maxRetransmits: 0 }));
    else pc.ondatachannel = (e) => bind(e.channel);
    return pc;
  }

  async function rtcStart() {
    if (!online.isHost || !window.RTCPeerConnection) return;
    const pc = rtcSetup();
    await pc.setLocalDescription(await pc.createOffer());
    send('rtc', { from: online.userId, d: pc.localDescription.toJSON() });
  }

  async function rtcSignal(p) {
    if (!p || p.from === online.userId || !window.RTCPeerConnection) return;
    try {
      if (p.d?.type === 'offer' && !online.isHost) {
        const pc = rtcSetup();
        await pc.setRemoteDescription(p.d);
        await pc.setLocalDescription(await pc.createAnswer());
        send('rtc', { from: online.userId, d: pc.localDescription.toJSON() });
      } else if (p.d?.type === 'answer' && online.isHost && rtc.pc) await rtc.pc.setRemoteDescription(p.d);
      else if (p.c && rtc.pc) await rtc.pc.addIceCandidate(p.c);
    } catch (error) {
      console.warn('[MiniSoccer] WebRTC:', error);
    }
  }

  async function send(event, payload = {}) {
    if (FAST.has(event) && fast()) {
      try { rtc.dc.send(JSON.stringify({ e: event, p: payload })); return true; }
      catch (_) { /* jatuh ke broadcast */ }
    }
    if (!online.channel || !online.channelReady) return false;
    try {
      await online.channel.send({ type: 'broadcast', event, payload });
      return true;
    } catch (error) {
      console.warn('[MiniSoccer] Broadcast gagal:', error);
      return false;
    }
  }

  async function cleanupChannel() {
    rtcClose();
    const channel = online.channel;
    online.channel = null;
    online.channelReady = false;
    if (channel && sb) {
      try { await sb.removeChannel(channel); }
      catch (error) { console.warn('[MiniSoccer] Cleanup channel:', error); }
    }
  }

  function renderLobby() {
    if (!online.room) return;
    $('roomCodeText').textContent = online.code || '--------';
    $('onlineBlueName').textContent = online.hostName || 'Player';
    $('onlineRedName').textContent = online.guestName || 'Waiting...';
    $('onlineStartBtn').hidden = !(
      online.isHost && online.peerPresent && !online.matchStarted
    );
    $('onlineStatus').textContent = online.matchStarted
      ? 'Pertandingan sedang berlangsung'
      : online.peerPresent
        ? 'Lawan terhubung! Host bisa memulai pertandingan.'
        : online.isHost
          ? 'Menunggu lawan bergabung...'
          : 'Terhubung ke room. Menunggu host...';
  }

  function showLobby() {
    $('startScreen').hidden = true;
    $('onlineScreen').hidden = false;
    $('onlineActions').hidden = true;
    $('onlineLobby').hidden = false;
  }

  function launchGame(restoreState = null) {
    if (online.launched) return;
    if (!window.MSGame?.startOnline) {
      setError('MSGame belum tersedia. Pastikan game.js dimuat sebelum online.js.');
      return;
    }
    online.launched = true;
    online.matchStarted = true;
    resetView();
    $('onlineScreen').hidden = true;
    window.MSGame.startOnline({
      hostName: online.hostName,
      guestName: online.guestName,
      isHost: online.isHost,
      restoreState
    });
  }

  // Host mengirim state, sekaligus mencatat kecepatan terakhir yang dikirim
  // (dipakai untuk mendeteksi tendangan/pantulan) dan apakah game sedang "sibuk".
  const speed = (o) => Math.hypot(o?.vx || 0, o?.vy || 0);

  async function publishState() {
    if (!online.isHost || !online.matchStarted || !online.channelReady || !window.MSGame) return;
    if (!ball || !p1 || !p2) return;
    online.lastVel = [ball.vx, ball.vy, p1.vx, p1.vy, p2.vx, p2.vy].map((n) => n || 0);
    const sig = window.MSGame.skillSig();
    online.lastSig = sig;
    online.stateBusy = !paused && !over && (
      kickoff > 0 || goalTimer > 0 ||
      speed(ball) > 0.3 || speed(p1) > 0.3 || speed(p2) > 0.3 ||
      (sig !== '' && !sig.endsWith(':0:0'))
    );
    await send('state', { n: window.MSGame.getNetState(), q: Date.now() });
  }

  const skillChanged = () => window.MSGame.skillSig() !== online.lastSig;

  // Apakah ada bola/pemain yang kecepatannya berubah jauh sejak state terakhir dikirim?
  function velChanged() {
    if (!ball || !p1 || !p2) return false;
    const l = online.lastVel;
    return Math.hypot(ball.vx - l[0], ball.vy - l[1]) > 1.5 ||
      Math.hypot(p1.vx - l[2], p1.vy - l[3]) > 1.5 ||
      Math.hypot(p2.vx - l[4], p2.vy - l[5]) > 1.5;
  }

  function makeFinalState(room, sourceState = null) {
    const state = JSON.parse(JSON.stringify(sourceState || window.MSGame.getState()));
    if (room?.winner_id && room?.host_id) {
      const winner = room.winner_id === room.host_id ? 0 : 1;
      state.score[winner] = Math.max(
        Number(state.score[winner]) || 0,
        (Number(state.score[1 - winner]) || 0) + 1
      );
    }
    state.over = true;
    state.paused = false;
    return state;
  }

  // =========================================================
  // DISCONNECT: HOST MAUPUN GUEST BOLEH MEMINTA DATABASE
  // =========================================================
  async function settleDisconnect() {
    if (!online.room || online.finished || online.forfeitClaiming) return;
    online.forfeitClaiming = true;
    try {
      const room = await rpc('ms_claim_disconnect_win', { p_code: online.code });
      if (room?.status !== 'finished') {
        throw new Error('Database belum menetapkan hasil disconnect.');
      }
      online.finished = true;
      const state = makeFinalState(room);
      await send('finish', { state, reason: room.finish_reason || 'disconnect' });
      window.MSGame.finishOnline(state);
      await claimReward();
    } catch (error) {
      console.warn('[MiniSoccer] Disconnect belum selesai:', error);
      online.disconnectDeadline = Date.now() + CFG.retryMs;
      setError(error.message || 'Gagal memeriksa disconnect. Mencoba lagi.');
    } finally {
      online.forfeitClaiming = false;
    }
  }

  function handlePresence() {
    if (!online.channel) return;
    const users = Object.values(online.channel.presenceState() || {}).flat();
    const peer = users.find((user) => user.playerId !== online.userId);

    if (peer) {
      const wasWaiting = !!online.disconnectDeadline;
      online.peerPresent = true;
      online.peerEverSeen = true;
      online.disconnectDeadline = 0;

      if (online.isHost) {
        online.guestId = peer.playerId;
        online.guestName = cleanName(peer.playerName);
      } else {
        online.hostId = peer.playerId;
        online.hostName = cleanName(peer.playerName);
      }

      if (online.isHost && !rtc.pc) rtcStart();
      if (online.isHost && online.matchStarted && wasWaiting && online.autoPaused &&
          !online.finished && !window.MSGame.isOver()) {
        online.autoPaused = false;
        window.MSGame.setPaused(false);
        window.MSGame.setStatus('Lawan kembali terhubung. Pertandingan dilanjutkan.');
      }
      if (!online.isHost && online.matchStarted) {
        send('request_state', { from: online.userId });
      }
    } else {
      online.peerPresent = false;
      rtcClose();
      if (online.matchStarted && online.peerEverSeen && !online.finished &&
          !window.MSGame.isOver() && !online.disconnectDeadline) {
        online.disconnectDeadline = Date.now() + CFG.reconnectMs;
        if (online.isHost) {
          online.autoPaused = !paused; // hanya lanjutkan otomatis jika jeda ini bukan dari pemain
          window.MSGame.setPaused(true);
        }
        window.MSGame.setStatus('Lawan terputus. Menunggu reconnect selama 30 detik...');
      }
    }
    renderLobby();
  }

  // =========================================================
  // PESAN MASUK (broadcast & DataChannel)
  // =========================================================
  const H = {
    input(payload) {
      if (!online.isHost || payload?.from !== online.guestId) return;
      if (payload.q <= online.inQ) return; // paket lama/terbalik urutan
      online.inQ = payload.q;
      const v = payload.input || {};
      let x = Number(v.x) || 0;
      let y = Number(v.y) || 0;
      const length = Math.hypot(x, y);
      if (length > 1) { x /= length; y /= length; }
      online.remoteInput = { x, y };
      online.lastInputRecv = Date.now();
      // Posisi pemain tamu (sudah diproyeksikan ke waktu tiba): host mengikuti agar tidak ada selisih/tembus.
      if (payload.px !== undefined) window.MSGame.nudgeRemote(Number(payload.px), Number(payload.py));
    },
    skill(payload) {
      if (!online.isHost || payload?.from !== online.guestId || !online.matchStarted ||
          window.MSGame.isOver()) return;
      window.MSGame.remoteSkill(payload);
    },
    ping(payload) {
      if (online.isHost && payload?.from === online.guestId) send('pong', { t: payload.t, to: payload.from });
    },
    pong(payload) {
      if (online.isHost || payload?.to !== online.userId) return;
      const rtt = performance.now() - Number(payload.t);
      if (!(rtt > 0 && rtt < 5000)) return;
      online.rtt = online.rtt ? online.rtt * 0.7 + rtt * 0.3 : rtt;
      window.MSGame.setRtt(online.rtt);
    },
    state(payload) {
      if (online.isHost || !payload?.n || online.finished) return;
      if (payload.q <= online.recvQ) return; // buang paket lama/terbalik urutan
      online.recvQ = payload.q;
      if (!online.launched) launchGame();
      online.lastHostState = Date.now();
      online.disconnectDeadline = 0;
      window.MSGame.applyNetState(payload.n, payload.q);
    },
    start() {
      if (!online.isHost) launchGame();
    },
    request_state(payload) {
      if (online.isHost && payload?.from === online.guestId && online.matchStarted) publishState();
    },
    pause_request(payload) {
      if (!online.isHost || payload?.from !== online.guestId ||
          !online.peerPresent || window.MSGame.isOver()) return;
      window.MSGame.togglePause();
    },
    finish_request(payload) {
      if (online.isHost && payload?.from === online.guestId) settleDisconnect();
    },
    finish(payload) {
      if (online.isHost || !payload?.state || online.finished) return;
      online.finished = true;
      if (!online.launched) launchGame();
      window.MSGame.finishOnline(payload.state);
      claimReward();
    },
    async cancelled() {
      if (online.isHost) return;
      await cleanupChannel();
      clearSavedRoom();
      resetRoomState();
      $('onlineScreen').hidden = true;
      $('onlineActions').hidden = false;
      $('onlineLobby').hidden = true;
      window.MSGame.backToMenu();
      alert('Host telah membatalkan room.');
    },
    restart_request(payload) {
      if (!online.isHost || payload?.from !== online.guestId) return;
      requestRestart();
    },
    restart() {
      if (!online.isHost) window.MSGame.restart();
    },
    rtc(payload) {
      rtc.q = rtc.q.then(() => rtcSignal(payload)); // berurutan: kandidat ICE menunggu SDP
    }
  };
  const dispatch = (event, payload) => H[event]?.(payload);

  function connectRoom() {
    if (!sb) throw new Error('Supabase belum dikonfigurasi.');
    const channel = sb.channel(`minisoccer-${online.code}`, {
      config: {
        private: false,
        presence: { key: online.userId },
        // ack dimatikan: tidak menunggu konfirmasi server per pesan
        broadcast: { self: false, ack: false }
      }
    });
    online.channel = channel;

    // Semua handler dalam satu peta: dipakai oleh broadcast Supabase maupun DataChannel.
    Object.keys(H).forEach((event) => channel.on('broadcast', { event }, ({ payload }) => H[event](payload)));

    channel.on('presence', { event: 'sync' }, handlePresence);

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        online.channelReady = true;
        await channel.track({
          playerId: online.userId,
          playerName: getName(),
          role: online.isHost ? 'host' : 'guest'
        });
        handlePresence();
        if (online.matchStarted) {
          if (online.isHost) publishState();
          else send('request_state', { from: online.userId });
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        online.channelReady = false;
        setError('Realtime bermasalah. Periksa koneksi internet.');
      } else if (status === 'CLOSED') {
        online.channelReady = false;
      }
    });
  }

  // =========================================================
  // ROOM LIFECYCLE
  // =========================================================
  async function enterRoom(room, isHost) {
    online.userId = await ensureUser();
    resetRoomState();
    online.room = room;
    online.code = room.code;
    online.isHost = isHost;
    online.hostId = room.host_id;
    online.guestId = room.guest_id || null;
    online.hostName = cleanName(room.host_name);
    online.guestName = cleanName(room.guest_name || 'Player');
    online.peerEverSeen = !!room.guest_id;
    online.matchStarted = room.status === 'playing';

    saveSession();
    showLobby();
    setError('');
    renderLobby();
    connectRoom();

    if (room.status === 'playing') {
      if (isHost) launchGame(readSnapshot(room.code));
      else {
        launchGame();
        window.MSGame.setStatus('Menunggu host mengirim kondisi pertandingan...');
      }
    }
  }

  async function createRoom() {
    setError('');
    const button = $('makeRoomBtn');
    button.disabled = true;
    try {
      await ensureUser();
      const room = await rpc('ms_create_room', { p_player_name: getName() });
      await enterRoom(room, true);
    } catch (error) {
      setError(error.message || 'Gagal membuat room.');
    } finally {
      button.disabled = false;
    }
  }

  async function joinRoom() {
    setError('');
    const button = $('joinRoomBtn');
    button.disabled = true;
    try {
      const code = $('joinCodeInput').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      if (code.length !== 8) throw new Error('Kode room harus 8 karakter.');
      await ensureUser();
      const room = await rpc('ms_join_room', {
        p_code: code,
        p_player_name: getName()
      });
      await enterRoom(room, false);
    } catch (error) {
      setError(error.message || 'Gagal bergabung ke room.');
    } finally {
      button.disabled = false;
    }
  }

  async function startRoom() {
    if (!online.isHost || !online.peerPresent || online.matchStarted) return;
    const button = $('onlineStartBtn');
    button.disabled = true;
    setError('');
    try {
      online.room = await rpc('ms_start_room', { p_code: online.code });
      online.matchStarted = true;
      launchGame();
      await send('start', { hostName: online.hostName, guestName: online.guestName });
      publishState();
    } catch (error) {
      setError(error.message || 'Tidak bisa memulai pertandingan.');
    } finally {
      button.disabled = false;
      renderLobby();
    }
  }

  // =========================================================
  // NETWORK TICK: dipanggil dari game.js tiap frame
  // =========================================================
  // Input dibulatkan ke kelipatan 1/8 agar perubahan kecil joystick tidak memicu pesan.
  const quant = (v) => Math.round((Number(v) || 0) * 8) / 8;

  function tick(now) {
    guestClock(now);
    netInfo(now);
    if (!online.channel || !online.channelReady || !online.matchStarted || online.finished) return;
    const wallNow = Date.now();

    if (wallNow - online.lastHeartbeat >= CFG.heartbeatMs) {
      online.lastHeartbeat = wallNow;
      rpc('ms_room_heartbeat', { p_code: online.code })
        .catch((error) => console.warn('[MiniSoccer] Heartbeat:', error));
    }

    if (online.isHost) {
      // Kirim state hanya jika lawan ada: dasar 3x/detik (1x saat diam),
      // plus kiriman cepat saat tendangan/pantulan/mulai-berhenti bergerak.
      if (online.peerPresent) {
        const gap = now - online.lastState;
        const f = fast();
        const base = online.stateBusy ? (f ? CFG.fastStateMs : CFG.stateActiveMs) : CFG.stateIdleMs;
        const ev = f ? CFG.fastEventMs : CFG.stateEventMs;
        if (gap >= base - CFG.frameTol || (gap >= ev - 3 && (velChanged() || skillChanged()))) {
          online.lastState = now;
          publishState();
        }
      }
      // Input guest basi (misalnya koneksi putus-sambung): hentikan pemain merah agar tidak jalan sendiri.
      if ((online.remoteInput.x || online.remoteInput.y) &&
          wallNow - online.lastInputRecv > CFG.inputStaleMs) {
        online.remoteInput = { x: 0, y: 0 };
      }
      if (!window.MSGame.isOver() && now - online.lastSnapshot >= CFG.snapshotMs) {
        online.lastSnapshot = now;
        saveSnapshot();
      }
    } else {
      if (!window.MSGame.isOver() && online.lastHostState &&
          wallNow - online.lastHostState > CFG.hostSilenceMs &&
          !online.disconnectDeadline) {
        online.disconnectDeadline = wallNow + CFG.reconnectMs;
        window.MSGame.setStatus('Host tidak merespons. Menunggu koneksi kembali...');
      }
      if (!window.MSGame.isOver()) {
        // Kirim input hanya jika berubah, plus posisi saat bergerak sebagai koreksi di host.
        const pk = window.MSGame.getInputPacket();
        const v = { x: quant(pk.v.x), y: quant(pk.v.y) };
        const last = online.lastInputSent;
        const changed = v.x !== last.x || v.y !== last.y;
        const since = now - online.lastInput;
        const moving = v.x !== 0 || v.y !== 0;
        const f = fast();
        const minGap = f ? CFG.fastInputMs : CFG.inputMs;
        const keep = moving ? (f ? CFG.fastMoveKeepMs : CFG.inputMoveKeepMs) : (f ? CFG.fastIdleKeepMs : CFG.inputKeepMs);
        if ((changed && since >= minGap - 4) || since >= keep - CFG.frameTol) {
          online.lastInput = now;
          online.lastInputSent = v;
          send('input', { from: online.userId, input: v, px: pk.x, py: pk.y, q: Date.now() });
        }
        if (now - online.lastPing >= CFG.pingMs - CFG.frameTol) {
          online.lastPing = now;
          send('ping', { from: online.userId, t: performance.now() });
        }
      }
    }

    if (online.disconnectDeadline && wallNow >= online.disconnectDeadline) {
      online.disconnectDeadline = 0;
      settleDisconnect();
    }
  }

  // =========================================================
  // RESULT & REWARD
  // =========================================================
  async function claimReward() {
    if (!online.room || online.rewardClaiming) return;
    online.rewardClaiming = true;
    try {
      const result = await rpc('ms_claim_room_reward', { p_code: online.code });
      const points = Math.max(0, Math.floor(Number(result?.points) || 0));
      if (points > 0) window.MSGame.addPoints(points);
    } catch (error) {
      console.error('[MiniSoccer] Klaim hadiah gagal:', error);
      setError('Hadiah belum bisa diklaim. Coba lagi nanti.');
    } finally {
      online.rewardClaiming = false;
    }
  }

  async function saveFinalResult(state) {
    if (!online.isHost || !online.room || online.finalizing || online.finished) return;
    online.finalizing = true;
    try {
      const room = await rpc('ms_finish_room', {
        p_code: online.code,
        p_score_blue: Number(state.score[0]) || 0,
        p_score_red: Number(state.score[1]) || 0
      });
      online.finished = true;
      await send('finish', { state, reason: room?.finish_reason || 'normal' });
      await claimReward();
    } catch (error) {
      online.finalizing = false;
      console.error('[MiniSoccer] Finish error:', error);
      setError('Hasil pertandingan gagal tersimpan. Periksa koneksi.');
    }
  }

  // Ulang pertandingan: host mengatur ulang lalu memberi tahu guest; guest meminta host.
  function requestRestart() {
    if (!online.matchStarted || online.finished || window.MSGame.isOver()) return;
    if (!online.isHost) {
      send('restart_request', { from: online.userId });
      return;
    }
    if (!online.peerPresent) return;
    window.MSGame.restart();
    send('restart', {});
    publishState();
  }

  function requestPause() {
    if (!online.isHost) send('pause_request', { from: online.userId });
  }

  // =========================================================
  // LEAVE ROOM
  // =========================================================
  async function leaveToMenu() {
    if (online.leaving) return;
    online.leaving = true;
    const wasHost = online.isHost;
    const wasPlaying = online.matchStarted;

    try {
      if (online.room) {
        const result = await rpc('ms_leave_room', { p_code: online.code });
        if (result?.status === 'finished' && result?.finish_reason === 'leave' &&
            wasHost && wasPlaying && window.MSGame) {
          const state = makeFinalState(result);
          await send('finish', { state, reason: 'leave' });
        } else if (result?.status === 'cancelled') {
          await send('cancelled', {});
        } else if (!wasHost && wasPlaying) {
          await send('finish_request', { from: online.userId });
        }
      }
    } catch (error) {
      console.warn('[MiniSoccer] Leave room:', error);
      setError('Koneksi terputus. Room mungkin tetap aktif sampai kedaluwarsa.');
    }

    await cleanupChannel();
    clearSavedRoom();
    resetRoomState();
    resetView();
    $('onlineScreen').hidden = true;
    $('onlineActions').hidden = false;
    $('onlineLobby').hidden = true;
    window.MSGame.backToMenu();
  }

  // =========================================================
  // COPY CODE & RESUME
  // =========================================================
  async function copyRoomCode() {
    if (!online.code) return;
    try {
      await navigator.clipboard.writeText(online.code);
      $('copyRoomCodeBtn').textContent = 'COPIED!';
      setTimeout(() => {
        if ($('copyRoomCodeBtn')) $('copyRoomCodeBtn').textContent = 'COPY';
      }, 1500);
    } catch (_) {
      setError('Clipboard tidak tersedia. Salin kode room secara manual.');
    }
  }

  async function resumeSavedRoom() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (_) {
      clearSavedRoom();
      return;
    }
    if (!saved?.code) return;

    try {
      const userId = await ensureUser();
      const room = await rpc('ms_rejoin_room', { p_code: saved.code });
      if (!room || room.status === 'cancelled') {
        clearSavedRoom();
        return;
      }
      if (room.status === 'finished') {
        online.userId = userId;
        online.room = room;
        online.code = room.code;
        await claimReward();
        clearSavedRoom();
        return;
      }
      await enterRoom(room, room.host_id === userId);
    } catch (error) {
      console.warn('[MiniSoccer] Rejoin gagal:', error);
      setError('Gagal melanjutkan room sebelumnya: ' + error.message);
    }
  }

  // =========================================================
  // PROFILE
  // =========================================================
  function setupProfile() {
    const button = $('profileNameBtn');
    const input = $('profileNameInput');
    if (!button || !input) return;

    let playerName = getName();
    button.textContent = playerName;
    input.value = playerName;

    function saveProfile() {
      playerName = cleanName(input.value);
      localStorage.setItem(NAME_KEY, playerName);
      button.textContent = playerName;
      input.hidden = true;
      button.hidden = false;
    }

    button.addEventListener('click', () => {
      button.hidden = true;
      input.hidden = false;
      input.value = playerName;
      input.focus();
      input.select();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') saveProfile();
      if (event.key === 'Escape') {
        input.value = playerName;
        saveProfile();
      }
    });
    input.addEventListener('blur', saveProfile);
  }

  // =========================================================
  // UI EVENTS & GLOBAL API
  // =========================================================
  function openOnlineScreen() {
    $('startScreen').hidden = true;
    $('onlineScreen').hidden = false;
    $('onlineActions').hidden = false;
    $('onlineLobby').hidden = true;
    setError('');
  }

  $('onlineModeBtn').addEventListener('click', openOnlineScreen);
  $('makeRoomBtn').addEventListener('click', createRoom);
  $('joinRoomBtn').addEventListener('click', joinRoom);
  $('joinCodeInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') joinRoom();
  });
  $('onlineStartBtn').addEventListener('click', startRoom);
  $('onlineBackBtn').addEventListener('click', leaveToMenu);
  $('copyRoomCodeBtn').addEventListener('click', copyRoomCode);

  window.MSOnline = {
    get isHost() { return online.isHost; },
    get remoteInput() { return online.remoteInput; },
    tick,
    requestPause,
    requestRestart,
    sendSkill(payload) {
      if (!online.isHost) send('skill', Object.assign({ from: online.userId }, payload));
    },
    claimReward,
    saveFinalResult,
    publishState,
    leaveToMenu
  };

  setupProfile();
  if (sb) setTimeout(resumeSavedRoom, 300);
  else console.warn('[MiniSoccer] Isi SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY di online.js.');
})();