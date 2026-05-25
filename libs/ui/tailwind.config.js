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
        'studio-bg': '#FAFAF7',
        'studio-surface': '#FFFFFF',
        'studio-card': '#F4F2EC',
        'studio-accent': '#B8845F',
        'studio-accent-dark': '#9C6F4D',
        'studio-ink': '#1A1D21',
        'studio-ink-muted': '#6B6F76',
        'studio-border': '#E8E6DF',
        'studio-night': '#0F1419',
        'studio-night-surface': '#181D24',
        'studio-night-card': '#1F252E',
        'studio-night-accent': '#D4A574',
        'studio-night-accent-dark': '#B88A5C',
        'studio-night-text': '#E8E6DF',
        'studio-night-muted': '#9CA3AF',
        'studio-night-border': '#2A3038',
      },
      fontFamily: {
        title: ["'Playfair Display'", 'Georgia', 'serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
