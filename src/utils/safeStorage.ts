/**
 * Safe LocalStorage wrapper with in-memory fallback.
 * Prevents DOMException / SecurityError crashes in sandboxed iframes or private browsing modes.
 */

const memoryFallback = new Map<string, string>();

export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (err) {
      // In private browsing or sandboxed iframe, localStorage access can throw
      return memoryFallback.get(key) || null;
    }
    return memoryFallback.get(key) || null;
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (err) {
      // Quota exceeded or restricted iframe
    }
    memoryFallback.set(key, value);
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (err) {
      // Restricted
    }
    memoryFallback.delete(key);
  },

  getJSON<T>(key: string, defaultValue: T): T {
    try {
      const item = this.getItem(key);
      if (item !== null) {
        return JSON.parse(item) as T;
      }
    } catch {
      // Ignore json parse error
    }
    return defaultValue;
  },

  setJSON<T>(key: string, value: T): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore
    }
  }
};
