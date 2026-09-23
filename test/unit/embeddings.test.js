/**
 * Unit tests for embeddings service
 */

import { describe, test, expect } from '@jest/globals';
import { generateEmbedding, cosineSimilarity } from '../../services/embeddings.js';

describe('Embeddings Service', () => {
  test('generateEmbedding returns 384-dimensional vector', async () => {
    const text = 'This is a test sentence';
    const embedding = await generateEmbedding(text);
    
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBe(384);
    expect(embedding.every(val => typeof val === 'number')).toBe(true);
  });
  
  test('generateEmbedding is deterministic for same input', async () => {
    const text = 'Machine learning is fascinating';
    const embedding1 = await generateEmbedding(text);
    const embedding2 = await generateEmbedding(text);
    
    expect(embedding1).toEqual(embedding2);
  });
  
  test('generateEmbedding produces different vectors for different text', async () => {
    const text1 = 'Machine learning';
    const text2 = 'Deep learning';
    const embedding1 = await generateEmbedding(text1);
    const embedding2 = await generateEmbedding(text2);
    
    expect(embedding1).not.toEqual(embedding2);
  });
  
  test('cosineSimilarity returns 1 for identical vectors', () => {
    const vec = [0.5, 0.5, 0.5, 0.5];
    const similarity = cosineSimilarity(vec, vec);
    
    expect(similarity).toBeCloseTo(1.0, 5);
  });
  
  test('cosineSimilarity returns value between -1 and 1', () => {
    const vec1 = [1, 0, 0, 0];
    const vec2 = [0, 1, 0, 0];
    const similarity = cosineSimilarity(vec1, vec2);
    
    expect(similarity).toBeGreaterThanOrEqual(-1);
    expect(similarity).toBeLessThanOrEqual(1);
  });
  
  test('cosineSimilarity throws error for different length vectors', () => {
    const vec1 = [1, 2, 3];
    const vec2 = [1, 2];
    
    expect(() => cosineSimilarity(vec1, vec2)).toThrow();
  });
});
