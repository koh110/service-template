import type { Route } from './+types/dashboard'
import { DashboardView } from '../components/DashboardView'
import { fetchUsers } from '../lib/user.client'

export function clientLoader() {
  return fetchUsers()
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  return <DashboardView result={loaderData} />
}
