import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID middleware - adds unique request ID to each request
 */
export function requestId(req, res, next) {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
}

/**
 * Request logging middleware
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - ${req.ip} - ${req.requestId}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
}

/**
 * CORS configuration
 */
export function corsConfig() {
  return {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id']
  };
}
