# Current Project State — knowledge-ask-api

- Status: `IMPLEMENTATION — BACKEND HARDEN + DOCS`
- Last updated: 2026-09-25
- Plan approval: `APPROVED`
- Implementation agent: Cloud Agent (Backend Harden + Docs)

## Completed
- Initial API built (auth, files, ask, mock LLM, Docker Compose, Swagger)
- Primary repository: `RusselTheCreator/knowledge-ask-api` on GitHub
- Tests passing (unit + API + Playwright with mock providers)
- Deployment scaffolding: Dockerfile, render.yaml, fly.toml, vercel.json
- Project documentation extracted to `docs/project/`

## In progress (this implementation)
- Backend hardening:
  - CORS configuration via environment variables
  - Rate limiting on auth, upload, ask endpoints
  - Upload validation tightening
  - IDOR protection audit
  - Health endpoint enhancement
  - Default admin seed security fix
  - Secret hygiene review
- LLM provider updates:
  - OpenAI as primary real provider (cheap models for Free tier)
  - Mock as default for local/CI
  - Gemini de-emphasized from documentation
  - Bedrock deferred (AWS-ACCESS.md marked as future reference)
- Documentation:
  - API contract specification
  - Acceptance criteria
  - Environment configuration guides
  - Updated README focusing on OpenAI + mock

## Staging environment (Render)
- URL: https://knowledge-ask-api.onrender.com
- Current LLM provider: OpenAI (configured by Russel)
- Required env variables:
  - `LLM_PROVIDER=openai`
  - `EMBEDDING_PROVIDER=openai`
  - `OPENAI_API_KEY` (secure, not in repo)
  - `CORS_ORIGINS` (to be configured for frontend)
  - `DATABASE_URL` (Render Postgres)
  - `JWT_SECRET` (secure)

## Next steps
- Complete hardening implementation
- Update all documentation to match implementation
- Ensure all tests pass with mock provider
- Open PR with Render environment checklist
- Frontend implementation (separate repo, pending)
