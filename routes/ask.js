/**
 * Ask/Q&A Routes
 * 
 * Handles RAG-based question answering over uploaded documents
 * All routes require JWT authentication
 * 
 * Routes:
 * - POST /api/ask - Ask a question about documents
 * - GET /api/ask/history - Get user's ask history
 * - GET /api/ask/:id - Get specific ask with sources
 */

import express from 'express';
import pool from '../database/db.js';
import authenticate from '../middleware/authenticate.js';
import { generateEmbedding, cosineSimilarity } from '../services/embeddings.js';
import { generateAnswer } from '../services/llm.js';

const router = express.Router();

/**
 * @swagger
 * /api/ask:
 *   post:
 *     summary: Ask a question about uploaded documents
 *     tags: [Ask]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *               fileIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Optional - limit search to specific files
 *     responses:
 *       200:
 *         description: Answer generated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { question, fileIds } = req.body;
    
    // Validate input
    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        error: 'Question is required and cannot be empty'
      });
    }
    
    console.log(`❓ Question from user ${req.user.id}: "${question}"`);
    
    // Create initial ask record in database
    const askResult = await pool.query(
      `INSERT INTO asks (user_id, question, status)
       VALUES ($1, $2, 'pending')
       RETURNING id`,
      [req.user.id, question]
    );
    
    const askId = askResult.rows[0].id;
    
    try {
      // Step 1: Generate embedding for the question
      const questionEmbedding = await generateEmbedding(question);
      
      // Step 2: Retrieve relevant chunks from the user's files
      // Build query to get chunks from user's files (with optional file filter)
      let chunkQuery = `
        SELECT c.id, c.file_id, c.chunk_text, c.embedding, f.original_name
        FROM chunks c
        JOIN files f ON c.file_id = f.id
        WHERE f.user_id = $1 AND f.status = 'ready'
      `;
      
      const queryParams = [req.user.id];
      
      // If specific file IDs are provided, filter by them
      if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
        chunkQuery += ` AND f.id = ANY($2)`;
        queryParams.push(fileIds);
      }
      
      const chunksResult = await pool.query(chunkQuery, queryParams);
      
      if (chunksResult.rows.length === 0) {
        // No chunks available - update ask status and return
        await pool.query(
          `UPDATE asks SET status = 'completed', 
           answer = 'No relevant documents found. Please upload documents first.'
           WHERE id = $1`,
          [askId]
        );
        
        return res.json({
          message: 'No documents available',
          answer: 'No relevant documents found. Please upload documents first.',
          sources: [],
          askId
        });
      }
      
      // Step 3: Calculate similarity scores for each chunk
      // pgvector stores embeddings as JSON strings, so parse them
      const chunksWithScores = chunksResult.rows.map(chunk => {
        const chunkEmbedding = JSON.parse(chunk.embedding);
        const similarity = cosineSimilarity(questionEmbedding, chunkEmbedding);
        
        return {
          id: chunk.id,
          file_id: chunk.file_id,
          file_name: chunk.original_name,
          chunk_text: chunk.chunk_text,
          similarity
        };
      });
      
      // Sort by similarity (highest first) and take top K
      const topK = parseInt(process.env.TOP_K_CHUNKS) || 5;
      const topChunks = chunksWithScores
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
      
      console.log(`✅ Retrieved ${topChunks.length} relevant chunks`);
      
      // Step 4: Generate answer using LLM with retrieved context
      const answer = await generateAnswer(question, topChunks);
      
      // Step 5: Store the answer and sources in database
      await pool.query(
        `UPDATE asks SET status = 'completed', answer = $1 WHERE id = $2`,
        [answer, askId]
      );
      
      // Store source chunks
      for (const chunk of topChunks) {
        const excerpt = chunk.chunk_text.substring(0, 200) + '...';
        
        await pool.query(
          `INSERT INTO ask_sources (ask_id, file_id, chunk_id, relevance_score, chunk_excerpt)
           VALUES ($1, $2, $3, $4, $5)`,
          [askId, chunk.file_id, chunk.id, chunk.similarity, excerpt]
        );
      }
      
      console.log(`✅ Answer generated for ask ${askId}`);
      
      // Return the answer with sources
      res.json({
        message: 'Answer generated successfully',
        answer,
        sources: topChunks.map(chunk => ({
          fileId: chunk.file_id,
          fileName: chunk.file_name,
          chunkId: chunk.id,
          relevanceScore: chunk.similarity,
          excerpt: chunk.chunk_text.substring(0, 200) + '...'
        })),
        askId
      });
      
    } catch (error) {
      // Update ask status to error
      await pool.query(
        `UPDATE asks SET status = 'error', error_message = $1 WHERE id = $2`,
        [error.message, askId]
      );
      
      throw error;
    }
    
  } catch (error) {
    console.error('Error processing question:', error);
    res.status(500).json({
      error: 'Failed to process question. Please try again.',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/ask/history:
 *   get:
 *     summary: Get user's ask history
 *     tags: [Ask]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ask history retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    // Get all asks for the current user, most recent first
    const result = await pool.query(
      `SELECT id, question, answer, status, error_message, created_at
       FROM asks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    
    res.json({
      message: 'Ask history retrieved successfully',
      count: result.rows.length,
      asks: result.rows
    });
    
  } catch (error) {
    console.error('Error retrieving ask history:', error);
    res.status(500).json({
      error: 'Failed to retrieve ask history. Please try again.'
    });
  }
});

/**
 * @swagger
 * /api/ask/{id}:
 *   get:
 *     summary: Get specific ask with sources
 *     tags: [Ask]
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
 *         description: Ask details with sources
 *       403:
 *         description: Access denied
 *       404:
 *         description: Ask not found
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const askId = parseInt(req.params.id);
    
    // Get ask details with ownership check
    const askResult = await pool.query(
      `SELECT id, question, answer, status, error_message, created_at
       FROM asks
       WHERE id = $1 AND user_id = $2`,
      [askId, req.user.id]
    );
    
    if (askResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Ask not found or access denied'
      });
    }
    
    const ask = askResult.rows[0];
    
    // Get sources used for this ask
    const sourcesResult = await pool.query(
      `SELECT s.file_id, f.original_name as file_name, s.chunk_id, 
              s.relevance_score, s.chunk_excerpt
       FROM ask_sources s
       JOIN files f ON s.file_id = f.id
       WHERE s.ask_id = $1
       ORDER BY s.relevance_score DESC`,
      [askId]
    );
    
    res.json({
      message: 'Ask details retrieved successfully',
      ask: {
        id: ask.id,
        question: ask.question,
        answer: ask.answer,
        status: ask.status,
        errorMessage: ask.error_message,
        createdAt: ask.created_at,
        sources: sourcesResult.rows
      }
    });
    
  } catch (error) {
    console.error('Error retrieving ask details:', error);
    res.status(500).json({
      error: 'Failed to retrieve ask details. Please try again.'
    });
  }
});

export default router;
