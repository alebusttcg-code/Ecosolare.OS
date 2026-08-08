import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EcoSolare OS',
  description: 'Sistema operativo aziendale EcoSolare',
  robots: { index: false, follow: false },
  // Favicon e apple-touch-icon: `src/app/icon.png` e `src/app/apple-icon.png`
  // (marchio solare EcoSolare su fondo abisso, come la PWA).
  appleWebApp: {
    capable: true,
    title: 'EcoSolare',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  // Colore della cornice browser su mobile: l'abisso del tema.
  themeColor: '#050a14',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  )
}
