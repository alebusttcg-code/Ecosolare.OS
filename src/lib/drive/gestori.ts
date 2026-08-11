import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/db'
import {
  companies,
  contacts,
  documentFiles,
  documentRequirements,
  opportunities,
  paymentMilestones,
  paymentReceipts,
  projects,
  surveyFiles,
  surveys,
} from '@/db/schema'
import type { Gestore } from '@/lib/outbox'
import { getArchivio } from '@/lib/storage'
import {
  caricaFile,
  cestinaFile,
  creaCartella,
  driveConfigurato,
  ripristinaFile,
} from './client'
import { nomeCartellaCliente, nomeCartellaCommessa } from './nomi'

/**
 * Gestori degli eventi Drive (D-011).
 *
 * Regola comune: **sollevare significa «riprova più tardi»**. L'outbox
 * ritenta con attesa crescente, quindi un errore di rete o una cartella non
 * ancora creata non vanno gestiti qui — basta lasciar propagare.
 *
 * Regola opposta e altrettanto importante: se lo stato è già quello voluto, il
 * gestore non fa niente e finisce bene. Gli eventi possono arrivare due volte,
 * ed è l'idempotenza a renderlo innocuo.
 */

export const TIPO_CARTELLA_CLIENTE = 'drive.cartella_cliente'
export const TIPO_COPIA_DOCUMENTO = 'drive.copia_documento'
export const TIPO_COPIA_CONTABILE = 'drive.copia_contabile'
export const TIPO_COPIA_FOTO_SOPRALLUOGO = 'drive.copia_foto_sopralluogo'
export const TIPO_CESTINA_FILE = 'drive.cestina_file'
export const TIPO_RIPRISTINA_FILE = 'drive.ripristina_file'

/**
 * Cartella di primo livello per le fotografie dei sopralluoghi.
 *
 * Non stanno nella cartella del cliente perché il sopralluogo avviene PRIMA
 * del contratto, e la cartella del cliente nasce alla firma: aspettarla
 * lascerebbe senza seconda copia proprio i file meno ricostruibili del sistema
 * — una foto di un tetto si rifà solo tornandoci sopra.
 */
const CARTELLA_SOPRALLUOGHI = 'Sopralluoghi'

const cartellaSchema = z.object({ projectId: z.uuid() })
const copiaSchema = z.object({ documentFileId: z.uuid() })
const copiaContabileSchema = z.object({ paymentReceiptId: z.uuid() })
const copiaFotoSchema = z.object({ surveyFileId: z.uuid() })

/**
 * Crea la cartella del cliente e, dentro, quella della commessa.
 *
 * Le due insieme e non in due eventi separati: la sottocartella non ha senso
 * senza la cartella che la contiene, e tenerle in un solo evento evita di
 * dover ordinare due code.
 */
const cartellaCliente: Gestore = async (payload) => {
  const { projectId } = cartellaSchema.parse(payload)
  const db = getDb()

  const [riga] = await db
    .select({
      projectCode: projects.code,
      projectTitle: projects.title,
      projectFolder: projects.driveFolderId,
      contactId: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      contactFolder: contacts.driveFolderId,
      companyName: companies.legalName,
    })
    .from(projects)
    .innerJoin(contacts, eq(contacts.id, projects.contactId))
    .leftJoin(companies, eq(companies.id, contacts.companyId))
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!riga) {
    // La commessa non esiste più: nessun ritentativo la farà tornare.
    console.warn('[drive] commessa inesistente, evento ignorato', { projectId })
    return
  }

  if (riga.projectFolder) return

  const cartellaClienteId =
    riga.contactFolder ??
    (await creaCartella({
      nome: nomeCartellaCliente({
        firstName: riga.firstName,
        lastName: riga.lastName,
        companyName: riga.companyName,
      }),
    }))

  if (!riga.contactFolder) {
    await db
      .update(contacts)
      .set({ driveFolderId: cartellaClienteId })
      .where(eq(contacts.id, riga.contactId))
  }

  const cartellaCommessaId = await creaCartella({
    nome: nomeCartellaCommessa({ code: riga.projectCode, title: riga.projectTitle }),
    genitoreId: cartellaClienteId,
  })

  await db
    .update(projects)
    .set({ driveFolderId: cartellaCommessaId })
    .where(eq(projects.id, projectId))
}

/**
 * Copia su Drive un documento già archiviato.
 *
 * L'archivio resta la fonte di verità: qui si legge da lì e si scrive su Drive,
 * mai il contrario. Se la copia non riesce, il documento nel gestionale è
 * comunque completo — è la finestra su Drive a restare indietro.
 */
const copiaDocumento: Gestore = async (payload) => {
  const { documentFileId } = copiaSchema.parse(payload)
  const db = getDb()

  const [riga] = await db
    .select({
      storageKey: documentFiles.storageKey,
      filename: documentFiles.filename,
      mimeType: documentFiles.mimeType,
      versionNo: documentFiles.versionNo,
      driveFileId: documentFiles.driveFileId,
      cartella: projects.driveFolderId,
      etichetta: documentRequirements.label,
    })
    .from(documentFiles)
    .innerJoin(
      documentRequirements,
      eq(documentRequirements.id, documentFiles.requirementId),
    )
    .innerJoin(projects, eq(projects.id, documentRequirements.projectId))
    .where(eq(documentFiles.id, documentFileId))
    .limit(1)

  if (!riga) {
    // Il file è stato cancellato prima che la copia partisse: è un esito
    // legittimo, non un guasto.
    console.warn('[drive] documento inesistente, copia annullata', { documentFileId })
    return
  }

  if (riga.driveFileId) return

  // La cartella arriva da un altro evento, che potrebbe non essere ancora
  // passato: sollevare qui rimanda la copia, che è esattamente ciò che serve.
  if (!riga.cartella) {
    throw new Error('La cartella della commessa su Drive non esiste ancora.')
  }

  const contenuto = await getArchivio().leggi(riga.storageKey)
  if (!contenuto) {
    throw new Error(`File non trovato in archivio: ${riga.storageKey}`)
  }

  // Il nome porta requisito e versione perché su Drive non c'è la scheda della
  // commessa a dare il contesto: c'è solo l'elenco dei file.
  const nome = `${riga.etichetta} v${riga.versionNo} — ${riga.filename}`

  const driveFileId = await caricaFile({
    nome,
    mimeType: riga.mimeType,
    contenuto,
    cartellaId: riga.cartella,
  })

  await db
    .update(documentFiles)
    .set({ driveFileId })
    .where(eq(documentFiles.id, documentFileId))
}

/** Copia su Drive una contabile di pagamento già archiviata. */
const copiaContabile: Gestore = async (payload) => {
  const { paymentReceiptId } = copiaContabileSchema.parse(payload)
  const db = getDb()

  const [riga] = await db
    .select({
      storageKey: paymentReceipts.storageKey,
      filename: paymentReceipts.filename,
      mimeType: paymentReceipts.mimeType,
      driveFileId: paymentReceipts.driveFileId,
      cartella: projects.driveFolderId,
      etichetta: paymentMilestones.label,
    })
    .from(paymentReceipts)
    .innerJoin(paymentMilestones, eq(paymentMilestones.id, paymentReceipts.milestoneId))
    .innerJoin(projects, eq(projects.id, paymentMilestones.projectId))
    .where(eq(paymentReceipts.id, paymentReceiptId))
    .limit(1)

  if (!riga) {
    console.warn('[drive] contabile inesistente, copia annullata', { paymentReceiptId })
    return
  }

  if (riga.driveFileId) return

  if (!riga.cartella) {
    throw new Error('La cartella della commessa su Drive non esiste ancora.')
  }

  const contenuto = await getArchivio().leggi(riga.storageKey)
  if (!contenuto) {
    throw new Error(`File non trovato in archivio: ${riga.storageKey}`)
  }

  const nome = `Contabile — ${riga.etichetta} — ${riga.filename}`
  const driveFileId = await caricaFile({
    nome,
    mimeType: riga.mimeType,
    contenuto,
    cartellaId: riga.cartella,
  })

  await db
    .update(paymentReceipts)
    .set({ driveFileId })
    .where(eq(paymentReceipts.id, paymentReceiptId))
}

/**
 * Copia su Drive una fotografia di sopralluogo.
 *
 * A differenza di documenti e contabili non dipende dalla commessa: crea al
 * volo `Sopralluoghi / <codice opportunità> — <cliente>`, e `creaCartella`
 * riusa quella esistente, quindi le foto dello stesso sopralluogo finiscono
 * insieme senza bisogno di ricordare l'identificativo da nessuna parte.
 */
const copiaFotoSopralluogo: Gestore = async (payload) => {
  const { surveyFileId } = copiaFotoSchema.parse(payload)
  const db = getDb()

  const [riga] = await db
    .select({
      storageKey: surveyFiles.storageKey,
      filename: surveyFiles.filename,
      mimeType: surveyFiles.mimeType,
      fieldCode: surveyFiles.fieldCode,
      sortOrder: surveyFiles.sortOrder,
      driveFileId: surveyFiles.driveFileId,
      deletedAt: surveyFiles.deletedAt,
      opportunityCode: opportunities.code,
      clienteNome: contacts.firstName,
      clienteCognome: contacts.lastName,
    })
    .from(surveyFiles)
    .innerJoin(surveys, eq(surveys.id, surveyFiles.surveyId))
    .innerJoin(opportunities, eq(opportunities.id, surveys.opportunityId))
    .innerJoin(contacts, eq(contacts.id, opportunities.contactId))
    .where(eq(surveyFiles.id, surveyFileId))
    .limit(1)

  if (!riga) {
    console.warn('[drive] fotografia inesistente, copia annullata', { surveyFileId })
    return
  }

  if (riga.driveFileId) return
  // Cestinata prima che la copia partisse: non ha senso portarla su Drive.
  if (riga.deletedAt) return

  const contenuto = await getArchivio().leggi(riga.storageKey)
  if (!contenuto) {
    throw new Error(`Fotografia non trovata in archivio: ${riga.storageKey}`)
  }

  const radice = await creaCartella({ nome: CARTELLA_SOPRALLUOGHI })
  const cliente = nomeCartellaCliente({
    firstName: riga.clienteNome,
    lastName: riga.clienteCognome,
  })
  const cartellaId = await creaCartella({
    nome: `${riga.opportunityCode} — ${cliente}`,
    genitoreId: radice,
  })

  const nome = `${riga.fieldCode} ${riga.sortOrder + 1} — ${riga.filename}`
  const driveFileId = await caricaFile({
    nome,
    mimeType: riga.mimeType,
    contenuto,
    cartellaId,
  })

  await db
    .update(surveyFiles)
    .set({ driveFileId })
    .where(eq(surveyFiles.id, surveyFileId))
}

/** Sposta nel cestino Drive; 404 = già assente, successo idempotente. */
const gestisciCestinaFile: Gestore = async (payload) => {
  const driveFileId = typeof payload.driveFileId === 'string' ? payload.driveFileId : ''
  if (!driveFileId) return
  await cestinaFile(driveFileId)
}

/** Riporta fuori dal cestino Drive; 404 = già assente, successo idempotente. */
const gestisciRipristinaFile: Gestore = async (payload) => {
  const driveFileId = typeof payload.driveFileId === 'string' ? payload.driveFileId : ''
  if (!driveFileId) return
  await ripristinaFile(driveFileId)
}

/**
 * I gestori attivi.
 *
 * Se Drive non è configurato la mappa è vuota: chi chiama deve astenersi da
 * `elaboraOutbox` (vedere `smaltisciCodaDrive`), altrimenti gli eventi
 * Drive verrebbero segnati `fallito` per «nessun gestore».
 */
export function gestoriDrive(): Record<string, Gestore> {
  if (!driveConfigurato()) return {}
  return {
    [TIPO_CARTELLA_CLIENTE]: cartellaCliente,
    [TIPO_COPIA_DOCUMENTO]: copiaDocumento,
    [TIPO_COPIA_CONTABILE]: copiaContabile,
    [TIPO_COPIA_FOTO_SOPRALLUOGO]: copiaFotoSopralluogo,
    [TIPO_CESTINA_FILE]: gestisciCestinaFile,
    [TIPO_RIPRISTINA_FILE]: gestisciRipristinaFile,
  }
}
