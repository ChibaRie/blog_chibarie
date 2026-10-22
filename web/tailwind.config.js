/**
 * 配色统一走 CSS 变量：色板本身定义在 src/styles/main.css 里，
 * 暗色为默认值（:root），html.light 覆盖为亮色值。
 * 这样组件里所有 bg-night-800/55、text-mist-300 之类的写法无需改动即可跟随主题。
 */
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // night = 页面与卡片底色（950 最深 -> 500 最浅）
        night: {
          950: c('night-950'),
          900: c('night-900'),
          800: c('night-800'),
          700: c('night-700'),
          600: c('night-600'),
          500: c('night-500'),
        },
        // sakura = 主强调色
        sakura: {
          200: c('sakura-200'),
          300: c('sakura-300'),
          400: c('sakura-400'),
          500: c('sakura-500'),
          600: c('sakura-600'),
          700: c('sakura-700'),
        },
        // cosmos = 次强调色
        cosmos: {
          200: c('cosmos-200'),
          300: c('cosmos-300'),
          400: c('cosmos-400'),
          500: c('cosmos-500'),
          600: c('cosmos-600'),
          700: c('cosmos-700'),
        },
        // mist = 文字与描边（100 最重 -> 600 最轻）
        mist: {
          100: c('mist-100'),
          200: c('mist-200'),
          300: c('mist-300'),
          400: c('mist-400'),
          500: c('mist-500'),
          600: c('mist-600'),
        },
      },
      // 整体较默认刻度上调约 1px，行高保持相对比例
      fontSize: {
        xs: ['13px', { lineHeight: '1.35' }],
        sm: ['15px', { lineHeight: '1.5' }],
        base: ['17px', { lineHeight: '1.5' }],
        lg: ['19px', { lineHeight: '1.55' }],
        xl: ['21px', { lineHeight: '1.5' }],
        '2xl': ['25px', { lineHeight: '1.4' }],
        '3xl': ['31px', { lineHeight: '1.35' }],
        '4xl': ['37px', { lineHeight: '1.3' }],
      },
      opacity: Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [i, `${i / 100}`]),
      ),
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'Source Han Sans SC',
          'Noto Sans CJK SC',
          'sans-serif',
        ],
        serif: [
          'Source Han Serif SC',
          'Noto Serif SC',
          'Songti SC',
          'SimSun',
          'Georgia',
          'serif',
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Cascadia Code',
          'Consolas',
          'Menlo',
          'monospace',
        ],
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        glow: 'var(--shadow-glow)',
        'glow-lg': 'var(--shadow-glow-lg)',
      },
      backdropBlur: {
        card: '14px',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        // 用 backwards 而非 both：both 会让动画结束后永久占用 transform，
        // 压住卡片 hover 的上浮效果（CSS 动画优先级高于普通声明）
        fadeUp: 'fadeUp 0.5s ease-out backwards',
        shimmer: 'shimmer 3.5s ease-in-out infinite',
      },
      backgroundImage: {
        'grid-glow':
          'radial-gradient(circle at 50% 0%, rgb(var(--c-sakura-400) / 0.10), transparent 55%)',
      },
    },
  },
  plugins: [],
}
