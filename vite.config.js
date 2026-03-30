import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig(({ mode }) => {
  // 加载当前模式的环境变量（.env.development / .env.production 等）
  const env = loadEnv(mode, process.cwd(), '')
  const aiHost = env.VITE_AI_SERVER_HOST || '192.168.0.168'
  const aiPort = env.VITE_AI_SERVER_PORT || '8000'

  return {
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
          target: `http://${aiHost}:${aiPort}`,
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
  }
})
