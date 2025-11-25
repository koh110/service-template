import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/dist/**'],
    globalSetup: [path.resolve('./test/globalSetup.ts')],
    setupFiles: [path.resolve('./test/setup.ts')],
    maxWorkers: 8
  }
})
