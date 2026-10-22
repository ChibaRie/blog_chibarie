/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  corePlugins: {
    // 关闭 preflight，避免与 Element Plus 的基础样式冲突
    preflight: false,
  },
  theme: {
    extend: {
      opacity: Object.fromEntries(
        Array.from({ length: 100 }, (_, i) => [i, `${i / 100}`]),
      ),
    },
  },
  plugins: [],
}
