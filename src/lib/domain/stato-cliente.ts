/**
 * Come si racconta al cliente lo stato del suo impianto.
 *
 * Gli stati interni sono scritti per chi lavora — «materiali_da_ordinare»,
 * «pratiche_inviate» — e al cliente non dicono niente di utile: dicono cosa
 * stiamo facendo noi, non a che punto è il *suo* impianto né se deve fare
 * qualcosa. Qui la traduzione, e le fasi vengono raggruppate in cinque
 * passaggi, perché diciotto pallini in fila comunicano solo lentezza.
 *
 * Modulo puro: nessun database. È anche il posto dove si cambiano le parole
 * senza toccare la pagina.
 */

export type FaseCliente =
  | 'documenti'
  | 'progetto'
  | 'materiali'
  | 'installazione'
  | 'conclusione'

export interface FaseDescritta {
  readonly fase: FaseCliente
  readonly titolo: string
  /** Cosa sta succedendo, in una riga, dal punto di vista del cliente. */
  readonly cosaSuccede: string
}

export const FASI_CLIENTE: readonly FaseDescritta[] = [
  {
    fase: 'documenti',
    titolo: 'Raccolta documenti',
    cosaSuccede: 'Mettiamo insieme i documenti necessari per avviare le pratiche.',
  },
  {
    fase: 'progetto',
    titolo: 'Progetto e pratiche',
    cosaSuccede:
      'Il nostro tecnico definisce il progetto e prepariamo le pratiche per il distributore.',
  },
  {
    fase: 'materiali',
    titolo: 'Materiali',
    cosaSuccede: 'Ordiniamo moduli, inverter e strutture, e ne attendiamo la consegna.',
  },
  {
    fase: 'installazione',
    titolo: 'Installazione',
    cosaSuccede: 'Concordiamo la data e la squadra monta l’impianto.',
  },
  {
    fase: 'conclusione',
    titolo: 'Collaudo e chiusura',
    cosaSuccede: 'Collaudo, ultime pratiche e attivazione.',
  },
]

/** Dallo stato interno alla fase che vede il cliente. */
const FASE_PER_STATO: Record<string, FaseCliente> = {
  contratto_ricevuto: 'documenti',
  documenti_da_completare: 'documenti',
  verifica_tecnica: 'progetto',
  pratiche_in_preparazione: 'progetto',
  pratiche_inviate: 'progetto',
  materiali_da_ordinare: 'materiali',
  materiali_ordinati: 'materiali',
  materiali_disponibili: 'materiali',
  cliente_da_confermare: 'installazione',
  pianificabile: 'installazione',
  cantiere_pianificato: 'installazione',
  installazione_in_corso: 'installazione',
  installazione_completata: 'conclusione',
  collaudo: 'conclusione',
  pratiche_finali: 'conclusione',
  fatturazione: 'conclusione',
  saldo: 'conclusione',
  chiusa: 'conclusione',
}

/** Stati in cui la commessa è ferma per una ragione che va detta, non nascosta. */
const STATI_FERMI = new Set(['sospesa', 'bloccata'])

export interface StatoRaccontato {
  readonly faseCorrente: FaseCliente | null
  readonly indiceFase: number
  readonly titolo: string
  readonly messaggio: string
  readonly ferma: boolean
  readonly conclusa: boolean
}

export function raccontaStato(params: {
  codiceStato: string
  /** Documenti che il cliente deve ancora fornire. */
  documentiMancanti: number
  dataInstallazione: Date | null
}): StatoRaccontato {
  if (STATI_FERMI.has(params.codiceStato)) {
    return {
      faseCorrente: null,
      indiceFase: -1,
      titolo: 'Lavori momentaneamente sospesi',
      // Non si inventa una spiegazione che non abbiamo: si dice che ci
      // faremo sentire noi, che è l'unica cosa vera e utile.
      messaggio:
        'I lavori sono temporaneamente fermi. Ti ricontattiamo noi appena riprendono.',
      ferma: true,
      conclusa: false,
    }
  }

  if (params.codiceStato === 'chiusa') {
    return {
      faseCorrente: 'conclusione',
      indiceFase: FASI_CLIENTE.length - 1,
      titolo: 'Impianto completato',
      messaggio: 'L’impianto è installato e le pratiche sono chiuse. Grazie!',
      ferma: false,
      conclusa: true,
    }
  }

  const fase = FASE_PER_STATO[params.codiceStato] ?? 'documenti'
  const indice = FASI_CLIENTE.findIndex((f) => f.fase === fase)
  const descritta = FASI_CLIENTE[indice]!

  // Il messaggio che conta di più: se manca qualcosa al cliente, tutto il
  // resto è secondario, perché è l'unica cosa su cui può agire lui.
  const messaggio =
    params.documentiMancanti > 0
      ? `Aspettiamo ${params.documentiMancanti === 1 ? 'un documento' : `${params.documentiMancanti} documenti`} da te: finché non ${params.documentiMancanti === 1 ? 'arriva' : 'arrivano'}, i lavori restano fermi a questo punto.`
      : params.dataInstallazione
        ? 'La data di installazione è fissata. Ti ricontattiamo per i dettagli.'
        : descritta.cosaSuccede

  return {
    faseCorrente: fase,
    indiceFase: indice,
    titolo: descritta.titolo,
    messaggio,
    ferma: false,
    conclusa: false,
  }
}
