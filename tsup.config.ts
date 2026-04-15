import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Don't bundle node_modules — keep them external
  // This avoids issues with native modules like better-sqlite3
});
