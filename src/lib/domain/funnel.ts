/**
 * Metriche commerciali: imbuto, conversioni, tempi, valori.
 *
 * Due scelte determinano se questi numeri sono affidabili o solo verosimili.
 *
 * **1. Si ragiona per coorte, non per periodo.**
 * «Conversione = contratti di agosto / lead di agosto» è sbagliato quando il
 * ciclo dura quaranta giorni: si dividono contratti nati da lead di giugno per
 * i lead di agosto. Qui si prende un insieme di lead *entrati* in un periodo e
 * si segue **quello stesso insieme** fino in fondo.
 *
 * **2. L'imbuto è monotòno.**
 * Chi arriva a una tappa è passato per quelle prima, anche se qualcuno si è
 * dimenticato di registrarne una. Senza questa regola si ottengono conversioni
 * sopra il 100%, che fanno perdere fiducia in tutto il cruscotto.
 */

export interface PraticaCommerciale {
  readonly id: string
  readonly creatoIl: Date
  readonly primaRispostaIl: Date | null
  readonly sopralluogoFissatoIl: Date | null
  readonly sopralluogoEffettuatoIl: Date | null
  readonly preventivoInviatoIl: Date | null
  readonly contrattoFirmatoIl: Date | null
  readonly persoIl: Date | null
  readonly motivoPerdita: string | null
  /** Centesimi di euro. */
  readonly valorePreventivo: number | null
  readonly valoreContratto: number | null
  readonly fonte: string | null
  readonly commerciale: string | null
  readonly lineaBusiness: string
}

/* -------------------------------------------------------------------------- */
/*  Utilità statistiche                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Percentuale in centesimi di punto (2550 = 25,50%).
 *
 * Restituisce `null` su denominatore zero: non è «zero per cento», è una
 * percentuale che non esiste. Mostrare 0% dove non c'è nulla da dividere fa
 * sembrare pessimo un periodo semplicemente vuoto.
 */
export function percentuale(numeratore: number, denominatore: number): number | null {
  if (denominatore === 0) return null
  return Math.round((numeratore / denominatore) * 10_000)
}

/**
 * Mediana, non media.
 *
 * Una pratica dimenticata per due mesi sposta la media e nasconde il
 * comportamento normale. La mediana descrive il caso tipico, che è quello su
 * cui si può intervenire.
 */
export function mediana(valori: readonly number[]): number | null {
  if (valori.length === 0) return null
  const ordinati = [...valori].sort((a, b) => a - b)
  const mezzo = Math.floor(ordinati.length / 2)
  if (ordinati.length % 2 === 1) return ordinati[mezzo]!
  return Math.round((ordinati[mezzo - 1]! + ordinati[mezzo]!) / 2)
}

const GIORNO = 86_400_000

/** Giorni interi fra due istanti, mai negativi. */
export function giorniFra(da: Date | null, a: Date | null): number | null {
  if (da === null || a === null) return null
  return Math.max(0, Math.floor((a.getTime() - da.getTime()) / GIORNO))
}

/** Ore con un decimale, per lo speed-to-lead che si misura in ore, non giorni. */
export function oreFra(da: Date | null, a: Date | null): number | null {
  if (da === null || a === null) return null
  return Math.max(0, Math.round(((a.getTime() - da.getTime()) / 3_600_000) * 10) / 10)
}

/* -------------------------------------------------------------------------- */
/*  Imbuto                                                                     */
/* -------------------------------------------------------------------------- */

export type CodiceTappa =
  | 'lead'
  | 'contattato'
  | 'sopralluogo_fissato'
  | 'sopralluogo_effettuato'
  | 'preventivo_inviato'
  | 'contratto'

export interface TappaFunnel {
  readonly codice: CodiceTappa
  readonly etichetta: string
  readonly conteggio: number
  /** Centesimi di punto rispetto alla tappa precedente. Null se non calcolabile. */
  readonly daPrecedente: number | null
  /** Centesimi di punto rispetto ai lead iniziali. */
  readonly daLead: number | null
}

const ETICHETTE: Record<CodiceTappa, string> = {
  lead: 'Lead ricevuti',
  contattato: 'Contattati',
  sopralluogo_fissato: 'Sopralluoghi fissati',
  sopralluogo_effettuato: 'Sopralluoghi effettuati',
  preventivo_inviato: 'Preventivi inviati',
  contratto: 'Contratti firmati',
}

/**
 * Fino a che tappa è arrivata una pratica.
 *
 * L'ordine è quello dell'imbuto: si guarda dal fondo verso l'alto, così una
 * tappa saltata nella registrazione non spezza la sequenza.
 */
function tappaRaggiunta(p: PraticaCommerciale): CodiceTappa {
  if (p.contrattoFirmatoIl) return 'contratto'
  if (p.preventivoInviatoIl) return 'preventivo_inviato'
  if (p.sopralluogoEffettuatoIl) return 'sopralluogo_effettuato'
  if (p.sopralluogoFissatoIl) return 'sopralluogo_fissato'
  if (p.primaRispostaIl) return 'contattato'
  return 'lead'
}

const ORDINE: readonly CodiceTappa[] = [
  'lead',
  'contattato',
  'sopralluogo_fissato',
  'sopralluogo_effettuato',
  'preventivo_inviato',
  'contratto',
]

export function calcolaImbuto(pratiche: readonly PraticaCommerciale[]): TappaFunnel[] {
  const posizione = new Map(ORDINE.map((c, i) => [c, i]))
  const raggiunte = pratiche.map((p) => posizione.get(tappaRaggiunta(p)) ?? 0)
  const totaleLead = pratiche.length

  let precedente: number | null = null

  return ORDINE.map((codice, indice) => {
    // Monotòno: chi è più avanti conta anche qui.
    const conteggio = raggiunte.filter((r) => r >= indice).length
    const tappa: TappaFunnel = {
      codice,
      etichetta: ETICHETTE[codice],
      conteggio,
      daPrecedente: precedente === null ? null : percentuale(conteggio, precedente),
      daLead: percentuale(conteggio, totaleLead),
    }
    precedente = conteggio
    return tappa
  })
}

/* -------------------------------------------------------------------------- */
/*  Tempi                                                                      */
/* -------------------------------------------------------------------------- */

export interface TempiMediani {
  /** Ore fra arrivo del lead e prima risposta. */
  readonly speedToLeadOre: number | null
  readonly leadASopralluogoGiorni: number | null
  readonly sopralluogoAPreventivoGiorni: number | null
  readonly preventivoAFirmaGiorni: number | null
  /** Ciclo completo: dal lead al contratto. */
  readonly cicloCompletoGiorni: number | null
}

export function calcolaTempi(pratiche: readonly PraticaCommerciale[]): TempiMediani {
  const raccogli = (f: (p: PraticaCommerciale) => number | null): number[] =>
    pratiche.map(f).filter((v): v is number => v !== null)

  return {
    speedToLeadOre: mediana(raccogli((p) => oreFra(p.creatoIl, p.primaRispostaIl))),
    leadASopralluogoGiorni: mediana(
      raccogli((p) => giorniFra(p.creatoIl, p.sopralluogoEffettuatoIl)),
    ),
    sopralluogoAPreventivoGiorni: mediana(
      raccogli((p) => giorniFra(p.sopralluogoEffettuatoIl, p.preventivoInviatoIl)),
    ),
    preventivoAFirmaGiorni: mediana(
      raccogli((p) => giorniFra(p.preventivoInviatoIl, p.contrattoFirmatoIl)),
    ),
    cicloCompletoGiorni: mediana(
      raccogli((p) => giorniFra(p.creatoIl, p.contrattoFirmatoIl)),
    ),
  }
}

/* -------------------------------------------------------------------------- */
/*  Valori                                                                     */
/* -------------------------------------------------------------------------- */

export interface ValoriCommerciali {
  /** Centesimi. */
  readonly valorePreventiviInviati: number
  readonly valoreContratti: number
  readonly ticketMedio: number | null
  /** Valore delle pratiche ancora aperte. */
  readonly valoreInCorso: number
}

export function calcolaValori(
  pratiche: readonly PraticaCommerciale[],
): ValoriCommerciali {
  const conPreventivo = pratiche.filter((p) => p.preventivoInviatoIl !== null)
  const vinte = pratiche.filter((p) => p.contrattoFirmatoIl !== null)
  const aperte = pratiche.filter(
    (p) => p.contrattoFirmatoIl === null && p.persoIl === null,
  )

  const valoreContratti = vinte.reduce((s, p) => s + (p.valoreContratto ?? 0), 0)

  return {
    valorePreventiviInviati: conPreventivo.reduce(
      (s, p) => s + (p.valorePreventivo ?? 0),
      0,
    ),
    valoreContratti,
    ticketMedio: vinte.length === 0 ? null : Math.round(valoreContratti / vinte.length),
    valoreInCorso: aperte.reduce((s, p) => s + (p.valorePreventivo ?? 0), 0),
  }
}

/* -------------------------------------------------------------------------- */
/*  Ripartizioni                                                               */
/* -------------------------------------------------------------------------- */

export interface RigaRipartizione {
  readonly chiave: string
  readonly lead: number
  /** Sopralluoghi effettuati (chiusi) nella coorte. */
  readonly sopralluoghi: number
  /** Lead → sopralluogo, in centesimi di punto. */
  readonly tassoSopralluogo: number | null
  readonly contratti: number
  /** Lead → contratto (chiusura), in centesimi di punto. */
  readonly conversione: number | null
  /** Fatturato da contratti firmati, in centesimi di euro. */
  readonly valore: number
}

/**
 * Prestazioni di un insieme di pratiche (totale azienda o un commerciale).
 *
 * Stessa formula ovunque: altrimenti il totale e le ripartizioni divergono e
 * nessuno si fida più dei numeri.
 */
export function aggregaPrestazioni(
  pratiche: readonly PraticaCommerciale[],
  chiave: string,
): RigaRipartizione {
  const sopralluoghi = pratiche.filter((p) => p.sopralluogoEffettuatoIl !== null).length
  const vinte = pratiche.filter((p) => p.contrattoFirmatoIl !== null)
  return {
    chiave,
    lead: pratiche.length,
    sopralluoghi,
    tassoSopralluogo: percentuale(sopralluoghi, pratiche.length),
    contratti: vinte.length,
    conversione: percentuale(vinte.length, pratiche.length),
    valore: vinte.reduce((s, p) => s + (p.valoreContratto ?? 0), 0),
  }
}

/** Totale azienda sulla stessa coorte delle ripartizioni. */
export function totaleAzienda(
  pratiche: readonly PraticaCommerciale[],
): RigaRipartizione {
  return aggregaPrestazioni(pratiche, 'Totale azienda')
}

/** Raggruppa per una dimensione qualsiasi: fonte, commerciale, linea. */
export function ripartisci(
  pratiche: readonly PraticaCommerciale[],
  chiave: (p: PraticaCommerciale) => string | null,
  etichettaVuota = 'Non indicata',
): RigaRipartizione[] {
  const gruppi = new Map<string, PraticaCommerciale[]>()

  for (const p of pratiche) {
    const k = chiave(p) ?? etichettaVuota
    gruppi.set(k, [...(gruppi.get(k) ?? []), p])
  }

  return [...gruppi.entries()]
    .map(([k, elenco]) => aggregaPrestazioni(elenco, k))
    // Prima chi porta più fatturato: è l'ordine in cui si prendono le decisioni.
    .sort((a, b) => b.valore - a.valore || b.lead - a.lead)
}

export interface MotivoPerdita {
  readonly motivo: string
  readonly conteggio: number
  readonly quota: number | null
  /** Valore che si è perso con quel motivo. */
  readonly valorePerso: number
}

export function motiviDiPerdita(
  pratiche: readonly PraticaCommerciale[],
): MotivoPerdita[] {
  const perse = pratiche.filter((p) => p.persoIl !== null)
  const gruppi = new Map<string, PraticaCommerciale[]>()

  for (const p of perse) {
    const k = p.motivoPerdita?.trim() || 'Non indicato'
    gruppi.set(k, [...(gruppi.get(k) ?? []), p])
  }

  return [...gruppi.entries()]
    .map(([motivo, elenco]) => ({
      motivo,
      conteggio: elenco.length,
      quota: percentuale(elenco.length, perse.length),
      valorePerso: elenco.reduce((s, p) => s + (p.valorePreventivo ?? 0), 0),
    }))
    .sort((a, b) => b.conteggio - a.conteggio)
}

/* -------------------------------------------------------------------------- */
/*  Maturità della coorte                                                      */
/* -------------------------------------------------------------------------- */

export interface MaturitaCoorte {
  readonly totale: number
  readonly concluse: number
  readonly ancoraAperte: number
  /** Centesimi di punto: quanta parte della coorte ha già un esito. */
  readonly quotaConclusa: number | null
}

/**
 * Quanto è affidabile la conversione di questa coorte.
 *
 * Una coorte recente sembra sempre pessima: molti lead non hanno ancora avuto
 * il tempo di diventare contratti. Mostrare questo dato accanto alla
 * conversione evita la lettura sbagliata più comune di tutte.
 */
export function calcolaMaturita(
  pratiche: readonly PraticaCommerciale[],
): MaturitaCoorte {
  const concluse = pratiche.filter(
    (p) => p.contrattoFirmatoIl !== null || p.persoIl !== null,
  ).length

  return {
    totale: pratiche.length,
    concluse,
    ancoraAperte: pratiche.length - concluse,
    quotaConclusa: percentuale(concluse, pratiche.length),
  }
}

/* -------------------------------------------------------------------------- */
/*  Formattazione                                                              */
/* -------------------------------------------------------------------------- */

export function formattaPercentuale(basisPoint: number | null): string {
  if (basisPoint === null) return '—'
  return `${(basisPoint / 100).toFixed(1)}%`
}

export function formattaGiorni(valore: number | null): string {
  if (valore === null) return '—'
  return `${valore} ${valore === 1 ? 'giorno' : 'giorni'}`
}

export function formattaOre(valore: number | null): string {
  if (valore === null) return '—'
  if (valore < 1) return `${Math.round(valore * 60)} min`
  if (valore < 48) return `${valore.toFixed(1)} h`
  return `${Math.round(valore / 24)} giorni`
}
