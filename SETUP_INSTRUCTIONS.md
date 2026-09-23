# Quick Setup Guide for knowledge-ask-api

## Prerequisites
- Node.js 18+
- PostgreSQL 16+ (with pgvector extension)
  - OR Docker/Docker Compose for easy PostgreSQL setup

## Fast Start (3 commands)

### Option 1: With Docker Compose (Recommended)
```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL with pgvector
docker-compose up -d

# 3. Start the API server
npm start
```

Server will be available at http://localhost:6544
API docs at http://localhost:6544/api/docs

### Option 2: With Existing PostgreSQL
```bash
# 1. Install dependencies
npm install

# 2. Configure database in .env
cp .env.example .env
# Edit .env with your PostgreSQL connection details

# 3. Initialize database schema
psql -U postgres -d your_database -f database/schema.sql

# 4. Start the API server
npm start
```

## Running Tests

```bash
# All tests (unit + API + E2E)
npm run test:all

# Just unit and API tests
npm test

# Just Playwright E2E tests
npm run test:e2e
```

**All tests run with mock LLM/embeddings - NO API KEYS NEEDED!**

## Using Real LLM Providers

### With Google Gemini (Recommended)
```bash
# Add to .env:
LLM_PROVIDER=gemini
EMBEDDING_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
```

### With OpenAI
```bash
# Add to .env:
LLM_PROVIDER=openai
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=your-key-here
```

## Try It Out

1. Open http://localhost:6544/api/docs in your browser
2. Register a user via POST /api/authentication/register
3. Login and copy the JWT token
4. Click "Authorize" button in Swagger UI and paste token
5. Upload a document via POST /api/files
6. Ask a question via POST /api/ask

## Need Help?
See the full README.md for detailed documentation.
