/**
 * middleware/authenticate.js
 * JWT authentication middleware.
 * Verifies the JWT token from the Authorization header and attaches user info to req.user.
 */

import jwt from 'jsonwebtoken';

/**
 * Authenticate middleware
 * Extracts and verifies JWT token from Authorization header (Bearer token).
 * If valid, attaches decoded user data to req.user.
 * If invalid or missing, returns 401 Unauthorized.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please include Authorization header with Bearer token.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to request object for downstream middleware/routes
    req.user = decoded;
    next();
  } catch (error) {
    // Token verification failed
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
      error: error.message
    });
  }
}

export default authenticate;
