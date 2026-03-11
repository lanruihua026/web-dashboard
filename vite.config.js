import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // 自动导入 Vue / Vue Router 组合式 API，无需在每个文件中手动 import
    AutoImport({
      imports: ['vue', 'vue-router'],
      resolvers: [ElementPlusResolver()],
      dts: './src/auto-imports.d.ts'
    }),
    // 自动按需导入 Element Plus 组件及其样式
    Components({
      resolvers: [ElementPlusResolver({ importStyle: 'css' })],
      dts: './src/components.d.ts'
    })
  ],
  server: {
    port: 5173,
    proxy: {
      // 代理 OneNET AIoT REST API，解决浏览器跨域限制
      '/onenet-api': {
        target: 'https://iot-api.heclouds.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/onenet-api/, '')
      }
    }
  }
})
