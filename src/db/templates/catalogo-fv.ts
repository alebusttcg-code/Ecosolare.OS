/**
 * Catalogo di partenza per il fotovoltaico.
 *
 * Prezzi e voci sono ipotesi operative: si affinano da interfaccia / DB.
 * Manodopera e servizi hanno `type` dedicato così non finiscono in distinta
 * materiali alla firma del contratto.
 */

export const CATALOGO_FV = [
  {
    code: 'MOD-450',
    name: 'Modulo fotovoltaico 450 W',
    type: 'materiale' as const,
    unit: 'pz',
    defaultCostPrice: '92.0000',
    defaultSalePrice: '148.0000',
    vatRate: '10.00',
  },
  {
    code: 'INV-6K',
    name: 'Inverter ibrido 6 kW',
    type: 'materiale' as const,
    unit: 'pz',
    defaultCostPrice: '1050.0000',
    defaultSalePrice: '1690.0000',
    vatRate: '10.00',
  },
  {
    code: 'BAT-10',
    name: 'Batteria di accumulo 10 kWh',
    type: 'materiale' as const,
    unit: 'pz',
    defaultCostPrice: '2400.0000',
    defaultSalePrice: '3450.0000',
    vatRate: '10.00',
  },
  {
    code: 'STR-FAL',
    name: 'Struttura di fissaggio per tetto a falda',
    type: 'materiale' as const,
    unit: 'pz',
    defaultCostPrice: '28.0000',
    defaultSalePrice: '46.0000',
    vatRate: '10.00',
  },
  {
    code: 'MAN-STD',
    name: 'Manodopera',
    type: 'manodopera' as const,
    unit: 'h',
    defaultCostPrice: '26.0000',
    defaultSalePrice: '42.0000',
    vatRate: '22.00',
  },
  {
    code: 'PRAT-GSE',
    name: 'Pratiche di connessione e GSE',
    type: 'servizio' as const,
    unit: 'a corpo',
    defaultCostPrice: '180.0000',
    defaultSalePrice: '450.0000',
    vatRate: '22.00',
  },
] as const
