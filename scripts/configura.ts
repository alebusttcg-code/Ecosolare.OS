/**
 * Configurazione guidata dell'ambiente.
 *
 *   npm run configura
 *
 * Chiede il minimo indispensabile e genera `.env.local`. Tutto ciò che può
 * essere generato in autonomia — segreti, token — viene generato qui, così non
 * deve passare da nessuna parte.
 *
 * **I valori inseriti non escono da questo terminale.** `.env.local` non entra
 * nel repository, e questo script non li stampa a schermo.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const PERCORSO = '.env.local'

const rl = createInterface({ input: stdin, output: stdout })

const c = {
  oro: (s: string) => `[33m${s}[0m`,
  blu: (s: string) => `[36m${s}[0m`,
  verde: (s: string) => `[32m${s}[0m`,
  rosso: (s: string) => `[31m${s}[0m`,
  fioco: (s: string) => `[90m${s}[0m`,
}

async function chiedi(domanda: string, predefinito?: string): Promise<string> {
  const suffisso = predefinito ? c.fioco(` [${predefinito}]`) : ''
  const risposta = (await rl.question(`${domanda}${suffisso}\n> `)).trim()
  return risposta || predefinito || ''
}

/** Legge il file esistente, per non perdere ciò che è già stato configurato. */
function leggiEsistente(): Record<string, string> {
  if (!existsSync(PERCORSO)) return {}
  const valori: Record<string, string> = {}
  for (const riga of readFileSync(PERCORSO, 'utf8').split('\n')) {
    const m = riga.match(/^([A-Z_]+)=(.*)$/)
    if (m) valori[m[1]!] = m[2]!
  }
  return valori
}

/**
 * Controlla la stringa di connessione e spiega cosa c'è che non va.
 *
 * I due errori che costano più tempo sono la porta sbagliata e la connessione
 * diretta al posto del pooler: entrambi funzionano in locale e falliscono su
 * Vercel, quindi vanno intercettati adesso.
 */
function verificaConnessione(url: string): string[] {
  const problemi: string[] = []

  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    problemi.push('Non sembra una stringa di connessione PostgreSQL.')
    return problemi
  }
  // Va detto per primo: e' il caso in cui si crede di aver configurato Supabase
  // e invece si sta ancora usando il database di prova sul proprio computer.
  if (/localhost|127\.0\.0\.1/.test(url)) {
    problemi.push(
      'Questo è il database LOCALE di prova, non Supabase. Se stai configurando Supabase, incolla la stringa presa da Connect → Transaction pooler.',
    )
    return problemi
  }
  if (url.includes(':5432')) {
    problemi.push(
      'Stai usando la porta 5432 (connessione diretta). Serve il Transaction pooler, porta 6543.',
    )
  } else if (!url.includes(':6543')) {
    problemi.push('La porta non è 6543: controlla di aver copiato il Transaction pooler.')
  }
  if (!url.includes('pooler')) {
    problemi.push(
      'L’host non contiene «pooler»: hai copiato la connessione diretta invece del Transaction pooler.',
    )
  }
  if (url.includes('[YOUR-PASSWORD]') || url.includes('[PASSWORD]')) {
    problemi.push('Devi sostituire il segnaposto della password con quella vera.')
  }
  // La password è tutto ciò che sta fra i due punti e l'ULTIMA chiocciola:
  // fermarsi alla prima farebbe sfuggire proprio le password che contengono
  // una chiocciola, cioè il caso che questo controllo esiste per trovare.
  const dopoSchema = url.replace(/^postgres(?:ql)?:\/\//, '')
  const ultimaChiocciola = dopoSchema.lastIndexOf('@')
  const credenziali = ultimaChiocciola === -1 ? '' : dopoSchema.slice(0, ultimaChiocciola)
  const duePunti = credenziali.indexOf(':')
  const password = duePunti === -1 ? '' : credenziali.slice(duePunti + 1)

  if (/[@/?#[\]]/.test(password)) {
    problemi.push(
      'La password contiene caratteri (@ / ? # [ ]) che vanno codificati, altrimenti la connessione fallisce. Il modo più semplice è cambiarla su Supabase usando solo lettere e numeri.',
    )
  }
  if (url.includes('supabase') && !/eu-|europe|frankfurt/i.test(url)) {
    problemi.push(
      'ATTENZIONE: la regione non sembra europea. I dati devono restare in UE.',
    )
  }
  return problemi
}

async function main(): Promise<void> {
  const esistente = leggiEsistente()

  console.log(`
${c.oro('Configurazione di EcoSolare OS')}

Ti chiedo una cosa sola: il database. Segreti e token li genero io.
${c.fioco('Quello che scrivi resta in .env.local, che non entra mai nel repository.')}
`)

  /* 1. Database ------------------------------------------------------------ */
  console.log(c.blu('\n1. Database\n'))
  console.log(`Su Supabase: ${c.oro('Connect')} → ${c.oro('Transaction pooler')} → copia la stringa.`)
  console.log(c.fioco('Deve contenere «pooler» e finire con «:6543/postgres».\n'))

  // Il valore locale NON viene proposto come predefinito: premendo Invio si
  // finirebbe per confermarlo senza accorgersene, che e' esattamente il modo
  // in cui si crede di aver configurato Supabase e invece non e' cambiato nulla.
  const precedente = esistente.DATABASE_URL ?? ''
  const proposto = /localhost|127\.0\.0\.1/.test(precedente) ? undefined : precedente

  let database = ''
  for (;;) {
    database = await chiedi('Stringa di connessione', proposto)
    if (!database) {
      console.log(c.rosso('Serve per forza. Riprova.\n'))
      continue
    }
    const problemi = verificaConnessione(database)
    if (problemi.length === 0) break

    console.log('')
    for (const p of problemi) console.log(c.rosso(`  ✗ ${p}`))
    const prosegui = await chiedi('\nVuoi usarla lo stesso? (s/n)', 'n')
    if (prosegui.toLowerCase().startsWith('s')) break
    console.log('')
  }

  /* 2. Segreti generati ---------------------------------------------------- */
  const intakeToken = esistente.INTAKE_TOKEN || randomBytes(32).toString('hex')
  const manutenzione = esistente.MAINTENANCE_TOKEN || randomBytes(32).toString('hex')

  const contenuto = `# Generato da: npm run configura
# Non versionare mai questo file.

DATABASE_URL=${database}

# Segreto condiviso con i form del sito per l'endpoint /api/intake
INTAKE_TOKEN=${intakeToken}

# Protegge /api/manutenzione/* (cron e pinger esterno)
MAINTENANCE_TOKEN=${manutenzione}
`

  writeFileSync(PERCORSO, contenuto, { mode: 0o600 })

  console.log(`
${c.verde('✓')} ${PERCORSO} scritto.

${c.blu('Adesso:')}

  npm run db:migrate      ${c.fioco('crea le tabelle')}
  npm run db:seed         ${c.fioco('stati, fonti, soglie, checklist')}
  npm run amministratore  ${c.fioco('crea il tuo utente e stampa la password')}
  npm run dev
${c.fioco('\nDopo le migrazioni, su Supabase verifica che ogni tabella risulti «RLS enabled».')}
`)

  rl.close()
}

main().catch((errore: unknown) => {
  console.error(c.rosso('\nConfigurazione interrotta.'), errore)
  rl.close()
  process.exit(1)
})
