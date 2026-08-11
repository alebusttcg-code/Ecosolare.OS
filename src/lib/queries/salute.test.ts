import { describe, expect, it } from 'vitest'
import { problemiLeggibili, tuttoBene, type StatoSalute } from './salute'

const SANO: StatoSalute = {
  eventiFalliti: 0,
  primoFallitoIl: null,
  eventiFermi: 0,
  primoFermoIl: null,
  fileSenzaCopia: 0,
  driveAttivo: true,
  fileNelCestino: 0,
}

describe('lettura dello stato di salute', () => {
  it('non dice niente quando non c’è niente da dire', () => {
    // Un avviso che compare anche quando va tutto bene si impara a ignorare.
    expect(tuttoBene(SANO)).toBe(true)
    expect(problemiLeggibili(SANO)).toEqual([])
  })

  it('il cestino pieno non è un problema', () => {
    // È lo stato normale del sistema: i file eliminati restano lì per sempre.
    const conCestino = { ...SANO, fileNelCestino: 240 }
    expect(tuttoBene(conCestino)).toBe(true)
    expect(problemiLeggibili(conCestino)).toEqual([])
  })

  it('segnala gli eventi che si sono arresi, con la data del più vecchio', () => {
    const righe = problemiLeggibili({
      ...SANO,
      eventiFalliti: 3,
      primoFallitoIl: new Date('2026-08-02T10:00:00Z'),
    })
    expect(righe).toHaveLength(1)
    expect(righe[0]).toContain('3 operazioni')
    expect(righe[0]).toContain('2 agosto')
  })

  it('usa il singolare quando l’evento è uno solo', () => {
    const righe = problemiLeggibili({ ...SANO, eventiFalliti: 1, primoFallitoIl: null })
    expect(righe[0]).toContain('1 operazione')
    expect(righe[0]).toContain('ha smesso')
  })

  it('distingue «si è arreso» da «è fermo in coda»', () => {
    // Sono due guasti diversi: il primo è una causa da rimuovere, il secondo
    // è la coda che non viene smaltita affatto.
    const righe = problemiLeggibili({ ...SANO, eventiFalliti: 2, eventiFermi: 5 })
    expect(righe).toHaveLength(2)
    expect(righe[1]).toContain('non viene smaltita')
  })

  it('segnala i file rimasti in una copia sola', () => {
    const righe = problemiLeggibili({ ...SANO, fileSenzaCopia: 12 })
    expect(righe[0]).toContain('12 file')
    expect(righe[0]).toContain('copia sola')
  })

  it('considera guasto qualunque delle tre condizioni', () => {
    expect(tuttoBene({ ...SANO, eventiFalliti: 1 })).toBe(false)
    expect(tuttoBene({ ...SANO, eventiFermi: 1 })).toBe(false)
    expect(tuttoBene({ ...SANO, fileSenzaCopia: 1 })).toBe(false)
  })
})
