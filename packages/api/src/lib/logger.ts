import { ENV } from '../config.js'

type Options = {
  label?: string
  body: string
  // biome-ignore lint/suspicious/noExplicitAny: logger
  meta?: any
}

type ErrorOptions = Options & {
  // biome-ignore lint/suspicious/noExplicitAny: logger
  error?: any
}

export const logger = {
  log: (options: Options) => {
    const json = {
      ...options,
      level: 'INFO'
    }
    if (ENV.local) {
      // biome-ignore lint/suspicious/noConsole: logger
      console.dir(json, { depth: null })
      return
    }
    // biome-ignore lint/suspicious/noConsole: logger
    console.log(JSON.stringify(json))
  },
  error: (options: ErrorOptions) => {
    const json = {
      ...options,
      level: 'ERROR'
    }
    if (ENV.local) {
      // biome-ignore lint/suspicious/noConsole: logger
      console.dir(json, { depth: null })
      return
    }
    // biome-ignore lint/suspicious/noConsole: logger
    console.error(JSON.stringify(json))
  },
  debug: (options: Options) => {
    if (!ENV.production) {
      const json = {
        ...options,
        level: 'DEBUG'
      }
      // biome-ignore lint/suspicious/noConsole: logger
      console.dir(json, { depth: null })
    }
  }
} as const
