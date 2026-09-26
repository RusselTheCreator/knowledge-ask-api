/**
 * API Integration Tests
 * 
 * These tests verify the complete API flow:
 * - Authentication (register, login)
 * - File operations (upload, list, download, delete)
 * - Ask/Q&A (question answering, history)
 * - Authorization and access control
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../index.js';
import pool from '../../database/db.js';
import fs from 'fs/promises';
import path from 'path';

// Test data
let testUser1Token;
let testUser2Token;
let adminToken;
let testUser1Id;
let testUser2Id;
let testFileId;

beforeAll(async () => {
  // Clean up test data
  await pool.query("DELETE FROM users WHERE email LIKE '%test-%'");
  
  // Wait a bit for database to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
});

afterAll(async () => {
  // Clean up test data
  await pool.query("DELETE FROM users WHERE email LIKE '%test-%'");
  await pool.end();
});

describe('Authentication API', () => {
  test('POST /api/authentication/register - should register a new user', async () => {
    const response = await request(app)
      .post('/api/authentication/register')
      .send({
        name: 'Test User 1',
        email: 'test-user1@example.com',
        password: 'password123',
        role: 'User'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.message).toContain('registered successfully');
    expect(response.body.user.email).toBe('test-user1@example.com');
    testUser1Id = response.body.user.id;
  });
  
  test('POST /api/authentication/register - should reject duplicate email', async () => {
    const response = await request(app)
      .post('/api/authentication/register')
      .send({
        name: 'Test User 1',
        email: 'test-user1@example.com',
        password: 'password123'
      });
    
    expect(response.status).toBe(409);
    expect(response.body.error).toContain('already registered');
  });
  
  test('POST /api/authentication/register - should reject invalid email', async () => {
    const response = await request(app)
      .post('/api/authentication/register')
      .send({
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123'
      });
    
    expect(response.status).toBe(400);
  });
  
  test('POST /api/authentication/login - should login successfully', async () => {
    const response = await request(app)
      .post('/api/authentication/login')
      .send({
        email: 'test-user1@example.com',
        password: 'password123'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.message).toContain('Login successful');
    expect(response.body.token).toBeDefined();
    testUser1Token = response.body.token;
  });
  
  test('POST /api/authentication/login - should reject wrong password', async () => {
    const response = await request(app)
      .post('/api/authentication/login')
      .send({
        email: 'test-user1@example.com',
        password: 'wrongpassword'
      });
    
    expect(response.status).toBe(401);
  });
  
  // Register second user for isolation tests
  test('POST /api/authentication/register - should register second user', async () => {
    const response = await request(app)
      .post('/api/authentication/register')
      .send({
        name: 'Test User 2',
        email: 'test-user2@example.com',
        password: 'password123',
        role: 'User'
      });
    
    expect(response.status).toBe(201);
    testUser2Id = response.body.user.id;
    
    // Login as user 2
    const loginResponse = await request(app)
      .post('/api/authentication/login')
      .send({
        email: 'test-user2@example.com',
        password: 'password123'
      });
    
    testUser2Token = loginResponse.body.token;
  });
});

describe('Files API', () => {
  test('POST /api/files - should reject unauthenticated upload', async () => {
    const response = await request(app)
      .post('/api/files')
      .attach('file', 'test/fixtures/sample.txt');
    
    expect(response.status).toBe(401);
  });
  
  test('POST /api/files - should upload a file', async () => {
    const response = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${testUser1Token}`)
      .attach('file', 'test/fixtures/sample.txt');
    
    expect(response.status).toBe(201);
    expect(response.body.message).toContain('uploaded successfully');
    expect(response.body.file.originalName).toBe('sample.txt');
    testFileId = response.body.file.id;
  });
  
  test('GET /api/files - should list user files', async () => {
    // Wait for file processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer ${testUser1Token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.files).toBeDefined();
    expect(response.body.files.length).toBeGreaterThan(0);
  });
  
  test('GET /api/files/:id - should get file metadata', async () => {
    const response = await request(app)
      .get(`/api/files/${testFileId}`)
      .set('Authorization', `Bearer ${testUser1Token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.file.id).toBe(testFileId);
  });
  
  test('GET /api/files/:id - should reject access to other user file', async () => {
    const response = await request(app)
      .get(`/api/files/${testFileId}`)
      .set('Authorization', `Bearer ${testUser2Token}`);
    
    expect(response.status).toBe(404);
  });
  
  test('GET /api/files/:id/download - should download file', async () => {
    const response = await request(app)
      .get(`/api/files/${testFileId}/download`)
      .set('Authorization', `Bearer ${testUser1Token}`);
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.body).toBeDefined();
  });
  
  test('GET /api/files/:id/download - should return 404 when file blob missing on disk', async () => {
    // Upload a file first
    const uploadResponse = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${testUser1Token}`)
      .attach('file', 'test/fixtures/sample.csv');
    
    expect(uploadResponse.status).toBe(201);
    const missingFileId = uploadResponse.body.file.id;
    
    // Get the file metadata to find storage path
    const metadataResult = await pool.query(
      'SELECT storage_path FROM files WHERE id = $1',
      [missingFileId]
    );
    const storagePath = metadataResult.rows[0].storage_path;
    
    // Delete the actual file from disk (simulating ephemeral storage loss)
    await fs.unlink(storagePath).catch(() => {});
    
    // Try to download - should get 404, not 500
    const downloadResponse = await request(app)
      .get(`/api/files/${missingFileId}/download`)
      .set('Authorization', `Bearer ${testUser1Token}`);
    
    expect(downloadResponse.status).toBe(404);
    expect(downloadResponse.body.error).toContain('content is no longer available');
    
    // Clean up metadata
    await pool.query('DELETE FROM files WHERE id = $1', [missingFileId]);
  });
  
  test('GET /api/files/:id/download - should reject access to other user file', async () => {
    const response = await request(app)
      .get(`/api/files/${testFileId}/download`)
      .set('Authorization', `Bearer ${testUser2Token}`);
    
    expect(response.status).toBe(404);
    expect(response.body.error).toContain('not found or access denied');
  });
});

describe('Ask API', () => {
  test('POST /api/ask - should answer question about uploaded documents', async () => {
    // Wait for file to be fully processed
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const response = await request(app)
      .post('/api/ask')
      .set('Authorization', `Bearer ${testUser1Token}`)
      .send({
        question: 'What is machine learning?'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.answer).toBeDefined();
    expect(response.body.sources).toBeDefined();
    expect(response.body.askId).toBeDefined();
  });
  
  test('POST /api/ask - should not find documents for user without files', async () => {
    const response = await request(app)
      .post('/api/ask')
      .set('Authorization', `Bearer ${testUser2Token}`)
      .send({
        question: 'What is machine learning?'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.sources.length).toBe(0);
  });
  
  test('POST /api/ask - should reject empty question', async () => {
    const response = await request(app)
      .post('/api/ask')
      .set('Authorization', `Bearer ${testUser1Token}`)
      .send({
        question: ''
      });
    
    expect(response.status).toBe(400);
  });
  
  test('GET /api/ask/history - should get ask history', async () => {
    const response = await request(app)
      .get('/api/ask/history')
      .set('Authorization', `Bearer ${testUser1Token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.asks).toBeDefined();
    expect(response.body.asks.length).toBeGreaterThan(0);
  });
});

describe('Authorization & Access Control', () => {
  test('Should isolate files between users', async () => {
    // User 1 uploads a file
    const upload1 = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${testUser1Token}`)
      .attach('file', 'test/fixtures/sample.md');
    
    const file1Id = upload1.body.file.id;
    
    // User 2 tries to access User 1's file
    const response = await request(app)
      .get(`/api/files/${file1Id}`)
      .set('Authorization', `Bearer ${testUser2Token}`);
    
    expect(response.status).toBe(404);
  });
  
  test('Should isolate ask history between users', async () => {
    // User 1's history
    const response1 = await request(app)
      .get('/api/ask/history')
      .set('Authorization', `Bearer ${testUser1Token}`);
    
    // User 2's history
    const response2 = await request(app)
      .get('/api/ask/history')
      .set('Authorization', `Bearer ${testUser2Token}`);
    
    expect(response1.body.asks.length).toBeGreaterThan(0);
    
    // User 2 should not see User 1's asks
    // Each user's asks are isolated
    const user1AskIds = response1.body.asks.map(ask => ask.id);
    const user2AskIds = response2.body.asks.map(ask => ask.id);
    
    // No overlap in ask IDs
    const overlap = user1AskIds.filter(id => user2AskIds.includes(id));
    expect(overlap.length).toBe(0);
  });
});

describe('Health & Documentation', () => {
  test('GET / - should return API info', async () => {
    const response = await request(app).get('/');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });
  
  test('GET /health - should return health status', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
