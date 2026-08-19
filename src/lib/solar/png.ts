import { deflateSync } from 'node:zlib'

/**
 * Codifica PNG minimale (RGB, 8 bit) senza dipendenze esterne.
 *
 * Serve a restituire come immagine caricabile dal browser la foto aerea del
 * tetto, che arriva da Google Solar come GeoTIFF e va ricampionata e ri-servita.
 * Un encoder a mano (IHDR/IDAT/IEND + CRC, deflate via `node:zlib`) evita di
 * aggiungere `sharp`/`pngjs` solo per questo.
 */

const CRC_TABLE = (() => {
  const tabella = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1
    tabella[n] = c >>> 0
  }
  return tabella
})()

function crc32(buf: Uint8Array): number {
  let c = 0xff_ff_ff_ff
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
  }
  return (c ^ 0xff_ff_ff_ff) >>> 0
}

function chunk(tipo: string, dati: Uint8Array): Buffer {
  const tipoBytes = Buffer.from(tipo, 'ascii')
  const out = Buffer.alloc(12 + dati.length)
  out.writeUInt32BE(dati.length, 0)
  tipoBytes.copy(out, 4)
  Buffer.from(dati).copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([tipoBytes, Buffer.from(dati)])), 8 + dati.length)
  return out
}

/** `rgb` è width*height*3 byte (R,G,B per pixel). */
export function codificaPngRgb(width: number, height: number, rgb: Uint8Array): Buffer {
  const stride = width * 3
  // Ogni scanline è preceduta da un byte di filtro (0 = nessun filtro).
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const inizioRiga = y * (stride + 1)
    raw[inizioRiga] = 0
    Buffer.from(rgb.buffer, rgb.byteOffset + y * stride, stride).copy(raw, inizioRiga + 1)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type 2 = RGB
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ])
}
