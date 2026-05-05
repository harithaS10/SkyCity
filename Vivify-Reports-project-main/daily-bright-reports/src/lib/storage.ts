/**
 * Storage utility that respects cookie consent
 * Falls back to sessionStorage when localStorage is declined
 */

const COOKIE_CONSENT_KEY = 'skycity_cookie_consent';

export const storage = {
  /**
   * Check if user has accepted cookies
   */
  hasConsent(): boolean {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      return consent === 'accepted';
    } catch {
      return false;
    }
  },

  /**
   * Get item from storage (respects cookie consent)
   */
  getItem(key: string): string | null {
    try {
      // Cookie consent key itself is always allowed
      if (key === COOKIE_CONSENT_KEY) {
        return localStorage.getItem(key);
      }

      // If consent accepted, use localStorage
      if (this.hasConsent()) {
        return localStorage.getItem(key);
      }

      // Otherwise use sessionStorage (cleared on browser close)
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },

  /**
   * Set item in storage (respects cookie consent)
   */
  setItem(key: string, value: string): void {
    try {
      // Cookie consent key itself is always allowed
      if (key === COOKIE_CONSENT_KEY) {
        localStorage.setItem(key, value);
        return;
      }

      // If consent accepted, use localStorage
      if (this.hasConsent()) {
        localStorage.setItem(key, value);
      } else {
        // Otherwise use sessionStorage (cleared on browser close)
        sessionStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage errors
    }
  },

  /**
   * Remove item from storage
   */
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  },

  /**
   * Clear all storage
   */
  clear(): void {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      localStorage.clear();
      sessionStorage.clear();
      // Restore consent preference
      if (consent) {
        localStorage.setItem(COOKIE_CONSENT_KEY, consent);
      }
    } catch {
      // Ignore storage errors
    }
  },

  /**
   * Get all keys from storage
   */
  keys(): string[] {
    try {
      if (this.hasConsent()) {
        return Object.keys(localStorage);
      }
      return Object.keys(sessionStorage);
    } catch {
      return [];
    }
  }
};
