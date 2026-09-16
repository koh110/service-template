// @vitest-environment node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vite-plus/test'
import { assertDistribution, formatAuthority, loadConfig } from './config.js'

test('config defaults to a loopback authority and API origin', () => {
  const config = loadConfig({})

  expect(config.host).toBe('127.0.0.1')
  expect(config.port).toBe(8789)
  expect(config.authority).toBe('127.0.0.1:8789')
  expect(config.origin).toBe('http://127.0.0.1:8789')
  expect(config.apiUri).toBe('http://localhost:8000')
})

test('config preserves the API origin without exposing a credential setting', () => {
  const config = loadConfig({ API_URI: 'https://api.example.test' })

  expect(config.apiUri).toBe('https://api.example.test')
  expect(formatAuthority('::1', 8789)).toBe('[::1]:8789')
})

test('config rejects non-loopback hosts and malformed API origins', () => {
  expect(() => loadConfig({ HOST: '0.0.0.0' })).toThrow(/HOST must be one of/)
  expect(() => loadConfig({ API_URI: 'http://example.test/path' })).toThrow(/API_URI must be/)
  expect(() => loadConfig({ API_URI: 'http://user:pass@example.test' })).toThrow(/API_URI must be/)
})

test('distribution root and index must be non-symlink filesystem entries', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'service-template-spa-'))
  const index = path.join(root, 'index.html')
  fs.writeFileSync(index, '<!doctype html>')
  await expect(assertDistribution(root)).resolves.toBeUndefined()

  const linkRoot = `${root}-link`
  fs.symlinkSync(root, linkRoot, 'dir')
  await expect(assertDistribution(linkRoot)).rejects.toThrow(/non-symlink directory/)
  fs.rmSync(linkRoot, { force: true })
  fs.rmSync(root, { recursive: true, force: true })
})
