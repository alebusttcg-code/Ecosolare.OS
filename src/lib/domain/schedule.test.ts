import { describe, expect, it } from 'vitest'
import {
  dataGiornoDaIso,
  isoDaDataGiorno,
  puoCrearePianificazione,
  stageDopoAnnullamento,
  stageDopoPianificazione,
} from './schedule'

const STATI = [
  { code: 'cliente_da_confermare', sortOrder: 90 },
  { code: 'pianificabile', sortOrder: 100 },
  { code: 'cantiere_pianificato', sortOrder: 110 },
  { code: 'installazione_in_corso', sortOrder: 120 },
]

describe('dataGiornoDaIso', () => {
  it('accetta YYYY-MM-DD e produce mezzogiorno UTC', () => {
    const d = dataGiornoDaIso('2026-09-15')
    expect(d).not.toBeNull()
    expect(isoDaDataGiorno(d!)).toBe('2026-09-15')
    expect(d!.getUTCHours()).toBe(12)
  })

  it('rifiuta date impossibili', () => {
    expect(dataGiornoDaIso('2026-02-31')).toBeNull()
    expect(dataGiornoDaIso('15/09/2026')).toBeNull()
    expect(dataGiornoDaIso('')).toBeNull()
  })
})

describe('puoCrearePianificazione', () => {
  it('solo con readiness pianificabile', () => {
    expect(puoCrearePianificazione('pianificabile')).toBe(true)
    expect(puoCrearePianificazione('quasi_pianificabile')).toBe(false)
    expect(puoCrearePianificazione('non_pianificabile')).toBe(false)
  })
})

describe('stageDopoPianificazione', () => {
  it('avanza da pianificabile a cantiere_pianificato', () => {
    expect(stageDopoPianificazione('pianificabile', STATI)).toBe('cantiere_pianificato')
  })

  it('avanza anche da stati precedenti se readiness ha sbloccato', () => {
    expect(stageDopoPianificazione('cliente_da_confermare', STATI)).toBe(
      'cantiere_pianificato',
    )
  })

  it('non torna indietro se già pianificato o oltre', () => {
    expect(stageDopoPianificazione('cantiere_pianificato', STATI)).toBeNull()
    expect(stageDopoPianificazione('installazione_in_corso', STATI)).toBeNull()
  })
})

describe('stageDopoAnnullamento', () => {
  it('riporta a pianificabile solo da cantiere_pianificato', () => {
    expect(stageDopoAnnullamento('cantiere_pianificato')).toBe('pianificabile')
    expect(stageDopoAnnullamento('installazione_in_corso')).toBeNull()
    expect(stageDopoAnnullamento('pianificabile')).toBeNull()
  })
})
