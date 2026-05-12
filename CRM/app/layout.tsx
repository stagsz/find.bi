import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/layout/Navigation'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { TimerProvider } from '@/components/providers/TimerContext'

export const metadata: Metadata = {
  title: 'CRM - Simple & Fast',
  description: 'A simple, fast CRM for small sales teams',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <TimerProvider>
          <ThemeProvider>
            <Navigation />
            {children}
          </ThemeProvider>
        </TimerProvider>
      </body>
    </html>
  )
}
