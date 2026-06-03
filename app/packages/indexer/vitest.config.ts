import { defineConfig } from 'vitest/config';
// pglite boots an in-process WASM Postgres + runs migrations per test (~2s alone, more under the
// cross-package parallelism of `turbo run test`), so the 5s default testTimeout is too tight.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 30000, hookTimeout: 30000 } });
