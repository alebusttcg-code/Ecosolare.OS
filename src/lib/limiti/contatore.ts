import { sql } from 'drizzle-orm'
import type { Esecutore } from '@/db'
import { rateLimits } from '@/db/schema'
import { valuta, type EsitoLimite, type Finestra } from './politica'

/**
 * Il contatore persistente della limitazione di frequenza.
 *
 * Un solo `INSERT ... ON CONFLICT DO UPDATE`, non una lettura seguita da una
 * scrittura. La differenza non è stilistica: due richieste simultanee che
 * leggono lo stesso valore e lo riscrivono contano per una, e un attaccante
 * che manda tutto in parallelo è precisamente il caso che stiamo limitando.
 * Qui l'incremento avviene dentro l'istruzione, quindi il conteggio è esatto
 * anche sotto concorrenza.
 *
 * Lo stato restituito è quello **dopo** l'incremento: la richiesta in corso
 * conta già, che venga accettata o rifiutata. Rifiutata e non contata sarebbe
 * un invito a insistere.
 */
export async function consumaLimite(
  db: Esecutore,
  params: {
    readonly bucket: string
    readonly chiave: string
    readonly finestra: Finestra
    readonly adesso?: Date
  },
): Promise<EsitoLimite> {
  const adesso = params.adesso ?? new Date()

  // L'unico pezzo di SQL costruito come testo. Oggi arriva sempre da una
  // costante, ma un domani basta un chiamante distratto: il controllo qui è
  // ciò che rende impossibile che diventi un'iniezione.
  const secondi = Math.round(params.finestra.durataMs / 1000)
  if (!Number.isSafeInteger(secondi) || secondi <= 0) {
    throw new Error(`Durata della finestra non valida: ${params.finestra.durataMs} ms.`)
  }
  const durata = sql.raw(`interval '${secondi} seconds'`)

  /*
   * L'istante viaggia come stringa ISO con il cast esplicito, non come `Date`.
   * Non è un dettaglio di stile: dentro un frammento `sql` il driver di
   * produzione (postgres-js) rifiuta un `Date` grezzo — «Received an instance
   * of Date» — mentre PGlite dei test lo accetta. Il test verde, l'endpoint 500.
   */
  const istante = adesso.toISOString()

  const [riga] = await db
    .insert(rateLimits)
    .values({
      bucket: params.bucket,
      key: params.chiave,
      windowStart: adesso,
      count: 1,
      previousCount: 0,
    })
    .onConflictDoUpdate({
      target: [rateLimits.bucket, rateLimits.key],
      set: {
        /*
         * Tre casi, nell'ordine in cui il CASE li incontra:
         *  1. stessa finestra    → si incrementa;
         *  2. finestra successiva → la corrente diventa la precedente e si riparte da 1;
         *  3. più vecchia ancora  → non c'è storia da conservare, si riparte da zero.
         */
        count: sql`case
          when ${rateLimits.windowStart} > ${istante}::timestamptz - ${durata}
          then ${rateLimits.count} + 1
          else 1
        end`,
        previousCount: sql`case
          when ${rateLimits.windowStart} > ${istante}::timestamptz - ${durata}
          then ${rateLimits.previousCount}
          when ${rateLimits.windowStart} > ${istante}::timestamptz - ${durata} * 2
          then ${rateLimits.count}
          else 0
        end`,
        windowStart: sql`case
          when ${rateLimits.windowStart} > ${istante}::timestamptz - ${durata}
          then ${rateLimits.windowStart}
          else ${istante}::timestamptz
        end`,
      },
    })
    .returning({
      windowStart: rateLimits.windowStart,
      count: rateLimits.count,
      previousCount: rateLimits.previousCount,
    })

  return valuta(riga!, params.finestra, adesso)
}
