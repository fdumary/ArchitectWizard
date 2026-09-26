# ArchitectWizard

## Setup

```bash
cp .env.example .env   # then fill in MONGO_URI; ADC handles Gemini auth
npm install
node seed.js
npm start
```

## Environment variables

| Var | Required | Purpose |
|-----|----------|---------|
| `MONGO_URI` | yes | MongoDB Atlas connection string |
| `GOOGLE_CLOUD_PROJECT` | yes | GCP project for Vertex AI / Gemini ADC auth |
| `GEMINI_LOCATION` | no | Vertex AI region (default `global`) |
| `GEMINI_MODEL` | no | Gemini model id (default `gemini-3.8-flash`) |
| `PORT` | no | Server port (default 3000) |
| `DB_NAME` | no | MongoDB database name (default `hackathon`) |
| `COLLECTION_NAME` | no | MongoDB collection name (default `projects`) |
| `GEMINI_MODEL` | no | Gemini model id (default `gemini-2.0-flash`) |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/county/:county` | Top 3 upcoming projects per county |
| GET | `/api/projects/conflicts` | Temporal overlap check per county |
| GET | `/health` | Health check |
| POST | `/api/ai/extract` | Gemini NLP extraction from text/audio |
| POST | `/api/ai/check-conflicts` | Extract + conflict check in one call |

## AI module

`ai.js` exposes `extractProjectFields({ text, audioBase64, mimeType })` which calls Gemini with a JSON-structured system prompt and returns `{ title, county, startTime, endTime, description }`. Self-checks in `ai.test.js` (run with `npm run test:ai`).
