/**
 * Setup para testes do Robô Fiscal — simula o localStorage em ambiente Node.js.
 * Garante que cada teste execute de forma isolada, sem vazamento de estado
 * entre testes.
 */
import { beforeEach } from 'vitest';

class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

const mockStorage = new LocalStorageMock();

if (typeof window === 'undefined') {
  (global as any).window = global;
}

Object.defineProperty(global, 'localStorage', {
  value: mockStorage,
  writable: true
});

beforeEach(() => {
  mockStorage.clear();
});
