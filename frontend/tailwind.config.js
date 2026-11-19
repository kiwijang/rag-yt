/** @type {import('tailwindcss').Config} */
const sharedPreset = require('./libs/tailwind-config/tailwind.preset');

module.exports = {
  darkMode: 'selector',
  presets: [sharedPreset],
  theme: {
    extend: {
      fontFamily: { sans: ['var(--app-font-sans)'] },
    },
  },
  content: {
    relative: true,
    files: ['./apps/frontend/src/**/*.{html,ts}', './libs/shared/ui/src/**/*.{html,ts}'],
  },
};
