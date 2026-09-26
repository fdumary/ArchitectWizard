# ShellHacks2026 — Task Tracker

**Project**: Sperry Tech challenge — Construction project coordination platform  
**Focus**: Gemini, GoDaddy, MongoDB Atlas, Eleven Labs integration  
**Current state**: MongoDB connected and tested ✅

---

## Legend
- `[ ]` — Not started
- `[x]` — Complete
- `[→]` — In progress

---

## BACKEND TASKS

| # | Task | File(s) | Progress | Notes |
|---|------|---------|----------|-------|
| 1 | ✅ MongoDB Atlas connection & basic CRUD | `server.js`, `.env` | `[x]` | Connected, seed data works (`seed.js`), `startServer()` runs |
| 2 | Project creation endpoint | `server.js` (lines 45‑71) | `[x]` | POST `/api/projects` — validates title, county, startTime, endTime |
| 3 | Conflict detection endpoint | `server.js` (lines 97‑126) | `[x]` | GET `/api/projects/conflicts` — temporal overlap check per county |
| 4 | Top‑3 upcoming projects per county | `server.js` (lines 74‑93) | `[x]` | GET `/api/projects/county/:county` — sorts by startTime, limits 3 |
| 5 | Health check endpoint | `server.js` (lines 129‑136) | `[x]` | GET `/health` — returns total project count |
| 6 | Add Gemini NLP integration | `server.js` (new endpoint) | `[→]` | Receive transcribed text + audio, extract county/start/end using Gemini |
| 7 | Eleven Labs audio → text pipeline | `server.js` / new `ai.js` | `[ ]` | Wire up Eleven Labs API key, feed audio to Gemini for intent extraction |
| 8 | GoDaddy domain / deployment config | `package.json`, `.env` | `[ ]` | Setup production URL, environment vars for deployed endpoints |
| 9 | Error handling & input sanitization | `server.js` | `[ ]` | Guard against malformed dates, missing fields, invalid county regex |

---

## FRONTEND TASKS

| # | Task | File(s) | Progress | Notes |
|---|------|---------|----------|-------|
| 1 | Chatbot/wizard intro page (page 1) | `public/` (create) | `[x]` | User types/speaks project name, start/end dates; stores input locally |
| 2 | Audio recording & Eleven Labs submit (page 2) | `public/` (create) | `[x]` | Record button → Eleven Labs API → returns text transcript |
| 3 | Gemini NLP processing (page 2→3) | `public/` (create) | `[x]` | Send transcript to Gemini, receive `{county, startTime, endTime}` |
| 4 | Conflict feedback from wizard (page 3) | `public/` (create) | `[ ]` | Compare extracted data with backend `/api/projects/conflicts`, show result |
| 5 | Florida county map (page 4) | `public/` (create) | `[ ]` | Interactive map — clicking a county calls `/api/projects/county/:county` |
| 6 | Display top 3 upcoming projects | `public/` (create) | `[ ] | | Render list under map with title, company, start/end dates |
| 7 | Responsive UI for construction companies & citizens | `public/` (create) | `[ ] | | Two tones: professional for firms, friendly for citizens |
| 8 | Frontend → backend API wiring | `public/` + `server.js` | `[ ] | | All GET/POST calls go through Express routes |

---

## INTEGRATION TASKS

| # | Task | File(s) | Progress | Notes |
|---|------|---------|----------|-------|
| 1 | Gemini text extraction prompt engineering | `server.js` / `ai.js` | `[ ] | Prompt: "Extract county, start date, end date from this construction project description..." |
| 2 | Eleven Labs audio → Gemini pipeline | `server.js` / `ai.js` | `[ ] | Record audio → Eleven Labs ASR → Gemini NLP → conflict check |
| 3 | Wizard pop-up with feedback | `public/` + `server.js` | `[ ] | After conflict check, show modal: "Your project overlaps X other projects in Orange County" |
| 4 | Persist user‑submitted projects to MongoDB | `server.js` (POST) | `[ ] | After wizard, call POST `/api/projects` with user data |
| 5 | Real‑time map refresh after new project | `public/` + `server.js` | `[ ] | After save, re‑fetch `/api/projects/county/:county` and update UI |

---

## DONE THIS SESSION

- [x] MongoDB Atlas connected and verified (`server.js` `startServer()`)
- [x] Seed data loaded (`seed.js` — 7 projects across Orange, Volusia, Leon counties)
- [x] Core CRUD & conflict endpoints implemented (`server.js`)
- [x] README already exists but is minimal — task tracker created above

---

## NEXT IMMEDIATE STEPS (choose one)

1. **Add Gemini Eleven Labs integration** — wire audio → Gemini → extracted fields → conflict check
2. **Build the chatbot wizard front‑end** — 3‑page flow starting with project input
3. **Add error handling & GoDaddy deployment config** — prepare for production

*Run `node seed.js` after setting your MONGO_URI in `.env` to populate sample projects.*