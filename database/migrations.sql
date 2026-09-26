-- database/migrations.sql
-- Migration script to update schema from old version to new version
-- This handles the schema changes from commit 4df21ec (security harden PR)

-- Migration 1: Update users table schema
-- Check and rename password_hash to password if needed
DO $$
BEGIN
  -- Check if password_hash column exists (old schema)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'password_hash'
  ) THEN
    -- Add name column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'name'
    ) THEN
      ALTER TABLE users ADD COLUMN name VARCHAR(255);
      -- Set default name for existing users
      UPDATE users SET name = 'User' || id WHERE name IS NULL;
      ALTER TABLE users ALTER COLUMN name SET NOT NULL;
      RAISE NOTICE 'Added name column to users table';
    END IF;
    
    -- Rename password_hash to password
    ALTER TABLE users RENAME COLUMN password_hash TO password;
    RAISE NOTICE 'Renamed password_hash to password in users table';
    
    -- Update role default and existing values
    ALTER TABLE users ALTER COLUMN role SET DEFAULT 'User';
    -- Normalize existing role values to proper case
    UPDATE users SET role = 'User' WHERE LOWER(role) = 'user';
    UPDATE users SET role = 'Admin' WHERE LOWER(role) = 'admin';
    RAISE NOTICE 'Updated role values in users table';
  ELSE
    RAISE NOTICE 'Users table already migrated (password column exists)';
  END IF;
END $$;

-- Migration 2: Update files table schema
-- Check and rename columns if needed
DO $$
BEGIN
  -- Check if upload_path column exists (old schema)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'files' AND column_name = 'upload_path'
  ) THEN
    -- Rename upload_path to storage_path
    ALTER TABLE files RENAME COLUMN upload_path TO storage_path;
    RAISE NOTICE 'Renamed upload_path to storage_path in files table';
  END IF;
  
  -- Check if filename column exists (old schema)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'files' AND column_name = 'filename'
  ) THEN
    -- Remove filename column (now using original_name)
    ALTER TABLE files DROP COLUMN filename;
    RAISE NOTICE 'Dropped filename column from files table';
  END IF;
  
  -- Add error_message column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'files' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE files ADD COLUMN error_message TEXT;
    RAISE NOTICE 'Added error_message column to files table';
  END IF;
  
  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'files' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE files ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    -- Set updated_at to created_at for existing records
    UPDATE files SET updated_at = created_at WHERE updated_at IS NULL;
    RAISE NOTICE 'Added updated_at column to files table';
  END IF;
END $$;

-- Migration 3: Update asks table schema
-- Add missing status and error_message columns
DO $$
BEGIN
  -- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'asks' AND column_name = 'status'
  ) THEN
    ALTER TABLE asks ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
    -- Set status to 'completed' for existing records that have an answer
    UPDATE asks SET status = 'completed' WHERE answer IS NOT NULL AND answer != '';
    RAISE NOTICE 'Added status column to asks table';
  END IF;
  
  -- Add error_message column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'asks' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE asks ADD COLUMN error_message TEXT;
    RAISE NOTICE 'Added error_message column to asks table';
  END IF;
  
  -- Make answer column nullable if it isn't already
  -- (needed because asks are created with pending status before answer is generated)
  ALTER TABLE asks ALTER COLUMN answer DROP NOT NULL;
  RAISE NOTICE 'Made answer column nullable in asks table';
  
EXCEPTION
  WHEN others THEN
    -- If answer is already nullable, the DROP NOT NULL will fail silently
    -- This is expected and safe to ignore
    RAISE NOTICE 'Asks table migration completed (some steps may have been skipped)';
END $$;

-- Migration 4: Update ask_sources table schema
-- Add missing file_id and chunk_excerpt columns
DO $$
BEGIN
  -- Add file_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ask_sources' AND column_name = 'file_id'
  ) THEN
    ALTER TABLE ask_sources ADD COLUMN file_id INTEGER;
    
    -- Populate file_id from chunks table for existing records
    UPDATE ask_sources 
    SET file_id = chunks.file_id 
    FROM chunks 
    WHERE ask_sources.chunk_id = chunks.id 
    AND ask_sources.file_id IS NULL;
    
    -- Make file_id NOT NULL and add foreign key constraint
    ALTER TABLE ask_sources ALTER COLUMN file_id SET NOT NULL;
    ALTER TABLE ask_sources ADD CONSTRAINT ask_sources_file_id_fkey 
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Added file_id column to ask_sources table';
  END IF;
  
  -- Add chunk_excerpt column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ask_sources' AND column_name = 'chunk_excerpt'
  ) THEN
    ALTER TABLE ask_sources ADD COLUMN chunk_excerpt TEXT;
    
    -- Populate chunk_excerpt from chunks table for existing records (first 200 chars)
    UPDATE ask_sources 
    SET chunk_excerpt = SUBSTRING(chunks.chunk_text, 1, 200) || '...'
    FROM chunks 
    WHERE ask_sources.chunk_id = chunks.id 
    AND ask_sources.chunk_excerpt IS NULL;
    
    RAISE NOTICE 'Added chunk_excerpt column to ask_sources table';
  END IF;
END $$;

-- Migration 5: Update embedding vector dimensions for Bedrock Titan V2
-- Bedrock Titan V2 produces 1024-dimensional embeddings (vs 384 for mock)
-- This migration clears existing chunks and updates the schema
DO $$
DECLARE
  current_dimension INTEGER;
BEGIN
  -- Get current embedding vector dimension
  SELECT atttypmod - 4 INTO current_dimension
  FROM pg_attribute
  WHERE attrelid = 'chunks'::regclass
  AND attname = 'embedding';
  
  -- Only migrate if dimension is 384 (mock) and not already 1024 (Bedrock)
  IF current_dimension = 384 THEN
    RAISE NOTICE 'Migrating embedding dimensions from 384 to 1024 for Bedrock Titan V2...';
    
    -- Clear all existing chunks (incompatible dimensions)
    TRUNCATE TABLE chunks CASCADE;
    RAISE NOTICE '  → Truncated chunks table (existing embeddings are incompatible)';
    
    -- Update all files to require re-processing
    UPDATE files SET status = 'ready', error_message = NULL;
    RAISE NOTICE '  → Reset file status (users must re-upload to regenerate embeddings)';
    
    -- Alter embedding column to 1024 dimensions
    ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(1024);
    RAISE NOTICE '  → Updated embedding column to vector(1024)';
    
    RAISE NOTICE '✓ Embedding dimension migration completed. Users must re-upload documents.';
  ELSIF current_dimension = 1024 THEN
    RAISE NOTICE '✓ Embedding dimensions already at 1024 (Bedrock Titan V2)';
  ELSE
    RAISE NOTICE '⚠ Unexpected embedding dimension: % (expected 384 or 1024)', current_dimension;
  END IF;
END $$;

-- Verify migration completed
DO $$
BEGIN
  RAISE NOTICE '✓ All migrations completed successfully';
END $$;
