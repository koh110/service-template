import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // localAuthProvider は APP_ENV=local/test でのみ動作する(production への
    // fail-closed のため)。テスト実行時は test を明示する。
    env: {
      APP_ENV: 'test'
    }
  }
})
