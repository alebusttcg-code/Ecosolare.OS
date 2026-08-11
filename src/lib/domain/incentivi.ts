/**
 * Incentivi commerciali mostrati in preventivo.
 *
 * Aliquote e durate arrivano sempre dall'esterno (config con validità
 * temporale / snapshot): qui non ci sono percentuali normative.
 */

export type InputDetrazioneIrpef = {
  /** Prezzo IVA inclusa, in centesimi. */
  readonly prezzoLordoCents: number
  /** Percentuale 0–100 (es. 50). */
  readonly detrazionePct: number
  /** Anni di ripartizione della detrazione nel cashflow (es. 10). */
  readonly anniRate: number
}

export type DetrazioneIrpef = {
  readonly detrazioneTotaleCents: number
  readonly prezzoNettoIndicativoCents: number
  readonly rataAnnuaCents: number
  readonly anniRate: number
  readonly detrazionePct: number
}

/**
 * Detrazione IRPEF sul prezzo IVA inclusa, come nei box §7 dei dossier.
 * Rate annuali uguali; l'eventuale resto di arrotondamento va sull'ultima rata
 * (vedi `rateDetrazionePerAnno`).
 */
export function calcolaDetrazioneIrpef(input: InputDetrazioneIrpef): DetrazioneIrpef {
  const prezzo = Math.max(0, Math.round(input.prezzoLordoCents))
  const pct = Number.isFinite(input.detrazionePct)
    ? Math.min(100, Math.max(0, input.detrazionePct))
    : 0
  const anni = Number.isFinite(input.anniRate)
    ? Math.max(1, Math.round(input.anniRate))
    : 1

  const detrazioneTotaleCents = Math.round((prezzo * pct) / 100)
  const rataAnnuaCents = Math.floor(detrazioneTotaleCents / anni)

  return {
    detrazioneTotaleCents,
    prezzoNettoIndicativoCents: prezzo - detrazioneTotaleCents,
    rataAnnuaCents,
    anniRate: anni,
    detrazionePct: pct,
  }
}

/** Rate anno per anno (1-based), con resto sull'ultima. */
export function rateDetrazionePerAnno(
  detrazione: DetrazioneIrpef,
): readonly number[] {
  const rate: number[] = []
  let assegnato = 0
  for (let i = 1; i <= detrazione.anniRate; i++) {
    if (i < detrazione.anniRate) {
      rate.push(detrazione.rataAnnuaCents)
      assegnato += detrazione.rataAnnuaCents
    } else {
      rate.push(detrazione.detrazioneTotaleCents - assegnato)
    }
  }
  return rate
}
