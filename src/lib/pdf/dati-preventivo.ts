import { formattaImporto } from '@/lib/domain/money'

/**
 * Dati già formattati per il PDF cliente.
 *
 * Nessun costo, nessun margine: questo DTO è ciò che esce dall'azienda.
 */

export interface RigaPdfPreventivo {
  readonly descrizione: string
  readonly quantita: string
  readonly unita: string
  readonly prezzoUnitario: string
  readonly scontoPct: string | null
  readonly ivaPct: string
  readonly importo: string
}

export interface RipartizioneIvaPdf {
  readonly etichetta: string
  readonly imponibile: string
  readonly imposta: string
}

/** KPI copertina allineati ai preventivi commerciali EcoSolare. */
export interface CopertinaKpiPdf {
  readonly moduli: number
  readonly kWp: string
  /** Produzione annua in MWh (es. "7,89"). */
  readonly produzioneMwh: string
  /** Consumo annuo in MWh, o null se non rilevante. */
  readonly consumoMwh: string | null
}

export interface FaldaPdf {
  readonly etichetta: string
  readonly inclinazione: string
  readonly esposizione: string
  readonly area: string | null
}

/** §1 dettagli impianto + regime incentivante (testi da simulazione). */
export interface DettagliImpiantoPdf {
  readonly composizione: string
  readonly potenzaKwp: string
  readonly produzioneKwh: string
  readonly resaSpecifica: string | null
  readonly consumoKwh: string | null
  readonly falde: readonly FaldaPdf[]
  readonly regimeRid: string
  readonly detrazioneSintesi: string
}

export interface CondizioniEconomichePdf {
  readonly totaleLordo: string
  readonly detrazionePct: string
  readonly detrazioneImporto: string
  readonly nettoIndicativo: string
  readonly bollettaAttualeMensile: string
  readonly bollettaConFvMensile: string
  readonly risparmioMensile: string
  readonly risparmioAnnuo: string
  readonly paybackAnni: string | null
  readonly notePagamento: string
}

export interface FlussoEnergiaPdf {
  readonly produzione: string
  readonly autoconsumo: string
  readonly exportRete: string
  readonly daRete: string
}

export interface RigaCashflowPdf {
  readonly anno: string
  readonly risparmio: string
  readonly detrazione: string
  readonly flusso: string
}

export interface SimulazionePdf {
  readonly tariffe: string
  readonly flussi: FlussoEnergiaPdf
  readonly npv: string
  readonly paybackAnni: string | null
  /** Prime righe del cashflow (il resto si omette per leggibilità). */
  readonly cashflow: readonly RigaCashflowPdf[]
  readonly orizzonteAnni: number
}

export interface BloccoTermicoPdf {
  readonly tipoEtichetta: string
  readonly descrizione: string
  readonly prezzoLordo: string
  readonly detrazionePct: string
  readonly detrazioneImporto: string
  readonly contoTermico: string | null
  readonly nettoIndicativo: string
}

export interface DossierTestualePdf {
  readonly incluso: readonly string[]
  readonly escluso: readonly string[]
  readonly garanzie: readonly { readonly titolo: string; readonly punti: readonly string[] }[]
  readonly notaGaranzia: string
}

export interface PlanimetriaPdfDto {
  readonly viewBox: string
  readonly poligoniPaths: readonly string[]
  readonly moduliPaths: readonly string[]
  readonly legenda: string
  /**
   * Ortofoto satellitare (data-URI) con moduli proiettati in pixel.
   * null = solo schema geometrico (fallback senza Static Maps).
   */
  readonly fotoDataUri: string | null
  readonly fotoPixelW?: number
  readonly fotoPixelH?: number
}

export interface DatiPdfPreventivo {
  readonly codice: string
  readonly titolo: string
  readonly versione: number
  readonly dataDocumento: string
  readonly validita: string | null
  readonly clienteNome: string
  readonly aziendaCliente: string | null
  readonly immobileEtichetta: string | null
  readonly immobileIndirizzo: string | null
  readonly copertinaKpi: CopertinaKpiPdf | null
  readonly dettagliImpianto: DettagliImpiantoPdf | null
  readonly condizioniEconomiche: CondizioniEconomichePdf | null
  readonly bloccoTermico: BloccoTermicoPdf | null
  readonly dossierTestuale: DossierTestualePdf
  readonly planimetria: PlanimetriaPdfDto | null
  readonly simulazione: SimulazionePdf | null
  /** Data-URI PNG delle pagine marketing (ordine di stampa). */
  readonly pagineMarketing: readonly string[]
  readonly righe: readonly RigaPdfPreventivo[]
  readonly scontoGlobalePct: string | null
  readonly imponibile: string
  readonly ripartizioneIva: readonly RipartizioneIvaPdf[]
  readonly totaleIva: string
  readonly totaleLordo: string
  readonly note: string | null
}

/** Nome file sicuro per Content-Disposition. */
export function nomeFilePreventivo(codice: string, versione: number): string {
  const pulito = codice.replace(/[^A-Za-z0-9._-]+/g, '-')
  return `Preventivo-${pulito}-v${versione}.pdf`
}

/** Da stringa numerica DB (es. "1234.56") a euro formattato. */
export function formattaEuroDb(valore: string | number): string {
  const numero = typeof valore === 'number' ? valore : Number.parseFloat(valore)
  if (!Number.isFinite(numero)) return formattaImporto(0)
  return formattaImporto(Math.round(numero * 100))
}

export function formattaPrezzoUnitario(valore: string | number): string {
  const numero = typeof valore === 'number' ? valore : Number.parseFloat(valore)
  if (!Number.isFinite(numero)) return '€ 0,00'
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
    useGrouping: true,
  }).format(numero)
}

export function formattaQuantita(valore: string | number): string {
  const numero = typeof valore === 'number' ? valore : Number.parseFloat(valore)
  if (!Number.isFinite(numero)) return '0'
  return new Intl.NumberFormat('it-IT', {
    maximumFractionDigits: 3,
  }).format(numero)
}

export function formattaDataIt(data: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(data)
}
