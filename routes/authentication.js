/**
 * Authentication Routes
 * 
 * Handles user registration and login with JWT token generation
 * 
 * Routes:
 * - POST /api/authentication/register - Register a new user
 * - POST /api/authentication/login - Login and get JWT token
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../database/db.js';
import { validateRegistration, isValidEmail } from '../utils/validation.js';
import { authRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Apply rate limiting to all authentication routes
router.use(authRateLimiter);

/**
 * @swagger
 * /api/authentication/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               role:
 *                 type: string
 *                 enum: [User, Admin]
 *                 default: User
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */
router.post('/register', async (req, res) => {
  try {
    // Extract user data from request body
    const { name, email, password, role = 'User' } = req.body;
    
    // Validate input data
    const validation = validateRegistration({ name, email, password, role });
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }
    
    // Check if user with this email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Email already registered. Please use a different email or login.'
      });
    }
    
    // Hash the password using bcrypt (salt rounds = 10)
    // This securely stores the password - we never store plaintext passwords
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert the new user into the database
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email.toLowerCase(), hashedPassword, role]
    );
    
    const newUser = result.rows[0];
    
    console.log(`✅ New user registered: ${newUser.email} (${newUser.role})`);
    
    // Return success response (don't include the password!)
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.created_at
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to register user. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/authentication/login:
 *   post:
 *     summary: Login and receive JWT token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful, returns JWT token
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
  try {
    // Extract login credentials from request body
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        error: 'Valid email is required'
      });
    }
    
    if (!password) {
      return res.status(400).json({
        error: 'Password is required'
      });
    }
    
    // Find user by email in database
    const result = await pool.query(
      'SELECT id, name, email, password, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }
    
    const user = result.rows[0];
    
    // Compare provided password with hashed password in database
    // bcrypt.compare securely compares the plaintext password with the hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }
    
    // Password is correct! Generate a JWT token
    // Token includes user ID, email, and role, and expires in 1 hour
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // Token valid for 1 hour
    );
    
    console.log(`✅ User logged in: ${user.email}`);
    
    // Return success response with token and user info
    res.json({
      message: 'Login successful',
      token, // Client should store this and send in Authorization header
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to login. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
