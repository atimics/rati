import { v4 as uuidv4 } from 'uuid';

/**
 * Custom API Error class for structured error handling
 */
export class ApiError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = 500, details = null, suggestions = []) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.suggestions = suggestions;
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(error, req = null) {
  const isApiError = error instanceof ApiError;
  
  const response = {
    error: {
      code: isApiError ? error.code : 'INTERNAL_ERROR',
      message: isApiError ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId: req?.requestId || req?.headers['x-request-id'] || uuidv4()
    }
  };

  if (isApiError) {
    if (error.details) response.error.details = error.details;
    if (error.suggestions.length > 0) response.error.suggestions = error.suggestions;
  }

  // Add debug info in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
    if (req) {
      response.error.request = {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body
      };
    }
  }

  return response;
}

/**
 * Enhanced logging with context
 */
export function logError(error, context = {}) {
  const timestamp = new Date().toISOString();
  const contextStr = Object.keys(context).length > 0 ? JSON.stringify(context, null, 2) : '';
  
  console.error(`[${timestamp}] ERROR: ${error.message}`);
  if (contextStr) console.error(`[${timestamp}] CONTEXT: ${contextStr}`);
  if (process.env.NODE_ENV === 'development' && error.stack) {
    console.error(`[${timestamp}] STACK: ${error.stack}`);
  }
}

/**
 * Validation helpers
 */
export function validateRequiredFields(data, requiredFields) {
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new ApiError(
      `Missing required fields: ${missing.join(', ')}`,
      'VALIDATION_ERROR',
      400,
      { missingFields: missing },
      [`Please provide values for: ${missing.join(', ')}`]
    );
  }
}

export function validateEnvironment(requiredEnvVars = []) {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new ApiError(
      `Missing required environment variables: ${missing.join(', ')}`,
      'CONFIGURATION_ERROR',
      503,
      { missingEnvVars: missing },
      [
        'Check your .env file or environment configuration',
        'Ensure all required environment variables are set',
        'Restart the service after configuration changes'
      ]
    );
  }
}

/**
 * Express error handling middleware
 */
export function errorHandler(err, req, res, _next) {
  const response = createErrorResponse(err, req);
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  
  logError(err, {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: req.requestId
  });

  res.status(statusCode).json(response);
}

/**
 * Async route handler wrapper to catch errors
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
