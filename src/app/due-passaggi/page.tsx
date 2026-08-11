import { redirect } from 'next/navigation'
import { homeDopoAccesso } from '@/lib/auth/home'
import { getCurrentUser } from '@/lib/auth/session'

/**
 * La verifica in due passaggi non è più in uso (solo email + password).
 * Chi ha un segnalibro su questa rotta torna in area autenticata.
 */
export default async function PaginaDuePassaggi() {
  const utente = await getCurrentUser()
  if (!utente) redirect('/accedi')
  redirect(homeDopoAccesso(utente))
}
