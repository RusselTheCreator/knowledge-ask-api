/**
 * Playwright E2E Tests
 * 
 * Tests the API using Playwright's APIRequestContext
 * Also tests the Swagger UI documentation page
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

let token;
let fileId;

test.describe('Knowledge Ask API E2E Tests', () => {
  test('should load Swagger documentation UI', async ({ page }) => {
    await page.goto('/api/docs');
    
    // Check that Swagger UI loaded
    await expect(page.locator('.swagger-ui').first()).toBeVisible();
    
    // Check for API title
    await expect(page.getByText('Knowledge Ask API')).toBeVisible();
  });
  
  test.skip('API Flow: Register → Login → Upload → Ask → Download', async ({ request }) => {
    // Step 1: Register a new user
    const registerEmail = `playwright-test-${Date.now()}@example.com`;
    
    const registerResponse = await request.post('/api/authentication/register', {
      data: {
        name: 'Playwright Test User',
        email: registerEmail,
        password: 'testpassword123',
        role: 'User'
      }
    });
    
    if (!registerResponse.ok()) {
      const errorData = await registerResponse.json();
      console.log('Registration failed:', registerResponse.status(), errorData);
    }
    expect(registerResponse.ok()).toBeTruthy();
    const registerData = await registerResponse.json();
    expect(registerData.user.email).toBe(registerEmail);
    
    // Step 2: Login
    const loginResponse = await request.post('/api/authentication/login', {
      data: {
        email: registerEmail,
        password: 'testpassword123'
      }
    });
    
    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    expect(loginData.token).toBeDefined();
    token = loginData.token;
    
    // Step 3: Upload a file
    const fileBuffer = fs.readFileSync('test/fixtures/sample.txt');
    
    const uploadResponse = await request.post('/api/files', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      multipart: {
        file: {
          name: 'sample.txt',
          mimeType: 'text/plain',
          buffer: fileBuffer
        }
      }
    });
    
    expect(uploadResponse.ok()).toBeTruthy();
    const uploadData = await uploadResponse.json();
    expect(uploadData.file.originalName).toBe('sample.txt');
    fileId = uploadData.file.id;
    
    // Wait for file processing (ingestion, chunking, embedding)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 4: List files
    const listResponse = await request.get('/api/files', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(listResponse.ok()).toBeTruthy();
    const listData = await listResponse.json();
    expect(listData.files.length).toBeGreaterThan(0);
    
    // Step 5: Get file metadata
    const metadataResponse = await request.get(`/api/files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(metadataResponse.ok()).toBeTruthy();
    const metadataData = await metadataResponse.json();
    expect(metadataData.file.status).toBe('ready');
    
    // Step 6: Ask a question
    const askResponse = await request.post('/api/ask', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        question: 'What are the types of machine learning?'
      }
    });
    
    expect(askResponse.ok()).toBeTruthy();
    const askData = await askResponse.json();
    expect(askData.answer).toBeDefined();
    expect(askData.sources).toBeDefined();
    expect(askData.sources.length).toBeGreaterThan(0);
    expect(askData.askId).toBeDefined();
    
    // Step 7: Get ask history
    const historyResponse = await request.get('/api/ask/history', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(historyResponse.ok()).toBeTruthy();
    const historyData = await historyResponse.json();
    expect(historyData.asks.length).toBeGreaterThan(0);
    
    // Step 8: Download the file
    const downloadResponse = await request.get(`/api/files/${fileId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(downloadResponse.ok()).toBeTruthy();
    const downloadedContent = await downloadResponse.text();
    expect(downloadedContent).toContain('Machine learning');
    
    // Step 9: Delete the file
    const deleteResponse = await request.delete(`/api/files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    expect(deleteResponse.ok()).toBeTruthy();
  });
  
  test('should enforce authentication', async ({ request }) => {
    // Try to access protected endpoint without token
    const response = await request.get('/api/files');
    expect(response.status()).toBe(401);
  });
  
  test.skip('should return proper error for invalid credentials', async ({ request }) => {
    const response = await request.post('/api/authentication/login', {
      data: {
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      }
    });
    
    if (response.status() !== 401) {
      const errorData = await response.text();
      console.log('Unexpected error:', response.status(), errorData);
    }
    expect(response.status()).toBe(401);
  });
});
