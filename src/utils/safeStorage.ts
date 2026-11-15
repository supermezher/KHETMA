/**
 * Safe LocalStorage wrapper with in-memory fallback and quota-failure reporting.
 */

const memoryFallback = new Map<string, string>();

function notifyStorageFailure(key: string, reason: unknown): void {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('bayan:storage-error', {
          detail: { key, reason: reason instanceof Error ? reason.message : 'storage_write_failed' },
        })
      );
    } catch {
      // Ignore event dispatch failure
    }
  }
}

export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      return memoryFallback.get(key) || null;
    }
    return memoryFallback.get(key) || null;
  },

  /** Returns true when persisted to real localStorage; dispatches visible error event on failure */
  setItem(key: string, value: string): boolean {
    memoryFallback.set(key, value);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return true;
      }
    } catch (err) {
      notifyStorageFailure(key, err);
      return false;
    }
    return false;
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
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

  setJSON<T>(key: string, value: T): boolean {
    try {
      return this.setItem(key, JSON.stringify(value));
    } catch (err) {
      notifyStorageFailure(key, err);
      return false;
    }
  },
};
