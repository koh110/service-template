import { reactRouter } from '@react-router/dev/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'
import { formatAuthority, loadConfig, type RuntimeConfig } from './src/server/config.js'
import { createApiProxy } from './src/server/proxy.js'
import { handleDevApiBoundary } from './src/server/static-server.js'

type DevelopmentServer = {
  httpServer?: {
    address: () => { port: number } | string | null
  } | null
}

const baseConfig = loadConfig()
const apiProxy = createApiProxy(baseConfig)

function getDevelopmentConfig(server: DevelopmentServer) {
  const address = server.httpServer?.address()
  if (address === undefined || address === null || typeof address === 'string') {
    return null
  }

  const authority = formatAuthority('127.0.0.1', address.port)
  return {
    ...baseConfig,
    host: '127.0.0.1',
    port: address.port,
    authority,
    origin: `http://${authority}`
  } satisfies RuntimeConfig
}

export default defineConfig(({ mode }) => ({
  plugins: [
    mode === 'test' ? react() : reactRouter(),
    {
      name: 'spa-api-proxy',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const developmentConfig = getDevelopmentConfig(server)
          void handleDevApiBoundary({
            req,
            res,
            next,
            config: developmentConfig,
            proxy: apiProxy
          })
        })
        server.httpServer?.on('close', () => {
          apiProxy.abortAll()
        })
      }
    }
  ],
  server: {
    host: '127.0.0.1',
    port: 0,
    strictPort: true,
    cors: false,
    allowedHosts: ['127.0.0.1', 'localhost', '::1']
  },
  test: {
    environment: 'happy-dom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/.react-router/**']
  }
}))
