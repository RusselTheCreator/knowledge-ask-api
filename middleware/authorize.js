/**
 * middleware/authorize.js
 * Role-based authorization middleware.
 * Checks if the authenticated user has one of the required roles.
 */

/**
 * Authorize middleware factory
 * Returns a middleware function that checks if req.user.role matches any of the allowed roles.
 * Must be used after authenticate middleware.
 * 
 * @param {...string} roles - Allowed roles (e.g., 'admin', 'user')
 * @returns {Function} Express middleware function
 */
function authorize(...roles) {
  return (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Check if user role is in the allowed roles list
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`
      });
    }

    next();
  };
}

export default authorize;
