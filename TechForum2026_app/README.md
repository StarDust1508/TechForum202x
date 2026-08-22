# TechForum2026

Mobile conference companion app with a React + Capacitor frontend and a Node.js backend.

## Stack

- Frontend: React 19, Vite, React Router, Tailwind CSS
- Mobile: Capacitor Android (`com.psy_lololo.conferenceapp`) and iOS (`ru.techpravo.conference`)
- Backend: Express + `express-session` cookie auth
- AI endpoint: `POST /api/v1/ai/chat` on backend
- Storage model: in-memory backend state + optional localStorage fallback

## Architecture

Main path:

`User -> Frontend (React) -> Backend API (/api/v1) -> In-memory state`

Fallback path (when enabled via `VITE_ENABLE_LOCAL_FALLBACK=true`):

`User -> Frontend -> localStorage auth model (PBKDF2 hash + salt)`

## Local run

1. Install dependencies:
   `npm install`
2. Copy environment template and tune values:
   `cp .env.example .env.development`
3. Start backend + frontend middleware:
   `npm run dev`

By default, backend listens on `http://127.0.0.1:3000`.

## API quick checks

```bash
curl -i http://127.0.0.1:3000/api/v1/health
curl -i http://127.0.0.1:3000/api/health
curl -i http://127.0.0.1:3000/api/v1/auth/me
```

## Android build

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Store release

The current Android and iPhone release packages, checksums, and release status
are documented in `release/CURRENT/README.md`.

Android keeps the historical RuStore package ID. The iOS wrapper uses a
separate App Store bundle ID and is synchronized with:

```bash
CAP_APP_ID=ru.techpravo.conference npx cap sync ios
```

## Notes

- The iOS wrapper is present in `ios/App`. A signed archive still requires full
  Xcode, an Apple Developer Team, and a provisioning profile.
- Production requires `SESSION_SECRET` and external HTTPS termination (reverse proxy / LB).
