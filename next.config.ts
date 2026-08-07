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
