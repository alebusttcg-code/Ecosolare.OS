import type { DefinizioneQuestionario } from '@/lib/domain/questionnaire'

/**
 * Corregge apostrofi e accenti nelle stringhe mostrate in interfaccia.
 *
 * I template versionati in database possono conservare etichette vecchie: questa
 * funzione allinea ciò che si vede (e i messaggi di validazione) alla grammatica
 * corretta senza riscrivere le definizioni già salvate.
 */
export function correggiTestoUi(testo: string): string {
  let out = testo
    .replace(/\bl inverter\b/g, "l'inverter")
    .replace(/\bl accumulo\b/g, "l'accumulo")
    .replace(/\bl approvazione\b/g, "l'approvazione")
    .replace(/\bl invio\b/g, "l'invio")
    .replace(/\bl esito\b/g, "l'esito")
    .replace(/\bl indirizzo\b/g, "l'indirizzo")
    .replace(/\bl immobile\b/g, "l'immobile")
    .replace(/\bdell immobile\b/g, "dell'immobile")
    .replace(/\bdell installazione\b/g, "dell'installazione")
    .replace(/^E previsto\b/, 'È previsto')
    .replace(/^E proprietario\b/, 'È proprietario')
    .replace(/\bAccessibilita\b/g, 'Accessibilità')
    .replace(/\bCriticita\b/g, 'Criticità')
    .replace(/\bAttivita\b/g, 'Attività')
    .replace(/\bOpportunita\b/g, 'Opportunità')
    .replace(/\bopportunita\b/g, 'opportunità')
    .replace(/\bquantita\b/g, 'quantità')
    .replace(/\bValidita\b/g, 'Validità')
    .replace(/\b piu\b/g, ' più')
    .replace(/\sgia\b/g, ' già')
    .replace(/\b servira\b/g, ' servirà')
    .replace(/\b richiedera\b/g, ' richiederà')
    .replace(/\b non e\b/g, ' non è')
    .replace(/\b non puo\b/g, ' non può')
    .replace(/\b e gia\b/g, ' è già')
    .replace(/\b e chiuso\b/g, ' è chiuso')
    .replace(/\b e obbligatorio\b/g, ' è obbligatorio')
    .replace(/\b e modificabile\b/g, ' è modificabile')
    .replace(/\b e sotto\b/g, ' è sotto')
    .replace(/\b e previsto\b/g, ' è previsto')
    .replace(/\blo e,/g, 'lo è,')
    .replace(/\blo e\b/g, 'lo è')
    .replace(/\bSi puo\b/g, 'Si può')
    .replace(/\bun opportunita\b/g, "un'opportunità")

  if (out === 'Si') out = 'Sì'
  return out
}

export function correggiDefinizioneQuestionario(
  definizione: DefinizioneQuestionario,
): DefinizioneQuestionario {
  return {
    ...definizione,
    name: correggiTestoUi(definizione.name),
    sections: definizione.sections.map((sezione) => ({
      ...sezione,
      label: correggiTestoUi(sezione.label),
      description: sezione.description ? correggiTestoUi(sezione.description) : undefined,
      fields: sezione.fields.map((campo) => ({
        ...campo,
        label: correggiTestoUi(campo.label),
        help: campo.help ? correggiTestoUi(campo.help) : undefined,
        options: campo.options?.map((opzione) => ({
          ...opzione,
          label:
            opzione.value === 'si' && opzione.label === 'Si'
              ? 'Sì'
              : correggiTestoUi(opzione.label),
        })),
      })),
    })),
  }
}
