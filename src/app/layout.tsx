import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Insuretech Data Platform',
  description: 'Alternate data APIs for insurance underwriting',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
