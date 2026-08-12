import { describe, expect, it } from 'vitest'
import { IP_SCONOSCIUTO, indirizzoChiamante } from './indirizzo'

function intestazioni(valori: Record<string, string>): Headers {
  return new Headers(valori)
}

describe('indirizzo del chiamante', () => {
  it('preferisce l’intestazione che mette il proxy della piattaforma', () => {
    // `x-forwarded-for` la può scrivere il client; `x-vercel-forwarded-for` no.
    const headers = intestazioni({
      'x-forwarded-for': '1.2.3.4',
      'x-real-ip': '5.6.7.8',
      'x-vercel-forwarded-for': '9.9.9.9',
    })
    expect(indirizzoChiamante(headers)).toBe('9.9.9.9')
  })

  it('prende il primo elemento della catena, che è il client', () => {
    const headers = intestazioni({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18, 150.172.238.178' })
    expect(indirizzoChiamante(headers)).toBe('203.0.113.7')
  })

  it('regge IPv6', () => {
    const headers = intestazioni({ 'x-real-ip': '2001:0DB8:85A3:0000:0000:8A2E:0370:7334' })
    expect(indirizzoChiamante(headers)).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334')
  })

  it('senza intestazioni finiscono tutti nello stesso contatore', () => {
    expect(indirizzoChiamante(intestazioni({}))).toBe(IP_SCONOSCIUTO)
  })

  it('non lascia che la chiave del contatore diventi testo arbitrario', () => {
    // Un'intestazione falsificata non deve poter scrivere quello che vuole
    // dentro la tabella, né gonfiarla con chiavi lunghe a piacere.
    expect(indirizzoChiamante(intestazioni({ 'x-real-ip': 'drop table utenti' }))).toBe(
      IP_SCONOSCIUTO,
    )
    expect(indirizzoChiamante(intestazioni({ 'x-real-ip': '9'.repeat(200) }))).toBe(
      IP_SCONOSCIUTO,
    )
  })

  it('scarta l’intestazione vuota e passa alla successiva', () => {
    const headers = intestazioni({ 'x-vercel-forwarded-for': '', 'x-real-ip': '1.2.3.4' })
    expect(indirizzoChiamante(headers)).toBe('1.2.3.4')
  })
})
