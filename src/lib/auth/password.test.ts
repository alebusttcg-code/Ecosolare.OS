import { describe, expect, it } from 'vitest'
import {
  calcolaImpronta,
  generaPasswordIniziale,
  LUNGHEZZA_MINIMA_PASSWORD,
  validaPassword,
  verificaPassword,
} from './password'

describe('impronte delle password', () => {
  it('riconosce la password corretta', async () => {
    const impronta = await calcolaImpronta('una frase abbastanza lunga')
    await expect(verificaPassword('una frase abbastanza lunga', impronta)).resolves.toBe(
      true,
    )
  })

  it('rifiuta una password diversa, anche di un solo carattere', async () => {
    const impronta = await calcolaImpronta('una frase abbastanza lunga')
    await expect(verificaPassword('una frase abbastanza lungA', impronta)).resolves.toBe(
      false,
    )
  })

  it('produce impronte diverse per la stessa password', async () => {
    // Sale casuale: senza, due persone con la stessa password avrebbero la
    // stessa riga, e chi legge il database lo vedrebbe a occhio.
    const a = await calcolaImpronta('la stessa password')
    const b = await calcolaImpronta('la stessa password')
    expect(a).not.toEqual(b)
    await expect(verificaPassword('la stessa password', a)).resolves.toBe(true)
    await expect(verificaPassword('la stessa password', b)).resolves.toBe(true)
  })

  it('non solleva mai su impronte malformate: restituisce falso', async () => {
    for (const rotta of ['', 'boh', 'scrypt$1$2$3', 'argon2$a$b$c$d$e', 'scrypt$a$b$c$d$e']) {
      await expect(verificaPassword('qualunque cosa', rotta)).resolves.toBe(false)
    }
  })

  it('rifiuta parametri fuori scala, che bloccherebbero il processo', async () => {
    // Una riga manomessa con un costo enorme sarebbe un modo per fermare il
    // server con un solo tentativo di accesso.
    const impronta = `scrypt$99999999$8$1$c2FsZQ==$aGFzaA==`
    await expect(verificaPassword('qualunque cosa', impronta)).resolves.toBe(false)
  })

  it('tratta come uguali due scritture Unicode equivalenti', async () => {
    // «è» composta e precomposta si digitano allo stesso modo su tastiere
    // diverse: senza normalizzazione, la password funzionerebbe su un
    // computer e non sull'altro.
    const precomposta = 'perch\u00e8 la password \u00e8 lunga' // NFC
    const composta = 'perche\u0300 la password e\u0300 lunga' // NFD
    expect(precomposta).not.toBe(composta)

    const impronta = await calcolaImpronta(precomposta)
    await expect(verificaPassword(composta, impronta)).resolves.toBe(true)
  })
})

describe('regole sulla password', () => {
  it('accetta dalla lunghezza minima in su', () => {
    expect(validaPassword('a'.repeat(LUNGHEZZA_MINIMA_PASSWORD))).toBeNull()
  })

  it('rifiuta le password corte', () => {
    expect(validaPassword('a'.repeat(LUNGHEZZA_MINIMA_PASSWORD - 1))).not.toBeNull()
  })

  it('rifiuta le password assurdamente lunghe', () => {
    // Il limite non è estetico: scrypt su 10 MB di input occupa la CPU.
    expect(validaPassword('a'.repeat(201))).not.toBeNull()
  })
})

describe('password iniziali generate', () => {
  it('ha la lunghezza richiesta e supera le regole', () => {
    for (let i = 0; i < 50; i += 1) {
      const password = generaPasswordIniziale()
      expect(password).toHaveLength(16)
      expect(validaPassword(password)).toBeNull()
    }
  })

  it('non usa caratteri che si confondono leggendoli ad alta voce', () => {
    const generate = Array.from({ length: 200 }, () => generaPasswordIniziale()).join('')
    expect(generate).not.toMatch(/[0O1lI]/)
  })

  it('non ripete lo stesso valore', () => {
    const insieme = new Set(Array.from({ length: 200 }, () => generaPasswordIniziale()))
    expect(insieme.size).toBe(200)
  })
})
