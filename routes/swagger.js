/**
 * Swagger Documentation Setup
 * 
 * Configures and serves API documentation using Swagger UI
 * Documentation available at /api/docs
 */

import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const router = express.Router();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Knowledge Ask API',
      version: '1.0.0',
      description: 'RAG-powered knowledge base API with document upload and Q&A capabilities',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: 'http://localhost:6544',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from /api/authentication/login'
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User registration and login'
      },
      {
        name: 'Files',
        description: 'File upload, management, and metrics'
      },
      {
        name: 'Ask',
        description: 'RAG-based question answering'
      }
    ]
  },
  // Path to the API routes with JSDoc comments
  apis: ['./routes/*.js']
};

// Generate Swagger specification from JSDoc comments
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI at /api/docs
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }', // Hide Swagger topbar
  customSiteTitle: 'Knowledge Ask API Documentation'
}));

export default router;
