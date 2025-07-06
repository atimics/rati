import { ERROR_CODES } from '../config';
import type { ErrorWithCode } from '../types';

export class OrbAgentError extends Error implements ErrorWithCode {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'OrbAgentError';
  }
}

export class WalletError extends OrbAgentError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.WALLET_NOT_CONNECTED, details);
    this.name = 'WalletError';
  }
}

export class TransactionError extends OrbAgentError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.TRANSACTION_FAILED, details);
    this.name = 'TransactionError';
  }
}

export class ValidationError extends OrbAgentError {
  constructor(message: string, field?: string) {
    super(message, ERROR_CODES.VALIDATION_ERROR, { field });
    this.name = 'ValidationError';
  }
}

export class NetworkError extends OrbAgentError {
  constructor(message: string, details?: any) {
    super(message, ERROR_CODES.NETWORK_ERROR, details);
    this.name = 'NetworkError';
  }
}

export class InsufficientBalanceError extends OrbAgentError {
  constructor(required: number, available: number, token: string) {
    super(
      `Insufficient ${token} balance. Required: ${required}, Available: ${available}`,
      ERROR_CODES.INSUFFICIENT_BALANCE,
      { required, available, token }
    );
    this.name = 'InsufficientBalanceError';
  }
}

export class RateLimitError extends OrbAgentError {
  constructor(resetTime?: number) {
    super(
      'Rate limit exceeded. Please try again later.',
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      { resetTime }
    );
    this.name = 'RateLimitError';
  }
}

export function parseError(error: unknown): ErrorWithCode {
  if (error instanceof OrbAgentError) {
    return error;
  }

  if (error instanceof Error) {
    // Parse common Solana errors
    if (error.message.includes('insufficient funds')) {
      return new InsufficientBalanceError(0, 0, 'SOL');
    }

    if (error.message.includes('User rejected')) {
      return new WalletError('Transaction was rejected by user');
    }

    if (error.message.includes('Network Error')) {
      return new NetworkError(error.message);
    }

    // Parse common EVM errors
    if (error.message.includes('insufficient balance')) {
      return new InsufficientBalanceError(0, 0, 'ETH');
    }

    if (error.message.includes('user denied')) {
      return new WalletError('Transaction was denied by user');
    }

    return new OrbAgentError(error.message);
  }

  return new OrbAgentError('An unknown error occurred', undefined, error);
}

export function getErrorMessage(error: unknown): string {
  const parsedError = parseError(error);
  return parsedError.message;
}

export function isRetryableError(error: ErrorWithCode): boolean {
  const retryableCodes = [
    ERROR_CODES.NETWORK_ERROR,
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
  ];

  return retryableCodes.includes(error.code || '');
}

export function formatErrorForUser(error: ErrorWithCode): string {
  switch (error.code) {
    case ERROR_CODES.WALLET_NOT_CONNECTED:
      return 'Please connect your wallet to continue.';
    
    case ERROR_CODES.INSUFFICIENT_BALANCE:
      return error.message || 'Insufficient balance to complete this transaction.';
    
    case ERROR_CODES.INVALID_ORB:
      return 'The selected Orb is not valid for transformation.';
    
    case ERROR_CODES.TRANSACTION_FAILED:
      return 'Transaction failed. Please try again.';
    
    case ERROR_CODES.NETWORK_ERROR:
      return 'Network error. Please check your connection and try again.';
    
    case ERROR_CODES.VALIDATION_ERROR:
      return error.message || 'Invalid input. Please check your data.';
    
    case ERROR_CODES.RATE_LIMIT_EXCEEDED:
      return 'Too many requests. Please wait a moment and try again.';
    
    default:
      return error.message || 'An unexpected error occurred.';
  }
}

export function logError(error: ErrorWithCode, context?: Record<string, any>): void {
  const errorInfo = {
    name: error.name,
    message: error.message,
    code: error.code,
    details: error.details,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    context,
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', errorInfo);
  }

  // Send to error tracking service in production
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    // Implementation would depend on your error tracking service (Sentry, etc.)
    try {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorInfo),
      }).catch(() => {
        // Silently fail if error reporting fails
      });
    } catch {
      // Silently fail
    }
  }
}