import { afterEach, describe, expect, it } from 'vitest'
import {
  classificaDatabase,
  DatabaseDiProduzioneError,
  esigiDatabaseDiSviluppo,
} from './ambiente'

const SUPABASE = 'postgresql://postgres:segreto@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
const LOCALE = 'postgresql://postgres:postgres@localhost:5432/ecosolare'

describe('classificazione del database', () => {
  it('la dichiarazione esplicita vince sull’host', () => {
    // Un database di prova ospitato su Supabase resta di prova: l'euristica
    // sull'host è un ripiego, non un'autorità.
    expect(classificaDatabase(SUPABASE, 'sviluppo')).toBe('sviluppo')
    expect(classificaDatabase(LOCALE, 'produzione')).toBe('produzione')
  })

  it('ignora una dichiarazione scritta male invece di fidarsene', () => {
    // «svilupo» non deve diventare per sbaglio un lasciapassare.
    expect(classificaDatabase(SUPABASE, 'svilupo')).toBe('produzione')
    expect(classificaDatabase(SUPABASE, '')).toBe('produzione')
  })

  it('riconosce la macchina di chi sviluppa', () => {
    expect(classificaDatabase(LOCALE)).toBe('sviluppo')
    expect(classificaDatabase('postgres://u:p@127.0.0.1/x')).toBe('sviluppo')
    expect(classificaDatabase('postgres://u:p@mac-di-federico.local/x')).toBe('sviluppo')
  })

  it('riconosce i servizi gestiti', () => {
    expect(classificaDatabase(SUPABASE)).toBe('produzione')
    expect(classificaDatabase('postgres://u:p@ep-x.eu-central-1.aws.neon.tech/db')).toBe(
      'produzione',
    )
  })

  it('un host che non conosce non è sviluppo', () => {
    // Fallire chiuso: il costo dei due errori non è simmetrico.
    expect(classificaDatabase('postgres://u:p@db.azienda.it:5432/x')).toBe('sconosciuto')
    expect(classificaDatabase('non-un-url')).toBe('sconosciuto')
    expect(classificaDatabase(undefined)).toBe('sconosciuto')
  })
})

describe('protezione delle operazioni distruttive', () => {
  const originale = { ...process.env }

  afterEach(() => {
    process.env = { ...originale }
  })

  it('lascia passare sullo sviluppo', () => {
    process.env.DATABASE_URL = LOCALE
    delete process.env.AMBIENTE_DB
    expect(() => esigiDatabaseDiSviluppo('npm run demo')).not.toThrow()
  })

  it('si ferma sulla produzione', () => {
    process.env.DATABASE_URL = SUPABASE
    delete process.env.AMBIENTE_DB
    delete process.env.CONSENTI_SU_PRODUZIONE
    expect(() => esigiDatabaseDiSviluppo('npm run demo')).toThrow(DatabaseDiProduzioneError)
  })

  it('si ferma anche su un host che non riconosce', () => {
    process.env.DATABASE_URL = 'postgres://u:p@db.azienda.it/x'
    delete process.env.AMBIENTE_DB
    delete process.env.CONSENTI_SU_PRODUZIONE
    expect(() => esigiDatabaseDiSviluppo('npm run db:seed')).toThrow(
      DatabaseDiProduzioneError,
    )
  })

  it('non mette mai la stringa di connessione nel messaggio', () => {
    // I messaggi d'errore finiscono nei log e negli screenshot: l'host serve,
    // la password no.
    process.env.DATABASE_URL = SUPABASE
    delete process.env.AMBIENTE_DB
    delete process.env.CONSENTI_SU_PRODUZIONE
    let messaggio = ''
    try {
      esigiDatabaseDiSviluppo('npm run demo')
    } catch (errore) {
      messaggio = errore instanceof Error ? errore.message : String(errore)
    }
    expect(messaggio).toContain('pooler.supabase.com')
    expect(messaggio).not.toContain('segreto')
  })

  it('la forzatura esplicita passa, perché il primo popolamento è legittimo', () => {
    process.env.DATABASE_URL = SUPABASE
    delete process.env.AMBIENTE_DB
    process.env.CONSENTI_SU_PRODUZIONE = '1'
    expect(() => esigiDatabaseDiSviluppo('npm run db:seed')).not.toThrow()
  })

  it('una forzatura diversa da «1» non vale', () => {
    process.env.DATABASE_URL = SUPABASE
    delete process.env.AMBIENTE_DB
    process.env.CONSENTI_SU_PRODUZIONE = 'true'
    expect(() => esigiDatabaseDiSviluppo('npm run demo')).toThrow(DatabaseDiProduzioneError)
  })
})
