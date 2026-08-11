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
  /**
   * Agevolazione scelta per le spese del blocco termico.
   *
   * Per privati e condomini il Conto Termico 3.0 non si somma a una
   * detrazione statale sulle stesse spese: la scelta e' quindi esplicita e
   * mutuamente esclusiva, non dedotta dal template PDF.
   */
  readonly incentivo: 'detrazione' | 'conto_termico' | 'nessuno'
  /** Conto Termico indicativo in euro, null se non e' quello scelto. */
  readonly contoTermicoEur: number | null
  /** Su quanti anni viene ripartita la detrazione termica. */
  readonly anniDetrazione?: number | null
  /**
   * Rendimento stagionale della pompa di calore proposta. Senza, l'economia
   * del termico non e' calcolabile e il blocco resta solo descrittivo.
   */
  readonly scop?: number | null
  /** Prezzo del gas in euro per standard metro cubo, dalla bolletta. */
  readonly prezzoGasEurSmc?: number | null
  /** Su quanti anni il GSE eroga il Conto Termico. */
  readonly anniContoTermico?: number | null
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
  const contoTermicoEur =
    ct != null && Number.isFinite(ct) && ct >= 0 ? ct : null
  const incentivo =
    o.incentivo === 'detrazione' ||
    o.incentivo === 'conto_termico' ||
    o.incentivo === 'nessuno'
      ? o.incentivo
      : contoTermicoEur != null && contoTermicoEur > 0
        ? 'conto_termico'
        : Number.isFinite(detrazionePct) && detrazionePct > 0
          ? 'detrazione'
          : 'nessuno'
  return {
    termico: {
      presente: true,
      tipo,
      descrizione: descrizione.slice(0, 500),
      prezzoLordoEur,
      detrazionePct: Number.isFinite(detrazionePct)
        ? Math.min(100, Math.max(0, detrazionePct))
        : 50,
      incentivo,
      contoTermicoEur:
        incentivo === 'conto_termico' ? contoTermicoEur : null,
      anniDetrazione: opzionalePositivo(o.anniDetrazione),
      scop: opzionalePositivo(o.scop),
      prezzoGasEurSmc: opzionalePositivo(o.prezzoGasEurSmc),
      anniContoTermico: opzionalePositivo(o.anniContoTermico),
    },
  }
}

/** Numero positivo, o `null`: non si inventa un valore quando manca il dato. */
function opzionalePositivo(grezzo: unknown): number | null {
  if (grezzo == null || grezzo === '') return null
  const n = Number(grezzo)
  return Number.isFinite(n) && n > 0 ? n : null
}
