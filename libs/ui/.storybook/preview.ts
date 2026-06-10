import type { Preview } from '@storybook/angular';
// styles.scss (Tailwind + theme tokens) is injected via the `styles` option of
// the ui:build-storybook builder in angular.json, which routes it through
// Angular's global-style pipeline (PostCSS + Tailwind). Importing it here would
// instead hit a webpack module rule without css-loader and fail on @tailwind.

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
