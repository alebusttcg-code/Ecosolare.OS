/**
 * Identità EcoSolare usata nei documenti rivolti al cliente.
 *
 * Separata dall'interfaccia interna: il PDF è il biglietto da visita, non una
 * schermata del CRM. P.IVA e PEC si aggiungono quando sono disponibili.
 */

export const ECOSOLARE = {
  nome: 'EcoSolare',
  /** Sito istituzionale — https://www.ecosolare.biz/ */
  sito: 'www.ecosolare.biz',
  sitoUrl: 'https://www.ecosolare.biz/',
  email: 'info@ecosolare.biz',
  logoRelativo: 'public/brand/ecosolare-logo.png',
  colori: {
    abisso: '#050a14',
    notte: '#0a1424',
    superficie: '#101c30',
    oro: '#d9a441',
    oroChiaro: '#e8c765',
    blu: '#3f7fc4',
    bluChiaro: '#5b9bd5',
    testo: '#e8eef6',
    testoTenue: '#9aabbf',
    bordo: 'rgba(255,255,255,0.12)',
  },
  sedi: [
    {
      nome: 'Sede La Spezia',
      via: 'Via Buonviaggio, 163',
      capCitta: '19125 La Spezia',
      telefono: '+39 0187 599 661',
    },
    {
      nome: 'Sede Bologna',
      via: 'Piazza E. Sassoli, 2',
      capCitta: '40017 San Giovanni in Persiceto (BO)',
      telefono: '+39 051 041 0550',
    },
  ],
} as const

export type SedeEcoSolare = (typeof ECOSOLARE.sedi)[number]
