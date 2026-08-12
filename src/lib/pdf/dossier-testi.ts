/**
 * Testi commerciali ricorrenti nei dossier EcoSolare (incluso / escluso /
 * garanzie). Fonte: preventivi di riferimento; non sono dati del singolo
 * cliente — il blocco termico personalizzato arriva dal dossier del preventivo.
 */

export const INCLUSO_FV: readonly string[] = [
  'Fornitura, trasporto e scarico di tutti i materiali specificati a livello strada, attrezzatura necessaria per la lavorazione sul posto e il sollevamento in quota del materiale',
  'Sistemi di ritenuta individuale per il lavoro in sicurezza',
  'Montaggio dell’impianto FV con manodopera specializzata',
  'Fornitura e posa di struttura di supporto pannelli fotovoltaici certificata in alluminio e inox',
  'Fornitura e posa di cavo solare doppia schermatura per connessione dei moduli in copertura',
  'Fornitura e posa linea Corrente Continua per la connessione tra moduli fotovoltaici e quadro inverter, dimensionata in base al progetto',
  'Fornitura e posa linea Corrente Alternata per la connessione dell’impianto al quadro esistente, dimensionata in base al progetto',
  'Fornitura e posa di cavo e quadri da interno, sezionatori e differenziali, scaricatori, materiali necessari al collegamento dell’impianto alla rete elettrica',
  'Materiali d’uso, di consumo e di tenuta; materiali per il fissaggio della struttura al tetto',
  'Produzione documenti e modulistica ENEL e GSE',
]

export const ESCLUSO_OFFERTA: readonly string[] = [
  'Linea elettrica idonea al collegamento dell’impianto',
  'Eventuali opere murarie non previste in sede di sopralluogo',
  'Eventuali valvole termostatiche ove non presenti',
  'Oneri per eventuali pratiche paesaggistiche ove necessario',
  'Corrispettivi a favore del distributore per ottenimento preventivo e allacciamento contatori',
  'Tutto quanto non specificato tra le attività incluse',
]

export const GARANZIE_TESTI: readonly {
  readonly titolo: string
  readonly punti: readonly string[]
}[] = [
  {
    titolo: 'Pannelli fotovoltaici',
    punti: [
      '25 anni di garanzia per malfunzionamenti imputabili a difetti di fabbricazione.',
      'Garanzia di potenza di output in condizioni STC secondo scheda del produttore (fino a 30 anni).',
    ],
  },
  {
    titolo: 'Inverter',
    punti: [
      '5 anni di garanzia estendibili a 10 per malfunzionamenti imputabili a difetti di fabbricazione, salvo diversa dichiarazione del costruttore.',
    ],
  },
  {
    titolo: 'Manodopera e installazione',
    punti: [
      '10 anni di garanzia per malfunzionamenti imputabili a difetti di fabbricazione o ad errato montaggio, salvo diversa dichiarazione.',
    ],
  },
  {
    titolo: 'Componentistica elettrica',
    punti: [
      '2 anni di garanzia per malfunzionamenti imputabili a difetti di fabbricazione o ad errato montaggio.',
    ],
  },
]

export const NOTA_GARANZIA =
  'La garanzia non copre i materiali danneggiati da eventi atmosferici, atti di vandalismo o utilizzo non adeguato. Interventi di terzi senza approvazione scritta di EcoSolare rendono nulle le condizioni di garanzia.'

/* -------------------------------------------------------------------------- */
/*  Blocco termico — copy dei preventivi cartacei                              */
/* -------------------------------------------------------------------------- */

/**
 * Le attività del blocco termico, parola per parola dai preventivi cartacei.
 *
 * Compaiono **solo se il cliente compra l'impianto termico**: sono voci che
 * parlano di caldaia da smontare, lavaggio dell'impianto e iscrizione FGAS, e
 * su un preventivo di solo fotovoltaico non hanno alcun senso. È la ragione
 * per cui stanno qui divise per tipo invece che dentro l'elenco generale
 * delle attività incluse.
 *
 * Due varianti perché due sono gli impianti proposti: la pompa di calore che
 * sostituisce del tutto il generatore (Riboldi) e la caldaia ibrida che
 * affianca il bruciatore a gas (Ricci). Le voci non coincidono — la ibrida non
 * prevede lo smontaggio della caldaia esistente, perché la caldaia resta.
 */
export const ATTIVITA_TERMICO: Readonly<
  Record<'pdc' | 'ibrido' | 'altro', readonly string[]>
> = {
  pdc: [
    'Il tutto integrato da valvola deviatrice motorizzata, Boiler per acqua calda sanitaria, accumulo inerziale, vasi di espansione, raccorderie, minuterie, valvole di sicurezza, ecc. per fornire l’impianto installato e collaudato a perfetta regola d’arte.',
    'Incluso lo smontaggio e smaltimento dell’attuale caldaia esistente.',
    'Inclusi accessori, filtri, lavaggio completo impianto di riscaldamento.',
    'Iscrizione CRITER – FGAS.',
  ],
  ibrido: [
    'Lavaggio impianto esistente con prodotto certificato.',
    'Fornitura e posa di tutti i tubi e i materiali per il collegamento alla rete idrica e all’impianto idraulico esistente.',
    'Montaggio completo con manodopera specializzata e l’attrezzatura specialistica necessaria per la lavorazione sul posto ed il sollevamento in quota di tutti i materiali necessari all’esecuzione delle opere.',
    'Iscrizione FGAS – Accatastamento caldaia.',
  ],
  altro: [
    'Montaggio completo con manodopera specializzata e attrezzatura specialistica necessaria alla lavorazione sul posto.',
    'Fornitura e posa dei materiali per il collegamento all’impianto idraulico esistente.',
  ],
}

/** Come si intitola la sezione, secondo il tipo di impianto proposto. */
export const TITOLO_TERMICO: Readonly<Record<'pdc' | 'ibrido' | 'altro', string>> = {
  pdc: 'Pompa di calore',
  ibrido: 'Caldaia ibrida gas — pompa di calore',
  altro: 'Impianto termico',
}

/** Termini di pagamento standard (template commerciale fisso). */
export const TERMINI_PAGAMENTO = {
  acconto: '50% — all’ordine',
  saldo: 'Saldo — a collaudo / messa in servizio',
  validitaGiorniLavorativi: 10,
} as const
