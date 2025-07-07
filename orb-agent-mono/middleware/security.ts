/**
 * Security Middleware for Orb Agent Mono
 * Implements security headers, rate limiting, and input validation
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';

/**
 * Security headers middleware using Helmet
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval needed for some blockchain libs
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"], // http for local development
      connectSrc: ["'self'", "https:", "wss:", "ws:"], // WebSocket support
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for blockchain compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Rate limiting configurations
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit auth attempts
  message: {
    error: 'Too many authentication attempts',
    message: 'Too many failed authentication attempts. Please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true,
});

export const heavyOperationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit heavy operations (like minting, bridging)
  message: {
    error: 'Too many heavy operations',
    message: 'Rate limit for resource-intensive operations exceeded.',
    retryAfter: '1 minute'
  },
});

/**
 * Input validation middleware
 */
export const validateAddress = [
  body('address')
    .isString()
    .isLength({ min: 32, max: 64 })
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage('Invalid address format'),
  handleValidationErrors
];

export const validateEthAddress = [
  body('address')
    .isString()
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage('Invalid Ethereum address format'),
  handleValidationErrors
];

export const validateSolanaAddress = [
  body('address')
    .isString()
    .isLength({ min: 32, max: 44 })
    .matches(/^[1-9A-HJ-NP-Za-km-z]+$/)
    .withMessage('Invalid Solana address format'),
  handleValidationErrors
];

export const validateTokenAmount = [
  body('amount')
    .isNumeric()
    .custom((value) => {
      const num = parseFloat(value);
      if (num <= 0) throw new Error('Amount must be positive');
      if (num > 1e18) throw new Error('Amount too large');
      return true;
    }),
  handleValidationErrors
];

export const validateTransactionHash = [
  body('txHash')
    .isString()
    .isLength({ min: 64, max: 66 })
    .matches(/^(0x)?[a-fA-F0-9]+$/)
    .withMessage('Invalid transaction hash format'),
  handleValidationErrors
];

/**
 * Handle validation errors
 */
function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
      timestamp: new Date().toISOString()
    });
  }
  next();
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  next();
}

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return obj
      .replace(/[<>\"']/g, '') // Remove potential HTML/script chars
      .trim()
      .substring(0, 1000); // Limit length
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50);
      sanitized[cleanKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * CORS configuration for development and production
 */
export function configureCORS() {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',')
    : isProduction 
      ? [] // Must be explicitly configured in production
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];

  return {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Rate-Limit-Remaining', 'X-Rate-Limit-Reset']
  };
}

/**
 * Security audit middleware - logs suspicious requests
 */
export function securityAudit(req: Request, res: Response, next: NextFunction) {
  const suspiciousPatterns = [
    /script/i,
    /javascript/i,
    /vbscript/i,
    /onload/i,
    /onerror/i,
    /<.*>/,
    /eval\(/i,
    /function\(/i
  ];
  
  const requestString = JSON.stringify({
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    headers: req.headers
  });
  
  const suspicious = suspiciousPatterns.some(pattern => pattern.test(requestString));
  
  if (suspicious) {
    console.warn('🚨 Suspicious request detected:', {
      ip: req.ip,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  }
  
  next();
}

/**
 * Error handling middleware with security considerations
 */
export function secureErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Log full error details for debugging (not sent to client in production)
  console.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  // Generic error response for production
  const errorResponse = {
    error: isProduction ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString(),
    ...(isProduction ? {} : { stack: err.stack })
  };
  
  res.status(err.status || 500).json(errorResponse);
}

export default {
  securityHeaders,
  apiRateLimit,
  authRateLimit,
  heavyOperationRateLimit,
  validateAddress,
  validateEthAddress,
  validateSolanaAddress,
  validateTokenAmount,
  validateTransactionHash,
  sanitizeInput,
  configureCORS,
  securityAudit,
  secureErrorHandler
};
