import type { MovimentoBancario } from './estratto-conto'

/**
 * Riconciliazione fra gli OK amministrativi e l'estratto conto.
 *
 * Il senso del controllo: la contabile che manda il cliente dice quello che il
 * cliente *afferma* di aver fatto; l'estratto conto dice quello che è
 * *successo*. Sono due cose diverse, e la differenza si scopre solo mettendole
 * a confronto.
 *
 * Il modulo non decide mai da solo che un pagamento non è arrivato: **segnala
 * ciò che non torna** e lascia la verifica a una persona. Un bonifico può
 * arrivare dal conto del figlio, da una finanziaria, o con la causale scritta
 * male: sono tutti casi legittimi che un abbinamento automatico marcherebbe
 * come ammanchi.
 */

/**
 * Identità del cliente per il confronto con la causale.
 *
 * Cognome e nome restano **separati** invece che in una stringa sola. Il motivo
 * è concreto: cercare di indovinare quale parola sia il cognome partendo da
 * «Marco Rossi» è impossibile — hanno la stessa lunghezza — e sbagliare
 * significa scambiare «bonifico da Marco Bianchi» per un pagamento di Marco
 * Rossi. Il cognome lo abbiamo già come campo a sé: si usa quello.
 *
 * Per le aziende, `cognome` è la ragione sociale e `nome` resta vuoto.
 */
export interface IdentitaCliente {
  readonly cognome: string
  readonly nome: string | null
}

export interface PagamentoAtteso {
  readonly id: string
  readonly commessaId: string
  readonly commessaCodice: string
  readonly cliente: IdentitaCliente
  readonly etichetta: string
  /** Centesimi attesi. */
  readonly importo: number
  /** Quando è stato dato l'OK amministrativo. */
  readonly okAmministrativoIl: Date
}

export type CorrispondenzaNome = 'esatta' | 'parziale' | 'assente'

export type EsitoAbbinamento =
  | 'abbinato'
  | 'importo_diverso'
  | 'solo_importo'
  | 'non_trovato'

export interface Abbinamento {
  readonly pagamento: PagamentoAtteso
  readonly esito: EsitoAbbinamento
  readonly movimento: MovimentoBancario | null
  /** Centesimi: positivo se in banca è arrivato di più. */
  readonly differenza: number | null
  readonly nome: CorrispondenzaNome
}

export interface EsitoRiconciliazione {
  readonly abbinamenti: readonly Abbinamento[]
  /** Tutto ciò che richiede un controllo umano. */
  readonly daVerificare: readonly Abbinamento[]
  /** Entrate in banca che non corrispondono a nessun OK amministrativo. */
  readonly entrateNonAttese: readonly MovimentoBancario[]
}

/* -------------------------------------------------------------------------- */
/*  Confronto dei nomi                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Parole che le banche mettono nelle causali e che non identificano nessuno.
 * Senza toglierle, «BONIFICO» comparirebbe in ogni riga e sembrerebbe un nome.
 */
const RUMORE = new Set([
  'BONIFICO', 'BON', 'SEPA', 'DISPOSTO', 'ORDINANTE', 'BENEFICIARIO',
  'VOSTRO', 'NOSTRO', 'FAVORE', 'DALLA', 'DALLO', 'DELLA', 'DELLO',
  'PAGAMENTO', 'VERSAMENTO', 'ACCREDITO', 'ADDEBITO', 'RIF', 'CRO', 'TRN',
  'FATTURA', 'FATT', 'ACCONTO', 'SALDO', 'ANTICIPO', 'IBAN', 'CAUSALE',
  'IMPIANTO', 'FOTOVOLTAICO', 'LAVORI', 'PER', 'CON', 'DEL', 'SRL', 'SPA',
  'SNC', 'SAS', 'DITTA', 'SIG', 'SIGRA', 'SIGNOR', 'SIGNORA',
])

/** Maiuscolo, senza accenti né punteggiatura, in parole utili. */
export function tokenizza(testo: string): string[] {
  return testo
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !RUMORE.has(t) && !/^\d+$/.test(t))
}

/**
 * Quanto il cliente compare nella causale.
 *
 * **Il cognome è la condizione necessaria.** Nelle causali il nome proprio
 * spesso manca o è abbreviato («M. ROSSI»), ma il cognome c'è quasi sempre.
 * Il contrario non vale: accontentarsi del solo nome proprio farebbe passare
 * «bonifico da Marco Bianchi» come pagamento di Marco Rossi.
 */
export function confrontaNome(
  cliente: IdentitaCliente,
  descrizione: string,
): CorrispondenzaNome {
  const cognome = tokenizza(cliente.cognome)
  if (cognome.length === 0) return 'assente'

  const presenti = new Set(tokenizza(descrizione))

  // Il cognome dev'esserci per intero: «De Angelis» non basta con «Angelis».
  if (!cognome.every((t) => presenti.has(t))) return 'assente'

  const nome = tokenizza(cliente.nome ?? '')
  if (nome.length === 0) return 'esatta'

  return nome.every((t) => presenti.has(t)) ? 'esatta' : 'parziale'
}

/* -------------------------------------------------------------------------- */
/*  Abbinamento                                                                */
/* -------------------------------------------------------------------------- */

export interface OpzioniRiconciliazione {
  /** Giorni di tolleranza fra OK amministrativo e data del movimento. */
  readonly finestraGiorni: number
  /** Scarto tollerato sull'importo, in centesimi (commissioni, arrotondamenti). */
  readonly tolleranzaImporto: number
}

export const OPZIONI_PREDEFINITE: OpzioniRiconciliazione = {
  // Ampia di proposito: il cliente paga quando gli pare, l'OK lo registriamo
  // quando riceviamo la contabile. Stringerla produce falsi allarmi.
  finestraGiorni: 20,
  tolleranzaImporto: 0,
}

const GIORNO = 86_400_000

function dentroLaFinestra(
  pagamento: PagamentoAtteso,
  movimento: MovimentoBancario,
  giorni: number,
): boolean {
  const scarto = Math.abs(movimento.data.getTime() - pagamento.okAmministrativoIl.getTime())
  return scarto <= giorni * GIORNO
}

/**
 * Confronta i pagamenti attesi con i movimenti in entrata.
 *
 * L'assegnazione avviene in tre passate, dalla più affidabile alla meno: prima
 * gli abbinamenti in cui tornano sia nome sia importo, poi quelli con il solo
 * nome, infine quelli con il solo importo. Così un movimento certo non viene
 * «consumato» da un abbinamento debole trovato prima.
 */
export function riconcilia(
  pagamenti: readonly PagamentoAtteso[],
  movimenti: readonly MovimentoBancario[],
  opzioni: OpzioniRiconciliazione = OPZIONI_PREDEFINITE,
): EsitoRiconciliazione {
  // Solo le entrate: gli addebiti non c'entrano con gli incassi dai clienti.
  const entrate = movimenti.filter((m) => m.importo > 0)
  const usati = new Set<number>()
  const risultati = new Map<string, Abbinamento>()

  const disponibili = (p: PagamentoAtteso) =>
    entrate.filter(
      (m) => !usati.has(m.riga) && dentroLaFinestra(p, m, opzioni.finestraGiorni),
    )

  const importoCombacia = (p: PagamentoAtteso, m: MovimentoBancario) =>
    Math.abs(m.importo - p.importo) <= opzioni.tolleranzaImporto

  /* Passata 1: nome e importo ------------------------------------------------ */
  for (const p of pagamenti) {
    const trovato = disponibili(p).find(
      (m) => importoCombacia(p, m) && confrontaNome(p.cliente, m.descrizione) !== 'assente',
    )
    if (trovato) {
      usati.add(trovato.riga)
      risultati.set(p.id, {
        pagamento: p,
        esito: 'abbinato',
        movimento: trovato,
        differenza: trovato.importo - p.importo,
        nome: confrontaNome(p.cliente, trovato.descrizione),
      })
    }
  }

  /* Passata 2: solo il nome -------------------------------------------------- */
  for (const p of pagamenti) {
    if (risultati.has(p.id)) continue
    const candidati = disponibili(p).filter(
      (m) => confrontaNome(p.cliente, m.descrizione) !== 'assente',
    )
    // Fra più movimenti dello stesso cliente si prende quello più vicino
    // all'importo atteso: è il più probabile.
    const trovato = candidati.sort(
      (a, b) => Math.abs(a.importo - p.importo) - Math.abs(b.importo - p.importo),
    )[0]

    if (trovato) {
      usati.add(trovato.riga)
      risultati.set(p.id, {
        pagamento: p,
        esito: 'importo_diverso',
        movimento: trovato,
        differenza: trovato.importo - p.importo,
        nome: confrontaNome(p.cliente, trovato.descrizione),
      })
    }
  }

  /* Passata 3: solo l'importo ------------------------------------------------ */
  for (const p of pagamenti) {
    if (risultati.has(p.id)) continue
    const trovato = disponibili(p).find((m) => importoCombacia(p, m))
    if (trovato) {
      usati.add(trovato.riga)
      risultati.set(p.id, {
        pagamento: p,
        esito: 'solo_importo',
        movimento: trovato,
        differenza: 0,
        nome: 'assente',
      })
    }
  }

  /* Quel che resta non è stato trovato --------------------------------------- */
  for (const p of pagamenti) {
    if (risultati.has(p.id)) continue
    risultati.set(p.id, {
      pagamento: p,
      esito: 'non_trovato',
      movimento: null,
      differenza: null,
      nome: 'assente',
    })
  }

  const abbinamenti = pagamenti.map((p) => risultati.get(p.id)!)

  return {
    abbinamenti,
    daVerificare: abbinamenti.filter((a) => a.esito !== 'abbinato'),
    entrateNonAttese: entrate.filter((m) => !usati.has(m.riga)),
  }
}

/* -------------------------------------------------------------------------- */

export const ETICHETTE_ESITO: Record<EsitoAbbinamento, string> = {
  abbinato: 'Abbinato',
  importo_diverso: 'Importo diverso',
  solo_importo: 'Nome non riscontrato',
  non_trovato: 'Non trovato in banca',
}

export const SPIEGAZIONI: Record<EsitoAbbinamento, string> = {
  abbinato: 'Nome e importo corrispondono a un movimento in entrata.',
  importo_diverso:
    'Il cliente compare in banca, ma con un importo diverso da quello atteso.',
  solo_importo:
    'C’è un movimento dell’importo esatto, ma il nome del cliente non compare nella causale. Può aver pagato un familiare o una finanziaria.',
  non_trovato:
    'Nessun movimento corrispondente: l’OK amministrativo è stato dato ma il denaro non risulta arrivato.',
}
