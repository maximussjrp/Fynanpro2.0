# Build stage
FROM node:18-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-slim AS production

# Install OpenSSL for Prisma and curl for health check
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files for production deps
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --omit=dev

# Generate Prisma client
RUN npx prisma generate

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Start command with entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]
