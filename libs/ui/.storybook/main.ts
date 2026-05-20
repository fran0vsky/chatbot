import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
  framework: {
    name: '@storybook/angular',
    options: {
      tsConfig: '../tsconfig.lib.json',
    },
  },
  docs: {
    autodocs: 'tag',
  },
};

export default config;
