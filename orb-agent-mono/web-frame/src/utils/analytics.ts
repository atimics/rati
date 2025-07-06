import type { AnalyticsEvent, EventType } from '../types';
import { STORAGE_KEYS } from '../config';

// Simple analytics implementation
class Analytics {
  private sessionId: string;
  private userId?: string;
  private events: AnalyticsEvent[] = [];

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.userId = this.getUserId();
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    }
    return sessionId;
  }

  private getUserId(): string | undefined {
    const userData = localStorage.getItem(STORAGE_KEYS.WALLET_CONNECTION);
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        return parsed.address;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  track(event: EventType, properties: Record<string, any> = {}): void {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
      userId: this.userId,
      sessionId: this.sessionId,
    };

    this.events.push(analyticsEvent);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics Event:', analyticsEvent);
    }

    // Send to analytics service (implement as needed)
    this.sendEvent(analyticsEvent);
  }

  private async sendEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // In production, send to your analytics service
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/analytics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
      }
    } catch (error) {
      console.warn('Failed to send analytics event:', error);
    }
  }

  identify(userId: string, traits: Record<string, any> = {}): void {
    this.userId = userId;
    
    this.track('user_identified', {
      userId,
      traits,
    });
  }

  page(name?: string, properties: Record<string, any> = {}): void {
    this.track('page_viewed', {
      page: name || document.title,
      ...properties,
    });
  }

  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }
}

// Create singleton instance
const analytics = new Analytics();

// Convenience functions
export function trackEvent(event: EventType, properties?: Record<string, any>): void {
  analytics.track(event, properties);
}

export function identifyUser(userId: string, traits?: Record<string, any>): void {
  analytics.identify(userId, traits);
}

export function trackPage(name?: string, properties?: Record<string, any>): void {
  analytics.page(name, properties);
}

export function getAnalyticsEvents(): AnalyticsEvent[] {
  return analytics.getEvents();
}

export function clearAnalyticsEvents(): void {
  analytics.clearEvents();
}

// Auto-track page views
if (typeof window !== 'undefined') {
  // Track initial page load
  document.addEventListener('DOMContentLoaded', () => {
    trackPage();
  });

  // Track route changes (for SPAs)
  let lastUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      trackPage();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}