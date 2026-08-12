import { describe, expect, it } from 'vitest'
import {
  deduciRuolo,
  estraiMisura,
  leggiConfigurazione,
  nomeComponente,
  normalizzaRiga,
  prezzoTermicoEffettivoCents,
  scopEffettivo,
  quantitaEComponente,
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

describe('quantità e componente nella frase del preventivo', () => {
  const moduli = { uno: 'modulo', molti: 'moduli' } as const
  const accumulo = { uno: 'sistema di accumulo', molti: 'sistemi di accumulo' } as const

  it('con marca e modello scrive la frase come la scriverebbe un commerciale', () => {
    expect(
      quantitaEComponente(12, moduli, {
        quantita: 12,
        marca: 'Viessmann',
        modello: 'Vitovolt 500',
        descrizione: 'Modulo fotovoltaico',
      }),
    ).toBe('12 moduli Viessmann Vitovolt 500')
  })

  it('accorda il singolare', () => {
    expect(
      quantitaEComponente(1, accumulo, {
        quantita: 1,
        marca: 'BYD',
        modello: 'HVM 11.0',
        descrizione: 'Accumulo',
      }),
    ).toBe('1 sistema di accumulo BYD HVM 11.0')
  })

  it('senza marca lascia parlare la descrizione, senza anteporre il sostantivo', () => {
    // «5 moduli Modulo fotovoltaico 450 W» è come lo scriverebbe una macchina,
    // e finché il catalogo non ha marca e modello è quello che il cliente legge.
    expect(
      quantitaEComponente(5, moduli, {
        quantita: 5,
        marca: null,
        modello: null,
        descrizione: 'Modulo fotovoltaico 450 W',
      }),
    ).toBe('5 × Modulo fotovoltaico 450 W')
  })

  it('regge anche quando il catalogo sceglie un altro sostantivo', () => {
    // Il listino dice «Batteria», noi diremmo «sistema di accumulo»: nessuno
    // dei due deve finire incollato all'altro.
    expect(
      quantitaEComponente(1, accumulo, {
        quantita: 1,
        marca: null,
        modello: null,
        descrizione: 'Batteria di accumulo 10 kWh',
      }),
    ).toBe('1 × Batteria di accumulo 10 kWh')
  })
})

describe('prezzo del blocco termico dedotto dalle righe', () => {
  const riga = (
    descrizione: string,
    importoLordoCents: number,
    ruolo: RigaComponente['ruolo'] = null,
  ): RigaComponente => ({
    descrizione,
    quantita: 1,
    ruolo,
    potenzaModuloW: null,
    potenzaCaKw: null,
    capacitaKwh: null,
    marca: null,
    modello: null,
    importoLordoCents,
  })

  it('somma le righe termiche e ignora tutto il resto', () => {
    const configurazione = leggiConfigurazione([
      riga('Modulo fotovoltaico 500 W', 180_000),
      riga('Pompa di calore 8 kW', 700_000, 'pompa_calore'),
      riga('Manodopera', 120_000),
    ])
    expect(configurazione.prezzoTermicoLordoCents).toBe(700_000)
    expect(configurazione.haPompaCalore).toBe(true)
  })

  it('riconosce la pompa di calore anche senza ruolo nel catalogo', () => {
    // Il catalogo non è compilato dappertutto: la descrizione resta l'ultimo
    // appiglio, ed è lo stesso ripiego che usa il resto della configurazione.
    const configurazione = leggiConfigurazione([riga('Pompa di calore aria-acqua', 550_000)])
    expect(configurazione.prezzoTermicoLordoCents).toBe(550_000)
  })

  it('somma più righe termiche: unità esterna e accumulo sanitario', () => {
    const configurazione = leggiConfigurazione([
      riga('Pompa di calore 8 kW', 700_000, 'pompa_calore'),
      riga('Bollitore', 150_000, 'pompa_calore'),
    ])
    expect(configurazione.prezzoTermicoLordoCents).toBe(850_000)
  })

  it('resta a zero senza righe termiche: è il segnale che fa scattare il ripiego', () => {
    const configurazione = leggiConfigurazione([
      riga('Modulo fotovoltaico 500 W', 180_000),
    ])
    expect(configurazione.prezzoTermicoLordoCents).toBe(0)
    expect(configurazione.haPompaCalore).toBe(false)
  })

  it('non si fa rompere da un importo assente o assurdo', () => {
    const senzaImporto: RigaComponente = { ...riga('Pompa di calore', 0, 'pompa_calore') }
    const configurazione = leggiConfigurazione([
      senzaImporto,
      riga('Pompa di calore usata come sconto', -50_000, 'pompa_calore'),
    ])
    expect(configurazione.prezzoTermicoLordoCents).toBe(0)
  })
})

describe('quale prezzo termico usa il preventivo', () => {
  it('le righe vincono sul valore scritto a mano', () => {
    // È il difetto che questa funzione esiste per chiudere: due numeri per lo
    // stesso impianto, e il piano economico che usava quello sbagliato.
    expect(
      prezzoTermicoEffettivoCents({ prezzoTermicoLordoCents: 700_000 }, 999_900),
    ).toBe(700_000)
  })

  it('senza righe riconosciute ripiega sul valore salvato', () => {
    // I preventivi fatti prima non hanno il ruolo sulle righe: senza ripiego
    // perderebbero la divisione fra quota fotovoltaica e quota termica.
    expect(
      prezzoTermicoEffettivoCents({ prezzoTermicoLordoCents: 0 }, 550_000),
    ).toBe(550_000)
  })

  it('senza né righe né valore salvato resta zero', () => {
    expect(prezzoTermicoEffettivoCents({ prezzoTermicoLordoCents: 0 }, 0)).toBe(0)
    expect(prezzoTermicoEffettivoCents({ prezzoTermicoLordoCents: 0 }, -100)).toBe(0)
  })
})

describe('SCOP della pompa di calore', () => {
  const pompa = (scop: number | null): RigaComponente => ({
    descrizione: 'Pompa di calore 8 kW',
    quantita: 1,
    ruolo: 'pompa_calore',
    potenzaModuloW: null,
    potenzaCaKw: null,
    capacitaKwh: null,
    scop,
    marca: null,
    modello: null,
    importoLordoCents: 700_000,
  })

  it('lo legge dal catalogo', () => {
    expect(leggiConfigurazione([pompa(4.2)]).scopPompaCalore).toBe(4.2)
  })

  it('con due macchine prende la peggiore', () => {
    // Promettere il rendimento della migliore quando in casa ce n'è anche una
    // peggiore è un risparmio che non si verificherà.
    expect(leggiConfigurazione([pompa(4.5), pompa(3.4)]).scopPompaCalore).toBe(3.4)
  })

  it('resta nullo se il catalogo non lo dichiara', () => {
    expect(leggiConfigurazione([pompa(null)]).scopPompaCalore).toBeNull()
  })

  it('il catalogo vince sul valore scritto a mano', () => {
    expect(scopEffettivo({ scopPompaCalore: 4.2 }, 3.0)).toBe(4.2)
  })

  it('senza catalogo ripiega su quello scritto a mano', () => {
    expect(scopEffettivo({ scopPompaCalore: null }, 3.8)).toBe(3.8)
  })

  it('senza né l’uno né l’altro resta zero, e il termico non entra nel piano', () => {
    // Zero è il segnale che `simulaImpiantoFv` legge per lasciare il capitolo
    // descrittivo invece di inventare un risparmio.
    expect(scopEffettivo({ scopPompaCalore: null }, null)).toBe(0)
    expect(scopEffettivo({ scopPompaCalore: null }, 0)).toBe(0)
  })
})
