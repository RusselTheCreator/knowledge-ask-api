/**
 * middleware/logger.js
 * Simple logging middleware to log incoming HTTP requests.
 */

/**
 * Logger middleware
 * Logs the HTTP method, URL, and response time for each request.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function logger(req, res, next) {
  const start = Date.now();
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
}

export default logger;
