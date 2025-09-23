import { fetchApiStatus } from './actions'

export default async function Page() {
  const status = await fetchApiStatus()
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen gap-16">
      <main className="p-4">top ({status.ok ? status.body : 'error'})</main>
    </div>
  )
}
