/**
 * Database Schema Validation Tests
 * 
 * These tests verify that the database schema matches what the application code expects.
 * This helps catch schema drift issues before they cause production errors.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import pool from '../../database/db.js';

afterAll(async () => {
  await pool.end();
});

describe('Database Schema Validation', () => {
  describe('asks table', () => {
    test('should have all required columns with correct types', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'asks'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows;
      const columnMap = {};
      columns.forEach(col => {
        columnMap[col.column_name] = col;
      });
      
      // Verify all required columns exist
      const requiredColumns = ['id', 'user_id', 'question', 'answer', 'status', 'error_message', 'created_at'];
      requiredColumns.forEach(colName => {
        expect(columnMap[colName]).toBeDefined();
      });
      
      // Verify column types and constraints
      expect(columnMap.id.data_type).toBe('integer');
      expect(columnMap.user_id.data_type).toBe('integer');
      expect(columnMap.user_id.is_nullable).toBe('NO');
      expect(columnMap.question.data_type).toBe('text');
      expect(columnMap.question.is_nullable).toBe('NO');
      expect(columnMap.answer.data_type).toBe('text');
      expect(columnMap.answer.is_nullable).toBe('YES'); // Nullable because it's set after question is asked
      expect(columnMap.status.data_type).toBe('character varying');
      expect(columnMap.status.column_default).toContain('pending');
      expect(columnMap.error_message.data_type).toBe('text');
      expect(columnMap.error_message.is_nullable).toBe('YES');
      expect(columnMap.created_at.data_type).toBe('timestamp without time zone');
    });
    
    test('should support INSERT with status column', async () => {
      // This test verifies the INSERT query used in routes/ask.js line 69
      const testUserId = await createTestUser();
      
      const result = await pool.query(
        `INSERT INTO asks (user_id, question, status)
         VALUES ($1, $2, 'pending')
         RETURNING id, status`,
        [testUserId, 'Test question']
      );
      
      expect(result.rows[0].id).toBeDefined();
      expect(result.rows[0].status).toBe('pending');
      
      // Cleanup
      await pool.query('DELETE FROM asks WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });
    
    test('should support SELECT with status and error_message columns', async () => {
      // This test verifies the SELECT query used in routes/ask.js line 213
      const testUserId = await createTestUser();
      
      const insertResult = await pool.query(
        `INSERT INTO asks (user_id, question, status, answer, error_message)
         VALUES ($1, $2, 'completed', 'Test answer', NULL)
         RETURNING id`,
        [testUserId, 'Test question']
      );
      
      const selectResult = await pool.query(
        `SELECT id, question, answer, status, error_message, created_at
         FROM asks
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [testUserId]
      );
      
      expect(selectResult.rows.length).toBe(1);
      expect(selectResult.rows[0].status).toBe('completed');
      expect(selectResult.rows[0].error_message).toBeNull();
      expect(selectResult.rows[0].answer).toBe('Test answer');
      
      // Cleanup
      await pool.query('DELETE FROM asks WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });
    
    test('should support UPDATE with status and error_message', async () => {
      const testUserId = await createTestUser();
      
      const insertResult = await pool.query(
        `INSERT INTO asks (user_id, question, status)
         VALUES ($1, $2, 'pending')
         RETURNING id`,
        [testUserId, 'Test question']
      );
      
      const askId = insertResult.rows[0].id;
      
      // Update to completed
      await pool.query(
        `UPDATE asks SET status = 'completed', answer = $1 WHERE id = $2`,
        ['Test answer', askId]
      );
      
      // Update to error
      await pool.query(
        `UPDATE asks SET status = 'error', error_message = $1 WHERE id = $2`,
        ['Test error', askId]
      );
      
      const result = await pool.query('SELECT status, error_message FROM asks WHERE id = $1', [askId]);
      expect(result.rows[0].status).toBe('error');
      expect(result.rows[0].error_message).toBe('Test error');
      
      // Cleanup
      await pool.query('DELETE FROM asks WHERE user_id = $1', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });
  });
  
  describe('ask_sources table', () => {
    test('should have all required columns with correct types', async () => {
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'ask_sources'
        ORDER BY ordinal_position
      `);
      
      const columns = result.rows;
      const columnMap = {};
      columns.forEach(col => {
        columnMap[col.column_name] = col;
      });
      
      // Verify all required columns exist
      const requiredColumns = ['id', 'ask_id', 'file_id', 'chunk_id', 'relevance_score', 'chunk_excerpt'];
      requiredColumns.forEach(colName => {
        expect(columnMap[colName]).toBeDefined();
      });
      
      // Verify column types and constraints
      expect(columnMap.id.data_type).toBe('integer');
      expect(columnMap.ask_id.data_type).toBe('integer');
      expect(columnMap.ask_id.is_nullable).toBe('NO');
      expect(columnMap.file_id.data_type).toBe('integer');
      expect(columnMap.file_id.is_nullable).toBe('NO');
      expect(columnMap.chunk_id.data_type).toBe('integer');
      expect(columnMap.chunk_id.is_nullable).toBe('NO');
      expect(columnMap.relevance_score.data_type).toMatch(/double precision|float/);
      expect(columnMap.chunk_excerpt.data_type).toBe('text');
    });
    
    test('should support INSERT with file_id and chunk_excerpt columns', async () => {
      // This test verifies the INSERT query used in routes/ask.js line 154
      const { userId, fileId, chunkId, askId } = await createTestAskContext();
      
      const result = await pool.query(
        `INSERT INTO ask_sources (ask_id, file_id, chunk_id, relevance_score, chunk_excerpt)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, file_id, chunk_excerpt`,
        [askId, fileId, chunkId, 0.85, 'Test chunk excerpt...']
      );
      
      expect(result.rows[0].id).toBeDefined();
      expect(result.rows[0].file_id).toBe(fileId);
      expect(result.rows[0].chunk_excerpt).toBe('Test chunk excerpt...');
      
      // Cleanup
      await cleanupTestAskContext({ userId, fileId, chunkId, askId });
    });
    
    test('should support SELECT with file_id and chunk_excerpt columns', async () => {
      // This test verifies the SELECT query used in routes/ask.js line 278
      const { userId, fileId, chunkId, askId } = await createTestAskContext();
      
      await pool.query(
        `INSERT INTO ask_sources (ask_id, file_id, chunk_id, relevance_score, chunk_excerpt)
         VALUES ($1, $2, $3, $4, $5)`,
        [askId, fileId, chunkId, 0.85, 'Test chunk excerpt...']
      );
      
      const result = await pool.query(
        `SELECT s.file_id, f.original_name as file_name, s.chunk_id, 
                s.relevance_score, s.chunk_excerpt
         FROM ask_sources s
         JOIN files f ON s.file_id = f.id
         WHERE s.ask_id = $1
         ORDER BY s.relevance_score DESC`,
        [askId]
      );
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].file_id).toBe(fileId);
      expect(result.rows[0].chunk_excerpt).toBe('Test chunk excerpt...');
      expect(result.rows[0].relevance_score).toBe(0.85);
      
      // Cleanup
      await cleanupTestAskContext({ userId, fileId, chunkId, askId });
    });
  });
  
  describe('Foreign key constraints', () => {
    test('ask_sources should have foreign key to files', async () => {
      const result = await pool.query(`
        SELECT
          tc.constraint_name, 
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'ask_sources'
          AND kcu.column_name = 'file_id'
      `);
      
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].foreign_table_name).toBe('files');
      expect(result.rows[0].foreign_column_name).toBe('id');
    });
  });
});

// Helper functions
async function createTestUser() {
  const result = await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ('Schema Test User', 'schema-test-${Date.now()}@example.com', 'hashed_password', 'User')
     RETURNING id`,
  );
  return result.rows[0].id;
}

async function createTestAskContext() {
  const userId = await createTestUser();
  
  const fileResult = await pool.query(
    `INSERT INTO files (user_id, original_name, mime_type, size_bytes, storage_path, status)
     VALUES ($1, 'test.txt', 'text/plain', 100, '/test/path.txt', 'ready')
     RETURNING id`,
    [userId]
  );
  const fileId = fileResult.rows[0].id;
  
  const chunkResult = await pool.query(
    `INSERT INTO chunks (file_id, chunk_index, chunk_text, embedding)
     VALUES ($1, 0, 'Test chunk text', NULL)
     RETURNING id`,
    [fileId]
  );
  const chunkId = chunkResult.rows[0].id;
  
  const askResult = await pool.query(
    `INSERT INTO asks (user_id, question, status)
     VALUES ($1, 'Test question', 'pending')
     RETURNING id`,
    [userId]
  );
  const askId = askResult.rows[0].id;
  
  return { userId, fileId, chunkId, askId };
}

async function cleanupTestAskContext({ userId, fileId, chunkId, askId }) {
  await pool.query('DELETE FROM ask_sources WHERE ask_id = $1', [askId]);
  await pool.query('DELETE FROM asks WHERE id = $1', [askId]);
  await pool.query('DELETE FROM chunks WHERE id = $1', [chunkId]);
  await pool.query('DELETE FROM files WHERE id = $1', [fileId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}
