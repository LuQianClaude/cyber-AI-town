/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Cyber Universe 主题色板：Pixel Life Simulation + Elegant Web UI
        cream: {
          DEFAULT: '#FAF6EF',
          deep: '#F1EAE0',
        },
        sage: {
          DEFAULT: '#9CAF88',
          dark: '#6F8560',
          light: '#C8D6BC',
        },
        sky: {
          DEFAULT: '#A8C5DA',
          dark: '#6E97B8',
          light: '#D6E6F2',
        },
        wbrown: {
          DEFAULT: '#7A5C45',
          dark: '#54402F',
          light: '#A98F78',
        },
        pink: {
          DEFAULT: '#F2C4CE',
          dark: '#D89AA8',
        },
        ink: '#2E2A26',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
