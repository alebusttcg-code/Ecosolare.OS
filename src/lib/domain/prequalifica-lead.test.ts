import { describe, expect, it } from 'vitest'
import {
  arricchisciDefinizionePrequalifica,
  risposteDaLead,
  unisciRispostePrequalifica,
} from './prequalifica-lead'
import type { DefinizioneQuestionario } from './questionnaire'

const DEF_MIN: DefinizioneQuestionario = {
  code: 'prova',
  version: 1,
  name: 'Prova',
  sections: [
    {
      code: 'richiedente',
      label: 'Richiedente',
      fields: [
        { code: 'comune', label: 'Comune', type: 'testo' },
        { code: 'tipo_edificio', label: 'Edificio', type: 'scelta', options: [] },
      ],
    },
  ],
}

describe('prequalifica-lead', () => {
  it('precompila indirizzo e anagrafica dal lead', () => {
    const r = risposteDaLead({
      addressLine: 'Via Roma, 12',
      city: 'Milano',
      province: 'MI',
      postalCode: '20100',
      buildingType: 'villetta',
      haAzienda: false,
    })
    expect(r).toMatchObject({
      indirizzo: 'Via Roma, 12',
      comune: 'Milano',
      provincia: 'MI',
      cap: '20100',
      tipo_richiedente: 'privato',
      tipo_edificio: 'villetta',
    })
  })

  it('le risposte salvate sovrascrivono i default del lead', () => {
    const daLead = risposteDaLead({
      addressLine: 'Via Roma, 12',
      city: 'Milano',
      province: 'MI',
      postalCode: '20100',
      buildingType: null,
      haAzienda: false,
    })
    const unite = unisciRispostePrequalifica(daLead, { comune: 'Monza' })
    expect(unite.comune).toBe('Monza')
    expect(unite.indirizzo).toBe('Via Roma, 12')
  })

  it('aggiunge i campi indirizzo al template se assenti', () => {
    const arricchita = arricchisciDefinizionePrequalifica(DEF_MIN)
    const codici = arricchita.sections[0]!.fields.map((c) => c.code)
    expect(codici).toEqual(['indirizzo', 'cap', 'provincia', 'comune', 'tipo_edificio'])
  })
})
