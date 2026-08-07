import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { ArchivioSupabase, supabaseStorageConfigurato } from './supabase'

/**
 * Archiviazione dei documenti.
 *
 * I file NON stanno nel database (ADR-010 e §14): stanno in un archivio a
 * oggetti, e nel database resta solo la chiave con i metadati. Qui c'è
 * l'interfaccia e l'implementazione su disco, che funziona subito in locale.
 *
 * **Su Vercel il disco è effimero e in sola lettura**: in produzione serve
 * Supabase Storage (D-009), che è già previsto e si aggancia implementando
 * questa stessa interfaccia. È esattamente il motivo per cui è un'interfaccia
 * e non una manciata di chiamate sparse nel codice.
 */

export interface FileArchiviato {
  readonly chiave: string
  readonly dimensione: number
  readonly checksum: string
}

export interface Archivio {
  salva(params: {
    contenuto: Uint8Array
    estensione: string
    cartella: string
  }): Promise<FileArchiviato>
  leggi(chiave: string): Promise<Uint8Array | null>
  elimina(chiave: string): Promise<void>
}

/* -------------------------------------------------------------------------- */
/*  Implementazione su disco locale                                            */
/* -------------------------------------------------------------------------- */

const RADICE = resolve(process.cwd(), '.archivio')

/**
 * Impedisce che una chiave manipolata esca dalla cartella dell'archivio.
 *
 * Le chiavi le genera il sistema, quindi in teoria non serve; in pratica questo
 * controllo costa due righe ed è l'unica cosa che separa un bug futuro dalla
 * lettura di un file arbitrario del server.
 */
function percorsoSicuro(chiave: string): string | null {
  const percorso = resolve(RADICE, chiave)
  if (!percorso.startsWith(RADICE + '/') && percorso !== RADICE) return null
  return percorso
}

class ArchivioSuDisco implements Archivio {
  async salva(params: {
    contenuto: Uint8Array
    estensione: string
    cartella: string
  }): Promise<FileArchiviato> {
    // La chiave è generata dal sistema: il nome originale non entra MAI nel
    // percorso, così non esiste modo di influenzarlo dall'esterno.
    const chiave = join(params.cartella, `${randomUUID()}.${params.estensione}`)
    const percorso = percorsoSicuro(chiave)
    if (percorso === null) throw new Error('Chiave di archiviazione non valida')

    await mkdir(dirname(percorso), { recursive: true })
    await writeFile(percorso, params.contenuto)

    return {
      chiave,
      dimensione: params.contenuto.byteLength,
      // Il checksum permette di accorgersi se un file cambia sotto i piedi.
      checksum: createHash('sha256').update(params.contenuto).digest('hex'),
    }
  }

  async leggi(chiave: string): Promise<Uint8Array | null> {
    const percorso = percorsoSicuro(chiave)
    if (percorso === null) return null
    try {
      return new Uint8Array(await readFile(percorso))
    } catch {
      return null
    }
  }

  async elimina(chiave: string): Promise<void> {
    const percorso = percorsoSicuro(chiave)
    if (percorso === null) return
    try {
      await unlink(percorso)
    } catch {
      // Un file già assente non è un errore da propagare.
    }
  }
}

let archivio: Archivio | undefined

/**
 * L'archivio in uso.
 *
 * Supabase Storage se configurato, disco altrimenti. La scelta è automatica e
 * non ha un interruttore: un interruttore permetterebbe di girare in
 * produzione sul disco, che su Vercel significa perdere i documenti al deploy
 * successivo senza che nessun errore lo segnali.
 */
export function getArchivio(): Archivio {
  archivio ??= supabaseStorageConfigurato() ? new ArchivioSupabase() : new ArchivioSuDisco()
  return archivio
}
