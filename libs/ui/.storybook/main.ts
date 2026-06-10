import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],
  framework: {
    name: '@storybook/angular',
    // browserTarget/outputDir/configDir are supplied by the Angular builder
    // target (ui:build-storybook in angular.json). Running through the builder
    // is what provides `angularBrowserTarget` at runtime; invoking the plain
    // `storybook build` CLI does not, which trips AngularLegacyBuildOptionsError.
    options: {
      tsConfig: './tsconfig.json',
    },
  },
  docs: {
    autodocs: 'tag',
  },
  // Component sources use ESM-style `.js` import specifiers that resolve to the
  // sibling `.ts` files (e.g. `'../mascot/mascot.js'`). The Angular/esbuild lib
  // build handles this, but Storybook's webpack does not by default — teach its
  // resolver to try `.ts` when a `.js` specifier is requested.
  webpackFinal: async (webpackConfig) => {
    webpackConfig.resolve = webpackConfig.resolve ?? {};
    webpackConfig.resolve.extensionAlias = {
      ...(webpackConfig.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.js'],
    };
    return webpackConfig;
  },
};

export default config;
