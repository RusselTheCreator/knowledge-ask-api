# Project Brief — knowledge-ask-api

Status: `APPROVED — IMPLEMENTATION IN PROGRESS`  
Last updated: 2026-09-25

## Project
Practice / product API: **Knowledge Ask API** — users upload documents, then ask questions grounded in those files (RAG), with view/download and JWT auth.

## Problem / users
Developers and end users need a documented, testable API (styled like `usercrud-api`) for document Q&A without requiring LLM keys in development. Russel is Product Owner.

## Outcomes and core journeys
1. Register / login → receive JWT
2. Upload a supported file → file is listed and downloadable
3. Ask a question → receive answer + source citations scoped to own files
4. Admin metrics available
5. Mock LLM works without keys; OpenAI for staging via env
6. Tests: unit, API, Playwright; containerized Postgres (pgvector)

## Existing repositories
- **Primary (confirmed readable):** https://github.com/RusselTheCreator/knowledge-ask-api
- **Origin (related):** https://cursor.com/codebase/russel-sauer/ask-docs
- Style reference: https://github.com/RusselTheCreator/usercrud-api
- Frontend companion (existing, out of scope unless approved): `usercrud_frontend_react`

## Preferred stack / constraints
- Node.js + Express + PostgreSQL + pgvector
- Docker Compose for local DB
- Verbose comments + Swagger like usercrud-api
- Staging LLM: OpenAI (cheap tier); mock for CI; Gemini dropped; Bedrock deferred (bill-risk)
- Non-production first; no production deploy without explicit approval

## Data, integrations, environments, and cost limits
- Local: Docker Compose + mock providers
- Staging (observed in DEPLOYMENT.md): Render — https://knowledge-ask-api.onrender.com (status TBD this session)
- Secrets: never in chat; use Render/env/secret store when real LLM or DB credentials needed
- Cost: prefer mock for demos; pause before paid staging/LLM spend beyond approved plan

## Testing and acceptance
- `npm run test:all` green with mock providers
- Scripted API demo of register → upload → ask → download
- Independent QA/security verification by non-implementer agent after approval
- Playwright where supported (Swagger + API request context)

## Access needs (names only)
- GitHub read/write via Cursor Cloud Agents (confirmed connected)
- Origin available
- Docker on Cloud Agent VMs (typical)
- Staging: `OPENAI_API_KEY` on Render; never chat paste; set OpenAI usage limits first
- Optional: Render dashboard access for staging verification

## Planning status
`APPROVED` — Backend hardening and documentation phase in progress. Canonical repository: GitHub `RusselTheCreator/knowledge-ask-api`.
