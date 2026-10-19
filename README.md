# 🎵 Musicfy — Spotify Clone (Cloudflare Workers + Google OAuth + Email OTP)

Full-stack music streaming app dengan auth Google OAuth & Email OTP.

## ✨ Ciri-ciri
- 🔐 Login dengan **Google OAuth 2.0**
- 📧 Login dengan **Email + OTP 6-digit**
- 💚 Liked songs sync merentas peranti
- 🎵 Playback dengan iTunes API (preview 30s)
- 🔀 Shuffle, 🔁 Repeat, ⏮ ⏭ Next/Prev
- 📱 Responsive
- 💾 Data disimpan dalam **Cloudflare KV**

---

## 🚀 Setup (10 minit)

### 1. Buat Cloudflare Account
1. Daftar di [dash.cloudflare.com](https://dash.cloudflare.com)
2. Install Wrangler: `npm i -g wrangler`
3. Login: `wrangler login`

### 2. Buat KV Namespace
```bash
cd worker
wrangler kv:namespace create "KV"
# Copy output id ke wrangler.toml
```

### 3. Setup Google OAuth
1. Pergi [console.cloud.google.com](https://console.cloud.google.com)
2. Buat project baru
3. **APIs & Services → Credentials → Create OAuth Client ID**
4. Type: **Web application**
5. **Authorized redirect URIs**:
   ```
   https://musicfy-worker.YOURNAME.workers.dev/auth/google/callback
   ```
6. Copy **Client ID** & **Client Secret**

### 4. Setup Resend (untuk Email OTP)
1. Daftar [resend.com](https://resend.com) — free 100 email/hari
2. Verify domain atau guna `onboarding@resend.dev` untuk testing
3. Copy **API Key**

### 5. Set Secrets Worker
```bash
cd worker
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put RESEND_API_KEY
```

### 6. Deploy Worker
```bash
# Edit wrangler.toml — tukar WORKER_URL, FRONTEND_URL, ALLOWED_ORIGINS
wrangler deploy
```

### 7. Deploy Frontend
1. Edit `frontend/app.js`:
   ```javascript
   const API_URL = 'https://musicfy-worker.YOURNAME.workers.dev';
   ```
2. Upload `frontend/` ke GitHub → aktifkan **GitHub Pages**
3. Atau drag-drop ke [Netlify Drop](https://app.netlify.com/drop)

### 8. Update ALLOWED_ORIGINS
Tambah URL frontend anda di `wrangler.toml`:
```toml
ALLOWED_ORIGINS = "https://YOURNAME.github.io,http://localhost:8080"
```
Kemudian `wrangler deploy` semula.

---

## 🧪 Test Local

**Worker:**
```bash
cd worker
wrangler dev
# Running di http://localhost:8787
```

**Frontend** (di terminal lain):
```bash
cd frontend
python -m http.server 8080
# Buka http://localhost:8080
```

Edit `app.js`: `const API_URL = 'http://localhost:8787';`

> **Tanpa Resend API key** → OTP akan log ke terminal Wrangler:
> `🔑 [DEV] OTP untuk user@email.com: 123456`

---

## 📋 Endpoints Worker

| Method | Path | Keterangan |
|--------|------|------------|
| GET | `/auth/google` | Redirect ke Google |
| GET | `/auth/google/callback` | Callback OAuth |
| POST | `/auth/email/send-otp` | Hantar OTP |
| POST | `/auth/email/verify-otp` | Sahkan OTP → token |
| GET | `/auth/me` | Current user |
| POST | `/auth/logout` | Log keluar |
| GET/POST/DELETE | `/api/liked` | Liked songs |
| GET/POST/DELETE | `/api/playlists` | Playlists |

---

## ✅ Semua Butang Berfungsi

| Butang | Fungsi |
|--------|--------|
| Home / Search / Library | Navigate + history |
| Back (‹) / Forward (›) | History stack |
| User badge | Login modal / user menu |
| Shuffle | Toggle random order |
| Prev / Next | Track navigation |
| Play / Pause | Audio toggle |
| Repeat | off → all → one |
| Progress bar | Seek |
| Volume + Mute | Volume control |
| Like (player & rows) | Sync ke server (login) atau localStorage |
| Liked Songs playlist | Page untuk liked |
| Search input | Live search iTunes |
| Google button | OAuth flow |
| Hantar OTP | Send OTP email |
| Sahkan OTP | Verify + create session |
| Hantar semula / Tukar emel | OTP flow |
| Log Keluar | Clear session |

---

## ⚠️ Had iTunes API
- Preview audio hanya **30 saat**
- Tiada API key diperlukan (percuma)
- Rate limit ~20 req/minit

Kalau nak lagu penuh tanpa had → integrate dengan **Jamendo API** atau **Deezer API**.

## 📄 Lesen
MIT