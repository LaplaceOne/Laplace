import { defineConfig } from 'tsup';
import { baseConfig } from '@laplace/config/tsup';
export default defineConfig({
  ...baseConfig,
  entry: ['src/index.ts', 'src/core.ts', 'src/bin/indexer.ts', 'src/bin/api.ts', 'src/bin/dev.ts', 'src/bin/reproject.ts'],
});
