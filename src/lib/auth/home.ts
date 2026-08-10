import { can, type PolicySubject } from '@/lib/auth/policy'

/**
 * Atterraggio dopo login / visita a `/` per chi non è amministratore.
 * La Dashboard unica è solo direzione.
 */
export function homeDopoAccesso(utente: PolicySubject): string {
  if (utente.role === 'amministratore') return '/'
  if (can(utente, 'read', 'opportunity')) return '/lead'
  if (can(utente, 'read', 'activity')) return '/attivita'
  if (can(utente, 'read', 'project')) return '/cantieri'
  return '/lead'
}
