# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy package files
COPY package*.json ./

# Copy application code - be explicit about what we need
COPY index.js ./
COPY database ./database
COPY middleware ./middleware
COPY routes ./routes
COPY services ./services
COPY utils ./utils

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 6544

# Health check - use curl (alpine-compatible) since app is ES module (require() doesn't work)
# Install curl for health check
RUN apk add --no-cache curl

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-6544}/health || exit 1

# Start the application
CMD ["npm", "start"]
