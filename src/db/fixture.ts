import { eq } from 'drizzle-orm'
import {
  contacts,
  documentTemplates,
  opportunities,
  pipelineStages,
  products,
  projectStages,
  quoteLines,
  quoteVersions,
  quotes,
  taskTemplates,
  users,
} from './schema'
import { DOCUMENTI_FV, STATI_COMMESSA, STATI_COMMESSA_SPECIALI, TASK_COMMESSA } from './templates/commessa'
import type { TestDatabase } from './testing'

/**
 * Dati minimi per provare le server action contro un database vero.
 *
 * Perché non riusare `src/db/seed.ts`: quello è uno script pensato per un
 * ambiente reale — stampa a video, legge variabili d'ambiente e inserisce
 * l'intero catalogo. Qui serve il meno possibile, e serve saperlo con
 * precisione: un test che dipende da centoventi righe di seed fallisce per
 * ragioni che non hanno niente a che vedere con ciò che sta provando.
 *
 * Sta in `src/db/` accanto a `testing.ts` perché è materiale di prova e non va
 * importato dal codice applicativo (ADR-010).
 */

/** Stati e modelli richiesti dai vincoli di chiave esterna. */
export async function preparaConfigurazione(db: TestDatabase): Promise<void> {
  await db
    .insert(pipelineStages)
    .values([
      { code: 'nuovo', label: 'Nuovo', sortOrder: 10 },
      { code: 'negoziazione', label: 'Negoziazione', sortOrder: 100 },
      { code: 'vinto', label: 'Contratto firmato', sortOrder: 200, isOpen: false, isWon: true },
      { code: 'perso', label: 'Perso', sortOrder: 210, isOpen: false, isLost: true },
    ])
    .onConflictDoNothing()

  await db
    .insert(projectStages)
    .values([
      ...STATI_COMMESSA.map((s) => ({
        code: s.code,
        label: s.label,
        sortOrder: s.sortOrder,
      })),
      ...STATI_COMMESSA_SPECIALI.map((s) => ({
        code: s.code,
        label: s.label,
        sortOrder: s.sortOrder,
      })),
    ])
    .onConflictDoNothing()

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

  await db
    .insert(documentTemplates)
    .values(
      DOCUMENTI_FV.map((d) => ({
        code: d.code,
        label: d.label,
        mandatory: d.mandatory,
        providedByClient: d.providedByClient,
        businessLine: 'fotovoltaico' as const,
      })),
    )
    .onConflictDoNothing()
}

export interface ScenarioPreventivo {
  readonly userId: string
  readonly contactId: string
  readonly opportunityId: string
  readonly quoteId: string
  readonly versionId: string
}

/**
 * Un preventivo pronto per la firma: utente, cliente, opportunità, preventivo
 * con una riga di materiale e una di manodopera.
 *
 * `stato` è parametrico perché metà delle prove interessanti riguarda proprio
 * il fatto che una versione in bozza non si possa firmare.
 */
export async function creaPreventivoFirmabile(
  db: TestDatabase,
  opzioni: { stato?: 'bozza' | 'inviato' | 'accettato'; suffisso?: string } = {},
): Promise<ScenarioPreventivo> {
  const suffisso = opzioni.suffisso ?? '1'

  const [utente] = await db
    .insert(users)
    .values({
      email: `responsabile-${suffisso}@prova.it`,
      name: 'Responsabile Prova',
      role: 'amministratore',
      canViewCosts: true,
      mustChangePassword: false,
    })
    .returning({ id: users.id })

  const [cliente] = await db
    .insert(contacts)
    .values({ firstName: 'Mario', lastName: `Rossi ${suffisso}` })
    .returning({ id: contacts.id })

  const [opportunita] = await db
    .insert(opportunities)
    .values({
      code: `OPP-2026-000${suffisso}`,
      contactId: cliente!.id,
      businessLine: 'fotovoltaico',
      title: 'Impianto 6 kW',
      stage: 'negoziazione',
      ownerId: utente!.id,
    })
    .returning({ id: opportunities.id })

  const [preventivo] = await db
    .insert(quotes)
    .values({
      code: `PRE-2026-000${suffisso}`,
      opportunityId: opportunita!.id,
      title: 'Impianto fotovoltaico 6 kW',
      createdBy: utente!.id,
    })
    .returning({ id: quotes.id })

  const [versione] = await db
    .insert(quoteVersions)
    .values({
      quoteId: preventivo!.id,
      versionNo: 1,
      status: opzioni.stato ?? 'inviato',
      // Valori coerenti: ricavo 10.000, costo 6.000, margine 4.000.
      revenueNet: '10000.00',
      costTotal: '6000.00',
      marginAmount: '4000.00',
      createdBy: utente!.id,
    })
    .returning({ id: quoteVersions.id })

  await db
    .update(quotes)
    .set({ currentVersionId: versione!.id })
    .where(eq(quotes.id, preventivo!.id))

  const [modulo] = await db
    .insert(products)
    .values({
      code: `MOD-${suffisso}`,
      name: 'Modulo fotovoltaico 450 W',
      type: 'materiale',
      unit: 'pz',
      defaultCostPrice: '92.0000',
      defaultSalePrice: '148.0000',
    })
    .returning({ id: products.id })

  const [manodopera] = await db
    .insert(products)
    .values({
      code: `MAN-${suffisso}`,
      name: 'Manodopera elettrica',
      type: 'manodopera',
      unit: 'h',
      defaultCostPrice: '26.0000',
      defaultSalePrice: '42.0000',
    })
    .returning({ id: products.id })

  await db.insert(quoteLines).values([
    {
      quoteVersionId: versione!.id,
      sortOrder: 0,
      productId: modulo!.id,
      description: 'Modulo fotovoltaico 450 W',
      unit: 'pz',
      quantity: '14.000',
      unitCost: '92.0000',
      unitPrice: '148.0000',
      vatRate: '10.00',
      lineNet: '2072.00',
      lineCost: '1288.00',
    },
    {
      quoteVersionId: versione!.id,
      sortOrder: 1,
      productId: manodopera!.id,
      description: 'Manodopera elettrica',
      unit: 'h',
      quantity: '20.000',
      unitCost: '26.0000',
      unitPrice: '42.0000',
      vatRate: '22.00',
      lineNet: '840.00',
      lineCost: '520.00',
    },
  ])

  return {
    userId: utente!.id,
    contactId: cliente!.id,
    opportunityId: opportunita!.id,
    quoteId: preventivo!.id,
    versionId: versione!.id,
  }
}
