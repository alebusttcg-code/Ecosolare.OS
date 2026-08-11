import {
  Document,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer'
import { ECOSOLARE } from '@/lib/brand/ecosolare'
import type { DatiPdfPreventivo } from '@/lib/pdf/dati-preventivo'
import { FONT_CORPO, FONT_DISPLAY } from '@/lib/pdf/fonti-preventivo'

const C = ECOSOLARE.colori

/** Carta calda leggerissima — non cream AI, tono abisso/oro. */
const CARTA = '#fbfcfa'
const INCHIOSTRO = '#0c1524'
const INCHIOSTRO_MORBIDO = '#3d4a5c'
const LINEA = 'rgba(5, 10, 20, 0.08)'
const LINEA_FORTE = 'rgba(217, 164, 65, 0.45)'

const stili = StyleSheet.create({
  pagina: {
    fontFamily: FONT_CORPO,
    fontWeight: 400,
    fontSize: 9,
    color: INCHIOSTRO,
    backgroundColor: CARTA,
    paddingBottom: 100,
  },
  hero: {
    backgroundColor: C.abisso,
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 40,
    marginBottom: 28,
  },
  heroRiga: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logo: {
    width: 156,
    height: 44,
    objectFit: 'contain',
  },
  heroMeta: {
    alignItems: 'flex-end',
    maxWidth: 280,
  },
  eyebrow: {
    color: C.oroChiaro,
    fontSize: 7.5,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    fontFamily: FONT_CORPO,
    fontWeight: 500,
    marginBottom: 8,
  },
  titoloHero: {
    color: '#f7f3ea',
    fontSize: 26,
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
    marginBottom: 8,
    textAlign: 'right',
    lineHeight: 1.15,
  },
  metaHero: {
    color: C.testoTenue,
    fontSize: 8,
    textAlign: 'right',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  oroBar: {
    height: 1.5,
    backgroundColor: C.oro,
    marginTop: 22,
    opacity: 0.95,
  },
  oroBarSottile: {
    height: 1,
    backgroundColor: LINEA_FORTE,
    marginTop: 14,
  },
  corpo: {
    paddingHorizontal: 40,
  },
  griglia: {
    flexDirection: 'row',
    gap: 28,
    marginBottom: 26,
  },
  bloccoAnagrafica: {
    flex: 1,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: LINEA,
  },
  cardTitolo: {
    fontSize: 7,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: C.oro,
    fontFamily: FONT_CORPO,
    fontWeight: 700,
    marginBottom: 8,
  },
  cardTesto: {
    fontSize: 13,
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
    color: INCHIOSTRO,
    marginBottom: 3,
    lineHeight: 1.25,
  },
  cardSecondario: {
    fontSize: 8.5,
    color: INCHIOSTRO_MORBIDO,
    lineHeight: 1.4,
  },
  kpiRiga: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  kpiBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINEA_FORTE,
    borderRadius: 2,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: C.abisso,
  },
  kpiEtichetta: {
    fontSize: 6.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.oroChiaro,
    marginBottom: 6,
    fontFamily: FONT_CORPO,
    fontWeight: 500,
  },
  kpiValore: {
    fontSize: 16,
    color: '#f7f3ea',
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
    lineHeight: 1.15,
  },
  kpiUnita: {
    fontSize: 7.5,
    color: C.testoTenue,
    marginTop: 5,
    letterSpacing: 0.2,
  },
  sezioneRiga: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
    marginTop: 4,
    gap: 10,
  },
  sezioneNumero: {
    fontSize: 11,
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
    color: C.oro,
    letterSpacing: 0.5,
  },
  sezioneTitolo: {
    fontSize: 11,
    letterSpacing: 0.4,
    color: INCHIOSTRO,
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
  },
  sezioneSemplice: {
    fontSize: 10,
    letterSpacing: 0.3,
    color: INCHIOSTRO,
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
    marginBottom: 10,
    marginTop: 4,
  },
  tabella: {
    borderTopWidth: 1.5,
    borderTopColor: C.abisso,
    borderBottomWidth: 1,
    borderBottomColor: LINEA,
    marginBottom: 22,
  },
  thead: {
    flexDirection: 'row',
    backgroundColor: C.abisso,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  th: {
    color: C.oroChiaro,
    fontSize: 6.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontFamily: FONT_CORPO,
    fontWeight: 700,
  },
  riga: {
    flexDirection: 'row',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: LINEA,
    alignItems: 'flex-start',
  },
  rigaAlt: {
    backgroundColor: 'rgba(5, 10, 20, 0.025)',
  },
  td: {
    fontSize: 8.5,
    color: INCHIOSTRO,
    lineHeight: 1.35,
  },
  tdDestra: {
    textAlign: 'right',
  },
  colDesc: { width: '34%' },
  colQty: { width: '10%' },
  colPrezzo: { width: '16%' },
  colSconto: { width: '10%' },
  colIva: { width: '10%' },
  colImporto: { width: '20%' },
  riepilogoWrap: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 22,
  },
  riepilogo: {
    width: 248,
    borderTopWidth: 1.5,
    borderTopColor: C.oro,
  },
  riepilogoRiga: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: LINEA,
  },
  riepilogoEtichetta: {
    fontSize: 8,
    color: INCHIOSTRO_MORBIDO,
    letterSpacing: 0.2,
  },
  riepilogoValore: {
    fontSize: 9,
    fontFamily: FONT_CORPO,
    fontWeight: 500,
    color: INCHIOSTRO,
  },
  totale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginTop: 2,
    backgroundColor: C.abisso,
  },
  totaleEtichetta: {
    color: C.oroChiaro,
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontFamily: FONT_CORPO,
    fontWeight: 700,
  },
  totaleValore: {
    color: '#f7f3ea',
    fontSize: 15,
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
  },
  note: {
    marginBottom: 16,
    paddingTop: 4,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: LINEA,
  },
  noteTitolo: {
    fontSize: 7,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: C.oro,
    fontFamily: FONT_CORPO,
    fontWeight: 700,
    marginBottom: 8,
  },
  noteTesto: {
    fontSize: 8.5,
    color: INCHIOSTRO_MORBIDO,
    lineHeight: 1.45,
  },
  chiusura: {
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: LINEA_FORTE,
  },
  chiusuraTesto: {
    fontSize: 7.5,
    color: INCHIOSTRO_MORBIDO,
    lineHeight: 1.45,
    letterSpacing: 0.15,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.abisso,
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 40,
  },
  footerContatti: {
    alignItems: 'center',
    marginBottom: 12,
  },
  footerSito: {
    color: C.oroChiaro,
    fontSize: 8.5,
    letterSpacing: 1.4,
    textAlign: 'center',
    fontFamily: FONT_CORPO,
    fontWeight: 700,
    marginBottom: 3,
  },
  footerEmail: {
    color: C.testoTenue,
    fontSize: 7.5,
    textAlign: 'center',
  },
  footerSedi: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
  },
  sede: {
    flex: 1,
  },
  sedeNome: {
    color: C.oro,
    fontSize: 7,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: FONT_CORPO,
    fontWeight: 700,
    marginBottom: 4,
  },
  sedeRiga: {
    color: C.testoTenue,
    fontSize: 7.5,
    lineHeight: 1.4,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 84,
    right: 40,
    fontSize: 7.5,
    color: INCHIOSTRO_MORBIDO,
    fontFamily: FONT_CORPO,
    fontWeight: 500,
  },
  pageNumberMarketing: {
    position: 'absolute',
    bottom: 18,
    right: 22,
    fontSize: 7.5,
    color: 'rgba(247, 243, 234, 0.85)',
    fontFamily: FONT_CORPO,
    fontWeight: 500,
  },
  rigaDato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: LINEA,
  },
  rigaDatoEtichetta: {
    fontSize: 8,
    color: INCHIOSTRO_MORBIDO,
    width: '40%',
    letterSpacing: 0.15,
  },
  rigaDatoValore: {
    fontSize: 9,
    fontFamily: FONT_CORPO,
    fontWeight: 500,
    color: INCHIOSTRO,
    width: '58%',
    textAlign: 'right',
  },
  paragrafo: {
    fontSize: 8.5,
    color: INCHIOSTRO_MORBIDO,
    lineHeight: 1.5,
    marginBottom: 10,
  },
  heroCompatto: {
    backgroundColor: C.abisso,
    paddingTop: 22,
    paddingBottom: 16,
    paddingHorizontal: 40,
    marginBottom: 22,
  },
  titoloSezionePagina: {
    color: '#f7f3ea',
    fontSize: 18,
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
    textAlign: 'right',
    maxWidth: 280,
    lineHeight: 1.2,
  },
  colCashAnno: { width: '12%' },
  colCash: { width: '22%' },
  colCashFlusso: { width: '22%' },
  bullet: {
    fontSize: 8.5,
    color: INCHIOSTRO_MORBIDO,
    lineHeight: 1.45,
    marginBottom: 5,
    paddingLeft: 2,
  },
  bulletOro: {
    color: C.oro,
    fontFamily: FONT_CORPO,
    fontWeight: 700,
  },
  garanziaBlocco: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINEA,
  },
  paginaPiena: {
    padding: 0,
  },
  marketingFull: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  planimetriaWrap: {
    borderWidth: 1,
    borderColor: LINEA_FORTE,
    borderRadius: 2,
    padding: 6,
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 6,
    backgroundColor: C.abisso,
  },
  planimetriaFotoBox: {
    width: 480,
    height: 480,
    position: 'relative',
  },
  planimetriaFoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 480,
    height: 480,
    objectFit: 'cover',
  },
  planimetriaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 480,
    height: 480,
  },
  metricheGriglia: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 18,
  },
  metrica: {
    flex: 1,
    paddingTop: 4,
    borderTopWidth: 1.5,
    borderTopColor: C.oro,
  },
  metricaEtichetta: {
    fontSize: 6.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: C.oro,
    fontFamily: FONT_CORPO,
    fontWeight: 700,
    marginBottom: 6,
  },
  metricaValore: {
    fontSize: 14,
    fontFamily: FONT_DISPLAY,
    fontWeight: 600,
    color: INCHIOSTRO,
  },
  metricaNota: {
    fontSize: 7.5,
    color: INCHIOSTRO_MORBIDO,
    marginTop: 3,
    lineHeight: 1.35,
  },
})

function TitoloSezione({
  numero,
  titolo,
}: {
  numero?: string
  titolo: string
}) {
  if (!numero) {
    return <Text style={stili.sezioneSemplice}>{titolo}</Text>
  }
  return (
    <View style={stili.sezioneRiga}>
      <Text style={stili.sezioneNumero}>{numero}</Text>
      <Text style={stili.sezioneTitolo}>{titolo}</Text>
    </View>
  )
}

function PieDiPagina() {
  return (
    <>
      <Text
        style={stili.pageNumber}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        fixed
      />
      <View style={stili.footer} fixed>
        <View style={stili.footerContatti}>
          <Text style={stili.footerSito}>{ECOSOLARE.sito}</Text>
          <Text style={stili.footerEmail}>{ECOSOLARE.email}</Text>
        </View>
        <View style={stili.footerSedi}>
          {ECOSOLARE.sedi.map((sede) => (
            <View key={sede.nome} style={stili.sede}>
              <Text style={stili.sedeNome}>{sede.nome}</Text>
              <Text style={stili.sedeRiga}>{sede.via}</Text>
              <Text style={stili.sedeRiga}>{sede.capCitta}</Text>
              <Text style={stili.sedeRiga}>Tel {sede.telefono}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  )
}

function IntestazioneSezione({
  logoSrc,
  titolo,
}: {
  logoSrc: string
  titolo: string
}) {
  return (
    <View style={stili.heroCompatto}>
      <View style={stili.heroRiga}>
        {/* @react-pdf/renderer: Image non espone alt HTML */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={logoSrc} style={stili.logo} />
        <Text style={stili.titoloSezionePagina}>{titolo}</Text>
      </View>
      <View style={stili.oroBarSottile} />
    </View>
  )
}

export function DocumentoPreventivo({
  dati,
  logoSrc,
}: {
  dati: DatiPdfPreventivo
  logoSrc: string
}) {
  return (
    <Document
      title={`${dati.codice} — ${dati.titolo}`}
      author={ECOSOLARE.nome}
      subject="Preventivo"
      creator="EcoSolare OS"
    >
      <Page size="A4" style={stili.pagina}>
        <View style={stili.hero}>
          <View style={stili.heroRiga}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoSrc} style={stili.logo} />
            <View style={stili.heroMeta}>
              <Text style={stili.eyebrow}>Proposta commerciale</Text>
              <Text style={stili.titoloHero}>{dati.titolo}</Text>
              <Text style={stili.metaHero}>
                {dati.codice} · versione {dati.versione}
              </Text>
              <Text style={stili.metaHero}>{dati.dataDocumento}</Text>
              {dati.validita ? (
                <Text style={stili.metaHero}>Valido fino al {dati.validita}</Text>
              ) : null}
            </View>
          </View>
          <View style={stili.oroBar} />
        </View>

        <View style={stili.corpo}>
          <View style={stili.griglia}>
            <View style={stili.bloccoAnagrafica}>
              <Text style={stili.cardTitolo}>Cliente</Text>
              <Text style={stili.cardTesto}>{dati.clienteNome || '—'}</Text>
              {dati.aziendaCliente ? (
                <Text style={stili.cardSecondario}>{dati.aziendaCliente}</Text>
              ) : null}
            </View>
            <View style={stili.bloccoAnagrafica}>
              <Text style={stili.cardTitolo}>Immobile</Text>
              <Text style={stili.cardTesto}>
                {dati.immobileEtichetta || dati.immobileIndirizzo || 'Da definire'}
              </Text>
              {dati.immobileIndirizzo ? (
                <Text style={stili.cardSecondario}>{dati.immobileIndirizzo}</Text>
              ) : null}
            </View>
          </View>

          {dati.copertinaKpi ? (
            <View style={stili.kpiRiga}>
              <View style={stili.kpiBox}>
                <Text style={stili.kpiEtichetta}>Moduli FV</Text>
                <Text style={stili.kpiValore}>{dati.copertinaKpi.moduli}</Text>
              </View>
              <View style={stili.kpiBox}>
                <Text style={stili.kpiEtichetta}>Potenza CC</Text>
                <Text style={stili.kpiValore}>{dati.copertinaKpi.kWp} kWp</Text>
              </View>
              <View style={stili.kpiBox}>
                <Text style={stili.kpiEtichetta}>Produzione / cons. annua</Text>
                <Text style={stili.kpiValore}>
                  {dati.copertinaKpi.produzioneMwh}
                  {dati.copertinaKpi.consumoMwh
                    ? ` / ${dati.copertinaKpi.consumoMwh}`
                    : ''}{' '}
                  MWh
                </Text>
                <Text style={stili.kpiUnita}>Stima da studio tetto</Text>
              </View>
            </View>
          ) : null}

          {dati.dettagliImpianto ? (
            <>
              <TitoloSezione numero="01" titolo="Dettagli impianto" />
              <View style={stili.note}>
                <View style={stili.rigaDato}>
                  <Text style={stili.rigaDatoEtichetta}>Composizione</Text>
                  <Text style={stili.rigaDatoValore}>
                    {dati.dettagliImpianto.composizione}
                  </Text>
                </View>
                <View style={stili.rigaDato}>
                  <Text style={stili.rigaDatoEtichetta}>Potenza</Text>
                  <Text style={stili.rigaDatoValore}>
                    {dati.dettagliImpianto.potenzaKwp}
                  </Text>
                </View>
                <View style={stili.rigaDato}>
                  <Text style={stili.rigaDatoEtichetta}>Produzione stimata</Text>
                  <Text style={stili.rigaDatoValore}>
                    {dati.dettagliImpianto.produzioneKwh}
                  </Text>
                </View>
                {dati.dettagliImpianto.resaSpecifica ? (
                  <View style={stili.rigaDato}>
                    <Text style={stili.rigaDatoEtichetta}>Resa specifica</Text>
                    <Text style={stili.rigaDatoValore}>
                      {dati.dettagliImpianto.resaSpecifica}
                    </Text>
                  </View>
                ) : null}
                {dati.dettagliImpianto.consumoKwh ? (
                  <View style={stili.rigaDato}>
                    <Text style={stili.rigaDatoEtichetta}>Consumo annuo</Text>
                    <Text style={stili.rigaDatoValore}>
                      {dati.dettagliImpianto.consumoKwh}
                    </Text>
                  </View>
                ) : null}
              </View>
              {dati.dettagliImpianto.falde.length > 0 ? (
                <View style={{ marginBottom: 14 }}>
                  <TitoloSezione titolo="Falde considerate" />
                  {dati.dettagliImpianto.falde.map((f) => (
                    <View key={f.etichetta} style={stili.rigaDato}>
                      <Text style={stili.rigaDatoEtichetta}>{f.etichetta}</Text>
                      <Text style={stili.rigaDatoValore}>
                        inclinazione {f.inclinazione} · esposizione {f.esposizione}
                        {f.area ? ` · ${f.area}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={stili.paragrafo}>{dati.dettagliImpianto.regimeRid}</Text>
              <Text style={stili.paragrafo}>
                {dati.dettagliImpianto.detrazioneSintesi}
              </Text>
            </>
          ) : null}
        </View>
        <PieDiPagina />
      </Page>

      <Page size="A4" style={stili.pagina}>
        <IntestazioneSezione logoSrc={logoSrc} titolo="Listino e condizioni" />
        <View style={stili.corpo}>
          <TitoloSezione numero="02" titolo="Listino" />
          <View style={stili.tabella}>
            <View style={stili.thead}>
              <Text style={[stili.th, stili.colDesc]}>Descrizione</Text>
              <Text style={[stili.th, stili.colQty, stili.tdDestra]}>Q.tà</Text>
              <Text style={[stili.th, stili.colPrezzo, stili.tdDestra]}>Prezzo</Text>
              <Text style={[stili.th, stili.colSconto, stili.tdDestra]}>Sconto</Text>
              <Text style={[stili.th, stili.colIva, stili.tdDestra]}>IVA</Text>
              <Text style={[stili.th, stili.colImporto, stili.tdDestra]}>Importo</Text>
            </View>
            {dati.righe.map((riga, indice) => (
              <View
                key={`${riga.descrizione}-${indice}`}
                style={indice % 2 === 1 ? [stili.riga, stili.rigaAlt] : stili.riga}
                wrap={false}
              >
                <Text style={[stili.td, stili.colDesc]}>{riga.descrizione}</Text>
                <Text style={[stili.td, stili.colQty, stili.tdDestra]}>
                  {riga.quantita} {riga.unita}
                </Text>
                <Text style={[stili.td, stili.colPrezzo, stili.tdDestra]}>
                  {riga.prezzoUnitario}
                </Text>
                <Text style={[stili.td, stili.colSconto, stili.tdDestra]}>
                  {riga.scontoPct ?? '—'}
                </Text>
                <Text style={[stili.td, stili.colIva, stili.tdDestra]}>{riga.ivaPct}</Text>
                <Text style={[stili.td, stili.colImporto, stili.tdDestra]}>
                  {riga.importo}
                </Text>
              </View>
            ))}
          </View>

          <View style={stili.riepilogoWrap}>
            <View style={stili.riepilogo}>
              {dati.scontoGlobalePct ? (
                <View style={stili.riepilogoRiga}>
                  <Text style={stili.riepilogoEtichetta}>Sconto globale</Text>
                  <Text style={stili.riepilogoValore}>{dati.scontoGlobalePct}</Text>
                </View>
              ) : null}
              <View style={stili.riepilogoRiga}>
                <Text style={stili.riepilogoEtichetta}>Imponibile</Text>
                <Text style={stili.riepilogoValore}>{dati.imponibile}</Text>
              </View>
              {dati.ripartizioneIva.map((v) => (
                <View key={v.etichetta} style={stili.riepilogoRiga}>
                  <Text style={stili.riepilogoEtichetta}>{v.etichetta}</Text>
                  <Text style={stili.riepilogoValore}>{v.imposta}</Text>
                </View>
              ))}
              {dati.ripartizioneIva.length === 0 ? (
                <View style={stili.riepilogoRiga}>
                  <Text style={stili.riepilogoEtichetta}>IVA</Text>
                  <Text style={stili.riepilogoValore}>{dati.totaleIva}</Text>
                </View>
              ) : null}
              <View style={stili.totale}>
                <Text style={stili.totaleEtichetta}>Totale</Text>
                <Text style={stili.totaleValore}>{dati.totaleLordo}</Text>
              </View>
            </View>
          </View>

          {dati.condizioniEconomiche ? (
            <>
              <TitoloSezione numero="03" titolo="Condizioni economiche" />
              <View style={stili.metricheGriglia}>
                <View style={stili.metrica}>
                  <Text style={stili.metricaEtichetta}>Investimento FV</Text>
                  <Text style={stili.metricaValore}>
                    {dati.condizioniEconomiche.totaleLordo}
                  </Text>
                  <Text style={stili.metricaNota}>
                    Detrazione {dati.condizioniEconomiche.detrazionePct}:{' '}
                    {dati.condizioniEconomiche.detrazioneImporto}
                  </Text>
                  <Text style={stili.metricaNota}>
                    Netto indicativo: {dati.condizioniEconomiche.nettoIndicativo}
                  </Text>
                </View>
                <View style={stili.metrica}>
                  <Text style={stili.metricaEtichetta}>Bolletta e risparmio</Text>
                  <Text style={stili.metricaValore}>
                    {dati.condizioniEconomiche.risparmioMensile}
                  </Text>
                  <Text style={stili.metricaNota}>Risparmio mensile stimato</Text>
                  <Text style={stili.metricaNota}>
                    Attuale / mese: {dati.condizioniEconomiche.bollettaAttualeMensile}
                  </Text>
                  <Text style={stili.metricaNota}>
                    Con FV / mese: {dati.condizioniEconomiche.bollettaConFvMensile}
                  </Text>
                  <Text style={stili.metricaNota}>
                    Anno 1: {dati.condizioniEconomiche.risparmioAnnuo}
                    {dati.condizioniEconomiche.paybackAnni
                      ? ` · ritorno in ${dati.condizioniEconomiche.paybackAnni}`
                      : ''}
                  </Text>
                </View>
              </View>
              <Text style={[stili.chiusuraTesto, { marginBottom: 12 }]}>
                Stime indicative da studio tetto: non sostituiscono una consulenza
                fiscale né una quotazione bancaria.
              </Text>
              {dati.bloccoTermico ? (
                <View style={stili.note}>
                  <Text style={stili.noteTitolo}>
                    {dati.bloccoTermico.tipoEtichetta}
                  </Text>
                  <Text style={stili.noteTesto}>{dati.bloccoTermico.descrizione}</Text>
                  <Text style={[stili.noteTesto, { marginTop: 6 }]}>
                    Prezzo IVA inclusa: {dati.bloccoTermico.prezzoLordo} · detrazione{' '}
                    {dati.bloccoTermico.detrazionePct}:{' '}
                    {dati.bloccoTermico.detrazioneImporto}
                    {dati.bloccoTermico.contoTermico
                      ? ` · Conto Termico indicativo: ${dati.bloccoTermico.contoTermico}`
                      : ''}
                  </Text>
                  <Text style={stili.noteTesto}>
                    Netto indicativo: {dati.bloccoTermico.nettoIndicativo}
                  </Text>
                </View>
              ) : null}
              <Text style={stili.paragrafo}>
                {dati.condizioniEconomiche.notePagamento}
              </Text>
            </>
          ) : null}

          {dati.note ? (
            <View style={stili.note}>
              <Text style={stili.noteTitolo}>Note</Text>
              <Text style={stili.noteTesto}>{dati.note}</Text>
            </View>
          ) : null}

          <View style={stili.chiusura}>
            <Text style={stili.chiusuraTesto}>
              Documento generato da {ECOSOLARE.nome}. I prezzi sono da intendersi IVA
              inclusa solo nel totale indicato. Per accettare la proposta contattateci
              presso una delle sedi sotto, via email a {ECOSOLARE.email} oppure su{' '}
              {ECOSOLARE.sito}.
            </Text>
          </View>
        </View>
        <PieDiPagina />
      </Page>

      <Page size="A4" style={stili.pagina}>
        <IntestazioneSezione
          logoSrc={logoSrc}
          titolo="Incluso, escluso e garanzie"
        />
        <View style={stili.corpo}>
          <TitoloSezione numero="04" titolo="Attività incluse — impianto FV" />
          {dati.dossierTestuale.incluso.map((voce) => (
            <Text key={voce} style={stili.bullet}>
              <Text style={stili.bulletOro}>— </Text>
              {voce}
            </Text>
          ))}
          <View style={{ marginTop: 16 }}>
            <TitoloSezione numero="05" titolo="Attività escluse dall’offerta" />
          </View>
          {dati.dossierTestuale.escluso.map((voce) => (
            <Text key={voce} style={stili.bullet}>
              <Text style={stili.bulletOro}>— </Text>
              {voce}
            </Text>
          ))}
          <View style={{ marginTop: 16 }}>
            <TitoloSezione numero="06" titolo="Garanzie" />
          </View>
          {dati.dossierTestuale.garanzie.map((g) => (
            <View key={g.titolo} style={stili.garanziaBlocco} wrap={false}>
              <Text style={stili.cardTitolo}>{g.titolo}</Text>
              {g.punti.map((p) => (
                <Text key={p} style={stili.bullet}>
                  <Text style={stili.bulletOro}>— </Text>
                  {p}
                </Text>
              ))}
            </View>
          ))}
          <Text style={stili.paragrafo}>{dati.dossierTestuale.notaGaranzia}</Text>
        </View>
        <PieDiPagina />
      </Page>

      {dati.pagineMarketing.map((src, i) => (
        <Page key={`mkt-${i}`} size="A4" style={stili.paginaPiena}>
          <View wrap={false} style={{ width: '100%', height: '100%' }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={src} style={stili.marketingFull} />
          </View>
          <Text
            style={stili.pageNumberMarketing}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            fixed
          />
        </Page>
      ))}

      {dati.planimetria ? (
        <Page size="A4" style={stili.pagina}>
          <IntestazioneSezione
            logoSrc={logoSrc}
            titolo={
              dati.planimetria.fotoDataUri
                ? '07 · Vista satellitare'
                : '07 · Planimetria moduli'
            }
          />
          <View style={stili.corpo}>
            <Text style={stili.paragrafo}>
              {dati.planimetria.fotoDataUri
                ? `Ortofoto del tetto con i moduli concordati nello studio. ${dati.planimetria.legenda}`
                : dati.planimetria.legenda}
            </Text>
            <View style={stili.planimetriaWrap} wrap={false}>
              {dati.planimetria.fotoDataUri ? (
                <View style={stili.planimetriaFotoBox} wrap={false}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image
                    src={dati.planimetria.fotoDataUri}
                    style={stili.planimetriaFoto}
                  />
                  <Svg
                    style={stili.planimetriaOverlay}
                    viewBox={dati.planimetria.viewBox}
                    width={480}
                    height={480}
                  >
                    {dati.planimetria.poligoniPaths.map((d, i) => (
                      <Path
                        key={`poli-${i}`}
                        d={d}
                        stroke={C.bluChiaro}
                        strokeWidth={8}
                        fill="rgba(91,155,213,0.16)"
                      />
                    ))}
                    {dati.planimetria.moduliPaths.map((d, i) => (
                      <Path
                        key={`mod-${i}`}
                        d={d}
                        stroke="#e8c765"
                        strokeWidth={5}
                        fill="rgba(30,58,95,0.8)"
                      />
                    ))}
                  </Svg>
                </View>
              ) : (
                <Svg viewBox={dati.planimetria.viewBox} width={480} height={480}>
                  {dati.planimetria.poligoniPaths.map((d, i) => (
                    <Path
                      key={`poli-${i}`}
                      d={d}
                      stroke={C.blu}
                      strokeWidth={0.12}
                      fill="rgba(63,127,196,0.1)"
                    />
                  ))}
                  {dati.planimetria.moduliPaths.map((d, i) => (
                    <Path
                      key={`mod-${i}`}
                      d={d}
                      stroke={C.oro}
                      strokeWidth={0.08}
                      fill="rgba(217,164,65,0.55)"
                    />
                  ))}
                </Svg>
              )}
            </View>
            <Text style={stili.chiusuraTesto}>
              {dati.planimetria.fotoDataUri
                ? 'Vista satellitare dallo studio tetto EcoSolare. Non sostituisce il rilievo di cantiere.'
                : 'Disegno dallo studio tetto EcoSolare. Non sostituisce il rilievo di cantiere.'}
            </Text>
          </View>
          <PieDiPagina />
        </Page>
      ) : null}

      {dati.simulazione ? (
        <Page size="A4" style={stili.pagina}>
          <IntestazioneSezione
            logoSrc={logoSrc}
            titolo="08 · Simulazione energetica"
          />
          <View style={stili.corpo}>
            <Text style={stili.paragrafo}>{dati.simulazione.tariffe}</Text>
            <TitoloSezione titolo="Flussi energetici annui" />
            <View style={stili.kpiRiga}>
              <View style={stili.kpiBox}>
                <Text style={stili.kpiEtichetta}>Produzione</Text>
                <Text style={stili.kpiValore}>{dati.simulazione.flussi.produzione}</Text>
              </View>
              <View style={stili.kpiBox}>
                <Text style={stili.kpiEtichetta}>Autoconsumo</Text>
                <Text style={stili.kpiValore}>
                  {dati.simulazione.flussi.autoconsumo}
                </Text>
              </View>
              <View style={stili.kpiBox}>
                <Text style={stili.kpiEtichetta}>Immissione / prelievo</Text>
                <Text style={stili.kpiValore}>
                  {dati.simulazione.flussi.exportRete}
                </Text>
                <Text style={stili.kpiUnita}>
                  Prelievo {dati.simulazione.flussi.daRete}
                </Text>
              </View>
            </View>

            <View style={stili.metricheGriglia}>
              <View style={stili.metrica}>
                <Text style={stili.metricaEtichetta}>Valore attuale netto</Text>
                <Text style={stili.metricaValore}>{dati.simulazione.npv}</Text>
                <Text style={stili.metricaNota}>
                  Orizzonte {dati.simulazione.orizzonteAnni} anni
                </Text>
              </View>
              <View style={stili.metrica}>
                <Text style={stili.metricaEtichetta}>Ritorno investimento</Text>
                <Text style={stili.metricaValore}>
                  {dati.simulazione.paybackAnni ?? 'Oltre l’orizzonte'}
                </Text>
              </View>
            </View>

            <TitoloSezione
              titolo={`Flussi di cassa (primi ${dati.simulazione.cashflow.length} anni)`}
            />
            <View style={stili.tabella}>
              <View style={stili.thead}>
                <Text style={[stili.th, stili.colCashAnno]}>Anno</Text>
                <Text style={[stili.th, stili.colCash, stili.tdDestra]}>
                  Risparmio
                </Text>
                <Text style={[stili.th, stili.colCash, stili.tdDestra]}>
                  Detrazione
                </Text>
                <Text style={[stili.th, stili.colCashFlusso, stili.tdDestra]}>
                  Flusso
                </Text>
              </View>
              {dati.simulazione.cashflow.map((r, indice) => (
                <View
                  key={r.anno}
                  style={indice % 2 === 1 ? [stili.riga, stili.rigaAlt] : stili.riga}
                >
                  <Text style={[stili.td, stili.colCashAnno]}>{r.anno}</Text>
                  <Text style={[stili.td, stili.colCash, stili.tdDestra]}>
                    {r.risparmio}
                  </Text>
                  <Text style={[stili.td, stili.colCash, stili.tdDestra]}>
                    {r.detrazione}
                  </Text>
                  <Text style={[stili.td, stili.colCashFlusso, stili.tdDestra]}>
                    {r.flusso}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={stili.chiusuraTesto}>
              Simulazione calcolata sui dati dello studio tetto del cliente. Non
              sostituisce un progetto esecutivo né una certificazione di producibilità.
            </Text>
          </View>
          <PieDiPagina />
        </Page>
      ) : null}
    </Document>
  )
}
