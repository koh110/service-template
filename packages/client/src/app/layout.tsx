import type { Metadata } from 'next'
import { Theme } from '@radix-ui/themes'
import '@radix-ui/themes/styles.css'
import './globals.css'
import { APP_NAME } from '../constants'

export const metadata: Metadata = {
  title: APP_NAME
}

export default function RootLayout({
  children,
  header
}: Readonly<{
  children: React.ReactNode
  header: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <meta name="viewport" content="initial-scale=1, width=device-width" />
      <body>
        <Theme accentColor="indigo">
          {header}
          <main className="flex-grow grid grid-cols-[auto_1fr]">
            {children}
          </main>
        </Theme>
      </body>
    </html>
  )
}
