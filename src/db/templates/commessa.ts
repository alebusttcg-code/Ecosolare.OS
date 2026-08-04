/**
 * Modelli usati all'apertura di una commessa.
 *
 * TUTTI DA VALIDARE CON L'AZIENDA (domande B7, B9, B10 del blueprint). Gli stati,
 * i task e soprattutto l'elenco dei documenti sono derivati dal brief, non dal
 * modo in cui EcoSolare lavora davvero. Vivono in tabella proprio per questo:
 * correggerli dev'essere una riga da modificare, non un rilascio.
 */

/** Stati della commessa (§5.10 del brief). */
export const STATI_COMMESSA = [
  { code: 'contratto_ricevuto', label: 'Contratto ricevuto', sortOrder: 10 },
  { code: 'documenti_da_completare', label: 'Documenti da completare', sortOrder: 20 },
  { code: 'verifica_tecnica', label: 'Verifica tecnica', sortOrder: 30 },
  { code: 'pratiche_in_preparazione', label: 'Pratiche in preparazione', sortOrder: 40 },
  { code: 'pratiche_inviate', label: 'Pratiche inviate', sortOrder: 50 },
  { code: 'materiali_da_ordinare', label: 'Materiali da ordinare', sortOrder: 60 },
  { code: 'materiali_ordinati', label: 'Materiali ordinati', sortOrder: 70 },
  { code: 'materiali_disponibili', label: 'Materiali disponibili', sortOrder: 80 },
  { code: 'cliente_da_confermare', label: 'Cliente da confermare', sortOrder: 90 },
  // Da qui in poi la pianificabilità non è più un'informazione: è un prerequisito.
  { code: 'pianificabile', label: 'Pianificabile', sortOrder: 100, requiresReadiness: true },
  { code: 'cantiere_pianificato', label: 'Cantiere pianificato', sortOrder: 110, requiresReadiness: true },
  { code: 'installazione_in_corso', label: 'Installazione in corso', sortOrder: 120, requiresReadiness: true },
  { code: 'installazione_completata', label: 'Installazione completata', sortOrder: 130 },
  { code: 'collaudo', label: 'Collaudo', sortOrder: 140 },
  { code: 'pratiche_finali', label: 'Pratiche finali', sortOrder: 150 },
  { code: 'fatturazione', label: 'Fatturazione', sortOrder: 160 },
  { code: 'saldo', label: 'Attesa saldo', sortOrder: 170 },
] as const

export const STATI_COMMESSA_SPECIALI = [
  { code: 'chiusa', label: 'Chiusa', sortOrder: 200, isClosed: true },
  { code: 'sospesa', label: 'Sospesa', sortOrder: 210, isSuspended: true },
  { code: 'bloccata', label: 'Bloccata', sortOrder: 220, isSuspended: true },
] as const

/** Task creati automaticamente alla firma. */
export const TASK_COMMESSA = [
  {
    code: 'raccolta_documenti',
    label: 'Raccogliere i documenti dal cliente',
    defaultRole: 'contabilita' as const,
    dueDaysFromStart: 5,
    sortOrder: 10,
  },
  {
    code: 'verifica_tecnica',
    label: 'Verifica tecnica e progetto esecutivo',
    defaultRole: 'cantiere' as const,
    dueDaysFromStart: 10,
    sortOrder: 20,
  },
  {
    code: 'distinta_materiali',
    label: 'Confermare la distinta materiali e ordinare',
    defaultRole: 'cantiere' as const,
    dueDaysFromStart: 12,
    sortOrder: 30,
  },
  {
    code: 'pratiche_connessione',
    label: 'Preparare e inviare le pratiche di connessione',
    defaultRole: 'contabilita' as const,
    dueDaysFromStart: 15,
    sortOrder: 40,
  },
  {
    code: 'conferma_cliente',
    label: 'Concordare la data di installazione con il cliente',
    defaultRole: 'commerciale' as const,
    dueDaysFromStart: 20,
    sortOrder: 50,
  },
] as const

/**
 * Checklist documentale per il fotovoltaico.
 *
 * È la lista che l'intervista all'ufficio tecnico deve confermare o riscrivere
 * (domanda B9). Un documento obbligatorio che non serve blocca cantieri per
 * niente; uno mancante li fa partire e fermare.
 */
export const DOCUMENTI_FV = [
  { code: 'documento_identita', label: 'Documento di identità del cliente', mandatory: true, providedByClient: true, dueDaysFromStart: 5, sortOrder: 10 },
  { code: 'codice_fiscale', label: 'Codice fiscale', mandatory: true, providedByClient: true, dueDaysFromStart: 5, sortOrder: 20 },
  { code: 'titolo_proprieta', label: 'Titolo di proprietà o consenso del proprietario', mandatory: true, providedByClient: true, dueDaysFromStart: 10, sortOrder: 30 },
  { code: 'visura_catastale', label: 'Visura catastale', mandatory: true, providedByClient: true, dueDaysFromStart: 10, sortOrder: 40 },
  { code: 'planimetria', label: 'Planimetria dell’immobile', mandatory: false, providedByClient: true, dueDaysFromStart: 10, sortOrder: 50 },
  { code: 'bolletta', label: 'Ultima bolletta elettrica (POD e potenza)', mandatory: true, providedByClient: true, dueDaysFromStart: 5, sortOrder: 60 },
  { code: 'mandato_pratiche', label: 'Mandato per la gestione delle pratiche', mandatory: true, providedByClient: true, dueDaysFromStart: 7, sortOrder: 70 },
  { code: 'contratto_firmato', label: 'Contratto firmato', mandatory: true, providedByClient: false, dueDaysFromStart: 0, sortOrder: 80 },
  { code: 'schema_elettrico', label: 'Schema elettrico di progetto', mandatory: true, providedByClient: false, defaultRole: 'cantiere' as const, dueDaysFromStart: 15, sortOrder: 90 },
  { code: 'dichiarazione_conformita', label: 'Dichiarazione di conformità (DM 37/08)', mandatory: true, providedByClient: false, defaultRole: 'cantiere' as const, sortOrder: 100 },
] as const

/**
 * Pratiche tipiche di un impianto fotovoltaico.
 *
 * Quali siano gestite internamente e quali da un consulente è la domanda B10:
 * qui sono tutte interne, ed è un'ipotesi da correggere.
 */
export const PRATICHE_FV = [
  { code: 'richiesta_connessione', label: 'Richiesta di connessione al distributore', blocking: true },
  { code: 'registrazione_terna', label: 'Registrazione impianto (Terna GAUDÌ)', blocking: false },
  { code: 'comunicazione_gse', label: 'Pratica GSE', blocking: false },
  { code: 'comunicazione_enea', label: 'Comunicazione ENEA', blocking: false },
] as const

/** Piano pagamenti predefinito, in percentuale sull'imponibile. */
export const PIANO_PAGAMENTI = [
  { label: 'Acconto alla firma', percentage: 30, blocksStart: true, sortOrder: 10 },
  { label: 'Alla consegna dei materiali', percentage: 40, blocksStart: false, sortOrder: 20 },
  { label: 'Saldo a fine lavori', percentage: 30, blocksStart: false, sortOrder: 30 },
] as const
