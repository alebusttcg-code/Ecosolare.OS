import { createHash } from 'node:crypto'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  clientLinks,
  contacts,
  documentRequirements,
  projects,
  sites,
  users,
} from '@/db/schema'
import { raccontaStato, type StatoRaccontato } from '@/lib/domain/stato-cliente'

/**
 * Lo stato di una commessa, visto dal cliente.
 *
 * Regola d'oro di questo file: **esce solo ciò che è elencato qui sotto**.
 * Nessun importo, nessun costo, nessuna nota interna, nessun nome di
 * fornitore, nessuno stato di pagamento. Chi apre questa pagina non ha fatto
 * l'accesso e non sappiamo chi sia davvero: sappiamo solo che ha il
 * collegamento. Il contenuto va scelto pensando che possa leggerlo chiunque.
 */

export interface DocumentoAtteso {
  readonly etichetta: string
  readonly respinto: boolean
}

export interface StatoPubblico {
  readonly cliente: string
  readonly titolo: string
  readonly codice: string
  readonly indirizzo: string | null
  readonly stato: StatoRaccontato
  readonly documentiAttesi: readonly DocumentoAtteso[]
  readonly dataInstallazione: Date | null
  readonly referente: string | null
}

export function improntaToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Traduce il collegamento in ciò che si può mostrare.
 *
 * `null` copre insieme «token inesistente», «revocato» e «commessa
 * cancellata»: dall'esterno devono essere indistinguibili, altrimenti la
 * pagina diventa un modo per sapere quali collegamenti sono esistiti.
 */
export async function getStatoPubblico(token: string): Promise<StatoPubblico | null> {
  if (!token || token.length < 20) return null

  const db = getDb()

  const [riga] = await db
    .select({
      linkId: clientLinks.id,
      projectId: projects.id,
      codice: projects.code,
      titolo: projects.title,
      stato: projects.stage,
      dataInstallazione: projects.plannedStartAt,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
      indirizzo: sites.addressLine,
      comune: sites.city,
      referente: users.name,
    })
    .from(clientLinks)
    .innerJoin(projects, eq(projects.id, clientLinks.projectId))
    .innerJoin(contacts, eq(contacts.id, projects.contactId))
    .leftJoin(sites, eq(sites.id, projects.siteId))
    .leftJoin(users, eq(users.id, projects.ownerId))
    .where(
      and(
        eq(clientLinks.tokenHash, improntaToken(token)),
        isNull(clientLinks.revokedAt),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1)

  if (!riga) return null

  // Solo i documenti che tocca al cliente procurare: elencargli quelli che
  // dobbiamo produrre noi lo farebbe sentire in colpa per il nostro lavoro.
  const attesi = await db
    .select({
      etichetta: documentRequirements.label,
      stato: documentRequirements.status,
    })
    .from(documentRequirements)
    .where(
      and(
        eq(documentRequirements.projectId, riga.projectId),
        eq(documentRequirements.providedByClient, true),
        sql`${documentRequirements.status} in ('richiesto', 'respinto')`,
      ),
    )
    .orderBy(asc(documentRequirements.sortOrder))

  const documentiAttesi = attesi.map((d) => ({
    etichetta: d.etichetta,
    respinto: d.stato === 'respinto',
  }))

  // Conteggio e ultima visita: servono a sapere se il collegamento è vivo.
  // Scrittura durante una lettura, ma è una riga sola e non blocca niente.
  await db
    .update(clientLinks)
    .set({ lastViewedAt: new Date(), viewCount: sql`${clientLinks.viewCount} + 1` })
    .where(eq(clientLinks.id, riga.linkId))

  const indirizzo = [riga.indirizzo, riga.comune].filter(Boolean).join(' — ') || null

  return {
    cliente: [riga.clienteNome, riga.clienteCognome].filter(Boolean).join(' '),
    titolo: riga.titolo,
    codice: riga.codice,
    indirizzo,
    dataInstallazione: riga.dataInstallazione,
    referente: riga.referente,
    documentiAttesi,
    stato: raccontaStato({
      codiceStato: riga.stato,
      documentiMancanti: documentiAttesi.length,
      dataInstallazione: riga.dataInstallazione,
    }),
  }
}

/** I collegamenti attivi di una commessa, per la scheda interna. */
export async function getLinkCliente(projectId: string) {
  return getDb()
    .select({
      id: clientLinks.id,
      creatoIl: clientLinks.createdAt,
      ultimaVisita: clientLinks.lastViewedAt,
      visite: clientLinks.viewCount,
    })
    .from(clientLinks)
    .where(and(eq(clientLinks.projectId, projectId), isNull(clientLinks.revokedAt)))
    .orderBy(asc(clientLinks.createdAt))
}
