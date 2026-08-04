import type { DefinizioneQuestionario } from '@/lib/domain/questionnaire'

/**
 * Checklist di sopralluogo fotovoltaico (§5.6 del brief).
 *
 * Qui l'obbligatorieta' e' seria: il sopralluogo non si chiude se mancano dati
 * bloccanti, perche' il costo di tornare dal cliente e' molto piu' alto di
 * quello di compilare un campo in piu' sul posto.
 *
 * ATTENZIONE — questa versione e' una PROPOSTA da validare con l'ufficio tecnico
 * (domanda B9 del blueprint). La lista reale di cio' che serve per progettare
 * senza richiamare nessuno deve venire da chi progetta, non da noi. Il campo
 * obbligatorio che non serve e' altrettanto dannoso di quello mancante: insegna
 * ad aggirare il sistema.
 *
 * Le fotografie sono previste come tipo di campo ma NON obbligatorie: il
 * caricamento file arriva con il modulo documentale. Renderle obbligatorie ora
 * bloccherebbe ogni chiusura con un requisito impossibile da soddisfare.
 */
export const SOPRALLUOGO_FV: DefinizioneQuestionario = {
  code: 'sopralluogo_fv',
  version: 1,
  name: 'Sopralluogo fotovoltaico',
  sections: [
    {
      code: 'copertura',
      label: 'Copertura',
      fields: [
        {
          code: 'tipo_tetto',
          label: 'Tipologia di tetto',
          type: 'scelta',
          required: true,
          options: [
            { value: 'falda', label: 'A falda' },
            { value: 'piano', label: 'Piano' },
            { value: 'misto', label: 'Misto' },
            { value: 'terreno', label: 'A terra' },
          ],
        },
        {
          code: 'manto',
          label: 'Manto di copertura',
          type: 'scelta',
          required: true,
          showIf: { campo: 'tipo_tetto', fraI: ['falda', 'misto'] },
          options: [
            { value: 'tegole', label: 'Tegole' },
            { value: 'coppi', label: 'Coppi' },
            { value: 'lamiera', label: 'Lamiera grecata' },
            { value: 'guaina', label: 'Guaina' },
            { value: 'fibrocemento', label: 'Fibrocemento' },
            { value: 'altro', label: 'Altro' },
          ],
        },
        {
          code: 'orientamento',
          label: 'Orientamento',
          type: 'scelta',
          required: true,
          showIf: { campo: 'tipo_tetto', fraI: ['falda', 'misto'] },
          options: [
            { value: 'sud', label: 'Sud' },
            { value: 'sud_est', label: 'Sud-est' },
            { value: 'sud_ovest', label: 'Sud-ovest' },
            { value: 'est', label: 'Est' },
            { value: 'ovest', label: 'Ovest' },
            { value: 'nord', label: 'Nord' },
          ],
        },
        {
          code: 'inclinazione',
          label: 'Inclinazione',
          type: 'numero',
          unit: 'gradi',
          required: true,
          min: 0,
          max: 70,
          showIf: { campo: 'tipo_tetto', fraI: ['falda', 'misto'] },
        },
        {
          code: 'superficie_utile',
          label: 'Superficie utile misurata',
          type: 'numero',
          unit: 'mq',
          required: true,
          min: 0,
        },
        {
          code: 'stato_copertura',
          label: 'Stato della copertura',
          type: 'scelta',
          required: true,
          options: [
            { value: 'buono', label: 'Buono' },
            { value: 'discreto', label: 'Discreto' },
            { value: 'da_sistemare', label: 'Da sistemare prima dell installazione' },
          ],
          criticoSe: 'da_sistemare',
        },
        {
          code: 'amianto',
          label: 'Presenza di amianto',
          type: 'booleano',
          required: true,
          criticoSe: true,
          help: 'Se presente, la bonifica va valutata prima di qualunque preventivo.',
        },
        {
          code: 'ombreggiamenti',
          label: 'Ombreggiamenti rilevati',
          type: 'scelta',
          required: true,
          options: [
            { value: 'nessuno', label: 'Nessuno' },
            { value: 'mattino', label: 'Al mattino' },
            { value: 'pomeriggio', label: 'Al pomeriggio' },
            { value: 'costanti', label: 'Costanti' },
          ],
          criticoSe: 'costanti',
        },
        {
          code: 'fonte_ombreggiamento',
          label: 'Da cosa',
          type: 'testo',
          showIf: { campo: 'ombreggiamenti', diverso: 'nessuno' },
        },
        {
          code: 'foto_copertura',
          label: 'Fotografie della copertura',
          type: 'foto',
          help: 'Il caricamento arriva con il modulo documentale.',
        },
      ],
    },
    {
      code: 'elettrico',
      label: 'Impianto elettrico',
      fields: [
        {
          code: 'posizione_contatore',
          label: 'Posizione del contatore',
          type: 'testo',
          required: true,
        },
        {
          code: 'pod',
          label: 'Codice POD',
          type: 'testo',
          required: true,
          help: 'Si legge sulla bolletta o sul contatore.',
        },
        {
          code: 'stato_quadro',
          label: 'Stato del quadro elettrico',
          type: 'scelta',
          required: true,
          options: [
            { value: 'adeguato', label: 'Adeguato' },
            { value: 'da_integrare', label: 'Da integrare' },
            { value: 'da_rifare', label: 'Da rifare' },
          ],
          criticoSe: 'da_rifare',
        },
        {
          code: 'distanza_quadro_inverter',
          label: 'Distanza fra quadro e posizione inverter',
          type: 'numero',
          unit: 'm',
          required: true,
          min: 0,
        },
        {
          code: 'posizione_inverter',
          label: 'Posizione prevista per l inverter',
          type: 'testo',
          required: true,
        },
        {
          code: 'accumulo_previsto',
          label: 'E previsto un accumulo',
          type: 'booleano',
          required: true,
        },
        {
          code: 'posizione_accumulo',
          label: 'Posizione prevista per l accumulo',
          type: 'testo',
          required: true,
          showIf: { campo: 'accumulo_previsto', uguale: true },
        },
        {
          code: 'canalizzazioni',
          label: 'Percorso cavi e canalizzazioni',
          type: 'testo_lungo',
          required: true,
        },
        {
          code: 'foto_quadro',
          label: 'Fotografie di quadro e contatore',
          type: 'foto',
        },
      ],
    },
    {
      code: 'accesso',
      label: 'Accessibilita e cantiere',
      fields: [
        {
          code: 'accesso_mezzi',
          label: 'Accessibilita per i mezzi',
          type: 'scelta',
          required: true,
          options: [
            { value: 'agevole', label: 'Agevole' },
            { value: 'limitato', label: 'Limitato' },
            { value: 'difficile', label: 'Difficile, serve attrezzatura specifica' },
          ],
          criticoSe: 'difficile',
        },
        {
          code: 'ponteggio',
          label: 'Serve un ponteggio',
          type: 'booleano',
          required: true,
        },
        {
          code: 'altezza_gronda',
          label: 'Altezza alla gronda',
          type: 'numero',
          unit: 'm',
          min: 0,
          max: 60,
        },
        {
          code: 'interventi_elettrici',
          label: 'Interventi elettrici aggiuntivi necessari',
          type: 'testo_lungo',
        },
        {
          code: 'interventi_idraulici',
          label: 'Interventi idraulici collegati',
          type: 'testo_lungo',
        },
      ],
    },
    {
      code: 'esito',
      label: 'Esito',
      fields: [
        {
          code: 'potenza_stimata',
          label: 'Potenza installabile stimata',
          type: 'numero',
          unit: 'kWp',
          required: true,
          min: 0,
          max: 2000,
        },
        {
          code: 'criticita',
          label: 'Criticita rilevate',
          type: 'testo_lungo',
        },
        {
          code: 'note_tecniche',
          label: 'Note per la progettazione',
          type: 'testo_lungo',
        },
        {
          code: 'conferma_cliente',
          label: 'Il cliente era presente e ha confermato i dati',
          type: 'booleano',
          required: true,
        },
      ],
    },
  ],
}
