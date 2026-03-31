import { defineConfig } from 'vite-plus'

export default defineConfig({
  fmt: {
    ignorePatterns: ['**/dist/**'],
    singleQuote: true,
    semi: false,
    trailingComma: 'none'
  },
  lint: {
    ignorePatterns: ['**/dist/**']
  }
})
