# ProcureFlow

AI-assisted, policy-driven procurement workflow for Corvo Engineering. The final decision is deterministic and policy-versioned; Gemini is an optional assistant for conversational extraction and policy amendment drafting.

## Run locally

Requirements: Node.js 22, npm, MongoDB Atlas or local MongoDB, and an optional Google AI Studio API key for Gemini chat features.

```powershell
npm install
npm --prefix server install
npm --prefix client install
Copy-Item server\.env.example server\.env
npm run dev
```

Configure `MONGODB_URI` in `server/.env`. The backend waits for MongoDB and refuses to accept requests until the connection succeeds. Configure `GEMINI_API_KEY` only in `server/.env` for Gemini features; set `GEMINI_MODEL=gemini-flash-lite-latest`.

Import the task kit through `POST /api/admin/import-master-data` and process a PR CSV through `POST /api/process-batch`. The company task kit is ignored by git and is never served as static content.

## API

Health: `GET /api/health`; auth: `/api/auth/*`; batch: `POST /api/process-batch`; decisions: `/api/decisions` and `/api/export/decisions`; policies: `/api/policies`; contracts: `/api/contracts`; suppliers: `/api/suppliers`; chat: `/api/chat`.

## Security

Set a strong `JWT_SECRET`, keep `GEMINI_API_KEY` and `MONGODB_URI` server-side, configure `CLIENT_ORIGIN`, and use HTTPS in deployment. Do not commit supplied datasets or credentials.
