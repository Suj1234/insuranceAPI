import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { Hanken_Grotesk, Fraunces, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// UI grotesk (free Söhne alternative) — all interface text
const hankenGrotesk = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans' })
// Editorial serif — page titles, the "expensive" voice
const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-serif' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Insuretech Data Platform',
  description: 'Alternate data APIs for insurance underwriting',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${hankenGrotesk.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
