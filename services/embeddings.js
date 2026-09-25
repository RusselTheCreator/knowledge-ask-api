/**
 * Embeddings Service
 * 
 * This service generates vector embeddings from text, which are used
 * for semantic similarity search in the RAG system.
 * 
 * Supported providers:
 * - mock: Deterministic pseudo-embeddings (no API key needed, default)
 * - openai: OpenAI text-embedding-3-small (cost-effective, recommended for production)
 * 
 * Note: Gemini support available but not recommended for this deployment.
 * Set EMBEDDING_PROVIDER=gemini if needed (requires GEMINI_API_KEY).
 */

import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Generate mock embeddings using deterministic hashing
 * These aren't real semantic embeddings, but they're stable and allow
 * similarity testing to work without external API calls
 * 
 * @param {string} text - Text to embed
 * @returns {number[]} 384-dimensional pseudo-embedding vector
 */
function generateMockEmbedding(text) {
  const dimension = 384; // Standard embedding dimension
  const embedding = [];
  
  // Create a hash of the input text for determinism
  const hash = crypto.createHash('sha256').update(text).digest();
  
  // Generate pseudo-random but deterministic values from the hash
  for (let i = 0; i < dimension; i++) {
    // Use different parts of the hash to generate vector components
    const byteIndex = i % hash.length;
    const value = (hash[byteIndex] - 128) / 128; // Normalize to [-1, 1]
    embedding.push(value);
  }
  
  // Normalize the vector to unit length (like real embeddings)
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

/**
 * Generate embeddings using OpenAI API
 * Uses text-embedding-3-small model by default (cost-effective, suitable for Free tier)
 * Model can be overridden via OPENAI_EMBEDDING_MODEL environment variable
 * 
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateOpenAIEmbedding(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for OpenAI embeddings');
  }
  
  // Use cost-effective embedding model suitable for Free tier
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: text,
      encoding_format: 'float'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings using Google Gemini API
 * 
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateGeminiEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini embeddings');
  }
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: {
          parts: [{ text }]
        }
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }
  
  const data = await response.json();
  return data.embedding.values;
}

/**
 * Main embedding function - routes to the appropriate provider
 * 
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(text) {
  const provider = process.env.EMBEDDING_PROVIDER || 'mock';
  
  try {
    switch (provider.toLowerCase()) {
      case 'mock':
        return generateMockEmbedding(text);
      
      case 'openai':
        return await generateOpenAIEmbedding(text);
      
      case 'gemini':
        return await generateGeminiEmbedding(text);
      
      default:
        console.warn(`Unknown embedding provider: ${provider}, falling back to mock`);
        return generateMockEmbedding(text);
    }
  } catch (error) {
    console.error(`Error generating embedding with ${provider}:`, error.message);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 * Returns a value between -1 and 1, where 1 means identical
 * 
 * @param {number[]} vec1 - First embedding vector
 * @param {number[]} vec2 - Second embedding vector
 * @returns {number} Cosine similarity score
 */
export function cosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimension');
  }
  
  // Calculate dot product
  let dotProduct = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
  }
  
  // Calculate magnitudes
  const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  
  // Return cosine similarity
  return dotProduct / (mag1 * mag2);
}
