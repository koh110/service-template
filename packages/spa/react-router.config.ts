import type { Config } from '@react-router/dev/config'

export default {
  ssr: false,
  buildDirectory: 'dist/spa',
  future: {
    v8_viteEnvironmentApi: true
  }
} satisfies Config
