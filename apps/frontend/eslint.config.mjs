import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Enforce consistent component/directive naming
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],

      // Enforce standalone components — no NgModules
      '@angular-eslint/prefer-standalone': 'error',

      // No any — use proper types or unknown
      '@typescript-eslint/no-explicit-any': 'error',

      // Catch unused variables early
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // No direct console — use a proper logging approach
      'no-console': 'warn',
    },
  },
  {
    files: ['**/*.html'],
    rules: {},
  },
];
