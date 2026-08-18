import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  appSettings,
  documentTemplates,
  leadSources,
  pipelineStages,
  products,
  projectStages,
  surveyTemplates,
  taskTemplates,
} from './schema'
import { CATALOGO_FV } from './templates/catalogo-fv'
import {
  DOCUMENTI_FV,
  STATI_COMMESSA,
  STATI_COMMESSA_SPECIALI,
  TASK_COMMESSA,
} from './templates/commessa'
import { PREQUALIFICA_FV } from './templates/prequalifica-fv'
import { SOPRALLUOGO_FV } from './templates/sopralluogo-fv'

/**
 * Dati di configurazione iniziali.
 *
 * Sono VALORI DI PARTENZA, non verita': stati della pipeline, fonti e soglie
 * usciranno dall'audit operativo e si modificano da interfaccia, senza rilascio.
 * Questo seed serve a rendere il sistema utilizzabile prima che l'audit finisca.
 *
 * Idempotente: rieseguirlo non duplica e non sovrascrive cio' che e' gia' stato
 * personalizzato.
 */

/** Stati della pipeline commerciale (§5.4 del brief). */
const STATI = [
  { code: 'nuovo', label: 'Nuovo', sortOrder: 10, defaultProbability: 5 },
  { code: 'da_contattare', label: 'Da contattare', sortOrder: 20, defaultProbability: 5 },
  { code: 'contattato', label: 'Contattato', sortOrder: 30, defaultProbability: 10 },
  {
    code: 'prequalifica_incompleta',
    label: 'Prequalifica incompleta',
    sortOrder: 40,
    defaultProbability: 10,
  },
  { code: 'qualificato', label: 'Qualificato', sortOrder: 50, defaultProbability: 20 },
  {
    code: 'sopralluogo_da_fissare',
    label: 'Sopralluogo da fissare',
    sortOrder: 60,
    defaultProbability: 25,
  },
  {
    code: 'sopralluogo_fissato',
    label: 'Sopralluogo fissato',
    sortOrder: 70,
    defaultProbability: 35,
  },
  {
    code: 'sopralluogo_completato',
    label: 'Sopralluogo completato',
    sortOrder: 80,
    defaultProbability: 45,
  },
  {
    code: 'preventivo_da_preparare',
    label: 'Preventivo da preparare',
    sortOrder: 90,
    defaultProbability: 50,
  },
  {
    code: 'preventivo_inviato',
    label: 'Preventivo inviato',
    sortOrder: 100,
    defaultProbability: 60,
  },
  { code: 'negoziazione', label: 'Negoziazione', sortOrder: 110, defaultProbability: 75 },
  { code: 'firma_attesa', label: 'In attesa di firma', sortOrder: 120, defaultProbability: 90 },
  // "Sospeso" resta uno stato APERTO di proposito: sospendere non significa
  // dimenticare, e una data di ripresa va comunque indicata.
  { code: 'sospeso', label: 'Sospeso', sortOrder: 130, defaultProbability: 10 },
  { code: 'da_riattivare', label: 'Da riattivare', sortOrder: 140, defaultProbability: 10 },
] as const

const STATI_CHIUSI = [
  {
    code: 'vinto',
    // Non "Vinto": in EcoSolare significa che il contratto è stato firmato.
    label: 'Contratto firmato',
    sortOrder: 200,
    defaultProbability: 100,
    isOpen: false,
    isWon: true,
    isLost: false,
  },
  {
    code: 'perso',
    label: 'Non concluso',
    sortOrder: 210,
    defaultProbability: 0,
    isOpen: false,
    isWon: false,
    isLost: true,
  },
] as const

const FONTI = [
  { code: 'sito', label: 'Sito web', sortOrder: 10 },
  { code: 'landing', label: 'Landing page', sortOrder: 20 },
  { code: 'campagna', label: 'Campagna pubblicitaria', sortOrder: 30 },
  { code: 'telefono', label: 'Telefonata diretta', sortOrder: 40 },
  { code: 'email', label: 'Email', sortOrder: 50 },
  { code: 'whatsapp', label: 'WhatsApp', sortOrder: 60 },
  { code: 'passaparola', label: 'Passaparola', sortOrder: 70 },
  { code: 'cliente_esistente', label: 'Cliente esistente', sortOrder: 80 },
  { code: 'partner', label: 'Partner o segnalatore', sortOrder: 90 },
  { code: 'altro', label: 'Altro', sortOrder: 100 },
] as const

const CONFIGURAZIONI = [
  {
    key: 'sla.prima_risposta_minuti',
    value: 5,
    description:
      'Target di presa in carico di un nuovo lead, in minuti, durante gli orari di servizio.',
  },
  {
    key: 'pipeline.giorni_default_prossima_azione',
    value: 2,
    description:
      'Scadenza proposta per la prossima azione quando non viene indicata esplicitamente.',
  },
  {
    key: 'pipeline.giorni_alert_opportunita_ferma',
    value: 7,
    description:
      'Dopo quanti giorni senza avanzamento un\'opportunità viene segnalata alla direzione.',
  },
  {
    key: 'dedup.soglia_segnalazione',
    value: 80,
    description:
      'Punteggio oltre il quale un contatto viene segnalato come possibile duplicato. Nessuna fusione avviene mai in automatico.',
  },
  {
    key: 'preventivi.soglia_margine_pct',
    value: 20,
    description:
      'Percentuale minima di margine. Sotto questa soglia il preventivo non viene bloccato, ma richiede l\'approvazione della direzione.',
  },
  {
    key: 'preventivi.giorni_validita',
    value: 30,
    description: 'Validità proposta per un nuovo preventivo, in giorni.',
  },
  {
    key: 'fattura.aliquota_iva_default_pct',
    value: { valore: 10, validoDal: '2024-01-01', nota: 'IVA agevolata fotovoltaico' },
    description:
      'Aliquota IVA di default applicata alle fatture (%). 10% agevolata sul fotovoltaico.',
  },
  {
    key: 'fattura.sezionale_default',
    value: '',
    description:
      'Sezionale del registro fatture. Vuoto = registro unico; utile solo con registri IVA separati.',
  },
  {
    key: 'fattura.azienda_partita_iva',
    value: '',
    description: 'Partita IVA dell’azienda, stampata sul PDF di cortesia della fattura.',
  },
  {
    key: 'energia.tariffa_import_eur_kwh',
    value: { valore: 0.3, validoDal: '2024-01-01', nota: 'Ipotesi commerciale dossier' },
    description:
      'Tariffa import energia di default (€/kWh) se lo studio non ne indica una propria.',
  },
  {
    key: 'energia.tariffa_export_eur_kwh',
    value: { valore: 0.1, validoDal: '2024-01-01', nota: 'Ipotesi RID dossier' },
    description: 'Tariffa export / RID di default (€/kWh).',
  },
  {
    key: 'energia.prezzo_gas_eur_smc',
    value: { valore: 1.1, validoDal: '2026-01-01', nota: 'Prezzo medio gas domestico' },
    description:
      'Prezzo del gas (€/Smc) usato quando il preventivo con pompa di calore non ne porta uno proprio.',
  },
  {
    key: 'energia.frazione_autoconsumo_default',
    value: { valore: 0.4, validoDal: '2024-01-01' },
    description:
      'Quota produzione→autoconsumo di default (0–1) se assente nello studio cliente.',
  },
  {
    key: 'incentivi.detrazione_fv_pct',
    value: { valore: 50, validoDal: '2024-01-01', nota: 'Detrazione IRPEF FV residenziale' },
    description: 'Percentuale detrazione IRPEF sul prezzo IVA inclusa (A18).',
  },
  {
    key: 'incentivi.detrazione_fv_anni',
    value: { valore: 10, validoDal: '2024-01-01' },
    description: 'Anni di ripartizione della detrazione nel cashflow.',
  },
  {
    key: 'simulazione.orizzonte_anni',
    value: 25,
    description: 'Orizzonte anni per cashflow / NPV dell’allegato simulazione.',
  },
  {
    key: 'simulazione.inflazione_energia_pct',
    value: 3,
    description: 'Inflazione annua del prezzo energia usata in simulazione (%).',
  },
  {
    key: 'simulazione.tasso_sconto_pct',
    value: 5,
    description: 'Tasso di sconto per il NPV (%).',
  },
  {
    key: 'simulazione.degradazione_pct_anno',
    value: 0.5,
    description: 'Degradazione annua di produzione dei moduli (%).',
  },
  {
    key: 'orari.servizio',
    value: { dal: 'lun', al: 'ven', dalle: '08:30', alle: '18:00' },
    description:
      'Orario di servizio, usato per calcolare lo speed-to-lead senza contare le ore di chiusura.',
  },
] as const

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL non impostata. Vedere .env.example.')
    process.exit(1)
  }

  const sql = postgres(url, { max: 1 })
  const db = drizzle(sql)

  try {
    const stati = [
      ...STATI.map((s) => ({ ...s, isOpen: true, isWon: false, isLost: false })),
      ...STATI_CHIUSI,
    ]

    await db.insert(pipelineStages).values(stati).onConflictDoNothing()
    // Allinea etichette già presenti: onConflictDoNothing non aggiorna le righe.
    for (const chiuso of STATI_CHIUSI) {
      await db
        .update(pipelineStages)
        .set({ label: chiuso.label })
        .where(eq(pipelineStages.code, chiuso.code))
    }
    console.log(`Stati pipeline: ${stati.length} verificati.`)

    await db.insert(leadSources).values([...FONTI]).onConflictDoNothing()
    console.log(`Fonti lead: ${FONTI.length} verificate.`)

    await db
      .insert(appSettings)
      .values(
        CONFIGURAZIONI.map((c) => ({
          key: c.key,
          value: c.value,
          description: c.description,
        })),
      )
      .onConflictDoNothing()
    console.log(`Configurazioni: ${CONFIGURAZIONI.length} verificate.`)

    // I template sono versionati: il seed non sovrascrive mai una versione
    // esistente, cosi' i questionari gia' compilati restano leggibili.
    await db
      .insert(surveyTemplates)
      .values([
        {
          code: PREQUALIFICA_FV.code,
          version: PREQUALIFICA_FV.version,
          kind: 'prequalifica' as const,
          name: PREQUALIFICA_FV.name,
          businessLine: 'fotovoltaico' as const,
          definition: PREQUALIFICA_FV,
        },
        {
          code: SOPRALLUOGO_FV.code,
          version: SOPRALLUOGO_FV.version,
          kind: 'sopralluogo' as const,
          name: SOPRALLUOGO_FV.name,
          businessLine: 'fotovoltaico' as const,
          definition: SOPRALLUOGO_FV,
        },
      ])
      .onConflictDoNothing()

    await db
      .update(surveyTemplates)
      .set({ isActive: false })
      .where(
        and(
          eq(surveyTemplates.code, PREQUALIFICA_FV.code),
          eq(surveyTemplates.version, 1),
        ),
      )
    console.log('Questionari: 2 verificati (prequalifica e sopralluogo fotovoltaico).')

    const statiCommessa = [
      ...STATI_COMMESSA.map((s) => ({
        code: s.code,
        label: s.label,
        sortOrder: s.sortOrder,
        requiresReadiness: 'requiresReadiness' in s ? s.requiresReadiness : false,
      })),
      ...STATI_COMMESSA_SPECIALI.map((s) => ({
        code: s.code,
        label: s.label,
        sortOrder: s.sortOrder,
        isClosed: 'isClosed' in s ? s.isClosed : false,
        isSuspended: 'isSuspended' in s ? s.isSuspended : false,
      })),
    ]
    await db.insert(projectStages).values(statiCommessa).onConflictDoNothing()
    console.log(`Stati commessa: ${statiCommessa.length} verificati.`)

    await db
      .insert(taskTemplates)
      .values(
        TASK_COMMESSA.map((t) => ({
          code: t.code,
          label: t.label,
          defaultRole: t.defaultRole,
          dueDaysFromStart: t.dueDaysFromStart,
          sortOrder: t.sortOrder,
          businessLine: 'fotovoltaico' as const,
        })),
      )
      .onConflictDoNothing()
    console.log(`Modelli di task: ${TASK_COMMESSA.length} verificati.`)

    await db
      .insert(documentTemplates)
      .values(
        DOCUMENTI_FV.map((d) => ({
          code: d.code,
          label: d.label,
          mandatory: d.mandatory,
          providedByClient: d.providedByClient,
          defaultRole: 'defaultRole' in d ? d.defaultRole : null,
          dueDaysFromStart: 'dueDaysFromStart' in d ? d.dueDaysFromStart : null,
          sortOrder: d.sortOrder,
          businessLine: 'fotovoltaico' as const,
        })),
      )
      .onConflictDoNothing()
    console.log(`Checklist documentale: ${DOCUMENTI_FV.length} voci verificate.`)

    await db
      .insert(products)
      .values(
        CATALOGO_FV.map((p) => ({
          code: p.code,
          name: p.name,
          type: p.type,
          unit: p.unit,
          defaultCostPrice: p.defaultCostPrice,
          defaultSalePrice: p.defaultSalePrice,
          vatRate: p.vatRate,
          businessLine: 'fotovoltaico' as const,
        })),
      )
      .onConflictDoNothing()
    console.log(`Catalogo prodotti: ${CATALOGO_FV.length} voci verificate.`)

    console.log('Seed completato.')
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error('Seed fallito:', error)
  process.exit(1)
})
