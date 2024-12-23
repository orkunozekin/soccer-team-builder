import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'

// Use the Google Inter font from next/font
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Jville Soccer',
  description: 'Jville Soccer Team Builder',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={cn(inter.variable, 'antialiased')}>
        <header className="sticky top-0 z-20 mb-4 flex items-center justify-center bg-red-50 py-2 font-semibold text-white">
          Jville Soccer Team Builder
        </header>
        {children}
      </body>
    </html>
  )
}
