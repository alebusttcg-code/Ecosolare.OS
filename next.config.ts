import type { NextConfig } from 'next'

/**
 * Nessuna opzione sperimentale attiva.
 *
 * Le transizioni fra le viste erano candidate a usare `experimental.viewTransition`,
 * che pero' richiede il canale sperimentale di React: su React stabile il
 * componente non esiste. Sono realizzate in `src/components/transizione.tsx`,
 * che usa l'API nativa del browser dove c'e' e un'animazione di ingresso dove no.
 */
const nextConfig: NextConfig = {}

export default nextConfig
