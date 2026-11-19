import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';

import base from './base.js';

/** Flat config for Next.js apps: the base config plus Next's Core Web Vitals and TS rules. */
export default tseslint.config(
  {
    ignores: ['.next/**', 'out/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'],
  },
  ...nextVitals,
  ...nextTypescript,
  ...base
);
