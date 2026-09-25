# Execution Plan v1 — knowledge-ask-api + frontend
Status: `APPROVED` — Russel said PLAN APPROVED 2026-09-25 11:40 Africa/Johannesburg
Date: 2026-09-25
Rev: LLM lock — OpenAI staging default; Bedrock deferred; Gemini dropped

## 1. Approved product decisions (from Russel)
1. Canonical backend repo: GitHub `RusselTheCreator/knowledge-ask-api`
2. Cycle goals: (A) practice full PM lifecycle, (B) harden/fix backend gaps, (C) add frontend in a **separate** repo
3. Staging: Render (quick, cost-effective)
4. Real LLM: **OpenAI** staging default (cheap chat + embeddings); mock for CI; **Gemini dropped**; **Bedrock deferred** (bill-risk — revisit later with budgets)
5. Secrets: Render env only (or Grok secure secret form); never paste in chat

## 2. Requirements (this cycle)
### Backend (existing + harden)
- Keep: auth, file CRUD/download, RAG ask with citations, mock provider, Docker Compose, Swagger, unit/API/Playwright, pgvector
- **Providers:** `mock` (CI) + **`openai`** (staging default). Bedrock/Gemini not required this cycle (may leave inert stubs or remove from docs — prefer clear OpenAI + mock in README/env examples)
- Harden (audit-driven): CORS, rate limits, upload/IDOR, seed admin, health, CI `test:all`, docs under `docs/project/`
- Wire staging: `LLM_PROVIDER=openai` + `OPENAI_API_KEY` + cheap model IDs via Render env

### Frontend (new repo)
- `knowledge-ask-frontend` — React + Vite + TypeScript
- Journeys: register/login, upload, list/view/download/delete, ask + sources/history
- Deploy: Render Static Site → staging API CORS

### Out of scope unless separately approved
- Production deploy, mobile, multi-tenant billing
- AWS Bedrock / S3 migration this cycle

## 3. Architecture
```
[Browser: knowledge-ask-frontend]
        |
        v
[Render: knowledge-ask-api] ---- [Render Postgres + pgvector]
        |
        +---- OpenAI (chat + embeddings)   [staging default]
        +---- mock                         [CI/local]
```

## 4. Repositories
| Repo | Role |
|---|---|
| `RusselTheCreator/knowledge-ask-api` | Backend |
| `RusselTheCreator/knowledge-ask-frontend` | Frontend (create after approval) |

## 5–6. Env & contracts
- Local mock; staging OpenAI via Render
- Swagger/OpenAPI source of truth; CORS for frontend + localhost

## 7. Workstreams (unchanged shape)
W0 Integration (Grok) · W1 Docs · W2 Backend harden + OpenAI provider · W3 QA · W4 Security · W5 Frontend · W6 CI/CD+Render · W7 Acceptance (real OpenAI after “OpenAI configured on Render”)

## 8. Test & security
- `test:all` on mock; staging scripted demo with real OpenAI
- Frontend Playwright journey; independent QA/security

## 9. Deployment
- Staging Render only; no production

## 10. Credential needs (names only)
| Name | Where | When |
|---|---|---|
| `OPENAI_API_KEY` | Render API | Before real-LLM acceptance |
| `LLM_PROVIDER=openai` + model env | Render | Same |
| `DATABASE_URL` / `JWT_SECRET` | Render | Verify |
| `VITE_API_BASE_URL` | Frontend build | Public |

## 11. Cost risks
- OpenAI: set **usage limits / budget alerts** in OpenAI dashboard before connecting
- Use cheap models only (nano/mini-class chat + small embeddings) — exact IDs locked in harden PR from current OpenAI docs
- Render free/starter OK
- No AWS spend this cycle

## 12–13. Acceptance & DoD
- Staging ask with real OpenAI; frontend E2E; docs CURRENT; no secrets in chat/repo

## 14. Defaults if you approve as-is
| Item | Default |
|---|---|
| Frontend repo | `knowledge-ask-frontend` |
| Stack | React + Vite + TypeScript |
| LLM staging | OpenAI (cheap tier) |
| Bedrock / Gemini | Deferred / dropped |
| Frontend host | Render Static Site |
