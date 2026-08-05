/**
 * Lettura di un estratto conto bancario.
 *
 * Le banche italiane esportano tutte in modo diverso: colonne con nomi diversi,
 * date in tre formati, importi con il punto come separatore delle migliaia,
 * a volte due colonne dare/avere invece di un importo con segno, e quasi sempre
 * qualche riga di intestazione prima di quella vera.
 *
 * Per questo non si presume un formato: si **cerca** la riga di intestazione e
 * si riconoscono le colonne dai loro nomi. Se qualcosa non torna si dice quale
 * riga e perché, invece di importare numeri sbagliati in silenzio — che in un
 * controllo contabile è il danno peggiore.
 */

export interface MovimentoBancario {
  /** Numero della riga nel file, per poter tornare alla fonte. */
  readonly riga: number
  readonly data: Date
  readonly descrizione: string
  /** Centesimi di euro. Positivo in entrata, negativo in uscita. */
  readonly importo: number
}

export interface ErroreRiga {
  readonly riga: number
  readonly motivo: string
  readonly contenuto: string
}

export interface EsitoLettura {
  readonly movimenti: readonly MovimentoBancario[]
  readonly errori: readonly ErroreRiga[]
  readonly colonneRiconosciute: {
    readonly data: string | null
    readonly descrizione: string | null
    readonly importo: string | null
    readonly entrate: string | null
    readonly uscite: string | null
  }
}

/* -------------------------------------------------------------------------- */
/*  Importi e date all'italiana                                               */
/* -------------------------------------------------------------------------- */

/**
 * Converte un importo in centesimi.
 *
 * Gestisce «1.234,56», «1234,56», «1,234.56», «-1.234,56», «1.234,56-»
 * (segno in coda, usato da alcune banche) e «€ 1.234,56».
 */
export function parsaImporto(testo: string): number | null {
  let s = testo.trim().replace(/[€\s ]/g, '')
  if (s === '') return null

  // Segno in coda: alcune banche scrivono «1.234,56-» per le uscite.
  let negativo = false
  if (s.endsWith('-')) {
    negativo = true
    s = s.slice(0, -1)
  }
  if (s.startsWith('-')) {
    negativo = true
    s = s.slice(1)
  }
  if (s.startsWith('+')) s = s.slice(1)

  const haVirgola = s.includes(',')
  const haPunto = s.includes('.')

  if (haVirgola && haPunto) {
    // L'ultimo separatore che compare è quello dei decimali.
    const decimale = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'
    const migliaia = decimale === ',' ? '.' : ','
    s = s.split(migliaia).join('').replace(decimale, '.')
  } else if (haVirgola) {
    s = s.replace(',', '.')
  } else if (haPunto) {
    // Un punto solo: decimale se ha una o due cifre dopo, altrimenti migliaia.
    const dopo = s.length - s.lastIndexOf('.') - 1
    if (dopo === 3) s = s.split('.').join('')
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null

  const numero = Number.parseFloat(s)
  if (!Number.isFinite(numero)) return null

  const centesimi = Math.round(numero * 100)
  return negativo ? -centesimi : centesimi
}

/** Riconosce gg/mm/aaaa, gg-mm-aaaa, aaaa-mm-gg e le varianti a due cifre. */
export function parsaData(testo: string): Date | null {
  const s = testo.trim()
  if (s === '') return null

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (iso) {
    return costruisci(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  }

  const ita = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (ita) {
    const anno = Number(ita[3])
    return costruisci(anno < 100 ? 2000 + anno : anno, Number(ita[2]), Number(ita[1]))
  }

  return null
}

function costruisci(anno: number, mese: number, giorno: number): Date | null {
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null
  const d = new Date(Date.UTC(anno, mese - 1, giorno, 12))
  // Rifiuta il 31 febbraio invece di farlo scivolare a marzo.
  if (d.getUTCMonth() !== mese - 1 || d.getUTCDate() !== giorno) return null
  return d
}

/* -------------------------------------------------------------------------- */
/*  Lettura del CSV                                                            */
/* -------------------------------------------------------------------------- */

/** Divide una riga CSV rispettando le virgolette. */
export function dividiRiga(riga: string, separatore: string): string[] {
  const campi: string[] = []
  let corrente = ''
  let dentroVirgolette = false

  for (let i = 0; i < riga.length; i += 1) {
    const c = riga[i]
    if (c === '"') {
      // Doppie virgolette dentro un campo quotato sono un letterale.
      if (dentroVirgolette && riga[i + 1] === '"') {
        corrente += '"'
        i += 1
      } else {
        dentroVirgolette = !dentroVirgolette
      }
    } else if (c === separatore && !dentroVirgolette) {
      campi.push(corrente)
      corrente = ''
    } else {
      corrente += c
    }
  }
  campi.push(corrente)
  return campi.map((c) => c.trim())
}

function separatorePiuProbabile(righe: readonly string[]): string {
  const candidati = [';', ',', '\t']
  let migliore = ';'
  let punteggio = -1

  for (const sep of candidati) {
    // Il separatore giusto è quello che produce lo stesso numero di colonne
    // sul maggior numero di righe.
    const conteggi = righe.slice(0, 20).map((r) => dividiRiga(r, sep).length)
    const moda = conteggi.reduce<Record<number, number>>((acc, n) => {
      acc[n] = (acc[n] ?? 0) + 1
      return acc
    }, {})
    const [colonne, frequenza] = Object.entries(moda).sort((a, b) => b[1] - a[1])[0] ?? ['1', 0]
    if (Number(colonne) > 1 && frequenza > punteggio) {
      punteggio = frequenza
      migliore = sep
    }
  }
  return migliore
}

const PAROLE = {
  data: ['data valuta', 'data contabile', 'data operazione', 'data', 'date'],
  descrizione: ['descrizione', 'causale', 'operazione', 'dettagli', 'description', 'note'],
  importo: ['importo', 'amount', 'valore'],
  entrate: ['entrate', 'accrediti', 'avere', 'credito', 'in'],
  uscite: ['uscite', 'addebiti', 'dare', 'debito', 'out'],
} as const

function trovaColonna(
  intestazioni: readonly string[],
  parole: readonly string[],
): number | null {
  const normalizzate = intestazioni.map((h) => h.toLowerCase().trim())
  // Prima le corrispondenze esatte, poi quelle parziali: «data valuta» deve
  // vincere su «data» quando ci sono entrambe.
  for (const parola of parole) {
    const esatta = normalizzate.indexOf(parola)
    if (esatta !== -1) return esatta
  }
  for (const parola of parole) {
    const parziale = normalizzate.findIndex((h) => h.includes(parola))
    if (parziale !== -1) return parziale
  }
  return null
}

/**
 * Legge un estratto conto in CSV.
 *
 * Cerca la riga di intestazione fra le prime venti: le banche mettono spesso
 * intestazione, IBAN e saldo prima dei movimenti.
 */
export function leggiCsv(contenuto: string): EsitoLettura {
  const righe = contenuto
    .split(/\r?\n/)
    .map((r) => r.replace(/^﻿/, ''))

  const nonVuote = righe.filter((r) => r.trim() !== '')
  if (nonVuote.length === 0) {
    return {
      movimenti: [],
      errori: [{ riga: 0, motivo: 'Il file è vuoto.', contenuto: '' }],
      colonneRiconosciute: { data: null, descrizione: null, importo: null, entrate: null, uscite: null },
    }
  }

  const separatore = separatorePiuProbabile(nonVuote)

  let indiceIntestazione = -1
  let intestazioni: string[] = []
  for (let i = 0; i < Math.min(righe.length, 25); i += 1) {
    const campi = dividiRiga(righe[i] ?? '', separatore)
    if (campi.length < 2) continue
    const haData = trovaColonna(campi, PAROLE.data) !== null
    const haSoldi =
      trovaColonna(campi, PAROLE.importo) !== null ||
      trovaColonna(campi, PAROLE.entrate) !== null ||
      trovaColonna(campi, PAROLE.uscite) !== null
    if (haData && haSoldi) {
      indiceIntestazione = i
      intestazioni = campi
      break
    }
  }

  if (indiceIntestazione === -1) {
    return {
      movimenti: [],
      errori: [
        {
          riga: 0,
          motivo:
            'Intestazione non riconosciuta: servono almeno una colonna con la data e una con l’importo.',
          contenuto: righe[0] ?? '',
        },
      ],
      colonneRiconosciute: { data: null, descrizione: null, importo: null, entrate: null, uscite: null },
    }
  }

  const colData = trovaColonna(intestazioni, PAROLE.data)!
  const colDescrizione = trovaColonna(intestazioni, PAROLE.descrizione)
  const colImporto = trovaColonna(intestazioni, PAROLE.importo)
  const colEntrate = trovaColonna(intestazioni, PAROLE.entrate)
  const colUscite = trovaColonna(intestazioni, PAROLE.uscite)

  const movimenti: MovimentoBancario[] = []
  const errori: ErroreRiga[] = []

  for (let i = indiceIntestazione + 1; i < righe.length; i += 1) {
    const grezza = righe[i] ?? ''
    if (grezza.trim() === '') continue

    const campi = dividiRiga(grezza, separatore)
    const numeroRiga = i + 1

    const data = parsaData(campi[colData] ?? '')
    if (data === null) {
      // Righe di totale o di saldo in fondo: si saltano senza allarmare, ma
      // si registrano, così chi controlla vede cosa è stato ignorato.
      errori.push({ riga: numeroRiga, motivo: 'Data non leggibile', contenuto: grezza.slice(0, 120) })
      continue
    }

    let importo: number | null = null
    if (colImporto !== null) {
      importo = parsaImporto(campi[colImporto] ?? '')
    }
    if (importo === null && (colEntrate !== null || colUscite !== null)) {
      const entrata = colEntrate !== null ? parsaImporto(campi[colEntrate] ?? '') : null
      const uscita = colUscite !== null ? parsaImporto(campi[colUscite] ?? '') : null
      if (entrata !== null && entrata !== 0) importo = Math.abs(entrata)
      else if (uscita !== null && uscita !== 0) importo = -Math.abs(uscita)
    }

    if (importo === null) {
      errori.push({ riga: numeroRiga, motivo: 'Importo non leggibile', contenuto: grezza.slice(0, 120) })
      continue
    }

    movimenti.push({
      riga: numeroRiga,
      data,
      descrizione: (colDescrizione !== null ? (campi[colDescrizione] ?? '') : '').trim(),
      importo,
    })
  }

  return {
    movimenti,
    errori,
    colonneRiconosciute: {
      data: intestazioni[colData] ?? null,
      descrizione: colDescrizione !== null ? (intestazioni[colDescrizione] ?? null) : null,
      importo: colImporto !== null ? (intestazioni[colImporto] ?? null) : null,
      entrate: colEntrate !== null ? (intestazioni[colEntrate] ?? null) : null,
      uscite: colUscite !== null ? (intestazioni[colUscite] ?? null) : null,
    },
  }
}
