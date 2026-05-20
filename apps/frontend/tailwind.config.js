const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');

module.exports = {
  content: [
    join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  darkMode: ['class', '.night-mode'],
  theme: {
    extend: {
      colors: {
        'desert-sand': '#F5E6C8',
        'desert-sand-light': '#FBF3E0',
        'desert-parchment': '#EDD9A3',
        'desert-terracotta': '#C1644A',
        'desert-terracotta-dark': '#A0523B',
        'desert-brown': '#4A2E1A',
        'desert-brown-muted': '#7A5C42',
        'desert-border': '#D4B896',
        'desert-header': '#EDD9A3',
        'desert-night': '#1A1209',
        'desert-night-surface': '#251C10',
        'desert-night-parchment': '#2E2318',
        'desert-night-amber': '#D4872A',
        'desert-night-amber-dark': '#B5711E',
        'desert-night-sage': '#6B9E7A',
        'desert-night-text': '#E8D5B0',
        'desert-night-muted': '#A08C6E',
        'desert-night-border': '#3D2E1C',
        'cactus-green': '#4A7C59',
        'cactus-green-light': '#6BAF82',
      },
      fontFamily: {
        title: ["'Playfair Display'", 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
