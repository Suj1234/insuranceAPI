/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
      },
      fontSize: {
        // Strict type scale — only these sizes used in this project
        'xs':   ['11px', { lineHeight: '16px' }],
        'sm':   ['13px', { lineHeight: '20px' }],
        'base': ['14px', { lineHeight: '22px' }],
        'lg':   ['16px', { lineHeight: '24px' }],
        'xl':   ['18px', { lineHeight: '28px' }],
        '2xl':  ['22px', { lineHeight: '32px' }],
      },
      colors: {
        // All colours via CSS custom properties — never use Tailwind colour palette directly
        // Use text-[--color-*] / bg-[--color-*] / border-[--color-*] syntax
      },
      borderRadius: {
        // Strict radius scale for this project
        'sm': '2px',   // badges, inline code
        DEFAULT: '4px', // inputs, buttons
        'md': '6px',   // dropdowns, panels
        'lg': '8px',   // login card only
        // xl, 2xl, 3xl, full — do not use (see DESIGN.md)
      },
      boxShadow: {
        // Only shadow-sm permitted — on dropdown menus only
        'sm': '0 1px 3px 0 rgb(0 0 0 / 0.08)',
        // shadow, md, lg, xl — do not use (see DESIGN.md)
      },
    },
  },
  plugins: [],
}
