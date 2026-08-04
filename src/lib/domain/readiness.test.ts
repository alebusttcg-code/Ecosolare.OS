import { describe, expect, it } from 'vitest'
import {
  calcolaReadiness,
  riassumiBlocchi,
  REGOLE_PREDEFINITE,
  type DatiCommessa,
  type DocumentoRichiesto,
  type MaterialeCommessa,
  type PraticaCommessa,
} from './readiness'

const ADESSO = new Date('2026-08-04T10:00:00Z')
const DIECI_GIORNI_FA = new Date('2026-07-25T10:00:00Z')
const TRE_GIORNI_FA = new Date('2026-08-01T10:00:00Z')

/** Commessa senza alcun impedimento: il punto di partenza dei test. */
function commessaPronta(over: Partial<DatiCommessa> = {}): DatiCommessa {
  return {
    documenti: [],
    materiali: [],
    pratiche: [],
    verificaTecnicaCompletata: true,
    clienteHaConfermato: true,
    accontoIncassato: null,
    ...over,
  }
}

const doc = (over: Partial<DocumentoRichiesto> = {}): DocumentoRichiesto => ({
  label: 'Documento di identità',
  obbligatorio: true,
  stato: 'approvato',
  responsabile: 'back-office',
  da: null,
  ...over,
})

const mat = (over: Partial<MaterialeCommessa> = {}): MaterialeCommessa => ({
  descrizione: 'Inverter 6 kW',
  critico: true,
  stato: 'consegnato',
  responsabile: 'ufficio acquisti',
  da: null,
  ...over,
})

const pratica = (over: Partial<PraticaCommessa> = {}): PraticaCommessa => ({
  label: 'Richiesta di connessione',
  bloccante: true,
  stato: 'inviata',
  responsabile: 'ufficio tecnico',
  da: null,
  ...over,
})

describe('commessa senza impedimenti', () => {
  it('è pianificabile', () => {
    const esito = calcolaReadiness(commessaPronta(), ADESSO)
    expect(esito.stato).toBe('pianificabile')
    expect(esito.bloccanti).toEqual([])
    expect(esito.avvisi).toEqual([])
    expect(esito.giorniDiBloccoPiuVecchio).toBeNull()
  })

  it('resta pianificabile con documenti approvati e materiali consegnati', () => {
    const esito = calcolaReadiness(
      commessaPronta({
        documenti: [doc(), doc({ label: 'Visura catastale' })],
        materiali: [mat(), mat({ descrizione: 'Moduli' })],
        pratiche: [pratica()],
      }),
      ADESSO,
    )
    expect(esito.stato).toBe('pianificabile')
  })

  it('considera risolto un documento dichiarato non necessario', () => {
    const esito = calcolaReadiness(
      commessaPronta({ documenti: [doc({ stato: 'non_necessario' })] }),
      ADESSO,
    )
    expect(esito.stato).toBe('pianificabile')
  })
})

describe('documenti', () => {
  it('blocca su un documento obbligatorio mancante', () => {
    const esito = calcolaReadiness(
      commessaPronta({ documenti: [doc({ stato: 'richiesto' })] }),
      ADESSO,
    )
    expect(esito.stato).toBe('non_pianificabile')
    expect(esito.bloccanti).toHaveLength(1)
    expect(esito.bloccanti[0]?.tipo).toBe('documento')
  })

  it('non blocca su un documento facoltativo, ma avvisa', () => {
    const esito = calcolaReadiness(
      commessaPronta({ documenti: [doc({ obbligatorio: false, stato: 'richiesto' })] }),
      ADESSO,
    )
    expect(esito.stato).toBe('quasi_pianificabile')
    expect(esito.bloccanti).toEqual([])
    expect(esito.avvisi).toHaveLength(1)
  })

  it('distingue un documento respinto da uno solo mancante', () => {
    // Richiedono azioni diverse: uno si sollecita, l'altro si corregge.
    const mancante = calcolaReadiness(
      commessaPronta({ documenti: [doc({ stato: 'richiesto' })] }),
      ADESSO,
    )
    const respinto = calcolaReadiness(
      commessaPronta({ documenti: [doc({ stato: 'respinto' })] }),
      ADESSO,
    )
    expect(mancante.bloccanti[0]?.descrizione).toContain('mancante')
    expect(respinto.bloccanti[0]?.descrizione).toContain('respinto')
  })

  it('tratta come bloccante un documento scaduto', () => {
    const esito = calcolaReadiness(
      commessaPronta({ documenti: [doc({ stato: 'scaduto' })] }),
      ADESSO,
    )
    expect(esito.stato).toBe('non_pianificabile')
    expect(esito.bloccanti[0]?.descrizione).toContain('scaduto')
  })

  it('NON considera risolto un documento solo caricato', () => {
    // Caricato non vuol dire verificato: è la distinzione che evita di partire
    // con la fotografia sbagliata allegata alla pratica.
    for (const stato of ['caricato', 'da_verificare'] as const) {
      const esito = calcolaReadiness(commessaPronta({ documenti: [doc({ stato })] }), ADESSO)
      expect(esito.stato, stato).toBe('non_pianificabile')
    }
  })

  it('riporta il responsabile del blocco', () => {
    const esito = calcolaReadiness(
      commessaPronta({ documenti: [doc({ stato: 'richiesto', responsabile: 'Anna' })] }),
      ADESSO,
    )
    expect(esito.bloccanti[0]?.responsabile).toBe('Anna')
  })
})

describe('materiali', () => {
  it('blocca su un materiale critico non consegnato', () => {
    for (const stato of ['da_ordinare', 'ordinato', 'parzialmente_consegnato', 'non_disponibile'] as const) {
      const esito = calcolaReadiness(commessaPronta({ materiali: [mat({ stato })] }), ADESSO)
      expect(esito.stato, stato).toBe('non_pianificabile')
    }
  })

  it('non blocca su un materiale non critico, ma avvisa', () => {
    const esito = calcolaReadiness(
      commessaPronta({ materiali: [mat({ critico: false, stato: 'ordinato' })] }),
      ADESSO,
    )
    expect(esito.stato).toBe('quasi_pianificabile')
  })

  it('descrive in modo diverso il materiale mai ordinato e quello in arrivo', () => {
    const daOrdinare = calcolaReadiness(
      commessaPronta({ materiali: [mat({ stato: 'da_ordinare' })] }),
      ADESSO,
    )
    const ordinato = calcolaReadiness(
      commessaPronta({ materiali: [mat({ stato: 'ordinato' })] }),
      ADESSO,
    )
    expect(daOrdinare.bloccanti[0]?.descrizione).toContain('da ordinare')
    expect(ordinato.bloccanti[0]?.descrizione).toContain('attesa di consegna')
  })

  it('segnala la consegna parziale, che è il caso più insidioso', () => {
    const esito = calcolaReadiness(
      commessaPronta({ materiali: [mat({ stato: 'parzialmente_consegnato' })] }),
      ADESSO,
    )
    expect(esito.bloccanti[0]?.descrizione).toContain('solo in parte')
  })
})

describe('pratiche', () => {
  it('considera sufficiente una pratica inviata, senza attendere l approvazione', () => {
    const esito = calcolaReadiness(commessaPronta({ pratiche: [pratica({ stato: 'inviata' })] }), ADESSO)
    expect(esito.stato).toBe('pianificabile')
  })

  it('blocca su una pratica bloccante non ancora inviata', () => {
    const esito = calcolaReadiness(
      commessaPronta({ pratiche: [pratica({ stato: 'da_preparare' })] }),
      ADESSO,
    )
    expect(esito.stato).toBe('non_pianificabile')
  })

  it('blocca su una pratica respinta', () => {
    const esito = calcolaReadiness(
      commessaPronta({ pratiche: [pratica({ stato: 'respinta' })] }),
      ADESSO,
    )
    expect(esito.bloccanti[0]?.descrizione).toContain('respinta')
  })
})

describe('condizioni singole', () => {
  it('blocca senza verifica tecnica', () => {
    const esito = calcolaReadiness(
      commessaPronta({ verificaTecnicaCompletata: false }),
      ADESSO,
    )
    expect(esito.bloccanti.map((b) => b.tipo)).toEqual(['verifica_tecnica'])
  })

  it('blocca senza conferma del cliente', () => {
    const esito = calcolaReadiness(commessaPronta({ clienteHaConfermato: false }), ADESSO)
    expect(esito.bloccanti.map((b) => b.tipo)).toEqual(['conferma_cliente'])
  })

  it('non considera l acconto quando il piano pagamenti non lo prevede', () => {
    const esito = calcolaReadiness(commessaPronta({ accontoIncassato: null }), ADESSO)
    expect(esito.stato).toBe('pianificabile')
  })

  it('avvisa ma non blocca sull acconto, con le regole predefinite', () => {
    // È una decisione commerciale, non tecnica: la prende la direzione.
    const esito = calcolaReadiness(commessaPronta({ accontoIncassato: false }), ADESSO)
    expect(esito.stato).toBe('quasi_pianificabile')
    expect(esito.avvisi.map((b) => b.tipo)).toEqual(['acconto'])
  })

  it('blocca sull acconto se la direzione lo configura così', () => {
    const esito = calcolaReadiness(commessaPronta({ accontoIncassato: false }), ADESSO, {
      ...REGOLE_PREDEFINITE,
      accontoBlocca: true,
    })
    expect(esito.stato).toBe('non_pianificabile')
  })
})

describe('regole configurabili', () => {
  it('permette di declassare i documenti ad avviso', () => {
    const esito = calcolaReadiness(
      commessaPronta({ documenti: [doc({ stato: 'richiesto' })] }),
      ADESSO,
      { ...REGOLE_PREDEFINITE, documentiObbligatoriBloccano: false },
    )
    expect(esito.stato).toBe('quasi_pianificabile')
  })

  it('permette di declassare i materiali critici ad avviso', () => {
    const esito = calcolaReadiness(
      commessaPronta({ materiali: [mat({ stato: 'da_ordinare' })] }),
      ADESSO,
      { ...REGOLE_PREDEFINITE, materialiCriticiBloccano: false },
    )
    expect(esito.stato).toBe('quasi_pianificabile')
  })
})

describe('giorni di blocco', () => {
  it('riporta la durata del blocco più vecchio', () => {
    const esito = calcolaReadiness(
      commessaPronta({
        documenti: [doc({ stato: 'richiesto', da: DIECI_GIORNI_FA })],
        materiali: [mat({ stato: 'da_ordinare', da: TRE_GIORNI_FA })],
      }),
      ADESSO,
    )
    expect(esito.giorniDiBloccoPiuVecchio).toBe(10)
  })

  it('considera anche i blocchi declassati ad avviso', () => {
    const esito = calcolaReadiness(
      commessaPronta({
        documenti: [doc({ obbligatorio: false, stato: 'richiesto', da: DIECI_GIORNI_FA })],
      }),
      ADESSO,
    )
    expect(esito.giorniDiBloccoPiuVecchio).toBe(10)
  })

  it('non produce giorni negativi se la data è nel futuro', () => {
    const esito = calcolaReadiness(
      commessaPronta({
        documenti: [doc({ stato: 'richiesto', da: new Date('2026-09-01T10:00:00Z') })],
      }),
      ADESSO,
    )
    expect(esito.giorniDiBloccoPiuVecchio).toBe(0)
  })
})

describe('commessa con più impedimenti insieme', () => {
  const molteplice = commessaPronta({
    documenti: [
      doc({ label: 'Visura catastale', stato: 'richiesto', da: DIECI_GIORNI_FA }),
      doc({ label: 'Bolletta', stato: 'approvato' }),
    ],
    materiali: [mat({ descrizione: 'Accumulo 10 kWh', stato: 'ordinato', da: TRE_GIORNI_FA })],
    pratiche: [pratica({ stato: 'da_preparare' })],
    clienteHaConfermato: false,
  })

  it('li elenca tutti, non solo il primo', () => {
    const esito = calcolaReadiness(molteplice, ADESSO)
    expect(esito.bloccanti).toHaveLength(4)
    expect(esito.bloccanti.map((b) => b.tipo)).toEqual([
      'documento',
      'materiale',
      'pratica',
      'conferma_cliente',
    ])
  })

  it('riassume in una riga con il conteggio dei restanti', () => {
    const esito = calcolaReadiness(molteplice, ADESSO)
    expect(riassumiBlocchi(esito)).toBe('Documento mancante: Visura catastale (+3)')
  })
})

describe('riassumiBlocchi', () => {
  it('dice che è pronta quando non c è nulla da fare', () => {
    expect(riassumiBlocchi(calcolaReadiness(commessaPronta(), ADESSO))).toBe(
      'Pronta per la pianificazione',
    )
  })

  it('non aggiunge il conteggio quando il blocco è uno solo', () => {
    const esito = calcolaReadiness(
      commessaPronta({ documenti: [doc({ label: 'Bolletta', stato: 'richiesto' })] }),
      ADESSO,
    )
    expect(riassumiBlocchi(esito)).toBe('Documento mancante: Bolletta')
  })
})
