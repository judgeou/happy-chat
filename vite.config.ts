import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const PORT = process.env.PORT || '8082'
const isDev = process.env.NODE_ENV !== 'production'
const backendUrl = process.env.BACKENDURL || `http://localhost:${PORT}`
const base = '/'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  root: './',
  base: isDev ? base : './',
  server: {
    proxy: {
      [`${base}api/`]: backendUrl
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue'],
          'naive-ui': ['naive-ui'],
          'lib': ['nanoid', 'highlight.js', 'marked', './src/assets/katex/katex.mjs']
        }
      }
    }
  }
})
