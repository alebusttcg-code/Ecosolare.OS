import { describe, expect, it } from 'vitest'
import { dividiRiga, leggiCsv, parsaData, parsaImporto } from './estratto-conto'
import type { MovimentoBancario } from './estratto-conto'
import {
  confrontaNome,
  riconcilia,
  tokenizza,
  type IdentitaCliente,
  type PagamentoAtteso,
} from './riconciliazione'

const rossi: IdentitaCliente = { cognome: 'Rossi', nome: 'Marco' }

/* ========================================================================== */
/*  Lettura del file                                                          */
/* ========================================================================== */

describe('parsaImporto', () => {
  it('legge il formato italiano', () => {
    expect(parsaImporto('1.234,56')).toBe(123_456)
    expect(parsaImporto('4.500,00')).toBe(450_000)
    expect(parsaImporto('45,00')).toBe(4500)
  })

  it('legge il formato anglosassone', () => {
    expect(parsaImporto('1,234.56')).toBe(123_456)
  })

  it('gestisce il segno davanti e in coda', () => {
    // Alcune banche scrivono le uscite con il meno alla fine.
    expect(parsaImporto('-1.234,56')).toBe(-123_456)
    expect(parsaImporto('1.234,56-')).toBe(-123_456)
    expect(parsaImporto('+500,00')).toBe(50_000)
  })

  it('ignora simboli di valuta e spazi', () => {
    expect(parsaImporto('€ 4.500,00')).toBe(450_000)
    expect(parsaImporto(' 4 500,00 ')).toBe(450_000)
  })

  it('distingue il punto delle migliaia da quello dei decimali', () => {
    expect(parsaImporto('4.500')).toBe(450_000) // migliaia
    expect(parsaImporto('4.50')).toBe(450) // decimali
  })

  it('restituisce null su testo non numerico', () => {
    expect(parsaImporto('saldo')).toBeNull()
    expect(parsaImporto('')).toBeNull()
    expect(parsaImporto('1.2.3.4,5,6')).toBeNull()
  })
})

describe('parsaData', () => {
  it('legge i formati usati dalle banche italiane', () => {
    expect(parsaData('04/08/2026')?.toISOString().slice(0, 10)).toBe('2026-08-04')
    expect(parsaData('04-08-2026')?.toISOString().slice(0, 10)).toBe('2026-08-04')
    expect(parsaData('2026-08-04')?.toISOString().slice(0, 10)).toBe('2026-08-04')
    expect(parsaData('04/08/26')?.toISOString().slice(0, 10)).toBe('2026-08-04')
  })

  it('rifiuta date impossibili invece di farle scivolare', () => {
    // Senza il controllo, il 31 febbraio diventerebbe il 3 marzo.
    expect(parsaData('31/02/2026')).toBeNull()
    expect(parsaData('45/01/2026')).toBeNull()
    expect(parsaData('saldo finale')).toBeNull()
  })
})

describe('dividiRiga', () => {
  it('rispetta le virgolette', () => {
    expect(dividiRiga('a;"b;c";d', ';')).toEqual(['a', 'b;c', 'd'])
  })

  it('gestisce le virgolette raddoppiate', () => {
    expect(dividiRiga('a;"dice ""ciao""";c', ';')).toEqual(['a', 'dice "ciao"', 'c'])
  })
})

describe('leggiCsv', () => {
  it('legge un estratto conto con importo unico e segno', () => {
    const csv = [
      'Data;Descrizione;Importo',
      '04/08/2026;BONIFICO DA ROSSI MARCO;4.500,00',
      '05/08/2026;PAGAMENTO FORNITORE;-1.200,00',
    ].join('\n')

    const esito = leggiCsv(csv)
    expect(esito.movimenti).toHaveLength(2)
    expect(esito.movimenti[0]?.importo).toBe(450_000)
    expect(esito.movimenti[1]?.importo).toBe(-120_000)
    expect(esito.errori).toEqual([])
  })

  it('salta le righe di intestazione che le banche mettono prima dei movimenti', () => {
    const csv = [
      'Estratto conto ordinario',
      'IBAN;IT60X0542811101000000123456',
      'Saldo iniziale;12.500,00',
      '',
      'Data valuta;Causale;Entrate;Uscite',
      '04/08/2026;BONIFICO DA VERDI ANNA;2.000,00;',
      '06/08/2026;ADDEBITO UTENZE;;150,00',
    ].join('\n')

    const esito = leggiCsv(csv)
    expect(esito.movimenti).toHaveLength(2)
    expect(esito.movimenti[0]?.importo).toBe(200_000)
    expect(esito.movimenti[1]?.importo).toBe(-15_000)
    expect(esito.colonneRiconosciute.entrate).toBe('Entrate')
  })

  it('riconosce il separatore virgola', () => {
    const csv = 'Data,Descrizione,Importo\n04/08/2026,BONIFICO DA NERI,"1,234.56"'
    expect(leggiCsv(csv).movimenti[0]?.importo).toBe(123_456)
  })

  it('preferisce «data valuta» a «data» quando ci sono entrambe', () => {
    const csv = 'Data contabile;Data valuta;Descrizione;Importo\n01/08/2026;04/08/2026;X;100,00'
    const esito = leggiCsv(csv)
    expect(esito.colonneRiconosciute.data).toBe('Data valuta')
  })

  it('registra le righe illeggibili invece di ignorarle in silenzio', () => {
    const csv = [
      'Data;Descrizione;Importo',
      '04/08/2026;BONIFICO;100,00',
      'Saldo finale;;15.300,00',
    ].join('\n')

    const esito = leggiCsv(csv)
    expect(esito.movimenti).toHaveLength(1)
    expect(esito.errori).toHaveLength(1)
    expect(esito.errori[0]?.motivo).toContain('Data')
  })

  it('lo dice quando non riconosce l intestazione, invece di importare nulla', () => {
    const esito = leggiCsv('pippo;pluto\n1;2')
    expect(esito.movimenti).toEqual([])
    expect(esito.errori[0]?.motivo).toContain('Intestazione non riconosciuta')
  })
})

/* ========================================================================== */
/*  Confronto dei nomi                                                        */
/* ========================================================================== */

describe('tokenizza', () => {
  it('toglie le parole bancarie che non identificano nessuno', () => {
    expect(tokenizza('BONIFICO SEPA A VOSTRO FAVORE DA ROSSI MARCO')).toEqual([
      'ROSSI',
      'MARCO',
    ])
  })

  it('ignora accenti e punteggiatura', () => {
    expect(tokenizza("D'ANGELO Niccolò")).toEqual(['ANGELO', 'NICCOLO'])
  })

  it('scarta numeri e parole cortissime', () => {
    expect(tokenizza('CRO 123456789 DI ROSSI')).toEqual(['ROSSI'])
  })
})

describe('confrontaNome', () => {
  it('riconosce nome e cognome completi', () => {
    expect(confrontaNome(rossi, 'BONIFICO DA ROSSI MARCO')).toBe('esatta')
  })

  it('accetta il solo cognome, che nelle causali è quello che c è sempre', () => {
    expect(confrontaNome(rossi, 'BONIFICO DA M. ROSSI IMPIANTO')).toBe('parziale')
  })

  it('NON si fa ingannare dal solo nome proprio', () => {
    // Senza il cognome non basta: di Marco ce ne sono tanti, e scambiare il
    // bonifico di Marco Bianchi per quello di Marco Rossi sarebbe un errore
    // contabile, non un dettaglio.
    expect(confrontaNome(rossi, 'BONIFICO DA MARCO BIANCHI')).toBe('assente')
  })

  it('tollera le particelle dei cognomi, che le banche scrivono a modo loro', () => {
    // «DE ANGELIS», «DEANGELIS», «ANGELIS»: la particella si perde spesso nelle
    // causali. È una tolleranza voluta e poco rischiosa — «Angelis» non è un
    // cognome diverso da «De Angelis» — al contrario del nome proprio, che da
    // solo identifica migliaia di persone.
    const deAngelis: IdentitaCliente = { cognome: 'De Angelis', nome: 'Luca' }
    expect(confrontaNome(deAngelis, 'BONIFICO DA DE ANGELIS LUCA')).toBe('esatta')
    expect(confrontaNome(deAngelis, 'BONIFICO DA ANGELIS LUCA')).toBe('esatta')
  })

  it('non confonde due cognomi che si somigliano', () => {
    const deAngelis: IdentitaCliente = { cognome: 'De Angelis', nome: 'Luca' }
    expect(confrontaNome(deAngelis, 'BONIFICO DA ANGELINI LUCA')).toBe('assente')
  })

  it('pretende tutte le parole del cognome composto', () => {
    const doppio: IdentitaCliente = { cognome: 'Ferrari Bruni', nome: 'Anna' }
    expect(confrontaNome(doppio, 'BONIFICO DA FERRARI ANNA')).toBe('assente')
    expect(confrontaNome(doppio, 'BONIFICO DA FERRARI BRUNI ANNA')).toBe('esatta')
  })

  it('dice assente quando non c è nulla in comune', () => {
    expect(confrontaNome(rossi, 'ADDEBITO UTENZE ENEL')).toBe('assente')
  })

  it('funziona con le ragioni sociali, dove il nome non esiste', () => {
    const azienda: IdentitaCliente = { cognome: 'Costruzioni Bianchi SRL', nome: null }
    expect(confrontaNome(azienda, 'BONIFICO COSTRUZIONI BIANCHI SRL')).toBe('esatta')
    expect(confrontaNome(azienda, 'BONIFICO DA EDILIZIA VERDI')).toBe('assente')
  })
})

/* ========================================================================== */
/*  Riconciliazione                                                           */
/* ========================================================================== */

const giorno = (n: number): Date => new Date(Date.UTC(2026, 7, n, 12))

function movimento(
  riga: number,
  n: number,
  descrizione: string,
  importo: number,
): MovimentoBancario {
  return { riga, data: giorno(n), descrizione, importo }
}

function atteso(over: Partial<PagamentoAtteso> = {}): PagamentoAtteso {
  return {
    id: 'p1',
    commessaId: 'c1',
    commessaCodice: 'COM-2026-0001',
    cliente: rossi,
    etichetta: 'Acconto alla firma',
    importo: 450_000,
    okAmministrativoIl: giorno(4),
    ...over,
  }
}

describe('riconcilia', () => {
  it('abbina quando tornano nome e importo', () => {
    const esito = riconcilia(
      [atteso()],
      [movimento(2, 4, 'BONIFICO DA ROSSI MARCO ACCONTO', 450_000)],
    )
    expect(esito.abbinamenti[0]?.esito).toBe('abbinato')
    expect(esito.daVerificare).toEqual([])
  })

  it('SEGNALA un OK amministrativo senza riscontro in banca', () => {
    // È il caso che il controllo esiste per trovare: abbiamo dato l'ok, ma
    // i soldi non risultano arrivati.
    const esito = riconcilia([atteso()], [movimento(2, 4, 'ADDEBITO UTENZE', -15_000)])
    expect(esito.abbinamenti[0]?.esito).toBe('non_trovato')
    expect(esito.daVerificare).toHaveLength(1)
  })

  it('segnala il cliente che ha pagato un importo diverso', () => {
    const esito = riconcilia(
      [atteso()],
      [movimento(2, 4, 'BONIFICO DA ROSSI MARCO', 300_000)],
    )
    const a = esito.abbinamenti[0]!
    expect(a.esito).toBe('importo_diverso')
    expect(a.differenza).toBe(-150_000)
  })

  it('segnala l importo esatto ma senza il nome del cliente', () => {
    // Può aver pagato un familiare o una finanziaria: legittimo, ma va visto.
    const esito = riconcilia(
      [atteso()],
      [movimento(2, 4, 'BONIFICO DA BIANCHI GIUSEPPE', 450_000)],
    )
    expect(esito.abbinamenti[0]?.esito).toBe('solo_importo')
  })

  it('ignora le uscite: gli addebiti non sono incassi', () => {
    const esito = riconcilia(
      [atteso()],
      [movimento(2, 4, 'BONIFICO A ROSSI MARCO', -450_000)],
    )
    expect(esito.abbinamenti[0]?.esito).toBe('non_trovato')
  })

  it('non abbina un movimento fuori dalla finestra temporale', () => {
    const esito = riconcilia(
      [atteso({ okAmministrativoIl: giorno(1) })],
      [movimento(2, 28, 'BONIFICO DA ROSSI MARCO', 450_000)],
    )
    expect(esito.abbinamenti[0]?.esito).toBe('non_trovato')
  })

  it('non usa lo stesso movimento per due pagamenti diversi', () => {
    const esito = riconcilia(
      [
        atteso({ id: 'p1' }),
        atteso({ id: 'p2', commessaCodice: 'COM-2026-0002' }),
      ],
      [movimento(2, 4, 'BONIFICO DA ROSSI MARCO', 450_000)],
    )
    const esiti = esito.abbinamenti.map((a) => a.esito)
    expect(esiti.filter((e) => e === 'abbinato')).toHaveLength(1)
    expect(esiti.filter((e) => e === 'non_trovato')).toHaveLength(1)
  })

  it('dà la precedenza all abbinamento certo su quello debole', () => {
    // Verdi ha pagato l'importo esatto di Rossi. Senza le passate ordinate,
    // il movimento di Verdi potrebbe essere consumato da Rossi.
    const esito = riconcilia(
      [
        atteso({ id: 'rossi', cliente: rossi, importo: 200_000 }),
        atteso({ id: 'verdi', cliente: { cognome: 'Verdi', nome: 'Anna' }, importo: 200_000 }),
      ],
      [
        movimento(2, 4, 'BONIFICO DA VERDI ANNA', 200_000),
        movimento(3, 5, 'BONIFICO DA ROSSI MARCO', 200_000),
      ],
    )
    for (const a of esito.abbinamenti) expect(a.esito).toBe('abbinato')
    expect(esito.abbinamenti.find((a) => a.pagamento.id === 'verdi')?.movimento?.riga).toBe(2)
  })

  it('fra più movimenti dello stesso cliente sceglie il più vicino all atteso', () => {
    const esito = riconcilia(
      [atteso({ importo: 450_000 })],
      [
        movimento(2, 4, 'BONIFICO DA ROSSI MARCO', 100_000),
        movimento(3, 5, 'BONIFICO DA ROSSI MARCO', 440_000),
      ],
    )
    expect(esito.abbinamenti[0]?.movimento?.riga).toBe(3)
  })

  it('elenca le entrate che non corrispondono a nessun OK amministrativo', () => {
    const esito = riconcilia(
      [atteso()],
      [
        movimento(2, 4, 'BONIFICO DA ROSSI MARCO', 450_000),
        movimento(3, 6, 'BONIFICO DA CLIENTE SCONOSCIUTO', 800_000),
      ],
    )
    expect(esito.entrateNonAttese).toHaveLength(1)
    expect(esito.entrateNonAttese[0]?.riga).toBe(3)
  })

  it('tollera lo scarto configurato, per le commissioni', () => {
    const esito = riconcilia(
      [atteso()],
      [movimento(2, 4, 'BONIFICO DA ROSSI MARCO', 449_800)],
      { finestraGiorni: 20, tolleranzaImporto: 200 },
    )
    expect(esito.abbinamenti[0]?.esito).toBe('abbinato')
  })

  it('su nessun pagamento atteso non inventa allarmi', () => {
    const esito = riconcilia([], [movimento(2, 4, 'BONIFICO', 100_000)])
    expect(esito.abbinamenti).toEqual([])
    expect(esito.daVerificare).toEqual([])
    expect(esito.entrateNonAttese).toHaveLength(1)
  })
})
