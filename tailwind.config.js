/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'pacman-yellow': '#ffff00',
        'pacman-blue': '#2121ff',
        'pacman-pink': '#ffb8ff',
        'pacman-red': '#ff0000',
        'pacman-cyan': '#00ffff',
        'pacman-orange': '#ffb852',
        'pacman-black': '#000000',
        'pacman-white': '#ffffff',
      },
      fontFamily: {
        'arcade': ['Press Start 2P', 'cursive'],
        'game': ['VT323', 'monospace'],
      },
      boxShadow: {
        'neon': '0 0 5px theme(colors.pacman-blue), 0 0 10px theme(colors.pacman-blue)',
        'neon-yellow': '0 0 5px theme(colors.pacman-yellow), 0 0 10px theme(colors.pacman-yellow)',
        'neon-pink': '0 0 5px theme(colors.pacman-pink), 0 0 10px theme(colors.pacman-pink)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
} 