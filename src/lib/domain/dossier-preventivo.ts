/**
 * Contenuti commerciali extra del preventivo (blocco termico, ecc.).
 * Persistiti in `quote_versions.dossier` (jsonb).
 */

export type BloccoTermicoDossier = {
  readonly presente: boolean
  readonly tipo: 'pdc' | 'ibrido' | 'altro'
  readonly descrizione: string
  /** Prezzo IVA inclusa in euro (come nei box §7 dei dossier). */
  readonly prezzoLordoEur: number
  /** Percentuale detrazione (es. 50). */
  readonly detrazionePct: number
  /** Conto Termico indicativo in euro, null se non applicabile. */
  readonly contoTermicoEur: number | null
}

export type DossierPreventivo = {
  readonly termico?: BloccoTermicoDossier | null
}

export const DOSSIER_VUOTO: DossierPreventivo = {}

export function normalizzaDossier(grezzo: unknown): DossierPreventivo {
  if (!grezzo || typeof grezzo !== 'object') return DOSSIER_VUOTO
  const t = (grezzo as { termico?: unknown }).termico
  if (!t || typeof t !== 'object') return DOSSIER_VUOTO
  const o = t as Record<string, unknown>
  if (o.presente !== true) return { termico: null }
  const tipo =
    o.tipo === 'pdc' || o.tipo === 'ibrido' || o.tipo === 'altro' ? o.tipo : 'pdc'
  const descrizione = typeof o.descrizione === 'string' ? o.descrizione.trim() : ''
  const prezzoLordoEur = Number(o.prezzoLordoEur)
  const detrazionePct = Number(o.detrazionePct)
  const ct =
    o.contoTermicoEur == null || o.contoTermicoEur === ''
      ? null
      : Number(o.contoTermicoEur)
  if (!descrizione || !Number.isFinite(prezzoLordoEur) || prezzoLordoEur < 0) {
    return { termico: null }
  }
  return {
    termico: {
      presente: true,
      tipo,
      descrizione: descrizione.slice(0, 500),
      prezzoLordoEur,
      detrazionePct: Number.isFinite(detrazionePct)
        ? Math.min(100, Math.max(0, detrazionePct))
        : 50,
      contoTermicoEur:
        ct != null && Number.isFinite(ct) && ct >= 0 ? ct : null,
    },
  }
}
