/**
 * Unica fonte dell'ordine narrativo del dossier premium.
 * I componenti non decidono autonomamente dove comparire.
 */
export const REGISTRO_PAGINE_PREMIUM = [
  { id: 'sintesi', tipo: 'dinamica', titolo: 'Il progetto in sintesi' },
  { id: 'dettagli', tipo: 'dinamica', titolo: 'Dettagli impianto' },
  { id: 'caratteristiche', tipo: 'dinamica', titolo: 'Caratteristiche' },
  { id: 'garanzie', tipo: 'dinamica', titolo: 'Esclusioni e garanzie' },
  { id: 'esperienza', tipo: 'fissa', titolo: '20 anni di esperienza' },
  { id: 'qualita', tipo: 'fissa', titolo: 'Qualità certificata' },
  { id: 'recensioni', tipo: 'fissa', titolo: 'La soddisfazione dei clienti' },
  { id: 'garanzia-unica', tipo: 'fissa', titolo: 'Garanzia unica sul mercato' },
  { id: 'spesa', tipo: 'dinamica', titolo: 'Preventivo di spesa' },
  { id: 'report-panoramica', tipo: 'report', titolo: 'Panoramica finanziaria' },
  { id: 'report-energia', tipo: 'report', titolo: 'Consumo annuale e produzione' },
  { id: 'report-finanza', tipo: 'report', titolo: 'Analisi finanziaria dettagliata' },
  { id: 'report-cashflow', tipo: 'report', titolo: 'Flusso di cassa annuale' },
  { id: 'report-mensile', tipo: 'report', titolo: 'Energia mensile stimata' },
] as const

export type TipoPaginaPremium =
  (typeof REGISTRO_PAGINE_PREMIUM)[number]['tipo'] | 'tecnica'

export interface PaginaTecnicaPremium {
  readonly id: string
  readonly titolo: string
  readonly documentoId: string
  readonly paginaDocumento: number
}

export type PaginaPianoPremium =
  | (typeof REGISTRO_PAGINE_PREMIUM)[number]
  | (PaginaTecnicaPremium & { readonly tipo: 'tecnica' })

export function creaPianoPaginePremium(
  documentiTecnici: readonly PaginaTecnicaPremium[],
): readonly PaginaPianoPremium[] {
  return [
    ...REGISTRO_PAGINE_PREMIUM,
    ...documentiTecnici.map((pagina) => ({ ...pagina, tipo: 'tecnica' as const })),
  ]
}
