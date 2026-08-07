import { createHash, randomUUID } from 'node:crypto'
import { env } from '@/env'
import type { Archivio, FileArchiviato } from './index'

/**
 * Archivio su Supabase Storage.
 *
 * Perché l'API REST invece di `@supabase/supabase-js`: servono tre chiamate
 * — carica, leggi, elimina — e il pacchetto ufficiale porta con sé il client
 * Postgres, quello realtime e quello di autenticazione, nessuno dei quali
 * viene usato: qui il database si raggiunge con Drizzle e le sessioni sono
 * nostre.
 *
 * **Il bucket deve essere privato.** Sono documenti di clienti: un bucket
 * pubblico li rende leggibili a chiunque indovini una chiave, e le chiavi
 * contengono l'identificativo della commessa. L'accesso passa sempre da
 * `/api/documenti/[id]`, che applica `guard` prima di servire i byte.
 */

function configurazione(): { url: string; chiave: string; bucket: string } | null {
  const c = env()
  if (!c.SUPABASE_URL || !c.SUPABASE_SERVICE_ROLE_KEY) return null
  return {
    url: c.SUPABASE_URL.replace(/\/+$/, ''),
    chiave: c.SUPABASE_SERVICE_ROLE_KEY,
    bucket: c.SUPABASE_STORAGE_BUCKET,
  }
}

export function supabaseStorageConfigurato(): boolean {
  return configurazione() !== null
}

export class ArchivioSupabase implements Archivio {
  private conf() {
    const c = configurazione()
    if (!c) throw new Error('Supabase Storage non configurato.')
    return c
  }

  private intestazioni(): Record<string, string> {
    const { chiave } = this.conf()
    return { authorization: `Bearer ${chiave}`, apikey: chiave }
  }

  private indirizzo(chiave: string): string {
    const { url, bucket } = this.conf()
    // Ogni segmento va codificato separatamente: codificare l'intera chiave
    // trasformerebbe anche le barre, e il file finirebbe in un percorso con il
    // nome sbagliato invece che nella sua cartella.
    const percorso = chiave.split('/').map(encodeURIComponent).join('/')
    return `${url}/storage/v1/object/${bucket}/${percorso}`
  }

  async salva(params: {
    contenuto: Uint8Array
    estensione: string
    cartella: string
  }): Promise<FileArchiviato> {
    // Come sul disco: la chiave la genera il sistema, il nome originale non
    // entra mai nel percorso.
    const chiave = `${params.cartella}/${randomUUID()}.${params.estensione}`

    const risposta = await fetch(this.indirizzo(chiave), {
      method: 'POST',
      headers: {
        ...this.intestazioni(),
        'content-type': 'application/octet-stream',
        // Nessuna sovrascrittura: le chiavi sono UUID, quindi una collisione
        // significherebbe un errore da vedere, non un file da rimpiazzare.
        'x-upsert': 'false',
      },
      body: Buffer.from(params.contenuto),
    })

    if (!risposta.ok) {
      throw new Error(
        `Caricamento su Supabase Storage fallito (${risposta.status}): ${await risposta.text()}`,
      )
    }

    return {
      chiave,
      dimensione: params.contenuto.byteLength,
      checksum: createHash('sha256').update(params.contenuto).digest('hex'),
    }
  }

  async leggi(chiave: string): Promise<Uint8Array | null> {
    const risposta = await fetch(this.indirizzo(chiave), {
      headers: this.intestazioni(),
    })

    if (risposta.status === 404) return null
    if (!risposta.ok) {
      // Un 500 non è «il file non c'è»: restituire null lo farebbe scambiare
      // per un documento mancante e cancellare la riga che lo descrive.
      throw new Error(`Lettura da Supabase Storage fallita (${risposta.status}).`)
    }

    return new Uint8Array(await risposta.arrayBuffer())
  }

  async elimina(chiave: string): Promise<void> {
    const risposta = await fetch(this.indirizzo(chiave), {
      method: 'DELETE',
      headers: this.intestazioni(),
    })

    if (!risposta.ok && risposta.status !== 404) {
      throw new Error(`Cancellazione da Supabase Storage fallita (${risposta.status}).`)
    }
  }
}
