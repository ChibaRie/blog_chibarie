/**
 * 配色统一走 CSS 变量，色板本身定义在 src/styles/tokens.css。
 * 夜航是默认值（:root），纸白通过 html[data-theme='paper'] 覆盖。
 * 组件里写 bg-plate、text-ink2、border-line/20 即可跟随主题。
 */
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: c('paper'),
        paper2: c('paper2'),
        plate: c('plate'),
        plate2: c('plate2'),
        ink: c('ink'),
        ink2: c('ink2'),
        ink3: c('ink3'),
        ink4: c('ink4'),
        line: c('line'),
        accent: c('accent'),
        accentInk: c('accent-ink'),
        accentText: c('accent-text'),
        danger: c('danger'),
        cmd: c('cmd'),
        cmdInk: c('cmd-ink'),
      },
      fontFamily: {
        sans: [
          'Saira',
          'PingFang SC',
          'Microsoft YaHei',
          'Noto Sans SC',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'Cascadia Code', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.5' }],
        sm: ['13px', { lineHeight: '1.6' }],
        base: ['15px', { lineHeight: '1.7' }],
        lg: ['17px', { lineHeight: '1.7' }],
        xl: ['20px', { lineHeight: '1.5' }],
        '2xl': ['24px', { lineHeight: '1.4' }],
        '3xl': ['30px', { lineHeight: '1.3' }],
        '4xl': ['38px', { lineHeight: '1.2' }],
        '5xl': ['48px', { lineHeight: '1.1' }],
      },
      borderColor: {
        DEFAULT: c('line'),
      },
    },
  },
  plugins: [],
}