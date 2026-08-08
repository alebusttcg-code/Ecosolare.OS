/**
 * Unità di misura discrete: non ammettono frazioni.
 *
 * «pz» è pezzi: 6,002 pezzi non ha senso fisico né commerciale. Altre unità
 * (kWp, m, mq, …) restano decimali.
 */
const UNITA_QUANTITA_INTERA = new Set(['pz', 'n', 'nr', 'cad', 'kit'])

export function unitaRichiedeIntero(unita: string): boolean {
  return UNITA_QUANTITA_INTERA.has(unita.trim().toLowerCase())
}

/**
 * Arrotonda a intero quando l'unità lo richiede.
 * Non forza il minimo 1: in digitazione un campo vuoto resta 0 fino al salvataggio.
 */
export function normalizzaQuantita(quantita: number, unita: string): number {
  if (!Number.isFinite(quantita) || !unitaRichiedeIntero(unita)) return quantita
  return Math.round(quantita)
}
