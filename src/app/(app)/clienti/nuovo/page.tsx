import { redirect } from 'next/navigation'
import { guard } from '@/lib/auth/session'

/**
 * Non si crea un cliente a mano: nasce dalla firma del preventivo.
 * L'ingresso anagrafico è «Nuovo lead».
 */
export default async function NuovoClienteRedirect() {
  // Stessa risorsa della destinazione: il redirect non salta il guard (ADR-006).
  await guard('create', 'opportunity')
  redirect('/lead/nuova')
}
