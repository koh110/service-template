import { Activity } from 'react'
import { formatJst } from '../lib/format'
import type { UserLoadResult } from '../lib/api-client'

type DashboardViewProps = {
  result: UserLoadResult
}

type UserListProps = {
  data: Extract<UserLoadResult, { ok: true }>['body']
}

function ApiState({ online }: { online: boolean }) {
  if (online) {
    return (
      <p className="api-state api-online" role="status" aria-live="polite" aria-label="API ONLINE">
        API ONLINE
      </p>
    )
  }
  return (
    <p className="api-state api-offline" role="status" aria-live="polite" aria-label="API OFFLINE">
      API OFFLINE
    </p>
  )
}

function UserList({ data }: UserListProps) {
  if (data.user.length === 0) {
    return (
      <section className="state-panel" aria-labelledby="empty-title">
        <p className="state-value">--</p>
        <h2 id="empty-title">ユーザーがありません</h2>
        <p className="state-hint">Service APIに登録されたユーザーはありません。</p>
      </section>
    )
  }

  return (
    <>
      <section className="summary-card" aria-labelledby="summary-title">
        <div>
          <p className="card-kicker">Service API</p>
          <h2 id="summary-title">登録ユーザー</h2>
        </div>
        <strong className="summary-value">{data.count}</strong>
      </section>
      <section className="users-panel" aria-labelledby="users-title">
        <header className="panel-head">
          <div>
            <p className="card-kicker">Directory</p>
            <h2 id="users-title">ユーザー一覧</h2>
          </div>
          <span className="panel-count">{data.count}件</span>
        </header>
        <ul className="user-list">
          {data.user.map((user) => {
            return (
              <li className="user-card" key={user.id}>
                <div className="user-card-head">
                  <h3>{user.name}</h3>
                  <span className="user-id">ID {user.id}</span>
                </div>
                <dl className="user-meta">
                  <div>
                    <dt>作成</dt>
                    <dd>{formatJst(user.created_at)}</dd>
                  </div>
                  <div>
                    <dt>更新</dt>
                    <dd>{formatJst(user.updated_at)}</dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}

function OfflineState() {
  return (
    <section className="state-panel state-offline" role="alert" aria-labelledby="offline-title">
      <p className="state-value">OFFLINE</p>
      <h2 id="offline-title">Service APIへ接続できません</h2>
      <p className="state-hint">Service APIの稼働状態と接続設定を確認してください。</p>
    </section>
  )
}

export function DashboardView({ result }: DashboardViewProps) {
  const successData = result.ok ? result.body : null

  return (
    <main className="dashboard" aria-busy="false">
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">service template</p>
          <h1>Service Template</h1>
        </div>
        <ApiState online={result.ok} />
      </header>
      <Activity mode={successData === null ? 'hidden' : 'visible'}>
        {successData === null ? null : <UserList data={successData} />}
      </Activity>
      <Activity mode={successData === null ? 'visible' : 'hidden'}>
        {successData === null ? <OfflineState /> : null}
      </Activity>
    </main>
  )
}
