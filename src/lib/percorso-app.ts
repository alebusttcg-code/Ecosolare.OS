/**
 * Path interno dell’app per redirect (`?da=`): solo percorso relativo sicuro.
 * Blocca open-redirect (schema, protocol-relative, backslash).
 */
export function percorsoAppSicuro(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return null
  if (t.includes('://') || t.includes('\\')) return null
  if (/[\0-\x1f\x7f]/.test(t)) return null
  return t
}
