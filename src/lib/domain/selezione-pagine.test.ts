import { describe, expect, it } from 'vitest'
import { leggiSelezionePagine, scriviSelezionePagine } from './selezione-pagine'

describe('selezione delle pagine da allegare', () => {
  it('il campo vuoto significa «tutte le pagine»', () => {
    expect(leggiSelezionePagine('')).toBeNull()
    expect(leggiSelezionePagine('   ')).toBeNull()
  })

  it('legge elenchi e intervalli, anche mescolati', () => {
    expect(leggiSelezionePagine('1,3,5')).toEqual([1, 3, 5])
    expect(leggiSelezionePagine('2-4')).toEqual([2, 3, 4])
    expect(leggiSelezionePagine('1, 4-6 , 9')).toEqual([1, 4, 5, 6, 9])
  })

  it('ordina e toglie i doppioni: l’ordine lo decide il documento, non chi scrive', () => {
    expect(leggiSelezionePagine('5,1,5,2-3')).toEqual([1, 2, 3, 5])
  })

  it('accetta il trattino lungo, che è quello che arriva incollando da Word', () => {
    expect(leggiSelezionePagine('2–4')).toEqual([2, 3, 4])
  })

  it('rifiuta ciò che non è interpretabile invece di indovinare', () => {
    // Indovinare qui vuol dire allegare al cliente una pagina diversa da quella
    // voluta, e nessuno se ne accorge finché non se ne accorge il cliente.
    expect(leggiSelezionePagine('prima e seconda')).toBe('errore')
    expect(leggiSelezionePagine('0')).toBe('errore')
    expect(leggiSelezionePagine('4-2')).toBe('errore')
    expect(leggiSelezionePagine('1,')).toBe('errore')
    expect(leggiSelezionePagine('1-1000')).toBe('errore')
  })

  it('riscrive la selezione per ripresentarla nel modulo', () => {
    expect(scriviSelezionePagine(null)).toBe('')
    expect(scriviSelezionePagine([1, 2, 5])).toBe('1, 2, 5')
  })
})
