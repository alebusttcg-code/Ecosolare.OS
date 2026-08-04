import { z } from 'zod'

/**
 * Validazione delle variabili d'ambiente all'avvio.
 *
 * Il motivo per cui questo file esiste: senza, una variabile mancante si
 * manifesta come `undefined` a meta' di una richiesta, in produzione, con un
 * errore che non dice quale sia il problema. Qui l'applicazione non parte
 * proprio, e dice cosa manca.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL e obbligatoria'),

  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET deve essere di almeno 32 caratteri'),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),

  /** Vuoto = nessuna restrizione di dominio. Sconsigliato in produzione. */
  ALLOWED_EMAIL_DOMAIN: z.string().optional(),

  /** Serve solo alla creazione del primo amministratore. */
  ADMIN_BOOTSTRAP_EMAIL: z.email().optional().or(z.literal('')),

  /**
   * Segreto condiviso con i form del sito e le landing per l'endpoint di intake.
   * Se assente, l'endpoint risponde 503: meglio disattivo che aperto.
   */
  INTAKE_TOKEN: z.string().min(24).optional().or(z.literal('')),
})

export type Env = z.infer<typeof schema>

let cached: Env | undefined

export function env(): Env {
  if (cached) return cached

  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const dettagli = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(
      `Configurazione d'ambiente non valida:\n${dettagli}\n\nVedere .env.example.`,
    )
  }

  cached = parsed.data
  return cached
}
