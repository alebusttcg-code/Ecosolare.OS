import type { MetadataRoute } from 'next'

/**
 * Manifest PWA: rende il gestionale installabile («Aggiungi a schermata Home»).
 * Su telefono si apre a tutto schermo, con icona e colori del marchio —
 * per i tecnici in cantiere è un'app, non una scheda del browser.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EcoSolare OS',
    short_name: 'EcoSolare',
    description: 'Sistema operativo aziendale EcoSolare',
    start_url: '/',
    display: 'standalone',
    background_color: '#050a14',
    theme_color: '#050a14',
    icons: [
      { src: '/pwa/icona-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa/icona-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
