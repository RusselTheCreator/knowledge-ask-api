# Testing Guide — knowledge-ask-api

## Overview

The project includes three types of tests:
1. **Unit Tests** - Fast, isolated tests with no external dependencies
2. **API Integration Tests** - Full API tests requiring PostgreSQL database
3. **E2E Tests** - Playwright tests requiring running server and database

## Running Tests

### Unit Tests (Recommended for CI)

```bash
npm test
```

**No dependencies required** - uses mock providers for LLM and embeddings.

Tests included:
- ✅ Validation utilities (email, password, registration, file upload)
- ✅ Embedding generation (mock provider)
- ✅ Document chunking and processing

**Status**: ✅ All passing with mock providers

### API Integration Tests

```bash
npm test  # Runs unit tests only by default
```

**Requirements**:
- PostgreSQL database running
- Valid `DATABASE_URL` in environment

API tests verify:
- Authentication (register, login, JWT)
- File operations (upload, list, download, delete)
- Q&A operations (ask, history)
- Authorization and access control
- Cross-user isolation

**Status**: ⚠️ Requires PostgreSQL database connection

To run with database:

```bash
# Start PostgreSQL (example with docker)
docker run -d \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=knowledge_ask_db \
  --name postgres-test \
  ankane/pgvector

# Run tests
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/knowledge_ask_db npm test

# Cleanup
docker stop postgres-test && docker rm postgres-test
```

### E2E Tests (Playwright)

```bash
npm run test:e2e
```

**Requirements**:
- Server running at configured URL
- PostgreSQL database connected
- Playwright browsers installed (`npx playwright install`)

Tests included:
- Swagger UI loads correctly
- Complete API flow (currently skipped - marked with `test.skip`)

**Status**: ⚠️ Requires running server + database. Main flow test intentionally skipped pending database setup.

### All Tests

```bash
npm run test:all
```

Runs unit tests + E2E tests.

## Test Configuration

### Environment Variables for Testing

```bash
# Use mock providers (no API keys needed)
LLM_PROVIDER=mock
EMBEDDING_PROVIDER=mock

# Test database (optional, for API tests)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/test_knowledge_ask_db

# Or use individual params
DB_HOST=localhost
DB_PORT=5432
DB_NAME=test_knowledge_ask_db
DB_USER=postgres
DB_PASSWORD=postgres
```

### CI/CD Testing

For CI pipelines (GitHub Actions, etc.), run **unit tests only**:

```yaml
- name: Run tests
  run: npm test
  env:
    LLM_PROVIDER: mock
    EMBEDDING_PROVIDER: mock
```

Unit tests are sufficient for validating:
- Core business logic
- Validation rules
- Mock provider functionality
- Document processing

API and E2E tests should run in a staging environment with a real database.

## Mock vs Real Providers

### Mock Providers (Default for Tests)

```javascript
// Automatically used when:
LLM_PROVIDER=mock
EMBEDDING_PROVIDER=mock
```

**Characteristics**:
- Deterministic outputs (same input = same output)
- No API keys required
- No external network calls
- Fast execution
- Perfect for CI/CD

**Limitations**:
- Answers are templated, not AI-generated
- Embeddings are hash-based, not semantic

### Real Providers (Manual Testing)

To test with real OpenAI:

```bash
LLM_PROVIDER=openai \
EMBEDDING_PROVIDER=openai \
OPENAI_API_KEY=sk-your-key \
npm test
```

**Note**: Real provider tests will incur API costs and are not recommended for automated testing.

## Test Coverage

| Area | Coverage | Notes |
|---|---|---|
| Validation | ✅ Full | Email, password, registration, file upload |
| Embeddings | ✅ Full | Mock provider tested |
| Document Processing | ✅ Full | Chunking, text extraction |
| Authentication | ⚠️ Requires DB | Register, login, JWT |
| File Operations | ⚠️ Requires DB | Upload, list, download, delete |
| Q&A (Ask) | ⚠️ Requires DB | Question answering, sources |
| Authorization | ⚠️ Requires DB | Role-based, cross-user isolation |
| Swagger UI | ✅ E2E | Playwright loads UI |
| Full API Flow | ⏸️ Skipped | End-to-end journey test |

## Known Test Limitations

### Skipped Tests

1. **E2E API Flow Test** (`test/e2e/api.spec.js`)
   - Reason: Requires database setup
   - Status: `test.skip` - intentionally skipped
   - Recommendation: Run manually in staging environment

### Database-Dependent Tests

API integration tests require PostgreSQL with pgvector extension. Options for CI:

1. **Skip API tests in CI** - Run unit tests only (current approach)
2. **Use test containers** - Spin up PostgreSQL in CI (requires Docker)
3. **Use cloud test database** - Provision Render/Heroku test DB (costs)

## Troubleshooting

### Tests fail with "Cannot find module"

```bash
# Reinstall dependencies
npm install
```

### Tests fail with database connection error

```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Verify PostgreSQL is running
psql $DATABASE_URL -c "SELECT 1"
```

### Playwright tests fail with "Browser not found"

```bash
# Install Playwright browsers
npx playwright install
```

### Tests fail with "Password must be at least 8 characters"

Passwords in tests must meet complexity requirements:
- Minimum 8 characters
- Contains uppercase letter
- Contains lowercase letter
- Contains digit
- Contains special character

Example: `Password123!`

## Recommendations

### For Local Development
- Run `npm test` frequently (fast, no dependencies)
- Run API tests occasionally with local PostgreSQL
- Run E2E tests before major releases

### For CI/CD
- Always run `npm test` (unit tests)
- Consider database-dependent tests in separate staging job
- Use mock providers in all CI environments

### For Staging/Pre-Production
- Run full `npm run test:all` with real database
- Optionally test with real OpenAI provider (monitor costs)
- Verify Swagger UI accessibility

## Future Improvements

1. **Test Database Automation**: Add docker-compose for test database
2. **Improve E2E Coverage**: Unskip API flow test with proper setup
3. **Add Performance Tests**: Benchmark RAG query times
4. **Add Security Tests**: Automated OWASP checks
5. **Add Load Tests**: Concurrent user simulation

---

**Last Updated**: 2026-09-25  
**Test Framework**: Jest + Playwright  
**Test Command**: `npm test` (unit only, recommended for CI)
