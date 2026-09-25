# API Contract — knowledge-ask-api

Version: 1.0.0  
Base URL (staging): https://knowledge-ask-api.onrender.com  
Base URL (local): http://localhost:6544

## Authentication

All endpoints except registration, login, health, and root require JWT authentication.

**Authentication Header:**
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### Health & Info

#### GET /
Returns API welcome message and available endpoints.

**Response:** `200 OK`
```json
{
  "message": "Welcome to Knowledge Ask API",
  "version": "1.0.0",
  "status": "healthy",
  "endpoints": {
    "docs": "/api/docs",
    "auth": "/api/authentication",
    "files": "/api/files",
    "ask": "/api/ask"
  }
}
```

#### GET /health
Health check endpoint for monitoring.

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-09-25T09:00:00.000Z"
}
```

#### GET /api/docs
Interactive Swagger UI documentation.

---

### Authentication (`/api/authentication`)

#### POST /api/authentication/register
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "role": "User"
}
```

**Response:** `201 Created`
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "User",
    "createdAt": "2026-09-25T09:00:00.000Z"
  }
}
```

**Errors:**
- `400` Validation failed
- `409` Email already registered

#### POST /api/authentication/login
Login and receive JWT token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "User"
  }
}
```

**Errors:**
- `400` Invalid input
- `401` Invalid credentials

---

### Files (`/api/files`)

All file endpoints require authentication.

#### POST /api/files
Upload a new document file.

**Request:** `multipart/form-data`
- `file`: File (PDF, TXT, MD, DOCX, CSV)

**Response:** `201 Created`
```json
{
  "message": "File uploaded successfully. Processing in background.",
  "file": {
    "id": 1,
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 123456,
    "status": "processing",
    "createdAt": "2026-09-25T09:00:00.000Z"
  }
}
```

**Errors:**
- `400` Invalid file type or size
- `401` Unauthorized

**Constraints:**
- Max file size: 10MB (configurable via `MAX_FILE_SIZE_MB`)
- Supported types: PDF, TXT, MD, DOCX, CSV

#### GET /api/files
List user's uploaded files.

**Query Parameters:**
- `all=true` (Admin only) - List all users' files

**Response:** `200 OK`
```json
{
  "message": "Files retrieved successfully",
  "count": 2,
  "files": [
    {
      "id": 1,
      "originalName": "document.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 123456,
      "status": "ready",
      "chunkCount": 15,
      "createdAt": "2026-09-25T09:00:00.000Z"
    }
  ]
}
```

#### GET /api/files/:id
Get file metadata by ID.

**Response:** `200 OK`
```json
{
  "message": "File metadata retrieved successfully",
  "file": {
    "id": 1,
    "userId": 1,
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 123456,
    "status": "ready",
    "errorMessage": null,
    "chunkCount": 15,
    "createdAt": "2026-09-25T09:00:00.000Z",
    "updatedAt": "2026-09-25T09:05:00.000Z"
  }
}
```

**Errors:**
- `403` Access denied (not owner, not admin)
- `404` File not found

#### GET /api/files/:id/download
Download file by ID.

**Response:** `200 OK` (file stream)
- Content-Type: Original file MIME type
- Content-Disposition: attachment

**Errors:**
- `403` Access denied
- `404` File not found

#### DELETE /api/files/:id
Delete file and all associated data (chunks, sources).

**Response:** `200 OK`
```json
{
  "message": "File and associated data deleted successfully"
}
```

**Errors:**
- `403` Access denied
- `404` File not found

#### GET /api/files/metrics/admin
Get system metrics (Admin only).

**Response:** `200 OK`
```json
{
  "message": "Metrics retrieved successfully",
  "metrics": {
    "files": {
      "total": 42,
      "totalSizeBytes": 5242880,
      "byStatus": {
        "ready": 38,
        "processing": 3,
        "error": 1
      }
    },
    "chunks": { "total": 532 },
    "asks": { "total": 156 },
    "users": { "total": 12 }
  }
}
```

**Errors:**
- `403` Admin access required

---

### Ask/Q&A (`/api/ask`)

All ask endpoints require authentication.

#### POST /api/ask
Ask a question about uploaded documents using RAG.

**Request Body:**
```json
{
  "question": "What is the main topic of my documents?",
  "fileIds": [1, 2]
}
```

**Note:** `fileIds` is optional. If omitted, searches across all user's files.

**Response:** `200 OK`
```json
{
  "message": "Answer generated successfully",
  "answer": "Based on the retrieved documents...",
  "sources": [
    {
      "fileId": 1,
      "fileName": "document.pdf",
      "chunkId": 5,
      "relevanceScore": 0.87,
      "excerpt": "This document discusses..."
    }
  ],
  "askId": 1
}
```

**Errors:**
- `400` Invalid input (empty question)
- `401` Unauthorized

#### GET /api/ask/history
Get user's question history.

**Response:** `200 OK`
```json
{
  "message": "Ask history retrieved successfully",
  "count": 5,
  "asks": [
    {
      "id": 1,
      "question": "What is...",
      "answer": "Based on...",
      "status": "completed",
      "errorMessage": null,
      "createdAt": "2026-09-25T09:00:00.000Z"
    }
  ]
}
```

#### GET /api/ask/:id
Get specific ask with sources.

**Response:** `200 OK`
```json
{
  "message": "Ask details retrieved successfully",
  "ask": {
    "id": 1,
    "question": "What is...",
    "answer": "Based on...",
    "status": "completed",
    "errorMessage": null,
    "createdAt": "2026-09-25T09:00:00.000Z",
    "sources": [
      {
        "fileId": 1,
        "fileName": "document.pdf",
        "chunkId": 5,
        "relevanceScore": 0.87,
        "chunkExcerpt": "..."
      }
    ]
  }
}
```

**Errors:**
- `403` Access denied (not owner)
- `404` Ask not found

---

## Common Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid or expired token."
}
```

### 403 Forbidden
```json
{
  "error": "Access denied"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Something went wrong"
}
```

---

## Data Isolation & Security

- **User Isolation**: Users can only access their own files and asks
- **Admin Override**: Admin role can access all resources with `?all=true` or direct ID access
- **IDOR Protection**: All resource access includes ownership verification
- **Rate Limiting**: Authentication, upload, and ask endpoints have rate limits
- **File Validation**: Size and MIME type checks on upload
- **CORS**: Configurable allowed origins via `CORS_ORIGINS` environment variable

---

## Environment Variables

Required for staging/production:

```bash
# Server
PORT=6544
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# JWT
JWT_SECRET=your-strong-secret-key

# LLM (choose one)
LLM_PROVIDER=openai         # or 'mock' for dev/CI
EMBEDDING_PROVIDER=openai   # or 'mock' for dev/CI
OPENAI_API_KEY=sk-...       # when using OpenAI

# CORS (comma-separated origins)
CORS_ORIGINS=https://frontend.onrender.com,http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000     # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100     # requests per window
RATE_LIMIT_AUTH_MAX=10          # auth attempts per window
RATE_LIMIT_UPLOAD_MAX=20        # uploads per window
RATE_LIMIT_ASK_MAX=50           # asks per window

# File Upload
MAX_FILE_SIZE_MB=10
UPLOAD_DIR=uploads

# RAG
CHUNK_SIZE=600
CHUNK_OVERLAP=100
TOP_K_CHUNKS=5
```

---

## Rate Limits

| Endpoint Pattern | Limit | Window |
|---|---|---|
| `/api/authentication/*` | 10 requests | 15 minutes |
| `POST /api/files` | 20 requests | 15 minutes |
| `POST /api/ask` | 50 requests | 15 minutes |
| Other endpoints | 100 requests | 15 minutes |

Rate limit headers included in responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
