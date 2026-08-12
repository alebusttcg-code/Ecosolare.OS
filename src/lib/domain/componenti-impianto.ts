/**
 * La configurazione dell'impianto, letta dalle righe del preventivo.
 *
 * È il pezzo che rende il documento davvero calcolato invece che raccontato:
 * una batteria da 5 kWh e una da 10 kWh devono produrre due preventivi con
 * numeri diversi, e finché la capacità vive dentro la descrizione — «Batteria
 * di accumulo 10 kWh» — nessun calcolo può leggerla.
 *
 * Da qui in avanti vale una regola sola: **i numeri vengono dalle righe, lo
 * stile no.** Aggiungere un prodotto al listino cambia le cifre del PDF senza
 * toccare una riga di impaginazione.
 *
 * Modulo puro: riceve righe già lette dal database e restituisce una
 * configurazione. Nessuna query, nessun formato, nessun euro.
 */

export type RuoloComponente =
  | 'modulo'
  | 'inverter'
  | 'accumulo'
  | 'struttura'
  | 'quadro'
  | 'pompa_calore'
  | 'altro'

/** Una riga di preventivo, ridotta a ciò che serve per capire l'impianto. */
export interface RigaComponente {
  readonly descrizione: string
  readonly quantita: number
  readonly ruolo: RuoloComponente | null
  readonly potenzaModuloW: number | null
  readonly potenzaCaKw: number | null
  readonly capacitaKwh: number | null
  readonly marca: string | null
  readonly modello: string | null
}

export interface ComponenteDescritto {
  readonly quantita: number
  readonly marca: string | null
  readonly modello: string | null
  readonly descrizione: string
}

export interface ConfigurazioneImpianto {
  readonly moduli: number
  /** Potenza di picco del singolo modulo, se tutti uguali. */
  readonly wattPicco: number | null
  /** Potenza complessiva in continua, kWp. */
  readonly potenzaKwp: number
  /** Somma delle potenze nominali in alternata degli inverter, kW. */
  readonly potenzaCaKw: number | null
  /** Capacità complessiva di accumulo, kWh. */
  readonly capacitaAccumuloKwh: number
  readonly haAccumulo: boolean
  readonly haPompaCalore: boolean

  readonly moduliDescritti: readonly ComponenteDescritto[]
  readonly inverterDescritti: readonly ComponenteDescritto[]
  readonly accumuliDescritti: readonly ComponenteDescritto[]
  readonly struttureDescritte: readonly ComponenteDescritto[]
  readonly quadriDescritti: readonly ComponenteDescritto[]
  readonly pompeCaloreDescritte: readonly ComponenteDescritto[]
}

function numero(valore: number | null | undefined): number {
  return Number.isFinite(valore) && valore !== null && valore !== undefined ? valore : 0
}

/**
 * Deduce il ruolo quando il prodotto non lo dichiara.
 *
 * Serve per il catalogo già esistente, dove nessuna riga ha il ruolo
 * compilato: senza questo ripiego, ogni preventivo fatto finora perderebbe di
 * colpo potenza e accumulo. **Non è la soluzione**, è il ponte finché il
 * catalogo non viene completato — e per questo è deliberatamente prudente:
 * riconosce solo ciò che è inequivocabile e lascia `altro` in tutti gli altri
 * casi, perché una deduzione sbagliata è peggio di una deduzione mancata.
 */
export function deduciRuolo(descrizione: string): RuoloComponente | null {
  const testo = descrizione.toLowerCase()

  if (/\bmodul[oi]\b|\bpannell[oi]\b/.test(testo) && !/struttur|fissagg/.test(testo)) {
    return 'modulo'
  }
  if (/\binverter\b/.test(testo)) return 'inverter'
  if (/\bbatteri[ae]\b|\baccumul[oi]\b/.test(testo) && !/inerzial|acs|sanitari/.test(testo)) {
    return 'accumulo'
  }
  if (/pompa di calore/.test(testo)) return 'pompa_calore'
  if (/struttur|fissagg|staff/.test(testo)) return 'struttura'
  if (/quadr|sezionator|scaricator|centralin/.test(testo)) return 'quadro'

  return null
}

/**
 * Estrae un numero seguito da un'unità dalla descrizione.
 *
 * Ultimo ripiego per i prodotti senza dati tecnici: «Batteria di accumulo
 * 10 kWh» → 10. Funziona finché qualcuno non scrive la riga diversamente, ed è
 * esattamente il motivo per cui i campi strutturati esistono. Qui serve solo a
 * non perdere i preventivi già in archivio.
 */
export function estraiMisura(descrizione: string, unita: 'kWh' | 'kW' | 'W'): number | null {
  // `kW` non deve catturare il numero di «kWh», e `W` non deve catturare `kW`.
  const confine = unita === 'kW' ? '(?!h)' : unita === 'W' ? '(?<![kK])' : ''
  const espressione = new RegExp(
    `(\\d+(?:[.,]\\d+)?)\\s*${confine === '(?<![kK])' ? '' : ''}${unita}${unita === 'kW' ? '(?!h)' : ''}\\b`,
    'i',
  )
  const trovato = descrizione.match(espressione)
  if (!trovato?.[1]) return null

  // Per i Watt semplici va escluso il caso in cui la lettera prima è una «k».
  if (unita === 'W') {
    const posizione = trovato.index ?? 0
    const frammento = descrizione.slice(posizione, posizione + trovato[0].length)
    if (/k\s*W/i.test(frammento)) return null
  }

  const valore = Number.parseFloat(trovato[1].replace(',', '.'))
  return Number.isFinite(valore) && valore > 0 ? valore : null
}

/** Normalizza una riga: usa i dati strutturati, e solo in loro assenza deduce. */
export function normalizzaRiga(riga: RigaComponente): RigaComponente {
  const ruolo = riga.ruolo ?? deduciRuolo(riga.descrizione)

  return {
    ...riga,
    ruolo,
    potenzaModuloW:
      riga.potenzaModuloW ??
      (ruolo === 'modulo' ? estraiMisura(riga.descrizione, 'W') : null),
    potenzaCaKw:
      riga.potenzaCaKw ??
      (ruolo === 'inverter' ? estraiMisura(riga.descrizione, 'kW') : null),
    capacitaKwh:
      riga.capacitaKwh ??
      (ruolo === 'accumulo' ? estraiMisura(riga.descrizione, 'kWh') : null),
  }
}

function descrivi(riga: RigaComponente): ComponenteDescritto {
  return {
    quantita: riga.quantita,
    marca: riga.marca,
    modello: riga.modello,
    descrizione: riga.descrizione,
  }
}

export function leggiConfigurazione(
  righe: readonly RigaComponente[],
): ConfigurazioneImpianto {
  const normalizzate = righe.map(normalizzaRiga)

  const moduli = normalizzate.filter((r) => r.ruolo === 'modulo')
  const inverter = normalizzate.filter((r) => r.ruolo === 'inverter')
  const accumuli = normalizzate.filter((r) => r.ruolo === 'accumulo')
  const strutture = normalizzate.filter((r) => r.ruolo === 'struttura')
  const quadri = normalizzate.filter((r) => r.ruolo === 'quadro')
  const pompeCalore = normalizzate.filter((r) => r.ruolo === 'pompa_calore')

  const numeroModuli = moduli.reduce((s, r) => s + numero(r.quantita), 0)

  // Watt di picco: solo se tutti i moduli sono dello stesso taglio. Con tagli
  // diversi una media sarebbe un numero che non corrisponde a nessun pannello
  // realmente installato, e finirebbe stampata sul preventivo.
  const tagli = new Set(
    moduli.map((r) => r.potenzaModuloW).filter((w): w is number => w !== null && w > 0),
  )
  const wattPicco = tagli.size === 1 ? [...tagli][0]! : null

  const potenzaKwp = moduli.reduce(
    (somma, r) => somma + (numero(r.potenzaModuloW) * numero(r.quantita)) / 1000,
    0,
  )

  const potenzaCa = inverter.reduce(
    (somma, r) => somma + numero(r.potenzaCaKw) * Math.max(1, numero(r.quantita)),
    0,
  )

  const capacita = accumuli.reduce(
    (somma, r) => somma + numero(r.capacitaKwh) * Math.max(1, numero(r.quantita)),
    0,
  )

  return {
    moduli: numeroModuli,
    wattPicco,
    potenzaKwp,
    potenzaCaKw: potenzaCa > 0 ? potenzaCa : null,
    capacitaAccumuloKwh: capacita,
    haAccumulo: capacita > 0,
    haPompaCalore: normalizzate.some((r) => r.ruolo === 'pompa_calore'),
    moduliDescritti: moduli.map(descrivi),
    inverterDescritti: inverter.map(descrivi),
    accumuliDescritti: accumuli.map(descrivi),
    struttureDescritte: strutture.map(descrivi),
    quadriDescritti: quadri.map(descrivi),
    pompeCaloreDescritte: pompeCalore.map(descrivi),
  }
}

/**
 * Come si nomina un componente nella narrativa tecnica.
 *
 * «N. 12 Pannelli FV Viessmann Vitovolt 500 Wp» quando marca e modello ci
 * sono; la descrizione del listino quando non ci sono. **Mai inventare una
 * marca**: un preventivo che promette Viessmann e installa altro è un problema
 * che non si risolve con una nota a piè di pagina.
 */
export function nomeComponente(componente: ComponenteDescritto): string {
  const marchio = [componente.marca, componente.modello].filter(Boolean).join(' ')
  return marchio || componente.descrizione
}

/**
 * Il pezzo di frase che dice quanti sono e di cosa si tratta.
 *
 * Con marca e modello si scrive come lo scriverebbe un commerciale:
 * «12 moduli Viessmann Vitovolt 500». Senza, resta solo la descrizione del
 * listino — che è già una locuzione compiuta, «Modulo fotovoltaico 450 W» o
 * «Batteria di accumulo 10 kWh» — e anteporle il sostantivo produce «5 moduli
 * Modulo fotovoltaico 450 W»: come lo scriverebbe una macchina. In quel caso
 * si usa «5 × Modulo fotovoltaico 450 W», che non ripete niente e regge
 * qualunque parola scelga il catalogo.
 *
 * Non è un dettaglio di stile: finché il catalogo non ha marca e modello su
 * ogni prodotto — e all'inizio non li ha — è **questo** il testo che il cliente
 * si trova in mano.
 */
export function quantitaEComponente(
  quantita: number,
  sostantivo: { readonly uno: string; readonly molti: string },
  componente: ComponenteDescritto,
): string {
  const numero = quantita.toLocaleString('it-IT')
  const marchio = [componente.marca, componente.modello].filter(Boolean).join(' ')
  if (!marchio) return `${numero} × ${componente.descrizione}`
  return `${numero} ${quantita === 1 ? sostantivo.uno : sostantivo.molti} ${marchio}`
}
