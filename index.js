/**
 * Knowledge Ask API - Main Server File
 * 
 * This is the entry point for the Express server.
 * It sets up middleware, routes, and starts the server.
 * 
 * Architecture:
 * - Express 5 for HTTP server
 * - PostgreSQL with pgvector for data storage and vector search
 * - JWT for authentication
 * - RAG (Retrieval-Augmented Generation) for Q&A
 * 
 * Author: Cursor Cloud Agent
 * Style: Mirrors RusselTheCreator/usercrud-api patterns
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import logger from './middleware/logger.js';
import authRoutes from './routes/authentication.js';
import fileRoutes from './routes/files.js';
import askRoutes from './routes/ask.js';
import swaggerRoutes from './routes/swagger.js';

// Load environment variables from .env file
// This must be done before accessing process.env
dotenv.config();

// Initialize Express application
const app = express();

// Get port from environment or use default 6544
const PORT = process.env.PORT || 6544;

/**
 * MIDDLEWARE SETUP
 * Middleware functions process requests before they reach route handlers
 */

// Enable CORS for cross-origin requests
// Allows the API to be accessed from web browsers on different domains
app.use(cors());

// Parse JSON request bodies
// Allows us to access req.body as a JavaScript object
app.use(express.json());

// Parse URL-encoded request bodies (from HTML forms)
app.use(express.urlencoded({ extended: true }));

// Custom logging middleware
// Logs every request with method, URL, status code, and response time
app.use(logger);

/**
 * ROUTES SETUP
 * Each route module handles a specific domain of the API
 */

// Health check endpoint - verify server is running
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Knowledge Ask API',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      docs: '/api/docs',
      auth: '/api/authentication',
      files: '/api/files',
      ask: '/api/ask'
    }
  });
});

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount route modules
app.use('/api/authentication', authRoutes); // User registration and login
app.use('/api/files', fileRoutes);           // File upload and management
app.use('/api/ask', askRoutes);              // RAG-based Q&A
app.use('/api/docs', swaggerRoutes);         // API documentation (Swagger UI)

/**
 * ERROR HANDLING
 * Catch-all error handler for unhandled routes and errors
 */

// 404 handler - route not found
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.path}. Check /api/docs for available endpoints.`
  });
});

// Global error handler
// Catches any errors thrown in route handlers or middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

/**
 * START SERVER
 * Begin listening for HTTP requests
 */

app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🚀 Knowledge Ask API Server Started');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  📡 Server:      http://localhost:${PORT}`);
  console.log(`  📚 API Docs:    http://localhost:${PORT}/api/docs`);
  console.log(`  🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  🤖 LLM:         ${process.env.LLM_PROVIDER || 'mock'}`);
  console.log(`  🧮 Embeddings:  ${process.env.EMBEDDING_PROVIDER || 'mock'}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
});

// Export app for testing
export default app;
