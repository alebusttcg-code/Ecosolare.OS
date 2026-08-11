/* eslint-disable jsx-a11y/alt-text -- React-PDF Image non espone la prop HTML `alt`. */
import {
  Circle,
  Document,
  Image,
  Line,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { ECOSOLARE } from '@/lib/brand/ecosolare'
import {
  CorpoPaginaMarketing,
  IntestazionePaginaMarketing,
} from './pagine-marketing'
import { PAGINE_MARKETING } from './testi-marketing'
import type { DatiPdfPreventivo } from '@/lib/pdf/dati-preventivo'
import { TERMINI_PAGAMENTO } from '@/lib/pdf/dossier-testi'
import {
  FONT_CORPO,
  FONT_DISPLAY,
} from '@/lib/pdf/fonti-preventivo'
import {
  BarraStackedOrizzontale,
  BarreMensili,
} from '@/lib/pdf/grafici'
import {
  BloccoRisparmioTermico,
  PanoramicaFinanziaria,
  SchedaIndicatori,
} from '@/lib/pdf/blocchi-design'
import { GraficoCashflowCumulato } from '@/lib/pdf/grafici-cashflow'

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
  premiumPage: {
    fontFamily: FONT_CORPO,
    fontWeight: 400,
    fontSize: 9,
    color: '#071D3D',
    backgroundColor: '#FFFEFA',
    paddingTop: 27,
    paddingHorizontal: 34,
    paddingBottom: 62,
  },
  premiumHeader: {
    height: 76,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  premiumLogo: {
    width: 178,
    height: 68,
    objectFit: 'contain',
    objectPosition: 'left top',
  },
  premiumMeta: {
    width: 176,
    height: 67,
    borderLeftWidth: 0.8,
    borderLeftColor: '#8B96A8',
    paddingLeft: 20,
    paddingTop: 2,
  },
  premiumMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  premiumMetaIcon: {
    width: 26,
    height: 26,
    marginRight: 12,
  },
  premiumMetaLabel: {
    fontSize: 7.5,
    lineHeight: 1.25,
    color: '#40506A',
  },
  premiumMetaValue: {
    fontSize: 9.5,
    lineHeight: 1.25,
    color: '#071D3D',
    fontWeight: 600,
  },
  premiumRule: {
    height: 0.8,
    backgroundColor: '#7B879A',
  },
  premiumEyebrow: {
    marginTop: 28,
    fontSize: 8.5,
    fontWeight: 700,
    color: '#1F5FD6',
    letterSpacing: 2.1,
    textTransform: 'uppercase',
  },
  premiumTitle: {
    marginTop: 8,
    fontFamily: FONT_DISPLAY,
    fontSize: 42,
    lineHeight: 1.03,
    color: '#071D3D',
  },
  premiumGrid: {
    position: 'absolute',
    top: 111,
    right: 0,
    width: 145,
    height: 116,
  },
  premiumHero: {
    height: 250,
    marginTop: 19,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#EDF3FC',
  },
  premiumHeroImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  premiumHeroFallback: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  premiumHeroFallbackTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 25,
    color: '#071D3D',
    marginBottom: 7,
  },
  premiumHeroFallbackText: {
    fontSize: 8.5,
    color: '#657183',
    textAlign: 'center',
    lineHeight: 1.45,
  },
  premiumMetricRow: {
    height: 132,
    marginTop: 16,
    flexDirection: 'row',
    gap: 14,
  },
  premiumMetricCard: {
    flex: 1,
    borderWidth: 0.8,
    borderColor: '#DCDEDC',
    borderRadius: 7,
    paddingHorizontal: 16,
    paddingTop: 15,
    backgroundColor: '#FFFEFA',
  },
  premiumMetricIcon: {
    width: 25,
    height: 25,
    marginBottom: 10,
  },
  premiumMetricLabel: {
    fontSize: 9.5,
    fontWeight: 600,
    color: '#172033',
    marginBottom: 4,
  },
  premiumMetricUnderline: {
    width: 25,
    height: 1.4,
    backgroundColor: '#1F5FD6',
    marginBottom: 8,
  },
  premiumMetricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  premiumMetricValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 33,
    lineHeight: 1,
    color: '#EFB600',
  },
  premiumMetricUnit: {
    fontFamily: FONT_CORPO,
    fontWeight: 600,
    fontSize: 10.5,
    color: '#071D3D',
    marginLeft: 5,
  },
  premiumSummary: {
    height: 112,
    marginTop: 16,
    borderWidth: 0.8,
    borderColor: '#C7CBD0',
    borderRadius: 7,
    backgroundColor: '#FFFEFA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  premiumSummaryHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumSummaryDivider: {
    width: 0.8,
    height: 77,
    backgroundColor: '#C7CBD0',
    marginHorizontal: 28,
  },
  premiumSummaryIcon: {
    width: 53,
    height: 53,
    marginRight: 18,
  },
  premiumSummaryLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    color: '#172033',
    marginBottom: 4,
  },
  premiumSummaryAccentGreen: {
    width: 24,
    height: 1.4,
    backgroundColor: '#4E9D6D',
    marginBottom: 7,
  },
  premiumSummaryAccentBlue: {
    width: 24,
    height: 1.4,
    backgroundColor: '#1F5FD6',
    marginBottom: 7,
  },
  premiumSummaryValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 31,
    lineHeight: 1,
    color: '#EFB600',
  },
  premiumSummaryUnit: {
    fontFamily: FONT_CORPO,
    fontWeight: 600,
    fontSize: 10.5,
    color: '#071D3D',
    marginLeft: 5,
  },
  premiumFooter: {
    position: 'absolute',
    left: 34,
    right: 34,
    bottom: 16,
    height: 38,
    borderTopWidth: 0.8,
    borderTopColor: '#071D3D',
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumFooterDots: {
    width: 24,
    height: 24,
    marginRight: 13,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  premiumFooterDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#1F5FD6',
    marginRight: 4,
    marginBottom: 4,
  },
  premiumFooterText: {
    fontSize: 7.5,
    color: '#40506A',
  },
  premiumFooterLine: {
    marginLeft: 'auto',
    width: 72,
    height: 1,
    backgroundColor: '#1F5FD6',
  },
  premiumFooterNumber: {
    width: 25,
    marginLeft: 14,
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    color: '#1F5FD6',
    textAlign: 'right',
  },
  premiumBottomBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 7,
    flexDirection: 'row',
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
 * Stile “EcoSolare Design”: falda verde (come SolarEdge Designer) + moduli blu.
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
  const haOverlay =
    planimetria.moduliPaths.length > 0 || planimetria.poligoniPaths.length > 0
  const vb = planimetria.viewBox || '0 0 640 640'
  // Coordinate tipiche ortofoto scale=2 (1280×1280): stroke in unità viewBox.
  const strokeFalda = haFoto ? 4 : 1.5
  const strokeModulo = haFoto ? 2.2 : 0.6
  const overlay = haOverlay ? (
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
          stroke="#e8c765"
          strokeWidth={strokeFalda}
          fill={haFoto ? 'rgba(34, 110, 55, 0.48)' : 'rgba(63,127,196,0.14)'}
        />
      ))}
      {planimetria.moduliPaths.map((d, i) => (
        <Path
          key={`m-${i}`}
          d={d}
          fill="#2f6fad"
          stroke="#9ec5ea"
          strokeWidth={strokeModulo}
          fillOpacity={0.9}
        />
      ))}
    </Svg>
  ) : null

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
        <Image
          src={logoSrc}
          style={{ width: 88, height: 26, objectFit: 'contain' }}
        />
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
      // Il totale finale dipende dalle schede tecniche accodate dopo il render
      // React PDF. Mostrare solo il progressivo mantiene la numerazione corretta
      // anche quando il dossier viene completato con allegati di prodotto.
      render={({ pageNumber }) => String(pageNumber).padStart(2, '0')}
      fixed
    />
  )
}

function PlanimetriaHero({ dati }: { dati: DatiPdfPreventivo }) {
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
            <Text style={stili.kpiValore}>{kpi.moduli}/{kpi.moduli}</Text>
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

type IconaCopertina =
  | 'potenza'
  | 'produzione'
  | 'autonomia'
  | 'co2'
  | 'investimento'

function IconaPremium({ tipo }: { tipo: IconaCopertina }) {
  if (tipo === 'potenza') {
    return (
      <Svg viewBox="0 0 32 32" style={stili.premiumMetricIcon}>
        {[5, 13, 21].flatMap((x) =>
          [5, 13, 21].map((y) => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="#1F5FD6" />
          )),
        )}
        <Path d="M4 27 H25 M8 25 V29 M21 25 V29" stroke="#1F5FD6" strokeWidth="1.8" fill="none" />
      </Svg>
    )
  }
  if (tipo === 'produzione') {
    return (
      <Svg viewBox="0 0 32 32" style={stili.premiumMetricIcon}>
        <Path d="M6 10 H25 L28 23 H3 Z M9 14 H24 M7 18 H26 M14 10 L12 23 M21 10 L23 23 M15.5 23 V28 M10 28 H21" stroke="#1F5FD6" strokeWidth="1.7" fill="none" />
      </Svg>
    )
  }
  if (tipo === 'autonomia') {
    return (
      <Svg viewBox="0 0 32 32" style={stili.premiumMetricIcon}>
        <Circle cx="16" cy="16" r="11" stroke="#1F5FD6" strokeWidth="2.3" fill="none" />
        <Path d="M16 5 A11 11 0 0 1 26 19" stroke="#EFB600" strokeWidth="2.3" fill="none" />
      </Svg>
    )
  }
  if (tipo === 'co2') {
    return (
      <Svg viewBox="0 0 64 64" style={stili.premiumSummaryIcon}>
        <Circle cx="32" cy="32" r="27" stroke="#4E9D6D" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
        <Path d="M20 37 C19 23 31 17 46 19 C45 34 37 44 25 43 C22 42 20 40 20 37 Z M24 42 C29 34 35 29 42 24" stroke="#4E9D6D" strokeWidth="2" fill="none" />
      </Svg>
    )
  }
  return (
    <Svg viewBox="0 0 64 64" style={stili.premiumSummaryIcon}>
      <Path d="M14 25 H49 C53 25 56 28 56 32 V47 C56 51 53 54 49 54 H14 C10 54 8 51 8 47 V31 C8 27 10 25 14 25 Z M15 24 L37 9 C40 7 44 8 46 12 L52 24 M42 34 H57 V45 H42 C38 45 36 42 36 39 C36 36 38 34 42 34 Z" stroke="#1F5FD6" strokeWidth="2.2" fill="none" />
        <Circle cx="43" cy="39.5" r="1.8" fill="#1F5FD6" />
    </Svg>
  )
}

function IconaMeta({ tipo }: { tipo: 'documento' | 'data' }) {
  return (
    <Svg viewBox="0 0 28 28" style={stili.premiumMetaIcon}>
      {tipo === 'documento' ? (
        <>
          <Path d="M6 3 H18 L23 8 V25 H6 Z M18 3 V8 H23" stroke="#657183" strokeWidth="1.2" fill="none" />
        </>
      ) : (
        <>
          <Rect x="5" y="6" width="18" height="18" stroke="#657183" strokeWidth="1.2" fill="none" />
          <Line x1="5" y1="11" x2="23" y2="11" stroke="#657183" strokeWidth="1.2" />
          <Line x1="9" y1="3" x2="9" y2="8" stroke="#657183" strokeWidth="1.2" />
          <Line x1="19" y1="3" x2="19" y2="8" stroke="#657183" strokeWidth="1.2" />
          {[9, 14, 19].flatMap((x) =>
            [15, 20].map((y) => (
              <Circle key={`${x}-${y}`} cx={x} cy={y} r="0.8" fill="#657183" />
            )),
          )}
        </>
      )}
    </Svg>
  )
}

function GrigliaPremium() {
  return (
    <Svg viewBox="0 0 145 116" style={stili.premiumGrid}>
      {[0, 43, 86, 129].map((x) => (
        <Line key={`v-${x}`} x1={x} y1="0" x2={x} y2="116" stroke="#C8D9F4" strokeWidth="0.8" />
      ))}
      {[0, 43, 86].map((y) => (
        <Line key={`h-${y}`} x1="0" y1={y} x2="145" y2={y} stroke="#C8D9F4" strokeWidth="0.8" />
      ))}
      {[43, 86, 129].flatMap((x) =>
        [43, 86].map((y) => (
          <Path key={`${x}-${y}`} d={`M${x} ${y - 3} L${x + 3} ${y} L${x} ${y + 3} L${x - 3} ${y} Z`} fill="#FFFEFA" stroke="#7AA3E8" strokeWidth="0.8" />
        )),
      )}
    </Svg>
  )
}

function numeroItaliano(valore: number, decimali = 0): string {
  return valore.toLocaleString('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  })
}

function interoItaliano(valore: number): string {
  return Math.round(valore)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function senzaCentesimi(valore: string): string {
  return valore.replace(/,00(?=\s*$)/, '')
}

function CopertinaPremium({
  dati,
  logoSrc,
}: {
  readonly dati: DatiPdfPreventivo
  readonly logoSrc: string
}) {
  const dettaglio = dati.dettagliImpianto
  const simulazione = dati.simulazione
  const autonomia = simulazione && simulazione.flussiNum.consumo > 0
    ? Math.round(
        (simulazione.flussiNum.autoconsumo / simulazione.flussiNum.consumo) * 100,
      )
    : null
  const co2 = simulazione?.indicatori.find((indicatore) => indicatore.icona === 'co2')
  const investimento = dati.condizioniEconomiche?.totaleLordo ?? dati.totaleLordo

  const metriche = [
    {
      tipo: 'potenza' as const,
      etichetta: 'Potenza impianto',
      valore: dettaglio ? numeroItaliano(dettaglio.kWpNumero, 1) : '—',
      unita: 'kWp',
    },
    {
      tipo: 'produzione' as const,
      etichetta: 'Produzione annua stimata',
      valore: dettaglio
        ? interoItaliano(dettaglio.produzioneKwhNumero)
        : '—',
      unita: 'kWh',
    },
    {
      tipo: 'autonomia' as const,
      etichetta: 'Autonomia energetica',
      valore: autonomia != null ? numeroItaliano(autonomia) : '—',
      unita: '%',
    },
  ]

  return (
    <Page size="A4" style={stili.premiumPage}>
      <View style={stili.premiumHeader}>
        <Image src={logoSrc} style={stili.premiumLogo} />
        <View style={stili.premiumMeta}>
          <View style={stili.premiumMetaRow}>
            <IconaMeta tipo="documento" />
            <View>
              <Text style={stili.premiumMetaLabel}>Proposta n.</Text>
              <Text style={stili.premiumMetaValue}>{dati.codice}</Text>
            </View>
          </View>
          <View style={stili.premiumMetaRow}>
            <IconaMeta tipo="data" />
            <View>
              <Text style={stili.premiumMetaLabel}>Data</Text>
              <Text style={stili.premiumMetaValue}>{dati.dataDocumento}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={stili.premiumRule} />
      <GrigliaPremium />

      <Text style={stili.premiumEyebrow}>Proposta energetica su misura</Text>
      <Text style={stili.premiumTitle}>Il progetto in sintesi</Text>

      <View style={stili.premiumHero}>
        {dati.planimetria?.fotoDataUri ? (
          <Image src={dati.planimetria.fotoDataUri} style={stili.premiumHeroImage} />
        ) : (
          <View style={stili.premiumHeroFallback}>
            <Text style={stili.premiumHeroFallbackTitle}>Il tuo tetto, valorizzato.</Text>
            <Text style={stili.premiumHeroFallbackText}>
              L’immagine del layout sarà inserita automaticamente dopo il salvataggio dello studio moduli.
            </Text>
          </View>
        )}
      </View>

      <View style={stili.premiumMetricRow}>
        {metriche.map((metrica) => (
          <View key={metrica.tipo} style={stili.premiumMetricCard}>
            <IconaPremium tipo={metrica.tipo} />
            <Text style={stili.premiumMetricLabel}>{metrica.etichetta}</Text>
            <View style={stili.premiumMetricUnderline} />
            <View style={stili.premiumMetricValueRow}>
              <Text style={stili.premiumMetricValue}>{metrica.valore}</Text>
              <Text style={stili.premiumMetricUnit}>{metrica.unita}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={stili.premiumSummary}>
        <View style={stili.premiumSummaryHalf}>
          <IconaPremium tipo="co2" />
          <View>
            <Text style={stili.premiumSummaryLabel}>Riduzione CO₂</Text>
            <View style={stili.premiumSummaryAccentGreen} />
            <View style={stili.premiumMetricValueRow}>
              <Text style={stili.premiumSummaryValue}>{co2?.valore ?? '—'}</Text>
              <Text style={stili.premiumSummaryUnit}>{co2?.unita ?? 't/anno'}</Text>
            </View>
          </View>
        </View>
        <View style={stili.premiumSummaryDivider} />
        <View style={stili.premiumSummaryHalf}>
          <IconaPremium tipo="investimento" />
          <View>
            <Text style={stili.premiumSummaryLabel}>Investimento</Text>
            <View style={stili.premiumSummaryAccentBlue} />
            <Text style={stili.premiumSummaryValue}>{senzaCentesimi(investimento)}</Text>
          </View>
        </View>
      </View>

      <View style={stili.premiumFooter} fixed>
        <View style={stili.premiumFooterDots}>
          {Array.from({ length: 16 }, (_, indice) => (
            <View key={indice} style={stili.premiumFooterDot} />
          ))}
        </View>
        <Text style={stili.premiumFooterText}>EcoSolare • Con te verso il futuro</Text>
        <View style={stili.premiumFooterLine} />
        <Text style={stili.premiumFooterNumber}>01</Text>
      </View>
      <View style={stili.premiumBottomBand} fixed>
        <View style={{ flex: 5, backgroundColor: '#071D3D' }} />
        <View style={{ flex: 1.1, backgroundColor: '#1F5FD6' }} />
        <View style={{ flex: 0.7, backgroundColor: '#F4C500' }} />
      </View>
    </Page>
  )
}

/** Documento di una pagina per la visual QA della copertina prima del rollout. */
export function DocumentoAnteprimaCopertinaPremium({
  dati,
  logoSrc,
}: {
  readonly dati: DatiPdfPreventivo
  readonly logoSrc: string
}) {
  return (
    <Document
      title={`Anteprima copertina ${dati.codice}`}
      author={ECOSOLARE.nome}
      subject="Golden master copertina preventivo"
    >
      <CopertinaPremium dati={dati} logoSrc={logoSrc} />
    </Document>
  )
}

export function DocumentoPreventivo({
  dati,
  logoSrc,
  immaginiMarketing = [],
  copertinaPremium = false,
}: {
  readonly dati: DatiPdfPreventivo
  readonly logoSrc: string
  /** Data-URI per ogni pagina marketing, nell'ordine di `PAGINE_MARKETING`. */
  readonly immaginiMarketing?: readonly (readonly string[])[]
  /** Feature flag: il generatore storico resta disponibile fino all'approvazione. */
  readonly copertinaPremium?: boolean
}) {
  const det = dati.dettagliImpianto
  const eco = dati.condizioniEconomiche
  const sim = dati.simulazione
  const cashflowHaTermico =
    sim?.cashflow.some((riga) => riga.risparmioTermico != null) ?? false
  const cashflowHaContoTermico =
    sim?.cashflow.some((riga) => riga.contoTermico != null) ?? false

  return (
    <Document
      title={`Preventivo ${dati.codice}`}
      author={ECOSOLARE.nome}
      subject={dati.titolo}
    >
      {/* ——— 01 Copertina ——— */}
      {copertinaPremium ? (
        <CopertinaPremium dati={dati} logoSrc={logoSrc} />
      ) : (
        <Page size="A4" style={stili.pagina}>
          <HeaderLogo logoSrc={logoSrc} />
          <View style={stili.letterhead}>
            <View style={stili.letterCol}>
              <Text style={stili.letterLabel}>Da:</Text>
              <Text style={stili.letterNome}>{ECOSOLARE.nome}</Text>
              <Text style={stili.letterMeta}>
                {dati.mittente.nome}
                {dati.mittente.ruolo ? `\n${dati.mittente.ruolo}` : ''}
                {dati.mittente.telefono ? `\n${dati.mittente.telefono}` : ''}
                {dati.mittente.email ? `\n${dati.mittente.email}` : `\n${ECOSOLARE.email}`}
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
      )}

      {/* ——— 02 Dettagli + producibilità + grafico ——— */}
      <Page size="A4" style={stili.pagina}>
        <HeaderLogo logoSrc={logoSrc} />
        <TitoloH1>1. Dettagli impianto</TitoloH1>
        <Text style={stili.h2}>Componenti essenziali dell’offerta</Text>
        {det ? (
          <Text style={stili.paragrafo}>
            L’impianto proposto avrà una potenza complessiva di{' '}
            <Enfasi> {det.potenzaKwp}</Enfasi> e sarà composto da
            <Enfasi>
               n. {det.moduli} pannelli
              {det.wattPicco != null ? ` da ${det.wattPicco} Wp` : ''}
            </Enfasi>
            {det.resaSpecifica ? (
              <>
                {' '}
                (resa specifica stimata <Enfasi> {det.resaSpecifica}</Enfasi>)
              </>
            ) : null}
            . Produzione annua stimata:
            <Enfasi> {det.produzioneKwh}</Enfasi>
            {det.consumoKwh ? (
              <>
                {' '}
                a fronte di un consumo di <Enfasi> {det.consumoKwh}</Enfasi>
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
                • {f.etichetta}: inclinazione <Enfasi> {f.inclinazione}</Enfasi>
                {' · '}esposizione <Enfasi> {f.esposizione}</Enfasi>
                {f.area ? (
                  <>
                    {' · '}area <Enfasi> {f.area}</Enfasi>
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
              <Enfasi>Agevolazioni incluse nel piano:</Enfasi>{' '}
              {det.detrazioneSintesi}
            </Text>
          </>
        ) : null}

        <FooterChiaro logoSrc={logoSrc} />
        <NumeroPagina />
      </Page>

      {/* ——— 03 Caratteristiche + attività incluse ——— */}
      <Page size="A4" style={stili.pagina}>
        <HeaderLogo logoSrc={logoSrc} />
        <TitoloH1>2. Caratteristiche</TitoloH1>

        {dati.configurazioneTecnica.map((sezione) => (
          <View key={sezione.titolo} style={{ marginBottom: 8 }} wrap={false}>
            <Text style={stili.h2}>{sezione.titolo}</Text>
            {sezione.voci.map((voce) => (
              <Text key={voce} style={stili.bullet}>
                • {voce}
              </Text>
            ))}
          </View>
        ))}

        <Text style={stili.h2}>Attività incluse nell’offerta</Text>
        {dati.dossierTestuale.incluso.map((voce) => (
          <Text key={voce} style={stili.bullet}>
            • {voce}
          </Text>
        ))}

        <FooterChiaro logoSrc={logoSrc} />
        <NumeroPagina />
      </Page>

      {/* ——— 04 Esclusioni e garanzie ——— */}
      <Page size="A4" style={stili.pagina}>
        <HeaderLogo logoSrc={logoSrc} />
        <TitoloH1>Esclusioni e garanzie</TitoloH1>

        <Text style={stili.h2}>Esclusioni</Text>
        {dati.dossierTestuale.escluso.map((voce) => (
          <Text key={voce} style={stili.bullet}>
            • {voce}
          </Text>
        ))}

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

      {/* ——— 05–08 Pagine istituzionali fisse ——— */}
      {PAGINE_MARKETING.map((pagina, i) => (
        <Page key={`mkt-${pagina.numero}`} size="A4" style={stili.pagina}>
          <HeaderLogo logoSrc={logoSrc} />
          <IntestazionePaginaMarketing pagina={pagina} />
          <CorpoPaginaMarketing
            pagina={pagina}
            immaginiSrc={immaginiMarketing[i] ?? []}
          />
          <FooterChiaro logoSrc={logoSrc} />
          <NumeroPagina />
        </Page>
      ))}

      {/* ——— 09 Preventivo di spesa ——— */}
      <Page size="A4" style={stili.pagina}>
        <HeaderLogo logoSrc={logoSrc} />
        <TitoloH1>Preventivo di spesa</TitoloH1>

        <Text style={stili.h2}>Dettaglio economico della fornitura</Text>
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

        <Text style={stili.h2}>Investimento e agevolazioni</Text>
        {eco ? (
          <>
            <Text style={stili.paragrafo}>
              Si propone la fornitura descritta al prezzo complessivo di:{' '}
              <Enfasi> {eco.totaleLordo} IVA inclusa</Enfasi>
            </Text>
            {eco.detrazioneImporto ? (
              <Text style={stili.paragrafo}>
                {eco.detrazioneEtichetta}:{' '}
                <Enfasi> {eco.detrazioneImporto}</Enfasi>
              </Text>
            ) : null}
            {eco.contoTermicoImporto ? (
              <Text style={stili.paragrafo}>
                Conto Termico 3.0 sul blocco termico:{' '}
                <Enfasi> {eco.contoTermicoImporto}</Enfasi>
              </Text>
            ) : null}
            <Text style={stili.paragrafo}>
              Costo effettivo stimato dopo le agevolazioni selezionate:{' '}
              <Enfasi> {eco.nettoIndicativo}</Enfasi>
            </Text>
          </>
        ) : (
          <Text style={stili.paragrafo}>
            Totale proposta: <Enfasi> {dati.totaleLordo}</Enfasi>
          </Text>
        )}

        {dati.bloccoTermico ? (
          <>
            <Text style={stili.h2}>
              Centrale termica — {dati.bloccoTermico.tipoEtichetta}
            </Text>
            <Text style={stili.paragrafo}>
              Prezzo: <Enfasi> {dati.bloccoTermico.prezzoLordo} IVA inclusa</Enfasi>
              {dati.bloccoTermico.incentivoImporto ? (
                <>
                  {' · '}{dati.bloccoTermico.incentivoEtichetta}:{' '}
                  <Enfasi> {dati.bloccoTermico.incentivoImporto}</Enfasi>
                </>
              ) : null}
            </Text>
            <Text
              style={[
                stili.paragrafo,
                { fontSize: 8, color: P.inchiostroMorbido },
              ]}
            >
              {dati.bloccoTermico.notaIncentivo}
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
          Offerta valida <Enfasi> {TERMINI_PAGAMENTO.validitaGiorniLavorativi} giorni lavorativi</Enfasi>
          {dati.validita ? (
            <>
              {' '}
              (scadenza indicata: <Enfasi> {dati.validita}</Enfasi>)
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

      {/* ——— 10–14 Report dinamici EcoSolare Design ——— */}
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
                altezza={185}
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

            <PanoramicaFinanziaria kpi={sim.kpiFinanziari} />
            <SchedaIndicatori indicatori={sim.indicatori} />
            <Text
              style={[
                stili.paragrafo,
                { fontSize: 8, color: P.inchiostroMorbido, marginBottom: 0 },
              ]}
            >
              {sim.tariffe}
            </Text>

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
                <Text style={stili.etichetta}>Risparmio elettrico mensile</Text>
                <Text style={stili.valoreVerde}>{eco.risparmioMensile}</Text>
              </View>
            </View>
            {eco.creditoMensile ? (
              <Text style={[stili.paragrafo, { textAlign: 'center' }]}>
                L’energia ceduta eccedente genera un accredito GSE stimato di{' '}
                <Enfasi> {eco.creditoMensile} al mese</Enfasi>, separato dalla bolletta.
              </Text>
            ) : null}
            <Text style={[stili.paragrafo, { textAlign: 'center' }]}>
              Valore attuale netto stimato (VAN):{' '}
              <Text style={stili.valoreVerde}>{sim.npv}</Text>
            </Text>

            <FooterChiaro logoSrc={logoSrc} />
            <NumeroPagina />
          </Page>

          {/* D3 — Analisi finanziaria, sempre presente come nel master */}
          <Page size="A4" style={stili.pagina}>
            <HeaderEcoSolareDesign logoSrc={logoSrc} codice={dati.codice} />
            <BoxClienteDesign dati={dati} />

            <Text style={stili.h2}>Analisi finanziaria dettagliata</Text>
            <PanoramicaFinanziaria kpi={sim.kpiFinanziari} />

            <View style={stili.rigaDue}>
              <View style={[stili.box, stili.col]}>
                <Text style={stili.etichetta}>Investimento complessivo</Text>
                <Text style={stili.valoreArancio}>{eco.totaleLordo}</Text>
                <Text style={[stili.paragrafo, { fontSize: 8, marginTop: 7 }]}>
                  IVA inclusa, prima delle agevolazioni selezionate.
                </Text>
              </View>
              <View style={[stili.box, stili.col]}>
                <Text style={stili.etichetta}>Beneficio stimato anno 1</Text>
                <Text style={stili.valoreVerde}>{eco.risparmioAnnuo}</Text>
                <Text style={[stili.paragrafo, { fontSize: 8, marginTop: 7 }]}>
                  Risparmio energetico e valorizzazione dell’energia ceduta.
                </Text>
              </View>
            </View>

            {sim.termico ? (
              <BloccoRisparmioTermico termico={sim.termico} />
            ) : (
              <View style={stili.box}>
                <Text style={stili.h2}>Perché il risultato è sostenibile</Text>
                <Text style={stili.bullet}>
                  • Produzione, autoconsumo e immissione in rete provengono dallo
                  studio energetico associato al preventivo.
                </Text>
                <Text style={stili.bullet}>
                  • Tariffe, inflazione, degrado e orizzonte temporale sono
                  applicati dal motore di simulazione, non scritti nel template.
                </Text>
                <Text style={stili.bullet}>
                  • Il risultato economico viene ricalcolato quando cambiano
                  configurazione, prezzo o dati del cliente.
                </Text>
              </View>
            )}

            <Text style={[stili.paragrafo, { fontSize: 8, color: P.inchiostroMorbido }]}>
              {sim.tariffe}
            </Text>
            <FooterChiaro logoSrc={logoSrc} />
            <NumeroPagina />
          </Page>

          {/* D4 — Cashflow */}
          <Page size="A4" style={stili.pagina}>
            <HeaderEcoSolareDesign logoSrc={logoSrc} codice={dati.codice} />
            <BoxClienteDesign dati={dati} />

            <Text style={stili.h2}>Analisi flusso di cassa</Text>
            <View style={stili.chartFrame}>
              <Text style={stili.chartCaption}>
                Capitale ancora da recuperare e valore cumulato generato
              </Text>
              <GraficoCashflowCumulato
                punti={sim.cumulato}
                larghezza={470}
                altezza={175}
              />
            </View>

            <View style={[stili.tabella, { marginTop: 8 }]}>
              <View style={stili.thead}>
                <Text style={[stili.th, { width: 34 }]}>Anno</Text>
                <Text style={[stili.th, { flex: 1, textAlign: 'right' }]}>
                  Risparmio FV
                </Text>
                {cashflowHaTermico ? (
                  <Text style={[stili.th, { flex: 1, textAlign: 'right' }]}>Termico</Text>
                ) : null}
                <Text style={[stili.th, { flex: 1, textAlign: 'right' }]}>Detrazioni</Text>
                {cashflowHaContoTermico ? (
                  <Text style={[stili.th, { flex: 1, textAlign: 'right' }]}>Conto term.</Text>
                ) : null}
                <Text style={[stili.th, { flex: 1, textAlign: 'right' }]}>
                  Flusso
                </Text>
              </View>
              {sim.cashflow.map((r) => (
                <View key={r.anno} style={stili.riga} wrap={false}>
                  <Text style={[stili.td, { width: 34 }]}>{r.anno}</Text>
                  <Text style={[stili.td, { flex: 1, textAlign: 'right' }]}>
                    {r.risparmio}
                  </Text>
                  {cashflowHaTermico ? (
                    <Text style={[stili.td, { flex: 1, textAlign: 'right' }]}>
                      {r.risparmioTermico ?? '—'}
                    </Text>
                  ) : null}
                  <Text style={[stili.td, { flex: 1, textAlign: 'right' }]}>
                    {r.detrazione}
                  </Text>
                  {cashflowHaContoTermico ? (
                    <Text style={[stili.td, { flex: 1, textAlign: 'right' }]}>
                      {r.contoTermico ?? '—'}
                    </Text>
                  ) : null}
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
              certificazione di producibilità. Orizzonte modello: {sim.orizzonteAnni} anni.
            </Text>

            <FooterChiaro logoSrc={logoSrc} />
            <NumeroPagina />
          </Page>

          {/* D5 — Energia mensile dedicata */}
          <Page size="A4" style={stili.pagina}>
              <HeaderEcoSolareDesign logoSrc={logoSrc} codice={dati.codice} />
              <BoxClienteDesign dati={dati} />

              <Text style={stili.h2}>Energia mensile stimata</Text>
              <View style={stili.chartFrame}>
                <Text style={stili.chartCaption}>
                  Produzione mensile (kWh) — profilo annuale
                </Text>
                {sim.produzioneMensileKwh.length === 12 ? (
                  <BarreMensili
                    valori={sim.produzioneMensileKwh}
                    width={480}
                    height={220}
                  />
                ) : (
                  <View style={stili.box}>
                    <Text style={stili.paragrafo}>
                      Profilo mensile non disponibile: completare la simulazione
                      energetica prima dell’invio al cliente.
                    </Text>
                  </View>
                )}
                {det ? (
                  <Text
                    style={[stili.paragrafo, { marginTop: 10, marginBottom: 0 }]}
                  >
                    Produzione annua complessiva stimata:
                    <Enfasi> {det.produzioneKwh}</Enfasi>
                    {det.resaSpecifica ? (
                      <>
                        {' '}
                        · resa specifica <Enfasi> {det.resaSpecifica}</Enfasi>
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
