import { Links, Meta, Outlet, Scripts } from 'react-router'
import type { Route } from './+types/root'
import './styles.css'

export const meta: Route.MetaFunction = () => {
  return [
    { title: 'Service Template' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ]
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="UTF-8" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

export function HydrateFallback() {
  return (
    <main className="dashboard" aria-busy="true">
      <header className="dashboard-head">
        <div>
          <p className="eyebrow">service template</p>
          <h1>Service Template</h1>
        </div>
        <p
          className="api-state api-pending"
          role="status"
          aria-live="polite"
          aria-label="Service API 問い合わせ中"
        >
          Service API 問い合わせ中
        </p>
      </header>
      <section className="state-panel" aria-busy="true">
        <p className="state-value">--</p>
        <p>ユーザーデータを読み込んでいます</p>
      </section>
    </main>
  )
}

export default function App() {
  return <Outlet />
}
