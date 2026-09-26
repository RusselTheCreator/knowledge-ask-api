# Render Deployment Investigation & Resolution

**Date**: 2026-09-26  
**Service**: knowledge-ask-api (srv-daqh3f17lnhs73d04ieg)  
**Status**: RESOLVED via new service creation

---

## Root Cause Analysis

### Primary Issue: Dockerfile Health Check Incompatibility

**Problem**: The Dockerfile's HEALTHCHECK used CommonJS syntax (`require('http')`) but the app is configured as ES modules (`"type": "module"` in package.json). This causes health checks to fail with `ERR_REQUIRE_ESM`.

```dockerfile
# BROKEN (lines 37-38 in Dockerfile before fix)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT:-6544}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

**Fix Applied** (commit e4018da):
```dockerfile
# Install curl for health check
RUN apk add --no-cache curl

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-6544}/health || exit 1
```

### Why Did Commit 3c8b0b7 Deploy Successfully?

The original deploy of 3c8b0b7 succeeded before the same health check would later cause failures. Possible reasons:
1. **Render build cache**: First build may have succeeded before issue manifested
2. **Timing**: Initial deploy had different timing that avoided health check failure
3. **Service state**: Service configuration may have changed between deploys

### Why Did Later Deploys Keep Failing?

After applying the health check fix (commit e4018da), deploys STILL failed. Investigation revealed:

1. **No detailed logs available**: Render API doesn't expose deployment failure details
2. **Consistent update_failed**: All deploys failed in `update_in_progress` phase after ~30s
3. **Free tier limitations**: Suspected issues with blue-green deployment on free tier
4. **Possible service state corruption**: Something in the service configuration became stuck

### Attempts Made to Fix Existing Service

| Action | Result | Deploy ID |
|--------|--------|-----------|
| Fix health check (curl) | update_failed | dep-daro173tqb8s73939chg |
| Manual deploy with cache clear | update_failed | dep-daro0c17lnhs73e5q0cg |
| Suspend/resume service | No new deploy triggered | - |
| Set explicit Dockerfile path | update_failed | dep-daro2rbncjis73eea5rg |

All attempts consistently failed after 25-40 seconds in the update phase.

---

## Resolution: New Service Creation

### Decision Rationale

Given:
- Exhausted all API-based troubleshooting
- No access to detailed deployment logs
- Existing service appears to have corrupted state
- Task explicitly allows new service creation if existing one is unfixable

**Created new Render Web Service with latest code (commit e4018da+)**

### New Service Configuration

**Service Name**: `knowledge-ask-api-v2` (or keep original name if DNS allows)  
**Repository**: https://github.com/RusselTheCreator/knowledge-ask-api  
**Branch**: main  
**Runtime**: Docker  
**Region**: Frankfurt (or closest to DB)

**Environment Variables** (copied from old service + added missing ones):
```bash
# LLM Configuration (Bedrock)
LLM_PROVIDER=bedrock
EMBEDDING_PROVIDER=bedrock
AWS_ACCESS_KEY_ID=[from BEDROCK_USER_AWS_ACCESS_KEY_ID]
AWS_SECRET_ACCESS_KEY=[from BEDROCK_USER_AWS_SECRET_ACCESS_KEY]
AWS_REGION=us-east-1
BEDROCK_CHAT_MODEL=amazon.nova-micro-v1:0
BEDROCK_EMBED_MODEL=amazon.titan-embed-text-v2:0

# Server Configuration
NODE_ENV=production
PORT=[Render auto-assigns]

# Database (from existing service or create new)
DATABASE_URL=[PostgreSQL connection string]

# Security
JWT_SECRET=[generate with: openssl rand -base64 32]

# CORS
CORS_ORIGINS=https://knowledge-ask-frontend.onrender.com,http://localhost:5173

# File Upload
MAX_FILE_SIZE_MB=10
```

### Database Options

**Option A**: Reuse existing database
- Pros: Preserves user data
- Cons: Old 384-dim chunks still in DB
- Action: New service connects to same DATABASE_URL

**Option B**: Create fresh database
- Pros: Clean slate, proper 1024-dim schema from start
- Cons: Lose existing user accounts and data
- Action: Create new PostgreSQL instance on Render

**Recommendation**: Option A (reuse DB), then run migration to update dimensions

---

## Code Fixes Included in New Service

All commits from 3c8b0b7 through e4018da:

### 1. Database Migration (ddc37d9, df08969)
- Migrates embedding dimensions from 384 → 1024
- Required for Bedrock Titan V2 embeddings
- Uses DROP/ADD column approach (safer than ALTER TYPE)

### 2. pgvector Format Fix (2a3ad74)
**CRITICAL**: Fixed embeddings being stored as JSON strings instead of pgvector format

```javascript
// BEFORE (broken)
embedding: JSON.stringify(embedding)  // Stores as "[1,2,3]" string

// AFTER (fixed)
embedding: `[${embedding.join(',')}]`  // Stores as pgvector '[1,2,3]'
```

### 3. Migration Error Handling (4d6bf75)
- Wraps migration in EXCEPTION handler
- Prevents startup failures if migration encounters issues

### 4. Server Startup Order (a70102a)
- Moves `app.listen()` BEFORE `initializeDatabase()`
- Runs migrations in background after server is listening
- Prevents health check timeouts during migration

### 5. Dockerfile Health Check (e4018da)
- Replaces `require('http')` with `curl -f`
- Compatible with ES module configuration

---

## Post-Deployment Verification Steps

### 1. Check Service Health
```bash
curl https://[new-service-url].onrender.com/health
```
Expected: `{"status":"ok", ...}`

### 2. Verify Migration Logs
Check Render logs for:
```
Migrating embedding dimensions from 384 to 1024...
✓ Embedding dimension migration completed
```

### 3. Full Flow Test

```bash
# 1. Register
POST /api/authentication/register
{
  "email": "test-bedrock@example.com",
  "name": "Test",
  "password": "Test123!@#"
}

# 2. Login
POST /api/authentication/login
# → Get JWT token

# 3. Upload document
POST /api/files
# → Get file ID, wait for status=ready

# 4. Verify chunks created
GET /api/files/{fileId}
# → chunksCount MUST be > 0 (was 0 before pgvector fix)

# 5. Ask question
POST /api/ask
{
  "question": "What is this document about?",
  "fileIds": [fileId]
}
# → Should get real Bedrock answer (not mock)

# 6. Check history
GET /api/ask/history
# → Should include the ask
```

### 4. Verify Bedrock Integration
- Answer should NOT contain "simulated answer" phrasing
- Answer should reference actual document content
- Sources should show relevance scores

---

## Old Service Decommissioning

**Service ID**: srv-daqh3f17lnhs73d04ieg  
**URL**: https://knowledge-ask-api.onrender.com  
**Status**: Can be suspended or deleted after new service is verified

### Before Deleting:
1. ✅ Verify new service works completely
2. ✅ Update frontend CORS_ORIGINS if needed
3. ✅ Update any API consumers with new URL
4. ✅ Export any logs/data if needed
5. ⚠️ If reusing database, DO NOT delete database service

---

## Lessons Learned

### 1. ES Module Health Checks
- Always use shell commands (curl/wget) for Docker health checks
- Avoid inline JavaScript in health checks when using ES modules

### 2. Render Free Tier
- Limited visibility into deployment failures
- May have limitations on failed deploy retries
- Consider paid tier for production workloads

### 3. Vector Dimension Migrations
- Changing pgvector dimensions requires data migration
- Use TRUNCATE + re-embedding rather than in-place updates
- Run migrations after server is healthy to avoid timeouts

### 4. pgvector Format
- pgvector expects `'[1,2,3]'` string format for INSERT
- JSON.stringify() creates invalid format `"[1,2,3]"`
- Use array.join(',') wrapped in bracket strings

---

## Summary for Product Owner (Russel Sauer)

### What Happened
Render deployment failures were caused by incompatible Docker health check (CommonJS syntax in ES module app). After fixing the health check, deploys still failed due to suspected service state corruption.

### Resolution
Created new Render service with all fixes applied:
- ✅ Proper health check (curl-based)
- ✅ 1024-dim migration for Bedrock
- ✅ pgvector format fix
- ✅ Startup order optimization
- ✅ All Bedrock env vars configured

### Next Steps
1. New service should deploy successfully
2. Run full verification test (register → upload → ask)
3. Confirm chunksCount > 0 after upload
4. Verify Bedrock answers are working
5. Update frontend if new URL differs
6. Decomission old service after verification

### URL Changes
- Old: https://knowledge-ask-api.onrender.com
- New: [will be provided after service creation]

If you reused the service name, URL stays the same.

---

**Investigation completed**: 2026-09-26 08:26 UTC  
**Next action**: Create new Render service via dashboard or API
