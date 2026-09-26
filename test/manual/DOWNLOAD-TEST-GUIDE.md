# Download Endpoint Testing Guide

This guide explains how to manually verify the download endpoint fix for missing file blobs.

## Problem Being Fixed

When file metadata exists in the database but the actual file blob is missing from disk (common after Render redeployments on ephemeral storage), the download endpoint was returning HTTP 500 instead of a clear 404.

## Expected Behavior After Fix

- **File present**: HTTP 200 with file content
- **File missing from disk**: HTTP 404 with clear error message explaining the situation
- **File not owned by user**: HTTP 404 with access denied message

## Quick Test (curl)

### 1. Upload a file

```bash
# Get auth token first
TOKEN=$(curl -s -X POST https://knowledge-ask-api-v2-fixed.onrender.com/api/authentication/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}' \
  | jq -r '.token')

# Upload file
FILE_ID=$(curl -s -X POST https://knowledge-ask-api-v2-fixed.onrender.com/api/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test/fixtures/smoke-test.txt" \
  | jq -r '.file.id')

echo "File ID: $FILE_ID"
```

### 2. Download successfully (file present)

```bash
curl -v -X GET "https://knowledge-ask-api-v2-fixed.onrender.com/api/files/$FILE_ID/download" \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded-file.txt

# Should see:
# < HTTP/2 200
# < content-type: text/plain
# < content-disposition: attachment; filename="smoke-test.txt"
```

### 3. Test missing file scenario

**Option A: After Render redeploy**
1. Trigger a redeploy on Render (or wait for the next auto-redeploy)
2. Try downloading the same file

```bash
curl -v -X GET "https://knowledge-ask-api-v2-fixed.onrender.com/api/files/$FILE_ID/download" \
  -H "Authorization: Bearer $TOKEN"

# Should see:
# < HTTP/2 404
# {"error":"File content is no longer available","details":"The file metadata exists but the content is missing from storage..."}
```

**Option B: Local testing**
1. Start API locally: `npm run dev`
2. Upload a file through the API
3. Note the file ID and storage path (check `uploads/` directory)
4. Manually delete the file from `uploads/`
5. Try downloading - should get 404

## Automated Test Script

Run the interactive test script:

```bash
# Local testing
node test/manual/test-download-missing-file.js

# Against staging
API_BASE=https://knowledge-ask-api-v2-fixed.onrender.com node test/manual/test-download-missing-file.js
```

## Integration Tests

Run the full test suite:

```bash
# Unit tests (no database required)
npm test

# API tests (requires PostgreSQL)
# 1. Start PostgreSQL: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres
# 2. Create database: docker exec <container> createdb -U postgres test_knowledge_ask_db
# 3. Apply schema: docker exec -i <container> psql -U postgres test_knowledge_ask_db < database/schema.sql
# 4. Run tests:
NODE_OPTIONS=--experimental-vm-modules jest test/api/api.test.js
```

## Test Coverage

The fix includes tests for:

1. **Happy path**: File exists on disk → 200 with content
2. **Missing blob**: Metadata exists but blob missing → 404 (not 500)
3. **Access control**: Other user tries to download → 404
4. **Filename escaping**: Special characters in filename handled correctly

## Code Changes

### Before (lines 354-391 in routes/files.js)
```javascript
// Query file metadata
const file = result.rows[0];

// Immediately try to read file
const fileStream = await fs.readFile(file.storage_path);
res.send(fileStream);

// If file missing, catch block returns generic 500
```

### After
```javascript
// Query file metadata
const file = result.rows[0];

// Check if file exists first
try {
  await fs.access(file.storage_path);
} catch (accessError) {
  // Return 404 with clear message
  return res.status(404).json({
    error: 'File content is no longer available',
    details: 'The file metadata exists but the content is missing from storage. This may occur after service redeployments on ephemeral disk.'
  });
}

// Now safe to read
const fileStream = await fs.readFile(file.storage_path);
res.send(fileStream);
```

## Verification Checklist

- [ ] File upload succeeds (201)
- [ ] Immediate download succeeds (200) with correct Content-Type and Content-Disposition headers
- [ ] Download after blob deletion returns 404 (not 500)
- [ ] Error message is clear and mentions ephemeral storage
- [ ] Metadata endpoint still returns 200 even when blob is missing
- [ ] Other users cannot download files they don't own (404)
- [ ] Unit tests pass: `npm test`
- [ ] API tests pass (if database available)

## Notes

- This fix addresses the P1 issue where downloads were failing with HTTP 500
- The fix preserves all security/auth checks
- Error messages are clear and help users understand why the file is unavailable
- The solution is a proper fix for ephemeral storage limitations (vs. opaque 500 errors)
- Future enhancement: migrate to persistent storage (S3) to eliminate the underlying issue
