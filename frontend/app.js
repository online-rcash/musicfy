/* =========================================================
   Musicfy Frontend
   - Auth (Google OAuth + Email OTP)
   - Playback, Queue, Shuffle, Repeat
   - Liked songs (sync ke server jika login, localStorage jika tidak)
   - History stack untuk Back/Forward buttons
   ========================================================= */

// ⚙️ KONFIGURASI — TUKAR INI
const API_URL = 'https://api.musicfy.rcash.my';
// Untuk local dev: 'http://localhost:8787'

// ==================== STATE ====================
const state = {
  queue: [],
  index: -1,
  playing: false,
  shuffle: false,
  repeat: 'off', // 'off' | 'all' | 'one'
  volume: 0.7,
  liked: {}, // { key: track }
  user: null,
  page: 'home',
  pageParams: null,
};

const DEFAULT_ART = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23282828" width="100" height="100"/><path fill="%23555" d="M44 62V28l26-5v30a8 8 0 1 0 6 8V22L38 28v34a8 8 0 1 0 6 0z"/></svg>';

// Cache tracks ikut trackId
const trackCache = new Map();
function cacheTrack(t) { if (t) trackCache.set(trackKey(t), t); return t; }
function trackKey(t) { return String(t.trackId || t.previewUrl); }

// History stack untuk Back/Forward
const history = {
  stack: [],
  index: -1,
  push(entry) {
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(entry);
    this.index++;
    updateNavButtons();
  },
  back() {
    if (this.index > 0) { this.index--; updateNavButtons(); return this.stack[this.index]; }
    return null;
  },
  forward() {
    if (this.index < this.stack.length - 1) { this.index++; updateNavButtons(); return this.stack[this.index]; }
    return null;
  },
};

// ==================== AUDIO ====================
const audio = new Audio();
audio.volume = state.volume;

// ==================== DOM ====================
const $ = (s) => document.querySelector(s);
const content = $('#content');
const npArt = $('#np-art');
const npTitle = $('#np-title');
const npArtist = $('#np-artist');
const playBtn = $('#play-btn');
const progress = $('#progress');
const currentTimeEl = $('#current-time');
const durationEl = $('#duration');
const volumeSlider = $('#volume');
const likeBtn = $('#like-btn');
const shuffleBtn = $('#shuffle-btn');
const repeatBtn = $('#repeat-btn');
const backBtn = $('#back-btn');
const forwardBtn = $('#forward-btn');
const userBadge = $('#user-badge');

npArt.src = DEFAULT_ART;

// ==================== AUTH MODULE ====================
const auth = {
  token: localStorage.getItem('musicfy_token') || null,

  setToken(t) {
    this.token = t;
    if (t) localStorage.setItem('musicfy_token', t);
    else localStorage.removeItem('musicfy_token');
  },

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  },

  async api(path, opts = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...opts,
      headers: { ...this.headers(), ...(opts.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  async loadMe() {
    if (!this.token) return null;
    try {
      const { user } = await this.api('/auth/me');
      return user;
    } catch {
      this.setToken(null);
      return null;
    }
  },

  async logout() {
    try { await this.api('/auth/logout', { method: 'POST' }); } catch {}
    this.setToken(null);
  },
};

// ==================== ITUNES API ====================
function itunesSearch(term, limit = 20) {
  return new Promise((resolve, reject) => {
    const cb = 'itunes_cb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    window[cb] = (data) => {
      delete window[cb];
      script.remove();
      const tracks = (data.results || []).filter((r) => r.previewUrl && r.trackName && r.artistName);
      tracks.forEach(cacheTrack);
      resolve(tracks);
    };
    script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=${limit}&callback=${cb}`;
    script.onerror = () => {
      delete window[cb]; script.remove();
      reject(new Error('Ralat rangkaian'));
    };
    document.body.appendChild(script);
  });
}

// ==================== UTILS ====================
function formatTime(s) {
  if (!isFinite(s)) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}
function escapeHTML(s) {
  const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML;
}
function isLiked(t) { return !!state.liked[trackKey(t)]; }

// ==================== LIKED ====================
function loadLikedLocal() {
  return JSON.parse(localStorage.getItem('musicfy_liked') || '{}');
}
function saveLikedLocal(liked) {
  localStorage.setItem('musicfy_liked', JSON.stringify(liked));
}

async function toggleLike(track) {
  if (state.user) {
    try {
      const { liked, active } = await auth.api('/api/liked', {
        method: 'POST',
        body: JSON.stringify({ track }),
      });
      state.liked = liked;
      updateLikeUI(track, active);
    } catch (e) {
      alert('Gagal like: ' + e.message);
    }
  } else {
    // Local mode
    const key = trackKey(track);
    if (state.liked[key]) delete state.liked[key];
    else state.liked[key] = track;
    saveLikedLocal(state.liked);
    updateLikeUI(track, !!state.liked[key]);
  }
}

function updateLikeUI(track, liked) {
  const key = trackKey(track);
  document.querySelectorAll(`[data-like-id="${key}"]`).forEach((btn) => {
    btn.classList.toggle('liked', liked);
    btn.textContent = liked ? '♥' : '♡';
  });
  const cur = state.index >= 0 ? state.queue[state.index] : null;
  if (cur && trackKey(cur) === key) {
    likeBtn.classList.toggle('liked', liked);
    likeBtn.textContent = liked ? '♥' : '♡';
  }
  if (state.page === 'library') renderLibrary();
}

async function loadLikedFromServer() {
  try {
    const { liked } = await auth.api('/api/liked');
    state.liked = liked;
  } catch {}
}

async function syncLocalLikedToServer() {
  const local = loadLikedLocal();
  const entries = Object.values(local);
  if (!entries.length) return;
  for (const tr of entries) {
    try {
      await auth.api('/api/liked', { method: 'POST', body: JSON.stringify({ track: tr }) });
    } catch {}
  }
  localStorage.removeItem('musicfy_liked');
  await loadLikedFromServer();
}

// ==================== RENDER: CARD ====================
function renderCardSection(title, tracks) {
  if (!tracks.length) return '';
  const cards = tracks.slice(0, 12).map((t) => {
    const playing = state.index >= 0 && state.queue[state.index] && trackKey(state.queue[state.index]) === trackKey(t);
    const art = t.artworkUrl100 ? t.artworkUrl100.replace('100x100', '300x300') : DEFAULT_ART;
    return `
      <div class="card ${playing ? 'playing' : ''}" data-track-id="${trackKey(t)}">
        <div class="card-img-wrap">
          <img class="card-img" src="${art}" alt="${escapeHTML(t.trackName)}" loading="lazy" />
          <button class="card-play" data-track-id="${trackKey(t)}">
            ${playing && state.playing ? '⏸' : '▶'}
          </button>
        </div>
        <div class="card-title">${escapeHTML(t.trackName)}</div>
        <div class="card-artist">${escapeHTML(t.artistName)}</div>
      </div>`;
  }).join('');
  return `<h2 class="section-title">${escapeHTML(title)}</h2><div class="card-grid" data-tracks='${JSON.stringify(tracks.map(trackKey)).replace(/'/g, '&#39;')}'>${cards}</div>`;
}

function renderTrackList(tracks) {
  if (!tracks.length) return '<div class="empty">Tiada lagu 🎵</div>';
  return `<div class="track-list">${tracks.map((t, i) => {
    const playing = state.index >= 0 && state.queue[state.index] && trackKey(state.queue[state.index]) === trackKey(t);
    const liked = isLiked(t);
    const art = t.artworkUrl100 || DEFAULT_ART;
    return `
      <div class="track-row ${playing ? 'playing' : ''}" data-track-id="${trackKey(t)}">
        <div class="track-index">${playing ? (state.playing ? '▶' : '⏸') : i + 1}</div>
        <div class="track-main">
          <img class="track-art" src="${art}" alt="" loading="lazy" />
          <div class="track-info">
            <div class="track-name">${escapeHTML(t.trackName)}</div>
            <div class="track-artist-name">${escapeHTML(t.artistName)}</div>
          </div>
        </div>
        <div class="track-album">${escapeHTML(t.collectionName || '')}</div>
        <div class="track-duration">${formatTime((t.trackTimeMillis || 0) / 1000)}</div>
        <button class="track-like ${liked ? 'liked' : ''}" data-like-id="${trackKey(t)}">${liked ? '♥' : '♡'}</button>
      </div>`;
  }).join('')}</div>`;
}

function attachCardHandlers() {
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = card.dataset.trackId;
      const grid = card.closest('.card-grid');
      const allKeys = JSON.parse((grid.dataset.tracks || '[]').replace(/&#39;/g, "'"));
      const queue = allKeys.map((k) => trackCache.get(k)).filter(Boolean);
      const track = trackCache.get(key);
      if (track) playTrack(track, queue.length ? queue : null);
    });
  });
}

function attachTrackHandlers(tracks) {
  document.querySelectorAll('.track-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.track-like')) return;
      const key = row.dataset.trackId;
      const track = trackCache.get(key) || tracks.find((t) => trackKey(t) === key);
      if (track) playTrack(track, tracks);
    });
  });
  document.querySelectorAll('.track-like').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const track = trackCache.get(btn.dataset.likeId);
      if (track) toggleLike(track);
    });
  });
}

// ==================== PAGES ====================
async function renderHome() {
  state.page = 'home';
  content.innerHTML = `<h1 class="section-title" style="font-size:32px;margin-top:16px;">Good evening 🎧</h1><div id="home-sections"><div class="loading"><div class="spinner"></div><br/>Memuatkan...</div></div>`;
  const container = $('#home-sections');
  container.innerHTML = '';
  const cats = [
    { title: 'Made For You', term: 'top hits 2024' },
    { title: 'Pop Hits', term: 'pop hits' },
    { title: 'Malaysia Top', term: 'malaysia music' },
    { title: 'Hip Hop & R&B', term: 'hip hop' },
    { title: 'Chill Vibes', term: 'chill acoustic' },
    { title: 'Rock Classics', term: 'rock classics' },
  ];
  for (const c of cats) {
    try {
      const tracks = await itunesSearch(c.term, 12);
      if (tracks.length) container.innerHTML += renderCardSection(c.title, tracks);
    } catch (e) { console.warn(e); }
  }
  if (!container.innerHTML) container.innerHTML = '<div class="empty">Gagal muat. Refresh.</div>';
  attachCardHandlers();
}

function renderSearch(query = '') {
  state.page = 'search';
  content.innerHTML = `
    <div class="search-hero">
      <h1>Search</h1>
      <input type="text" class="search-input" id="search-input" placeholder="Cari lagu, artis, album..." autocomplete="off" value="${escapeHTML(query)}" />
    </div>
    <div id="search-results"></div>`;
  const input = $('#search-input');
  const results = $('#search-results');
  let t;
  input.focus();
  const doSearch = async (q) => {
    if (!q) { results.innerHTML = ''; return; }
    results.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const tracks = await itunesSearch(q, 25);
      results.innerHTML = `<h2 class="section-title">Hasil: "${escapeHTML(q)}"</h2>${renderTrackList(tracks)}`;
      attachTrackHandlers(tracks);
    } catch {
      results.innerHTML = '<div class="empty">Ralat. Cuba lagi.</div>';
    }
  };
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => doSearch(input.value.trim()), 500);
  });
  if (query) doSearch(query);
}

function renderLibrary() {
  state.page = 'library';
  const tracks = Object.values(state.liked);
  content.innerHTML = `
    <h1 class="section-title" style="font-size:32px;margin-top:16px;">💚 Liked Songs</h1>
    ${!state.user ? '<div class="empty" style="padding:16px;">🔒 <a href="#" id="login-link" style="color:#1db954">Log masuk</a> untuk sync merentas peranti.</div>' : ''}
    ${tracks.length ? renderTrackList(tracks) : '<div class="empty">Belum ada lagu di-like.</div>'}`;
  if (tracks.length) attachTrackHandlers(tracks);
  const ll = $('#login-link');
  if (ll) ll.addEventListener('click', (e) => { e.preventDefault(); openLoginModal(); });
}

// ==================== PLAYBACK ====================
function playTrack(track, queue = null) {
  cacheTrack(track);
  if (queue) {
    state.queue = queue.map(cacheTrack);
    state.index = state.queue.findIndex((t) => trackKey(t) === trackKey(track));
  } else {
    if (!state.queue.some((t) => trackKey(t) === trackKey(track))) {
      state.queue.push(track);
      state.index = state.queue.length - 1;
    } else {
      state.index = state.queue.findIndex((t) => trackKey(t) === trackKey(track));
    }
  }
  audio.src = track.previewUrl;
  audio.play()
    .then(() => { state.playing = true; updatePlayerUI(); refreshActiveStates(); })
    .catch((err) => console.warn('Play fail:', err));
}

function togglePlay() {
  if (!state.queue.length) {
    const liked = Object.values(state.liked);
    if (liked.length) return playTrack(liked[0], liked);
    return;
  }
  if (audio.paused) {
    audio.play().then(() => { state.playing = true; updatePlayerUI(); }).catch(() => {});
  } else {
    audio.pause();
    state.playing = false;
    updatePlayerUI();
  }
}

function playNext(auto = false) {
  if (!state.queue.length) return;
  if (auto && state.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
  if (state.shuffle) {
    let next;
    do { next = Math.floor(Math.random() * state.queue.length); }
    while (state.queue.length > 1 && next === state.index);
    state.index = next;
  } else {
    state.index++;
    if (state.index >= state.queue.length) {
      if (state.repeat === 'all' || !auto) state.index = 0;
      else { state.index = state.queue.length - 1; state.playing = false; updatePlayerUI(); return; }
    }
  }
  playTrack(state.queue[state.index]);
}

function playPrev() {
  if (!state.queue.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  state.index = (state.index - 1 + state.queue.length) % state.queue.length;
  playTrack(state.queue[state.index]);
}

// ==================== PLAYER UI ====================
function updatePlayerUI() {
  const track = state.index >= 0 ? state.queue[state.index] : null;
  if (track) {
    npArt.src = track.artworkUrl100 ? track.artworkUrl100.replace('100x100', '200x200') : DEFAULT_ART;
    npTitle.textContent = track.trackName;
    npArtist.textContent = track.artistName;
    const liked = isLiked(track);
    likeBtn.classList.toggle('liked', liked);
    likeBtn.textContent = liked ? '♥' : '♡';
  } else {
    npArt.src = DEFAULT_ART;
    npTitle.textContent = 'Not playing';
    npArtist.textContent = 'Select a track';
    likeBtn.classList.remove('liked');
    likeBtn.textContent = '♡';
  }
  playBtn.textContent = state.playing ? '⏸' : '▶';
}

function refreshActiveStates() {
  const curKey = state.index >= 0 && state.queue[state.index] ? trackKey(state.queue[state.index]) : null;
  document.querySelectorAll('.card, .track-row').forEach((el) => {
    const key = el.dataset.trackId;
    if (!key) return;
    const active = key === curKey;
    el.classList.toggle('playing', active);
    const btn = el.querySelector('.card-play');
    if (btn) btn.textContent = active && state.playing ? '⏸' : '▶';
    const idx = el.querySelector('.track-index');
    if (idx && active) idx.textContent = state.playing ? '▶' : '⏸';
  });
}

function updateNavButtons() {
  backBtn.disabled = history.index <= 0;
  forwardBtn.disabled = history.index >= history.stack.length - 1;
}

// ==================== AUTH UI ====================
async function refreshAuthUI() {
  if (state.user) {
    const pic = state.user.picture;
    userBadge.innerHTML = pic ? `<img src="${pic}" alt="" />` : '👤';
    userBadge.title = state.user.name || state.user.email;
  } else {
    userBadge.innerHTML = '👤';
    userBadge.title = 'Log Masuk';
  }
}

function openLoginModal() {
  $('#login-modal').hidden = false;
  showOtpStep(1);
  clearModalMessages();
}
function closeLoginModal() { $('#login-modal').hidden = true; }
function showOtpStep(n) {
  $('#otp-step-1').hidden = n !== 1;
  $('#otp-step-2').hidden = n !== 2;
}
function clearModalMessages() {
  const err = $('#modal-error'), info = $('#modal-info');
  err.classList.remove('show'); err.textContent = '';
  info.classList.remove('show'); info.textContent = '';
}
function showError(msg) {
  const el = $('#modal-error');
  el.textContent = msg; el.classList.add('show');
  $('#modal-info').classList.remove('show');
}
function showInfo(msg) {
  const el = $('#modal-info');
  el.textContent = msg; el.classList.add('show');
  $('#modal-error').classList.remove('show');
}

async function handleGoogleLogin() {
  $('#btn-google').disabled = true;
  try {
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `${API_URL}/auth/google?redirect_uri=${redirectUri}`;
  } catch (e) {
    showError('Gagal mulakan Google login');
    $('#btn-google').disabled = false;
  }
}

async function handleSendOTP() {
  const email = $('#email-input').value.trim();
  if (!email) return showError('Sila masukkan emel');
  clearModalMessages();
  const btn = $('#btn-send-otp');
  btn.disabled = true; btn.textContent = 'Menghantar...';
  try {
    await auth.api('/auth/email/send-otp', { method: 'POST', body: JSON.stringify({ email }) });
    $('#otp-email-display').textContent = email;
    showOtpStep(2);
    $('#otp-input').value = '';
    $('#otp-input').focus();
    showInfo('Kod OTP dihantar ke emel anda.');
  } catch (e) {
    showError(e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Hantar Kod OTP';
  }
}

async function handleVerifyOTP() {
  const email = $('#email-input').value.trim();
  const code = $('#otp-input').value.trim();
  if (!code || code.length !== 6) return showError('Masukkan 6-digit kod');
  clearModalMessages();
  const btn = $('#btn-verify-otp');
  btn.disabled = true; btn.textContent = 'Mengesahkan...';
  try {
    const { token, user } = await auth.api('/auth/email/verify-otp', {
      method: 'POST', body: JSON.stringify({ email, code }),
    });
    auth.setToken(token);
    await onLoginSuccess(user);
  } catch (e) {
    showError(e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Sahkan';
  }
}

async function onLoginSuccess(user) {
  state.user = user;
  closeLoginModal();
  await refreshAuthUI();
  await syncLocalLikedToServer();
  await loadLikedFromServer();
  // Refresh semula UI
  if (state.page === 'library') renderLibrary();
  else refreshActiveStates();
  updatePlayerUI();
}

async function handleLogout() {
  await auth.logout();
  state.user = null;
  state.liked = loadLikedLocal(); // fallback local
  $('#user-menu').hidden = true;
  await refreshAuthUI();
  if (state.page === 'library') renderLibrary();
  updatePlayerUI();
}

// ==================== EVENTS ====================
// Player
playBtn.addEventListener('click', togglePlay);
$('#next-btn').addEventListener('click', () => playNext(false));
$('#prev-btn').addEventListener('click', playPrev);
shuffleBtn.addEventListener('click', () => {
  state.shuffle = !state.shuffle;
  shuffleBtn.classList.toggle('active', state.shuffle);
});
repeatBtn.addEventListener('click', () => {
  const modes = ['off', 'all', 'one'];
  state.repeat = modes[(modes.indexOf(state.repeat) + 1) % 3];
  repeatBtn.classList.toggle('active', state.repeat !== 'off');
  repeatBtn.textContent = state.repeat === 'one' ? '🔂' : '🔁';
});
progress.addEventListener('input', (e) => {
  if (!audio.duration) return;
  audio.currentTime = (e.target.value / 1000) * audio.duration;
});
volumeSlider.addEventListener('input', (e) => {
  const v = e.target.value / 100;
  state.volume = v; audio.volume = v;
  $('#vol-btn').textContent = v === 0 ? '🔇' : v < 0.5 ? '🔉' : '🔊';
});
$('#vol-btn').addEventListener('click', () => {
  if (audio.volume > 0) { audio.volume = 0; volumeSlider.value = 0; $('#vol-btn').textContent = '🔇'; }
  else { audio.volume = state.volume || 0.7; volumeSlider.value = audio.volume * 100; $('#vol-btn').textContent = '🔊'; }
});
likeBtn.addEventListener('click', () => {
  const track = state.index >= 0 ? state.queue[state.index] : null;
  if (track) toggleLike(track);
});

// Audio events
audio.addEventListener('timeupdate', () => {
  currentTimeEl.textContent = formatTime(audio.currentTime);
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  progress.value = pct * 10;
  progress.style.background = `linear-gradient(to right, #1db954 ${pct}%, #4d4d4d ${pct}%)`;
});
audio.addEventListener('loadedmetadata', () => { durationEl.textContent = formatTime(audio.duration); });
audio.addEventListener('ended', () => playNext(true));
audio.addEventListener('play', () => { state.playing = true; playBtn.textContent = '⏸'; refreshActiveStates(); });
audio.addEventListener('pause', () => { state.playing = false; playBtn.textContent = '▶'; refreshActiveStates(); });
audio.addEventListener('error', () => { if (state.queue.length > 1) playNext(true); });

// Nav
document.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
    link.classList.add('active');
    history.push({ page });
    routeTo(page);
  });
});

document.querySelectorAll('.playlist-item').forEach((it) => {
  it.addEventListener('click', () => {
    if (it.dataset.playlist === 'liked') {
      document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
      document.querySelector('[data-page="library"]').classList.add('active');
      history.push({ page: 'library' });
      renderLibrary();
    }
  });
});

// Back / Forward
backBtn.addEventListener('click', () => {
  const entry = history.back();
  if (entry) routeTo(entry.page);
});
forwardBtn.addEventListener('click', () => {
  const entry = history.forward();
  if (entry) routeTo(entry.page);
});

// User badge
userBadge.addEventListener('click', (e) => {
  e.stopPropagation();
  if (state.user) {
    const menu = $('#user-menu');
    menu.hidden = !menu.hidden;
    if (!menu.hidden) {
      $('#menu-avatar').src = state.user.picture || DEFAULT_ART;
      $('#menu-name').textContent = state.user.name || 'User';
      $('#menu-email').textContent = state.user.email || '';
    }
  } else {
    openLoginModal();
  }
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#user-menu') && !e.target.closest('#user-badge')) {
    $('#user-menu').hidden = true;
  }
});
$('#menu-logout').addEventListener('click', handleLogout);

// Modal
$('#modal-close').addEventListener('click', closeLoginModal);
$('#login-modal').addEventListener('click', (e) => {
  if (e.target.id === 'login-modal') closeLoginModal();
});
$('#btn-google').addEventListener('click', handleGoogleLogin);
$('#btn-send-otp').addEventListener('click', handleSendOTP);
$('#btn-verify-otp').addEventListener('click', handleVerifyOTP);
$('#btn-resend-otp').addEventListener('click', handleSendOTP);
$('#btn-change-email').addEventListener('click', () => showOtpStep(1));
$('#otp-input').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
});
$('#email-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleSendOTP();
});
$('#otp-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleVerifyOTP();
});

// ==================== ROUTING ====================
function routeTo(page) {
  switch (page) {
    case 'home': renderHome(); break;
    case 'search': renderSearch(); break;
    case 'library': renderLibrary(); break;
  }
}

// ==================== INIT ====================
async function init() {
  // Handle OAuth callback token in URL
  const url = new URL(window.location.href);
  const tokenFromUrl = url.searchParams.get('token');
  if (tokenFromUrl) {
    auth.setToken(tokenFromUrl);
    url.searchParams.delete('token');
    url.searchParams.delete('auth');
    window.history.replaceState({}, '', url.toString());
  }

  // Load user
  state.user = await auth.loadMe();
  await refreshAuthUI();

  // Liked songs
  if (state.user) {
    await loadLikedFromServer();
    // Kalau ada local likes, merge
    if (Object.keys(loadLikedLocal()).length) await syncLocalLikedToServer();
  } else {
    state.liked = loadLikedLocal();
  }

  // Init history + render
  history.push({ page: 'home' });
  await renderHome();
  updatePlayerUI();
  updateNavButtons();
}

init();