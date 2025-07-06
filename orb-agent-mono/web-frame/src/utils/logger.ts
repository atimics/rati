// Structured Logging Utility for Orb Agent System

interface LogContext {
  [key: string]: any;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private correlationId: string;
  private userId?: string;
  private sessionId: string;
  private context: LogContext = {};

  constructor() {
    this.correlationId = this.generateId();
    this.sessionId = this.getOrCreateSessionId();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getOrCreateSessionId(): string {
    const key = 'orb_agent_session_id';
    let sessionId = sessionStorage.getItem(key);
    if (!sessionId) {
      sessionId = this.generateId();
      sessionStorage.setItem(key, sessionId);
    }
    return sessionId;
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  private createLogEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
      correlationId: this.correlationId,
      userId: this.userId,
      sessionId: this.sessionId,
    };
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const entry = this.createLogEntry(level, message, context);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = level === 'error' ? 'error' 
        : level === 'warn' ? 'warn' 
        : level === 'debug' ? 'debug' 
        : 'log';
      
      console[consoleMethod](`[${level.toUpperCase()}] ${message}`, entry.context);
    }

    // Send to logging service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToLogService(entry);
    }

    // Store critical errors locally for offline analysis
    if (level === 'error') {
      this.storeErrorLocally(entry);
    }
  }

  private async sendToLogService(entry: LogEntry): Promise<void> {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      // Silently fail if logging service is unavailable
      console.warn('Failed to send log to service:', error);
    }
  }

  private storeErrorLocally(entry: LogEntry): void {
    try {
      const key = 'orb_agent_errors';
      const stored = localStorage.getItem(key);
      const errors = stored ? JSON.parse(stored) : [];
      
      errors.push(entry);
      
      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50);
      }
      
      localStorage.setItem(key, JSON.stringify(errors));
    } catch (error) {
      // Silently fail if localStorage is unavailable
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  // Convenience methods for common operations
  transaction(txHash: string, action: string, context?: LogContext): void {
    this.info(`Transaction ${action}`, {
      txHash,
      action,
      ...context,
    });
  }

  walletEvent(event: string, address: string, context?: LogContext): void {
    this.info(`Wallet ${event}`, {
      event,
      address,
      ...context,
    });
  }

  apiCall(endpoint: string, method: string, status?: number, context?: LogContext): void {
    const level = status && status >= 400 ? 'error' : 'info';
    this.log(level, `API ${method} ${endpoint}`, {
      endpoint,
      method,
      status,
      ...context,
    });
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    const level = duration > 5000 ? 'warn' : 'info'; // Warn if operation takes > 5s
    this.log(level, `Performance: ${operation}`, {
      operation,
      duration,
      ...context,
    });
  }

  // Error logging with stack traces
  exception(error: Error, context?: LogContext): void {
    this.error(`Exception: ${error.message}`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...context,
    });
  }

  // Security events
  security(event: string, context?: LogContext): void {
    this.warn(`Security: ${event}`, {
      event,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...context,
    });
  }

  // Business logic events
  business(event: string, context?: LogContext): void {
    this.info(`Business: ${event}`, {
      event,
      ...context,
    });
  }
}

// Create singleton logger instance
const logger = new Logger();

// Convenience exports
export { logger };
export const log = logger;

// Convenience functions
export function setLogContext(context: LogContext): void {
  logger.setContext(context);
}

export function setUserId(userId: string): void {
  logger.setUserId(userId);
}

export function logTransaction(txHash: string, action: string, context?: LogContext): void {
  logger.transaction(txHash, action, context);
}

export function logError(error: Error, context?: LogContext): void {
  logger.exception(error, context);
}

export function logPerformance(operation: string, startTime: number, context?: LogContext): void {
  const duration = Date.now() - startTime;
  logger.performance(operation, duration, context);
}

// Wrapper for timing operations
export function withPerformanceLogging<T>(
  operation: string,
  fn: () => T | Promise<T>,
  context?: LogContext
): T | Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = fn();
    
    if (result instanceof Promise) {
      return result
        .then((value) => {
          logPerformance(operation, startTime, { ...context, success: true });
          return value;
        })
        .catch((error) => {
          logPerformance(operation, startTime, { ...context, success: false, error: error.message });
          throw error;
        });
    } else {
      logPerformance(operation, startTime, { ...context, success: true });
      return result;
    }
  } catch (error) {
    logPerformance(operation, startTime, { 
      ...context, 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw error;
  }
}

// Auto-log unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.error('Unhandled error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', {
      reason: event.reason,
      stack: event.reason?.stack,
    });
  });
}