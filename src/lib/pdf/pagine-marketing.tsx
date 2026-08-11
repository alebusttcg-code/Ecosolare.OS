/* eslint-disable jsx-a11y/alt-text -- React-PDF Image non espone la prop HTML `alt`. */
import { Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import {
  COLONNA,
  COLORE,
  INTERLINEA,
  PESO,
  RAGGIO,
  SPAZIO,
  TESTO,
  TRACKING,
} from './design'
import {
  CHIUSURA_GARANZIA,
  MOTIVI_GARANZIA,
  type PaginaMarketing,
} from './testi-marketing'

/**
 * Le pagine «PERCHÉ ECOSOLARE», composte invece che fotografate.
 *
 * Prima erano cinque JPEG del vecchio documento Word incollati in mezzo al
 * PDF. Il testo era giusto, ma il carattere era un altro, il logo era un altro
 * e il piè di pagina era un altro: sfogliando il documento si vedeva
 * chiaramente il punto in cui finiva il nostro lavoro e cominciava una
 * fotocopia. Erano anche immagini, quindi non selezionabili, non cercabili e
 * sgranate in stampa.
 *
 * Il testo è identico parola per parola (`testi-marketing.ts`); le immagini
 * sono le originali. Cambia solo il modo in cui stanno sulla pagina.
 */

const s = StyleSheet.create({
  intestazione: { marginBottom: SPAZIO.blocco },
  numeroSezione: {
    fontSize: TESTO.minuto,
    fontWeight: PESO.forte,
    color: COLORE.oro,
    letterSpacing: TRACKING.maiuscolo,
  },
  titolo: {
    fontSize: TESTO.titolo,
    fontWeight: PESO.forte,
    color: COLORE.inchiostro,
    marginTop: SPAZIO.filo,
  },
  sottotitolo: {
    fontSize: TESTO.sezione,
    fontWeight: PESO.medio,
    color: COLORE.bluScuro,
    marginTop: SPAZIO.minimo,
    lineHeight: INTERLINEA.stretta,
  },
  filetto: {
    height: 2,
    width: 54,
    backgroundColor: COLORE.oro,
    marginTop: SPAZIO.gruppo,
  },
  paragrafo: {
    fontSize: TESTO.corpo,
    lineHeight: INTERLINEA.normale,
    color: COLORE.inchiostroMedio,
    marginBottom: SPAZIO.elemento,
  },

  /*
   * Il corpo occupa l'altezza rimasta e distribuisce lo spazio fra i suoi
   * blocchi. Senza, il contenuto si accumula in alto e sotto resta mezza
   * pagina bianca: era il difetto che più di ogni altro faceva sembrare il
   * documento un export invece di una brochure.
   */
  corpo: { flexGrow: 1, justifyContent: 'space-between' },
  /** Una sola figura al centro: distribuirla agli estremi la lascerebbe sola. */
  corpoCentrato: { flexGrow: 1, justifyContent: 'center' },

  /* Loghi dei produttori: griglia regolare, ognuno nel proprio riquadro. */
  grigliaLoghi: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  cellaLogo: {
    width: '33.333%',
    height: 96,
    padding: SPAZIO.gruppo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { objectFit: 'contain', maxWidth: '100%', maxHeight: '100%' },

  /* Altroconsumo: logo in linea, foto a piena larghezza. */
  logoInLinea: { height: 26, objectFit: 'contain', marginBottom: SPAZIO.gruppo },
  fotoLarga: {
    width: COLONNA,
    height: 244,
    borderRadius: RAGGIO.normale,
    objectFit: 'cover',
  },

  /* Recensioni: due colonne, ritagli con bordo leggero. */
  grigliaRecensioni: { flexDirection: 'row', flexWrap: 'wrap' },
  /*
   * Altezza fissa, non proporzionale: le recensioni sono ritagli di schermate
   * con proporzioni diverse fra loro, e lasciarle libere faceva traboccare la
   * quarta sulla pagina successiva.
   */
  cellaRecensione: { width: '50%', height: 246, padding: SPAZIO.elemento },
  recensione: {
    width: '100%',
    height: '100%',
    borderWidth: 0.7,
    borderColor: COLORE.linea,
    borderRadius: RAGGIO.normale,
    objectFit: 'contain',
  },

  /* Certificato: centrato, con i tre motivi accanto. */
  bloccoGaranzia: { flexDirection: 'row', gap: SPAZIO.respiro, alignItems: 'center' },
  colonnaMotivi: { flex: 1, justifyContent: 'center' },
  aperturaGaranzia: {
    fontSize: TESTO.corpo,
    color: COLORE.inchiostroMorbido,
    marginBottom: SPAZIO.gruppo,
  },
  motivo: {
    fontSize: TESTO.corpo,
    color: COLORE.inchiostro,
    marginBottom: SPAZIO.elemento,
    paddingLeft: SPAZIO.gruppo,
    borderLeftWidth: 2,
    borderLeftColor: COLORE.oro,
    lineHeight: INTERLINEA.stretta,
  },
  premessa: {
    fontSize: TESTO.corpo,
    color: COLORE.inchiostroMorbido,
    marginTop: SPAZIO.gruppo,
  },
  claim: {
    fontSize: TESTO.sezione,
    fontWeight: PESO.forte,
    color: COLORE.bluScuro,
    marginTop: SPAZIO.minimo,
    lineHeight: INTERLINEA.stretta,
  },
  certificato: { width: 232, height: 234, objectFit: 'contain' },
})

export function IntestazionePaginaMarketing({
  pagina,
}: {
  pagina: PaginaMarketing
}) {
  return (
    <View style={s.intestazione}>
      <Text style={s.numeroSezione}>{`${pagina.numero}. ${pagina.titolo}`}</Text>
      <Text style={s.sottotitolo}>{pagina.sottotitolo}</Text>
      <View style={s.filetto} />
    </View>
  )
}

/**
 * Il corpo di una pagina marketing.
 *
 * La disposizione dipende dal tipo di materiale: sei loghi vogliono una
 * griglia, una foto premio vuole tutta la larghezza, quattro recensioni vogliono
 * due colonne. Provare a impaginarli tutti allo stesso modo è esattamente ciò
 * che fa sembrare un documento composto da una macchina.
 */
export function CorpoPaginaMarketing({
  pagina,
  immaginiSrc,
}: {
  pagina: PaginaMarketing
  /** Data-URI risolti, nello stesso ordine di `pagina.immagini`. */
  immaginiSrc: readonly string[]
}) {
  return (
    <View style={pagina.disposizione === 'certificato' ? s.corpoCentrato : s.corpo}>
      {pagina.apertura.map((paragrafo) => (
        <Text key={paragrafo} style={s.paragrafo}>
          {paragrafo}
        </Text>
      ))}

      {pagina.disposizione === 'loghi' ? (
        <View style={s.grigliaLoghi}>
          {immaginiSrc.map((src, i) => (
            <View key={i} style={s.cellaLogo}>
              <Image src={src} style={s.logo} />
            </View>
          ))}
        </View>
      ) : null}

      {pagina.disposizione === 'foto' ? (
        <>
          {immaginiSrc[0] ? (
            <Image src={immaginiSrc[0]} style={s.logoInLinea} />
          ) : null}
          {immaginiSrc[1] ? (
            <Image src={immaginiSrc[1]} style={s.fotoLarga} />
          ) : null}
        </>
      ) : null}

      {pagina.disposizione === 'recensioni' ? (
        <View style={s.grigliaRecensioni}>
          {immaginiSrc.map((src, i) => (
            <View key={i} style={s.cellaRecensione}>
              <Image src={src} style={s.recensione} />
            </View>
          ))}
        </View>
      ) : null}

      {pagina.disposizione === 'certificato' ? (
        <View style={s.bloccoGaranzia}>
          <View style={s.colonnaMotivi}>
            <Text style={s.aperturaGaranzia}>{CHIUSURA_GARANZIA.apertura}</Text>
            {MOTIVI_GARANZIA.map((m) => (
              <Text key={m} style={s.motivo}>
                {m}
              </Text>
            ))}
            <Text style={s.premessa}>{CHIUSURA_GARANZIA.premessa}</Text>
            <Text style={s.claim}>{CHIUSURA_GARANZIA.claim}</Text>
          </View>
          {immaginiSrc[0] ? (
            <Image src={immaginiSrc[0]} style={s.certificato} />
          ) : null}
        </View>
      ) : null}

      {pagina.chiusura.map((paragrafo) => (
        <Text key={paragrafo} style={s.paragrafo}>
          {paragrafo}
        </Text>
      ))}
    </View>
  )
}
