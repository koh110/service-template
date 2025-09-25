import { expect, test, vi } from 'vitest'
import { logger } from './logger.js'

vi.mock('console')

test('logger.log', () => {
  const logMock = vi
    .spyOn(console, 'log')
    .mockImplementationOnce(() => undefined)

  logger.log({ label: 'foo', body: 'bar' })

  expect(logMock).toHaveBeenCalledTimes(1)
  expect(logMock).toHaveBeenCalledWith(
    JSON.stringify({
      label: 'foo',
      body: 'bar',
      level: 'INFO'
    })
  )
})

test('logger.error', () => {
  const logMock = vi
    .spyOn(console, 'error')
    .mockImplementationOnce(() => undefined)

  logger.error({ label: 'foo', body: 'error', error: 'bar' })

  expect(logMock).toHaveBeenCalledTimes(1)
  expect(logMock).toHaveBeenCalledWith(
    JSON.stringify({
      label: 'foo',
      body: 'error',
      error: 'bar',
      level: 'ERROR'
    })
  )
})
