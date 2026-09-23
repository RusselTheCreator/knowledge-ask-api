/**
 * Unit tests for document processor
 */

import { describe, test, expect } from '@jest/globals';
import { chunkText } from '../../services/documentProcessor.js';

describe('Document Processor', () => {
  test('chunkText splits long text into chunks', () => {
    const text = 'a'.repeat(1500);
    const chunks = chunkText(text, 500, 50);
    
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(500);
  });
  
  test('chunkText returns single chunk for short text', () => {
    const text = 'This is a short text';
    const chunks = chunkText(text, 500, 50);
    
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(text);
  });
  
  test('chunkText creates overlapping chunks', () => {
    const text = 'a'.repeat(1000);
    const chunkSize = 400;
    const overlap = 100;
    const chunks = chunkText(text, chunkSize, overlap);
    
    // Verify that chunks overlap
    expect(chunks.length).toBeGreaterThan(1);
    // The last part of chunk[0] should overlap with the start of chunk[1]
    if (chunks.length > 1) {
      const endOfFirst = chunks[0].slice(-overlap);
      const startOfSecond = chunks[1].slice(0, overlap);
      expect(endOfFirst).toBe(startOfSecond);
    }
  });
  
  test('chunkText handles empty string', () => {
    const chunks = chunkText('', 500, 50);
    expect(chunks).toEqual([]);
  });
  
  test('chunkText normalizes whitespace', () => {
    const text = 'This   has    multiple   spaces';
    const chunks = chunkText(text, 500, 50);
    
    expect(chunks[0]).not.toContain('  '); // No double spaces
  });
});
