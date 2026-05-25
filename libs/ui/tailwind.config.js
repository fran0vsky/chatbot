const { join } = require('path');

module.exports = {
  content: [
    join(__dirname, 'src/**/*.{ts,html}'),
    join(__dirname, '.storybook/**/*.{ts,html}'),
  ],
  darkMode: ['class', '.night-mode'],
  theme: {
    extend: {
      colors: {
        'studio-bg': '#F1ECDA',
        'studio-surface': '#FAF6E8',
        'studio-card': '#E2DAB8',
        'studio-accent': '#5C8A3A',
        'studio-accent-dark': '#446B26',
        'studio-ink': '#1F2A1A',
        'studio-ink-muted': '#5A6B4D',
        'studio-border': '#CFC8A8',
        'studio-night': '#0A1A28',
        'studio-night-surface': '#102638',
        'studio-night-card': '#163148',
        'studio-night-accent': '#E87850',
        'studio-night-accent-dark': '#C45F38',
        'studio-night-text': '#EDE6D6',
        'studio-night-muted': '#8FA3B5',
        'studio-night-border': '#1F3B55',
      },
      fontFamily: {
        title: ["'Playfair Display'", 'Georgia', 'serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
