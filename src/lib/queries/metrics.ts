import { and, asc, eq, gte, isNull, lte, min } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  contracts,
  leadSources,
  opportunities,
  quoteVersions,
  quotes,
  surveys,
  users,
} from '@/db/schema'
import { importoDaEuro } from '@/lib/domain/money'
import type { PraticaCommerciale } from '@/lib/domain/funnel'

/**
 * Raccoglie la coorte commerciale di un periodo.
 *
 * **Il periodo filtra la data di INGRESSO del lead, non quella degli eventi.**
 * È la differenza fra «conversione dei lead di luglio» e «contratti firmati a
 * luglio»: la seconda misura il lavoro chiuso, la prima misura se la macchina
 * commerciale funziona. Per le conversioni serve la prima.
 */
export async function getCoorteCommerciale(
  da: Date,
  a: Date,
): Promise<PraticaCommerciale[]> {
  const db = getDb()

  const righe = await db
    .select({
      id: opportunities.id,
      creatoIl: opportunities.createdAt,
      primaRispostaIl: opportunities.firstResponseAt,
      persoIl: opportunities.closedAt,
      stage: opportunities.stage,
      motivoPerdita: opportunities.lostReason,
      valoreStimato: opportunities.estimatedValue,
      lineaBusiness: opportunities.businessLine,
      fonte: leadSources.label,
      commerciale: users.name,
      commercialeEmail: users.email,
      // Prima data utile di ciascuna tappa: se ci sono più sopralluoghi o più
      // preventivi conta il primo, perché è quello che misura la reattività.
      sopralluogoCreatoIl: min(surveys.createdAt),
      sopralluogoChiusoIl: min(surveys.completedAt),
      preventivoInviatoIl: min(quoteVersions.sentAt),
      contrattoFirmatoIl: min(contracts.signedAt),
      valoreContratto: min(contracts.amountNet),
      valorePreventivo: min(quoteVersions.revenueNet),
    })
    .from(opportunities)
    .leftJoin(leadSources, eq(leadSources.id, opportunities.sourceId))
    .leftJoin(users, eq(users.id, opportunities.ownerId))
    .leftJoin(surveys, eq(surveys.opportunityId, opportunities.id))
    .leftJoin(quotes, eq(quotes.opportunityId, opportunities.id))
    .leftJoin(quoteVersions, eq(quoteVersions.quoteId, quotes.id))
    .leftJoin(contracts, eq(contracts.opportunityId, opportunities.id))
    .where(
      and(
        isNull(opportunities.deletedAt),
        gte(opportunities.createdAt, da),
        lte(opportunities.createdAt, a),
      ),
    )
    .groupBy(
      opportunities.id,
      opportunities.createdAt,
      opportunities.firstResponseAt,
      opportunities.closedAt,
      opportunities.stage,
      opportunities.lostReason,
      opportunities.estimatedValue,
      opportunities.businessLine,
      leadSources.label,
      users.name,
      users.email,
    )
    .orderBy(asc(opportunities.createdAt))

  return righe.map((r) => {
    const contrattoFirmatoIl = r.contrattoFirmatoIl ?? null
    // «Perso» solo se è davvero perso: una pratica vinta ha comunque closedAt.
    const perso = contrattoFirmatoIl === null && r.stage === 'perso' ? r.persoIl : null

    return {
      id: r.id,
      creatoIl: r.creatoIl,
      primaRispostaIl: r.primaRispostaIl,
      sopralluogoFissatoIl: r.sopralluogoCreatoIl ?? null,
      sopralluogoEffettuatoIl: r.sopralluogoChiusoIl ?? null,
      preventivoInviatoIl: r.preventivoInviatoIl ?? null,
      contrattoFirmatoIl,
      persoIl: perso,
      motivoPerdita: r.motivoPerdita,
      valorePreventivo: r.valorePreventivo
        ? importoDaEuro(r.valorePreventivo)
        : r.valoreStimato
          ? importoDaEuro(r.valoreStimato)
          : null,
      valoreContratto: r.valoreContratto ? importoDaEuro(r.valoreContratto) : null,
      fonte: r.fonte,
      commerciale: r.commerciale ?? r.commercialeEmail,
      lineaBusiness: r.lineaBusiness,
    }
  })
}

export interface Periodo {
  readonly codice: string
  readonly etichetta: string
  readonly da: Date
  readonly a: Date
}

/** I periodi proposti nel selettore. */
export function periodiDisponibili(adesso: Date): Periodo[] {
  const fine = new Date(adesso)
  const inizioMese = new Date(adesso.getFullYear(), adesso.getMonth(), 1)
  const inizioAnno = new Date(adesso.getFullYear(), 0, 1)

  const giorniFa = (n: number) => new Date(adesso.getTime() - n * 86_400_000)

  return [
    { codice: '30g', etichetta: 'Ultimi 30 giorni', da: giorniFa(30), a: fine },
    { codice: '90g', etichetta: 'Ultimi 90 giorni', da: giorniFa(90), a: fine },
    { codice: '12m', etichetta: 'Ultimi 12 mesi', da: giorniFa(365), a: fine },
    { codice: 'mese', etichetta: 'Mese corrente', da: inizioMese, a: fine },
    { codice: 'anno', etichetta: 'Anno corrente', da: inizioAnno, a: fine },
  ]
}

export function trovaPeriodo(codice: string | undefined, adesso: Date): Periodo {
  const elenco = periodiDisponibili(adesso)
  return elenco.find((p) => p.codice === codice) ?? elenco[2]!
}
