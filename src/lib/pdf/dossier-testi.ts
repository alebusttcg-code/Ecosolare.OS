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
  'Fornitura e posa di cavo e quadri da interno, sezionatori e differenziali, scaricatori, materiali necessari al collegamento dell’impianto alla rete elettrica',
  'Materiali d’uso, di consumo e di tenuta; materiali per il fissaggio della struttura al tetto',
  'Produzione documenti e modulistica ENEL e GSE',
]

export const ESCLUSO_OFFERTA: readonly string[] = [
  'Linea elettrica idonea al collegamento dell’impianto',
  'Eventuali opere murarie non previste in sede di sopralluogo',
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
