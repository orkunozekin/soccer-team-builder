import type { Metadata, Viewport } from 'next'
import {
  Big_Shoulders_Display,
  Inter_Tight,
  JetBrains_Mono,
} from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { EmulatorAuthGate } from '@/components/auth/EmulatorAuthGate'
import { AdminUiToggle } from '@/components/dev/AdminUiToggle'
import { LaunchDarklyProvider } from '@/components/flags/LaunchDarklyProvider'
import { AppShell } from '@/components/layout/AppShell'
import { MobileViewportFix } from '@/components/layout/MobileViewportFix'
import { SwrProvider } from '@/components/providers/SwrProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { ThemeSync } from '@/components/providers/ThemeSync'
import { cn } from '@/lib/utils'

const sans = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-sans',
})

// Condensed display face for dates, headlines and primary calls to action.
const display = Big_Shoulders_Display({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-display',
})

// Statuses, counts and jersey numbers.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-mono',
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
    // next-themes sets the theme class on <html> before hydration.
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          sans.variable,
          display.variable,
          mono.variable,
          'font-sans antialiased'
        )}
      >
        <ThemeProvider>
          <EmulatorAuthGate>
            <AuthProvider>
              <SwrProvider>
                <LaunchDarklyProvider>
                  <ThemeSync />
                  <MobileViewportFix />
                  <AppShell>{children}</AppShell>
                  <AdminUiToggle />
                </LaunchDarklyProvider>
              </SwrProvider>
            </AuthProvider>
          </EmulatorAuthGate>
        </ThemeProvider>
      </body>
    </html>
  )
}
