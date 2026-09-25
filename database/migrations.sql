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

-- Verify migration completed
DO $$
BEGIN
  RAISE NOTICE '✓ Migration completed successfully';
END $$;
