/**
 * Stima di producibilità FV sito-specifica (motore interno EcoSolare).
 *
 * Non replica SolarEdge Designer: usa latitudine, inclinazione, esposizione e
 * (se disponibile) irraggiamento relativo Solar per differenziare i casi
 * cliente. La resa non è più una costante unica.
 */

export type InputProduzioneFalda = {
  readonly kWp: number
  readonly latitudine: number
  readonly pitchDegrees: number
  readonly azimuthDegrees: number
  /** Media sunshine della falda (quantili Solar), se nota. */
  readonly sunshineMedio?: number | null
  /** Ore di sole della falda meno ombreggiata del tetto: è il riferimento. */
  readonly sunshineMigliore?: number | null
}

export type RisultatoProduzioneFalda = {
  readonly produzioneKwh: number
  readonly resaSpecificaKwhKwp: number
  /** Resa al punto ottimo per quella latitudine, prima dell'orientamento. */
  readonly resaBaseKwhKwp: number
  /** Quanto rende questa giacitura rispetto al punto ottimo, in [0, 1]. */
  readonly fattoreOrientamento: number
  /** Quanto perde per l'ombra rispetto alla falda migliore, in [0,5, 1]. */
  readonly fattoreOmbra: number
}

/**
 * Resa specifica al **punto ottimo** per la latitudine (kWh/kWp·anno).
 *
 * Il livello è ancorato ai tre dossier di riferimento: con il fattore di
 * orientamento qui sotto, Riboldi, Ricci e Tarantola implicano 1.476, 1.429 e
 * 1.432 kWh/kWp al punto ottimo — tre tetti diversi, un solo numero, scarto
 * massimo 2,1%. La media è 1.446, che a 45°N è il valore di questa formula.
 *
 * È più alto dei ~1.350 che PVGIS dà per Milano perché **EcoSolare installa
 * moduli bifacciali**, che rendono il 5–10% in più. Se un giorno si vendessero
 * monofacciali, questo livello va abbassato di altrettanto: è una proprietà
 * degli impianti che facciamo, non della latitudine.
 *
 * La pendenza (−35 per grado) non è tarata sui dossier — stanno tutti fra 44,8
 * e 45,2°N, non c'è nessuna escursione su cui tarare — ma tenuta dal modello
 * precedente perché coerente con l'escursione nord-sud italiana (~350 kWh/kWp
 * fra Milano e Palermo).
 */
export function resaBaseDaLatitudine(latitudine: number): number {
  const lat = Math.min(47.5, Math.max(36.5, latitudine))
  return Math.round(3021 - lat * 35)
}

/**
 * Quanto rende una giacitura rispetto al punto ottimo.
 *
 * ## Perché una tabella e non due fattori moltiplicati
 *
 * Il modello precedente moltiplicava un fattore di esposizione per uno di
 * inclinazione, come se fossero indipendenti. **Non lo sono.** Su un tetto
 * piano l'esposizione non conta nulla — il piano dei moduli è orizzontale,
 * verso dove «guarda» la falda è irrilevante — mentre su una parete verticale
 * conta moltissimo. Un modello separabile non può dire entrambe le cose.
 *
 * Il costo di quell'errore era misurabile sui casi di taratura: Tarantola,
 * falda di 7° esposta a sud-ovest, si prendeva una penalità di orientamento del
 * 20% che su un tetto quasi piano non esiste. Il modello sottostimava i tre
 * dossier del 21%, 23% e 34% — e nessun test se n'era accorto, perché
 * verificavano solo che il sud rendesse più del nord.
 *
 * ## La tabella
 *
 * Righe: inclinazione della falda. Colonne: scostamento dell'esposizione da sud.
 * I valori sono l'irraggiamento annuo sul piano dei moduli rispetto al punto
 * ottimo, per l'Italia settentrionale. Fra i nodi si interpola linearmente.
 *
 * Due proprietà da non perdere se qualcuno la ritocca:
 *
 *  - la riga a 0° è **costante**: un tetto piano rende uguale in ogni
 *    direzione, e questo è fisica, non taratura;
 *  - lungo ogni riga i valori non crescono mai allontanandosi da sud.
 */
const INCLINAZIONI = [0, 15, 30, 45, 60, 90] as const
const SCOSTAMENTI = [0, 30, 60, 90, 120, 150, 180] as const

const RESA_RELATIVA: readonly (readonly number[])[] = [
  [0.89, 0.89, 0.89, 0.89, 0.89, 0.89, 0.89],
  [0.97, 0.96, 0.94, 0.90, 0.86, 0.83, 0.82],
  [1.0, 0.99, 0.94, 0.86, 0.77, 0.7, 0.67],
  [0.98, 0.96, 0.9, 0.79, 0.67, 0.58, 0.54],
  [0.92, 0.9, 0.83, 0.7, 0.56, 0.46, 0.41],
  [0.7, 0.68, 0.61, 0.49, 0.36, 0.27, 0.23],
]

/** Di quanto una falda guarda lontano da sud, in gradi [0, 180]. */
export function scostamentoDaSud(azimuthDegrees: number): number {
  const az = ((azimuthDegrees % 360) + 360) % 360
  const delta = Math.abs(az - 180)
  return Math.min(delta, 360 - delta)
}

/** Indice del nodo immediatamente sotto il valore, senza uscire dalla tabella. */
function nodoInferiore(nodi: readonly number[], valore: number): number {
  for (let i = nodi.length - 2; i >= 0; i -= 1) {
    if (valore >= nodi[i]!) return i
  }
  return 0
}

export function fattoreOrientamento(
  pitchDegrees: number,
  azimuthDegrees: number,
): number {
  const pitch = Math.min(90, Math.max(0, pitchDegrees))
  const scostamento = scostamentoDaSud(azimuthDegrees)

  const i = nodoInferiore(INCLINAZIONI, pitch)
  const j = nodoInferiore(SCOSTAMENTI, scostamento)

  const pesoPitch =
    (pitch - INCLINAZIONI[i]!) / (INCLINAZIONI[i + 1]! - INCLINAZIONI[i]!)
  const pesoScostamento =
    (scostamento - SCOSTAMENTI[j]!) / (SCOSTAMENTI[j + 1]! - SCOSTAMENTI[j]!)

  const sopra =
    RESA_RELATIVA[i]![j]! * (1 - pesoScostamento) +
    RESA_RELATIVA[i]![j + 1]! * pesoScostamento
  const sotto =
    RESA_RELATIVA[i + 1]![j]! * (1 - pesoScostamento) +
    RESA_RELATIVA[i + 1]![j + 1]! * pesoScostamento

  return sopra * (1 - pesoPitch) + sotto * pesoPitch
}

/**
 * Quanto una falda è ombreggiata rispetto alla parte migliore del tetto.
 *
 * La Solar API di Google restituisce, per ogni falda, le **ore di sole
 * effettive all'anno**: incorporano l'ombra reale — l'albero, il palazzo di
 * fianco, il camino, il tetto stesso. È l'unica informazione che il nostro
 * modello geometrico non potrebbe mai dedurre da solo.
 *
 * Prima veniva quasi buttata. Il confronto era con la **media** delle falde e
 * limitato a ±12%, il che faceva due danni insieme: la falda migliore veniva
 * gonfiata del 12% e la peggiore scontata solo del 12%. Sullo studio reale in
 * archivio le ore vanno da 803 a 1.325 — un ventaglio del 39% — e uscivano
 * compresse in un quarto di quello.
 *
 * Ora il riferimento è la **falda migliore**, e questo non è un dettaglio: la
 * resa di base è tarata sui dossier dove il fattore valeva 1, quindi la parte
 * meno ombreggiata deve continuare a valere 1 o l'ancoraggio si sposta. Da lì
 * in giù si scende fino a metà, che è già una falda che nessuno dovrebbe
 * coprire di moduli.
 *
 * **Quello che questo non vede:** un edificio ombreggiato per intero — dietro
 * una collina, in un cortile stretto — ha tutte le falde basse insieme, quindi
 * il rapporto resta 1. Servirebbe un riferimento esterno di zona, e
 * `maxSunshineHoursPerYear` non lo è: è il massimo *puntuale* sul tetto, non
 * confrontabile con la media di una falda.
 */
const OMBRA_MINIMA = 0.5

export function fattoreOmbra(
  sunshineMedio: number | null | undefined,
  sunshineMigliore: number | null | undefined,
): number {
  if (
    sunshineMedio == null ||
    sunshineMigliore == null ||
    !(sunshineMigliore > 0) ||
    !(sunshineMedio > 0)
  ) {
    return 1
  }
  // Mai sopra 1: la falda migliore è il riferimento, nessuna può batterla.
  return Math.min(1, Math.max(OMBRA_MINIMA, sunshineMedio / sunshineMigliore))
}

export function stimaProduzioneFalda(
  input: InputProduzioneFalda,
): RisultatoProduzioneFalda {
  if (!(input.kWp > 0) || !Number.isFinite(input.latitudine)) {
    return {
      produzioneKwh: 0,
      resaSpecificaKwhKwp: 0,
      resaBaseKwhKwp: 0,
      fattoreOrientamento: 0,
      fattoreOmbra: 1,
    }
  }

  const resaBaseKwhKwp = resaBaseDaLatitudine(input.latitudine)
  const orientamento = fattoreOrientamento(
    input.pitchDegrees,
    input.azimuthDegrees,
  )
  const ombra = fattoreOmbra(input.sunshineMedio, input.sunshineMigliore)
  const resaSpecificaKwhKwp = Math.round(resaBaseKwhKwp * orientamento * ombra)

  return {
    produzioneKwh: Math.round(input.kWp * resaSpecificaKwhKwp),
    resaSpecificaKwhKwp,
    resaBaseKwhKwp,
    fattoreOrientamento: orientamento,
    fattoreOmbra: ombra,
  }
}

/**
 * Pesi stagionali relativi (Italia centro-nord) per ripartire un totale annuo
 * in 12 mesi. Non sono tariffe né valori normativi: solo forma del profilo.
 * Somma = 1.
 */
export const PESI_MENSILI_FV_ITALIA: readonly number[] = [
  0.041, 0.051, 0.082, 0.092, 0.112, 0.122, 0.133, 0.112, 0.092, 0.071, 0.051,
  0.041,
]

/** Giorni per mese, anno non bisestile: serve ai modelli mese per mese. */
export const GIORNI_MESE: readonly number[] = [
  31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
]

export const ETICHETTE_MESI_IT = [
  'Gen',
  'Feb',
  'Mar',
  'Apr',
  'Mag',
  'Giu',
  'Lug',
  'Ago',
  'Set',
  'Ott',
  'Nov',
  'Dic',
] as const

/** Ripartisce kWh annui sui 12 mesi; l’ultimo mese assorbe l’arrotondamento. */
export function distribuisciProduzioneMensile(
  produzioneAnnuakWh: number,
): number[] {
  if (!(produzioneAnnuakWh > 0) || !Number.isFinite(produzioneAnnuakWh)) {
    return Array.from({ length: 12 }, () => 0)
  }
  const out: number[] = []
  let somma = 0
  for (let i = 0; i < 11; i++) {
    const v = Math.round(produzioneAnnuakWh * PESI_MENSILI_FV_ITALIA[i]!)
    out.push(v)
    somma += v
  }
  out.push(Math.max(0, Math.round(produzioneAnnuakWh) - somma))
  return out
}
