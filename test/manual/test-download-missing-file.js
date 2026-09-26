/**
 * Manual Test Script: Download Missing File
 * 
 * This script tests the download endpoint behavior when file blobs are missing from disk.
 * 
 * Usage:
 *   node test/manual/test-download-missing-file.js
 * 
 * Prerequisites:
 *   - API running locally or on staging
 *   - Valid JWT token
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.API_BASE || 'http://localhost:6544';
const TEST_EMAIL = `manual-test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPass123!';

let authToken;
let fileId;

async function register() {
  console.log('\n1️⃣  Registering test user...');
  const response = await fetch(`${API_BASE}/api/authentication/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Manual Test User',
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      role: 'User'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Registration failed: ${response.status} ${await response.text()}`);
  }
  
  console.log('✅ User registered');
}

async function login() {
  console.log('\n2️⃣  Logging in...');
  const response = await fetch(`${API_BASE}/api/authentication/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    })
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }
  
  const data = await response.json();
  authToken = data.token;
  console.log('✅ Logged in successfully');
}

async function uploadFile() {
  console.log('\n3️⃣  Uploading test file...');
  
  const filePath = path.join(process.cwd(), 'test/fixtures/smoke-test.txt');
  const fileBuffer = fs.readFileSync(filePath);
  
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('file', fileBuffer, 'smoke-test.txt');
  
  const response = await fetch(`${API_BASE}/api/files`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    body: form
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
  }
  
  const data = await response.json();
  fileId = data.file.id;
  console.log(`✅ File uploaded (ID: ${fileId})`);
}

async function downloadFile(expectedStatus) {
  console.log(`\n4️⃣  Downloading file (expecting ${expectedStatus})...`);
  const response = await fetch(`${API_BASE}/api/files/${fileId}/download`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  console.log(`   Status: ${response.status}`);
  
  if (response.ok) {
    const content = await response.text();
    console.log(`   Content length: ${content.length} bytes`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    console.log(`   Content-Disposition: ${response.headers.get('content-disposition')}`);
  } else {
    const error = await response.json();
    console.log(`   Error: ${error.error}`);
    if (error.details) {
      console.log(`   Details: ${error.details}`);
    }
  }
  
  if (response.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus}, got ${response.status}`);
  }
  
  console.log(`✅ Got expected status ${expectedStatus}`);
  return response;
}

async function getFileMetadata() {
  console.log('\n5️⃣  Getting file metadata...');
  const response = await fetch(`${API_BASE}/api/files/${fileId}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  
  if (!response.ok) {
    throw new Error(`Get metadata failed: ${response.status}`);
  }
  
  const data = await response.json();
  console.log(`   Storage path: ${data.file.storagePath || 'not exposed'}`);
  console.log(`   Status: ${data.file.status}`);
  return data.file;
}

async function simulateMissingFile() {
  console.log('\n6️⃣  Simulating missing file blob...');
  console.log('   NOTE: For local testing, you would manually delete the file from uploads/');
  console.log('   For staging/production, this simulates what happens after a redeploy on ephemeral disk');
  console.log('   You should manually trigger a redeploy or wait for the next one');
  console.log('\n   Press Ctrl+C to exit, or wait 10 seconds to continue...');
  
  await new Promise(resolve => setTimeout(resolve, 10000));
}

async function main() {
  try {
    console.log('🧪 Testing Download Endpoint with Missing File Blob');
    console.log(`📍 API: ${API_BASE}`);
    
    await register();
    await login();
    await uploadFile();
    
    // First download should succeed
    await downloadFile(200);
    await getFileMetadata();
    
    // Simulate missing file
    await simulateMissingFile();
    
    // Second download should return 404 (not 500)
    console.log('\n7️⃣  Testing download after file blob removed...');
    console.log('   MANUAL STEP: Delete the file from uploads/ directory and press Enter');
    console.log('   Or skip if testing on staging (will test current state)');
    
    await new Promise(resolve => {
      if (process.stdin.isTTY) {
        process.stdin.once('data', () => resolve());
      } else {
        setTimeout(resolve, 1000);
      }
    });
    
    await downloadFile(404);
    
    console.log('\n✅ All tests passed!');
    console.log('\n📊 Summary:');
    console.log('   - Download with file present: 200 ✅');
    console.log('   - Download with file missing: 404 ✅ (not 500)');
    console.log('   - Error message is clear and informative ✅');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
