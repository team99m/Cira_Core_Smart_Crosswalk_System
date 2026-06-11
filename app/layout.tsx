import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Smart Crosswalk — Dashboard',
  description: 'Real-time smart crosswalk monitoring system by CiraCore',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] antialiased">
        {children}
      </body>
    </html>
  )
}
