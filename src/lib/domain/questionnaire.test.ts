import { describe, expect, it } from 'vitest'
import {
  calcolaCompletezza,
  calcolaPunteggio,
  campiVisibili,
  campoVisibile,
  criticitaRilevate,
  validaRisposte,
  valutaCondizione,
  type Campo,
  type DefinizioneQuestionario,
} from './questionnaire'

const campo = (over: Partial<Campo> & Pick<Campo, 'code' | 'label' | 'type'>): Campo => over

const DEFINIZIONE: DefinizioneQuestionario = {
  code: 'prova',
  version: 1,
  name: 'Prova',
  sections: [
    {
      code: 'generale',
      label: 'Generale',
      fields: [
        campo({
          code: 'proprietario',
          label: 'E proprietario',
          type: 'booleano',
          required: true,
        }),
        campo({
          code: 'tipo_tetto',
          label: 'Tipo di tetto',
          type: 'scelta',
          required: true,
          options: [
            { value: 'falda', label: 'A falda' },
            { value: 'piano', label: 'Piano' },
          ],
          punteggio: { tipo: 'valori', mappa: { falda: 20, piano: 10 } },
        }),
        campo({
          code: 'pendenza',
          label: 'Pendenza',
          type: 'numero',
          required: true,
          min: 0,
          max: 60,
          // Compare solo sui tetti a falda.
          showIf: { campo: 'tipo_tetto', uguale: 'falda' },
        }),
        campo({
          code: 'amianto',
          label: 'Presenza di amianto',
          type: 'booleano',
          criticoSe: true,
        }),
        campo({
          code: 'consumo',
          label: 'Consumo annuo',
          type: 'numero',
          unit: 'kWh',
          punteggio: {
            tipo: 'intervalli',
            intervalli: [
              { a: 2000, punti: 5 },
              { da: 2001, a: 4000, punti: 15 },
              { da: 4001, punti: 30 },
            ],
          },
        }),
        campo({
          code: 'bolletta',
          label: 'Bolletta disponibile',
          type: 'booleano',
          punteggio: { tipo: 'compilato', punti: 10 },
        }),
      ],
    },
  ],
}

describe('valutaCondizione', () => {
  it('confronta uguaglianza e disuguaglianza', () => {
    expect(valutaCondizione({ campo: 'a', uguale: 'x' }, { a: 'x' })).toBe(true)
    expect(valutaCondizione({ campo: 'a', uguale: 'x' }, { a: 'y' })).toBe(false)
    expect(valutaCondizione({ campo: 'a', diverso: 'x' }, { a: 'y' })).toBe(true)
  })

  it('verifica l appartenenza a un insieme', () => {
    expect(valutaCondizione({ campo: 'a', fraI: ['x', 'y'] }, { a: 'y' })).toBe(true)
    expect(valutaCondizione({ campo: 'a', fraI: ['x', 'y'] }, { a: 'z' })).toBe(false)
  })

  it('distingue una risposta falsa dall assenza di risposta', () => {
    // L'errore classico del `if (!valore)`: false e 0 sono risposte.
    expect(valutaCondizione({ campo: 'a', compilato: true }, { a: false })).toBe(true)
    expect(valutaCondizione({ campo: 'a', compilato: true }, { a: 0 })).toBe(true)
    expect(valutaCondizione({ campo: 'a', compilato: true }, { a: '' })).toBe(false)
    expect(valutaCondizione({ campo: 'a', compilato: true }, {})).toBe(false)
    expect(valutaCondizione({ campo: 'a', compilato: true }, { a: [] })).toBe(false)
  })

  it('combina condizioni con tutte e almenoUna', () => {
    const risposte = { a: 'x', b: 2 }
    expect(
      valutaCondizione(
        { tutte: [{ campo: 'a', uguale: 'x' }, { campo: 'b', uguale: 2 }] },
        risposte,
      ),
    ).toBe(true)
    expect(
      valutaCondizione(
        { tutte: [{ campo: 'a', uguale: 'x' }, { campo: 'b', uguale: 9 }] },
        risposte,
      ),
    ).toBe(false)
    expect(
      valutaCondizione(
        { almenoUna: [{ campo: 'a', uguale: 'z' }, { campo: 'b', uguale: 2 }] },
        risposte,
      ),
    ).toBe(true)
  })
})

describe('campoVisibile', () => {
  it('mostra sempre un campo senza condizione', () => {
    expect(campoVisibile(campo({ code: 'a', label: 'A', type: 'testo' }), {})).toBe(true)
  })

  it('nasconde il campo quando la condizione non e soddisfatta', () => {
    const c = campo({
      code: 'a',
      label: 'A',
      type: 'testo',
      showIf: { campo: 'tipo', uguale: 'falda' },
    })
    expect(campoVisibile(c, { tipo: 'piano' })).toBe(false)
    expect(campoVisibile(c, { tipo: 'falda' })).toBe(true)
  })

  it('esclude dai campi visibili quelli condizionati non soddisfatti', () => {
    const visibili = campiVisibili(DEFINIZIONE, { tipo_tetto: 'piano' })
    expect(visibili.map((c) => c.code)).not.toContain('pendenza')
  })
})

describe('validaRisposte', () => {
  it('segnala i campi obbligatori mancanti', () => {
    const violazioni = validaRisposte(DEFINIZIONE, {})
    expect(violazioni.map((v) => v.campo)).toEqual(['proprietario', 'tipo_tetto'])
  })

  it('NON rende obbligatorio un campo non visibile', () => {
    // Regola non negoziabile: altrimenti una condizione mal scritta rende
    // impossibile chiudere il sopralluogo.
    const violazioni = validaRisposte(DEFINIZIONE, {
      proprietario: true,
      tipo_tetto: 'piano',
    })
    expect(violazioni).toEqual([])
  })

  it('rende obbligatorio il campo quando la condizione si avvera', () => {
    const violazioni = validaRisposte(DEFINIZIONE, {
      proprietario: true,
      tipo_tetto: 'falda',
    })
    expect(violazioni.map((v) => v.campo)).toEqual(['pendenza'])
  })

  it('accetta false come risposta a un booleano obbligatorio', () => {
    const violazioni = validaRisposte(DEFINIZIONE, {
      proprietario: false,
      tipo_tetto: 'piano',
    })
    expect(violazioni).toEqual([])
  })

  it('verifica gli intervalli numerici', () => {
    const violazioni = validaRisposte(DEFINIZIONE, {
      proprietario: true,
      tipo_tetto: 'falda',
      pendenza: 95,
    })
    expect(violazioni.map((v) => v.codice)).toEqual(['fuori_intervallo'])
  })

  it('rifiuta un valore non previsto fra le opzioni', () => {
    const violazioni = validaRisposte(DEFINIZIONE, {
      proprietario: true,
      tipo_tetto: 'inventato',
    })
    expect(violazioni.map((v) => v.codice)).toContain('opzione_non_valida')
  })

  it('rifiuta un testo dove serve un numero', () => {
    const violazioni = validaRisposte(DEFINIZIONE, {
      proprietario: true,
      tipo_tetto: 'falda',
      pendenza: 'parecchia',
    })
    expect(violazioni.map((v) => v.codice)).toEqual(['non_numerico'])
  })
})

describe('calcolaCompletezza', () => {
  it('conta solo i campi visibili', () => {
    const c = calcolaCompletezza(DEFINIZIONE, { proprietario: true, tipo_tetto: 'piano' })
    // Il campo "pendenza" non e' visibile su tetto piano.
    expect(c.totali).toBe(5)
    expect(c.compilati).toBe(2)
    expect(c.obbligatoriMancanti).toBe(0)
  })

  it('segnala quanti obbligatori mancano', () => {
    const c = calcolaCompletezza(DEFINIZIONE, {})
    expect(c.obbligatoriMancanti).toBe(2)
    expect(c.percentuale).toBe(0)
  })
})

describe('calcolaPunteggio', () => {
  it('somma i punti dei campi a scelta e a intervallo', () => {
    const esito = calcolaPunteggio(DEFINIZIONE, {
      tipo_tetto: 'falda',
      consumo: 5200,
      bolletta: true,
    })
    expect(esito.punteggio).toBe(20 + 30 + 10)
    expect(esito.massimo).toBe(20 + 30 + 10)
    expect(esito.percentuale).toBe(100)
  })

  it('assegna il punteggio inferiore per le risposte meno favorevoli', () => {
    const esito = calcolaPunteggio(DEFINIZIONE, {
      tipo_tetto: 'piano',
      consumo: 1500,
    })
    expect(esito.punteggio).toBe(10 + 5)
  })

  it('non conta i campi non compilati', () => {
    const esito = calcolaPunteggio(DEFINIZIONE, { tipo_tetto: 'falda' })
    expect(esito.punteggio).toBe(20)
  })

  it('restituisce null quando non ci sono campi a punteggio', () => {
    const vuota: DefinizioneQuestionario = {
      code: 'v',
      version: 1,
      name: 'V',
      sections: [{ code: 's', label: 'S', fields: [campo({ code: 'a', label: 'A', type: 'testo' })] }],
    }
    expect(calcolaPunteggio(vuota, {}).percentuale).toBeNull()
  })

  it('espone il dettaglio per riga, cosi il punteggio e spiegabile', () => {
    const esito = calcolaPunteggio(DEFINIZIONE, { tipo_tetto: 'falda' })
    const voce = esito.dettaglio.find((d) => d.campo === 'tipo_tetto')
    expect(voce?.punti).toBe(20)
  })
})

describe('criticitaRilevate', () => {
  it('rileva le risposte che segnalano una criticita tecnica', () => {
    const criticita = criticitaRilevate(DEFINIZIONE, { amianto: true })
    expect(criticita.map((c) => c.code)).toEqual(['amianto'])
  })

  it('non segnala nulla quando la risposta non e critica', () => {
    expect(criticitaRilevate(DEFINIZIONE, { amianto: false })).toEqual([])
  })
})
