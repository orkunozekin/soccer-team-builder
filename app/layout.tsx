import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { EmulatorAuthGate } from '@/components/auth/EmulatorAuthGate'
import { LaunchDarklyProvider } from '@/components/flags/LaunchDarklyProvider'
import { AdminUiToggle } from '@/components/dev/AdminUiToggle'
import { MobileViewportFix } from '@/components/layout/MobileViewportFix'
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
  // Jersey numbers + names + position codes (e.g. "10 Joel Hawbaker ST") look
  // like street addresses to mobile Safari/Chrome data detectors.
  formatDetection: {
    address: false,
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Prefer resizing the layout when the virtual keyboard opens so pages like
  // Profile do not keep an inflated scrollable gap after dismiss (Android;
  // ignored on iOS today, where MobileViewportFix compensates).
  interactiveWidget: 'resizes-content',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={cn(inter.variable, 'font-sans antialiased')}>
        <EmulatorAuthGate>
          <AuthProvider>
            <LaunchDarklyProvider>
              <MobileViewportFix />
              <Navigation />
              {children}
              <AdminUiToggle />
            </LaunchDarklyProvider>
          </AuthProvider>
        </EmulatorAuthGate>
      </body>
    </html>
  )
}
