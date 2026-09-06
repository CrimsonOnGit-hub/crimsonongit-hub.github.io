# Multi-stage optimized Node.js runtime for Google Cloud Run
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Copy package descriptors and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Cloud Run listens on port 8080
EXPOSE 8080

# Run dynamic server
CMD ["node", "server.js"]
