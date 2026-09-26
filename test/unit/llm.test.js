/**
 * Unit tests for LLM service with Bedrock provider
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { generateAnswer } from '../../services/llm.js';

describe('LLM Service - Bedrock Provider', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
  
  test('generateAnswer with bedrock provider requires AWS credentials', async () => {
    process.env.LLM_PROVIDER = 'bedrock';
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    
    const chunks = [
      { chunk_text: 'Test content', file_name: 'test.txt', chunk_id: 1 }
    ];
    
    await expect(generateAnswer('test question', chunks))
      .rejects.toThrow('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required');
  });
  
  test('generateAnswer falls back to mock when provider is unknown', async () => {
    process.env.LLM_PROVIDER = 'unknown-provider';
    
    const chunks = [
      { chunk_text: 'Machine learning is a subset of AI', file_name: 'ml.txt', chunk_id: 1 }
    ];
    
    const answer = await generateAnswer('What is machine learning?', chunks);
    
    expect(typeof answer).toBe('string');
    expect(answer.length).toBeGreaterThan(0);
    expect(answer).toContain('ml.txt');
  });
  
  test('generateAnswer with mock provider returns formatted answer', async () => {
    process.env.LLM_PROVIDER = 'mock';
    
    const chunks = [
      { chunk_text: 'The sky is blue due to Rayleigh scattering', file_name: 'physics.txt', chunk_id: 1 },
      { chunk_text: 'Light waves interact with atmospheric particles', file_name: 'optics.txt', chunk_id: 2 }
    ];
    
    const answer = await generateAnswer('Why is the sky blue?', chunks);
    
    expect(typeof answer).toBe('string');
    expect(answer).toContain('physics.txt');
    expect(answer).toContain('Rayleigh scattering');
  });
  
  test('generateAnswer handles empty chunks gracefully', async () => {
    process.env.LLM_PROVIDER = 'mock';
    
    const answer = await generateAnswer('test question', []);
    
    expect(answer).toContain("don't have enough information");
  });
});

describe('LLM Service - Mock Provider', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.LLM_PROVIDER = 'mock';
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
  
  test('mock provider includes source citations in answer', async () => {
    const chunks = [
      { chunk_text: 'First chunk content here', file_name: 'doc1.txt', chunk_id: 1 },
      { chunk_text: 'Second chunk content here', file_name: 'doc2.txt', chunk_id: 2 },
      { chunk_text: 'Third chunk content here', file_name: 'doc3.txt', chunk_id: 3 }
    ];
    
    const answer = await generateAnswer('test question', chunks);
    
    expect(answer).toContain('Source 1');
    expect(answer).toContain('doc1.txt');
    expect(answer).toContain('Source 2');
    expect(answer).toContain('doc2.txt');
    expect(answer).toContain('Source 3');
    expect(answer).toContain('doc3.txt');
  });
  
  test('mock provider limits to top 3 chunks in response', async () => {
    const chunks = [
      { chunk_text: 'Content 1', file_name: 'doc1.txt', chunk_id: 1 },
      { chunk_text: 'Content 2', file_name: 'doc2.txt', chunk_id: 2 },
      { chunk_text: 'Content 3', file_name: 'doc3.txt', chunk_id: 3 },
      { chunk_text: 'Content 4', file_name: 'doc4.txt', chunk_id: 4 },
      { chunk_text: 'Content 5', file_name: 'doc5.txt', chunk_id: 5 }
    ];
    
    const answer = await generateAnswer('test question', chunks);
    
    expect(answer).toContain('Source 1');
    expect(answer).toContain('Source 2');
    expect(answer).toContain('Source 3');
    expect(answer).not.toContain('doc4.txt');
    expect(answer).not.toContain('doc5.txt');
    expect(answer).toContain('5 relevant document chunk');
  });
});
