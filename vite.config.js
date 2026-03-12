import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router'],
      resolvers: [ElementPlusResolver()],
      dts: './src/auto-imports.d.ts'
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: './src/components.d.ts'
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/ai-api': {
        target: 'http://192.168.0.168:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai-api/, '')
      },
      '/onenet-api': {
        target: 'https://iot-api.heclouds.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/onenet-api/, '')
      }
    }
  }
})
