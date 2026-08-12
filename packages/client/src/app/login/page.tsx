'use client'

import { TextField } from '@radix-ui/themes'
import { useRouter } from 'next/navigation'
import { useState, Activity } from 'react'
import { Button } from '../_components/ui/index'
import { getRoute } from '../_lib/route'

export default function Page() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: email })
      })
      if (!res.ok) {
        setError('Login failed')
        return
      }
      router.push(getRoute({ type: 'top' }).path)
    } catch {
      setError('Login failed')
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 min-w-64"
      >
        <TextField.Root
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
        <Button type="submit" disabled={isPending}>
          Login
        </Button>
        <Activity mode={error ? 'visible' : 'hidden'}>
          <p>{error}</p>
        </Activity>
      </form>
    </div>
  )
}
