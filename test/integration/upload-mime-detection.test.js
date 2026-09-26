/**
 * Integration test for MIME type detection on upload
 * 
 * Tests that:
 * 1. Files with wrong Content-Type still get detected correctly
 * 2. Blank/scanned PDFs fail-closed with error status
 * 3. Response shapes are consistent (camelCase)
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../index.js';
import pool from '../../database/db.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, '..', 'fixtures');

let authToken;
let userId;

beforeAll(async () => {
  // Register a test user
  const registerResponse = await request(app)
    .post('/api/authentication/register')
    .send({
      name: 'MIME Test User',
      email: `mime-test-${Date.now()}@test.com`,
      password: 'mime-Integration-Test-9.credential',
      role: 'User'
    });
  
  expect(registerResponse.status).toBe(201);
  authToken = registerResponse.body.token;
  userId = registerResponse.body.user.id;
});

afterAll(async () => {
  // Clean up test user and files
  if (userId) {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }
  await pool.end();
});

describe('MIME Detection on Upload', () => {
  test('should detect PDF MIME from extension when client sends wrong Content-Type', async () => {
    const filePath = path.join(fixturesDir, 'textful-pdf-russel.pdf');
    const fileBuffer = await fs.readFile(filePath);
    
    // Create a FormData-like upload with WRONG Content-Type
    const response = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', fileBuffer, {
        filename: 'test.pdf',
        contentType: 'text/plain'  // WRONG - should be application/pdf
      });
    
    expect(response.status).toBe(201);
    expect(response.body.file.mimeType).toBe('application/pdf');  // Correctly detected
    
    const fileId = response.body.file.id;
    
    // Wait for ingestion to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check file status - should be ready
    const fileResponse = await request(app)
      .get(`/api/files/${fileId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(fileResponse.status).toBe(200);
    expect(fileResponse.body.file.status).toBe('ready');
    expect(fileResponse.body.file.mimeType).toBe('application/pdf');
    expect(fileResponse.body.file.chunkCount).toBeGreaterThan(0);
  });
  
  test('should detect DOCX MIME from extension when client sends wrong Content-Type', async () => {
    const filePath = path.join(fixturesDir, 'sample.docx');
    const fileBuffer = await fs.readFile(filePath);
    
    const response = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', fileBuffer, {
        filename: 'test.docx',
        contentType: 'text/plain'  // WRONG
      });
    
    expect(response.status).toBe(201);
    expect(response.body.file.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    
    const fileId = response.body.file.id;
    
    // Wait for ingestion
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const fileResponse = await request(app)
      .get(`/api/files/${fileId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(fileResponse.status).toBe(200);
    expect(fileResponse.body.file.status).toBe('ready');
  });
  
  test('should detect XLSX MIME from extension when client sends wrong Content-Type', async () => {
    const filePath = path.join(fixturesDir, 'sample-a.xlsx');
    const fileBuffer = await fs.readFile(filePath);
    
    const response = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', fileBuffer, {
        filename: 'test.xlsx',
        contentType: 'text/plain'  // WRONG
      });
    
    expect(response.status).toBe(201);
    expect(response.body.file.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    const fileId = response.body.file.id;
    
    // Wait for ingestion
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const fileResponse = await request(app)
      .get(`/api/files/${fileId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(fileResponse.status).toBe(200);
    expect(fileResponse.body.file.status).toBe('ready');
  });
  
  test('should fail-closed for scanned PDF with no text content', async () => {
    const filePath = path.join(fixturesDir, 'scanned-pdf-motlatsi.pdf');
    const fileBuffer = await fs.readFile(filePath);
    
    const response = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', fileBuffer, {
        filename: 'scanned.pdf',
        contentType: 'application/pdf'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.file.mimeType).toBe('application/pdf');
    
    const fileId = response.body.file.id;
    
    // Wait for ingestion to fail
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check file status - should be error
    const fileResponse = await request(app)
      .get(`/api/files/${fileId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(fileResponse.status).toBe(200);
    expect(fileResponse.body.file.status).toBe('error');
    expect(fileResponse.body.file.errorMessage).toContain('No meaningful text content');
    expect(fileResponse.body.file.chunkCount).toBe(0);
  });
});

describe('Response Shape Consistency', () => {
  test('GET /api/files should return camelCase with errorMessage', async () => {
    const response = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.files).toBeDefined();
    
    if (response.body.files.length > 0) {
      const file = response.body.files[0];
      
      // Check camelCase fields
      expect(file.originalName).toBeDefined();
      expect(file.mimeType).toBeDefined();
      expect(file.sizeBytes).toBeDefined();
      expect(file.chunkCount).toBeDefined();
      expect(file.createdAt).toBeDefined();
      
      // errorMessage should be present (null for successful files)
      expect(file).toHaveProperty('errorMessage');
      
      // Should NOT have snake_case
      expect(file.original_name).toBeUndefined();
      expect(file.mime_type).toBeUndefined();
      expect(file.size_bytes).toBeUndefined();
      expect(file.chunk_count).toBeUndefined();
      expect(file.error_message).toBeUndefined();
    }
  });
  
  test('GET /api/files/:id should return camelCase', async () => {
    // Upload a file first
    const filePath = path.join(fixturesDir, 'sample.txt');
    const fileBuffer = await fs.readFile(filePath);
    
    const uploadResponse = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', fileBuffer, {
        filename: 'test.txt',
        contentType: 'text/plain'
      });
    
    const fileId = uploadResponse.body.file.id;
    
    // Get file details
    const response = await request(app)
      .get(`/api/files/${fileId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(response.status).toBe(200);
    const file = response.body.file;
    
    // Check camelCase
    expect(file.originalName).toBeDefined();
    expect(file.mimeType).toBeDefined();
    expect(file.sizeBytes).toBeDefined();
    expect(file.chunkCount).toBeDefined();
    expect(file.createdAt).toBeDefined();
    expect(file.errorMessage).toBeDefined();  // Should be null for successful
    
    // Should NOT have snake_case
    expect(file.original_name).toBeUndefined();
    expect(file.mime_type).toBeUndefined();
  });
  
  test('POST /api/ask sources should use camelCase', async () => {
    // Upload a document first
    const filePath = path.join(fixturesDir, 'sample.txt');
    const fileBuffer = await fs.readFile(filePath);
    
    await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', fileBuffer, {
        filename: 'ask-test.txt',
        contentType: 'text/plain'
      });
    
    // Wait for ingestion
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Ask a question
    const askResponse = await request(app)
      .post('/api/ask')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ question: 'What is this about?' });
    
    expect(askResponse.status).toBe(200);
    
    if (askResponse.body.sources && askResponse.body.sources.length > 0) {
      const source = askResponse.body.sources[0];
      
      // Check camelCase
      expect(source.fileId).toBeDefined();
      expect(source.fileName).toBeDefined();
      expect(source.chunkId).toBeDefined();
      expect(source.relevanceScore).toBeDefined();
      expect(source.excerpt).toBeDefined();
      
      // Should NOT have snake_case
      expect(source.file_id).toBeUndefined();
      expect(source.file_name).toBeUndefined();
      expect(source.chunk_excerpt).toBeUndefined();
    }
  });
  
  test('GET /api/ask/:id sources should use camelCase (match POST)', async () => {
    // Upload a document first
    const filePath = path.join(fixturesDir, 'sample.txt');
    const fileBuffer = await fs.readFile(filePath);
    
    await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', fileBuffer, {
        filename: 'ask-get-test.txt',
        contentType: 'text/plain'
      });
    
    // Wait for ingestion
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Ask a question
    const askResponse = await request(app)
      .post('/api/ask')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ question: 'Tell me about this' });
    
    const askId = askResponse.body.askId;
    
    // Get ask details
    const getResponse = await request(app)
      .get(`/api/ask/${askId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(getResponse.status).toBe(200);
    
    if (getResponse.body.ask.sources && getResponse.body.ask.sources.length > 0) {
      const source = getResponse.body.ask.sources[0];
      
      // Check camelCase (should match POST /api/ask)
      expect(source.fileId).toBeDefined();
      expect(source.fileName).toBeDefined();
      expect(source.chunkId).toBeDefined();
      expect(source.relevanceScore).toBeDefined();
      expect(source.excerpt).toBeDefined();
      
      // Should NOT have snake_case
      expect(source.file_id).toBeUndefined();
      expect(source.file_name).toBeUndefined();
      expect(source.chunk_excerpt).toBeUndefined();
    }
  });
});
