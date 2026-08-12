import type { NextConfig } from 'next'

/**
 * Nessuna opzione sperimentale attiva.
 *
 * Le transizioni fra le viste erano candidate a usare `experimental.viewTransition`,
 * che pero' richiede il canale sperimentale di React: su React stabile il
 * componente non esiste. Sono realizzate in `src/components/transizione.tsx`,
 * che usa l'API nativa del browser dove c'e' e un'animazione di ingresso dove no.
 *
 * I redirect sotto tengono vivi i vecchi bookmark dopo il rinominamento
 * delle rotte allineate alle etichette di menu.
 */
const nextConfig: NextConfig = {
  // Playwright e Chromium serverless non vanno nel bundle webpack: sono pesanti
  // e `@sparticuz/chromium` espone binari nativi.
  serverExternalPackages: ['playwright-core', '@sparticuz/chromium'],
  /*
   * I due pacchetti del PDF vanno inclusi per intero nella funzione.
   *
   * Il tracciamento automatico segue gli `import`, e questi due caricano a
   * runtime file che nessun import nomina: `playwright-core` legge
   * `browsers.json` da dentro il proprio bundle, `@sparticuz/chromium` apre gli
   * archivi in `bin/`. Senza, in produzione la funzione parte e fallisce solo
   * al momento della stampa, con «Cannot find module
   * playwright-core/browsers.json» — un 500 che in locale non si riproduce mai,
   * perché in locale i file ci sono comunque.
   *
   * La chiave è il percorso della rotta: `*` copre il segmento dinamico senza
   * dover proteggere le parentesi quadre dal glob.
   */
  outputFileTracingIncludes: {
    '/api/preventivi/*/pdf': [
      './node_modules/playwright-core/**/*',
      './node_modules/@sparticuz/chromium/**/*',
    ],
  },
  // Foto di cantiere e scansioni: il default Next è 1 MB e su Vercel i POST
  // sopra quella soglia falliscono con 413 senza arrivare alla validazione.
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
    proxyClientMaxBodySize: '4.5mb',
  },
  async redirects() {
    return [
      { source: '/opportunita', destination: '/lead', permanent: true },
      { source: '/opportunita/:path*', destination: '/lead/:path*', permanent: true },
      { source: '/sopralluoghi', destination: '/agenda', permanent: true },
      { source: '/sopralluoghi/:path*', destination: '/agenda/:path*', permanent: true },
      { source: '/commesse', destination: '/cantieri', permanent: true },
      { source: '/commesse/:path*', destination: '/cantieri/:path*', permanent: true },
      { source: '/banca', destination: '/controllo-bancario', permanent: true },
      { source: '/banca/:path*', destination: '/controllo-bancario/:path*', permanent: true },
    ]
  },
}

export default nextConfig
