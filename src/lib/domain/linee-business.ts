/**
 * Le linee di business offerte. I `code` sono i valori dell'enum DB
 * `business_line`; le `label` sono ciò che si mostra. Un punto solo, così form,
 * elenchi e schede restano allineati (cambiarne una qui le cambia ovunque).
 */
export const LINEE_BUSINESS = [
  { code: 'fotovoltaico', label: 'Fotovoltaico' },
  { code: 'fv_pdc', label: 'FV+PDC' },
  { code: 'batterie', label: 'Batterie' },
  { code: 'colonnina', label: 'Colonnina Elettrica' },
] as const

export type LineaBusiness = (typeof LINEE_BUSINESS)[number]['code']

/** Etichetta leggibile dal codice; se sconosciuto ritorna il codice grezzo. */
export function etichettaLinea(code: string): string {
  return LINEE_BUSINESS.find((l) => l.code === code)?.label ?? code
}
