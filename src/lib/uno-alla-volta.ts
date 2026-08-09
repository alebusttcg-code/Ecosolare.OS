/**
 * Esegue compiti async in serie, nell'ordine dato.
 *
 * Su Vercel il pool PostgreSQL è piccolo (e con max=1 le Promise.all su
 * drizzle/postgres.js possono lasciare la soft-navigation in stallo). Usare
 * questa helper per i fan-out di query nello stesso request di render.
 */
export async function unoAllaVolta<const T extends readonly unknown[]>(
  compiti: { readonly [K in keyof T]: () => Promise<T[K]> },
): Promise<{ [K in keyof T]: T[K] }> {
  const risultati: unknown[] = []
  for (const compito of compiti) {
    risultati.push(await compito())
  }
  return risultati as { [K in keyof T]: T[K] }
}
