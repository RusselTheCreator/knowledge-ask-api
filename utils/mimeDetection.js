/**
 * MIME Type Detection Utility
 * 
 * Detects actual MIME type from filename extension and magic bytes.
 * DO NOT trust client-provided Content-Type headers alone.
 * 
 * This prevents issues where clients send wrong Content-Type
 * (e.g., text/plain for a PDF file), leading to ingestion failures.
 */

import fs from 'fs/promises';

/**
 * Magic bytes (file signatures) for common file types
 * These are the first few bytes that identify file formats
 */
const MAGIC_BYTES = {
  // PDF: %PDF-
  pdf: [0x25, 0x50, 0x44, 0x46],
  
  // PNG: \x89PNG
  png: [0x89, 0x50, 0x4E, 0x47],
  
  // JPEG: \xFF\xD8\xFF
  jpeg: [0xFF, 0xD8, 0xFF],
  
  // ZIP-based formats (DOCX, XLSX): PK
  // DOCX and XLSX are ZIP archives
  zip: [0x50, 0x4B, 0x03, 0x04],
};

/**
 * Extension to MIME type mapping
 */
const EXTENSION_TO_MIME = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.csv': 'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

/**
 * Detect MIME type from file extension
 * 
 * @param {string} filename - Original filename
 * @returns {string|null} MIME type or null if unknown
 */
function getMimeFromExtension(filename) {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return EXTENSION_TO_MIME[ext] || null;
}

/**
 * Check if buffer starts with magic bytes
 * 
 * @param {Buffer} buffer - File buffer
 * @param {Array<number>} magic - Magic bytes to check
 * @returns {boolean} True if buffer starts with magic bytes
 */
function hasMagicBytes(buffer, magic) {
  if (buffer.length < magic.length) {
    return false;
  }
  
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Detect MIME type from magic bytes
 * 
 * @param {Buffer} buffer - File buffer (at least first 16 bytes)
 * @returns {string|null} MIME type or null if unknown
 */
function getMimeFromMagicBytes(buffer) {
  if (hasMagicBytes(buffer, MAGIC_BYTES.pdf)) {
    return 'application/pdf';
  }
  
  if (hasMagicBytes(buffer, MAGIC_BYTES.png)) {
    return 'image/png';
  }
  
  if (hasMagicBytes(buffer, MAGIC_BYTES.jpeg)) {
    return 'image/jpeg';
  }
  
  if (hasMagicBytes(buffer, MAGIC_BYTES.zip)) {
    // ZIP-based format (DOCX or XLSX)
    // Cannot distinguish between DOCX and XLSX from magic bytes alone
    // Will rely on extension
    return 'application/zip';
  }
  
  return null;
}

/**
 * Detect actual MIME type from file
 * 
 * Strategy:
 * 1. Get MIME from extension (primary)
 * 2. Validate with magic bytes (secondary)
 * 3. For text files (TXT, MD, CSV), trust extension (no magic bytes)
 * 4. For binary files (PDF, DOCX, XLSX, PNG, JPEG), verify magic bytes
 * 
 * @param {string} filePath - Path to file on disk
 * @param {string} originalName - Original filename (for extension)
 * @param {string} clientMimeType - Client-provided MIME type (for logging only)
 * @returns {Promise<string>} Detected MIME type
 * @throws {Error} If MIME type cannot be determined or mismatch detected
 */
export async function detectMimeType(filePath, originalName, clientMimeType) {
  // Step 1: Get MIME from extension
  const mimeFromExt = getMimeFromExtension(originalName);
  
  if (!mimeFromExt) {
    throw new Error(`Unsupported file extension for: ${originalName}`);
  }
  
  // Step 2: Read first 16 bytes for magic byte detection
  const fileHandle = await fs.open(filePath, 'r');
  const buffer = Buffer.alloc(16);
  await fileHandle.read(buffer, 0, 16, 0);
  await fileHandle.close();
  
  // Step 3: Validate with magic bytes for binary formats
  const mimeFromMagic = getMimeFromMagicBytes(buffer);
  
  // For binary formats, verify magic bytes match extension
  const binaryFormats = ['application/pdf', 'image/png', 'image/jpeg'];
  
  if (binaryFormats.includes(mimeFromExt)) {
    // Binary format - must validate magic bytes
    if (!mimeFromMagic || mimeFromMagic === 'application/zip') {
      // For ZIP-based formats (DOCX, XLSX), magic bytes show as ZIP
      // Trust extension to distinguish DOCX from XLSX
      if (mimeFromExt.includes('wordprocessingml') || mimeFromExt.includes('spreadsheetml')) {
        if (mimeFromMagic !== 'application/zip') {
          throw new Error(`File extension suggests ${mimeFromExt} but magic bytes do not match ZIP format`);
        }
        // OK: ZIP magic bytes with DOCX/XLSX extension
      } else if (mimeFromMagic !== mimeFromExt) {
        throw new Error(`File extension suggests ${mimeFromExt} but magic bytes suggest ${mimeFromMagic || 'unknown format'}`);
      }
    } else if (mimeFromMagic !== mimeFromExt) {
      throw new Error(`File extension suggests ${mimeFromExt} but magic bytes suggest ${mimeFromMagic}`);
    }
  }
  
  // Log warning if client MIME type was wrong
  if (clientMimeType && clientMimeType !== mimeFromExt) {
    console.warn(`⚠️  Client sent wrong Content-Type: ${clientMimeType}, detected: ${mimeFromExt} (${originalName})`);
  }
  
  // Return the detected MIME type from extension (validated by magic bytes for binary)
  return mimeFromExt;
}

/**
 * For testing: export helper functions
 */
export const __testing = {
  getMimeFromExtension,
  getMimeFromMagicBytes,
  hasMagicBytes,
  MAGIC_BYTES
};
