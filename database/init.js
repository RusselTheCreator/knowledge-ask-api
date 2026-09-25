/**
 * database/init.js
 * Initialize database schema on startup if tables don't exist
 * Optionally seeds a default admin user if ENABLE_DEFAULT_ADMIN=true
 */

import pool from './db.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Checking database schema...');
    
    // Check if users table exists
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    if (!result.rows[0].exists) {
      console.log('Database tables not found. Initializing schema...');
      
      // Read and execute schema.sql
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      await client.query(schema);
      console.log('✓ Database schema initialized successfully');
      
      // Optionally seed default admin user
      if (process.env.ENABLE_DEFAULT_ADMIN === 'true') {
        await seedDefaultAdmin(client);
      } else {
        console.log('⚠️  Default admin account disabled (set ENABLE_DEFAULT_ADMIN=true to enable)');
      }
    } else {
      console.log('✓ Database schema already exists');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Seed default admin user for development/testing
 * 
 * ⚠️  SECURITY WARNING: Only enable in development environments!
 * Default credentials should never be used in production.
 */
async function seedDefaultAdmin(client) {
  try {
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123';
    
    // Check if admin already exists
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );
    
    if (existing.rows.length > 0) {
      console.log('⚠️  Default admin account already exists');
      return;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // Create admin user
    await client.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)`,
      ['Admin User', adminEmail, hashedPassword, 'Admin']
    );
    
    console.log('⚠️  DEFAULT ADMIN ACCOUNT CREATED:');
    console.log('    Email: admin@example.com');
    console.log('    Password: admin123');
    console.log('    🔒 CHANGE THIS PASSWORD IMMEDIATELY!');
    console.log('    🔒 NEVER USE DEFAULT CREDENTIALS IN PRODUCTION!');
  } catch (error) {
    console.error('Error seeding default admin:', error);
    // Don't throw - this is optional seeding
  }
}

export default initializeDatabase;
