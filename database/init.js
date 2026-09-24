/**
 * database/init.js
 * Initialize database schema on startup if tables don't exist
 */

const pool = require('./db');
const fs = require('fs');
const path = require('path');

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

module.exports = initializeDatabase;
