/**
 * Regole pure di pianificazione cantiere (Fase 4).
 *
 * Niente DB: le action importano queste funzioni e restano testabili.
 */

export const STAGE_CANTIERE_PIANIFICATO = 'cantiere_pianificato'
export const STAGE_PIANIFICABILE = 'pianificabile'
export const STAGE_INSTALLAZIONE_IN_CORSO = 'installazione_in_corso'
export const STAGE_INSTALLAZIONE_COMPLETATA = 'installazione_completata'

/** Work order ancora “vivi” sul progetto (uno solo per vincolo DB). */
export const STATI_WO_ATTIVI = ['pianificato', 'in_corso'] as const

export type StatoWorkOrder = 'pianificato' | 'in_corso' | 'completato' | 'annullato'

export function woAttivo(status: string): boolean {
  return (STATI_WO_ATTIVI as readonly string[]).includes(status)
}

/** Data YYYY-MM-DD → istante a mezzogiorno UTC (evita scivolamenti di fuso). */
export function dataGiornoDaIso(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  const data = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  if (
    data.getUTCFullYear() !== y ||
    data.getUTCMonth() !== m - 1 ||
    data.getUTCDate() !== d
  ) {
    return null
  }
  return data
}

export function isoDaDataGiorno(data: Date): string {
  const y = data.getUTCFullYear()
  const m = String(data.getUTCMonth() + 1).padStart(2, '0')
  const d = String(data.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Prima pianificazione: solo se la readiness è verde. */
export function puoCrearePianificazione(readinessState: string): boolean {
  return readinessState === 'pianificabile'
}

/**
 * Se lo stage attuale è prima di `cantiere_pianificato`, va avanzato.
 * Non torna indietro se il cantiere è già in installazione o oltre.
 */
export function stageDopoPianificazione(
  stageAttuale: string,
  stati: readonly { readonly code: string; readonly sortOrder: number }[],
): string | null {
  const target = stati.find((s) => s.code === STAGE_CANTIERE_PIANIFICATO)
  const attuale = stati.find((s) => s.code === stageAttuale)
  if (!target || !attuale) return null
  if (attuale.sortOrder >= target.sortOrder) return null
  return STAGE_CANTIERE_PIANIFICATO
}

/** Dopo un annullamento: solo se eravamo a cantiere_pianificato. */
export function stageDopoAnnullamento(stageAttuale: string): string | null {
  return stageAttuale === STAGE_CANTIERE_PIANIFICATO ? STAGE_PIANIFICABILE : null
}

/** Avvio lavori: WO pianificato → in_corso e stage installazione_in_corso. */
export function puoAvviareInstallazione(woStatus: string): boolean {
  return woStatus === 'pianificato'
}

/** Chiusura lavori operativi: WO in_corso → completato. */
export function puoCompletareInstallazione(woStatus: string): boolean {
  return woStatus === 'in_corso'
}

export function nomeOperaio(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

export function etichettaStatoWorkOrder(status: string): string {
  switch (status) {
    case 'pianificato':
      return 'Pianificato'
    case 'in_corso':
      return 'In corso'
    case 'completato':
      return 'Completato'
    case 'annullato':
      return 'Annullato'
    default:
      return status
  }
}
