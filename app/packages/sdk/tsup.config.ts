import { defineConfig } from 'tsup';
import { baseConfig } from '@laplace/config/tsup';
export default defineConfig({ ...baseConfig, entry: ['src/index.ts', 'src/react/index.ts', 'src/raw.ts'] });
