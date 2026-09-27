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
| 7 | Eleven Labs audio → Gemini pipeline | `backend/ai.js`, `.env`, `frontend/public/intake.html` | `[x]` | `audioBase64` → `transcribeAudio()` (ElevenLabs STT) → Gemini extract; form fills automatically; `elevenlabs` package installed |
| 8 | GoDaddy domain / deployment config | `package.json`, `.env`, server config | `[ ]` | No production URL or deploy script; `PORT=3000` only |
| 9 | Error handling & input sanitization | `backend/server.js` | `[ ]` | Basic 400/409/500 only; missing malformed date guards, county regex strictness, XSS sanitization |

---

## FRONTEND TASKS

| # | Task | File(s) | Progress | Notes |
|---|------|---------|----------|-------|
| 1 | Chatbot/wizard intro page (page 1) | `frontend/public/onboarding.html` | `[x]` | Two-tone cards; links to `intake.html` and `map.html` now live |
| 2 | Audio recording & Eleven Labs submit (page 2) | `frontend/public/intake.html` | `[x]` | Voice button uses `MediaRecorder`; sends `audioBase64` to `/api/ai/extract`; fills title, county, dates, description from Gemini response |
| 3 | Gemini NLP processing (page 2→3) | `frontend/public/intake.html`, `conflict_check.html` | `[+]` | `intake.html` now has "Extract with AI" button hitting `/api/ai/extract`; `conflict_check.html` hits `/api/ai/check-conflicts` |
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
| 2 | Eleven Labs audio + Gemini pipeline | `backend/ai.js`, `.env` | `[x]` | ElevenLabs `speech_to_text.convert` wired; transcript fed to Gemini; `audioBase64` handled in `extractProjectFields`; `intake.html` uses MediaRecorder |
| 3 | Wizard pop-up with feedback | `frontend/public/intake.html`, `conflict_check.html` | `[+]` | Conflict page exists; need modal in wizard (page 3 pop-up) instead of separate page for smoother flow |
| 4 | Persist user-submitted projects to MongoDB | `backend/server.js` (POST `/api/projects`) | `[x]` | Save works; not yet linked to wizard after conflict confirmation |
| 5 | Real-time map refresh after new project | `frontend/public/map.html` | `[ ]` | No post-save refresh; could poll `/api/projects/county/:county` or use server-sent events |

---

## DONE THIS SESSION (updates made now)
- [x] Added server error catches (`502` for AI failures) so Gemini 503/429 doesn't crash server (`startServer` crashes fixed with `express.json({limit:'50mb'})` and try/catch guards)
- [x] Added `responseSchema` (JSON mode) + `safeCompanyFallback` + lazy date parser to `ai.js`
- [x] Added transcript display (`#transcript`) to `intake.html`
- [x] Added quick text demo (`#demoText` + `#demoButton`) for typing without microphone
- [x] Added navigation links (`map.html` sidebar, `conflict_check.html` back links)
- [x] Wizard opening page (`index.html`) with voice, icon, and citizen/company choices (replaced `onboarding.html` entry; `wizard.html` removed)
- [x] Updated `index.html` redirect to wizard; linked wizard from onboarding and intake
- [x] Added wizard speech to conflict page with remediation and nearest-window guidance
- [x] Added wizard voice test button (`sayWizardWelcome`) on intake page
- [x] Wired intake submit to check conflicts first via `/api/projects/conflicts` (direct backend check), redirects to conflict page if overlaps found
- [x] Added `BroadcastChannel('sperry-refresh')` so `map.html` updates automatically after a new project is saved
- [x] Fixed date timezone shift with `toUTCISO` so form dates stay consistent across timezones
- [x] Updated backend conflict detection to compute next free window of the same duration as the submitted project
- [x] Consolidated wizard voice across all pages via `wizard-voice.js` (British male, pitch `0.72`, rate `0.78`)
- [x] Removed redundant "Wizard voice test" UI from intake page
- [x] Updated conflict page (`conflict_check.html`) to use sessionStorage, show wizard-guided remediation, and support both AI and direct conflict checks
- [x] Added wizard voice to `index.html`, `onboarding.html`, and `map.html` with guiding text

---

## WHAT IS MISSING / NEXT WORK

1. **Gemini rate limits / billing link** (current blocker): free tier hits `429` after ~20 requests; link `.env` `GEMINI_API_KEY` to a new billing-enabled AI Studio key (`https://aistudio.google.com/app/apikey`) or migrate fully to Vertex AI / `google-cloud/vertexai` SDK.
2. **Real-time map refresh**: `BroadcastChannel` wired — `map.html` refreshes when `intake.html` saves. Add polling or SSE if cross-tab reliability needed.
4. **Error handling & sanitization**: strict date parsing, county regex, duplicate-title guard already partially there; add rate limiting and input length caps.
5. **GoDaddy / deployment**: add `.env` production variables, deploy script, HTTPS/production URL; currently only local `PORT=3000`.
6. **Health / monitoring**: expose `/health` to frontend for status indicator; optional.

Run `node backend/seed.js` with `MONGO_URI` set to populate sample data, then start with `node backend/server.js` and open `http://localhost:3000/`.
