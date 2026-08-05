/**
 * Pianificabilità di una commessa (§6.3 del blueprint).
 *
 * È la funzione centrale del sistema. Non risponde «sì o no», risponde
 * **perché no e chi deve agire**: un cantiere fermo senza un motivo scritto
 * accanto è esattamente il problema che il sistema esiste per eliminare.
 *
 * Da sola produce: l'elenco dei cantieri pianificabili, gli alert alla
 * direzione, il KPI «giorni di blocco» e le risposte dell'assistente
 * direzionale. Per questo è pura e testata prima di ogni altra cosa.
 */

export type TipoBlocco =
  | 'documento'
  | 'materiale'
  | 'pratica'
  | 'verifica_tecnica'
  | 'conferma_cliente'
  | 'acconto'

export type Gravita = 'bloccante' | 'avviso'

export interface Blocco {
  readonly tipo: TipoBlocco
  readonly gravita: Gravita
  readonly descrizione: string
  /** Chi deve agire. Un blocco senza responsabile non si sblocca da solo. */
  readonly responsabile: string | null
  /** Da quando è in questo stato, per il KPI «giorni di blocco». */
  readonly da: Date | null
}

export type StatoPianificabilita =
  | 'non_pianificabile'
  | 'quasi_pianificabile'
  | 'pianificabile'

export interface EsitoReadiness {
  readonly stato: StatoPianificabilita
  readonly bloccanti: readonly Blocco[]
  readonly avvisi: readonly Blocco[]
  /** Giorni da cui dura il blocco più vecchio. Null se non ci sono blocchi. */
  readonly giorniDiBloccoPiuVecchio: number | null
}

/* -------------------------------------------------------------------------- */
/*  Ingredienti                                                                */
/* -------------------------------------------------------------------------- */

export type StatoDocumento =
  | 'richiesto'
  | 'caricato'
  | 'da_verificare'
  | 'approvato'
  | 'respinto'
  | 'scaduto'
  | 'non_necessario'

export interface DocumentoRichiesto {
  readonly label: string
  readonly obbligatorio: boolean
  readonly stato: StatoDocumento
  readonly responsabile: string | null
  readonly da: Date | null
}

export type StatoMateriale =
  | 'da_ordinare'
  | 'ordinato'
  | 'parzialmente_consegnato'
  | 'consegnato'
  | 'non_disponibile'

export interface MaterialeCommessa {
  readonly descrizione: string
  /** Se critico, la sua assenza impedisce di partire. */
  readonly critico: boolean
  readonly stato: StatoMateriale
  readonly responsabile: string | null
  readonly da: Date | null
}

export type StatoPratica =
  | 'da_preparare'
  | 'in_preparazione'
  | 'inviata'
  | 'approvata'
  | 'respinta'

export interface PraticaCommessa {
  readonly label: string
  /** Se true, dev'essere almeno inviata per poter aprire il cantiere. */
  readonly bloccante: boolean
  readonly stato: StatoPratica
  readonly responsabile: string | null
  readonly da: Date | null
}

export interface DatiCommessa {
  readonly documenti: readonly DocumentoRichiesto[]
  readonly materiali: readonly MaterialeCommessa[]
  readonly pratiche: readonly PraticaCommessa[]
  readonly verificaTecnicaCompletata: boolean
  readonly clienteHaConfermato: boolean
  /** Null quando il piano pagamenti non prevede un acconto prima dei lavori. */
  readonly accontoIncassato: boolean | null
}

/**
 * Cosa è bloccante e cosa è solo un avviso.
 *
 * Configurabile perché la risposta giusta esce dall'audit (domanda B7): un
 * criterio inventato a tavolino produce cantieri bloccati senza motivo, e
 * l'unica reazione possibile diventa aggirare il sistema.
 */
export interface RegoleReadiness {
  readonly documentiObbligatoriBloccano: boolean
  readonly materialiCriticiBloccano: boolean
  readonly praticheBloccantiBloccano: boolean
  readonly verificaTecnicaBlocca: boolean
  readonly confermaClienteBlocca: boolean
  readonly accontoBlocca: boolean
}

export const REGOLE_PREDEFINITE: RegoleReadiness = {
  documentiObbligatoriBloccano: true,
  materialiCriticiBloccano: true,
  praticheBloccantiBloccano: true,
  verificaTecnicaBlocca: true,
  confermaClienteBlocca: true,
  // L'acconto non blocca di default: è una scelta commerciale, non tecnica,
  // e va decisa dalla direzione invece che imposta dal software.
  accontoBlocca: false,
}

/* -------------------------------------------------------------------------- */
/*  Calcolo                                                                    */
/* -------------------------------------------------------------------------- */

/** Un documento è a posto solo se approvato, o se dichiarato non necessario. */
function documentoRisolto(stato: StatoDocumento): boolean {
  return stato === 'approvato' || stato === 'non_necessario'
}

function materialeRisolto(stato: StatoMateriale): boolean {
  return stato === 'consegnato'
}

function praticaRisolta(stato: StatoPratica): boolean {
  return stato === 'inviata' || stato === 'approvata'
}

function giorniDa(data: Date | null, adesso: Date): number | null {
  if (data === null) return null
  return Math.max(0, Math.floor((adesso.getTime() - data.getTime()) / 86_400_000))
}

export function calcolaReadiness(
  dati: DatiCommessa,
  adesso: Date,
  regole: RegoleReadiness = REGOLE_PREDEFINITE,
): EsitoReadiness {
  const bloccanti: Blocco[] = []
  const avvisi: Blocco[] = []

  const aggiungi = (blocco: Blocco, bloccaDavvero: boolean) => {
    if (bloccaDavvero) bloccanti.push(blocco)
    else avvisi.push({ ...blocco, gravita: 'avviso' })
  }

  /* Documenti ------------------------------------------------------------- */
  for (const doc of dati.documenti) {
    if (documentoRisolto(doc.stato)) continue

    // Un documento respinto o scaduto non è «in attesa»: è un problema attivo,
    // e va detto con parole diverse perché richiede un'azione diversa.
    const descrizione =
      doc.stato === 'respinto'
        ? `Documento respinto: ${doc.label}`
        : doc.stato === 'scaduto'
          ? `Documento scaduto: ${doc.label}`
          : `Documento mancante: ${doc.label}`

    aggiungi(
      {
        tipo: 'documento',
        gravita: 'bloccante',
        descrizione,
        responsabile: doc.responsabile,
        da: doc.da,
      },
      doc.obbligatorio && regole.documentiObbligatoriBloccano,
    )
  }

  /* Materiali ------------------------------------------------------------- */
  for (const mat of dati.materiali) {
    if (materialeRisolto(mat.stato)) continue

    const descrizione =
      mat.stato === 'non_disponibile'
        ? `Materiale non disponibile: ${mat.descrizione}`
        : mat.stato === 'da_ordinare'
          ? `Materiale da ordinare: ${mat.descrizione}`
          : mat.stato === 'parzialmente_consegnato'
            ? `Materiale consegnato solo in parte: ${mat.descrizione}`
            : `Materiale in attesa di consegna: ${mat.descrizione}`

    aggiungi(
      {
        tipo: 'materiale',
        gravita: 'bloccante',
        descrizione,
        responsabile: mat.responsabile,
        da: mat.da,
      },
      mat.critico && regole.materialiCriticiBloccano,
    )
  }

  /* Pratiche -------------------------------------------------------------- */
  for (const pratica of dati.pratiche) {
    if (praticaRisolta(pratica.stato)) continue

    aggiungi(
      {
        tipo: 'pratica',
        gravita: 'bloccante',
        descrizione:
          pratica.stato === 'respinta'
            ? `Pratica respinta: ${pratica.label}`
            : `Pratica non ancora inviata: ${pratica.label}`,
        responsabile: pratica.responsabile,
        da: pratica.da,
      },
      pratica.bloccante && regole.praticheBloccantiBloccano,
    )
  }

  /* Condizioni singole ----------------------------------------------------- */
  if (!dati.verificaTecnicaCompletata) {
    aggiungi(
      {
        tipo: 'verifica_tecnica',
        gravita: 'bloccante',
        descrizione: 'Verifica tecnica non completata',
        responsabile: null,
        da: null,
      },
      regole.verificaTecnicaBlocca,
    )
  }

  if (!dati.clienteHaConfermato) {
    aggiungi(
      {
        tipo: 'conferma_cliente',
        gravita: 'bloccante',
        descrizione: 'Il cliente non ha ancora confermato la data',
        responsabile: null,
        da: null,
      },
      regole.confermaClienteBlocca,
    )
  }

  if (dati.accontoIncassato === false) {
    aggiungi(
      {
        tipo: 'acconto',
        gravita: 'bloccante',
        descrizione: 'Manca l’OK amministrativo sull’acconto',
        responsabile: null,
        da: null,
      },
      regole.accontoBlocca,
    )
  }

  const stato: StatoPianificabilita =
    bloccanti.length > 0
      ? 'non_pianificabile'
      : avvisi.length > 0
        ? 'quasi_pianificabile'
        : 'pianificabile'

  const tutti = [...bloccanti, ...avvisi]
  const giorni = tutti
    .map((b) => giorniDa(b.da, adesso))
    .filter((g): g is number => g !== null)

  return {
    stato,
    bloccanti,
    avvisi,
    giorniDiBloccoPiuVecchio: giorni.length > 0 ? Math.max(...giorni) : null,
  }
}

/** Riassunto in una riga, per elenchi e notifiche. */
export function riassumiBlocchi(esito: EsitoReadiness): string {
  if (esito.stato === 'pianificabile') return 'Pronta per la pianificazione'

  const primo = esito.bloccanti[0] ?? esito.avvisi[0]
  if (!primo) return 'Pronta per la pianificazione'

  const totale = esito.bloccanti.length + esito.avvisi.length
  const resto = totale - 1
  return resto > 0 ? `${primo.descrizione} (+${resto})` : primo.descrizione
}
