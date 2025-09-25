import { fetchUserList } from './actions'

export default async function Page() {
  const user = await fetchUserList()

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen gap-16">
      <main className="p-4">top ({user.ok ? user.body.count : 'error'})</main>
    </div>
  )
}
