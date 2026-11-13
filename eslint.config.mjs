import { defineConfig, globalIgnores } from 'eslint/config'
import nextTypescript from 'eslint-config-next/typescript'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    '**/.next/**',
    '**/node_modules/**',
    '.vercel/**',
    'build/**',
    'coverage/**',
    'dist/**',
    'next-env.d.ts',
    'out/**',
    'public/sw.js',
    'spikes/**',
  ]),
])