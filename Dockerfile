# Multi-stage build for RATi Digital Cell Platform

# Frontend build stage
FROM node:18-alpine as frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Production frontend server
FROM nginx:alpine as frontend

COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Agent build stage
FROM node:18-alpine as agent

WORKDIR /usr/src/app

# Install dependencies
COPY agent/package*.json ./
RUN npm ci --only=production

# Copy source files
COPY agent/ ./

# Create logs directory
RUN mkdir -p logs

EXPOSE 3000
CMD ["node", "agent.js"]
