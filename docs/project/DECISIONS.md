# Decisions — knowledge-ask-api

## Approved (this chat — awaiting full PLAN APPROVED for implementation)
| ID | Decision | Status | Notes |
|---|---|---|---|
| D1 | Primary forge: GitHub `RusselTheCreator/knowledge-ask-api` | LOCKED | Origin `ask-docs` not primary this cycle |
| D2 | CI/dev LLM: `mock` always | LOCKED | No keys required for tests |
| D3 | Staging host: Render | LOCKED | Quick / cost-effective |
| D4 | Cycle scope: (A) full lifecycle practice (B) harden/fix gaps (C) separate frontend repo | LOCKED | |
| D5 | Staging LLM default: **OpenAI** (cheap nano/mini-class chat + embeddings) | LOCKED | Switched from Bedrock 2026-09-25 — bill-risk preference |
| D6 | Bedrock / AWS | DEFERRED | Optional later cycle; see AWS-ACCESS.md as future guide only |
| D7 | Gemini | DROPPED this cycle | |
| D8 | Frontend repo: `knowledge-ask-frontend`, React+Vite+TS, Render Static | DEFAULT | Confirm on PLAN APPROVED |
| D9 | Secrets: Render env / Grok secret form only; never chat paste | LOCKED | |

## Rejected / deferred
| ID | Decision | Status |
|---|---|---|
| R1 | Gemini as staging default | DROPPED |
| R2 | Bedrock as staging default this cycle | DEFERRED (bill-risk) |
| R3 | S3 as primary document store | DEFERRED |
| R4 | Production deploy | OUT OF SCOPE this cycle |
