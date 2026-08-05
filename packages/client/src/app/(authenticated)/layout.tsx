import { redirect } from 'next/navigation'
import { isLogin } from '../_lib/auth.server'
import { getRoute } from '../_lib/route'

export default async function AuthenticatedLayout({
  children
}: {
  children: React.ReactNode
}) {
  const login = await isLogin()
  if (!login.ok) {
    redirect(getRoute({ type: 'login' }).path)
  }
  return children
}
