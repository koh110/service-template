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
      console.dir(json, { depth: null })
      return
    }
    console.log(JSON.stringify(json))
  },
  error: (options: ErrorOptions) => {
    const json = {
      ...options,
      level: 'ERROR'
    }
    if (ENV.local) {
      console.dir(json, { depth: null })
      return
    }
    console.error(JSON.stringify(json))
  },
  debug: (options: Options) => {
    if (!ENV.production) {
      const json = {
        ...options,
        level: 'DEBUG'
      }
      console.dir(json, { depth: null })
    }
  }
} as const
