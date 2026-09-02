import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./isolamento.setup.ts'],
    globals: true
  }
});
