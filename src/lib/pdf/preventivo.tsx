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

const C = ECOSOLARE.colori

const stili = StyleSheet.create({
  pagina: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.abisso,
    backgroundColor: '#ffffff',
    paddingBottom: 96,
  },
  hero: {
    backgroundColor: C.abisso,
    paddingTop: 28,
    paddingBottom: 26,
    paddingHorizontal: 36,
    marginBottom: 22,
  },
  heroRiga: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logo: {
    width: 148,
    height: 42,
    objectFit: 'contain',
  },
  heroMeta: {
    alignItems: 'flex-end',
  },
  eyebrow: {
    color: C.oro,
    fontSize: 8,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  titoloHero: {
    color: C.testo,
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    maxWidth: 260,
    textAlign: 'right',
  },
  metaHero: {
    color: C.testoTenue,
    fontSize: 8.5,
    textAlign: 'right',
    marginTop: 2,
  },
  oroBar: {
    height: 3,
    backgroundColor: C.oro,
    marginTop: 18,
  },
  corpo: {
    paddingHorizontal: 36,
  },
  griglia: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
  },
  cardTitolo: {
    fontSize: 7.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.blu,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  cardTesto: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.abisso,
    marginBottom: 2,
  },
  cardSecondario: {
    fontSize: 8.5,
    color: '#475569',
    lineHeight: 1.35,
  },
  kpiRiga: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  kpiBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(217, 164, 65, 0.45)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: C.abisso,
  },
  kpiEtichetta: {
    fontSize: 7,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: C.oro,
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
  },
  kpiValore: {
    fontSize: 13,
    color: '#f8fafc',
    fontFamily: 'Helvetica-Bold',
  },
  kpiUnita: {
    fontSize: 8,
    color: C.testoTenue,
    marginTop: 2,
  },
  sezioneTitolo: {
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: C.blu,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  tabella: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 18,
  },
  thead: {
    flexDirection: 'row',
    backgroundColor: C.abisso,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  th: {
    color: C.testoTenue,
    fontSize: 7,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
  },
  riga: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    alignItems: 'flex-start',
  },
  rigaAlt: {
    backgroundColor: '#f8fafc',
  },
  td: {
    fontSize: 8.5,
    color: C.abisso,
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
    marginBottom: 18,
  },
  riepilogo: {
    width: 230,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  riepilogoRiga: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  riepilogoEtichetta: {
    fontSize: 8.5,
    color: '#64748b',
  },
  riepilogoValore: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.abisso,
  },
  totale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.abisso,
  },
  totaleEtichetta: {
    color: C.oro,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
  },
  totaleValore: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
  },
  note: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noteTitolo: {
    fontSize: 7.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: C.blu,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  noteTesto: {
    fontSize: 8.5,
    color: '#334155',
    lineHeight: 1.4,
  },
  chiusura: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  chiusuraTesto: {
    fontSize: 8,
    color: '#64748b',
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.abisso,
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 36,
  },
  footerContatti: {
    alignItems: 'center',
    marginBottom: 10,
  },
  footerSito: {
    color: C.oroChiaro,
    fontSize: 8.5,
    letterSpacing: 0.8,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  footerEmail: {
    color: C.testoTenue,
    fontSize: 7.5,
    textAlign: 'center',
  },
  footerSedi: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  sede: {
    flex: 1,
  },
  sedeNome: {
    color: C.oro,
    fontSize: 7.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  sedeRiga: {
    color: C.testoTenue,
    fontSize: 7.5,
    lineHeight: 1.35,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 78,
    right: 36,
    fontSize: 7.5,
    color: '#94a3b8',
  },
  rigaDato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  rigaDatoEtichetta: {
    fontSize: 8.5,
    color: '#64748b',
    width: '42%',
  },
  rigaDatoValore: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.abisso,
    width: '56%',
    textAlign: 'right',
  },
  paragrafo: {
    fontSize: 8.5,
    color: '#334155',
    lineHeight: 1.4,
    marginBottom: 8,
  },
  heroCompatto: {
    backgroundColor: C.abisso,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 36,
    marginBottom: 18,
  },
  titoloSezionePagina: {
    color: '#f8fafc',
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },
  colCashAnno: { width: '12%' },
  colCash: { width: '22%' },
  colCashFlusso: { width: '22%' },
  bullet: {
    fontSize: 8.5,
    color: '#334155',
    lineHeight: 1.35,
    marginBottom: 4,
    paddingLeft: 8,
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
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
})

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
      <View style={stili.oroBar} />
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
            {/* @react-pdf/renderer: Image non espone alt HTML */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoSrc} style={stili.logo} />
            <View style={stili.heroMeta}>
              <Text style={stili.eyebrow}>Preventivo</Text>
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
            <View style={stili.card}>
              <Text style={stili.cardTitolo}>Cliente</Text>
              <Text style={stili.cardTesto}>{dati.clienteNome || '—'}</Text>
              {dati.aziendaCliente ? (
                <Text style={stili.cardSecondario}>{dati.aziendaCliente}</Text>
              ) : null}
            </View>
            <View style={stili.card}>
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
                <Text style={stili.kpiValore}>
                  {dati.copertinaKpi.moduli}/{dati.copertinaKpi.moduli}
                </Text>
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
              <Text style={stili.sezioneTitolo}>1 · Dettagli impianto</Text>
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
                <View style={{ marginBottom: 12 }}>
                  <Text style={stili.sezioneTitolo}>Falde considerate</Text>
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
          <Text style={stili.sezioneTitolo}>Dettaglio economico</Text>
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
              <Text style={stili.sezioneTitolo}>7 · Condizioni economiche</Text>
              <View style={stili.griglia}>
                <View style={stili.card}>
                  <Text style={stili.cardTitolo}>Investimento FV</Text>
                  <Text style={stili.cardTesto}>
                    {dati.condizioniEconomiche.totaleLordo}
                  </Text>
                  <Text style={stili.cardSecondario}>
                    Detrazione {dati.condizioniEconomiche.detrazionePct}:{' '}
                    {dati.condizioniEconomiche.detrazioneImporto}
                  </Text>
                  <Text style={stili.cardSecondario}>
                    Netto indicativo: {dati.condizioniEconomiche.nettoIndicativo}
                  </Text>
                </View>
                <View style={stili.card}>
                  <Text style={stili.cardTitolo}>Bolletta e risparmio</Text>
                  <Text style={stili.cardSecondario}>
                    Attuale / mese: {dati.condizioniEconomiche.bollettaAttualeMensile}
                  </Text>
                  <Text style={stili.cardSecondario}>
                    Con FV / mese: {dati.condizioniEconomiche.bollettaConFvMensile}
                  </Text>
                  <Text style={stili.cardTesto}>
                    Risparmio / mese: {dati.condizioniEconomiche.risparmioMensile}
                  </Text>
                  <Text style={stili.cardSecondario}>
                    Anno 1: {dati.condizioniEconomiche.risparmioAnnuo}
                    {dati.condizioniEconomiche.paybackAnni
                      ? ` · payback ${dati.condizioniEconomiche.paybackAnni}`
                      : ''}
                  </Text>
                </View>
              </View>
              {dati.bloccoTermico ? (
                <View style={[stili.note, { marginTop: 8 }]}>
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
          <Text style={stili.sezioneTitolo}>Attività incluse — impianto FV</Text>
          {dati.dossierTestuale.incluso.map((voce) => (
            <Text key={voce} style={stili.bullet}>
              • {voce}
            </Text>
          ))}
          <Text style={[stili.sezioneTitolo, { marginTop: 14 }]}>
            Attività escluse dall’offerta
          </Text>
          {dati.dossierTestuale.escluso.map((voce) => (
            <Text key={voce} style={stili.bullet}>
              • {voce}
            </Text>
          ))}
          <Text style={[stili.sezioneTitolo, { marginTop: 14 }]}>Garanzie</Text>
          {dati.dossierTestuale.garanzie.map((g) => (
            <View key={g.titolo} style={{ marginBottom: 8 }} wrap={false}>
              <Text style={stili.cardTitolo}>{g.titolo}</Text>
              {g.punti.map((p) => (
                <Text key={p} style={stili.bullet}>
                  • {p}
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
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={src} style={stili.marketingFull} />
        </Page>
      ))}

      {dati.planimetria ? (
        <Page size="A4" style={stili.pagina}>
          <IntestazioneSezione
            logoSrc={logoSrc}
            titolo="Planimetria moduli"
          />
          <View style={stili.corpo}>
            <Text style={stili.paragrafo}>{dati.planimetria.legenda}</Text>
            <View style={stili.planimetriaWrap}>
              <Svg viewBox={dati.planimetria.viewBox} width={480} height={480}>
                {dati.planimetria.poligoniPaths.map((d, i) => (
                  <Path
                    key={`poli-${i}`}
                    d={d}
                    stroke={C.blu}
                    strokeWidth={0.12}
                    fill="rgba(37,99,235,0.08)"
                  />
                ))}
                {dati.planimetria.moduliPaths.map((d, i) => (
                  <Path
                    key={`mod-${i}`}
                    d={d}
                    stroke={C.oro}
                    strokeWidth={0.06}
                    fill="rgba(217,164,65,0.55)"
                  />
                ))}
              </Svg>
            </View>
            <Text style={stili.chiusuraTesto}>
              Disegno dallo studio tetto EcoSolare. Non sostituisce il rilievo di
              cantiere.
            </Text>
          </View>
          <PieDiPagina />
        </Page>
      ) : null}

      {dati.simulazione ? (
        <Page size="A4" style={stili.pagina}>
          <IntestazioneSezione
            logoSrc={logoSrc}
            titolo="Allegato · Simulazione energetica"
          />
          <View style={stili.corpo}>
            <Text style={stili.paragrafo}>{dati.simulazione.tariffe}</Text>
            <Text style={stili.sezioneTitolo}>Flussi energetici annui</Text>
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
                <Text style={stili.kpiEtichetta}>Export / da rete</Text>
                <Text style={stili.kpiValore}>
                  {dati.simulazione.flussi.exportRete}
                </Text>
                <Text style={stili.kpiUnita}>
                  Prelievo {dati.simulazione.flussi.daRete}
                </Text>
              </View>
            </View>

            <View style={stili.griglia}>
              <View style={stili.card}>
                <Text style={stili.cardTitolo}>NPV</Text>
                <Text style={stili.cardTesto}>{dati.simulazione.npv}</Text>
                <Text style={stili.cardSecondario}>
                  Orizzonte {dati.simulazione.orizzonteAnni} anni
                </Text>
              </View>
              <View style={stili.card}>
                <Text style={stili.cardTitolo}>Payback</Text>
                <Text style={stili.cardTesto}>
                  {dati.simulazione.paybackAnni ?? 'Oltre l’orizzonte'}
                </Text>
              </View>
            </View>

            <Text style={stili.sezioneTitolo}>
              Cashflow (primi {dati.simulazione.cashflow.length} anni)
            </Text>
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
