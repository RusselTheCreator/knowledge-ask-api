/**
 * Document Processing Service
 * 
 * This service handles:
 * 1. Text extraction from various file formats (PDF, TXT, MD, DOCX, CSV)
 * 2. Text chunking with overlap for better RAG retrieval
 * 3. Document ingestion pipeline (extract → chunk → embed → store)
 */

import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { parse as csvParse } from 'csv-parse/sync';
import { generateEmbedding } from './embeddings.js';
import pool from '../database/db.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Extract text content from a file based on its MIME type
 * 
 * @param {string} filePath - Full path to the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<string>} Extracted text content
 */
export async function extractText(filePath, mimeType) {
  try {
    // Read the file buffer
    const buffer = await fs.readFile(filePath);
    
    // Route to appropriate extractor based on MIME type
    switch (mimeType) {
      case 'application/pdf':
        return await extractPDF(buffer);
      
      case 'text/plain':
      case 'text/markdown':
        return buffer.toString('utf-8');
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractDOCX(buffer);
      
      case 'text/csv':
        return await extractCSV(buffer);
      
      default:
        // Try to treat as plain text as fallback
        return buffer.toString('utf-8');
    }
  } catch (error) {
    console.error(`Error extracting text from ${filePath}:`, error.message);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

/**
 * Extract text from PDF using pdf-parse
 * 
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractPDF(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Extract text from DOCX using mammoth
 * 
 * @param {Buffer} buffer - DOCX file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extract text from CSV by converting to readable format
 * 
 * @param {Buffer} buffer - CSV file buffer
 * @returns {Promise<string>} Extracted text (formatted)
 */
async function extractCSV(buffer) {
  const records = csvParse(buffer, {
    columns: true,
    skip_empty_lines: true
  });
  
  // Convert CSV records to readable text format
  return records
    .map(record => Object.entries(record)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ')
    )
    .join('\n');
}

/**
 * Split text into overlapping chunks for better retrieval
 * Overlap helps ensure context isn't lost at chunk boundaries
 * 
 * @param {string} text - Full document text
 * @param {number} chunkSize - Target size of each chunk (chars)
 * @param {number} overlap - Number of overlapping characters
 * @returns {string[]} Array of text chunks
 */
export function chunkText(text, chunkSize = 600, overlap = 100) {
  // Clean and normalize the text
  const cleanText = text.replace(/\s+/g, ' ').trim();
  
  if (cleanText.length === 0) {
    return [];
  }
  
  // If text is smaller than chunk size, return as single chunk
  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }
  
  const chunks = [];
  let position = 0;
  
  while (position < cleanText.length) {
    // Extract a chunk of the specified size
    const chunk = cleanText.slice(position, position + chunkSize);
    chunks.push(chunk);
    
    // Move position forward by (chunkSize - overlap)
    // This creates overlap between consecutive chunks
    position += (chunkSize - overlap);
  }
  
  return chunks;
}

/**
 * Complete document ingestion pipeline:
 * 1. Extract text from file
 * 2. Split into chunks
 * 3. Generate embeddings for each chunk
 * 4. Store chunks and embeddings in database
 * 
 * @param {number} fileId - Database ID of the file
 * @param {string} filePath - Path to the file on disk
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<void>}
 */
export async function ingestDocument(fileId, filePath, mimeType) {
  try {
    console.log(`📄 Starting ingestion for file ID ${fileId}`);
    
    // Step 1: Extract text from the file
    const text = await extractText(filePath, mimeType);
    console.log(`✅ Extracted ${text.length} characters of text`);
    
    // Step 2: Split text into chunks
    const chunkSize = parseInt(process.env.CHUNK_SIZE) || 600;
    const overlap = parseInt(process.env.CHUNK_OVERLAP) || 100;
    const chunks = chunkText(text, chunkSize, overlap);
    console.log(`✅ Created ${chunks.length} chunks`);
    
    // Step 3 & 4: Generate embeddings and store in database
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i];
      
      // Generate embedding vector for this chunk
      const embedding = await generateEmbedding(chunkText);
      
      // Store chunk and embedding in database
      await pool.query(
        `INSERT INTO chunks (file_id, chunk_text, chunk_index, embedding)
         VALUES ($1, $2, $3, $4)`,
        [fileId, chunkText, i, JSON.stringify(embedding)]
      );
    }
    
    console.log(`✅ Stored ${chunks.length} chunks with embeddings`);
    
    // Update file status to 'ready'
    await pool.query(
      `UPDATE files SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fileId]
    );
    
    console.log(`✅ File ${fileId} ingestion complete`);
    
  } catch (error) {
    console.error(`❌ Error ingesting file ${fileId}:`, error.message);
    
    // Update file status to 'error' with error message
    await pool.query(
      `UPDATE files SET status = 'error', error_message = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [error.message, fileId]
    );
    
    throw error;
  }
}
