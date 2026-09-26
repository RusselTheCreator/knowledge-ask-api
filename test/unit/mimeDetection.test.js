/**
 * Unit tests for MIME type detection
 */

import { describe, test, expect } from '@jest/globals';
import { detectMimeType, __testing } from '../../utils/mimeDetection.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, '..', 'fixtures');

describe('MIME Type Detection', () => {
  describe('getMimeFromExtension', () => {
    test('detects PDF from extension', () => {
      const mime = __testing.getMimeFromExtension('document.pdf');
      expect(mime).toBe('application/pdf');
    });
    
    test('detects DOCX from extension', () => {
      const mime = __testing.getMimeFromExtension('document.docx');
      expect(mime).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });
    
    test('detects XLSX from extension', () => {
      const mime = __testing.getMimeFromExtension('spreadsheet.xlsx');
      expect(mime).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });
    
    test('detects PNG from extension', () => {
      const mime = __testing.getMimeFromExtension('image.png');
      expect(mime).toBe('image/png');
    });
    
    test('detects JPEG from extension', () => {
      const mime = __testing.getMimeFromExtension('image.jpeg');
      expect(mime).toBe('image/jpeg');
    });
    
    test('detects plain text from extension', () => {
      const mime = __testing.getMimeFromExtension('document.txt');
      expect(mime).toBe('text/plain');
    });
    
    test('detects markdown from extension', () => {
      const mime = __testing.getMimeFromExtension('document.md');
      expect(mime).toBe('text/markdown');
    });
    
    test('detects CSV from extension', () => {
      const mime = __testing.getMimeFromExtension('data.csv');
      expect(mime).toBe('text/csv');
    });
    
    test('returns null for unknown extension', () => {
      const mime = __testing.getMimeFromExtension('document.unknown');
      expect(mime).toBeNull();
    });
    
    test('is case-insensitive', () => {
      const mime = __testing.getMimeFromExtension('document.PDF');
      expect(mime).toBe('application/pdf');
    });
  });
  
  describe('hasMagicBytes', () => {
    test('detects PDF magic bytes', () => {
      const buffer = Buffer.from('%PDF-1.4\n');
      const hasPDF = __testing.hasMagicBytes(buffer, __testing.MAGIC_BYTES.pdf);
      expect(hasPDF).toBe(true);
    });
    
    test('detects PNG magic bytes', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const hasPNG = __testing.hasMagicBytes(buffer, __testing.MAGIC_BYTES.png);
      expect(hasPNG).toBe(true);
    });
    
    test('detects ZIP magic bytes', () => {
      const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
      const hasZIP = __testing.hasMagicBytes(buffer, __testing.MAGIC_BYTES.zip);
      expect(hasZIP).toBe(true);
    });
    
    test('returns false for wrong magic bytes', () => {
      const buffer = Buffer.from('Hello World');
      const hasPDF = __testing.hasMagicBytes(buffer, __testing.MAGIC_BYTES.pdf);
      expect(hasPDF).toBe(false);
    });
  });
  
  describe('detectMimeType', () => {
    test('detects PDF correctly', async () => {
      const filePath = path.join(fixturesDir, 'textful-pdf-russel.pdf');
      const mime = await detectMimeType(filePath, 'test.pdf', 'application/pdf');
      expect(mime).toBe('application/pdf');
    });
    
    test('detects PDF even when client sends wrong Content-Type', async () => {
      const filePath = path.join(fixturesDir, 'textful-pdf-russel.pdf');
      // Client claims it's text/plain, but we detect it's actually PDF
      const mime = await detectMimeType(filePath, 'test.pdf', 'text/plain');
      expect(mime).toBe('application/pdf');
    });
    
    test('detects DOCX correctly', async () => {
      const filePath = path.join(fixturesDir, 'sample.docx');
      const mime = await detectMimeType(filePath, 'test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(mime).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });
    
    test('detects DOCX even when client sends wrong Content-Type', async () => {
      const filePath = path.join(fixturesDir, 'sample.docx');
      const mime = await detectMimeType(filePath, 'test.docx', 'text/plain');
      expect(mime).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });
    
    test('detects XLSX correctly', async () => {
      const filePath = path.join(fixturesDir, 'sample-a.xlsx');
      const mime = await detectMimeType(filePath, 'test.xlsx', 'application/vnd.openxmlformats-officedoccument.spreadsheetml.sheet');
      expect(mime).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });
    
    test('detects PNG correctly', async () => {
      const filePath = path.join(fixturesDir, 'image.png');
      const mime = await detectMimeType(filePath, 'test.png', 'image/png');
      expect(mime).toBe('image/png');
    });
    
    test('detects plain text from extension', async () => {
      const filePath = path.join(fixturesDir, 'sample.txt');
      const mime = await detectMimeType(filePath, 'test.txt', 'text/plain');
      expect(mime).toBe('text/plain');
    });
    
    test('detects markdown from extension', async () => {
      const filePath = path.join(fixturesDir, 'sample.md');
      const mime = await detectMimeType(filePath, 'test.md', 'text/markdown');
      expect(mime).toBe('text/markdown');
    });
    
    test('rejects file with extension mismatch', async () => {
      const filePath = path.join(fixturesDir, 'textful-pdf-russel.pdf');
      // File is PDF but extension says PNG
      await expect(
        detectMimeType(filePath, 'test.png', 'image/png')
      ).rejects.toThrow('magic bytes');
    });
    
    test('rejects unsupported extension', async () => {
      const filePath = path.join(fixturesDir, 'sample.txt');
      await expect(
        detectMimeType(filePath, 'test.exe', 'application/x-msdownload')
      ).rejects.toThrow('Unsupported file extension');
    });
  });
});
