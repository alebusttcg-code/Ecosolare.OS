import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/env'
import { ambienteDatabase, hostDatabase } from './ambiente'
import * as schema from './schema'

/**
 * Connessione al database.
 *
 * Sviluppo, staging e produzione usano lo stesso **motore** — PostgreSQL
 * gestito — perche' l'ambiente locale deve somigliare alla produzione, non a un
 * surrogato. Lo stesso motore, pero', non vuol dire la stessa istanza: per
 * settimane questa frase e' stata letta come «lo stesso database» e ogni prova
 * in locale ha scritto sui dati dei clienti. Ogni ambiente ha il suo
 * `DATABASE_URL`, e `src/db/ambiente.ts` dice a chi guarda il terminale dove si
 * trova. I test automatici usano PGlite (Postgres in-process) — vedere
 * `src/db/testing.ts`.
 *
 * L'inizializzazione e' pigra di proposito: leggere le variabili d'ambiente
 * al caricamento del modulo farebbe fallire `next build` in una macchina di
 * build che, giustamente, non ha le credenziali di produzione.
 */

declare global {
  // In sviluppo Next ricarica i moduli a ogni modifica: senza questa cache
  // si aprirebbe una connessione nuova a ogni salvataggio, fino a esaurire il pool.
  var __ecosolareDb: ReturnType<typeof buildDb> | undefined
}

/** Su Vercel ogni invocazione e' un processo separato: il pool va tenuto minimo. */
const inServerless = Boolean(process.env.VERCEL)

/**
 * Dimensione del pool.
 *
 * Sovrascrivibile con `DB_POOL_MAX` perche' il valore giusto dipende
 * dall'ambiente: il pooler di Supabase ha un limite di connessioni per progetto,
 * e certi database locali ne accettano una sola.
 */
function dimensionePool(): number {
  const configurato = Number.parseInt(process.env.DB_POOL_MAX ?? '', 10)
  if (Number.isFinite(configurato) && configurato > 0) return configurato
  // Su Vercel restiamo bassi per il pooler Supabase, ma 1 sola connessione
  // lasciava le navigazioni App Router in stallo quando layout e pagina
  // interrogavano il DB insieme. 4 copre il fan-out tipico senza esaurire
  // il transaction pooler.
  return inServerless ? 4 : 10
}

/**
 * Un avviso in testa al terminale quando si lavora sui dati veri.
 *
 * Non blocca niente — a volte e' proprio quello che si vuole fare, per esempio
 * rigenerare un PDF su un preventivo reale. Ma deve essere una cosa che si sa,
 * non una che si scopre dopo.
 */
function avvisaSeProduzione(): void {
  if (inServerless) return
  const ambiente = ambienteDatabase()
  if (ambiente === 'sviluppo') return

  console.warn(
    `\n  \u26a0  Questo processo scrive sul database di ${ambiente}: ${hostDatabase()}\n` +
      '     Se e\u0300 un database di prova, dichiaralo con AMBIENTE_DB=sviluppo.\n',
  )
}

function buildDb() {
  avvisaSeProduzione()
  const sql = postgres(env().DATABASE_URL, {
    // Con il pooler in transaction mode ogni connessione e' condivisa fra
    // richieste diverse: tenerne molte aperte per istanza esaurisce il pooler
    // senza dare alcun vantaggio.
    max: dimensionePool(),
    // Supavisor in transaction mode NON supporta i prepared statement: senza
    // questa riga le query falliscono in produzione ma funzionano in locale,
    // che e' il modo peggiore di scoprire un problema.
    prepare: false,
    idle_timeout: 20,
    // Meglio un errore chiaro che una soft-navigation Next che gira all'infinito
    // quando il pooler Supabase non risponde (progetto in pausa, rete, ecc.).
    connect_timeout: 10,
  })
  return drizzle(sql, { schema })
}

export function getDb(): ReturnType<typeof buildDb> {
  if (!globalThis.__ecosolareDb) {
    globalThis.__ecosolareDb = buildDb()
  }
  // HMR: se lo schema è cresciuto dopo il primo buildDb, la query API
  // resta incompleta sul singleton (es. siteStudies undefined → crash studio).
  if (
    process.env.NODE_ENV === 'development' &&
    !globalThis.__ecosolareDb.query.siteStudies
  ) {
    globalThis.__ecosolareDb = buildDb()
  }
  return globalThis.__ecosolareDb
}

export type Database = ReturnType<typeof getDb>

/** Il gestore di transazione passato a `db.transaction(...)`. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

/**
 * Chi esegue una query: il database o una transazione in corso.
 *
 * Serve a rendere impossibile un errore che abbiamo già commesso: chiamare
 * `getDb()` DENTRO una transazione. Quella query userebbe una connessione
 * diversa, quindi non vedrebbe le righe non ancora committate — e con un pool
 * da una sola connessione si blocca aspettando se stessa.
 */
export type Esecutore = Database | Transaction

export { schema }
