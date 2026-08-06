/**
 * Diagnosi della connessione al database.
 *
 *   npm run db:verifica
 *
 * Si collega, e se qualcosa non va traduce l'errore di PostgreSQL in una frase
 * che dice cosa fare. Gli errori grezzi del driver sono precisi ma non
 * suggeriscono nulla: «tenant or user not found» non lascia intuire che il
 * problema è la regione nell'indirizzo.
 *
 * Se invece funziona, controlla le tre cose che devono essere vere prima di
 * andare avanti: tabelle create, RLS attiva ovunque, dati di configurazione
 * caricati.
 */
import postgres from 'postgres'

const c = {
  oro: (s: string) => `[33m${s}[0m`,
  verde: (s: string) => `[32m${s}[0m`,
  rosso: (s: string) => `[31m${s}[0m`,
  fioco: (s: string) => `[90m${s}[0m`,
}

/** Traduce gli errori che capitano davvero, con il rimedio. */
function spiega(errore: unknown): string {
  const messaggio = errore instanceof Error ? errore.message : String(errore)
  const causa =
    errore instanceof Error && 'cause' in errore
      ? String((errore as { cause?: unknown }).cause ?? '')
      : ''
  const tutto = `${messaggio} ${causa}`

  if (/tenant or user not found/i.test(tutto)) {
    return `L'indirizzo non corrisponde alla regione del progetto.

  Non ricostruire la stringa a mano: su Supabase premi ${c.oro('Connect')},
  scheda ${c.oro('Transaction pooler')}, e usa il pulsante di copia.
  Il prefisso (aws-0, aws-1…) e la regione cambiano da progetto a progetto.`
  }
  if (/password authentication failed/i.test(tutto)) {
    return `Password rifiutata.

  O è sbagliata, o contiene caratteri (@ / ? # [ ]) che nell'indirizzo vanno
  codificati. Il rimedio semplice: Project Settings → Database →
  Reset database password, generandone una di sole lettere e numeri.`
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(tutto)) {
    return `L'indirizzo non esiste o non è raggiungibile: controlla di averlo copiato per intero.`
  }
  if (/ETIMEDOUT|ECONNREFUSED/i.test(tutto)) {
    return `Nessuna risposta. Se stai usando la porta 5432, serve invece il
  Transaction pooler sulla porta 6543.`
  }
  if (/prepared statement/i.test(tutto)) {
    return `Stai usando la connessione diretta invece del pooler in modalità transazione.`
  }
  return messaggio
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(c.rosso('DATABASE_URL non impostata. Lancia prima: npm run configura'))
    process.exit(1)
  }

  const indirizzo = url.replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]*(@)/, '$1••••••$2')
  console.log(`\nProvo a collegarmi a:\n  ${c.fioco(indirizzo)}\n`)

  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 })

  try {
    const [versione] = await sql<{ v: string }[]>`select version() as v`
    console.log(
      `${c.verde('✓')} Connessione riuscita — ${versione!.v.split(',')[0]}\n`,
    )

    /* Tabelle e RLS -------------------------------------------------------- */
    const tabelle = await sql<{ nome: string; rls: boolean }[]>`
      select c.relname as nome, c.relrowsecurity as rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `

    if (tabelle.length === 0) {
      console.log(`${c.oro('!')} Nessuna tabella: le migrazioni non sono state applicate.`)
      console.log(c.fioco('  Lancia: npm run db:migrate\n'))
      await sql.end()
      return
    }

    const scoperte = tabelle.filter((t) => !t.rls)
    console.log(`${c.verde('✓')} ${tabelle.length} tabelle presenti`)

    if (scoperte.length === 0) {
      console.log(`${c.verde('✓')} RLS attiva su tutte`)
    } else {
      console.log(`${c.rosso('✗')} RLS NON attiva su ${scoperte.length} tabelle:`)
      for (const t of scoperte) console.log(c.rosso(`    ${t.nome}`))
      console.log(
        c.fioco(
          '\n  Senza RLS quelle tabelle sono raggiungibili dall’API pubblica di\n' +
            '  Supabase, scavalcando i permessi dell’applicazione.\n' +
            '  Rilancia: npm run db:migrate\n',
        ),
      )
    }

    /* Dati di configurazione ----------------------------------------------- */
    const conta = async (tabella: string): Promise<number> => {
      if (!tabelle.some((t) => t.nome === tabella)) return -1
      const [r] = await sql.unsafe<{ n: string }[]>(`select count(*)::text as n from "${tabella}"`)
      return Number(r!.n)
    }

    const attesi: [string, string][] = [
      ['pipeline_stages', 'stati della pipeline'],
      ['lead_sources', 'fonti dei lead'],
      ['app_settings', 'configurazioni'],
      ['survey_templates', 'questionari'],
      ['project_stages', 'stati delle commesse'],
      ['document_templates', 'checklist documentale'],
    ]

    console.log('')
    let vuote = 0
    for (const [tabella, etichetta] of attesi) {
      const n = await conta(tabella)
      if (n <= 0) vuote += 1
      const segno = n > 0 ? c.verde('✓') : c.oro('!')
      console.log(`${segno} ${etichetta}: ${n < 0 ? 'tabella assente' : n}`)
    }

    const [utenti] = await sql<{ n: string }[]>`select count(*)::text as n from users`
    console.log(`${c.fioco('·')} utenti abilitati: ${utenti!.n}`)

    console.log('')
    if (vuote > 0) {
      console.log(`${c.oro('Manca la configurazione iniziale.')} Lancia: npm run db:seed\n`)
    } else if (scoperte.length === 0) {
      console.log(`${c.verde('Tutto a posto.')} Puoi lanciare: npm run dev\n`)
    }
  } catch (errore) {
    console.error(`${c.rosso('✗ Connessione fallita.')}\n`)
    console.error(`  ${spiega(errore)}\n`)
    await sql.end({ timeout: 1 }).catch(() => {})
    process.exit(1)
  }

  await sql.end()
}

main().catch((errore: unknown) => {
  console.error(c.rosso('Errore imprevisto:'), errore)
  process.exit(1)
})
