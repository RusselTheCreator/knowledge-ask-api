# Knowledge Ask API

A complete RAG-powered (Retrieval-Augmented Generation) knowledge base API built with Node.js, Express, and PostgreSQL. Upload documents, extract and index their content, and ask questions to get AI-generated answers with source citations.

## 🚀 Features

- **User Authentication**: JWT-based registration and login with role-based access control (User/Admin)
- **Document Upload**: Support for PDF, TXT, MD, DOCX, and CSV files
- **Intelligent Text Processing**: Automatic text extraction, chunking, and embedding generation
- **RAG-Based Q&A**: Ask questions about your documents and get answers with source citations
- **Vector Similarity Search**: Uses pgvector extension for efficient semantic search
- **Mock Provider Support**: Works out-of-the-box without API keys (uses deterministic mock LLM/embeddings)
- **Real LLM Support**: Switchable to OpenAI for production use (cost-effective models)
- **Comprehensive API Documentation**: Interactive Swagger UI at `/api/docs`
- **Complete Test Coverage**: Unit tests, API tests, and E2E Playwright tests

## 📋 Prerequisites

- Node.js 18+ (for ES modules support)
- Docker & Docker Compose (for PostgreSQL with pgvector)
- npm or yarn

## 🛠️ Installation & Setup

### 1. Clone and Install Dependencies

```bash
# Install dependencies
npm install
```

### 2. Configure Environment Variables

Copy the example environment file and customize if needed:

```bash
cp .env.example .env
```

The default configuration uses:
- **Port**: 6544 (to avoid conflicts with other services)
- **Database**: PostgreSQL on localhost:5432
- **LLM Provider**: `mock` (no API key required, perfect for development)
- **Embedding Provider**: `mock` (no API key required)

### 3. Start PostgreSQL with Docker Compose

```bash
# Start PostgreSQL with pgvector extension
docker-compose up -d

# Check that it's running
docker-compose ps
```

The database will automatically initialize with the schema from `database/schema.sql`.

### 4. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Or production mode
npm start
```

The server will start at `http://localhost:6544`

### 5. Access API Documentation

Open your browser and navigate to:
```
http://localhost:6544/api/docs
```

## 🧪 Running Tests

### Run All Tests

```bash
npm run test:all
```

This runs:
1. Unit tests (Jest)
2. API integration tests (Supertest)
3. E2E tests (Playwright)

### Run Individual Test Suites

```bash
# Unit tests only
npm test

# E2E tests only
npm run test:e2e
```

### Test Coverage

Tests include:
- ✅ Validation utilities
- ✅ Embedding generation (mock)
- ✅ Document chunking
- ✅ Authentication (register/login)
- ✅ File upload and management
- ✅ RAG-based question answering
- ✅ Cross-user isolation
- ✅ Authorization enforcement
- ✅ Swagger UI loading
- ✅ Complete end-to-end flows

**All tests run with mock providers and require NO API keys!**

## 📚 API Endpoints

### Authentication (`/api/authentication`)

- **POST** `/register` - Register a new user
- **POST** `/login` - Login and receive JWT token

### Files (`/api/files`)

All endpoints require authentication (`Authorization: Bearer <token>`)

- **POST** `/` - Upload a new file (multipart/form-data)
- **GET** `/` - List user's files (Admin: `?all=true` for all files)
- **GET** `/:id` - Get file metadata
- **GET** `/:id/download` - Download file
- **DELETE** `/:id` - Delete file and associated data
- **GET** `/metrics/admin` - Get system metrics (Admin only)

### Ask/Q&A (`/api/ask`)

All endpoints require authentication

- **POST** `/` - Ask a question about uploaded documents
  - Body: `{ "question": "...", "fileIds": [optional] }`
- **GET** `/history` - Get user's question history
- **GET** `/:id` - Get specific question with answer and sources

## 🤖 Using Real LLM Providers

By default, the API uses mock providers that require no API keys. To use real AI models for production:

### Using OpenAI (Recommended)

1. Get an OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Important**: Set usage limits in your OpenAI dashboard before deploying!
3. Update your `.env`:
   ```env
   LLM_PROVIDER=openai
   EMBEDDING_PROVIDER=openai
   OPENAI_API_KEY=your-api-key-here
   ```

**Default Models** (cost-effective, suitable for Free tier):
- **LLM**: `gpt-4o-mini` (can override with `OPENAI_CHAT_MODEL`)
- **Embeddings**: `text-embedding-3-small` (can override with `OPENAI_EMBEDDING_MODEL`)

### Mock Provider (Development/CI)

Default configuration - no API key needed:

```env
LLM_PROVIDER=mock
EMBEDDING_PROVIDER=mock
```

Perfect for:
- Local development
- CI/CD pipelines
- Testing without API costs
- Development without external dependencies

**Note**: The mock provider generates deterministic, context-based responses suitable for testing but not for production use.

### Alternative Providers

<details>
<summary>Google Gemini (optional, not recommended for this deployment)</summary>

If you prefer Gemini:

1. Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Update your `.env`:
   ```env
   LLM_PROVIDER=gemini
   EMBEDDING_PROVIDER=gemini
   GEMINI_API_KEY=your-api-key-here
   ```

Uses:
- LLM: Gemini 2.5 Flash-Lite
- Embeddings: text-embedding-004

</details>

## 🏗️ Architecture

```
├── index.js                 # Main Express server
├── database/
│   ├── db.js               # PostgreSQL connection pool
│   └── schema.sql          # Database schema
├── middleware/
│   ├── logger.js           # Request logging
│   ├── authenticate.js     # JWT verification
│   └── authorize.js        # Role-based authorization
├── services/
│   ├── llm.js              # LLM answer generation (mock/gemini/openai)
│   ├── embeddings.js       # Embedding generation (mock/gemini/openai)
│   └── documentProcessor.js # Text extraction & chunking
├── routes/
│   ├── authentication.js   # Auth endpoints
│   ├── files.js            # File management endpoints
│   ├── ask.js              # Q&A endpoints
│   └── swagger.js          # API documentation
├── utils/
│   └── validation.js       # Input validation helpers
└── test/
    ├── unit/               # Unit tests
    ├── api/                # API integration tests
    └── e2e/                # Playwright E2E tests
```

## 🔐 Security Features

- **Password Hashing**: Bcrypt with salt rounds
- **JWT Authentication**: Secure token-based auth with 1-hour expiration
- **SQL Injection Prevention**: Parameterized queries throughout
- **File Upload Validation**: MIME type, size, and extension checks with path traversal protection
- **Rate Limiting**: Configurable limits on auth, upload, and ask endpoints
- **CORS Protection**: Configurable allowed origins via environment variable
- **Role-Based Access Control**: User vs Admin permissions
- **Cross-User Isolation**: Users can only access their own data (IDOR protection)
- **No Default Admin**: Default admin account disabled by default (requires explicit opt-in)

## 🎯 How RAG Works

1. **Document Upload**: User uploads a file (PDF, TXT, etc.)
2. **Text Extraction**: Text is extracted from the file
3. **Chunking**: Text is split into overlapping chunks (~600 chars)
4. **Embedding**: Each chunk is converted to a 384-dim vector
5. **Storage**: Chunks and embeddings stored in PostgreSQL with pgvector
6. **Question**: User asks a question
7. **Retrieval**: Top-K most similar chunks are retrieved (cosine similarity)
8. **Generation**: LLM generates answer based on retrieved chunks
9. **Response**: Answer returned with source citations

## 🧩 Database Schema

- **users**: User accounts with hashed passwords
- **files**: File metadata and processing status
- **chunks**: Document chunks with embeddings (vector type)
- **asks**: User questions and generated answers
- **ask_sources**: Links answers to source chunks

## 📊 Admin Account Setup

**Security Note**: No default admin account is created automatically.

### For Local Development/Testing Only

To enable a default admin account (NOT for production):

1. Set environment variable:
   ```env
   ENABLE_DEFAULT_ADMIN=true
   ```

2. Restart the server. Default credentials:
   - **Email**: admin@example.com
   - **Password**: admin123

⚠️ **NEVER enable default admin in production!**

### For Production

Create admin users manually:

1. Register a user account via the API
2. Manually update the user's role in the database:
   ```sql
   UPDATE users SET role = 'Admin' WHERE email = 'your-admin@example.com';
   ```

3. Use a strong, unique password

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

### Port Already in Use

Change the port in `.env`:
```env
PORT=7000
```

### File Upload Fails

- Check `uploads/` directory exists and is writable
- Verify file size is under `MAX_FILE_SIZE_MB` (default 10MB)
- Ensure MIME type is supported (PDF, TXT, MD, DOCX, CSV)

### Tests Fail

```bash
# Ensure database is running
docker-compose up -d

# Wait for database to be ready
sleep 5

# Run tests
npm run test:all
```

## 📝 Example Usage

### 1. Register and Login

```bash
# Register (password must meet complexity requirements)
curl -X POST http://localhost:6544/api/authentication/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"SecurePass123!"}'

# Login
curl -X POST http://localhost:6544/api/authentication/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"SecurePass123!"}'
# Save the returned token for subsequent requests
```

### 2. Upload a Document

```bash
curl -X POST http://localhost:6544/api/files \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@./document.pdf"
# Processing happens in background; check status with GET /api/files/:id
```

### 3. Ask a Question

```bash
curl -X POST http://localhost:6544/api/ask \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the main topic of the document?"}'
# Returns answer with source citations
```

### 4. Health Check

```bash
# Basic health check
curl http://localhost:6544/health

# Full health check (includes database connectivity)
curl http://localhost:6544/health?check=full
```

## 🤝 Code Style

This project follows the coding style of [RusselTheCreator/usercrud-api](https://github.com/RusselTheCreator/usercrud-api):

- ✅ Verbose inline comments explaining every step
- ✅ Express 5 with modern middleware
- ✅ Swagger JSDoc for all endpoints
- ✅ Clear folder structure (database/, middleware/, routes/, services/)
- ✅ Parameterized SQL queries for security
- ✅ Consistent error handling with JSON responses

## 📄 License

MIT

## 👤 Author

Built by Cursor Cloud Agent

---

**Need help?** Check the [API documentation](http://localhost:6544/api/docs) or open an issue!

