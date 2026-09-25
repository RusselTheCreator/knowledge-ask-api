# Acceptance Criteria — knowledge-ask-api Backend Harden + Docs

Status: `IMPLEMENTATION IN PROGRESS`  
Version: 1.0.0  
Last updated: 2026-09-25

## Overview

This document defines the acceptance criteria for the backend hardening and documentation phase of the knowledge-ask-api project.

## Scope

Backend API hardening and documentation only. Frontend implementation is out of scope for this phase.

---

## 1. Documentation

### 1.1 Project Documentation Structure
- [ ] Documentation organized under `docs/project/` directory
- [ ] All planning documents present and updated:
  - [ ] `EXECUTION-PLAN.md` (status: APPROVED)
  - [ ] `PROJECT-BRIEF.md` (status: APPROVED)
  - [ ] `CURRENT-STATE.md` (reflects implementation status)
  - [ ] `DECISIONS.md` (LLM choices documented)
  - [ ] `DOCUMENTATION-INDEX.md` (navigation guide)
  - [ ] `SESSION-HANDOFF.md` (context for future work)
  - [ ] `AWS-ACCESS.md` (marked DEFERRED with clear note)

### 1.2 API Documentation
- [ ] `API-CONTRACT.md` created with:
  - [ ] All endpoints documented (auth, files, ask)
  - [ ] Request/response examples in JSON
  - [ ] Error codes and messages
  - [ ] Authentication requirements
  - [ ] Rate limits documented
  - [ ] Environment variables listed
- [ ] `ACCEPTANCE-CRITERIA.md` (this document) present
- [ ] Swagger UI accessible at `/api/docs`
- [ ] All route JSDoc comments complete and accurate

### 1.3 README Updates
- [ ] README focuses on OpenAI + mock providers
- [ ] Gemini de-emphasized (optional or removed from main setup flow)
- [ ] Bedrock not mentioned in primary documentation
- [ ] Clear instructions for:
  - [ ] Local development with mock provider
  - [ ] Staging setup with OpenAI
  - [ ] Running tests without API keys
- [ ] Environment variable documentation current
- [ ] Render deployment checklist included

---

## 2. Security Hardening

### 2.1 CORS Configuration
- [ ] CORS configurable via `CORS_ORIGINS` environment variable
- [ ] Supports comma-separated list of allowed origins
- [ ] Default allows localhost development origins
- [ ] Staging configured for frontend URL + localhost Vite default (5173)
- [ ] Documented in README and API-CONTRACT.md

### 2.2 Rate Limiting
- [ ] Rate limiting middleware implemented
- [ ] Applied to authentication endpoints (`POST /register`, `POST /login`)
- [ ] Applied to file upload endpoint (`POST /api/files`)
- [ ] Applied to ask endpoint (`POST /api/ask`)
- [ ] Configurable via environment variables:
  - [ ] `RATE_LIMIT_WINDOW_MS` (window duration)
  - [ ] `RATE_LIMIT_MAX_REQUESTS` (general limit)
  - [ ] `RATE_LIMIT_AUTH_MAX` (auth-specific limit)
  - [ ] `RATE_LIMIT_UPLOAD_MAX` (upload-specific limit)
  - [ ] `RATE_LIMIT_ASK_MAX` (ask-specific limit)
- [ ] Rate limit headers in responses (X-RateLimit-*)
- [ ] Appropriate error messages when limits exceeded (429 status)

### 2.3 Upload Validation
- [ ] File size validation enforced (`MAX_FILE_SIZE_MB`)
- [ ] MIME type validation (PDF, TXT, MD, DOCX, CSV only)
- [ ] File extension validation matches MIME type
- [ ] Malformed uploads rejected with clear error messages
- [ ] Uploaded files cleaned up on validation failure
- [ ] Directory traversal attempts blocked
- [ ] Validation documented in API-CONTRACT.md

### 2.4 IDOR Protection
- [ ] All file operations verify ownership (user_id check)
- [ ] All ask operations verify ownership
- [ ] Admin role can override with proper authorization
- [ ] File download includes ownership check
- [ ] File metadata access includes ownership check
- [ ] File deletion includes ownership check
- [ ] Ask history scoped to requesting user
- [ ] Ask detail retrieval includes ownership check
- [ ] Tests cover cross-user access attempts

### 2.5 Health Endpoint
- [ ] `/health` endpoint returns JSON response
- [ ] Includes timestamp
- [ ] Optionally checks database connectivity
- [ ] Returns appropriate status codes:
  - [ ] 200 OK when healthy
  - [ ] 503 Service Unavailable when degraded
- [ ] Suitable for Render health checks

### 2.6 Default Admin Seed
- [ ] Default admin creation disabled by default OR
- [ ] Requires explicit environment variable to enable (`ENABLE_DEFAULT_ADMIN=true`)
- [ ] Documented security risk if enabled
- [ ] Warning logged when default admin is created
- [ ] Recommendation to change password documented
- [ ] Schema.sql updated to reflect security posture

### 2.7 Secret Hygiene
- [ ] No API keys, secrets, or credentials in code
- [ ] No secrets in `.env` or `.env.example`
- [ ] `.env.example` shows placeholder values only
- [ ] `.gitignore` includes `.env` and sensitive files
- [ ] Dependency audit findings documented
- [ ] Security recommendations in documentation

---

## 3. LLM Provider Configuration

### 3.1 Mock Provider (Default)
- [ ] Mock provider works without API keys
- [ ] Default for `LLM_PROVIDER` and `EMBEDDING_PROVIDER`
- [ ] All tests run with mock provider
- [ ] Mock embeddings are deterministic and testable
- [ ] Mock answers reference provided context

### 3.2 OpenAI Provider
- [ ] OpenAI works for both LLM and embeddings
- [ ] Cheap models configured as default:
  - [ ] Chat: `gpt-4o-mini` or cheaper equivalent
  - [ ] Embeddings: `text-embedding-3-small`
- [ ] Model IDs configurable via environment:
  - [ ] `OPENAI_CHAT_MODEL` (optional override)
  - [ ] `OPENAI_EMBEDDING_MODEL` (optional override)
- [ ] Clear error messages when API key missing
- [ ] API errors handled gracefully
- [ ] Documented in README and .env.example

### 3.3 Provider Documentation
- [ ] `.env.example` updated:
  - [ ] Mock as default (uncommented)
  - [ ] OpenAI configuration clearly marked
  - [ ] Gemini commented out or removed from required path
  - [ ] Bedrock not included
- [ ] README updated:
  - [ ] Mock provider instructions prominent
  - [ ] OpenAI setup instructions clear
  - [ ] Gemini de-emphasized (optional section or removed)
  - [ ] Bedrock not mentioned in main setup
- [ ] Both `LLM_PROVIDER` and `EMBEDDING_PROVIDER` documented as separate settings

---

## 4. Testing

### 4.1 Test Suite Integrity
- [ ] `npm test` passes (unit tests with mock)
- [ ] `npm run test:e2e` passes (Playwright with mock)
- [ ] `npm run test:all` passes completely
- [ ] No skipped tests without justification
- [ ] Test coverage maintained or improved
- [ ] Tests run in CI without API keys

### 4.2 Test Coverage
- [ ] CORS configuration tested
- [ ] Rate limiting tested (within limits and exceeded)
- [ ] Upload validation tested (valid and invalid files)
- [ ] IDOR protection tested (cross-user access attempts)
- [ ] Health endpoint tested
- [ ] Mock provider tested (LLM and embeddings)
- [ ] OpenAI provider integration testable (with key)

---

## 5. Deployment Readiness

### 5.1 Environment Configuration
- [ ] `.env.example` complete and accurate
- [ ] All required environment variables documented
- [ ] Clear distinction between dev and prod settings
- [ ] Render-specific instructions documented

### 5.2 Render Deployment Checklist
- [ ] Environment variables to set on Render:
  - [ ] `NODE_ENV=production`
  - [ ] `DATABASE_URL` (Render Postgres URL)
  - [ ] `JWT_SECRET` (strong random value)
  - [ ] `LLM_PROVIDER=openai`
  - [ ] `EMBEDDING_PROVIDER=openai`
  - [ ] `OPENAI_API_KEY` (from OpenAI dashboard)
  - [ ] `CORS_ORIGINS` (frontend staging + localhost:5173)
  - [ ] `MAX_FILE_SIZE_MB` (appropriate for hosting plan)
  - [ ] Rate limit settings (optional overrides)
- [ ] Database migrations handled
- [ ] Health check endpoint configured
- [ ] Build command correct (`npm install && npm start`)

### 5.3 OpenAI Configuration
- [ ] OpenAI API key obtained (not in repo/docs)
- [ ] Usage limits set in OpenAI dashboard
- [ ] Budget alerts configured
- [ ] Cheap models confirmed in code defaults
- [ ] Free tier limits understood and documented

---

## 6. Pull Request Requirements

### 6.1 PR Content
- [ ] Clear title describing the work
- [ ] Comprehensive summary of changes:
  - [ ] Documentation updates
  - [ ] Security hardening features
  - [ ] LLM provider changes
  - [ ] Test updates
- [ ] Render environment checklist included in PR body
- [ ] Breaking changes noted (if any)
- [ ] Migration instructions (if any)

### 6.2 PR Quality
- [ ] All tests passing in CI
- [ ] No linting errors
- [ ] Code follows project style (verbose comments)
- [ ] Commit messages descriptive
- [ ] Logical commit structure (not one giant commit)

### 6.3 Evidence
- [ ] Test execution output included or linked
- [ ] Manual testing evidence (if applicable)
- [ ] Screenshots or logs showing:
  - [ ] Tests passing with mock
  - [ ] Health endpoint response
  - [ ] Swagger UI loading
  - [ ] Rate limiting in action (optional)

---

## 7. Out of Scope (Deferred)

The following are explicitly **NOT** required for this phase:

- [ ] Frontend implementation (separate repo/phase)
- [ ] Production deployment
- [ ] AWS Bedrock integration
- [ ] S3 file storage migration
- [ ] Gemini as primary provider
- [ ] Manual testing with real OpenAI (staging verification follows later)
- [ ] Performance benchmarking
- [ ] Load testing

---

## Acceptance Sign-Off

This implementation is considered complete when:

1. All items in sections 1-6 are checked
2. PR is open with passing CI
3. Documentation reflects actual implementation
4. Tests are green with mock provider
5. Render deployment checklist is clear and actionable

**Approval Authority:** Product Owner (Russel)

**Implementation Agent:** Cloud Agent (Backend Harden + Docs)

**Review Process:** PR review + manual staging verification (OpenAI) by Product Owner or designated reviewer
