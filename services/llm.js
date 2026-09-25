/**
 * LLM Service
 * 
 * This service handles question-answering using various LLM providers.
 * It takes a question and context (retrieved document chunks) and
 * generates an answer with source citations.
 * 
 * Supported providers:
 * - mock: Deterministic answers based on context (no API key needed, default)
 * - openai: OpenAI GPT-4o-mini (cost-effective, recommended for production)
 * 
 * Note: Gemini support available but not recommended for this deployment.
 * Set LLM_PROVIDER=gemini if needed (requires GEMINI_API_KEY).
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Generate a mock answer based on the provided context
 * This creates realistic-looking answers by extracting and formatting
 * information from the context chunks without calling an external API
 * 
 * @param {string} question - User's question
 * @param {Array} chunks - Retrieved context chunks [{chunk_text, file_name, chunk_id}]
 * @returns {string} Generated answer
 */
function generateMockAnswer(question, chunks) {
  if (!chunks || chunks.length === 0) {
    return "I don't have enough information to answer that question. No relevant documents were found.";
  }
  
  // Create a grounded answer that mentions the retrieved content
  const sourceInfo = chunks
    .slice(0, 3) // Use top 3 chunks
    .map((chunk, idx) => {
      // Extract a meaningful snippet (first 100 chars of the chunk)
      const snippet = chunk.chunk_text.substring(0, 100).trim() + '...';
      return `Source ${idx + 1} (${chunk.file_name}): "${snippet}"`;
    })
    .join('\n\n');
  
  // Build a mock answer that references the context
  const answer = `Based on the retrieved documents, here's what I found:\n\n${sourceInfo}\n\nThis information is extracted from ${chunks.length} relevant document chunk(s) related to your question: "${question}"`;
  
  return answer;
}

/**
 * Generate an answer using OpenAI
 * Uses gpt-4o-mini by default (cost-effective, suitable for Free tier)
 * Model can be overridden via OPENAI_CHAT_MODEL environment variable
 * 
 * @param {string} question - User's question
 * @param {Array} chunks - Retrieved context chunks
 * @returns {Promise<string>} Generated answer
 */
async function generateOpenAIAnswer(question, chunks) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for OpenAI LLM');
  }
  
  // Use cheap model suitable for Free tier
  // gpt-4o-mini is cost-effective and performant for RAG tasks
  const model = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
  
  // Build context from chunks
  const context = chunks
    .map((chunk, idx) => `[Source ${idx + 1} - ${chunk.file_name}]\n${chunk.chunk_text}`)
    .join('\n\n---\n\n');
  
  const systemPrompt = `You are a helpful assistant that answers questions based on provided document context. 
Always cite which source(s) you used in your answer. If the context doesn't contain relevant information, say so.`;
  
  const userPrompt = `Context:\n${context}\n\nQuestion: ${question}\n\nProvide a clear, concise answer based on the context above. Cite your sources.`;
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Generate an answer using Google Gemini 2.5 Flash-Lite
 * 
 * @param {string} question - User's question
 * @param {Array} chunks - Retrieved context chunks
 * @returns {Promise<string>} Generated answer
 */
async function generateGeminiAnswer(question, chunks) {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini LLM');
  }
  
  // Build context from chunks
  const context = chunks
    .map((chunk, idx) => `[Source ${idx + 1} - ${chunk.file_name}]\n${chunk.chunk_text}`)
    .join('\n\n---\n\n');
  
  const prompt = `You are a helpful assistant that answers questions based on provided document context.

Context:
${context}

Question: ${question}

Provide a clear, concise answer based on the context above. Always cite which source(s) you used. If the context doesn't contain relevant information, say so.`;
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500
        }
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

/**
 * Main LLM function - routes to the appropriate provider
 * 
 * @param {string} question - User's question
 * @param {Array} chunks - Retrieved context chunks [{chunk_text, file_name, chunk_id}]
 * @returns {Promise<string>} Generated answer
 */
export async function generateAnswer(question, chunks) {
  const provider = process.env.LLM_PROVIDER || 'mock';
  
  try {
    switch (provider.toLowerCase()) {
      case 'mock':
        return generateMockAnswer(question, chunks);
      
      case 'openai':
        return await generateOpenAIAnswer(question, chunks);
      
      case 'gemini':
        return await generateGeminiAnswer(question, chunks);
      
      default:
        console.warn(`Unknown LLM provider: ${provider}, falling back to mock`);
        return generateMockAnswer(question, chunks);
    }
  } catch (error) {
    console.error(`Error generating answer with ${provider}:`, error.message);
    throw error;
  }
}
