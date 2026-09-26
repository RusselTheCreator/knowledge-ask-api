/**
 * File Management Routes
 * 
 * Handles file upload, listing, metadata retrieval, download, and deletion
 * All routes require JWT authentication
 * 
 * Routes:
 * - POST /api/files - Upload a new file
 * - GET /api/files - List user's files (Admin can list all)
 * - GET /api/files/:id - Get file metadata
 * - GET /api/files/:id/download - Download file
 * - DELETE /api/files/:id - Delete file
 * - GET /api/files/metrics - Get system metrics (Admin only)
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import pool from '../database/db.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import { validateFileUpload } from '../utils/validation.js';
import { ingestDocument } from '../services/documentProcessor.js';
import { uploadRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Configure multer for file uploads
// Files are stored in the uploads/ directory with unique names
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    // Ensure upload directory exists
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

// File size limit enforcement
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'image/png',
  'image/jpeg'
];

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed. Supported types: PDF, TXT, MD, DOCX, CSV, XLSX, PNG, JPEG`));
    }
  }
});

/**
 * @swagger
 * /api/files:
 *   post:
 *     summary: Upload a new file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: File uploaded and ingestion started
 *       400:
 *         description: Invalid file
 *       401:
 *         description: Unauthorized
 */
// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB`
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files. Please upload one file at a time'
      });
    }
    return res.status(400).json({
      error: 'File upload error',
      details: err.message
    });
  }
  if (err) {
    return res.status(400).json({
      error: err.message || 'File upload failed'
    });
  }
  next();
};

router.post('/', authenticate, uploadRateLimiter, upload.single('file'), handleMulterError, async (req, res) => {
  try {
    // Additional validation (multer handles basic checks now)
    const validation = validateFileUpload(req.file);
    if (!validation.valid) {
      // Delete the uploaded file if validation fails
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      return res.status(400).json({ error: validation.error });
    }
    
    // Insert file metadata into database
    const result = await pool.query(
      `INSERT INTO files (user_id, original_name, mime_type, size_bytes, storage_path, status)
       VALUES ($1, $2, $3, $4, $5, 'processing')
       RETURNING id, user_id, original_name, mime_type, size_bytes, status, created_at`,
      [
        req.user.id,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.file.path
      ]
    );
    
    const file = result.rows[0];
    
    console.log(`📤 File uploaded: ${file.original_name} (ID: ${file.id})`);
    
    // Start document ingestion asynchronously (don't wait for it)
    // This will extract text, chunk it, generate embeddings, and store in DB
    ingestDocument(file.id, req.file.path, req.file.mimetype)
      .catch(error => {
        console.error(`Failed to ingest file ${file.id}:`, error);
      });
    
    // Return immediate response
    res.status(201).json({
      message: 'File uploaded successfully. Processing in background.',
      file: {
        id: file.id,
        originalName: file.original_name,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        status: file.status,
        createdAt: file.created_at
      }
    });
    
  } catch (error) {
    console.error('File upload error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({
      error: 'Failed to upload file. Please try again.'
    });
  }
});

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: List files (user's own files, or all if Admin with ?all=true)
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *         description: Admin only - list all users' files
 *     responses:
 *       200:
 *         description: List of files
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'Admin';
    const listAll = req.query.all === 'true' && isAdmin;
    
    let query;
    let params;
    
    if (listAll) {
      // Admin viewing all files
      query = `
        SELECT f.id, f.user_id, u.name as user_name, f.original_name, f.mime_type, 
               f.size_bytes, f.status, f.created_at,
               (SELECT COUNT(*) FROM chunks WHERE file_id = f.id) as chunk_count
        FROM files f
        JOIN users u ON f.user_id = u.id
        ORDER BY f.created_at DESC
      `;
      params = [];
    } else {
      // User viewing their own files
      query = `
        SELECT f.id, f.original_name, f.mime_type, f.size_bytes, f.status, f.created_at,
               (SELECT COUNT(*) FROM chunks WHERE file_id = f.id) as chunk_count
        FROM files f
        WHERE f.user_id = $1
        ORDER BY f.created_at DESC
      `;
      params = [req.user.id];
    }
    
    const result = await pool.query(query, params);
    
    res.json({
      message: 'Files retrieved successfully',
      count: result.rows.length,
      files: result.rows
    });
    
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({
      error: 'Failed to retrieve files. Please try again.'
    });
  }
});

/**
 * @swagger
 * /api/files/{id}:
 *   get:
 *     summary: Get file metadata
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: File metadata
 *       403:
 *         description: Access denied
 *       404:
 *         description: File not found
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    const isAdmin = req.user.role === 'Admin';
    
    // Query file with ownership check
    const query = isAdmin
      ? 'SELECT * FROM files WHERE id = $1'
      : 'SELECT * FROM files WHERE id = $1 AND user_id = $2';
    
    const params = isAdmin ? [fileId] : [fileId, req.user.id];
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'File not found or access denied'
      });
    }
    
    const file = result.rows[0];
    
    // Get chunk count
    const chunkResult = await pool.query(
      'SELECT COUNT(*) as count FROM chunks WHERE file_id = $1',
      [fileId]
    );
    
    res.json({
      message: 'File metadata retrieved successfully',
      file: {
        id: file.id,
        userId: file.user_id,
        originalName: file.original_name,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        status: file.status,
        errorMessage: file.error_message,
        chunkCount: parseInt(chunkResult.rows[0].count),
        createdAt: file.created_at,
        updatedAt: file.updated_at
      }
    });
    
  } catch (error) {
    console.error('Error getting file metadata:', error);
    res.status(500).json({
      error: 'Failed to retrieve file metadata. Please try again.'
    });
  }
});

/**
 * @swagger
 * /api/files/{id}/download:
 *   get:
 *     summary: Download file
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: File download
 *       403:
 *         description: Access denied
 *       404:
 *         description: File not found
 */
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    const isAdmin = req.user.role === 'Admin';
    
    // Query file with ownership check
    const query = isAdmin
      ? 'SELECT * FROM files WHERE id = $1'
      : 'SELECT * FROM files WHERE id = $1 AND user_id = $2';
    
    const params = isAdmin ? [fileId] : [fileId, req.user.id];
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'File not found or access denied'
      });
    }
    
    const file = result.rows[0];
    
    // Check if file exists on disk before attempting to read
    try {
      await fs.access(file.storage_path);
    } catch (accessError) {
      // File metadata exists but blob is missing (common with ephemeral storage)
      console.warn(`File blob missing on disk: ${file.storage_path} (ID: ${fileId})`);
      return res.status(404).json({
        error: 'File content is no longer available',
        details: 'The file metadata exists but the content is missing from storage. This may occur after service redeployments on ephemeral disk.'
      });
    }
    
    // Escape filename for Content-Disposition header to handle special characters
    const sanitizedFilename = file.original_name.replace(/"/g, '\\"');
    
    // Set headers for file download
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    
    // Stream the file from disk to response
    const fileStream = await fs.readFile(file.storage_path);
    res.send(fileStream);
    
    console.log(`📥 File downloaded: ${file.original_name} by user ${req.user.id}`);
    
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      error: 'Failed to download file. Please try again.'
    });
  }
});

/**
 * @swagger
 * /api/files/{id}:
 *   delete:
 *     summary: Delete file and all associated data
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: File deleted successfully
 *       403:
 *         description: Access denied
 *       404:
 *         description: File not found
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    const isAdmin = req.user.role === 'Admin';
    
    // Query file with ownership check
    const query = isAdmin
      ? 'SELECT * FROM files WHERE id = $1'
      : 'SELECT * FROM files WHERE id = $1 AND user_id = $2';
    
    const params = isAdmin ? [fileId] : [fileId, req.user.id];
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'File not found or access denied'
      });
    }
    
    const file = result.rows[0];
    
    // Delete file from disk
    await fs.unlink(file.storage_path).catch(err => {
      console.warn(`Could not delete file from disk: ${err.message}`);
    });
    
    // Delete from database (CASCADE will delete chunks and ask_sources)
    await pool.query('DELETE FROM files WHERE id = $1', [fileId]);
    
    console.log(`🗑️  File deleted: ${file.original_name} (ID: ${fileId})`);
    
    res.json({
      message: 'File and associated data deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      error: 'Failed to delete file. Please try again.'
    });
  }
});

/**
 * @swagger
 * /api/files/metrics:
 *   get:
 *     summary: Get system metrics (Admin only)
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System metrics
 *       403:
 *         description: Admin access required
 */
router.get('/metrics/admin', authenticate, authorize('Admin'), async (req, res) => {
  try {
    // Get various system metrics
    const [filesResult, chunksResult, asksResult, usersResult, statusResult] = await Promise.all([
      pool.query('SELECT COUNT(*) as count, SUM(size_bytes) as total_size FROM files'),
      pool.query('SELECT COUNT(*) as count FROM chunks'),
      pool.query('SELECT COUNT(*) as count FROM asks'),
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query(`SELECT status, COUNT(*) as count FROM files GROUP BY status`)
    ]);
    
    res.json({
      message: 'Metrics retrieved successfully',
      metrics: {
        files: {
          total: parseInt(filesResult.rows[0].count),
          totalSizeBytes: parseInt(filesResult.rows[0].total_size || 0),
          byStatus: statusResult.rows.reduce((acc, row) => {
            acc[row.status] = parseInt(row.count);
            return acc;
          }, {})
        },
        chunks: {
          total: parseInt(chunksResult.rows[0].count)
        },
        asks: {
          total: parseInt(asksResult.rows[0].count)
        },
        users: {
          total: parseInt(usersResult.rows[0].count)
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics. Please try again.'
    });
  }
});

export default router;
