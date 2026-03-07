import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { EmulatorAuthGate } from '@/components/auth/EmulatorAuthGate'
import { Navigation } from '@/components/layout/Navigation'
import { cn } from '@/lib/utils'

// Use the Google Inter font from next/font
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Soccerville',
  description: 'Soccerville Team Builder',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={cn(inter.variable, 'antialiased')}>
        <EmulatorAuthGate>
          <AuthProvider>
            <Navigation />
            {children}
          </AuthProvider>
        </EmulatorAuthGate>
      </body>
    </html>
  )
}
