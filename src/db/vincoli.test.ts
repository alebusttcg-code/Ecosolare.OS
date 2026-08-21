import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { activities, contacts, opportunities, pipelineStages, users } from './schema'
import { createTestDatabase, type TestDatabase } from './testing'

/**
 * Verifica i vincoli che il database fa rispettare per conto suo.
 *
 * Sono le regole che non vogliamo affidare alla sola correttezza del codice
 * applicativo: se un giorno una server action dimentica un controllo, deve
 * fallire l'inserimento, non corrompere i dati in silenzio.
 */
describe('vincoli di integrita', () => {
  let db: TestDatabase
  let close: () => Promise<void>
  let userId: string
  let contactId: string
  let opportunityId: string

  beforeAll(async () => {
    const testDb = await createTestDatabase()
    db = testDb.db
    close = testDb.close

    const [utente] = await db
      .insert(users)
      .values({ email: 'commerciale@ecosolare.example', role: 'commerciale' })
      .returning()
    userId = utente!.id

    const [contatto] = await db.insert(contacts).values({ lastName: 'Rossi' }).returning()
    contactId = contatto!.id

    await db.insert(pipelineStages).values({
      code: 'nuovo',
      label: 'Nuovo',
      sortOrder: 10,
      isOpen: true,
      defaultProbability: 5,
    })

    const [opp] = await db
      .insert(opportunities)
      .values({
        code: 'OPP-2026-0001',
        contactId,
        businessLine: 'fotovoltaico',
        title: 'Impianto 6 kW',
        stage: 'nuovo',
        ownerId: userId,
      })
      .returning()
    opportunityId = opp!.id
  })

  afterAll(async () => {
    await close()
  })

  it('ammette una sola prossima azione aperta per opportunita', async () => {
    await db.insert(activities).values({
      kind: 'chiamata',
      subject: 'Primo contatto',
      opportunityId,
      assignedTo: userId,
      isNextAction: true,
    })

    // La seconda deve essere rifiutata dal database, non solo dal codice.
    await expect(
      db.insert(activities).values({
        kind: 'email',
        subject: 'Secondo contatto',
        opportunityId,
        assignedTo: userId,
        isNextAction: true,
      }),
    ).rejects.toThrow()
  })

  it('ammette piu attivita normali sulla stessa opportunita', async () => {
    await expect(
      db.insert(activities).values([
        { kind: 'nota', subject: 'Nota 1', opportunityId, assignedTo: userId },
        { kind: 'nota', subject: 'Nota 2', opportunityId, assignedTo: userId },
      ]),
    ).resolves.not.toThrow()
  })

  it('ammette una nuova prossima azione dopo che la precedente e completata', async () => {
    const [seconda] = await db
      .insert(opportunities)
      .values({
        code: 'OPP-2026-0002',
        contactId,
        businessLine: 'fv_pdc',
        title: 'Adeguamento quadro',
        stage: 'nuovo',
        ownerId: userId,
      })
      .returning()

    await db.insert(activities).values({
      kind: 'chiamata',
      subject: 'Prima',
      opportunityId: seconda!.id,
      assignedTo: userId,
      isNextAction: true,
      completedAt: new Date(),
    })

    // L'indice univoco e' parziale: considera solo le attivita' non completate.
    await expect(
      db.insert(activities).values({
        kind: 'chiamata',
        subject: 'Seconda',
        opportunityId: seconda!.id,
        assignedTo: userId,
        isNextAction: true,
      }),
    ).resolves.not.toThrow()
  })

  it('impedisce due opportunita con lo stesso codice', async () => {
    await expect(
      db.insert(opportunities).values({
        code: 'OPP-2026-0001',
        contactId,
        businessLine: 'batterie',
        title: 'Duplicato',
        stage: 'nuovo',
        ownerId: userId,
      }),
    ).rejects.toThrow()
  })

  it('impedisce di cancellare un contatto che ha opportunita', async () => {
    // onDelete: restrict — lo storico economico non deve poter sparire
    // per la cancellazione di un'anagrafica (ADR-008).
    const { eq } = await import('drizzle-orm')
    await expect(db.delete(contacts).where(eq(contacts.id, contactId))).rejects.toThrow()
  })
})
