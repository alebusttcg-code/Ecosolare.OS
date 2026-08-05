import { describe, expect, it } from 'vitest'
import {
  calcolaImbuto,
  calcolaMaturita,
  calcolaTempi,
  calcolaValori,
  formattaOre,
  formattaPercentuale,
  giorniFra,
  mediana,
  motiviDiPerdita,
  percentuale,
  ripartisci,
  type PraticaCommerciale,
} from './funnel'

const g = (giorno: number, ora = 9): Date =>
  new Date(Date.UTC(2026, 5, giorno, ora, 0, 0))

function pratica(over: Partial<PraticaCommerciale> = {}): PraticaCommerciale {
  return {
    id: Math.random().toString(36).slice(2),
    creatoIl: g(1),
    primaRispostaIl: null,
    sopralluogoFissatoIl: null,
    sopralluogoEffettuatoIl: null,
    preventivoInviatoIl: null,
    contrattoFirmatoIl: null,
    persoIl: null,
    motivoPerdita: null,
    valorePreventivo: null,
    valoreContratto: null,
    fonte: 'sito',
    commerciale: 'Giulia',
    lineaBusiness: 'fotovoltaico',
    ...over,
  }
}

/** Una pratica arrivata fino in fondo. */
const completa = (over: Partial<PraticaCommerciale> = {}) =>
  pratica({
    primaRispostaIl: g(1, 11),
    sopralluogoFissatoIl: g(2),
    sopralluogoEffettuatoIl: g(5),
    preventivoInviatoIl: g(8),
    contrattoFirmatoIl: g(20),
    valorePreventivo: 1_000_000,
    valoreContratto: 1_000_000,
    ...over,
  })

describe('percentuale', () => {
  it('calcola in centesimi di punto', () => {
    expect(percentuale(1, 4)).toBe(2500)
    expect(percentuale(1, 3)).toBe(3333)
  })

  it('restituisce null su denominatore zero, non zero', () => {
    // Zero per cento e "nessun dato" sono due cose diverse: mostrare 0%
    // farebbe sembrare pessimo un periodo semplicemente vuoto.
    expect(percentuale(0, 0)).toBeNull()
    expect(percentuale(5, 0)).toBeNull()
  })
})

describe('mediana', () => {
  it('gestisce numeri dispari e pari di valori', () => {
    expect(mediana([3, 1, 2])).toBe(2)
    expect(mediana([1, 2, 3, 4])).toBe(3)
  })

  it('non si lascia spostare da un valore anomalo', () => {
    // La media di questi sarebbe 22; la mediana descrive il caso tipico.
    expect(mediana([1, 2, 2, 3, 100])).toBe(2)
  })

  it('restituisce null su elenco vuoto', () => {
    expect(mediana([])).toBeNull()
  })
})

describe('giorniFra', () => {
  it('conta i giorni interi', () => {
    expect(giorniFra(g(1), g(5))).toBe(4)
  })

  it('non produce valori negativi su date incoerenti', () => {
    expect(giorniFra(g(10), g(1))).toBe(0)
  })

  it('restituisce null se manca un estremo', () => {
    expect(giorniFra(null, g(5))).toBeNull()
    expect(giorniFra(g(5), null)).toBeNull()
  })
})

describe('calcolaImbuto', () => {
  it('conta ogni tappa e le conversioni', () => {
    const pratiche = [
      completa(),
      completa(),
      pratica({ primaRispostaIl: g(1, 10), sopralluogoFissatoIl: g(2), sopralluogoEffettuatoIl: g(4), preventivoInviatoIl: g(6) }),
      pratica({ primaRispostaIl: g(1, 10), sopralluogoFissatoIl: g(3) }),
      pratica({ primaRispostaIl: g(1, 12) }),
      pratica(),
    ]

    const imbuto = calcolaImbuto(pratiche)
    const per = (c: string) => imbuto.find((t) => t.codice === c)!

    expect(per('lead').conteggio).toBe(6)
    expect(per('contattato').conteggio).toBe(5)
    expect(per('sopralluogo_fissato').conteggio).toBe(4)
    expect(per('sopralluogo_effettuato').conteggio).toBe(3)
    expect(per('preventivo_inviato').conteggio).toBe(3)
    expect(per('contratto').conteggio).toBe(2)

    // 2 contratti su 3 preventivi inviati
    expect(per('contratto').daPrecedente).toBe(6667)
    // 2 contratti su 6 lead
    expect(per('contratto').daLead).toBe(3333)
  })

  it("è MONOTÒNO: chi arriva in fondo conta anche nelle tappe saltate", () => {
    // Caso reale: un contratto firmato senza che nessuno abbia registrato il
    // sopralluogo. Senza questa regola la conversione sopralluogo→contratto
    // sarebbe 100/0 = assurda, e il cruscotto perderebbe credibilità.
    const pratiche = [
      pratica({ contrattoFirmatoIl: g(20), valoreContratto: 500_000 }),
      pratica(),
    ]

    const imbuto = calcolaImbuto(pratiche)
    for (const tappa of imbuto) {
      expect(tappa.conteggio, tappa.codice).toBeGreaterThanOrEqual(1)
      if (tappa.daPrecedente !== null) {
        expect(tappa.daPrecedente, tappa.codice).toBeLessThanOrEqual(10_000)
      }
    }
  })

  it('non produce mai conversioni sopra il 100%', () => {
    const pratiche = [completa(), completa(), pratica()]
    for (const tappa of calcolaImbuto(pratiche)) {
      if (tappa.daLead !== null) expect(tappa.daLead).toBeLessThanOrEqual(10_000)
      if (tappa.daPrecedente !== null) expect(tappa.daPrecedente).toBeLessThanOrEqual(10_000)
    }
  })

  it('la prima tappa non ha una precedente', () => {
    expect(calcolaImbuto([pratica()])[0]?.daPrecedente).toBeNull()
  })

  it('su insieme vuoto restituisce zeri e conversioni nulle', () => {
    const imbuto = calcolaImbuto([])
    expect(imbuto).toHaveLength(6)
    expect(imbuto.every((t) => t.conteggio === 0)).toBe(true)
    expect(imbuto.every((t) => t.daLead === null)).toBe(true)
  })
})

describe('calcolaTempi', () => {
  it('calcola le mediane di ogni tratto', () => {
    const tempi = calcolaTempi([
      completa(),
      completa({ primaRispostaIl: g(1, 13), sopralluogoEffettuatoIl: g(7), preventivoInviatoIl: g(9), contrattoFirmatoIl: g(30) }),
    ])

    expect(tempi.speedToLeadOre).toBe(3) // mediana fra 2 h e 4 h
    expect(tempi.leadASopralluogoGiorni).toBe(5) // mediana fra 4 e 6
    expect(tempi.cicloCompletoGiorni).toBe(24) // mediana fra 19 e 29
  })

  it('ignora le pratiche che non hanno raggiunto la tappa', () => {
    const tempi = calcolaTempi([completa(), pratica(), pratica()])
    expect(tempi.cicloCompletoGiorni).toBe(19)
  })

  it('restituisce null dove non c è nulla da misurare', () => {
    const tempi = calcolaTempi([pratica()])
    expect(tempi.speedToLeadOre).toBeNull()
    expect(tempi.cicloCompletoGiorni).toBeNull()
  })
})

describe('calcolaValori', () => {
  it('somma preventivi, contratti e pipeline aperta', () => {
    const valori = calcolaValori([
      completa({ valoreContratto: 1_500_000 }),
      completa({ valoreContratto: 500_000 }),
      pratica({ preventivoInviatoIl: g(8), valorePreventivo: 800_000 }),
      pratica({ persoIl: g(9), valorePreventivo: 300_000, preventivoInviatoIl: g(8) }),
    ])

    expect(valori.valoreContratti).toBe(2_000_000)
    expect(valori.ticketMedio).toBe(1_000_000)
    // Solo la pratica ancora aperta: la persa non è più pipeline.
    expect(valori.valoreInCorso).toBe(800_000)
  })

  it('non calcola un ticket medio senza contratti', () => {
    expect(calcolaValori([pratica()]).ticketMedio).toBeNull()
  })
})

describe('ripartisci', () => {
  it('raggruppa e ordina per valore portato', () => {
    const righe = ripartisci(
      [
        completa({ fonte: 'passaparola', valoreContratto: 2_000_000 }),
        completa({ fonte: 'sito', valoreContratto: 500_000 }),
        pratica({ fonte: 'sito' }),
        pratica({ fonte: 'sito' }),
      ],
      (p) => p.fonte,
    )

    expect(righe[0]?.chiave).toBe('passaparola')
    expect(righe[0]?.conversione).toBe(10_000)
    expect(righe[1]?.chiave).toBe('sito')
    expect(righe[1]?.lead).toBe(3)
    expect(righe[1]?.conversione).toBe(3333)
  })

  it('raccoglie sotto un etichetta i valori mancanti', () => {
    const righe = ripartisci([pratica({ fonte: null })], (p) => p.fonte)
    expect(righe[0]?.chiave).toBe('Non indicata')
  })
})

describe('motiviDiPerdita', () => {
  it('conta i motivi e quantifica il valore perso', () => {
    const motivi = motiviDiPerdita([
      pratica({ persoIl: g(9), motivoPerdita: 'Prezzo', valorePreventivo: 900_000 }),
      pratica({ persoIl: g(9), motivoPerdita: 'Prezzo', valorePreventivo: 400_000 }),
      pratica({ persoIl: g(9), motivoPerdita: 'Tempi', valorePreventivo: 200_000 }),
      completa(),
    ])

    expect(motivi[0]?.motivo).toBe('Prezzo')
    expect(motivi[0]?.conteggio).toBe(2)
    expect(motivi[0]?.valorePerso).toBe(1_300_000)
    // Quota calcolata sulle sole perse, non sul totale.
    expect(motivi[0]?.quota).toBe(6667)
  })

  it('raggruppa le perdite senza motivo, che sono un dato di per sé', () => {
    const motivi = motiviDiPerdita([pratica({ persoIl: g(9), motivoPerdita: '  ' })])
    expect(motivi[0]?.motivo).toBe('Non indicato')
  })
})

describe('calcolaMaturita', () => {
  it('distingue le pratiche concluse da quelle ancora in corso', () => {
    const m = calcolaMaturita([
      completa(),
      pratica({ persoIl: g(9) }),
      pratica(),
      pratica(),
    ])
    expect(m.concluse).toBe(2)
    expect(m.ancoraAperte).toBe(2)
    expect(m.quotaConclusa).toBe(5000)
  })

  it('su coorte vuota non inventa una quota', () => {
    expect(calcolaMaturita([]).quotaConclusa).toBeNull()
  })
})

describe('formattazione', () => {
  it('mostra un trattino dove il dato non esiste', () => {
    expect(formattaPercentuale(null)).toBe('—')
    expect(formattaOre(null)).toBe('—')
  })

  it('sceglie l unità giusta per il tempo di risposta', () => {
    expect(formattaOre(0.5)).toBe('30 min')
    expect(formattaOre(3.2)).toBe('3.2 h')
    expect(formattaOre(72)).toBe('3 giorni')
  })
})
