FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data directory for persistent storage
RUN mkdir -p /app/data /app/logs

# Expose port
EXPOSE 3032

# Start the service
CMD ["node", "server.js"]
