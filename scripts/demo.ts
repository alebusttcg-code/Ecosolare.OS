/**
 * Dati dimostrativi per l'ambiente locale.
 *
 * Serve a vedere il sistema con dentro qualcosa di realistico, senza compilare
 * trenta schermate a mano. NON va mai eseguito su un database reale: cancella e
 * ricrea i propri record.
 *
 *   npm run demo
 */
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  activities,
  contacts,
  leadSources,
  opportunities,
  opportunityStatusHistory,
  products,
  quoteLines,
  quoteVersions,
  quotes,
  sessions,
  sites,
  surveyTemplates,
  surveys,
  users,
} from '../src/db/schema'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL non impostata.')
  process.exit(1)
}
if (process.env.NODE_ENV === 'production') {
  console.error('Rifiuto di eseguire dati dimostrativi in produzione.')
  process.exit(1)
}

const client = postgres(url, { max: 1, prepare: false })
const db = drizzle(client)

const giorni = (n: number) => new Date(Date.now() + n * 86_400_000)

async function main(): Promise<void> {
  console.log('Creazione dati dimostrativi…')

  await db.execute(sql`
    truncate table
      quote_lines, quote_versions, quotes, approvals, surveys,
      activities, opportunity_status_history, opportunities,
      sites, contacts, companies, products, sessions, accounts, audit_logs
    restart identity cascade
  `)

  /* Utenti ------------------------------------------------------------------ */
  const [admin] = await db
    .insert(users)
    .values({
      email: 'federico@ecosolare.it',
      name: 'Federico Leporati',
      role: 'amministratore',
      canViewCosts: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: 'amministratore', canViewCosts: true, isActive: true },
    })
    .returning()

  const [commerciale]: Array<typeof users.$inferSelect> = await db
    .insert(users)
    .values({
      email: 'giulia@ecosolare.it',
      name: 'Giulia Ferrari',
      role: 'commerciale',
      canViewCosts: false,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: 'commerciale', canViewCosts: false, isActive: true },
    })
    .returning()

  const [tecnico] = await db
    .insert(users)
    .values({
      email: 'marco@ecosolare.it',
      name: 'Marco Bianchi',
      role: 'cantiere',
      canViewCosts: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: 'cantiere', isActive: true },
    })
    .returning()

  /* Sessione pronta per il browser ------------------------------------------ */
  // Due sessioni pronte: servono a confrontare cosa vede l'amministratore e
  // cosa vede il commerciale senza la capacita' sui costi.
  const token = 'demo-locale-sessione-amministratore'
  const tokenCommerciale = 'demo-locale-sessione-commerciale'
  await db.insert(sessions).values([
    { sessionToken: token, userId: admin!.id, expires: giorni(7) },
    { sessionToken: tokenCommerciale, userId: commerciale!.id, expires: giorni(7) },
  ])

  /* Catalogo ---------------------------------------------------------------- */
  await db.insert(products).values([
    { code: 'MOD-450', name: 'Modulo fotovoltaico 450 W', type: 'materiale', unit: 'pz', defaultCostPrice: '92.0000', defaultSalePrice: '148.0000', vatRate: '10.00', businessLine: 'fotovoltaico' },
    { code: 'INV-6K', name: 'Inverter ibrido 6 kW', type: 'materiale', unit: 'pz', defaultCostPrice: '1050.0000', defaultSalePrice: '1690.0000', vatRate: '10.00', businessLine: 'fotovoltaico' },
    { code: 'BAT-10', name: 'Batteria di accumulo 10 kWh', type: 'materiale', unit: 'pz', defaultCostPrice: '2400.0000', defaultSalePrice: '3450.0000', vatRate: '10.00', businessLine: 'fotovoltaico' },
    { code: 'STR-FAL', name: 'Struttura di fissaggio per tetto a falda', type: 'materiale', unit: 'pz', defaultCostPrice: '28.0000', defaultSalePrice: '46.0000', vatRate: '10.00' },
    { code: 'MAN-EL', name: 'Manodopera elettrica specializzata', type: 'manodopera', unit: 'h', defaultCostPrice: '26.0000', defaultSalePrice: '42.0000', vatRate: '22.00' },
    { code: 'PRAT-GSE', name: 'Pratiche di connessione e GSE', type: 'servizio', unit: 'a corpo', defaultCostPrice: '180.0000', defaultSalePrice: '450.0000', vatRate: '22.00' },
  ])

  const catalogo = await db.select().from(products)
  const perCodice = (code: string) => catalogo.find((p) => p.code === code)!

  const fonti = await db.select().from(leadSources)
  const fonte = (code: string) => fonti.find((f) => f.code === code)?.id ?? null

  /* Clienti ----------------------------------------------------------------- */
  const anagrafiche = await db
    .insert(contacts)
    .values([
      { firstName: 'Marco', lastName: 'Rossi', email: 'marco.rossi@example.it', emailNormalized: 'marco.rossi@example.it', phone: '333 1234567', phoneE164: '+393331234567', sourceId: fonte('sito'), marketingConsent: true, marketingConsentAt: giorni(-40) },
      { firstName: 'Anna', lastName: 'Verdi', email: 'anna.verdi@example.it', emailNormalized: 'anna.verdi@example.it', phone: '347 9876543', phoneE164: '+393479876543', sourceId: fonte('passaparola'), marketingConsent: true, marketingConsentAt: giorni(-25) },
      { firstName: 'Luca', lastName: 'De Angelis', phone: '0187 512233', phoneE164: '+390187512233', sourceId: fonte('cliente_esistente') },
      { firstName: 'Chiara', lastName: 'Neri', email: 'chiara.neri@example.it', emailNormalized: 'chiara.neri@example.it', phone: '340 1122334', phoneE164: '+393401122334', sourceId: fonte('campagna'), marketingConsent: true, marketingConsentAt: giorni(-8) },
      { firstName: 'Giuseppe', lastName: 'Costa', phone: '335 5566778', phoneE164: '+393355566778', sourceId: fonte('telefono') },
    ])
    .returning()

  const [rossi, verdi, deangelis, neri, costa] = anagrafiche

  await db.insert(sites).values([
    { contactId: rossi!.id, label: 'Abitazione principale', addressLine: 'Via delle Ginestre 14', city: 'La Spezia', province: 'SP', postalCode: '19121', buildingType: 'Villetta singola', pod: 'IT001E12345678' },
    { contactId: verdi!.id, label: 'Villetta a schiera', addressLine: 'Via Aurelia 220', city: 'Lerici', province: 'SP', postalCode: '19032', buildingType: 'Villetta a schiera' },
    { contactId: costa!.id, label: 'Capannone', addressLine: 'Zona artigianale 8', city: 'Sarzana', province: 'SP', buildingType: 'Capannone', pod: 'IT001E99887766' },
  ])

  /* Opportunita ------------------------------------------------------------- */
  const opp = await db
    .insert(opportunities)
    .values([
      { code: 'OPP-2026-0001', contactId: rossi!.id, businessLine: 'fotovoltaico', title: 'Impianto 6 kW con accumulo', stage: 'preventivo_inviato', stageSince: giorni(-6), ownerId: commerciale!.id, sourceId: fonte('sito'), estimatedValue: '14500.00', probability: 60, nextActionDueAt: giorni(1), firstResponseAt: giorni(-38), createdAt: giorni(-40) },
      { code: 'OPP-2026-0002', contactId: verdi!.id, businessLine: 'fotovoltaico', title: 'Fotovoltaico 4,5 kW', stage: 'sopralluogo_completato', stageSince: giorni(-3), ownerId: commerciale!.id, sourceId: fonte('passaparola'), estimatedValue: '9800.00', probability: 45, nextActionDueAt: giorni(-1), firstResponseAt: giorni(-24), createdAt: giorni(-25) },
      { code: 'OPP-2026-0003', contactId: deangelis!.id, businessLine: 'elettrico', title: 'Adeguamento quadro elettrico', stage: 'qualificato', stageSince: giorni(-2), ownerId: commerciale!.id, sourceId: fonte('cliente_esistente'), estimatedValue: '2400.00', probability: 20, nextActionDueAt: giorni(2), firstResponseAt: giorni(-4), createdAt: giorni(-5) },
      { code: 'OPP-2026-0004', contactId: neri!.id, businessLine: 'fotovoltaico', title: 'Richiesta preventivo fotovoltaico', stage: 'nuovo', stageSince: giorni(-1), ownerId: commerciale!.id, sourceId: fonte('campagna'), probability: 5, nextActionDueAt: giorni(0), createdAt: giorni(-1) },
      { code: 'OPP-2026-0005', contactId: costa!.id, businessLine: 'fotovoltaico', title: 'Impianto capannone 20 kW', stage: 'negoziazione', stageSince: giorni(-4), ownerId: admin!.id, sourceId: fonte('telefono'), estimatedValue: '31000.00', probability: 75, nextActionDueAt: giorni(3), firstResponseAt: giorni(-18), createdAt: giorni(-20) },
    ])
    .returning()

  for (const o of opp) {
    await db.insert(opportunityStatusHistory).values({ opportunityId: o.id, toStage: 'nuovo', changedBy: commerciale!.id, changedAt: o.createdAt })
    if (o.stage !== 'nuovo') {
      await db.insert(opportunityStatusHistory).values({ opportunityId: o.id, fromStage: 'nuovo', toStage: o.stage, daysInPreviousStage: 3, changedBy: commerciale!.id, changedAt: o.stageSince })
    }
  }

  await db.insert(activities).values([
    { kind: 'chiamata', subject: 'Verificare ricezione del preventivo', opportunityId: opp[0]!.id, contactId: rossi!.id, assignedTo: commerciale!.id, dueAt: giorni(1), isNextAction: true },
    { kind: 'task', subject: 'Preparare il preventivo', opportunityId: opp[1]!.id, contactId: verdi!.id, assignedTo: commerciale!.id, dueAt: giorni(-1), isNextAction: true },
    { kind: 'appuntamento', subject: 'Fissare il sopralluogo', opportunityId: opp[2]!.id, contactId: deangelis!.id, assignedTo: commerciale!.id, dueAt: giorni(2), isNextAction: true },
    { kind: 'chiamata', subject: 'Primo contatto', opportunityId: opp[3]!.id, contactId: neri!.id, assignedTo: commerciale!.id, dueAt: giorni(0), isNextAction: true },
    { kind: 'chiamata', subject: 'Richiamare per la trattativa', opportunityId: opp[4]!.id, contactId: costa!.id, assignedTo: admin!.id, dueAt: giorni(3), isNextAction: true },
    { kind: 'sopralluogo', subject: 'Sopralluogo effettuato', opportunityId: opp[1]!.id, contactId: verdi!.id, assignedTo: tecnico!.id, dueAt: giorni(-4), completedAt: giorni(-3), completedBy: tecnico!.id, outcome: 'Tetto a falda esposto a sud-est, nessun ombreggiamento rilevante.' },
  ])

  /* Sopralluogo in compilazione --------------------------------------------- */
  const [templateRiga] = await db
    .select()
    .from(surveyTemplates)
    .where(eq(surveyTemplates.kind, 'sopralluogo'))
    .limit(1)

  if (templateRiga) {
    await db.insert(surveys).values({
      opportunityId: opp[1]!.id,
      templateId: templateRiga.id,
      status: 'bozza',
      performedBy: tecnico!.id,
      performedAt: giorni(-3),
      answers: {
        tipo_tetto: 'falda',
        manto: 'tegole',
        orientamento: 'sud_est',
        inclinazione: 28,
        superficie_utile: 46,
        stato_copertura: 'buono',
        amianto: false,
        ombreggiamenti: 'mattino',
        fonte_ombreggiamento: 'Cipresso del vicino, lato est',
        posizione_contatore: 'Nicchia esterna, lato strada',
        pod: 'IT001E45612378',
        stato_quadro: 'da_integrare',
      },
      roofType: 'falda',
      hasCriticalIssues: false,
    })
  }

  /* Preventivi -------------------------------------------------------------- */
  // Uno inviato, sopra soglia.
  const [preventivo1] = await db.insert(quotes).values({ code: 'PRV-2026-0001', opportunityId: opp[0]!.id, title: 'Impianto 6 kW con accumulo', createdBy: commerciale!.id }).returning()
  const [versione1] = await db
    .insert(quoteVersions)
    .values({
      quoteId: preventivo1!.id, versionNo: 1, status: 'inviato', sentAt: giorni(-6), validUntil: giorni(24),
      revenueNet: '14164.00', costTotal: '9226.00', marginAmount: '4938.00', marginPct: '34.86',
      vatAmount: '1522.24', grossTotal: '15686.24',
      vatBreakdown: [{ aliquota: 10, imponibile: '13156.00', imposta: '1315.60' }, { aliquota: 22, imponibile: '1008.00', imposta: '221.76' }],
      createdBy: commerciale!.id,
    })
    .returning()
  await db.update(quotes).set({ currentVersionId: versione1!.id }).where(eq(quotes.id, preventivo1!.id))
  await db.insert(quoteLines).values([
    { quoteVersionId: versione1!.id, sortOrder: 0, productId: perCodice('MOD-450').id, description: 'Modulo fotovoltaico 450 W', unit: 'pz', quantity: '14.000', unitCost: '92.0000', unitPrice: '148.0000', vatRate: '10.00', lineNet: '2072.00', lineCost: '1288.00' },
    { quoteVersionId: versione1!.id, sortOrder: 1, productId: perCodice('INV-6K').id, description: 'Inverter ibrido 6 kW', unit: 'pz', quantity: '1.000', unitCost: '1050.0000', unitPrice: '1690.0000', vatRate: '10.00', lineNet: '1690.00', lineCost: '1050.00' },
    { quoteVersionId: versione1!.id, sortOrder: 2, productId: perCodice('BAT-10').id, description: 'Batteria di accumulo 10 kWh', unit: 'pz', quantity: '1.000', unitCost: '2400.0000', unitPrice: '3450.0000', vatRate: '10.00', lineNet: '3450.00', lineCost: '2400.00' },
    { quoteVersionId: versione1!.id, sortOrder: 3, productId: perCodice('STR-FAL').id, description: 'Struttura di fissaggio per tetto a falda', unit: 'pz', quantity: '14.000', unitCost: '28.0000', unitPrice: '46.0000', vatRate: '10.00', lineNet: '644.00', lineCost: '392.00' },
    { quoteVersionId: versione1!.id, sortOrder: 4, productId: perCodice('PRAT-GSE').id, description: 'Pratiche di connessione e GSE', unit: 'a corpo', quantity: '1.000', unitCost: '180.0000', unitPrice: '450.0000', vatRate: '22.00', lineNet: '450.00', lineCost: '180.00' },
    { quoteVersionId: versione1!.id, sortOrder: 5, productId: perCodice('MAN-EL').id, description: 'Manodopera elettrica specializzata', unit: 'h', quantity: '24.000', unitCost: '26.0000', unitPrice: '42.0000', vatRate: '22.00', lineNet: '1008.00', lineCost: '624.00' },
  ])

  // Uno in bozza sul capannone, che mostra il pannello di marginalita'.
  const [preventivo2] = await db.insert(quotes).values({ code: 'PRV-2026-0002', opportunityId: opp[4]!.id, title: 'Impianto capannone 20 kW', createdBy: admin!.id }).returning()
  const [versione2] = await db
    .insert(quoteVersions)
    .values({ quoteId: preventivo2!.id, versionNo: 1, status: 'bozza', createdBy: admin!.id })
    .returning()
  await db.update(quotes).set({ currentVersionId: versione2!.id }).where(eq(quotes.id, preventivo2!.id))
  await db.insert(quoteLines).values([
    { quoteVersionId: versione2!.id, sortOrder: 0, productId: perCodice('MOD-450').id, description: 'Modulo fotovoltaico 450 W', unit: 'pz', quantity: '45.000', unitCost: '92.0000', unitPrice: '132.0000', vatRate: '10.00', lineNet: '5940.00', lineCost: '4140.00' },
    { quoteVersionId: versione2!.id, sortOrder: 1, productId: perCodice('INV-6K').id, description: 'Inverter trifase 20 kW', unit: 'pz', quantity: '1.000', unitCost: '2900.0000', unitPrice: '3600.0000', vatRate: '10.00', lineNet: '3600.00', lineCost: '2900.00' },
    { quoteVersionId: versione2!.id, sortOrder: 2, productId: perCodice('STR-FAL').id, description: 'Struttura per copertura industriale', unit: 'pz', quantity: '45.000', unitCost: '31.0000', unitPrice: '44.0000', vatRate: '10.00', lineNet: '1980.00', lineCost: '1395.00' },
    { quoteVersionId: versione2!.id, sortOrder: 3, productId: perCodice('MAN-EL').id, description: 'Manodopera elettrica specializzata', unit: 'h', quantity: '60.000', unitCost: '26.0000', unitPrice: '38.0000', vatRate: '22.00', lineNet: '2280.00', lineCost: '1560.00' },
  ])

  console.log(`
Dati dimostrativi creati.

  Utenti      federico@ecosolare.it  (amministratore, vede i costi)
              giulia@ecosolare.it    (commerciale, NON vede i costi)
              marco@ecosolare.it     (cantiere)

  Sessione locale gia' pronta, cookie:
    amministratore: authjs.session-token=${token}
    commerciale:     authjs.session-token=${tokenCommerciale}
`)
}

main()
  .then(() => client.end())
  .catch(async (errore: unknown) => {
    console.error(errore)
    await client.end()
    process.exit(1)
  })
