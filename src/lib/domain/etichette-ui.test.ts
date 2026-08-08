import { describe, expect, it } from 'vitest'
import { correggiDefinizioneQuestionario, correggiTestoUi } from './etichette-ui'
import type { DefinizioneQuestionario } from './questionnaire'

describe('correggiTestoUi', () => {
  it('aggiunge apostrofi e accenti mancanti', () => {
    expect(correggiTestoUi('Posizione prevista per l inverter')).toBe(
      "Posizione prevista per l'inverter",
    )
    expect(correggiTestoUi('E previsto un accumulo')).toBe('È previsto un accumulo')
    expect(correggiTestoUi('Attivita gia completata.')).toBe('Attività già completata.')
    expect(correggiTestoUi('Si')).toBe('Sì')
  })

  it('non altera il si impersonale', () => {
    expect(correggiTestoUi('Si apre dalla scheda di un lead.')).toBe(
      'Si apre dalla scheda di un lead.',
    )
    expect(correggiTestoUi('Si legge sulla bolletta.')).toBe('Si legge sulla bolletta.')
  })
})

describe('correggiDefinizioneQuestionario', () => {
  it('corregge etichette nei campi del template', () => {
    const grezzo: DefinizioneQuestionario = {
      code: 'test',
      version: 1,
      name: 'Test',
      sections: [
        {
          code: 's',
          label: 'Accessibilita e cantiere',
          fields: [{ code: 'x', label: 'Posizione prevista per l accumulo', type: 'testo' }],
        },
      ],
    }
    const corretto = correggiDefinizioneQuestionario(grezzo)
    expect(corretto.sections[0]!.label).toBe('Accessibilità e cantiere')
    expect(corretto.sections[0]!.fields[0]!.label).toBe("Posizione prevista per l'accumulo")
  })
})
