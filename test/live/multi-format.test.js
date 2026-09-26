/**
 * Live Multi-Format API Tests
 * 
 * Tests against live deployment: https://knowledge-ask-api-v2-fixed.onrender.com
 * 
 * Test coverage:
 * 1. XLSX files are accepted and processed successfully with chunks
 * 2. Files with 0 chunks are marked as error (not ready)
 * 3. PNG/JPG files fail with clear error message
 * 4. All textful formats (PDF, DOCX, CSV, XLSX, TXT) work correctly
 * 5. Ask endpoint works when ready files exist
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const API_BASE = process.env.LIVE_API_BASE || 'https://knowledge-ask-api-v2-fixed.onrender.com';
const MAX_POLL_ATTEMPTS = 40;
const POLL_INTERVAL_MS = 3000;

let authToken;
let testUserId;

/**
 * Poll a file until it reaches a terminal status (ready or error)
 */
async function pollFileStatus(fileId, token) {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const response = await fetch(`${API_BASE}/api/files/${fileId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file status: ${response.status}`);
    }
    
    const data = await response.json();
    const status = data.file.status;
    
    console.log(`  Poll ${i + 1}/${MAX_POLL_ATTEMPTS}: File ${fileId} status = ${status}, chunks = ${data.file.chunkCount}`);
    
    if (status === 'ready' || status === 'error') {
      return data.file;
    }
    
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  
  throw new Error(`File ${fileId} did not reach terminal status after ${MAX_POLL_ATTEMPTS} polls`);
}

/**
 * Get MIME type for a file based on extension
 */
function getMimeType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const mimeTypes = {
    'txt': 'text/plain',
    'md': 'text/markdown',
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'csv': 'text/csv',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Upload a file and poll until terminal status
 */
async function uploadAndPoll(fileName, token) {
  const filePath = path.join('test/fixtures', fileName);
  const fileBuffer = fs.readFileSync(filePath);
  
  const formData = new FormData();
  const mimeType = getMimeType(fileName);
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append('file', blob, fileName);
  
  console.log(`\n📤 Uploading ${fileName} (${mimeType})...`);
  const uploadResponse = await fetch(`${API_BASE}/api/files`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
  }
  
  const uploadData = await uploadResponse.json();
  const fileId = uploadData.file.id;
  console.log(`✅ Uploaded as file ID ${fileId}`);
  
  const finalFile = await pollFileStatus(fileId, token);
  console.log(`✅ Final status: ${finalFile.status}, chunks: ${finalFile.chunkCount}, error: ${finalFile.errorMessage || 'none'}`);
  
  return finalFile;
}

/**
 * Test asking a question
 */
async function askQuestion(question, token) {
  console.log(`\n❓ Asking: "${question}"`);
  const response = await fetch(`${API_BASE}/api/ask`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ question })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ask failed (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  console.log(`✅ Answer received, sources: ${data.sources.length}`);
  return data;
}

describe('Live Multi-Format API Tests', () => {
  
  beforeAll(async () => {
    // Check if API is reachable
    console.log(`\n🌐 Testing against: ${API_BASE}`);
    const healthResponse = await fetch(`${API_BASE}/health`);
    
    if (!healthResponse.ok) {
      throw new Error(`Live API is not reachable at ${API_BASE}. Status: ${healthResponse.status}`);
    }
    
    console.log('✅ Live API is reachable');
    
    // Register a test user
    const timestamp = Date.now();
    const testEmail = `live-test-${timestamp}@example.com`;
    
    console.log(`\n👤 Registering test user: ${testEmail}`);
    const registerResponse = await fetch(`${API_BASE}/api/authentication/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Live Test User',
        email: testEmail,
        password: 'TestPass123!',
        role: 'User'
      })
    });
    
    if (!registerResponse.ok) {
      const errorText = await registerResponse.text();
      throw new Error(`Registration failed: ${registerResponse.status} ${errorText}`);
    }
    
    const registerData = await registerResponse.json();
    testUserId = registerData.user.id;
    console.log(`✅ Registered user ID: ${testUserId}`);
    
    // Login
    console.log('🔐 Logging in...');
    const loginResponse = await fetch(`${API_BASE}/api/authentication/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'TestPass123!'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    authToken = loginData.token;
    console.log('✅ Logged in successfully');
  }, 30000);
  
  test('TXT file should process successfully with chunks', async () => {
    const file = await uploadAndPoll('smoke-test.txt', authToken);
    
    expect(file.status).toBe('ready');
    expect(file.chunkCount).toBeGreaterThan(0);
  }, 150000);
  
  test('CSV file should process successfully with chunks', async () => {
    const file = await uploadAndPoll('sample-data.csv', authToken);
    
    expect(file.status).toBe('ready');
    expect(file.chunkCount).toBeGreaterThan(0);
  }, 150000);
  
  test('DOCX file should process successfully with chunks', async () => {
    const file = await uploadAndPoll('sample.docx', authToken);
    
    expect(file.status).toBe('ready');
    expect(file.chunkCount).toBeGreaterThan(0);
  }, 150000);
  
  test('XLSX file (sample-a) should process successfully with chunks', async () => {
    const file = await uploadAndPoll('sample-a.xlsx', authToken);
    
    expect(file.status).toBe('ready');
    expect(file.chunkCount).toBeGreaterThan(0);
  }, 150000);
  
  test('XLSX file (sample-b) should process successfully with chunks', async () => {
    const file = await uploadAndPoll('sample-b.xlsx', authToken);
    
    expect(file.status).toBe('ready');
    expect(file.chunkCount).toBeGreaterThan(0);
  }, 150000);
  
  test('Textful PDF should process successfully with chunks', async () => {
    const file = await uploadAndPoll('textful-pdf-russel.pdf', authToken);
    
    expect(file.status).toBe('ready');
    expect(file.chunkCount).toBeGreaterThan(0);
  }, 150000);
  
  test('Scanned PDF (Motlatsi) should fail with 0-chunks error', async () => {
    const file = await uploadAndPoll('scanned-pdf-motlatsi.pdf', authToken);
    
    expect(file.status).toBe('error');
    expect(file.chunkCount).toBe(0);
    expect(file.errorMessage).toBeDefined();
    expect(file.errorMessage).toMatch(/no extractable text|empty|scanned/i);
  }, 150000);
  
  test('PNG file should fail with clear error message', async () => {
    const file = await uploadAndPoll('image.png', authToken);
    
    expect(file.status).toBe('error');
    expect(file.chunkCount).toBe(0);
    expect(file.errorMessage).toBeDefined();
    expect(file.errorMessage).toMatch(/image.*not supported|OCR/i);
  }, 150000);
  
  test('Ask endpoint should work when ready files exist', async () => {
    const result = await askQuestion('What information is available in the documents?', authToken);
    
    expect(result.answer).toBeDefined();
    expect(typeof result.answer).toBe('string');
    expect(result.answer.length).toBeGreaterThan(0);
    expect(result.sources).toBeDefined();
    expect(result.sources.length).toBeGreaterThan(0);
    
    // Should NOT contain "upload documents first" message when ready files exist
    expect(result.answer.toLowerCase()).not.toMatch(/upload documents? first|no documents? uploaded/);
  }, 60000);
  
  test('Ask endpoint should provide relevant sources from ready files', async () => {
    const result = await askQuestion('Summarize the key points from the documents', authToken);
    
    expect(result.sources).toBeDefined();
    expect(Array.isArray(result.sources)).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
    
    // Each source should have expected structure
    result.sources.forEach(source => {
      expect(source.fileId).toBeDefined();
      expect(source.fileName).toBeDefined();
      expect(source.chunkText).toBeDefined();
    });
  }, 60000);
  
  test('Large PDF should process successfully', async () => {
    const file = await uploadAndPoll('large-pdf.pdf', authToken);
    
    expect(file.status).toBe('ready');
    expect(file.chunkCount).toBeGreaterThan(0);
  }, 300000);
});
