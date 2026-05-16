import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // No any — use proper types or unknown
      '@typescript-eslint/no-explicit-any': 'error',

      // Use NestJS Logger instead of console
      'no-console': 'warn',

      // Catch unused variables early
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['**/dist', 'jest.config.ts'],
  },
];
