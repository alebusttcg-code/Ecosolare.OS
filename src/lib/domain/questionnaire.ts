/**
 * Motore dei questionari condizionali.
 *
 * Serve a due cose che il brief descrive quasi con le stesse parole: la
 * prequalifica commerciale (§5.3) e la checklist di sopralluogo (§5.6). Sono lo
 * stesso problema — campi che compaiono in base alle risposte, obbligatorieta',
 * punteggio — quindi e' un motore solo.
 *
 * Interamente puro: nessun database, nessun React. La definizione arriva da
 * `survey_templates.definition` (ADR-004) ed e' versionata, cosi' i questionari
 * compilati mesi fa restano leggibili con la versione con cui sono stati riempiti.
 */

export type TipoCampo =
  | 'testo'
  | 'testo_lungo'
  | 'numero'
  | 'booleano'
  | 'scelta'
  | 'scelta_multipla'
  | 'data'
  | 'foto'

export type Risposta = string | number | boolean | string[] | null | undefined
export type Risposte = Readonly<Record<string, Risposta>>

export interface Opzione {
  readonly value: string
  readonly label: string
}

/** Condizione di visibilita' di un campo, valutata sulle risposte date. */
export type Condizione =
  | { readonly campo: string; readonly uguale: string | number | boolean }
  | { readonly campo: string; readonly diverso: string | number | boolean }
  | { readonly campo: string; readonly fraI: readonly (string | number)[] }
  | { readonly campo: string; readonly compilato: boolean }
  | { readonly tutte: readonly Condizione[] }
  | { readonly almenoUna: readonly Condizione[] }

/** Come un campo contribuisce al punteggio complessivo. */
export type RegolaPunteggio =
  | { readonly tipo: 'valori'; readonly mappa: Readonly<Record<string, number>> }
  | {
      readonly tipo: 'intervalli'
      readonly intervalli: readonly { readonly da?: number; readonly a?: number; readonly punti: number }[]
    }
  | { readonly tipo: 'compilato'; readonly punti: number }

export interface Campo {
  readonly code: string
  readonly label: string
  readonly type: TipoCampo
  readonly required?: boolean
  readonly options?: readonly Opzione[]
  readonly help?: string
  readonly unit?: string
  readonly min?: number
  readonly max?: number
  readonly showIf?: Condizione
  readonly punteggio?: RegolaPunteggio
  /** Se true, una risposta affermativa segnala una criticita' tecnica. */
  readonly criticoSe?: string | boolean
}

export interface Sezione {
  readonly code: string
  readonly label: string
  readonly description?: string
  readonly fields: readonly Campo[]
}

export interface DefinizioneQuestionario {
  readonly code: string
  readonly version: number
  readonly name: string
  readonly sections: readonly Sezione[]
}

/* -------------------------------------------------------------------------- */
/*  Visibilita'                                                                */
/* -------------------------------------------------------------------------- */

function eCompilata(valore: Risposta): boolean {
  if (valore === null || valore === undefined) return false
  if (typeof valore === 'string') return valore.trim() !== ''
  if (Array.isArray(valore)) return valore.length > 0
  // `false` e `0` sono risposte a tutti gli effetti: non vanno confuse con
  // l'assenza di risposta. E' l'errore classico del `if (!valore)`.
  return true
}

export function valutaCondizione(condizione: Condizione, risposte: Risposte): boolean {
  if ('tutte' in condizione) {
    return condizione.tutte.every((c) => valutaCondizione(c, risposte))
  }
  if ('almenoUna' in condizione) {
    return condizione.almenoUna.some((c) => valutaCondizione(c, risposte))
  }

  const valore = risposte[condizione.campo]

  if ('compilato' in condizione) return eCompilata(valore) === condizione.compilato
  if ('uguale' in condizione) return valore === condizione.uguale
  if ('diverso' in condizione) return valore !== condizione.diverso
  if ('fraI' in condizione) {
    return (
      (typeof valore === 'string' || typeof valore === 'number') &&
      condizione.fraI.includes(valore)
    )
  }
  return true
}

export function campoVisibile(campo: Campo, risposte: Risposte): boolean {
  if (!campo.showIf) return true
  return valutaCondizione(campo.showIf, risposte)
}

/** I soli campi effettivamente mostrati, date le risposte correnti. */
export function campiVisibili(
  definizione: DefinizioneQuestionario,
  risposte: Risposte,
): Campo[] {
  return definizione.sections
    .flatMap((s) => s.fields)
    .filter((campo) => campoVisibile(campo, risposte))
}

/* -------------------------------------------------------------------------- */
/*  Validazione                                                                */
/* -------------------------------------------------------------------------- */

export type CodiceViolazione =
  | 'obbligatorio'
  | 'fuori_intervallo'
  | 'non_numerico'
  | 'opzione_non_valida'

export interface Violazione {
  readonly campo: string
  readonly label: string
  readonly codice: CodiceViolazione
  readonly messaggio: string
}

/**
 * Verifica le risposte.
 *
 * Regola non negoziabile: **un campo non visibile non e' mai obbligatorio**.
 * Senza questa, una condizione mal scritta rende impossibile chiudere il
 * sopralluogo e l'unica via d'uscita diventa aggirare il sistema.
 */
export function validaRisposte(
  definizione: DefinizioneQuestionario,
  risposte: Risposte,
): Violazione[] {
  const violazioni: Violazione[] = []

  for (const campo of campiVisibili(definizione, risposte)) {
    const valore = risposte[campo.code]
    const compilato = eCompilata(valore)

    if (campo.required && !compilato) {
      violazioni.push({
        campo: campo.code,
        label: campo.label,
        codice: 'obbligatorio',
        messaggio: `"${campo.label}" e obbligatorio.`,
      })
      continue
    }

    if (!compilato) continue

    if (campo.type === 'numero') {
      const numero = typeof valore === 'number' ? valore : Number.parseFloat(String(valore))
      if (!Number.isFinite(numero)) {
        violazioni.push({
          campo: campo.code,
          label: campo.label,
          codice: 'non_numerico',
          messaggio: `"${campo.label}" deve essere un numero.`,
        })
        continue
      }
      if (
        (campo.min !== undefined && numero < campo.min) ||
        (campo.max !== undefined && numero > campo.max)
      ) {
        violazioni.push({
          campo: campo.code,
          label: campo.label,
          codice: 'fuori_intervallo',
          messaggio: `"${campo.label}" deve essere compreso fra ${campo.min ?? '−∞'} e ${campo.max ?? '+∞'}.`,
        })
      }
    }

    if (campo.type === 'scelta' && campo.options) {
      const ammessi = campo.options.map((o) => o.value)
      if (typeof valore === 'string' && !ammessi.includes(valore)) {
        violazioni.push({
          campo: campo.code,
          label: campo.label,
          codice: 'opzione_non_valida',
          messaggio: `"${campo.label}" contiene un valore non previsto.`,
        })
      }
    }

    if (campo.type === 'scelta_multipla' && campo.options && Array.isArray(valore)) {
      const ammessi = campo.options.map((o) => o.value)
      if (valore.some((v) => !ammessi.includes(v))) {
        violazioni.push({
          campo: campo.code,
          label: campo.label,
          codice: 'opzione_non_valida',
          messaggio: `"${campo.label}" contiene un valore non previsto.`,
        })
      }
    }
  }

  return violazioni
}

/* -------------------------------------------------------------------------- */
/*  Completezza e punteggio                                                    */
/* -------------------------------------------------------------------------- */

export interface Completezza {
  readonly compilati: number
  readonly totali: number
  readonly obbligatoriMancanti: number
  /** Percentuale intera 0–100. */
  readonly percentuale: number
}

export function calcolaCompletezza(
  definizione: DefinizioneQuestionario,
  risposte: Risposte,
): Completezza {
  const visibili = campiVisibili(definizione, risposte)
  const compilati = visibili.filter((c) => eCompilata(risposte[c.code])).length
  const obbligatoriMancanti = visibili.filter(
    (c) => c.required && !eCompilata(risposte[c.code]),
  ).length

  return {
    compilati,
    totali: visibili.length,
    obbligatoriMancanti,
    percentuale: visibili.length === 0 ? 0 : Math.round((compilati / visibili.length) * 100),
  }
}

export interface DettaglioPunteggio {
  readonly campo: string
  readonly label: string
  readonly punti: number
}

export interface EsitoPunteggio {
  readonly punteggio: number
  readonly massimo: number
  /** 0–100, oppure null se nessun campo a punteggio e' visibile. */
  readonly percentuale: number | null
  readonly dettaglio: readonly DettaglioPunteggio[]
}

function puntiPerCampo(campo: Campo, valore: Risposta): number {
  if (!campo.punteggio) return 0
  const regola = campo.punteggio

  if (regola.tipo === 'compilato') return eCompilata(valore) ? regola.punti : 0

  if (regola.tipo === 'valori') {
    if (Array.isArray(valore)) {
      return valore.reduce((somma, v) => somma + (regola.mappa[v] ?? 0), 0)
    }
    return regola.mappa[String(valore)] ?? 0
  }

  const numero = typeof valore === 'number' ? valore : Number.parseFloat(String(valore))
  if (!Number.isFinite(numero)) return 0
  for (const intervallo of regola.intervalli) {
    const sopraMinimo = intervallo.da === undefined || numero >= intervallo.da
    const sottoMassimo = intervallo.a === undefined || numero <= intervallo.a
    if (sopraMinimo && sottoMassimo) return intervallo.punti
  }
  return 0
}

function massimoPerCampo(campo: Campo): number {
  if (!campo.punteggio) return 0
  const regola = campo.punteggio
  if (regola.tipo === 'compilato') return regola.punti
  if (regola.tipo === 'valori') return Math.max(0, ...Object.values(regola.mappa))
  return Math.max(0, ...regola.intervalli.map((i) => i.punti))
}

/**
 * Punteggio di prequalifica.
 *
 * Contano solo i campi visibili: un campo nascosto da una condizione non deve
 * abbassare il punteggio massimo raggiungibile, altrimenti due richieste
 * legittimamente diverse non sarebbero confrontabili.
 *
 * Il punteggio **non sostituisce la valutazione commerciale** (§5.3): ordina
 * le priorita', non decide.
 */
export function calcolaPunteggio(
  definizione: DefinizioneQuestionario,
  risposte: Risposte,
): EsitoPunteggio {
  const visibili = campiVisibili(definizione, risposte).filter((c) => c.punteggio)

  const dettaglio = visibili.map((campo) => ({
    campo: campo.code,
    label: campo.label,
    punti: puntiPerCampo(campo, risposte[campo.code]),
  }))

  const punteggio = dettaglio.reduce((somma, d) => somma + d.punti, 0)
  const massimo = visibili.reduce((somma, c) => somma + massimoPerCampo(c), 0)

  return {
    punteggio,
    massimo,
    percentuale: massimo === 0 ? null : Math.round((punteggio / massimo) * 100),
    dettaglio,
  }
}

/** I campi che segnalano una criticita' tecnica, date le risposte. */
export function criticitaRilevate(
  definizione: DefinizioneQuestionario,
  risposte: Risposte,
): Campo[] {
  return campiVisibili(definizione, risposte).filter((campo) => {
    if (campo.criticoSe === undefined) return false
    return risposte[campo.code] === campo.criticoSe
  })
}
