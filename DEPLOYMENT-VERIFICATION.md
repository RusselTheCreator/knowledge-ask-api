# Deployment Verification Guide

## Critical Fix: Auth Endpoints HTTP 500

**PR**: https://github.com/RusselTheCreator/knowledge-ask-api/pull/3  
**Branch**: `cursor/fix-schema-migration-auth-500-a8cf`

---

## Root Cause Summary

The security hardening PR (4df21ec) changed database schema column names:
- `password_hash` → `password`
- Added `name` column
- `upload_path` → `storage_path`

The Render production database still had the OLD schema, causing INSERT queries to fail with HTTP 500 errors.

---

## Fix Applied

**Added**: `database/migrations.sql` - Idempotent schema migration script  
**Updated**: `database/init.js` - Runs migrations on startup for existing databases

The migration automatically:
1. Renames `password_hash` → `password`
2. Adds `name` column (backfills existing users with `'User' + id`)
3. Normalizes role values (user/admin → User/Admin)
4. Updates files table columns

---

## Deployment Steps

### 1. Merge PR #3
```bash
gh pr merge 3 --squash
# OR merge via GitHub UI
```

### 2. Deploy to Render

**Option A: Auto-deploy (if enabled)**
- Render will automatically deploy after merge to `main`
- Watch: https://dashboard.render.com/web/srv-daqh3f17lnhs73d04ieg

**Option B: Manual deploy via Dashboard**
- Go to: https://dashboard.render.com/web/srv-daqh3f17lnhs73d04ieg
- Click "Manual Deploy" → "Deploy latest commit"

**Option C: Trigger via API (if you have RENDER_API_KEY)**
```bash
curl -X POST "https://api.render.com/v1/services/srv-daqh3f17lnhs73d04ieg/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}'
```

### 3. Monitor Deployment Logs

Watch for these log messages indicating successful migration:
```
Checking database schema...
✓ Database schema already exists
Checking for pending migrations...
NOTICE:  Renamed password_hash to password in users table
NOTICE:  Added name column to users table
NOTICE:  Updated role values in users table
✓ Database migrations applied successfully
```

---

## Post-Deploy Verification

### Test 1: Health Check (Should already work)
```bash
curl https://knowledge-ask-api.onrender.com/health
# Expected: {"status":"ok", ...}
```

### Test 2: Register New User (Currently returns 500, should return 201)
```bash
curl -X POST https://knowledge-ask-api.onrender.com/api/authentication/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test-'$(date +%s)'@example.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response (201)**:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "name": "Test User",
    "email": "test-xxxxx@example.com",
    "role": "User",
    "createdAt": "2026-09-25T..."
  }
}
```

**Current Broken Response (500)**:
```json
{
  "error": "Failed to register user. Please try again."
}
```

### Test 3: Login with Bad Credentials (Currently returns 500, should return 401)
```bash
curl -X POST https://knowledge-ask-api.onrender.com/api/authentication/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "fake@example.com",
    "password": "wrongpassword"
  }'
```

**Expected Response (401)**:
```json
{
  "error": "Invalid email or password"
}
```

**Current Broken Response (500)**:
```json
{
  "error": "Failed to login. Please try again."
}
```

### Test 4: Login with Valid Credentials
First register a user (Test 2), then:
```bash
curl -X POST https://knowledge-ask-api.onrender.com/api/authentication/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-xxxxx@example.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response (200)**:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "Test User",
    "email": "test-xxxxx@example.com",
    "role": "User"
  }
}
```

---

## Rollback Plan (If Needed)

If migration fails, rollback is simple:

1. **Revert the PR**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Or deploy previous commit**:
   - In Render Dashboard, select previous deploy
   - Click "Redeploy"

**Note**: The migration is idempotent and checks before altering, so it's safe to retry.

---

## Success Criteria

✅ Register endpoint returns `201` with user object (not 500)  
✅ Login with bad creds returns `401` (not 500)  
✅ Login with good creds returns `200` with JWT token  
✅ No startup errors in Render logs  
✅ Migration messages appear in logs

---

## Files Modified

- ✨ `database/migrations.sql` - New migration script
- 🔧 `database/init.js` - Run migrations on startup
- 📝 `DEPLOYMENT-VERIFICATION.md` - This file

---

## Contact

If issues persist after deployment, check:
1. Render deployment logs for migration errors
2. PostgreSQL column names: `\d users` in psql
3. Environment variables: DATABASE_URL, JWT_SECRET

**Migration is idempotent** - safe to redeploy multiple times.
