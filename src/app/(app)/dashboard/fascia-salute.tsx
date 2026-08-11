import Link from 'next/link'
import { getStatoSalute, problemiLeggibili } from '@/lib/queries/salute'

/**
 * Avviso in cima alla dashboard quando qualcosa in coda si è fermato.
 *
 * Il messaggio Telegram è il canale che raggiunge chi non è davanti allo
 * schermo; questa fascia serve a chi lo è. Non si può contare solo sul primo:
 * Telegram può non essere configurato, il telefono può essere in silenzioso, e
 * un guasto silenzioso è esattamente ciò che si sta cercando di eliminare.
 *
 * Quando va tutto bene non mostra nulla. Una fascia verde permanente insegna a
 * non guardare quella zona dello schermo, e il giorno che diventa rossa non la
 * vede più nessuno.
 */
export async function FasciaSalute() {
  const stato = await getStatoSalute()
  const problemi = problemiLeggibili(stato)

  if (problemi.length === 0) return null

  return (
    <div
      className="rounded-lg border px-4 py-3"
      style={{
        borderColor: 'rgba(224,133,133,0.45)',
        background: 'rgba(224,133,133,0.08)',
      }}
      role="status"
    >
      <p className="text-sm font-semibold" style={{ color: '#e8a0a0' }}>
        Qualcosa non sta funzionando da solo
      </p>

      <ul className="mt-2 space-y-1">
        {problemi.map((riga) => (
          <li key={riga} className="text-sm" style={{ color: 'var(--testo-tenue)' }}>
            · {riga}
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs" style={{ color: 'var(--testo-fioco)' }}>
        I documenti sono al sicuro: niente viene mai cancellato davvero. Quello che
        manca è la copia automatica, che riparte da sola appena la causa è risolta.{' '}
        <Link href="/amministrazione/impostazioni#manutenzione" className="underline">
          Vedi cosa fare
        </Link>
        .
      </p>
    </div>
  )
}
