import { redirect } from 'next/navigation'

export const metadata = { title: 'Da fare — EcoSolare OS' }

/**
 * I follow-up sono confluiti in «Da fare», come filtro.
 *
 * Leggevano la stessa tabella di «Le mie scadenze» e il primo filtro non
 * escludeva il secondo insieme: ogni follow-up compariva in entrambe le voci
 * di menu. La rotta resta viva per i segnalibri e per i collegamenti nei
 * messaggi Telegram già mandati.
 */
export default function FollowUpPage() {
  redirect('/attivita?tipo=follow_up')
}
