import jwt from 'jsonwebtoken';

/**
 * Simple JWT authentication middleware
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

/**
 * Input validation middleware
 */
function validateInput(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details.map(d => d.message) 
      });
    }
    next();
  };
}

/**
 * Rate limiting middleware (simple in-memory implementation)
 */
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // requests per window

function rateLimiter(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requestCounts.has(clientIP)) {
    requestCounts.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const clientData = requestCounts.get(clientIP);
  
  if (now > clientData.resetTime) {
    // Reset the count
    requestCounts.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  if (clientData.count >= MAX_REQUESTS) {
    return res.status(429).json({ 
      error: 'Too many requests', 
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000) 
    });
  }
  
  clientData.count++;
  next();
}

/**
 * ArConnect transaction verification middleware
 */
function verifyArweaveTransaction(req, res, next) {
  // Skip verification for non-deployment requests
  if (!req.body || !req.body.transaction) {
    return next();
  }

  const transaction = req.body.transaction;
  
  // Basic transaction structure validation
  if (!transaction.id || !transaction.signature) {
    return res.status(400).json({ 
      error: 'Invalid transaction structure',
      details: 'Transaction must include id and signature' 
    });
  }

  // Validate transaction ID format (43 characters, base64url)
  if (transaction.id.length !== 43 || !/^[A-Za-z0-9_-]{43}$/.test(transaction.id)) {
    return res.status(400).json({ 
      error: 'Invalid transaction ID format',
      details: 'Transaction ID must be 43 characters base64url encoded' 
    });
  }

  // Validate signature presence
  if (!transaction.signature || transaction.signature.length === 0) {
    return res.status(400).json({ 
      error: 'Transaction not signed',
      details: 'Transaction signature is missing or empty. Please ensure the transaction was properly signed by ArConnect.' 
    });
  }

  next();
}

export {
  authenticateToken,
  validateInput,
  rateLimiter,
  verifyArweaveTransaction
};