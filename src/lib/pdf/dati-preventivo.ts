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
  /** Valori grezzi per grassetti e grafici. */
  readonly moduli: number
  readonly kWpNumero: number
  readonly produzioneKwhNumero: number
  readonly wattPicco: number | null
}

export interface CondizioniEconomichePdf {
  readonly totaleLordo: string
  readonly detrazioneEtichetta: string
  readonly detrazioneImporto: string | null
  readonly contoTermicoImporto: string | null
  readonly nettoIndicativo: string
  readonly bollettaAttualeMensile: string
  readonly bollettaConFvMensile: string
  readonly creditoMensile: string | null
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

/** Numeri per grafici stacked (kWh). */
export interface FlussiEnergiaNumPdf {
  readonly produzione: number
  readonly autoconsumo: number
  readonly exportRete: number
  readonly daRete: number
  readonly consumo: number
}

/** Un indicatore della scheda tecnica: icona, etichetta, numero, unità. */
export interface IndicatorePdf {
  readonly icona: string
  readonly etichetta: string
  readonly valore: string
  readonly unita: string
}

/** Voci finanziarie di sintesi, quelle che il cliente legge per prime. */
export interface KpiFinanziarioPdf {
  readonly etichetta: string
  readonly valore: string
  /** `beneficio` verde, `costo` arancio, `neutro` inchiostro. */
  readonly tono: 'beneficio' | 'costo' | 'neutro'
}

/** Risparmio sul riscaldamento, quando il preventivo comprende il termico. */
export interface TermicoPdf {
  readonly gasEvitatoSmc: string
  readonly costoGasEvitato: string
  readonly consumoElettricoAggiuntivo: string
  readonly costoElettricoAggiuntivo: string
  readonly risparmioAnnuo: string
  readonly incentivoEtichetta: string
  readonly incentivoImporto: string | null
  readonly notaIncentivo: string
}

export interface RigaCashflowPdf {
  readonly anno: string
  readonly risparmio: string
  readonly detrazione: string
  readonly flusso: string
  /** Risparmio sul riscaldamento nell'anno, o null se non c'è termico. */
  readonly risparmioTermico: string | null
  /** Rata del Conto Termico incassata nell'anno, o null. */
  readonly contoTermico: string | null
  /** Flusso netto in centesimi (grafico). */
  readonly flussoCents: number
}

/** Un punto della curva cumulata: è il grafico che mostra il rientro. */
export interface PuntoCumulatoPdf {
  readonly anno: number
  readonly cumulatoEur: number
}

export interface SimulazionePdf {
  readonly tariffe: string
  readonly flussi: FlussoEnergiaPdf
  readonly flussiNum: FlussiEnergiaNumPdf
  readonly produzioneMensileKwh: readonly number[]
  readonly npv: string
  readonly npvCents: number
  readonly paybackAnni: string | null
  readonly cashflow: readonly RigaCashflowPdf[]
  /** Tutto l'orizzonte, non solo i primi anni: serve al grafico del rientro. */
  readonly cumulato: readonly PuntoCumulatoPdf[]
  readonly indicatori: readonly IndicatorePdf[]
  readonly kpiFinanziari: readonly KpiFinanziarioPdf[]
  readonly termico: TermicoPdf | null
  readonly orizzonteAnni: number
}

export interface BloccoTermicoPdf {
  readonly tipoEtichetta: string
  readonly descrizione: string
  readonly prezzoLordo: string
  readonly incentivoEtichetta: string
  readonly incentivoImporto: string | null
  readonly notaIncentivo: string
  readonly nettoIndicativo: string
}

export interface SezioneTecnicaPdf {
  readonly titolo: string
  readonly voci: readonly string[]
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

export interface MittentePdf {
  readonly nome: string
  readonly ruolo: string | null
  readonly email: string | null
  readonly telefono: string | null
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
  readonly mittente: MittentePdf
  readonly copertinaKpi: CopertinaKpiPdf | null
  readonly dettagliImpianto: DettagliImpiantoPdf | null
  readonly condizioniEconomiche: CondizioniEconomichePdf | null
  readonly bloccoTermico: BloccoTermicoPdf | null
  readonly configurazioneTecnica: readonly SezioneTecnicaPdf[]
  readonly dossierTestuale: DossierTestualePdf
  readonly planimetria: PlanimetriaPdfDto | null
  readonly simulazione: SimulazionePdf | null
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
