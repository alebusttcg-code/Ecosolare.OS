import { StyleSheet, Text, View } from '@react-pdf/renderer'
import {
  COLORE,
  INTERLINEA,
  PESO,
  RAGGIO,
  SPAZIO,
  TESTO,
  TRACKING,
} from './design'
import { Icona, type NomeIcona } from './icone'
import type {
  IndicatorePdf,
  KpiFinanziarioPdf,
  TermicoPdf,
} from './dati-preventivo'

/**
 * I blocchi delle pagine EcoSolare Design.
 *
 * Sono la parte che il commerciale mostra per prima dopo la copertina, e
 * l'unica in cui il preventivo somiglia a uno strumento di progettazione
 * invece che a un documento di vendita. La differenza la fanno due cose: la
 * densità — dieci numeri con un pittogramma ciascuno, non tre in fila — e il
 * fatto che ogni cifra sia calcolata sul caso.
 */

const s = StyleSheet.create({
  titoloSezione: {
    fontSize: TESTO.sezione,
    fontWeight: PESO.forte,
    color: COLORE.bluScuro,
    letterSpacing: TRACKING.maiuscolo,
    marginBottom: SPAZIO.gruppo,
  },

  /* Scheda tecnica: griglia di indicatori con icona. */
  cornice: {
    borderWidth: 0.7,
    borderColor: COLORE.linea,
    borderRadius: RAGGIO.grande,
    paddingHorizontal: SPAZIO.blocco,
    paddingVertical: SPAZIO.elemento,
    marginBottom: SPAZIO.sezione,
  },
  griglia: { flexDirection: 'row', flexWrap: 'wrap' },
  cella: { width: '20%', paddingVertical: SPAZIO.gruppo, paddingRight: SPAZIO.elemento },
  etichetta: {
    fontSize: TESTO.nota,
    color: COLORE.inchiostroMorbido,
    marginTop: SPAZIO.minimo,
    lineHeight: INTERLINEA.stretta,
  },
  valore: {
    fontSize: TESTO.kpi,
    fontWeight: PESO.forte,
    letterSpacing: TRACKING.cifra,
    marginTop: SPAZIO.filo,
  },
  unita: {
    fontSize: TESTO.minuto,
    fontWeight: PESO.normale,
    color: COLORE.inchiostroMorbido,
  },

  /* KPI finanziari: tessere affiancate. */
  rigaKpi: { flexDirection: 'row', gap: SPAZIO.elemento, marginBottom: SPAZIO.sezione },
  tesseraKpi: {
    flex: 1,
    backgroundColor: COLORE.cartaSoft,
    borderRadius: RAGGIO.normale,
    paddingHorizontal: SPAZIO.gruppo,
    paddingVertical: SPAZIO.gruppo,
  },
  etichettaKpi: {
    fontSize: TESTO.nota,
    color: COLORE.inchiostroMorbido,
    letterSpacing: TRACKING.maiuscolo,
    lineHeight: INTERLINEA.stretta,
  },
  valoreKpi: {
    fontSize: TESTO.kpi,
    fontWeight: PESO.forte,
    marginTop: SPAZIO.minimo,
    letterSpacing: TRACKING.cifra,
  },

  /* Termico: due colonne, dare e avere. */
  rigaTermico: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPAZIO.elemento,
    borderBottomWidth: 0.7,
    borderBottomColor: COLORE.linea,
  },
  voceTermico: { fontSize: TESTO.corpo, color: COLORE.inchiostroMedio },
  importoTermico: { fontSize: TESTO.corpo, fontWeight: PESO.medio },
  totaleTermico: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: SPAZIO.gruppo,
  },
  nota: {
    fontSize: TESTO.nota,
    color: COLORE.inchiostroMorbido,
    lineHeight: INTERLINEA.normale,
    marginTop: SPAZIO.gruppo,
  },
})

function toneColore(tono: KpiFinanziarioPdf['tono']): string {
  if (tono === 'beneficio') return COLORE.verde
  if (tono === 'costo') return COLORE.arancio
  return COLORE.inchiostro
}

/**
 * La scheda tecnica dell'impianto.
 *
 * Cinque per riga: con quattro le celle diventano larghe e vuote, con sei le
 * etichette lunghe vanno a capo tre volte.
 */
export function SchedaIndicatori({
  indicatori,
}: {
  indicatori: readonly IndicatorePdf[]
}) {
  if (indicatori.length === 0) return null

  return (
    <View>
      <Text style={s.titoloSezione}>RISULTATI DELLA SIMULAZIONE</Text>
      <View style={s.cornice}>
        <View style={s.griglia}>
          {indicatori.map((i) => (
            <View key={i.etichetta} style={s.cella}>
              <Icona nome={i.icona as NomeIcona} dimensione={17} colore={COLORE.blu} />
              <Text style={s.etichetta}>{i.etichetta}</Text>
              <Text style={s.valore}>
                {i.valore}
                {i.unita ? <Text style={s.unita}> {i.unita}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

export function PanoramicaFinanziaria({
  kpi,
}: {
  kpi: readonly KpiFinanziarioPdf[]
}) {
  if (kpi.length === 0) return null

  return (
    <View>
      <Text style={s.titoloSezione}>PANORAMICA FINANZIARIA</Text>
      <View style={s.rigaKpi}>
        {kpi.map((k) => (
          <View key={k.etichetta} style={s.tesseraKpi}>
            <Text style={s.etichettaKpi}>{k.etichetta.toUpperCase()}</Text>
            <Text style={[s.valoreKpi, { color: toneColore(k.tono) }]}>{k.valore}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

/**
 * Il risparmio sul riscaldamento, quando c'è una pompa di calore.
 *
 * Mostrato come una sottrazione e non come un numero solo: il cliente deve
 * vedere che il gas che smette di comprare è più dell'elettricità che comincia
 * a consumare. Un «risparmi 529 € l'anno» senza le due voci sopra è un numero
 * che non si può controllare, e su una spesa da ventimila euro non basta.
 */
export function BloccoRisparmioTermico({ termico }: { termico: TermicoPdf }) {
  return (
    <View>
      <Text style={s.titoloSezione}>RISCALDAMENTO — POMPA DI CALORE</Text>
      <View style={s.cornice}>
        <View style={s.rigaTermico}>
          <Text style={s.voceTermico}>
            Gas che non comprerai più · {termico.gasEvitatoSmc}
          </Text>
          <Text style={[s.importoTermico, { color: COLORE.verde }]}>
            + {termico.costoGasEvitato}
          </Text>
        </View>
        <View style={s.rigaTermico}>
          <Text style={s.voceTermico}>
            Elettricità in più · {termico.consumoElettricoAggiuntivo}
          </Text>
          <Text style={[s.importoTermico, { color: COLORE.arancio }]}>
            − {termico.costoElettricoAggiuntivo}
          </Text>
        </View>
        <View style={s.totaleTermico}>
          <Text style={[s.voceTermico, { fontWeight: PESO.forte }]}>
            Risparmio all’anno sul riscaldamento
          </Text>
          <Text style={[s.valoreKpi, { color: COLORE.verde, marginTop: 0 }]}>
            {termico.risparmioAnnuo}
          </Text>
        </View>

        {termico.incentivoImporto ? (
          <View style={[s.totaleTermico, { paddingTop: SPAZIO.elemento }]}>
            <Text style={s.voceTermico}>{termico.incentivoEtichetta}</Text>
            <Text style={[s.importoTermico, { color: COLORE.verde }]}>
              {termico.incentivoImporto}
            </Text>
          </View>
        ) : null}

        <Text style={s.nota}>
          Il fabbisogno di calore è ricavato dal gas che hai consumato nell’ultimo
          anno. L’elettricità della pompa di calore è valutata tutta a prezzo di
          rete, senza attribuirle autoconsumo fotovoltaico. È una scelta prudente,
          ma il risultato reale dipende da stagione, profilo orario, tariffe e uso.
        </Text>
        <Text style={s.nota}>{termico.notaIncentivo}</Text>
      </View>
    </View>
  )
}
