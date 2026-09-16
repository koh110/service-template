// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vite-plus/test'

import { HydrateFallback } from '../root'
import { DashboardView } from './DashboardView'
import type { UserResponse } from '../../src/api-contract'
import type { UserLoadResult } from '../lib/api-client'

const successData = {
  count: 2,
  user: [
    {
      id: 1,
      name: 'Alice',
      created_at: 1710000000,
      updated_at: 1710003600
    },
    {
      id: 2,
      name: 'Bob',
      created_at: 1710007200,
      updated_at: 1710010800
    }
  ]
} satisfies UserResponse

const failureResult = {
  ok: false,
  status: 502,
  body: 'Bad Gateway'
} satisfies UserLoadResult

const authenticationFailureResult = {
  ok: false,
  status: 401,
  body: 'Not authenticated'
} satisfies UserLoadResult

afterEach(() => {
  cleanup()
})

test('loading fixture shows an accessible pending state', () => {
  render(<HydrateFallback />)

  expect(screen.getByRole('status', { name: 'Service API 問い合わせ中' })).toBeTruthy()
  expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('true')
  expect(screen.getByText('--')).toBeTruthy()
})

test('success fixture shows online state, summary, and every user', () => {
  render(<DashboardView result={{ ok: true, body: successData }} />)

  expect(screen.getByRole('status', { name: 'API ONLINE' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: '登録ユーザー' })).toBeTruthy()
  expect(screen.getByText('2件')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Alice' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Bob' })).toBeTruthy()
})

test('empty fixture shows a domain-specific empty state', () => {
  render(<DashboardView result={{ ok: true, body: { count: 0, user: [] } }} />)

  expect(screen.getByRole('status', { name: 'API ONLINE' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'ユーザーがありません' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'ユーザー一覧' })).toBeNull()
})

test('failure fixture shows offline status without exposing upstream details', () => {
  render(<DashboardView result={failureResult} />)

  expect(screen.getByRole('status', { name: 'API OFFLINE' })).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('Service APIへ接続できません')
  expect(screen.queryByText('Bad Gateway')).toBeNull()
})

test('authentication failure fixture asks for a session without showing a transport error', () => {
  render(<DashboardView result={authenticationFailureResult} />)

  expect(screen.getByRole('status', { name: 'AUTH REQUIRED' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'セッションが必要です' })).toBeTruthy()
  expect(screen.getByText(/Next\.jsサンプルでログイン/)).toBeTruthy()
  expect(screen.queryByText('Service APIへ接続できません')).toBeNull()
})
