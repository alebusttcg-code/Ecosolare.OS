/**
 * Da che parte sta il database a cui siamo collegati.
 *
 * L'intenzione originale era giusta — «in locale si lavora su PostgreSQL vero,
 * non su un surrogato» — ma «lo stesso tipo di database» è diventato «lo stesso
 * database»: per settimane ogni prova in locale ha scritto sui dati dei clienti.
 * Nessuno se n'era accorto perché non c'è niente che lo dica e niente che lo
 * impedisca.
 *
 * Questo modulo fa le due cose. Dice a chi guarda il terminale dov'è collegato,
 * e blocca le operazioni distruttive quando dall'altra parte c'è la produzione.
 *
 * ## Come si dichiara l'ambiente
 *
 * Il modo esplicito è `AMBIENTE_DB=sviluppo` (o `produzione`) nel file di
 * ambiente. È il solo che non può sbagliare, ed è quello da usare.
 *
 * Quando manca si guarda l'host, perché una protezione che si attiva solo se
 * qualcuno si è ricordato di configurarla non protegge nessuno.
 *
 * ## Chi non riconosce, tratta come produzione
 *
 * Un host sconosciuto vale produzione. Il costo dell'errore non è simmetrico:
 * bloccare un `npm run demo` su un database di prova costa dieci secondi e una
 * variabile d'ambiente, mentre lasciarlo passare su quello vero costa i dati
 * dei clienti. Fra i due si sbaglia sempre dalla parte che si ripara.
 */

export type AmbienteDatabase = 'sviluppo' | 'produzione' | 'sconosciuto'

/** Host che sono senza dubbio la macchina di chi sviluppa. */
const HOST_LOCALI = ['localhost', '127.0.0.1', '::1', '0.0.0.0']

/** Suffissi dei servizi gestiti: se il database è lì, non è la nostra macchina. */
const HOST_GESTITI = [
  '.supabase.com',
  '.supabase.co',
  '.neon.tech',
  '.rds.amazonaws.com',
  '.render.com',
  '.railway.app',
  '.timescaledb.io',
  '.cockroachlabs.cloud',
]

function hostDi(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * L'ambiente dichiarato, se c'è. Riconosce solo i due valori attesi: uno
 * scritto male non deve diventare per sbaglio un lasciapassare.
 */
function ambienteDichiarato(
  valore: string | undefined,
): 'sviluppo' | 'produzione' | null {
  const pulito = valore?.trim().toLowerCase()
  if (pulito === 'sviluppo' || pulito === 'produzione') return pulito
  return null
}

export function classificaDatabase(
  url: string | undefined,
  dichiarato?: string | undefined,
): AmbienteDatabase {
  const esplicito = ambienteDichiarato(dichiarato)
  if (esplicito) return esplicito

  const host = url ? hostDi(url) : null
  if (!host) return 'sconosciuto'

  if (HOST_LOCALI.includes(host) || host.endsWith('.local')) return 'sviluppo'
  if (HOST_GESTITI.some((suffisso) => host.endsWith(suffisso))) return 'produzione'

  return 'sconosciuto'
}

/** L'ambiente del processo corrente. */
export function ambienteDatabase(): AmbienteDatabase {
  return classificaDatabase(process.env.DATABASE_URL, process.env.AMBIENTE_DB)
}

/**
 * L'host a cui siamo collegati, per i messaggi. Mai la stringa intera: contiene
 * la password, e i messaggi finiscono nei log e negli screenshot.
 */
export function hostDatabase(): string {
  return hostDi(process.env.DATABASE_URL ?? '') ?? 'host sconosciuto'
}

/** La via d'uscita, quando l'operazione sulla produzione è voluta davvero. */
const CHIAVE_FORZATURA = 'CONSENTI_SU_PRODUZIONE'

export class DatabaseDiProduzioneError extends Error {
  constructor(operazione: string, ambiente: AmbienteDatabase) {
    const dove =
      ambiente === 'produzione'
        ? `sul database di produzione (${hostDatabase()})`
        : `su un database non riconosciuto (${hostDatabase()}), che vale come produzione`
    super(
      `«${operazione}» non si esegue ${dove}.\n\n` +
        'Se questo è davvero un database di sviluppo, dichiaralo con ' +
        'AMBIENTE_DB=sviluppo nel file di ambiente.\n' +
        'Se invece vuoi davvero eseguirlo in produzione, ripeti il comando con ' +
        `${CHIAVE_FORZATURA}=1 davanti.`,
    )
    this.name = 'DatabaseDiProduzioneError'
  }
}

/**
 * Si ferma se il database non è di sviluppo.
 *
 * Da chiamare all'inizio di ogni script che cancella, semina o riscrive in
 * blocco. La forzatura esiste perché il primo popolamento di un ambiente nuovo
 * è un'operazione legittima: deve essere impossibile per sbaglio, non
 * impossibile.
 */
export function esigiDatabaseDiSviluppo(operazione: string): void {
  const ambiente = ambienteDatabase()
  if (ambiente === 'sviluppo') return

  if (process.env[CHIAVE_FORZATURA] === '1') {
    console.warn(
      `[database] «${operazione}» forzata su ${hostDatabase()} (${ambiente}).`,
    )
    return
  }

  throw new DatabaseDiProduzioneError(operazione, ambiente)
}

/**
 * La stessa protezione, per gli script da riga di comando.
 *
 * Stampa il motivo e si ferma, senza traccia dello stack: chi legge non deve
 * cercare la frase che gli serve dentro venti righe di percorsi di file.
 */
export function proteggiScript(operazione: string): void {
  try {
    esigiDatabaseDiSviluppo(operazione)
  } catch (errore) {
    if (errore instanceof DatabaseDiProduzioneError) {
      console.error(`\n${errore.message}\n`)
      process.exit(1)
    }
    throw errore
  }
}
