import type { Risposta, Risposte } from '@/lib/domain/questionnaire'

/** Campi con lo stesso codice e valori compatibili: copia diretta. */
const CAMPI_UGUALI = ['tipo_tetto', 'orientamento'] as const

const ORIENTAMENTI_SOPRALLUOGO = new Set([
  'sud',
  'sud_est',
  'sud_ovest',
  'est',
  'ovest',
  'nord',
])

const STATI_COPERTURA_SOPRALLUOGO = new Set(['buono', 'discreto', 'da_sistemare'])

const MAPPA_OMBRE: Readonly<Record<string, string>> = {
  nessuno: 'nessuno',
  importanti: 'costanti',
}

function numero(valore: Risposta): number | null {
  if (typeof valore === 'number' && Number.isFinite(valore)) return valore
  if (typeof valore === 'string' && valore.trim() !== '') {
    const n = Number.parseFloat(valore.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Deriva valori iniziali del sopralluogo dalla prequalifica del lead. */
export function risposteDaPrequalifica(prequalifica: Risposte): Risposte {
  const out: Record<string, Risposta> = {}

  for (const codice of CAMPI_UGUALI) {
    const valore = prequalifica[codice]
    if (typeof valore !== 'string' || !valore) continue
    if (codice === 'orientamento' && !ORIENTAMENTI_SOPRALLUOGO.has(valore)) continue
    out[codice] = valore
  }

  const superficie = numero(prequalifica.superficie_indicativa)
  if (superficie !== null && superficie > 0) {
    out.superficie_utile = superficie
  }

  const ombre = prequalifica.ombreggiamenti
  if (typeof ombre === 'string') {
    const mappato = MAPPA_OMBRE[ombre]
    if (mappato) out.ombreggiamenti = mappato
  }

  const stato = prequalifica.stato_copertura
  if (typeof stato === 'string') {
    if (stato === 'amianto') {
      out.amianto = true
    } else if (STATI_COPERTURA_SOPRALLUOGO.has(stato)) {
      out.stato_copertura = stato
    }
  }

  const interessi = prequalifica.interessi_aggiuntivi
  if (Array.isArray(interessi) && interessi.includes('accumulo')) {
    out.accumulo_previsto = true
  }

  return out
}

/** Le risposte già salvate nel sopralluogo hanno priorità sulla prequalifica. */
export function unisciRisposteSopralluogo(daPrequalifica: Risposte, salvate: Risposte): Risposte {
  return { ...daPrequalifica, ...salvate }
}

/** True se la prequalifica fornisce almeno un campo utile al sopralluogo. */
export function haDatiPrequalificaPerSopralluogo(prequalifica: Risposte): boolean {
  return Object.keys(risposteDaPrequalifica(prequalifica)).length > 0
}
