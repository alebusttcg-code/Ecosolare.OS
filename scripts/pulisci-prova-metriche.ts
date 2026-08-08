/**
 * Rimuove i lead di prova creati da prova-metriche.ts.
 *
 *   npm run prova:metriche:pulisci
 */
import { inArray, like, or, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  activities,
  contacts,
  opportunities,
  opportunityStatusHistory,
  quoteLines,
  quoteVersions,
  quotes,
} from '../src/db/schema'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL non impostata.')
  process.exit(1)
}

const client = postgres(url, { max: 1, prepare: false })
const db = drizzle(client)

async function main(): Promise<void> {
  const contatti = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(like(contacts.lastName, 'TEST-METRICHE%'))

  if (contatti.length === 0) {
    console.log('Nessun dato di prova da rimuovere.\n')
    await client.end()
    return
  }

  const contactIds = contatti.map((c) => c.id)

  const opps = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(inArray(opportunities.contactId, contactIds))

  const oppIds = opps.map((o) => o.id)

  const preventivi = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(
      or(
        like(quotes.code, '%TEST-M%'),
        oppIds.length > 0 ? inArray(quotes.opportunityId, oppIds) : sql`false`,
      ),
    )

  const quoteIds = preventivi.map((q) => q.id)

  if (quoteIds.length > 0) {
    const versioni = await db
      .select({ id: quoteVersions.id })
      .from(quoteVersions)
      .where(inArray(quoteVersions.quoteId, quoteIds))
    const versionIds = versioni.map((v) => v.id)

    if (versionIds.length > 0) {
      await db.delete(quoteLines).where(inArray(quoteLines.quoteVersionId, versionIds))
      await db.delete(quoteVersions).where(inArray(quoteVersions.id, versionIds))
    }
    await db.delete(quotes).where(inArray(quotes.id, quoteIds))
  }

  if (oppIds.length > 0) {
    await db.delete(activities).where(inArray(activities.opportunityId, oppIds))
    await db
      .delete(opportunityStatusHistory)
      .where(inArray(opportunityStatusHistory.opportunityId, oppIds))
    await db.delete(opportunities).where(inArray(opportunities.id, oppIds))
  }

  await db.delete(contacts).where(inArray(contacts.id, contactIds))

  console.log(`
✓ Dati di prova rimossi:
  ${contatti.length} contatti
  ${oppIds.length} lead
  ${quoteIds.length} preventivi

Puoi procedere con i test manuali da Lead → Nuovo lead.
`)

  await client.end()
}

main().catch((errore: unknown) => {
  console.error(errore)
  void client.end()
  process.exit(1)
})
