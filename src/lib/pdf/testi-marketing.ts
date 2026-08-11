/**
 * Le pagine «PERCHÉ ECOSOLARE», parola per parola dal preventivo cartaceo.
 *
 * **Questo testo non si riscrive.** È stato scritto dal commerciale, è già
 * stato letto da duemila clienti e non è materiale da migliorare: una virgola
 * spostata qui è una discrepanza fra ciò che il cliente legge sul PDF e ciò che
 * si sente dire al telefono.
 *
 * Prima queste pagine erano fotografie del vecchio documento Word incollate nel
 * PDF: stesso testo, ma con un altro carattere, un altro logo e un altro piè di
 * pagina. Sfogliando il documento si vedeva il salto. Ora sono composte come il
 * resto — cambia la forma, non una parola.
 *
 * Le immagini (loghi dei produttori, Altroconsumo, recensioni, certificato)
 * sono quelle originali, estratte dai preventivi di riferimento e conservate in
 * `public/preventivo/assets/`.
 */

export interface PaginaMarketing {
  /** Numero di sezione come compare nel documento cartaceo. */
  readonly numero: number
  readonly titolo: string
  readonly sottotitolo: string
  /** Paragrafi prima delle immagini. */
  readonly apertura: readonly string[]
  /** Paragrafi dopo le immagini. */
  readonly chiusura: readonly string[]
  readonly immagini: readonly string[]
  readonly disposizione: 'loghi' | 'foto' | 'recensioni' | 'certificato'
}

export const PAGINE_MARKETING: readonly PaginaMarketing[] = [
  {
    numero: 3,
    titolo: 'PERCHÉ ECOSOLARE',
    sottotitolo: '20 ANNI DI ESPERIENZA — SOLO MATERIALI E PRODOTTI DI QUALITÀ',
    apertura: [
      'Ecosolare dal 2007 progetta e installa impianti fotovoltaici e sistemi di riscaldamento in pompa di calore di alta qualità, scegliendo i migliori materiali disponibili sul mercato.',
    ],
    chiusura: [
      'Installando solo materiale dei più importanti produttori nel mondo dell’efficienza energetica, Ecosolare garantisce a tutti i propri clienti i massimi standard qualitativi, impianti che durano 30-40 anni, le più lunghe e complete garanzie sul mercato.',
    ],
    immagini: [
      'preventivo/assets/partner-1.png',
      'preventivo/assets/partner-2.png',
      'preventivo/assets/partner-3.png',
      'preventivo/assets/partner-4.png',
      'preventivo/assets/partner-5.png',
      'preventivo/assets/partner-6.png',
    ],
    disposizione: 'loghi',
  },
  {
    numero: 4,
    titolo: 'PERCHÉ ECOSOLARE',
    sottotitolo: '2.500 IMPIANTI INSTALLATI, QUALITÀ CERTIFICATA DA ALTROCONSUMO',
    apertura: [
      'Altroconsumo è la principale associazione indipendente di consumatori in Italia.',
      'Opera senza fini di lucro per tutelare i cittadini attraverso test comparativi, inchieste e azioni legali collettive.',
      'È importante perché fornisce valutazioni imparziali su prodotti e servizi, basate su prove tecniche e dati verificabili. Ha contribuito a migliorare la trasparenza del mercato, smascherando pratiche scorrette (come ad esempio nel caso del “Dieselgate”) e ottenendo rimborsi e risarcimenti per milioni di consumatori.',
    ],
    chiusura: [
      'Ecosolare, nell’ambito del più importante gruppo d’acquisto organizzato da Altroconsumo, è stata selezionata in Emilia Romagna, Liguria e alta Toscana, venendo successivamente premiata a Milano durante la fiera delle energie rinnovabili come azienda partecipante con il più alto numero di progetti realizzati.',
    ],
    immagini: [
      'preventivo/assets/altroconsumo-logo.png',
      'preventivo/assets/altroconsumo-foto.png',
    ],
    disposizione: 'foto',
  },
  {
    numero: 5,
    titolo: 'PERCHÉ ECOSOLARE',
    sottotitolo: 'OBIETTIVO SODDISFAZIONE DEI CLIENTI CERTIFICATA',
    // Nel documento originale questa pagina è fatta di sole recensioni: il
    // testo sarebbe di troppo, perché sono i clienti a parlare.
    apertura: [],
    chiusura: [],
    immagini: [
      'preventivo/assets/recensione-1.png',
      'preventivo/assets/recensione-2.png',
      'preventivo/assets/recensione-3.png',
      'preventivo/assets/recensione-4.png',
    ],
    disposizione: 'recensioni',
  },
  {
    numero: 6,
    titolo: 'PERCHÉ ECOSOLARE',
    sottotitolo: 'GARANZIA UNICA SUL MERCATO',
    // «Grazie» apre l'elenco dei tre motivi: sta dentro il blocco, non fra i
    // paragrafi, o la composizione lo separa da ciò che introduce.
    apertura: [],
    chiusura: [],
    immagini: ['preventivo/assets/certificato-garanzia.png'],
    disposizione: 'certificato',
  },
]

/** I tre motivi della garanzia, elencati come nel cartaceo. */
export const MOTIVI_GARANZIA: readonly string[] = [
  'all’esperienza maturata',
  'alla qualità dei materiali',
  'alla formazione costante del personale',
]

export const CHIUSURA_GARANZIA = {
  apertura: 'Grazie',
  premessa: 'Ecosolare può permettersi di fornire',
  claim: '10 anni di Garanzia sull’installazione dei propri impianti',
} as const

/* -------------------------------------------------------------------------- */
/*  §2 Caratteristiche — narrativa tecnica                                     */
/* -------------------------------------------------------------------------- */

/**
 * Le voci tecniche dell'impianto fotovoltaico.
 *
 * Nel preventivo di riferimento questa sezione è un racconto di marca — «N. 12
 * Pannelli FV Viessmann Vitovolt 500 Wp M-WT Bifacciali», «Struttura certificata
 * Wurth» — mentre da noi era un listino prezzi. Il listino resta, ma dopo: la
 * sezione deve dire *cosa si compra*, non *quanto costa*.
 *
 * Marca e modello arrivano da qui finché non saranno campi del catalogo
 * prodotti. Le parti che dipendono dal caso (numero moduli, potenza) sono
 * parametriche: **nessun numero è scritto a mano**.
 */
export function vociImpiantoFv(dati: {
  readonly potenzaKwp: string
  readonly moduli: number
  readonly wattPicco: number | null
}): readonly string[] {
  const potenzaModulo = dati.wattPicco ? `${dati.wattPicco} Wp ` : ''

  return [
    `Fornitura e montaggio dell’impianto FV descritto, per una potenza totale di ${dati.potenzaKwp}`,
    `N. ${dati.moduli} Pannelli FV Viessmann Vitovolt ${potenzaModulo}M-WT Bifacciali, Monocristallino Alto Rendimento`,
    'N. 1 Inverter Viessmann /Solplanet Hybrid Inverter',
    'Struttura di montaggio certificata Wurth, strutture di fissaggio in acciaio inox.',
    'Fornitura e posa linea Corrente Continua per connessione tra moduli fotovoltaici e quadro Inverter, dimensionata in base al progetto.',
    'Fornitura e posa linea Corrente Alternata per connessione impianto a quadro esistente, dimensionata in base al progetto.',
    'Cavo solare doppia schermatura',
    'Quadri, Centralini, Sezionatori, Scaricatori di Sovratensione Schneider/ABB',
  ]
}

/** Voce aggiuntiva quando il preventivo comprende un accumulo. */
export function voceAccumulo(capacitaKwh: number): string {
  return `N. 1 sistema di accumulo agli ioni di litio da ${capacitaKwh.toLocaleString('it-IT')} kWh, per immagazzinare l’energia prodotta e non consumata durante il giorno e riutilizzarla nelle ore serali.`
}

/** Titolo della sezione fotovoltaica: porta la marca quando la conosciamo. */
export const TITOLO_IMPIANTO_FV = 'IMPIANTO FOTOVOLTAICO VIESSMANN'
