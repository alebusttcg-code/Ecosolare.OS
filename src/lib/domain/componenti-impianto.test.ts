import { describe, expect, it } from 'vitest'
import {
  deduciRuolo,
  estraiMisura,
  leggiConfigurazione,
  nomeComponente,
  normalizzaRiga,
  type RigaComponente,
} from './componenti-impianto'

function riga(parziale: Partial<RigaComponente>): RigaComponente {
  return {
    descrizione: 'Voce',
    quantita: 1,
    ruolo: null,
    potenzaModuloW: null,
    potenzaCaKw: null,
    capacitaKwh: null,
    marca: null,
    modello: null,
    ...parziale,
  }
}

describe('configurazione letta dalle righe', () => {
  it('somma i moduli e calcola la potenza dai dati strutturati', () => {
    const c = leggiConfigurazione([
      riga({ descrizione: 'Modulo', quantita: 12, ruolo: 'modulo', potenzaModuloW: 500 }),
    ])
    expect(c.moduli).toBe(12)
    expect(c.wattPicco).toBe(500)
    expect(c.potenzaKwp).toBeCloseTo(6, 3)
  })

  it('una batteria da 5 kWh e una da 10 kWh danno configurazioni diverse', () => {
    // È la ragione per cui questo modulo esiste: prima la capacità viveva
    // nella descrizione e nessun calcolo poteva leggerla.
    const cinque = leggiConfigurazione([
      riga({ descrizione: 'Accumulo', ruolo: 'accumulo', capacitaKwh: 5 }),
    ])
    const dieci = leggiConfigurazione([
      riga({ descrizione: 'Accumulo', ruolo: 'accumulo', capacitaKwh: 10 }),
    ])
    expect(cinque.capacitaAccumuloKwh).toBe(5)
    expect(dieci.capacitaAccumuloKwh).toBe(10)
    expect(cinque.haAccumulo && dieci.haAccumulo).toBe(true)
  })

  it('somma più batterie', () => {
    const c = leggiConfigurazione([
      riga({ descrizione: 'Modulo batteria', quantita: 3, ruolo: 'accumulo', capacitaKwh: 2.4 }),
    ])
    expect(c.capacitaAccumuloKwh).toBeCloseTo(7.2, 2)
  })

  it('somma le potenze in alternata di più inverter', () => {
    const c = leggiConfigurazione([
      riga({ descrizione: 'Inverter A', ruolo: 'inverter', potenzaCaKw: 5 }),
      riga({ descrizione: 'Inverter B', ruolo: 'inverter', potenzaCaKw: 3 }),
    ])
    expect(c.potenzaCaKw).toBe(8)
  })

  it('senza accumulo la capacità è zero, non nulla', () => {
    const c = leggiConfigurazione([
      riga({ descrizione: 'Modulo', quantita: 10, ruolo: 'modulo', potenzaModuloW: 400 }),
    ])
    expect(c.capacitaAccumuloKwh).toBe(0)
    expect(c.haAccumulo).toBe(false)
  })

  it('con moduli di taglio diverso non dichiara un Wp che non esiste', () => {
    // Una media fra 400 e 500 darebbe 450: un pannello che non è installato da
    // nessuna parte, stampato sul preventivo come se lo fosse.
    const c = leggiConfigurazione([
      riga({ descrizione: 'Modulo A', quantita: 6, ruolo: 'modulo', potenzaModuloW: 400 }),
      riga({ descrizione: 'Modulo B', quantita: 6, ruolo: 'modulo', potenzaModuloW: 500 }),
    ])
    expect(c.wattPicco).toBeNull()
    // La potenza totale però resta calcolabile: 2,4 + 3,0 kWp.
    expect(c.potenzaKwp).toBeCloseTo(5.4, 3)
    expect(c.moduli).toBe(12)
  })

  it('ignora manodopera e servizi', () => {
    const c = leggiConfigurazione([
      riga({ descrizione: 'Modulo', quantita: 12, ruolo: 'modulo', potenzaModuloW: 500 }),
      riga({ descrizione: 'Manodopera elettrica', quantita: 30 }),
      riga({ descrizione: 'Pratiche GSE', quantita: 1 }),
    ])
    expect(c.moduli).toBe(12)
    expect(c.potenzaKwp).toBeCloseTo(6, 3)
  })

  it('riconosce la pompa di calore', () => {
    const c = leggiConfigurazione([
      riga({ descrizione: 'Pompa di calore aria/acqua 12 kW', ruolo: 'pompa_calore' }),
    ])
    expect(c.haPompaCalore).toBe(true)
  })
})

describe('deduzione dal catalogo non ancora compilato', () => {
  it('riconosce i ruoli inequivocabili', () => {
    expect(deduciRuolo('Modulo fotovoltaico 500 W')).toBe('modulo')
    expect(deduciRuolo('Pannelli FV bifacciali')).toBe('modulo')
    expect(deduciRuolo('Inverter ibrido 6 kW')).toBe('inverter')
    expect(deduciRuolo('Batteria di accumulo 10 kWh')).toBe('accumulo')
    expect(deduciRuolo('Pompa di calore aria/acqua')).toBe('pompa_calore')
    expect(deduciRuolo('Struttura di fissaggio per tetto a falda')).toBe('struttura')
    expect(deduciRuolo('Quadri e sezionatori')).toBe('quadro')
  })

  it('non confonde la struttura di supporto dei pannelli con i pannelli', () => {
    expect(deduciRuolo('Struttura di supporto pannelli fotovoltaici')).toBe('struttura')
  })

  it('non scambia un accumulo termico per una batteria', () => {
    // «Accumulo ACS 300 litri» è un boiler: contarlo come batteria
    // gonfierebbe l'autoconsumo di un impianto che non ha alcun accumulo
    // elettrico, e il risparmio mostrato al cliente sarebbe falso.
    expect(deduciRuolo('Accumulo ACS 300 litri')).not.toBe('accumulo')
    expect(deduciRuolo('Accumulo inerziale sanitario')).not.toBe('accumulo')
  })

  it('preferisce sempre il dato strutturato alla deduzione', () => {
    const normalizzata = normalizzaRiga(
      riga({ descrizione: 'Batteria di accumulo 10 kWh', ruolo: 'accumulo', capacitaKwh: 15 }),
    )
    expect(normalizzata.capacitaKwh).toBe(15)
  })

  it('lascia in pace ciò che non riconosce', () => {
    expect(deduciRuolo('Trasporto e scarico materiali')).toBeNull()
    expect(deduciRuolo('Pratiche di connessione')).toBeNull()
  })

  it('recupera le misure dai preventivi già in archivio', () => {
    const c = leggiConfigurazione([
      riga({ descrizione: 'Modulo fotovoltaico 500 W', quantita: 12 }),
      riga({ descrizione: 'Inverter ibrido 6 kW', quantita: 1 }),
      riga({ descrizione: 'Batteria di accumulo 10 kWh', quantita: 1 }),
    ])
    expect(c.moduli).toBe(12)
    expect(c.wattPicco).toBe(500)
    expect(c.potenzaKwp).toBeCloseTo(6, 3)
    expect(c.potenzaCaKw).toBe(6)
    expect(c.capacitaAccumuloKwh).toBe(10)
  })
})

describe('estrazione delle misure', () => {
  it('legge kWh, kW e W senza confonderli', () => {
    expect(estraiMisura('Batteria 10 kWh', 'kWh')).toBe(10)
    expect(estraiMisura('Inverter 6 kW', 'kW')).toBe(6)
    expect(estraiMisura('Modulo 500 W', 'W')).toBe(500)
  })

  it('non legge i kW dentro i kWh', () => {
    // Senza questo controllo una batteria da 10 kWh diventerebbe un inverter
    // da 10 kW, e il sovradimensionamento CC/CA finirebbe stampato sbagliato.
    expect(estraiMisura('Batteria 10 kWh', 'kW')).toBeNull()
  })

  it('non legge i W dentro i kW', () => {
    expect(estraiMisura('Inverter 6 kW', 'W')).toBeNull()
  })

  it('accetta la virgola decimale italiana', () => {
    expect(estraiMisura('Accumulo 2,4 kWh', 'kWh')).toBeCloseTo(2.4, 2)
  })

  it('restituisce null quando non c’è niente da leggere', () => {
    expect(estraiMisura('Manodopera specializzata', 'kW')).toBeNull()
    expect(estraiMisura('Batteria 0 kWh', 'kWh')).toBeNull()
  })
})

describe('come si nomina un componente', () => {
  it('usa marca e modello quando ci sono', () => {
    expect(
      nomeComponente({
        quantita: 12,
        marca: 'Viessmann',
        modello: 'Vitovolt 300-DG M500WT',
        descrizione: 'Modulo fotovoltaico',
      }),
    ).toBe('Viessmann Vitovolt 300-DG M500WT')
  })

  it('ripiega sulla descrizione senza inventare marche', () => {
    // Un preventivo che promette una marca e ne installa un'altra è un
    // problema che non si risolve con una nota a piè di pagina.
    expect(
      nomeComponente({
        quantita: 12,
        marca: null,
        modello: null,
        descrizione: 'Modulo fotovoltaico 500 W',
      }),
    ).toBe('Modulo fotovoltaico 500 W')
  })
})
