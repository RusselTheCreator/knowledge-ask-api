-- database/schema.sql
-- PostgreSQL schema for knowledge-ask-api with pgvector extension

-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table: stores registered users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'User', -- 'User' or 'Admin'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Files table: stores metadata about uploaded documents
CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'processing', -- 'processing', 'ready', 'error'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chunks table: stores text chunks extracted from files with their embeddings
CREATE TABLE IF NOT EXISTS chunks (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(384), -- 384-dimensional vector for embeddings
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Asks table: stores user questions and generated answers
CREATE TABLE IF NOT EXISTS asks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ask sources table: links asks to the chunks used to generate answers
CREATE TABLE IF NOT EXISTS ask_sources (
  id SERIAL PRIMARY KEY,
  ask_id INTEGER NOT NULL REFERENCES asks(id) ON DELETE CASCADE,
  chunk_id INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  relevance_score FLOAT
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_asks_user_id ON asks(user_id);
CREATE INDEX IF NOT EXISTS idx_ask_sources_ask_id ON ask_sources(ask_id);

-- Default admin user (DISABLED for security)
-- To enable for development/testing, set ENABLE_DEFAULT_ADMIN=true in .env
-- Default password: admin123 (CHANGE IMMEDIATELY if enabled)
-- Actual seeding is done in database/init.js based on environment variable
-- 
-- SECURITY WARNING: Never enable default admin in production!
-- Always create admin users manually with strong passwords.
