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
import type { ReactNode } from 'react'
import { ECOSOLARE } from '@/lib/brand/ecosolare'
import type { DatiPdfPreventivo } from '@/lib/pdf/dati-preventivo'
import { TERMINI_PAGAMENTO } from '@/lib/pdf/dossier-testi'
import { FONT_CORPO } from '@/lib/pdf/fonti-preventivo'
import {
  BarraStackedOrizzontale,
  BarreCashflow,
  BarreMensili,
} from '@/lib/pdf/grafici'

const P = ECOSOLARE.pdf

const stili = StyleSheet.create({
  pagina: {
    fontFamily: FONT_CORPO,
    fontWeight: 400,
    fontSize: 9.5,
    color: P.inchiostro,
    backgroundColor: P.carta,
    paddingTop: 26,
    paddingBottom: 68,
    paddingHorizontal: 42,
  },
  logoCentro: {
    width: 138,
    height: 40,
    objectFit: 'contain',
    alignSelf: 'center',
    marginBottom: 16,
  },
  logoPiccolo: {
    width: 68,
    height: 20,
    objectFit: 'contain',
  },
  letterhead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 24,
  },
  letterCol: { flex: 1 },
  letterLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    color: P.blu,
    marginBottom: 4,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  letterNome: {
    fontSize: 11.5,
    fontWeight: 700,
    color: P.inchiostro,
    marginBottom: 3,
  },
  letterMeta: {
    fontSize: 8,
    color: P.inchiostroMorbido,
    lineHeight: 1.4,
  },
  titoloCentro: {
    fontSize: 15,
    fontWeight: 700,
    textAlign: 'center',
    color: P.inchiostro,
    marginBottom: 6,
    lineHeight: 1.25,
    paddingHorizontal: 12,
  },
  regolaOro: {
    alignSelf: 'center',
    width: 56,
    height: 2,
    backgroundColor: P.oro,
    marginBottom: 10,
    borderRadius: 1,
  },
  metaRiga: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  metaTesto: {
    fontSize: 8.5,
    color: P.inchiostroMorbido,
    fontWeight: 500,
  },
  heroWrap: {
    marginBottom: 12,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: P.linea,
  },
  heroFoto: {
    width: '100%',
    height: 248,
    objectFit: 'cover',
  },
  heroSvgWrap: {
    width: '100%',
    height: 210,
    backgroundColor: P.cartaSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(26, 47, 78, 0.94)',
    paddingVertical: 11,
    paddingHorizontal: 6,
  },
  kpiCella: {
    flex: 1,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.12)',
  },
  kpiCellaUltima: {
    flex: 1,
    paddingHorizontal: 10,
  },
  kpiLabel: {
    fontSize: 6.2,
    color: '#b7c4d6',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 4,
    fontWeight: 500,
  },
  kpiValore: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#ffffff',
  },
  kpiBarretta: {
    height: 2.5,
    backgroundColor: P.verde,
    marginTop: 6,
    borderRadius: 1,
    width: '62%',
  },
  trustGriglia: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  trustCard: {
    flex: 1,
    backgroundColor: P.cartaSoft,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: P.linea,
    borderTopWidth: 2.5,
    borderTopColor: P.oro,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  trustTesto: {
    fontSize: 7,
    color: P.inchiostro,
    textAlign: 'center',
    lineHeight: 1.35,
    fontWeight: 500,
  },
  h1Riga: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  h1Barra: {
    width: 4,
    height: 16,
    backgroundColor: P.oro,
    borderRadius: 1,
  },
  h1: {
    fontSize: 12.5,
    fontWeight: 700,
    color: P.inchiostro,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  h2: {
    fontSize: 10,
    fontWeight: 700,
    color: P.bluScuro,
    marginTop: 14,
    marginBottom: 7,
    letterSpacing: 0.25,
    textTransform: 'uppercase',
  },
  paragrafo: {
    fontSize: 9.5,
    lineHeight: 1.55,
    color: P.inchiostro,
    marginBottom: 8,
  },
  enfasi: {
    fontWeight: 700,
    color: P.inchiostro,
  },
  bullet: {
    fontSize: 9,
    lineHeight: 1.5,
    color: P.inchiostro,
    marginBottom: 4.5,
    paddingLeft: 2,
  },
  rigaDue: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  col: { flex: 1 },
  box: {
    borderWidth: 1,
    borderColor: P.linea,
    borderRadius: 5,
    padding: 12,
    marginBottom: 12,
    backgroundColor: P.cartaSoft,
  },
  etichetta: {
    fontSize: 7,
    fontWeight: 700,
    color: P.inchiostroMorbido,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    marginBottom: 5,
  },
  valoreGrande: {
    fontSize: 15,
    fontWeight: 700,
    color: P.inchiostro,
  },
  valoreVerde: {
    fontSize: 15,
    fontWeight: 700,
    color: P.verde,
  },
  valoreArancio: {
    fontSize: 15,
    fontWeight: 700,
    color: P.arancio,
  },
  tabella: {
    marginTop: 4,
    marginBottom: 10,
  },
  thead: {
    flexDirection: 'row',
    backgroundColor: P.bluScuro,
    paddingVertical: 7,
    paddingHorizontal: 7,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  th: {
    fontSize: 6.8,
    fontWeight: 700,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  riga: {
    flexDirection: 'row',
    borderBottomWidth: 0.7,
    borderBottomColor: P.linea,
    paddingVertical: 6,
    paddingHorizontal: 7,
  },
  td: {
    fontSize: 8.2,
    color: P.inchiostro,
  },
  colDesc: { flex: 3.2 },
  colQty: { width: 52, textAlign: 'right' },
  colPrezzo: { width: 58, textAlign: 'right' },
  colSconto: { width: 40, textAlign: 'right' },
  colIva: { width: 36, textAlign: 'right' },
  colImporto: { width: 62, textAlign: 'right' },
  totaleBox: {
    alignSelf: 'flex-end',
    backgroundColor: P.bluScuro,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  totaleEtichetta: {
    fontSize: 7.5,
    fontWeight: 700,
    color: P.oro,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totaleValore: {
    fontSize: 15,
    fontWeight: 700,
    color: '#ffffff',
  },
  firmaRiga: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 36,
    gap: 40,
  },
  firmaBlocco: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: P.blu,
    paddingTop: 8,
  },
  firmaLabel: {
    fontSize: 8,
    color: P.inchiostroMorbido,
    fontWeight: 500,
  },
  footer: {
    position: 'absolute',
    left: 42,
    right: 42,
    bottom: 18,
    borderTopWidth: 0.8,
    borderTopColor: P.linea,
    paddingTop: 7,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  footerTesto: {
    flex: 1,
    fontSize: 6.3,
    color: P.blu,
    lineHeight: 1.4,
  },
  paginaNum: {
    position: 'absolute',
    bottom: 20,
    right: 42,
    fontSize: 7,
    color: P.inchiostroMorbido,
  },
  marketing: {
    padding: 0,
  },
  marketingImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    objectFit: 'cover',
  },
  legendaDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 5,
    marginTop: 2,
  },
  legendaRiga: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  legendaTesto: {
    fontSize: 8,
    color: P.inchiostroMorbido,
    flex: 1,
  },
  kpiFinGriglia: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: P.linea,
    borderRadius: 5,
    marginBottom: 14,
    overflow: 'hidden',
  },
  kpiFinCella: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: P.linea,
    backgroundColor: P.carta,
  },
  chartCaption: {
    fontSize: 7.2,
    fontWeight: 700,
    color: P.inchiostroMorbido,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    marginBottom: 7,
    marginTop: 6,
  },
  chartFrame: {
    borderWidth: 1,
    borderColor: P.linea,
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    backgroundColor: P.carta,
  },
  designTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.2,
    borderBottomColor: P.blu,
    paddingBottom: 7,
    marginBottom: 12,
  },
  designBrand: {
    fontSize: 11,
    fontWeight: 700,
    color: P.bluScuro,
    letterSpacing: 0.3,
  },
  designBrandSub: {
    fontSize: 7.5,
    color: P.oro,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  designMeta: {
    fontSize: 7.5,
    color: P.inchiostroMorbido,
    textAlign: 'right',
  },
  designCliente: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: P.linea,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    backgroundColor: P.cartaSoft,
  },
  designClienteNome: {
    fontSize: 11,
    fontWeight: 700,
    color: P.inchiostro,
    textTransform: 'uppercase',
  },
  designClienteMeta: {
    fontSize: 8,
    color: P.inchiostroMorbido,
    marginTop: 2,
  },
  tettoRelativo: {
    width: '100%',
    height: 260,
    position: 'relative',
    backgroundColor: P.cartaSoft,
  },
  tettoFotoAbs: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 260,
    // fill: stesso rettangolo dell’SVG → moduli allineati ai pixel dell’ortofoto
    objectFit: 'fill',
  },
  tettoSvgAbs: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
  },
})

function Enfasi({ children }: { children: ReactNode }) {
  return <Text style={stili.enfasi}>{children}</Text>
}

function TitoloH1({ children }: { children: string }) {
  return (
    <View style={stili.h1Riga}>
      <View style={stili.h1Barra} />
      <Text style={stili.h1}>{children}</Text>
    </View>
  )
}

function HeaderLogo({ logoSrc }: { logoSrc: string }) {
  return <Image src={logoSrc} style={stili.logoCentro} />
}

function TrustStrip() {
  return (
    <View style={stili.trustGriglia}>
      {ECOSOLARE.trust.map((voce) => (
        <View key={voce} style={stili.trustCard}>
          <Text style={stili.trustTesto}>{voce}</Text>
        </View>
      ))}
    </View>
  )
}

/**
 * Ortofoto (o schema) con moduli dello studio tetto sovrapposti.
 * Prima mostravamo solo la foto satellitare senza overlay → tetto “vuoto”.
 */
function VistaTettoConModuli({
  planimetria,
  altezza = 260,
  mostraLegenda = true,
}: {
  readonly planimetria: NonNullable<DatiPdfPreventivo['planimetria']>
  readonly altezza?: number
  readonly mostraLegenda?: boolean
}) {
  const haFoto = Boolean(planimetria.fotoDataUri)
  const vb = planimetria.viewBox || '0 0 640 640'
  const overlay = (
    <Svg
      width="100%"
      height={altezza}
      viewBox={vb}
      style={haFoto ? stili.tettoSvgAbs : undefined}
    >
      {planimetria.poligoniPaths.map((d, i) => (
        <Path
          key={`p-${i}`}
          d={d}
          stroke={P.oro}
          strokeWidth={haFoto ? 3 : 1.5}
          fill={haFoto ? 'rgba(217,164,65,0.12)' : 'rgba(63,127,196,0.12)'}
        />
      ))}
      {planimetria.moduliPaths.map((d, i) => (
        <Path
          key={`m-${i}`}
          d={d}
          fill="#1a4f8c"
          stroke="#0a2744"
          strokeWidth={haFoto ? 1.2 : 0.5}
          fillOpacity={0.92}
        />
      ))}
    </Svg>
  )

  return (
    <View style={{ marginBottom: 8 }}>
      <View
        style={[
          stili.tettoRelativo,
          { height: altezza },
          ...(haFoto ? [] : [{ borderWidth: 1, borderColor: P.linea }]),
        ]}
      >
        {haFoto ? (
          <Image
            src={planimetria.fotoDataUri!}
            style={[stili.tettoFotoAbs, { height: altezza }]}
          />
        ) : null}
        {overlay}
      </View>
      {mostraLegenda && planimetria.legenda ? (
        <Text
          style={{
            fontSize: 7.5,
            color: P.inchiostroMorbido,
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          {planimetria.legenda} · layout dallo studio tetto EcoSolare
        </Text>
      ) : null}
    </View>
  )
}

function HeaderEcoSolareDesign({
  logoSrc,
  codice,
}: {
  logoSrc: string
  codice: string
}) {
  return (
    <View style={stili.designTop}>
      <View>
        <Text style={stili.designBrand}>EcoSolare Design</Text>
        <Text style={stili.designBrandSub}>Simulazione impianto</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Image src={logoSrc} style={{ width: 88, height: 26, objectFit: 'contain' }} />
        <Text style={stili.designMeta}>{codice}</Text>
      </View>
    </View>
  )
}

function BoxClienteDesign({ dati }: { dati: DatiPdfPreventivo }) {
  return (
    <View style={stili.designCliente}>
      <View>
        <Text style={stili.designClienteNome}>{dati.clienteNome}</Text>
        <Text style={stili.designClienteMeta}>
          {dati.immobileIndirizzo ?? dati.immobileEtichetta ?? '—'}
        </Text>
      </View>
      <Text style={[stili.designClienteMeta, { textAlign: 'right' }]}>
        {dati.dataDocumento}
        {'\n'}
        {dati.titolo || 'Impianto fotovoltaico'}
      </Text>
    </View>
  )
}

function FooterChiaro({ logoSrc }: { logoSrc: string }) {
  const sede1 = ECOSOLARE.sedi[0]
  const sede2 = ECOSOLARE.sedi[1]
  return (
    <View style={stili.footer} fixed>
      <Image src={logoSrc} style={stili.logoPiccolo} />
      <Text style={stili.footerTesto}>
        L.D. Service srl · {sede1?.via}, {sede1?.capCitta} · Tel. {sede1?.telefono}
        {'\n'}
        {sede2?.via}, {sede2?.capCitta} · Tel. {sede2?.telefono}
        {'\n'}
        <Text style={{ fontWeight: 700 }}>
          {ECOSOLARE.sito} — {ECOSOLARE.email}
        </Text>
      </Text>
    </View>
  )
}

function NumeroPagina() {
  return (
    <Text
      style={stili.paginaNum}
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      fixed
    />
  )
}

function PlanimetriaHero({
  dati,
}: {
  dati: DatiPdfPreventivo
}) {
  const p = dati.planimetria
  const kpi = dati.copertinaKpi
  return (
    <View style={stili.heroWrap}>
      {p ? (
        <VistaTettoConModuli
          planimetria={p}
          altezza={248}
          mostraLegenda={false}
        />
      ) : (
        <View style={[stili.heroSvgWrap, { height: 150 }]}>
          <Text style={{ color: P.inchiostroMorbido, fontSize: 9 }}>
            Vista impianto disponibile dopo lo studio tetto
          </Text>
        </View>
      )}
      {kpi ? (
        <View style={stili.kpiBar}>
          <View style={stili.kpiCella}>
            <Text style={stili.kpiLabel}>Moduli FV</Text>
            <Text style={stili.kpiValore}>
              {kpi.moduli}/{kpi.moduli}
            </Text>
            <View style={stili.kpiBarretta} />
          </View>
          <View style={stili.kpiCella}>
            <Text style={stili.kpiLabel}>Potenza CC</Text>
            <Text style={stili.kpiValore}>{kpi.kWp} kWp</Text>
            <View style={stili.kpiBarretta} />
          </View>
          <View style={stili.kpiCellaUltima}>
            <Text style={stili.kpiLabel}>Produzione / cons. annua</Text>
            <Text style={stili.kpiValore}>
              {kpi.produzioneMwh}
              {kpi.consumoMwh ? ` / ${kpi.consumoMwh}` : ''} MWh
            </Text>
            <View style={stili.kpiBarretta} />
          </View>
        </View>
      ) : null}
    </View>
  )
}

export function DocumentoPreventivo({
  dati,
  logoSrc,
}: {
  readonly dati: DatiPdfPreventivo
  readonly logoSrc: string
}) {
  const det = dati.dettagliImpianto
  const eco = dati.condizioniEconomiche
  const sim = dati.simulazione
  const mittente = dati.mittente

  return (
    <Document
      title={`Preventivo ${dati.codice}`}
      author={ECOSOLARE.nome}
      subject={dati.titolo}
    >
      {/* ——— 01 Copertina ——— */}
      <Page size="A4" style={stili.pagina}>
        <HeaderLogo logoSrc={logoSrc} />
        <View style={stili.letterhead}>
          <View style={stili.letterCol}>
            <Text style={stili.letterLabel}>Da:</Text>
            <Text style={stili.letterNome}>{ECOSOLARE.nome}</Text>
            <Text style={stili.letterMeta}>
              {mittente.nome}
              {mittente.ruolo ? `\n${mittente.ruolo}` : ''}
              {mittente.telefono ? `\n${mittente.telefono}` : ''}
              {mittente.email ? `\n${mittente.email}` : `\n${ECOSOLARE.email}`}
            </Text>
          </View>
          <View style={[stili.letterCol, { alignItems: 'flex-end' }]}>
            <Text style={stili.letterLabel}>Alla c.a.</Text>
            <Text style={[stili.letterNome, { textAlign: 'right' }]}>
              {dati.clienteNome}
            </Text>
            <Text style={[stili.letterMeta, { textAlign: 'right' }]}>
              {dati.aziendaCliente ? `${dati.aziendaCliente}\n` : ''}
              {dati.immobileIndirizzo ?? dati.immobileEtichetta ?? ''}
            </Text>
          </View>
        </View>

        <Text style={stili.titoloCentro}>
          Proposta {dati.titolo || 'Impianto Fotovoltaico'}
        </Text>
        <View style={stili.regolaOro} />
        <View style={stili.metaRiga}>
          <Text style={stili.metaTesto}>Data: {dati.dataDocumento}</Text>
          <Text style={stili.metaTesto}>
            N. Prev. {dati.codice}
            {dati.versione > 1 ? ` · v${dati.versione}` : ''}
          </Text>
        </View>

        <PlanimetriaHero dati={dati} />

        <TrustStrip />

        <FooterChiaro logoSrc={logoSrc} />
        <NumeroPagina />
      </Page>

      {/* ——— 02 Dettagli + producibilità + grafico ——— */}
      <Page size="A4" style={stili.pagina}>
        <HeaderLogo logoSrc={logoSrc} />
        <TitoloH1>1. Dettagli impianto</TitoloH1>
        <Text style={stili.h2}>Componenti essenziali dell’offerta</Text>
        {det ? (
          <Text style={stili.paragrafo}>
            L’impianto proposto avrà una potenza complessiva di{' '}
            <Enfasi>{det.potenzaKwp}</Enfasi> e sarà composto da{' '}
            <Enfasi>
              n. {det.moduli} pannelli
              {det.wattPicco != null ? ` da ${det.wattPicco} Wp` : ''}
            </Enfasi>
            {det.resaSpecifica ? (
              <>
                {' '}
                (resa specifica stimata <Enfasi>{det.resaSpecifica}</Enfasi>)
              </>
            ) : null}
            . Produzione annua stimata:{' '}
            <Enfasi>{det.produzioneKwh}</Enfasi>
            {det.consumoKwh ? (
              <>
                {' '}
                a fronte di un consumo di <Enfasi>{det.consumoKwh}</Enfasi>
              </>
            ) : null}
            .
          </Text>
        ) : (
          <Text style={stili.paragrafo}>
            I dettagli tecnici saranno definiti con lo studio tetto del cliente.
          </Text>
        )}

        <Text style={stili.h2}>Producibilità attesa per l’impianto</Text>
        <Text style={stili.paragrafo}>
          La producibilità prevista è calcolata sulle condizioni rilevate nello
          studio tetto e sul layout moduli posizionati in fase di sviluppo.
        </Text>
        {dati.planimetria ? (
          <VistaTettoConModuli
            planimetria={dati.planimetria}
            altezza={210}
            mostraLegenda
          />
        ) : null}
        {det && det.falde.length > 0 ? (
          <View style={{ marginBottom: 8 }}>
            {det.falde.map((f) => (
              <Text key={f.etichetta} style={stili.bullet}>
                • {f.etichetta}: inclinazione <Enfasi>{f.inclinazione}</Enfasi>
                {' · '}esposizione <Enfasi>{f.esposizione}</Enfasi>
                {f.area ? (
                  <>
                    {' · '}area <Enfasi>{f.area}</Enfasi>
                  </>
                ) : null}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={stili.h2}>Regime di funzionamento — incentivi</Text>
        {det ? (
          <>
            <Text style={stili.paragrafo}>{det.regimeRid}</Text>
            <Text style={stili.paragrafo}>
              È prevista la <Enfasi>detrazione fiscale</Enfasi>:{' '}
              {det.detrazioneSintesi}
            </Text>
          </>
        ) : null}

        <FooterChiaro logoSrc={logoSrc} />
        <NumeroPagina />
      </Page>

      {/* ——— 03 Caratteristiche / listino / incluso ——— */}
      <Page size="A4" style={stili.pagina}>
        <HeaderLogo logoSrc={logoSrc} />
        <TitoloH1>2. Caratteristiche</TitoloH1>
        <Text style={stili.h2}>Impianto fotovoltaico — listino</Text>

        <View style={stili.tabella}>
          <View style={stili.thead}>
            <Text style={[stili.th, stili.colDesc]}>Descrizione</Text>
            <Text style={[stili.th, stili.colQty]}>Q.tà</Text>
            <Text style={[stili.th, stili.colPrezzo]}>Prezzo</Text>
            <Text style={[stili.th, stili.colSconto]}>Sc.</Text>
            <Text style={[stili.th, stili.colIva]}>IVA</Text>
            <Text style={[stili.th, stili.colImporto]}>Importo</Text>
          </View>
          {dati.righe.map((riga, indice) => (
            <View key={`${riga.descrizione}-${indice}`} style={stili.riga} wrap={false}>
              <Text style={[stili.td, stili.colDesc]}>
                <Enfasi>{riga.descrizione}</Enfasi>
              </Text>
              <Text style={[stili.td, stili.colQty]}>
                {riga.quantita} {riga.unita}
              </Text>
              <Text style={[stili.td, stili.colPrezzo]}>{riga.prezzoUnitario}</Text>
              <Text style={[stili.td, stili.colSconto]}>{riga.scontoPct ?? '—'}</Text>
              <Text style={[stili.td, stili.colIva]}>{riga.ivaPct}</Text>
              <Text style={[stili.td, stili.colImporto]}>{riga.importo}</Text>
            </View>
          ))}
        </View>

        <View style={stili.totaleBox}>
          <Text style={stili.totaleEtichetta}>Totale IVA inclusa</Text>
          <Text style={stili.totaleValore}>{dati.totaleLordo}</Text>
        </View>

        <Text style={stili.h2}>Attività incluse — impianto FV</Text>
        {dati.dossierTestuale.incluso.map((voce) => (
          <Text key={voce} style={stili.bullet}>
            • {voce}
          </Text>
        ))}

        <Text style={stili.h2}>Esclusioni</Text>
        {dati.dossierTestuale.escluso.map((voce) => (
          <Text key={voce} style={stili.bullet}>
            • {voce}
          </Text>
        ))}

        {dati.bloccoTermico ? (
          <View style={stili.box}>
            <Text style={stili.h2}>{dati.bloccoTermico.tipoEtichetta}</Text>
            <Text style={stili.paragrafo}>{dati.bloccoTermico.descrizione}</Text>
            <Text style={stili.paragrafo}>
              Prezzo IVA inclusa: <Enfasi>{dati.bloccoTermico.prezzoLordo}</Enfasi>
              {' · '}detrazione <Enfasi>{dati.bloccoTermico.detrazionePct}</Enfasi>:{' '}
              <Enfasi>{dati.bloccoTermico.detrazioneImporto}</Enfasi>
              {dati.bloccoTermico.contoTermico ? (
                <>
                  {' · '}Conto Termico:{' '}
                  <Enfasi>{dati.bloccoTermico.contoTermico}</Enfasi>
                </>
              ) : null}
            </Text>
          </View>
        ) : null}

        <FooterChiaro logoSrc={logoSrc} />
        <NumeroPagina />
      </Page>

      {/* ——— 04 Garanzie ——— */}
      <Page size="A4" style={stili.pagina}>
        <HeaderLogo logoSrc={logoSrc} />
        <TitoloH1>Garanzie</TitoloH1>
        {dati.dossierTestuale.garanzie.map((g) => (
          <View key={g.titolo} style={{ marginBottom: 10 }}>
            <Text style={[stili.h2, { marginTop: 4 }]}>{g.titolo}</Text>
            {g.punti.map((p) => (
              <Text key={p} style={stili.bullet}>
                • {evidenziaAnni(p)}
              </Text>
            ))}
          </View>
        ))}
        <Text style={[stili.paragrafo, { marginTop: 10, color: P.inchiostroMorbido }]}>
          {dati.dossierTestuale.notaGaranzia}
        </Text>
        <FooterChiaro logoSrc={logoSrc} />
        <NumeroPagina />
      </Page>

      {/* ——— 05 Condizioni economiche ——— */}
      <Page size="A4" style={stili.pagina}>
        <HeaderLogo logoSrc={logoSrc} />
        <TitoloH1>7. Condizioni economiche</TitoloH1>
        <Text style={stili.h2}>Impianto fotovoltaico</Text>
        {eco ? (
          <>
            <Text style={stili.paragrafo}>
              Si propone quanto previsto al listino al prezzo di:{' '}
              <Enfasi>{eco.totaleLordo} IVA inclusa</Enfasi>
            </Text>
            <Text style={stili.paragrafo}>
              Importo della detrazione di imposta ({eco.detrazionePct}):{' '}
              <Enfasi>{eco.detrazioneImporto} IVA inclusa</Enfasi>
            </Text>
            <Text style={stili.paragrafo}>
              Netto indicativo dopo detrazione:{' '}
              <Enfasi>{eco.nettoIndicativo}</Enfasi>
            </Text>
          </>
        ) : (
          <Text style={stili.paragrafo}>
            Totale proposta: <Enfasi>{dati.totaleLordo}</Enfasi>
          </Text>
        )}

        {dati.bloccoTermico ? (
          <>
            <Text style={stili.h2}>
              Centrale termica — {dati.bloccoTermico.tipoEtichetta}
            </Text>
            <Text style={stili.paragrafo}>
              Prezzo: <Enfasi>{dati.bloccoTermico.prezzoLordo} IVA inclusa</Enfasi>
              {' · '}detrazione <Enfasi>{dati.bloccoTermico.detrazionePct}</Enfasi>:{' '}
              <Enfasi>{dati.bloccoTermico.detrazioneImporto}</Enfasi>
            </Text>
          </>
        ) : null}

        <Text style={stili.h2}>Termini di pagamento</Text>
        <View style={stili.rigaDue}>
          <Text style={[stili.paragrafo, stili.col]}>
            Acconto{'\n'}
            <Enfasi>{TERMINI_PAGAMENTO.acconto}</Enfasi>
          </Text>
          <Text style={[stili.paragrafo, stili.col]}>
            Saldo{'\n'}
            <Enfasi>{TERMINI_PAGAMENTO.saldo}</Enfasi>
          </Text>
        </View>

        <Text style={stili.h2}>Condizioni di validità dell’offerta</Text>
        <Text style={stili.paragrafo}>
          Offerta valida <Enfasi>{TERMINI_PAGAMENTO.validitaGiorniLavorativi} giorni lavorativi</Enfasi>
          {dati.validita ? (
            <>
              {' '}
              (scadenza indicata: <Enfasi>{dati.validita}</Enfasi>)
            </>
          ) : null}
          , salvo diversa comunicazione scritta.
        </Text>

        {dati.note ? (
          <View style={stili.box}>
            <Text style={stili.etichetta}>Note</Text>
            <Text style={stili.paragrafo}>{dati.note}</Text>
          </View>
        ) : null}

        <Text style={[stili.paragrafo, { marginTop: 16 }]}>
          Restiamo a disposizione per ogni chiarimento.
        </Text>

        <View style={stili.firmaRiga}>
          <View style={stili.firmaBlocco}>
            <Text style={stili.firmaLabel}>{ECOSOLARE.nome}</Text>
          </View>
          <View style={stili.firmaBlocco}>
            <Text style={stili.firmaLabel}>Per accettazione preventivo</Text>
          </View>
        </View>

        <FooterChiaro logoSrc={logoSrc} />
        <NumeroPagina />
      </Page>

      {/* ——— Marketing statico ——— */}
      {dati.pagineMarketing.map((src, i) => (
        <Page key={`mkt-${i}`} size="A4" style={stili.marketing}>
          <Image src={src} style={stili.marketingImg} />
          <NumeroPagina />
        </Page>
      ))}

      {/* ——— EcoSolare Design (cuore del preventivo, ex “SolarEdge Design”) ——— */}
      {sim && eco ? (
        <>
          {/* D1 — Vista tetto + panoramica finanziaria */}
          <Page size="A4" style={stili.pagina}>
            <HeaderEcoSolareDesign logoSrc={logoSrc} codice={dati.codice} />
            <BoxClienteDesign dati={dati} />

            <Text style={stili.h2}>Vista impianto — studio tetto</Text>
            {dati.planimetria ? (
              <VistaTettoConModuli
                planimetria={dati.planimetria}
                altezza={255}
                mostraLegenda
              />
            ) : (
              <View style={stili.box}>
                <Text style={stili.paragrafo}>
                  Layout moduli non disponibile: completa lo studio tetto in
                  Sviluppo per mostrare ortofoto e pannelli.
                </Text>
              </View>
            )}

            <Text style={stili.h2}>Panoramica finanziaria</Text>
            <View style={stili.kpiFinGriglia}>
              <View style={stili.kpiFinCella}>
                <Text style={stili.etichetta}>Pagamenti netti</Text>
                <Text style={stili.valoreArancio}>{eco.nettoIndicativo}</Text>
              </View>
              <View style={stili.kpiFinCella}>
                <Text style={stili.etichetta}>Risparmi a vita (NPV)</Text>
                <Text style={stili.valoreVerde}>{sim.npv}</Text>
              </View>
              <View style={[stili.kpiFinCella, { borderRightWidth: 0 }]}>
                <Text style={stili.etichetta}>Ammortamento</Text>
                <Text style={stili.valoreGrande}>
                  {sim.paybackAnni ?? '—'}
                </Text>
              </View>
            </View>

            <View style={stili.box}>
              <Text style={stili.etichetta}>Risultati della simulazione</Text>
              <View style={stili.rigaDue}>
                <Text style={[stili.paragrafo, stili.col]}>
                  Potenza CC{'\n'}
                  <Enfasi>{det?.potenzaKwp ?? '—'}</Enfasi>
                </Text>
                <Text style={[stili.paragrafo, stili.col]}>
                  Produzione annua{'\n'}
                  <Enfasi>{sim.flussi.produzione}</Enfasi>
                </Text>
                <Text style={[stili.paragrafo, stili.col]}>
                  Moduli FV{'\n'}
                  <Enfasi>
                    {String(det?.moduli ?? dati.copertinaKpi?.moduli ?? '—')}
                    {det?.wattPicco != null ? ` × ${det.wattPicco} Wp` : ''}
                  </Enfasi>
                </Text>
              </View>
              <Text
                style={[
                  stili.paragrafo,
                  { fontSize: 8, color: P.inchiostroMorbido, marginBottom: 0 },
                ]}
              >
                {sim.tariffe}
              </Text>
            </View>

            <FooterChiaro logoSrc={logoSrc} />
            <NumeroPagina />
          </Page>

          {/* D2 — Energia + tabella moduli + bolletta */}
          <Page size="A4" style={stili.pagina}>
            <HeaderEcoSolareDesign logoSrc={logoSrc} codice={dati.codice} />
            <BoxClienteDesign dati={dati} />

            <Text style={stili.h2}>Consumo annuale e produzione</Text>
            <View style={stili.chartFrame}>
              <Text style={stili.chartCaption}>
                Produzione {sim.flussi.produzione}
              </Text>
              <BarraStackedOrizzontale
                a={sim.flussiNum.autoconsumo}
                b={sim.flussiNum.exportRete}
                coloreA={P.verde}
                coloreB={P.teal}
                width={460}
              />
              <View style={{ marginTop: 8, marginBottom: 4 }}>
                <View style={stili.legendaRiga}>
                  <View style={[stili.legendaDot, { backgroundColor: P.verde }]} />
                  <Text style={stili.legendaTesto}>
                    Verso la casa {sim.flussi.autoconsumo} (
                    {pct(sim.flussiNum.autoconsumo, sim.flussiNum.produzione)})
                  </Text>
                </View>
                <View style={stili.legendaRiga}>
                  <View style={[stili.legendaDot, { backgroundColor: P.teal }]} />
                  <Text style={stili.legendaTesto}>
                    Alla rete {sim.flussi.exportRete} (
                    {pct(sim.flussiNum.exportRete, sim.flussiNum.produzione)})
                  </Text>
                </View>
              </View>
            </View>

            {sim.flussiNum.consumo > 0 ? (
              <View style={stili.chartFrame}>
                <Text style={stili.chartCaption}>
                  Consumo {sim.flussiNum.consumo.toLocaleString('it-IT')} kWh
                </Text>
                <BarraStackedOrizzontale
                  a={sim.flussiNum.autoconsumo}
                  b={sim.flussiNum.daRete}
                  coloreA={P.blu}
                  coloreB={P.arancio}
                  width={460}
                />
                <View style={{ marginTop: 8 }}>
                  <View style={stili.legendaRiga}>
                    <View style={[stili.legendaDot, { backgroundColor: P.blu }]} />
                    <Text style={stili.legendaTesto}>
                      Dal solare {sim.flussi.autoconsumo} (
                      {pct(sim.flussiNum.autoconsumo, sim.flussiNum.consumo)})
                    </Text>
                  </View>
                  <View style={stili.legendaRiga}>
                    <View
                      style={[stili.legendaDot, { backgroundColor: P.arancio }]}
                    />
                    <Text style={stili.legendaTesto}>
                      Dalla rete {sim.flussi.daRete} (
                      {pct(sim.flussiNum.daRete, sim.flussiNum.consumo)})
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            <Text style={stili.h2}>Configurazione moduli</Text>
            <View style={stili.tabella}>
              <View style={stili.thead}>
                <Text style={[stili.th, { flex: 2 }]}>Campo fotovoltaico</Text>
                <Text style={[stili.th, { width: 55, textAlign: 'right' }]}>
                  Moduli
                </Text>
                <Text style={[stili.th, { width: 70, textAlign: 'right' }]}>
                  Wp
                </Text>
                <Text style={[stili.th, { width: 80, textAlign: 'right' }]}>
                  Potenza
                </Text>
              </View>
              <View style={stili.riga} wrap={false}>
                <Text style={[stili.td, { flex: 2 }]}>
                  <Enfasi>Layout da studio tetto</Enfasi>
                  {det && det.falde.length > 0 ? (
                    <Text style={{ color: P.inchiostroMorbido }}>
                      {'\n'}
                      {det.falde
                        .map(
                          (f) =>
                            `${f.etichetta}: ${f.inclinazione}, ${f.esposizione}`,
                        )
                        .join(' · ')}
                    </Text>
                  ) : null}
                </Text>
                <Text style={[stili.td, { width: 55, textAlign: 'right' }]}>
                  {det?.moduli ?? '—'}
                </Text>
                <Text style={[stili.td, { width: 70, textAlign: 'right' }]}>
                  {det?.wattPicco ?? '—'}
                </Text>
                <Text
                  style={[
                    stili.td,
                    { width: 80, textAlign: 'right', fontWeight: 700 },
                  ]}
                >
                  {det?.potenzaKwp ?? '—'}
                </Text>
              </View>
            </View>

            <Text style={stili.h2}>Risparmi in bolletta — anno 1</Text>
            <View style={stili.kpiFinGriglia}>
              <View style={stili.kpiFinCella}>
                <Text style={stili.etichetta}>Bolletta mensile attuale</Text>
                <Text style={stili.valoreArancio}>
                  {eco.bollettaAttualeMensile}
                </Text>
              </View>
              <View style={stili.kpiFinCella}>
                <Text style={stili.etichetta}>Con impianto FV</Text>
                <Text style={stili.valoreGrande}>{eco.bollettaConFvMensile}</Text>
              </View>
              <View style={[stili.kpiFinCella, { borderRightWidth: 0 }]}>
                <Text style={stili.etichetta}>Risparmio mensile</Text>
                <Text style={stili.valoreVerde}>{eco.risparmioMensile}</Text>
              </View>
            </View>
            <Text style={[stili.paragrafo, { textAlign: 'center' }]}>
              Risparmi netti a vita stimati (NPV):{' '}
              <Text style={stili.valoreVerde}>{sim.npv}</Text>
            </Text>

            <FooterChiaro logoSrc={logoSrc} />
            <NumeroPagina />
          </Page>

          {/* D3 — Cashflow */}
          <Page size="A4" style={stili.pagina}>
            <HeaderEcoSolareDesign logoSrc={logoSrc} codice={dati.codice} />
            <BoxClienteDesign dati={dati} />

            <Text style={stili.h2}>Analisi flusso di cassa</Text>
            <View style={stili.chartFrame}>
              <Text style={stili.chartCaption}>
                Risparmio netto + detrazione (primi {sim.cashflow.length} anni)
              </Text>
              <BarreCashflow
                valoriCents={sim.cashflow.map((r) => r.flussoCents)}
              />
            </View>

            <View style={[stili.tabella, { marginTop: 12 }]}>
              <View style={stili.thead}>
                <Text style={[stili.th, { width: 40 }]}>Anno</Text>
                <Text style={[stili.th, { flex: 1, textAlign: 'right' }]}>
                  Risparmio
                </Text>
                <Text style={[stili.th, { flex: 1, textAlign: 'right' }]}>
                  Detrazione
                </Text>
                <Text style={[stili.th, { flex: 1, textAlign: 'right' }]}>
                  Flusso
                </Text>
              </View>
              {sim.cashflow.map((r) => (
                <View key={r.anno} style={stili.riga} wrap={false}>
                  <Text style={[stili.td, { width: 40 }]}>{r.anno}</Text>
                  <Text style={[stili.td, { flex: 1, textAlign: 'right' }]}>
                    {r.risparmio}
                  </Text>
                  <Text style={[stili.td, { flex: 1, textAlign: 'right' }]}>
                    {r.detrazione}
                  </Text>
                  <Text
                    style={[
                      stili.td,
                      { flex: 1, textAlign: 'right', fontWeight: 700 },
                    ]}
                  >
                    {r.flusso}
                  </Text>
                </View>
              ))}
            </View>
            <Text
              style={[
                stili.paragrafo,
                { fontSize: 8, color: P.inchiostroMorbido, marginTop: 10 },
              ]}
            >
              Simulazione EcoSolare Design calcolata sullo studio tetto del
              cliente. Non sostituisce un progetto esecutivo né una
              certificazione di producibilità. Orizzonte modello:{' '}
              {sim.orizzonteAnni} anni.
            </Text>

            <FooterChiaro logoSrc={logoSrc} />
            <NumeroPagina />
          </Page>

          {/* D4 — Energia mensile dedicata */}
          {sim.produzioneMensileKwh.length === 12 ? (
            <Page size="A4" style={stili.pagina}>
              <HeaderEcoSolareDesign logoSrc={logoSrc} codice={dati.codice} />
              <BoxClienteDesign dati={dati} />

              <Text style={stili.h2}>Energia mensile stimata</Text>
              <View style={stili.chartFrame}>
                <Text style={stili.chartCaption}>
                  Produzione mensile (kWh) — profilo annuale
                </Text>
                <BarreMensili
                  valori={sim.produzioneMensileKwh}
                  width={480}
                  height={220}
                />
                {det ? (
                  <Text
                    style={[stili.paragrafo, { marginTop: 10, marginBottom: 0 }]}
                  >
                    Produzione annua complessiva stimata:{' '}
                    <Enfasi>{det.produzioneKwh}</Enfasi>
                    {det.resaSpecifica ? (
                      <>
                        {' '}
                        · resa specifica <Enfasi>{det.resaSpecifica}</Enfasi>
                      </>
                    ) : null}
                    .
                  </Text>
                ) : null}
              </View>

              {dati.planimetria ? (
                <>
                  <Text style={stili.h2}>Layout moduli sul tetto</Text>
                  <VistaTettoConModuli
                    planimetria={dati.planimetria}
                    altezza={220}
                    mostraLegenda
                  />
                </>
              ) : null}

              <FooterChiaro logoSrc={logoSrc} />
              <NumeroPagina />
            </Page>
          ) : null}
        </>
      ) : null}
    </Document>
  )
}

function pct(parte: number, tot: number): string {
  if (!(tot > 0)) return '—'
  return `${Math.round((parte / tot) * 100)}%`
}

/** Grassetto sugli «N anni» tipici delle garanzie. */
function evidenziaAnni(testo: string): ReactNode {
  const parti = testo.split(/(\d+\s*anni)/gi)
  if (parti.length === 1) return testo
  return parti.map((p, i) =>
    /^\d+\s*anni$/i.test(p) ? (
      <Enfasi key={i}>{p}</Enfasi>
    ) : (
      <Text key={i}>{p}</Text>
    ),
  )
}
