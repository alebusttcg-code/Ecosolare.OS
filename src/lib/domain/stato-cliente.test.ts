import { describe, expect, it } from 'vitest'
import { FASI_CLIENTE, raccontaStato } from './stato-cliente'
import { STATI_COMMESSA, STATI_COMMESSA_SPECIALI } from '@/db/templates/commessa'

describe('lo stato raccontato al cliente', () => {
  it('copre ogni stato interno esistente', () => {
    // Uno stato non mappato finirebbe silenziosamente in «Raccolta documenti»,
    // dicendo al cliente una cosa falsa proprio quando l'impianto è quasi finito.
    for (const stato of STATI_COMMESSA) {
      const esito = raccontaStato({
        codiceStato: stato.code,
        documentiMancanti: 0,
        dataInstallazione: null,
      })
      expect(esito.indiceFase, `stato non mappato: ${stato.code}`).toBeGreaterThanOrEqual(0)
    }
  })

  it('avanza insieme allo stato interno, senza mai tornare indietro', () => {
    const indici = STATI_COMMESSA.map(
      (s) =>
        raccontaStato({
          codiceStato: s.code,
          documentiMancanti: 0,
          dataInstallazione: null,
        }).indiceFase,
    )
    for (let i = 1; i < indici.length; i += 1) {
      expect(indici[i]!, `regressione fra ${STATI_COMMESSA[i - 1]!.code} e ${STATI_COMMESSA[i]!.code}`).toBeGreaterThanOrEqual(indici[i - 1]!)
    }
  })

  it('la prima e l’ultima fase corrispondono agli estremi del percorso', () => {
    expect(
      raccontaStato({
        codiceStato: 'contratto_ricevuto',
        documentiMancanti: 0,
        dataInstallazione: null,
      }).indiceFase,
    ).toBe(0)
    expect(
      raccontaStato({ codiceStato: 'saldo', documentiMancanti: 0, dataInstallazione: null })
        .indiceFase,
    ).toBe(FASI_CLIENTE.length - 1)
  })

  it('i documenti mancanti hanno la precedenza su qualsiasi altra cosa', () => {
    // È l'unica riga su cui il cliente può agire: se c'è, viene prima.
    const esito = raccontaStato({
      codiceStato: 'materiali_ordinati',
      documentiMancanti: 2,
      dataInstallazione: new Date('2026-09-01'),
    })
    expect(esito.messaggio).toContain('2 documenti')
    expect(esito.messaggio).toContain('fermi')
  })

  it('usa il singolare quando manca un documento solo', () => {
    const esito = raccontaStato({
      codiceStato: 'documenti_da_completare',
      documentiMancanti: 1,
      dataInstallazione: null,
    })
    expect(esito.messaggio).toContain('un documento')
    expect(esito.messaggio).not.toContain('1 documenti')
  })

  it('annuncia la data quando c’è e non manca niente', () => {
    const esito = raccontaStato({
      codiceStato: 'cantiere_pianificato',
      documentiMancanti: 0,
      dataInstallazione: new Date('2026-09-01'),
    })
    expect(esito.messaggio).toContain('data di installazione')
  })

  it('dice che i lavori sono fermi, senza inventarsi il motivo', () => {
    for (const codice of ['sospesa', 'bloccata']) {
      const esito = raccontaStato({
        codiceStato: codice,
        documentiMancanti: 0,
        dataInstallazione: null,
      })
      expect(esito.ferma).toBe(true)
      expect(esito.faseCorrente).toBeNull()
      // Nessuna spiegazione tecnica: al cliente non serve e non la capirebbe.
      expect(esito.messaggio).not.toMatch(/bloccat|sospes/i)
    }
  })

  it('riconosce la commessa chiusa', () => {
    const esito = raccontaStato({
      codiceStato: 'chiusa',
      documentiMancanti: 0,
      dataInstallazione: null,
    })
    expect(esito.conclusa).toBe(true)
    expect(esito.indiceFase).toBe(FASI_CLIENTE.length - 1)
  })

  it('non lascia scoperto nessuno stato speciale', () => {
    for (const stato of STATI_COMMESSA_SPECIALI) {
      const esito = raccontaStato({
        codiceStato: stato.code,
        documentiMancanti: 0,
        dataInstallazione: null,
      })
      expect(esito.ferma || esito.conclusa, `stato speciale non gestito: ${stato.code}`).toBe(
        true,
      )
    }
  })

  it('non usa mai il gergo interno nei testi mostrati', () => {
    // Le parole che il cliente non deve leggere: sono nostre, non sue.
    const gergo = /commessa|readiness|pianificabil|outbox|milestone/i
    for (const stato of [...STATI_COMMESSA, ...STATI_COMMESSA_SPECIALI]) {
      const esito = raccontaStato({
        codiceStato: stato.code,
        documentiMancanti: 0,
        dataInstallazione: null,
      })
      expect(esito.titolo, stato.code).not.toMatch(gergo)
      expect(esito.messaggio, stato.code).not.toMatch(gergo)
    }
    for (const fase of FASI_CLIENTE) {
      expect(fase.titolo).not.toMatch(gergo)
      expect(fase.cosaSuccede).not.toMatch(gergo)
    }
  })
})
