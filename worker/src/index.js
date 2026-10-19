/* =========================================================
   Musicfy Cloudflare Worker
   - Google OAuth 2.0
   - Email + OTP (via Resend)
   - Session token (Bearer)
   - Liked songs & Playlists storage (KV)
   ========================================================= */

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 hari
const OTP_TTL = 60 * 5;                // 5 minit
const STATE_TTL = 60 * 10;             // 10 minit
const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN = 60;               // 60 detik

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request, env) });
    }

    try {
      const p = url.pathname;

      // ---- AUTH ----
      if (p === '/auth/google' && request.method === 'GET')
        return handleGoogleStart(request, env);
      if (p === '/auth/google/callback' && request.method === 'GET')
        return handleGoogleCallback(request, env);
      if (p === '/auth/email/send-otp' && request.method === 'POST')
        return handleSendOTP(request, env);
      if (p === '/auth/email/verify-otp' && request.method === 'POST')
        return handleVerifyOTP(request, env);
      if (p === '/auth/me' && request.method === 'GET')
        return handleMe(request, env);
      if (p === '/auth/logout' && request.method === 'POST')
        return handleLogout(request, env);

      // ---- API ----
      if (p === '/api/liked' && ['GET', 'POST', 'DELETE'].includes(request.method))
        return handleLiked(request, env);
      if (p === '/api/playlists' && ['GET', 'POST', 'DELETE'].includes(request.method))
        return handlePlaylists(request, env);

      // ---- HEALTH ----
      if (p === '/' || p === '/health')
        return json({ ok: true, service: 'musicfy-worker' }, 200, env);

      return json({ error: 'Not found' }, 404, env);
    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: err.message || 'Internal error' }, 500, env);
    }
  },
};

/* =========================================================
   HELPERS
   ========================================================= */

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : (allowed[0] || '*');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function json(data, status = 200, env = null, request = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (env && request) Object.assign(headers, corsHeaders(request, env));
  return new Response(JSON.stringify(data), { status, headers });
}

async function getUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const session = await env.KV.get(`session:${token}`, 'json');
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    await env.KV.delete(`session:${token}`);
    return null;
  }
  const user = await env.KV.get(`user:${session.userId}`, 'json');
  return user || null;
}

async function createSession(userId, env) {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  await env.KV.put(
    `session:${token}`,
    JSON.stringify({ userId, expiresAt: Date.now() + SESSION_TTL * 1000 }),
    { expirationTtl: SESSION_TTL }
  );
  return token;
}

/* =========================================================
   GOOGLE OAUTH
   ========================================================= */

async function handleGoogleStart(request, env) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirect_uri') || env.FRONTEND_URL;

  // Validate redirect_uri — hanya origin yang dibenarkan
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  try {
    const rUrl = new URL(redirectTo);
    const origin = rUrl.origin;
    if (allowed.length && !allowed.includes(origin)) {
      return json({ error: 'redirect_uri tidak dibenarkan' }, 400, env, request);
    }
  } catch {
    return json({ error: 'redirect_uri tidak sah' }, 400, env, request);
  }

  const state = crypto.randomUUID();
  await env.KV.put(`state:${state}`, JSON.stringify({ redirectTo }), { expirationTtl: STATE_TTL });

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.WORKER_URL}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}

async function handleGoogleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) return json({ error: 'Missing code/state' }, 400, env, request);

  const stateData = await env.KV.get(`state:${state}`, 'json');
  if (!stateData) return json({ error: 'State tidak sah atau tamat' }, 400, env, request);
  await env.KV.delete(`state:${state}`);

  // Tukar code → token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.WORKER_URL}/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) {
    console.error('Token exchange failed:', await tokenRes.text());
    return json({ error: 'Gagal tukar code' }, 400, env, request);
  }
  const tokens = await tokenRes.json();

  // Ambil profil
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) return json({ error: 'Gagal ambil profil' }, 400, env, request);
  const profile = await profileRes.json();

  const userId = `google:${profile.id}`;
  let user = await env.KV.get(`user:${userId}`, 'json');
  if (!user) {
    user = {
      id: userId,
      email: profile.email,
      name: profile.name,
      picture: profile.picture || null,
      provider: 'google',
      createdAt: Date.now(),
    };
  } else {
    user.name = profile.name || user.name;
    user.picture = profile.picture || user.picture;
  }
  await env.KV.put(`user:${userId}`, JSON.stringify(user));

  const token = await createSession(userId, env);

  const redirectUrl = new URL(stateData.redirectTo || env.FRONTEND_URL);
  redirectUrl.searchParams.set('token', token);
  redirectUrl.searchParams.set('auth', 'google');
  return Response.redirect(redirectUrl.toString(), 302);
}

/* =========================================================
   EMAIL + OTP
   ========================================================= */

async function handleSendOTP(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').toLowerCase().trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Emel tidak sah' }, 400, env, request);
  }

  // Cooldown
  const last = await env.KV.get(`otp-last:${email}`);
  if (last && Date.now() - parseInt(last) < OTP_COOLDOWN * 1000) {
    const wait = Math.ceil((OTP_COOLDOWN * 1000 - (Date.now() - parseInt(last))) / 1000);
    return json({ error: `Sila tunggu ${wait} detik` }, 429, env, request);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await env.KV.put(
    `otp:${email}`,
    JSON.stringify({ code, attempts: 0, expiresAt: Date.now() + OTP_TTL * 1000 }),
    { expirationTtl: OTP_TTL }
  );
  await env.KV.put(`otp-last:${email}`, String(Date.now()), { expirationTtl: OTP_COOLDOWN });

  // Hantar emel via Resend (jika ada API key). Kalau tiada, log ke console (dev mode).
  if (env.RESEND_API_KEY) {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || 'Musicfy <onboarding@resend.dev>',
        to: [email],
        subject: `Kod OTP Musicfy: ${code}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#121212;color:#fff;border-radius:10px">
            <h2 style="color:#1db954;margin:0 0 16px">🎵 Musicfy</h2>
            <p>Kod OTP anda:</p>
            <p style="font-size:36px;font-weight:bold;letter-spacing:10px;background:#1f1f1f;padding:16px;text-align:center;border-radius:8px">${code}</p>
            <p style="color:#b3b3b3;font-size:13px">Kod ini sah selama 5 minit. Jangan kongsi dengan sesiapa.</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error:', err);
      return json({ error: 'Gagal hantar emel' }, 500, env, request);
    }
  } else {
    // DEV MODE — log OTP ke console wrangler
    console.log(`🔑 [DEV] OTP untuk ${email}: ${code}`);
  }

  return json(
    { ok: true, message: 'OTP dihantar. Sila semak emel anda.', dev: !env.RESEND_API_KEY },
    200,
    env,
    request
  );
}

async function handleVerifyOTP(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').toLowerCase().trim();
  const code = String(body.code || '').trim();

  if (!email || !code) return json({ error: 'Emel & kod diperlukan' }, 400, env, request);

  const data = await env.KV.get(`otp:${email}`, 'json');
  if (!data) return json({ error: 'Kod tamat tempoh. Sila minta kod baru.' }, 400, env, request);

  if (data.expiresAt < Date.now()) {
    await env.KV.delete(`otp:${email}`);
    return json({ error: 'Kod tamat tempoh' }, 400, env, request);
  }

  if (data.attempts >= OTP_MAX_ATTEMPTS) {
    await env.KV.delete(`otp:${email}`);
    return json({ error: 'Terlalu banyak percubaan. Minta kod baru.' }, 429, env, request);
  }

  if (data.code !== code) {
    data.attempts += 1;
    const remaining = Math.max(1, Math.floor((data.expiresAt - Date.now()) / 1000));
    await env.KV.put(`otp:${email}`, JSON.stringify(data), { expirationTtl: remaining });
    return json(
      { error: `Kod tidak betul (${OTP_MAX_ATTEMPTS - data.attempts} cubaan lagi)` },
      400,
      env,
      request
    );
  }

  await env.KV.delete(`otp:${email}`);

  const userId = `email:${email}`;
  let user = await env.KV.get(`user:${userId}`, 'json');
  if (!user) {
    user = {
      id: userId,
      email,
      name: email.split('@')[0],
      picture: null,
      provider: 'email',
      createdAt: Date.now(),
    };
    await env.KV.put(`user:${userId}`, JSON.stringify(user));
  }

  const token = await createSession(userId, env);
  return json({ token, user }, 200, env, request);
}

/* =========================================================
   AUTH
   ========================================================= */

async function handleMe(request, env) {
  const user = await getUser(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401, env, request);
  return json({ user }, 200, env, request);
}

async function handleLogout(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token) await env.KV.delete(`session:${token}`);
  return json({ ok: true }, 200, env, request);
}

/* =========================================================
   LIKED SONGS
   ========================================================= */

async function handleLiked(request, env) {
  const user = await getUser(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401, env, request);

  const key = `liked:${user.id}`;

  if (request.method === 'GET') {
    const liked = (await env.KV.get(key, 'json')) || {};
    return json({ liked }, 200, env, request);
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const track = body.track;
    if (!track || !track.previewUrl) return json({ error: 'Track tidak sah' }, 400, env, request);

    const tKey = String(track.trackId || track.previewUrl);
    const liked = (await env.KV.get(key, 'json')) || {};

    let active;
    if (liked[tKey]) {
      delete liked[tKey];
      active = false;
    } else {
      liked[tKey] = {
        trackId: track.trackId,
        trackName: track.trackName,
        artistName: track.artistName,
        collectionName: track.collectionName,
        artworkUrl100: track.artworkUrl100,
        previewUrl: track.previewUrl,
        trackTimeMillis: track.trackTimeMillis,
      };
      active = true;
    }

    await env.KV.put(key, JSON.stringify(liked));
    return json({ liked, active }, 200, env, request);
  }

  if (request.method === 'DELETE') {
    await env.KV.delete(key);
    return json({ ok: true }, 200, env, request);
  }
}

/* =========================================================
   PLAYLISTS (bonus)
   ========================================================= */

async function handlePlaylists(request, env) {
  const user = await getUser(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401, env, request);

  const key = `playlists:${user.id}`;

  if (request.method === 'GET') {
    const playlists = (await env.KV.get(key, 'json')) || [];
    return json({ playlists }, 200, env, request);
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    if (!name) return json({ error: 'Nama playlist diperlukan' }, 400, env, request);

    const playlists = (await env.KV.get(key, 'json')) || [];
    const pl = {
      id: crypto.randomUUID(),
      name,
      tracks: [],
      createdAt: Date.now(),
    };
    playlists.push(pl);
    await env.KV.put(key, JSON.stringify(playlists));
    return json({ playlists, playlist: pl }, 200, env, request);
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Missing id' }, 400, env, request);

    let playlists = (await env.KV.get(key, 'json')) || [];
    playlists = playlists.filter((p) => p.id !== id);
    await env.KV.put(key, JSON.stringify(playlists));
    return json({ playlists }, 200, env, request);
  }
}