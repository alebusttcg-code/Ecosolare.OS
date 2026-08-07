import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  documentRequirements,
  paymentMilestones,
  projectMaterials,
  projectPractices,
  projects,
} from '@/db/schema'
import { calcolaReadiness, type DatiCommessa } from '@/lib/domain/readiness'

/**
 * Ricalcola la pianificabilità di una commessa e la conserva.
 *
 * Il calcolo è puro (`calcolaReadiness`); qui si raccolgono gli ingredienti e
 * si scrive l'esito. Conservarlo serve agli elenchi: chiedere «quali cantieri
 * sono pianificabili» non deve costare una scansione di tutte le commesse.
 *
 * Vive fuori da `lib/actions` di proposito: non è un endpoint invocabile dal
 * client ma un passo interno che le action richiamano dopo aver superato il
 * proprio `guard`. Tenerlo in un file `use server` lo esporrebbe senza guardia.
 */
export async function ricalcolaReadiness(projectId: string): Promise<void> {
  const db = getDb()

  const commessa = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })
  if (!commessa) return

  const [documenti, materiali, pratiche, acconti] = await Promise.all([
    db.select().from(documentRequirements).where(eq(documentRequirements.projectId, projectId)),
    db.select().from(projectMaterials).where(eq(projectMaterials.projectId, projectId)),
    db.select().from(projectPractices).where(eq(projectPractices.projectId, projectId)),
    db
      .select()
      .from(paymentMilestones)
      .where(
        and(
          eq(paymentMilestones.projectId, projectId),
          eq(paymentMilestones.blocksStart, true),
        ),
      ),
  ])

  const dati: DatiCommessa = {
    documenti: documenti.map((d) => ({
      label: d.label,
      obbligatorio: d.mandatory,
      stato: d.status,
      responsabile: d.responsibleId,
      da: d.statusSince,
    })),
    materiali: materiali.map((m) => ({
      descrizione: m.description,
      critico: m.critical,
      stato: m.status,
      responsabile: m.responsibleId,
      da: m.statusSince,
    })),
    pratiche: pratiche.map((p) => ({
      label: p.label,
      bloccante: p.blocking,
      stato: p.status,
      responsabile: p.responsibleId,
      da: p.statusSince,
    })),
    verificaTecnicaCompletata: commessa.technicalCheckDoneAt !== null,
    clienteHaConfermato: commessa.clientConfirmedAt !== null,
    // Conta l'OK AMMINISTRATIVO, non lo stato «incassato»: e' l'ok che da'
    // il via al cantiere, ed e' cio' che il controllo bancario poi verifica.
    accontoIncassato:
      acconti.length === 0 ? null : acconti.every((a) => a.adminOkAt !== null),
  }

  const esito = calcolaReadiness(dati, new Date())
  const eraBloccata = commessa.readinessState !== 'pianificabile'
  const oraBloccata = esito.stato !== 'pianificabile'

  await db
    .update(projects)
    .set({
      readinessState: esito.stato,
      readinessBlockers: [...esito.bloccanti, ...esito.avvisi],
      readinessComputedAt: new Date(),
      // Il momento in cui il blocco è iniziato non si azzera a ogni ricalcolo:
      // serve a misurare da quanto la commessa è ferma.
      blockedSince: oraBloccata
        ? eraBloccata
          ? commessa.blockedSince
          : new Date()
        : null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
}
