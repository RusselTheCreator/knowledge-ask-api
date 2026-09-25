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
import initializeDatabase from './database/init.js';

// Load environment variables from .env file
// This must be done before accessing process.env
dotenv.config();

// Initialize Express application
const app = express();

// Get port from environment or use default 6544
// Railway/Render often use dynamic ports, so prioritize env PORT
const PORT = process.env.PORT || 6544;

/**
 * MIDDLEWARE SETUP
 * Middleware functions process requests before they reach route handlers
 */

// Enable CORS for cross-origin requests
// Configurable via CORS_ORIGINS environment variable (comma-separated list)
// Default allows localhost development origins for Vite and common dev servers
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:6544'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
// Checks server status and optionally database connectivity
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };
  
  // Optional: check database connectivity (adds latency, so make it optional via query param)
  if (req.query.check === 'full') {
    try {
      const { default: pool } = await import('./database/db.js');
      const result = await pool.query('SELECT 1 as health_check');
      health.database = result.rows[0].health_check === 1 ? 'connected' : 'error';
    } catch (error) {
      health.database = 'disconnected';
      health.status = 'degraded';
      console.error('Health check database error:', error.message);
    }
  }
  
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
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
 * Configuration validation
 * Ensures critical security settings are properly configured
 */
function validateConfiguration() {
  const errors = [];
  
  // Validate JWT secret strength (except in development)
  if (process.env.NODE_ENV !== 'development') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be set and at least 32 characters long in production');
      errors.push('Generate a secure secret with: openssl rand -base64 32');
    }
    
    // Check for placeholder/weak secrets
    const weakSecrets = ['your-secret-key', 'change-this', 'secret', 'password'];
    if (weakSecrets.some(weak => process.env.JWT_SECRET?.toLowerCase().includes(weak))) {
      errors.push('JWT_SECRET appears to be a placeholder or weak value');
      errors.push('Use a strong random secret: openssl rand -base64 32');
    }
  } else {
    // Development warning if JWT secret is weak
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      console.warn('⚠️  WARNING: JWT_SECRET is weak or missing (OK for development only)');
      console.warn('   Generate secure secret: openssl rand -base64 32');
    }
  }
  
  // Validate required environment variables
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    errors.push('DATABASE_URL or DB_HOST must be configured');
  }
  
  return errors;
}

/**
 * START SERVER
 * Initialize database and begin listening for HTTP requests
 */

async function startServer() {
  try {
    // Validate configuration before starting
    const configErrors = validateConfiguration();
    if (configErrors.length > 0) {
      console.error('❌ Configuration validation failed:');
      configErrors.forEach(error => console.error(`   - ${error}`));
      if (process.env.NODE_ENV !== 'development') {
        process.exit(1);
      }
    }
    
    // Initialize database schema
    await initializeDatabase();
    
    // Start listening
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
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Export app for testing
export default app;
