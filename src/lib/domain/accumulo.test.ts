import { describe, expect, it } from 'vitest'
import {
  calcolaEffettoAccumulo,
  PROFONDITA_SCARICA_DEFAULT,
  RENDIMENTO_CICLO_DEFAULT,
} from './accumulo'

/** Il caso del preventivo di prova che ha fatto emergere il difetto. */
const CASO = {
  produzioneAnnuaKwh: 6144,
  consumoAnnuoKwh: 4000,
  frazioneAutoconsumoDiretta: 0.4,
}

describe('effetto della batteria sull’autoconsumo', () => {
  it('senza batteria non cambia niente', () => {
    const esito = calcolaEffettoAccumulo({ ...CASO, capacitaNominaleKwh: 0 })
    expect(esito.haAccumulo).toBe(false)
    expect(esito.frazioneAutoconsumoConAccumulo).toBe(0.4)
    expect(esito.energiaRecuperataKwh).toBe(0)
  })

  it('una batteria da 10 kWh alza davvero l’autoconsumo', () => {
    // È il difetto da cui è partito tutto: 6.000 € di accumulo che non
    // spostavano un solo numero della simulazione.
    const esito = calcolaEffettoAccumulo({ ...CASO, capacitaNominaleKwh: 10 })
    expect(esito.haAccumulo).toBe(true)
    expect(esito.frazioneAutoconsumoConAccumulo).toBeGreaterThan(0.4)
    expect(esito.energiaRecuperataKwh).toBeGreaterThan(500)
  })

  it('non supera mai né la produzione né il consumo', () => {
    // Una batteria enorme non può far autoconsumare più di quanto si consuma.
    const esito = calcolaEffettoAccumulo({ ...CASO, capacitaNominaleKwh: 200 })
    const autoconsumo = esito.frazioneAutoconsumoConAccumulo * CASO.produzioneAnnuaKwh
    expect(autoconsumo).toBeLessThanOrEqual(CASO.consumoAnnuoKwh + 1)
    expect(esito.frazioneAutoconsumoConAccumulo).toBeLessThanOrEqual(1)
  })

  it('cresce con la capacità, ma con rendimenti decrescenti', () => {
    // Raddoppiare la batteria non raddoppia il beneficio: è il fatto che
    // giustifica il dimensionamento e che un modello lineare nasconderebbe.
    const cinque = calcolaEffettoAccumulo({ ...CASO, capacitaNominaleKwh: 5 })
    const dieci = calcolaEffettoAccumulo({ ...CASO, capacitaNominaleKwh: 10 })
    const venti = calcolaEffettoAccumulo({ ...CASO, capacitaNominaleKwh: 20 })

    expect(dieci.energiaRecuperataKwh).toBeGreaterThan(cinque.energiaRecuperataKwh)
    expect(venti.energiaRecuperataKwh).toBeGreaterThanOrEqual(dieci.energiaRecuperataKwh)

    const primoSalto = dieci.energiaRecuperataKwh - cinque.energiaRecuperataKwh
    const secondoSalto = venti.energiaRecuperataKwh - dieci.energiaRecuperataKwh
    expect(secondoSalto).toBeLessThan(primoSalto)
  })

  it('d’inverno non c’è surplus da immagazzinare', () => {
    // La ragione per cui il calcolo è mensile: su media annua la batteria
    // sembrerebbe coprire quasi tutto il prelievo, e sarebbe falso.
    const esito = calcolaEffettoAccumulo({ ...CASO, capacitaNominaleKwh: 10 })
    const capacitaAnnuaTeorica =
      10 * PROFONDITA_SCARICA_DEFAULT * 365 * RENDIMENTO_CICLO_DEFAULT
    expect(esito.energiaRecuperataKwh).toBeLessThan(capacitaAnnuaTeorica)

    // E il prelievo residuo non va mai a zero.
    const autoconsumo = esito.frazioneAutoconsumoConAccumulo * CASO.produzioneAnnuaKwh
    expect(CASO.consumoAnnuoKwh - autoconsumo).toBeGreaterThan(0)
  })

  it('senza consumi la batteria non serve a niente', () => {
    // Impianto di sola cessione: non c'è prelievo da sostituire.
    const esito = calcolaEffettoAccumulo({
      ...CASO,
      consumoAnnuoKwh: 0,
      capacitaNominaleKwh: 10,
    })
    expect(esito.energiaRecuperataKwh).toBe(0)
  })

  it('con autoconsumo diretto già totale non aggiunge nulla', () => {
    const esito = calcolaEffettoAccumulo({
      produzioneAnnuaKwh: 3000,
      consumoAnnuoKwh: 9000,
      frazioneAutoconsumoDiretta: 1,
      capacitaNominaleKwh: 10,
    })
    expect(esito.energiaRecuperataKwh).toBe(0)
  })

  it('conta i cicli equivalenti, che dicono se è ben dimensionata', () => {
    const esito = calcolaEffettoAccumulo({ ...CASO, capacitaNominaleKwh: 10 })
    // Una batteria domestica ben dimensionata fa fra 150 e 300 cicli l'anno.
    expect(esito.cicliEquivalentiAnno).toBeGreaterThan(50)
    expect(esito.cicliEquivalentiAnno).toBeLessThan(365)
  })

  it('la capacità utile è meno di quella di targa', () => {
    // Nessuna batteria si scarica al 100%: dichiararlo sarebbe promettere
    // un'autonomia che il produttore stesso non concede.
    const esito = calcolaEffettoAccumulo({ ...CASO, capacitaNominaleKwh: 10 })
    expect(esito.capacitaUtileKwh).toBeLessThan(10)
    expect(esito.capacitaUtileKwh).toBeCloseTo(9, 1)
  })

  it('regge input assurdi senza produrre numeri assurdi', () => {
    for (const capacita of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const esito = calcolaEffettoAccumulo({ ...CASO, capacitaNominaleKwh: capacita })
      expect(Number.isFinite(esito.frazioneAutoconsumoConAccumulo)).toBe(true)
      expect(esito.frazioneAutoconsumoConAccumulo).toBeGreaterThanOrEqual(0)
      expect(esito.frazioneAutoconsumoConAccumulo).toBeLessThanOrEqual(1)
    }
  })
})
