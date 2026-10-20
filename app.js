/* =========================================================
   Musicfy v2 — Audius API (full songs) + SVG icons
   ========================================================= */

const API_URL = 'https://musicfy.rcash.my';
const AUDIUS = 'https://api.audius.co/v1';
const APP_NAME = 'Musicfy';

// ==================== ICONS ====================
const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
  heartOutline: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
  trending: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>',
  fire: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>',
};

// ==================== STATE ====================
const state = {
  queue: [], index: -1, playing: false, shuffle: false,
  repeat: 'off', volume: 0.7, liked: {}, user: null, page: 'home',
};
const trackCache = new Map();
const trackKey = (t) => String(t.trackId || t.id || t.previewUrl);
const cacheTrack = (t) => { if (t) trackCache.set(trackKey(t), t); return t; };

const DEFAULT_ART = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23181818" width="100" height="100"/><g fill="%23444444" transform="translate(35,35)"><circle cx="8" cy="24" r="6"/><circle cx="28" cy="20" r="6"/><rect x="10" y="4" width="3" height="22"/><rect x="30" y="0" width="3" height="22"/></g></svg>';

// History
const navHistory = {
  stack: [], index: -1,
  push(e) { this.stack = this.stack.slice(0, this.index + 1); this.stack.push(e); this.index++; updateNavButtons(); },
  back() { if (this.index > 0) { this.index--; updateNavButtons(); return this.stack[this.index]; } return null; },
  forward() { if (this.index < this.stack.length - 1) { this.index++; updateNavButtons(); return this.stack[this.index]; } return null; },
};

const audio = new Audio();
audio.volume = state.volume;

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

// ==================== AUDIUS API ====================
async function audiusFetch(path) {
  const url = `${AUDIUS}${path}${path.includes('?') ? '&' : '?'}app_name=${APP_NAME}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Audius ${res.status}`);
  return res.json();
}

function normalizeAudius(t) {
  const art = t.artwork?.['480x480'] || t.artwork?.['150x150'] || DEFAULT_ART;
  return {
    id: `audius:${t.id}`,
    trackId: t.id,
    source: 'audius',
    trackName: t.title,
    artistName: t.user?.name || 'Unknown Artist',
    collectionName: t.genre || t.mood || 'Audius',
    artworkUrl100: art,
    previewUrl: `${AUDIUS}/tracks/${t.id}/stream?app_name=${APP_NAME}`,
    trackTimeMillis: (t.duration || 0) * 1000,
  };
}

async function audiusTrending(genre = null, limit = 20) {
  let path = `/tracks/trending?limit=${limit}`;
  if (genre) path += `&genre=${encodeURIComponent(genre)}`;
  const data = await audiusFetch(path);
  return (data.data || []).map(normalizeAudius).forEach(cacheTrack) || [];
}

async function audiusSearch(query, limit = 25) {
  const data = await audiusFetch(`/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}`);
  return (data.data || []).map(normalizeAudius).forEach(cacheTrack) || [];
}

// Async versions that return arrays
async function aTrending(genre = null, limit = 20) {
  let path = `/tracks/trending?limit=${limit}`;
  if (genre) path += `&genre=${encodeURIComponent(genre)}`;
  const data = await audiusFetch(path);
  const tracks = (data.data || []).map(normalizeAudius);
  tracks.forEach(cacheTrack);
  return tracks;
}

async function aSearch(query, limit = 25) {
  const data = await audiusFetch(`/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}`);
  const tracks = (data.data || []).map(normalizeAudius);
  tracks.forEach(cacheTrack);
  return tracks;
}

// ==================== AUTH ====================
const auth = {
  token: localStorage.getItem('musicfy_token') || null,
  setToken(t) { this.token = t; t ? localStorage.setItem('musicfy_token', t) : localStorage.removeItem('musicfy_token'); },
  headers() { const h = { 'Content-Type': 'application/json' }; if (this.token) h.Authorization = `Bearer ${this.token}`; return h; },
  async api(path, opts = {}) {
    const res = await fetch(`${API_URL}${path}`, { ...opts, headers: { ...this.headers(), ...(opts.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
  async loadMe() { if (!this.token) return null; try { const { user } = await this.api('/auth/me'); return user; } catch { this.setToken(null); return null; } },
  async logout() { try { await this.api('/auth/logout', { method: 'POST' }); } catch {} this.setToken(null); },
};

// ==================== UTILS ====================
const formatTime = (s) => !isFinite(s) ? '0:00' : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
const escapeHTML = (s) => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
const isLiked = (t) => !!state.liked[trackKey(t)];

// ==================== LIKED ====================
const loadLikedLocal = () => JSON.parse(localStorage.getItem('musicfy_liked') || '{}');
const saveLikedLocal = (l) => localStorage.setItem('musicfy_liked', JSON.stringify(l));

async function toggleLike(track) {
  if (state.user) {
    try {
      const { liked, active } = await auth.api('/api/liked', { method: 'POST', body: JSON.stringify({ track }) });
      state.liked = liked;
      updateLikeUI(track, active);
    } catch (e) { alert('Gagal like: ' + e.message); }
  } else {
    const k = trackKey(track);
    if (state.liked[k]) delete state.liked[k]; else state.liked[k] = track;
    saveLikedLocal(state.liked);
    updateLikeUI(track, !!state.liked[k]);
  }
}

function updateLikeUI(track, liked) {
  const k = trackKey(track);
  document.querySelectorAll(`[data-like-id="${k}"]`).forEach((btn) => {
    btn.classList.toggle('liked', liked);
    btn.innerHTML = liked ? ICONS.heart : ICONS.heartOutline;
  });
  const cur = state.index >= 0 ? state.queue[state.index] : null;
  if (cur && trackKey(cur) === k) {
    likeBtn.classList.toggle('liked', liked);
    likeBtn.innerHTML = liked ? ICONS.heart : ICONS.heartOutline;
  }
  if (state.page === 'library') renderLibrary();
}

async function loadLikedFromServer() { try { const { liked } = await auth.api('/api/liked'); state.liked = liked; } catch {} }

async function syncLocalLikedToServer() {
  const local = loadLikedLocal();
  if (!Object.keys(local).length) return;
  for (const tr of Object.values(local)) { try { await auth.api('/api/liked', { method: 'POST', body: JSON.stringify({ track: tr }) }); } catch {} }
  localStorage.removeItem('musicfy_liked');
  await loadLikedFromServer();
}

// ==================== RENDER ====================
function renderCardSection(title, icon, tracks) {
  if (!tracks.length) return '';
  const cards = tracks.slice(0, 12).map((t) => {
    const playing = state.index >= 0 && state.queue[state.index] && trackKey(state.queue[state.index]) === trackKey(t);
    const art = t.artworkUrl100 || DEFAULT_ART;
    return `<div class="card ${playing ? 'playing' : ''}" data-track-id="${trackKey(t)}">
      <div class="card-img-wrap">
        <img class="card-img" src="${art}" alt="${escapeHTML(t.trackName)}" loading="lazy" />
        <button class="card-play" data-track-id="${trackKey(t)}" title="Play">${playing && state.playing ? ICONS.pause : ICONS.play}</button>
      </div>
      <div class="card-title">${escapeHTML(t.trackName)}</div>
      <div class="card-artist">${escapeHTML(t.artistName)}</div>
    </div>`;
  }).join('');
  return `<h2 class="section-title"><span style="color:var(--accent)">${icon || ''}</span>${escapeHTML(title)}</h2>
    <div class="card-grid" data-tracks='${JSON.stringify(tracks.map(trackKey)).replace(/'/g, '&#39;')}'>${cards}</div>`;
}

function renderTrackList(tracks) {
  if (!tracks.length) return `<div class="empty">${ICONS.music}<div>Tiada lagu dijumpai</div></div>`;
  return `<div class="track-list">${tracks.map((t, i) => {
    const playing = state.index >= 0 && state.queue[state.index] && trackKey(state.queue[state.index]) === trackKey(t);
    const liked = isLiked(t);
    const art = t.artworkUrl100 || DEFAULT_ART;
    const indexContent = playing
      ? `<div class="eq ${state.playing ? '' : 'paused'}"><span></span><span></span><span></span><span></span></div>`
      : (i + 1);
    return `<div class="track-row ${playing ? 'playing' : ''}" data-track-id="${trackKey(t)}">
      <div class="track-index">${indexContent}</div>
      <div class="track-main">
        <img class="track-art" src="${art}" alt="" loading="lazy" />
        <div class="track-info">
          <div class="track-name">${escapeHTML(t.trackName)}</div>
          <div class="track-artist-name">${escapeHTML(t.artistName)}</div>
        </div>
      </div>
      <div class="track-album">${escapeHTML(t.collectionName || '')}</div>
      <div class="track-duration">${formatTime((t.trackTimeMillis || 0) / 1000)}</div>
      <button class="track-like ${liked ? 'liked' : ''}" data-like-id="${trackKey(t)}" title="Like">${liked ? ICONS.heart : ICONS.heartOutline}</button>
    </div>`;
  }).join('')}</div>`;
}

function skeletonGrid(n = 6) {
  return `<div class="skeleton-grid">${Array(n).fill(0).map(() => `<div class="skel-card"><div class="skel-img"></div><div class="skel-line"></div><div class="skel-line short"></div></div>`).join('')}</div>`;
}

function attachCardHandlers() {
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => {
      const key = card.dataset.trackId;
      const grid = card.closest('.card-grid');
      const keys = JSON.parse((grid.dataset.tracks || '[]').replace(/&#39;/g, "'"));
      const queue = keys.map((k) => trackCache.get(k)).filter(Boolean);
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
    btn.addEventListener('click', (e) => { e.stopPropagation(); const track = trackCache.get(btn.dataset.likeId); if (track) toggleLike(track); });
  });
}

// ==================== PAGES ====================
async function renderHome() {
  state.page = 'home';
  content.innerHTML = `
    <div class="hero">
      <h1>Good evening 🎧</h1>
      <p>Streaming muzik penuh dari Audius — 100% percuma & sah</p>
    </div>
    <div id="home-sections">${skeletonGrid(6)}</div>`;
  const container = $('#home-sections');
  container.innerHTML = '';

  const cats = [
    { title: 'Trending Now', icon: ICONS.trending, type: 'trending' },
    { title: 'Hip Hop & Rap', icon: ICONS.music, type: 'genre', genre: 'Hip-Hop/Rap' },
    { title: 'Pop Hits', icon: ICONS.music, type: 'genre', genre: 'Pop' },
    { title: 'Electronic', icon: ICONS.music, type: 'genre', genre: 'Electronic' },
    { title: 'Lo-Fi Chill', icon: ICONS.music, type: 'genre', genre: 'Lo-Fi' },
    { title: 'Malaysia & Melayu', icon: ICONS.globe, type: 'search', term: 'malaysia' },
    { title: 'Indie Melayu', icon: ICONS.globe, type: 'search', term: 'melayu indie' },
    { title: 'Rock Classics', icon: ICONS.music, type: 'genre', genre: 'Rock' },
  ];

  for (const c of cats) {
    try {
      let tracks = [];
      if (c.type === 'trending') tracks = await aTrending(null, 12);
      else if (c.type === 'genre') tracks = await aTrending(c.genre, 12);
      else if (c.type === 'search') tracks = await aSearch(c.term, 12);
      if (tracks.length) container.innerHTML += renderCardSection(c.title, c.icon, tracks);
    } catch (e) { console.warn('Load error:', c.title, e); }
  }
  if (!container.innerHTML) container.innerHTML = `<div class="empty">${ICONS.music}<div>Gagal memuatkan. Cuba refresh.</div></div>`;
  attachCardHandlers();
}

function renderSearch(query = '') {
  state.page = 'search';
  content.innerHTML = `
    <div class="search-hero">
      <h1>Search</h1>
      <div class="search-input-wrap">
        ${ICONS.search}
        <input type="text" class="search-input" id="search-input" placeholder="Cari lagu, artis, genre..." autocomplete="off" value="${escapeHTML(query)}" />
      </div>
    </div>
    <div id="search-results"></div>`;
  const input = $('#search-input');
  const results = $('#search-results');
  let timer;
  input.focus();

  const doSearch = async (q) => {
    if (!q) { results.innerHTML = ''; return; }
    results.innerHTML = skeletonGrid(8);
    try {
      const tracks = await aSearch(q, 25);
      results.innerHTML = `<h2 class="section-title">Hasil: "${escapeHTML(q)}"</h2>${renderTrackList(tracks)}`;
      attachTrackHandlers(tracks);
    } catch { results.innerHTML = `<div class="empty">${ICONS.search}<div>Ralat carian. Cuba lagi.</div></div>`; }
  };

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => doSearch(input.value.trim()), 400); });
  if (query) doSearch(query);
}

function renderLibrary() {
  state.page = 'library';
  const tracks = Object.values(state.liked);
  content.innerHTML = `
    <div class="hero" style="background: linear-gradient(135deg, rgba(29,185,84,0.2) 0%, transparent 60%);">
      <h1>Liked Songs</h1>
      <p>${tracks.length} lagu disimpan</p>
    </div>
    ${!state.user ? `<div class="empty" style="padding:20px;">${ICONS.heart}<div>Log masuk untuk sync merentas peranti <a href="#" id="login-link" style="color:var(--accent)">Log masuk</a></div></div>` : ''}
    ${tracks.length ? renderTrackList(tracks) : `<div class="empty">${ICONS.heartOutline}<div>Belum ada lagu di-like</div></div>`}`;
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
      state.queue.push(track); state.index = state.queue.length - 1;
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
  } else { audio.pause(); state.playing = false; updatePlayerUI(); }
}

function playNext(auto = false) {
  if (!state.queue.length) return;
  if (auto && state.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
  if (state.shuffle) {
    let n; do { n = Math.floor(Math.random() * state.queue.length); } while (state.queue.length > 1 && n === state.index);
    state.index = n;
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
    npArt.src = track.artworkUrl100 || DEFAULT_ART;
    npTitle.textContent = track.trackName;
    npArtist.textContent = track.artistName;
    const liked = isLiked(track);
    likeBtn.classList.toggle('liked', liked);
    likeBtn.innerHTML = liked ? ICONS.heart : ICONS.heartOutline;
  } else {
    npArt.src = DEFAULT_ART;
    npTitle.textContent = 'Not playing';
    npArtist.textContent = 'Select a track';
    likeBtn.classList.remove('liked');
    likeBtn.innerHTML = ICONS.heartOutline;
  }
  const iconPlay = playBtn.querySelector('.icon-play');
  const iconPause = playBtn.querySelector('.icon-pause');
  if (state.playing) { iconPlay.hidden = true; iconPause.hidden = false; playBtn.title = 'Pause'; }
  else { iconPlay.hidden = false; iconPause.hidden = true; playBtn.title = 'Play'; }
}

function refreshActiveStates() {
  const curKey = state.index >= 0 && state.queue[state.index] ? trackKey(state.queue[state.index]) : null;
  document.querySelectorAll('.card, .track-row').forEach((el) => {
    const key = el.dataset.trackId;
    if (!key) return;
    const active = key === curKey;
    el.classList.toggle('playing', active);
    const btn = el.querySelector('.card-play');
    if (btn) btn.innerHTML = active && state.playing ? ICONS.pause : ICONS.play;
    const idx = el.querySelector('.track-index');
    if (idx) {
      if (active) idx.innerHTML = `<div class="eq ${state.playing ? '' : 'paused'}"><span></span><span></span><span></span><span></span></div>`;
      else idx.textContent = Array.from(el.parentElement.children).indexOf(el) + 1;
    }
    const eq = el.querySelector('.eq');
    if (eq && active) eq.classList.toggle('paused', !state.playing);
  });
}

function updateNavButtons() {
  backBtn.disabled = navHistory.index <= 0;
  forwardBtn.disabled = navHistory.index >= navHistory.stack.length - 1;
}

// ==================== AUTH UI ====================
async function refreshAuthUI() {
  if (state.user) {
    userBadge.innerHTML = state.user.picture ? `<img src="${state.user.picture}" alt="" />` : '<svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
    userBadge.title = state.user.name || state.user.email;
  } else {
    userBadge.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';
    userBadge.title = 'Log Masuk';
  }
}

function openLoginModal() { $('#login-modal').hidden = false; showOtpStep(1); clearModalMessages(); }
function closeLoginModal() { $('#login-modal').hidden = true; }
function showOtpStep(n) { $('#otp-step-1').hidden = n !== 1; $('#otp-step-2').hidden = n !== 2; }
function clearModalMessages() { const e = $('#modal-error'), i = $('#modal-info'); e.classList.remove('show'); e.textContent = ''; i.classList.remove('show'); i.textContent = ''; }
function showError(m) { const el = $('#modal-error'); el.textContent = m; el.classList.add('show'); $('#modal-info').classList.remove('show'); }
function showInfo(m) { const el = $('#modal-info'); el.textContent = m; el.classList.add('show'); $('#modal-error').classList.remove('show'); }

async function handleGoogleLogin() {
  $('#btn-google').disabled = true;
  try {
    const r = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `${API_URL}/auth/google?redirect_uri=${r}`;
  } catch { showError('Gagal mulakan Google login'); $('#btn-google').disabled = false; }
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
    showOtpStep(2); $('#otp-input').value = ''; $('#otp-input').focus();
    showInfo('Kod OTP dihantar ke emel anda.');
  } catch (e) { showError(e.message); }
  finally { btn.disabled = false; btn.textContent = 'Hantar Kod OTP'; }
}

async function handleVerifyOTP() {
  const email = $('#email-input').value.trim();
  const code = $('#otp-input').value.trim();
  if (!code || code.length !== 6) return showError('Masukkan 6-digit kod');
  clearModalMessages();
  const btn = $('#btn-verify-otp');
  btn.disabled = true; btn.textContent = 'Mengesahkan...';
  try {
    const { token, user } = await auth.api('/auth/email/verify-otp', { method: 'POST', body: JSON.stringify({ email, code }) });
    auth.setToken(token); await onLoginSuccess(user);
  } catch (e) { showError(e.message); }
  finally { btn.disabled = false; btn.textContent = 'Sahkan'; }
}

async function onLoginSuccess(user) {
  state.user = user;
  closeLoginModal();
  await refreshAuthUI();
  await syncLocalLikedToServer();
  await loadLikedFromServer();
  if (state.page === 'library') renderLibrary(); else refreshActiveStates();
  updatePlayerUI();
}

async function handleLogout() {
  await auth.logout();
  state.user = null;
  state.liked = loadLikedLocal();
  $('#user-menu').hidden = true;
  await refreshAuthUI();
  if (state.page === 'library') renderLibrary();
  updatePlayerUI();
}

// ==================== EVENTS ====================
playBtn.addEventListener('click', togglePlay);
$('#next-btn').addEventListener('click', () => playNext(false));
$('#prev-btn').addEventListener('click', playPrev);
shuffleBtn.addEventListener('click', () => { state.shuffle = !state.shuffle; shuffleBtn.classList.toggle('active', state.shuffle); });

repeatBtn.addEventListener('click', () => {
  const modes = ['off', 'all', 'one'];
  state.repeat = modes[(modes.indexOf(state.repeat) + 1) % 3];
  repeatBtn.classList.toggle('active', state.repeat !== 'off');
  repeatBtn.querySelector('.icon-repeat').hidden = state.repeat === 'one';
  repeatBtn.querySelector('.icon-repeat-one').hidden = state.repeat !== 'one';
  repeatBtn.title = state.repeat === 'off' ? 'Repeat off' : state.repeat === 'all' ? 'Repeat all' : 'Repeat one';
});

progress.addEventListener('input', (e) => { if (audio.duration) audio.currentTime = (e.target.value / 1000) * audio.duration; });

volumeSlider.addEventListener('input', (e) => {
  const v = e.target.value / 100; state.volume = v; audio.volume = v;
  const vol = $('#vol-btn');
  vol.querySelector('.icon-vol').hidden = v === 0 || v < 0.5;
  vol.querySelector('.icon-vol-low').hidden = v === 0 || v >= 0.5;
  vol.querySelector('.icon-vol-mute').hidden = v !== 0;
});

$('#vol-btn').addEventListener('click', () => {
  const v = audio.volume > 0 ? 0 : (state.volume || 0.7);
  audio.volume = v; volumeSlider.value = v * 100;
  const vol = $('#vol-btn');
  vol.querySelector('.icon-vol').hidden = v === 0 || v < 0.5;
  vol.querySelector('.icon-vol-low').hidden = v === 0 || v >= 0.5;
  vol.querySelector('.icon-vol-mute').hidden = v !== 0;
});

likeBtn.addEventListener('click', () => { const t = state.index >= 0 ? state.queue[state.index] : null; if (t) toggleLike(t); });

audio.addEventListener('timeupdate', () => {
  currentTimeEl.textContent = formatTime(audio.currentTime);
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  progress.value = pct * 10;
  progress.style.background = `linear-gradient(to right, #1db954 ${pct}%, #4d4d4d ${pct}%)`;
});
audio.addEventListener('loadedmetadata', () => { durationEl.textContent = formatTime(audio.duration); });
audio.addEventListener('ended', () => playNext(true));
audio.addEventListener('play', () => { state.playing = true; updatePlayerUI(); refreshActiveStates(); });
audio.addEventListener('pause', () => { state.playing = false; updatePlayerUI(); refreshActiveStates(); });
audio.addEventListener('error', () => { if (state.queue.length > 1) playNext(true); });

document.querySelectorAll('.nav-link').forEach((l) => {
  l.addEventListener('click', (e) => {
    e.preventDefault();
    const p = l.dataset.page;
    document.querySelectorAll('.nav-link').forEach((x) => x.classList.remove('active'));
    l.classList.add('active');
    navHistory.push({ page: p });
    routeTo(p);
  });
});

document.querySelectorAll('.playlist-item').forEach((it) => {
  it.addEventListener('click', () => {
    if (it.dataset.playlist === 'liked') {
      document.querySelectorAll('.nav-link').forEach((x) => x.classList.remove('active'));
      document.querySelector('[data-page="library"]').classList.add('active');
      navHistory.push({ page: 'library' });
      renderLibrary();
    }
  });
});

backBtn.addEventListener('click', () => { const e = navHistory.back(); if (e) routeTo(e.page); });
forwardBtn.addEventListener('click', () => { const e = navHistory.forward(); if (e) routeTo(e.page); });

userBadge.addEventListener('click', (e) => {
  e.stopPropagation();
  if (state.user) {
    const m = $('#user-menu');
    m.hidden = !m.hidden;
    if (!m.hidden) {
      $('#menu-avatar').src = state.user.picture || DEFAULT_ART;
      $('#menu-name').textContent = state.user.name || 'User';
      $('#menu-email').textContent = state.user.email || '';
    }
  } else openLoginModal();
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#user-menu') && !e.target.closest('#user-badge')) $('#user-menu').hidden = true;
});
$('#menu-logout').addEventListener('click', handleLogout);

$('#modal-close').addEventListener('click', closeLoginModal);
$('#login-modal').addEventListener('click', (e) => { if (e.target.id === 'login-modal') closeLoginModal(); });
$('#btn-google').addEventListener('click', handleGoogleLogin);
$('#btn-send-otp').addEventListener('click', handleSendOTP);
$('#btn-verify-otp').addEventListener('click', handleVerifyOTP);
$('#btn-resend-otp').addEventListener('click', handleSendOTP);
$('#btn-change-email').addEventListener('click', () => showOtpStep(1));
$('#otp-input').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
$('#email-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSendOTP(); });
$('#otp-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleVerifyOTP(); });

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
  const url = new URL(window.location.href);
  const tok = url.searchParams.get('token');
  if (tok) {
    auth.setToken(tok);
    url.searchParams.delete('token'); url.searchParams.delete('auth');
    window.history.replaceState({}, '', url.toString());
  }
  state.user = await auth.loadMe();
  await refreshAuthUI();
  if (state.user) {
    await loadLikedFromServer();
    if (Object.keys(loadLikedLocal()).length) await syncLocalLikedToServer();
  } else {
    state.liked = loadLikedLocal();
  }
  navHistory.push({ page: 'home' });
  await renderHome();
  updatePlayerUI();
  updateNavButtons();
}

init();