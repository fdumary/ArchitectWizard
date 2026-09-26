# ShellHacks2026 — Task Tracker

**Project**: Sperry Tech challenge — Construction project coordination platform
**Focus**: Gemini, GoDaddy, MongoDB Atlas, Eleven Labs integration
**Current state**: MongoDB connected; backend REST APIs live; frontend pages linked to backend via `express.static`. Missing production wiring and audio pipeline.

---

## Legend
- `[ ]` — Not started
- `[x]` — Complete
- `[+]` — In progress / partially done

---

## BACKEND TASKS

| # | Task | File(s) | Progress | Notes |
|---|------|---------|----------|-------|
| 1 | MongoDB Atlas connection & basic CRUD | `backend/server.js`, `.env` | `[x]` | Connected, seed data works (`seed.js`), `startServer()` runs |
| 2 | Project creation endpoint | `backend/server.js` (lines 45–71) | `[x]` | POST `/api/projects` validates title, county, startTime, endTime |
| 3 | Conflict detection endpoint | `backend/server.js` (lines 97–126) | `[x]` | GET `/api/projects/conflicts` temporal overlap per county |
| 4 | Top 3 upcoming per county | `backend/server.js` (lines 74–93) | `[x]` | GET `/api/projects/county/:county` sorts by startTime, limits 3 |
| 5 | Health check endpoint | `backend/server.js` (lines 129–136) | `[x]` | GET `/health` returns total project count |
| 6 | Add Gemini NLP integration | `backend/server.js`, `backend/ai.js` | `[x]` | `/api/ai/extract` + `/api/ai/check-conflicts`; prompt engineered |
| 7 | Eleven Labs audio → Gemini pipeline | `backend/ai.js`, `.env` | `[ ]` | Audio base64 accepted but no Eleven Labs ASR API call wired; need `ELEVENLABS_API_KEY` + transcription step |
| 8 | GoDaddy domain / deployment config | `package.json`, `.env`, server config | `[ ]` | No production URL or deploy script; `PORT=3000` only |
| 9 | Error handling & input sanitization | `backend/server.js` | `[ ]` | Basic 400/409/500 only; missing malformed date guards, county regex strictness, XSS sanitization |

---

## FRONTEND TASKS

| # | Task | File(s) | Progress | Notes |
|---|------|---------|----------|-------|
| 1 | Chatbot/wizard intro page (page 1) | `frontend/public/onboarding.html` | `[x]` | Two-tone cards; links to `intake.html` and `map.html` now live |
| 2 | Audio recording & Eleven Labs submit (page 2) | `frontend/public/intake.html` | `[+]` | Voice button uses browser `SpeechRecognition`; Eleven Labs upload not implemented; needs `audioBase64` → `/api/ai/extract` path |
| 3 | Gemini NLP processing (page 2→3) | `frontend/public/intake.html`, `conflict.html` | `[+]` | `intake.html` now has "Extract with AI" button hitting `/api/ai/extract`; `conflict.html` hits `/api/ai/check-conflicts` |
| 4 | Conflict feedback from wizard (page 3) | `frontend/public/conflict.html` | `[+]` | New page created; shows county, dates, conflict count, overlapping project list |
| 5 | Florida county map (page 4) | `frontend/public/map.html` | `[x]` | SVG map with click handlers; calls `/api/projects/county/:county`; renders top 3 |
| 6 | Display top 3 upcoming projects | `frontend/public/map.html` | `[x]` | Renders under sidebar with title, company, start/end dates |
| 7 | Responsive UI for construction companies & citizens | `frontend/public/onboarding.html`, `intake.html` | `[x]` | Firm (blue) + citizen (green) tones; mobile grid works |
| 8 | Frontend + backend API wiring | `backend/server.js`, `frontend/public/` | `[+]` | Added `express.static('frontend/public')`; `index.html` redirects; pages call `/api/projects`, `/api/ai/*`; missing: real-time refresh after save, login/auth |

---

## INTEGRATION TASKS

| # | Task | File(s) | Progress | Notes |
|---|------|---------|----------|-------|
| 1 | Gemini text extraction prompt engineering | `backend/ai.js` | `[x]` | System prompt + JSON response schema set |
| 2 | Eleven Labs audio + Gemini pipeline | `backend/ai.js`, `.env` | `[ ]` | Need Eleven Labs ASR endpoint; feed transcript to `/api/ai/extract`; then conflict check |
| 3 | Wizard pop-up with feedback | `frontend/public/intake.html`, `conflict.html` | `[+]` | Conflict page exists; need modal in wizard (page 3 pop-up) instead of separate page for smoother flow |
| 4 | Persist user-submitted projects to MongoDB | `backend/server.js` (POST `/api/projects`) | `[x]` | Save works; not yet linked to wizard after conflict confirmation |
| 5 | Real-time map refresh after new project | `frontend/public/map.html` | `[ ]` | No post-save refresh; could poll `/api/projects/county/:county` or use server-sent events |

---

## DONE THIS SESSION (updates made now)
- [x] Added `express.static('frontend/public')` to `backend/server.js` so backend serves frontend
- [x] Created `frontend/public/index.html` redirect to onboarding
- [x] Linked `onboarding.html` CTAs to `intake.html` and `map.html`
- [x] Added "Extract with AI" button in `intake.html` (calls `/api/ai/extract`)
- [x] Created `frontend/public/conflict.html` wired to `/api/ai/check-conflicts` + conflict list render
- [x] Added link from `intake.html` to `conflict.html`
- [x] Updated `tasks.md` to match actual hook-up state

---

## WHAT IS MISSING / NEXT WORK

1. **Eleven Labs integration** (highest impact): wire `ELEVENLABS_API_KEY`, upload audio from `intake.html`, get transcript, pass to `/api/ai/extract`; add `audioBase64` pipeline in `ai.js`.
2. **Wizard modal / 3-page flow**: merge `conflict.html` into wizard (page 3 pop-up) after AI extraction, ask user to confirm then POST to `/api/projects`; persist to MongoDB after confirmation.
3. **Real-time map refresh**: after POST success, trigger `map.html` to re-fetch `/api/projects/county/:county`; could use `BroadcastChannel` or simple reload.
4. **Error handling & sanitization**: strict date parsing, county regex, duplicate-title guard already partially there; add rate limiting and input length caps.
5. **GoDaddy / deployment**: add `.env` production variables, deploy script, HTTPS/production URL; currently only local `PORT=3000`.
6. **Health / monitoring**: expose `/health` to frontend for status indicator; optional.

Run `node backend/seed.js` with `MONGO_URI` set to populate sample data, then start with `node backend/server.js` and open `http://localhost:3000/`.
