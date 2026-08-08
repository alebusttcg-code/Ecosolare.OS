import type { DefinizioneQuestionario } from '@/lib/domain/questionnaire'

/**
 * Prequalifica fotovoltaico (§5.3 del brief).
 *
 * Serve al commerciale per capire, prima di muoversi, se vale la pena fissare un
 * sopralluogo. Nessun campo e' obbligatorio tranne i primi due: un questionario
 * che blocca al primo contatto e' un questionario che non viene compilato.
 *
 * I punteggi sono un PUNTO DI PARTENZA da tarare dopo l'audit, confrontandoli
 * con le pratiche realmente convertite. Il punteggio ordina le priorita', non
 * decide: la valutazione commerciale resta umana.
 */
export const PREQUALIFICA_FV: DefinizioneQuestionario = {
  code: 'prequalifica_fv',
  version: 2,
  name: 'Prequalifica fotovoltaico',
  sections: [
    {
      code: 'richiedente',
      label: 'Richiedente e immobile',
      fields: [
        {
          code: 'tipo_richiedente',
          label: 'Tipologia di richiedente',
          type: 'scelta',
          required: true,
          options: [
            { value: 'privato', label: 'Privato' },
            { value: 'azienda', label: 'Azienda' },
            { value: 'condominio', label: 'Condominio' },
            { value: 'agricolo', label: 'Azienda agricola' },
          ],
          punteggio: {
            tipo: 'valori',
            mappa: { privato: 15, azienda: 20, agricolo: 20, condominio: 5 },
          },
        },
        {
          code: 'proprietario',
          label: 'E proprietario dell immobile',
          type: 'booleano',
          required: true,
          help: 'Se non lo e, servira il consenso scritto del proprietario.',
          punteggio: { tipo: 'valori', mappa: { true: 20, false: 0 } },
        },
        {
          code: 'consenso_proprietario',
          label: 'Ha gia il consenso del proprietario',
          type: 'booleano',
          showIf: { campo: 'proprietario', uguale: false },
        },
        {
          code: 'indirizzo',
          label: 'Indirizzo',
          type: 'testo_lungo',
          help: 'Via e civico dalla scheda lead: puoi correggerli qui.',
        },
        {
          code: 'comune',
          label: 'Comune',
          type: 'testo',
          help: 'Comune dalla scheda lead: puoi correggerlo qui.',
        },
        {
          code: 'cap',
          label: 'CAP',
          type: 'testo',
        },
        {
          code: 'provincia',
          label: 'Provincia',
          type: 'testo',
        },
        {
          code: 'tipo_edificio',
          label: 'Tipologia di edificio',
          type: 'scelta',
          options: [
            { value: 'villetta', label: 'Villetta singola o bifamiliare' },
            { value: 'schiera', label: 'Villetta a schiera' },
            { value: 'palazzina', label: 'Palazzina' },
            { value: 'capannone', label: 'Capannone' },
            { value: 'rurale', label: 'Fabbricato rurale' },
          ],
          punteggio: {
            tipo: 'valori',
            mappa: { villetta: 20, schiera: 15, capannone: 20, rurale: 15, palazzina: 8 },
          },
        },
        {
          code: 'vincoli',
          label: 'Sono noti vincoli paesaggistici o storici',
          type: 'scelta',
          options: [
            { value: 'no', label: 'No' },
            { value: 'si', label: 'Si' },
            { value: 'non_so', label: 'Non lo so' },
          ],
          criticoSe: 'si',
          punteggio: { tipo: 'valori', mappa: { no: 10, non_so: 5, si: 0 } },
        },
      ],
    },
    {
      code: 'consumi',
      label: 'Consumi elettrici',
      description: 'I dati della bolletta rendono il preventivo molto piu accurato.',
      fields: [
        {
          code: 'bolletta_disponibile',
          label: 'Ha le bollette a disposizione',
          type: 'booleano',
          punteggio: { tipo: 'valori', mappa: { true: 15, false: 0 } },
        },
        {
          code: 'consumo_annuo',
          label: 'Consumo annuo',
          type: 'numero',
          unit: 'kWh',
          min: 0,
          max: 500_000,
          punteggio: {
            tipo: 'intervalli',
            intervalli: [
              { a: 1500, punti: 5 },
              { da: 1501, a: 3000, punti: 15 },
              { da: 3001, a: 6000, punti: 25 },
              { da: 6001, punti: 30 },
            ],
          },
        },
        {
          code: 'spesa_media_mensile',
          label: 'Spesa media mensile',
          type: 'numero',
          unit: 'euro',
          min: 0,
        },
        {
          code: 'potenza_impegnata',
          label: 'Potenza impegnata',
          type: 'numero',
          unit: 'kW',
          min: 0,
          max: 1000,
        },
        {
          code: 'persone',
          label: 'Persone in casa',
          type: 'numero',
          min: 1,
          max: 30,
          showIf: { campo: 'tipo_richiedente', uguale: 'privato' },
        },
      ],
    },
    {
      code: 'copertura',
      label: 'Copertura',
      fields: [
        {
          code: 'tipo_tetto',
          label: 'Tipologia di tetto',
          type: 'scelta',
          options: [
            { value: 'falda', label: 'A falda' },
            { value: 'piano', label: 'Piano' },
            { value: 'misto', label: 'Misto' },
            { value: 'terreno', label: 'A terra' },
          ],
          punteggio: {
            tipo: 'valori',
            mappa: { falda: 20, piano: 15, misto: 12, terreno: 10 },
          },
        },
        {
          code: 'orientamento',
          label: 'Orientamento prevalente',
          type: 'scelta',
          showIf: { campo: 'tipo_tetto', fraI: ['falda', 'misto'] },
          options: [
            { value: 'sud', label: 'Sud' },
            { value: 'sud_est', label: 'Sud-est' },
            { value: 'sud_ovest', label: 'Sud-ovest' },
            { value: 'est', label: 'Est' },
            { value: 'ovest', label: 'Ovest' },
            { value: 'nord', label: 'Nord' },
            { value: 'non_so', label: 'Non lo so' },
          ],
          punteggio: {
            tipo: 'valori',
            mappa: {
              sud: 25,
              sud_est: 20,
              sud_ovest: 20,
              est: 12,
              ovest: 12,
              nord: 0,
              non_so: 8,
            },
          },
        },
        {
          code: 'superficie_indicativa',
          label: 'Superficie disponibile indicativa',
          type: 'numero',
          unit: 'mq',
          min: 0,
        },
        {
          code: 'ombreggiamenti',
          label: 'Ombreggiamenti noti',
          type: 'scelta',
          options: [
            { value: 'nessuno', label: 'Nessuno' },
            { value: 'parziali', label: 'Parziali' },
            { value: 'importanti', label: 'Importanti' },
            { value: 'non_so', label: 'Non lo so' },
          ],
          criticoSe: 'importanti',
          punteggio: {
            tipo: 'valori',
            mappa: { nessuno: 20, parziali: 12, importanti: 2, non_so: 8 },
          },
        },
        {
          code: 'stato_copertura',
          label: 'Stato della copertura',
          type: 'scelta',
          options: [
            { value: 'buono', label: 'Buono' },
            { value: 'da_sistemare', label: 'Da sistemare' },
            { value: 'amianto', label: 'Contiene amianto' },
          ],
          criticoSe: 'amianto',
        },
      ],
    },
    {
      code: 'interessi',
      label: 'Interessi e tempistiche',
      fields: [
        {
          code: 'interessi_aggiuntivi',
          label: 'Interessato anche a',
          type: 'scelta_multipla',
          options: [
            { value: 'accumulo', label: 'Sistema di accumulo' },
            { value: 'colonnina', label: 'Colonnina di ricarica' },
            { value: 'pompa_calore', label: 'Pompa di calore' },
            { value: 'quadro', label: 'Adeguamento del quadro elettrico' },
          ],
          punteggio: {
            tipo: 'valori',
            mappa: { accumulo: 10, colonnina: 5, pompa_calore: 8, quadro: 3 },
          },
        },
        {
          code: 'tempistiche',
          label: 'Entro quando vorrebbe realizzare',
          type: 'scelta',
          options: [
            { value: 'subito', label: 'Il prima possibile' },
            { value: 'tre_mesi', label: 'Entro tre mesi' },
            { value: 'sei_mesi', label: 'Entro sei mesi' },
            { value: 'informazione', label: 'Sto solo raccogliendo informazioni' },
          ],
          punteggio: {
            tipo: 'valori',
            mappa: { subito: 30, tre_mesi: 22, sei_mesi: 12, informazione: 3 },
          },
        },
        {
          code: 'budget_indicativo',
          label: 'Budget indicativo',
          type: 'scelta',
          options: [
            { value: 'non_definito', label: 'Non definito' },
            { value: 'fino_10k', label: 'Fino a 10.000 euro' },
            { value: '10_20k', label: '10.000 – 20.000 euro' },
            { value: 'oltre_20k', label: 'Oltre 20.000 euro' },
          ],
          punteggio: {
            tipo: 'valori',
            mappa: { non_definito: 5, fino_10k: 12, '10_20k': 20, oltre_20k: 25 },
          },
        },
        {
          code: 'note',
          label: 'Note',
          type: 'testo_lungo',
        },
      ],
    },
  ],
}
