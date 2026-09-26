/**
 * Unit tests for document processor
 */

import { describe, test, expect } from '@jest/globals';
import { chunkText, extractText } from '../../services/documentProcessor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, '..', 'fixtures');

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
  
  describe('extractText', () => {
    test('extracts text from PDF with content', async () => {
      const filePath = path.join(fixturesDir, 'textful-pdf-russel.pdf');
      const text = await extractText(filePath, 'application/pdf');
      
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(100);
      expect(text.replace(/\s+/g, '').length).toBeGreaterThan(50);
    });
    
    test('extracts minimal text from scanned PDF (no OCR)', async () => {
      const filePath = path.join(fixturesDir, 'scanned-pdf-motlatsi.pdf');
      const text = await extractText(filePath, 'application/pdf');
      
      // Scanned PDF may have some whitespace but no real text content (OCR not implemented)
      const stripped = text.replace(/\s+/g, '');
      expect(stripped.length).toBeLessThan(10);
    });
    
    test('extracts text from DOCX', async () => {
      const filePath = path.join(fixturesDir, 'sample.docx');
      const text = await extractText(filePath, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(0);
    });
    
    test('extracts text from plain text file', async () => {
      const filePath = path.join(fixturesDir, 'sample.txt');
      const text = await extractText(filePath, 'text/plain');
      
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(0);
    });
    
    test('rejects image files with clear error', async () => {
      const filePath = path.join(fixturesDir, 'image.png');
      
      await expect(
        extractText(filePath, 'image/png')
      ).rejects.toThrow('Image files are not supported until OCR functionality is added');
    });
  });
});
