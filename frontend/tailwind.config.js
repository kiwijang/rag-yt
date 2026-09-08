/** @type {import('tailwindcss').Config} */
const sharedPreset = require('./libs/tailwind-config/tailwind.preset');

module.exports = {
  presets: [sharedPreset],
  content: ['./apps/frontend/src/**/*.{html,ts}'],
};
