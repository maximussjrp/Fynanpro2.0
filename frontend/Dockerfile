# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Copy .env.production explicitly
COPY .env.production .env.production

# Set environment for build (fallback if not passed as ARG)
ARG NEXT_PUBLIC_API_URL=https://api.utopsistema.com.br/api/v1
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build Next.js app
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files for production deps
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./

# Expose port
EXPOSE 3001

# Start command
CMD ["npm", "start"]
