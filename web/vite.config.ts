import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { generateContent } from './scripts/build-content'

const CONTENT_DIR = resolve(fileURLToPath(new URL('../content', import.meta.url)))

/**
 * content/ 变化时重跑生成器并整页刷新。
 * 生产构建的 buildStart 也会执行一次，保证 vite build 单跑时数据也是新的。
 */
function contentPlugin(): Plugin {
  let base = '/'

  return {
    name: 'blog-content',
    configResolved(config) {
      base = config.base
    },
    buildStart() {
      generateContent(base)
    },
    configureServer(server) {
      server.watcher.add(CONTENT_DIR)
      server.watcher.on('all', (_event, file) => {
        if (!file.startsWith(CONTENT_DIR)) return
        generateContent(base)
        server.ws.send({ type: 'full-reload' })
      })
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [vue(), contentPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
})
