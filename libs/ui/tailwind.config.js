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
        'jungle-bg': '#0F2419',
        'jungle-surface': '#1A3D2E',
        'jungle-card': '#2D5A3D',
        'jungle-accent': '#D4A574',
        'jungle-accent-dark': '#A8804A',
        'jungle-ink': '#F0E6CC',
        'jungle-ink-muted': '#A89E84',
        'jungle-border': '#5C4A2A',
        'jungle-user-bubble': '#E8D9A0',
        'jungle-user-ink': '#1F2A1A',
        'jungle-night': '#061421',
        'jungle-night-surface': '#0F2B3D',
        'jungle-night-card': '#1A4055',
        'jungle-night-accent': '#7AB8D4',
        'jungle-night-accent-dark': '#4A8BA8',
        'jungle-night-text': '#D8E4ED',
        'jungle-night-muted': '#7A8FA0',
        'jungle-night-border': '#2A4055',
        'jungle-night-user-bubble': '#1F3D52',
      },
      fontFamily: {
        title: ["'Playfair Display'", 'Georgia', 'serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        'spino-wave': {
          '0%, 100%': { transform: 'scaleY(0.25)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'spino-paw': {
          '0%, 100%': { opacity: '0.2', transform: 'translateY(0)' },
          '50%': { opacity: '1', transform: 'translateY(-3px)' },
        },
      },
      animation: {
        'spino-wave-idle': 'spino-wave 1.6s ease-in-out infinite',
        'spino-wave-thinking': 'spino-wave 0.5s ease-in-out infinite',
        'spino-paw': 'spino-paw 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
