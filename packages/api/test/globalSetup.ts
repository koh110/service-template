import type { TestProject } from 'vitest/node'

export async function setup({ config }: TestProject) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('not test!!!')
  }
}
