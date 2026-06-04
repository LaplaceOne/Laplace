import { defineConfig } from 'tsup';
import { baseConfig } from '@laplace-one/config/tsup';
export default defineConfig({ ...baseConfig, entry: ['src/index.ts'] });
