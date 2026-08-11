/**
 * Il sistema di design del preventivo.
 *
 * Esiste perché il difetto del PDF precedente non era una pagina brutta: erano
 * quattordici pagine ciascuna con le proprie spaziature, i propri corpi di
 * testo e il proprio grigio. Da vicino ognuna sembrava a posto; sfogliandole
 * di fila si vedeva che nessuno le aveva pensate insieme.
 *
 * Qui ci sono le poche decisioni che valgono per tutte. Chi disegna una pagina
 * nuova pesca da questi valori e basta: **se un numero non è in questo file,
 * non deve comparire in un foglio di stile.**
 */

/* -------------------------------------------------------------------------- */
/*  Scala tipografica                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Sette corpi, non venti.
 *
 * Rapporto ≈ 1,25 fra un gradino e il successivo: abbastanza da distinguere una
 * gerarchia a colpo d'occhio, abbastanza poco da non sembrare un volantino.
 * I due estremi servono ai numeri protagonisti e alle didascalie legali.
 */
export const TESTO = {
  /** Il numero che deve restare in mente: potenza, risparmio, payback. */
  cifra: 26,
  /** Titolo di pagina. */
  titolo: 17,
  /** Intestazione di sezione. */
  sezione: 11,
  /** Numero dentro una tessera KPI. */
  kpi: 15,
  /** Corpo del testo. */
  corpo: 9,
  /** Etichette, celle di tabella, legende. */
  minuto: 7.5,
  /** Note legali, fonti, disclaimer. */
  nota: 6.5,
} as const

/**
 * Interlinea per corpo di testo.
 *
 * 1,45 su un corpo da 9 pt: sotto 1,4 i paragrafi di sei righe diventano un
 * blocco compatto che nessuno legge; sopra 1,5 il testo si sfalda.
 */
export const INTERLINEA = {
  stretta: 1.25,
  normale: 1.45,
  larga: 1.6,
} as const

/**
 * Spaziatura fra lettere.
 *
 * Positiva solo sulle maiuscole: un titolo tutto maiuscolo senza respiro fra
 * le lettere si legge peggio, ed è esattamente dove le usiamo.
 */
export const TRACKING = {
  maiuscolo: 0.8,
  cifra: -0.3,
  normale: 0,
} as const

export const PESO = {
  normale: 400,
  medio: 500,
  forte: 700,
} as const

/* -------------------------------------------------------------------------- */
/*  Spaziature                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Scala a passo 4, con due salti volutamente grandi in cima.
 *
 * Il vuoto fra due sezioni deve essere **visibilmente** diverso dal vuoto fra
 * due righe della stessa sezione: se i due valori si somigliano, il lettore non
 * capisce dove finisce un discorso e ne comincia un altro. Da qui `sezione: 22`
 * contro `elemento: 8`.
 */
export const SPAZIO = {
  nulla: 0,
  filo: 2,
  minimo: 4,
  elemento: 8,
  gruppo: 12,
  blocco: 16,
  sezione: 22,
  respiro: 32,
} as const

/** Margini di pagina A4. Larghi ai lati, generosi in alto. */
export const PAGINA = {
  larghezza: 595.28,
  altezza: 841.89,
  margineOrizzontale: 42,
  margineSuperiore: 38,
  margineInferiore: 54,
} as const

/** Larghezza utile del contenuto: tutto si allinea a questa. */
export const COLONNA = PAGINA.larghezza - PAGINA.margineOrizzontale * 2

export const RAGGIO = {
  minimo: 3,
  normale: 5,
  grande: 8,
} as const

/* -------------------------------------------------------------------------- */
/*  Colore                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * I colori per **ruolo**, non per nome.
 *
 * Chi scrive una pagina non deve chiedersi «quale blu»: chiede il colore di
 * ciò che sta rappresentando. È l'unica difesa contro il verde che significa
 * risparmio in una pagina e produzione in quella dopo.
 *
 * Regola fissa, valida ovunque:
 *   verde = beneficio · arancio = costo o prelievo · blu = energia · oro = accento
 */
export const COLORE = {
  carta: '#ffffff',
  cartaSoft: '#f7f9fc',
  cartaTenue: '#eef3f9',

  inchiostro: '#1a2332',
  inchiostroMedio: '#41506b',
  inchiostroMorbido: '#6b7891',
  inchiostroTenue: '#94a1b5',

  linea: '#dde4ee',
  lineaForte: '#c2cddd',

  blu: '#3f7fc4',
  bluScuro: '#2a5f9e',
  bluTenue: '#e8f0fa',

  oro: '#d9a441',
  oroTenue: '#fbf3e2',

  /** Beneficio: risparmio, autoconsumo, flusso positivo. */
  verde: '#2f9e6b',
  verdeTenue: '#e6f4ee',
  /** Costo o dipendenza dalla rete. */
  arancio: '#e07a3d',
  arancioTenue: '#fdefe5',
  /** Energia ceduta. */
  teal: '#2a9d8f',
  tealTenue: '#e4f3f1',

  rosso: '#c0564f',
} as const

/* -------------------------------------------------------------------------- */
/*  Regole di composizione                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Altezza minima che un blocco deve avere per non restare orfano a fine pagina.
 *
 * React-PDF spezza dove capita: senza `minPresenceAhead` un'intestazione di
 * sezione finisce in fondo a una pagina e il suo contenuto comincia in quella
 * dopo — l'errore che più di ogni altro fa sembrare un documento generato da
 * una macchina.
 */
export const PRESENZA_MINIMA = {
  sezione: 90,
  blocco: 60,
  riga: 24,
} as const

/** Bordo sottile standard: un solo spessore in tutto il documento. */
export const BORDO = { width: 0.7, color: COLORE.linea, style: 'solid' } as const

/**
 * Proporzione dell'immagine del tetto.
 *
 * 16:9 non va bene: le ortofoto di un edificio sono più quadrate, e forzarle
 * al panorama taglia via la falda o lascia due bande di giardino. 3:2 è il
 * compromesso che tiene l'edificio dentro senza sprecare pagina.
 */
export const RAPPORTO_TETTO = 3 / 2

/* -------------------------------------------------------------------------- */
/*  Limiti del font                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Caratteri che DM Sans non ha, e con cosa sostituirli.
 *
 * Scoperto sulla prima prova di stampa: «CO₂» veniva reso come «CO,» — il
 * pedice non esiste nel font e React-PDF, invece di segnalarlo, disegna il
 * glifo di ripiego. Un errore che passa la revisione del codice e arriva al
 * cliente, perché in pagina sembra un refuso di battitura.
 *
 * Vale per pedici, apici e frazioni: prima di usarne uno, passare da qui.
 */
const SOSTITUZIONI: readonly (readonly [RegExp, string])[] = [
  [/₀/g, '0'],
  [/₁/g, '1'],
  [/₂/g, '2'],
  [/₃/g, '3'],
  [/¹/g, '1'],
  [/²/g, '2'],
  [/³/g, '3'],
  [/½/g, '1/2'],
  [/¼/g, '1/4'],
]

/** Rende un testo sicuro per DM Sans, senza glifi mancanti. */
export function testoSicuro(testo: string): string {
  return SOSTITUZIONI.reduce((acc, [cerca, sostituisci]) => acc.replace(cerca, sostituisci), testo)
}

/**
 * Spazio unificatore: tiene insieme numero e unità.
 *
 * «0,044 €/kWh» spezzato fra «€/» e «kWh» a fine riga è illeggibile, e capita
 * proprio nelle tessere strette dove il valore conta di più.
 */
export const SPAZIO_UNIFICATORE = '\u00a0'
