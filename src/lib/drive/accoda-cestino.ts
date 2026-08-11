import type { Esecutore } from '@/db'
import { accoda } from '@/lib/outbox'
import { TIPO_CESTINA_FILE, TIPO_RIPRISTINA_FILE } from './gestori'

/**
 * Accoda l’allineamento del cestino Drive (ADR-005 + ADR-012).
 *
 * Soft-delete e ripristino devono riuscire anche se Drive è giù: la verità è
 * la riga, e la copia si riallinea con retry. La chiave include l’istante così
 * un ciclo elimina→ripristina→elimina produce tre eventi distinti.
 */
export async function accodaAllineamentoCestinoDrive(
  db: Esecutore,
  args: {
    readonly driveFileId: string
    readonly azione: 'cestina' | 'ripristina'
    /** Es. `documento:<uuid>:<iso>` — univoca per questa operazione. */
    readonly chiave: string
  },
): Promise<void> {
  const type = args.azione === 'cestina' ? TIPO_CESTINA_FILE : TIPO_RIPRISTINA_FILE
  await accoda(db, {
    type,
    payload: { driveFileId: args.driveFileId },
    dedupKey: `${type}:${args.chiave}`,
  })
}
