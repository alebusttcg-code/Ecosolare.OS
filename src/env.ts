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

  /*
   * Non serve alcun segreto per le sessioni: il token di sessione e' un valore
   * casuale confrontato con il database, non un JWT firmato. Non c'e' niente
   * da firmare, quindi non c'e' niente da tenere segreto oltre al database.
   */

  /**
   * Segreto condiviso con i form del sito e le landing per l'endpoint di intake.
   * Se assente, l'endpoint risponde 503: meglio disattivo che aperto.
   */
  INTAKE_TOKEN: z.string().min(24).optional().or(z.literal('')),

  /**
   * Segreto che protegge gli endpoint di manutenzione (`/api/manutenzione/*`),
   * chiamati da un pianificatore e non da una persona. Se assente rispondono
   * 503: un endpoint che elabora la coda e' un endpoint che va protetto.
   */
  MAINTENANCE_TOKEN: z.string().min(24).optional().or(z.literal('')),

  /**
   * Chiave con cui si cifra il segreto della verifica in due passaggi
   * (32 byte in esadecimale: `openssl rand -hex 32`).
   *
   * Sta nell'ambiente e non nel database di proposito: e' cio' che impedisce a
   * una copia del database di contenere anche il secondo fattore di tutti.
   * Senza, l'MFA non si puo' attivare. Se la si perde, chi ha gia' attivato
   * l'MFA entra con i codici di recupero e riconfigura l'app.
   */
  MFA_SECRET_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'MFA_SECRET_KEY deve essere 64 caratteri esadecimali')
    .optional()
    .or(z.literal('')),

  /* --- Archivio dei documenti (Supabase Storage) ------------------------- */
  /**
   * Se assenti si usa il disco locale, che va bene solo in sviluppo: su Vercel
   * il disco e' effimero e i file caricati sparirebbero al deploy successivo.
   */
  SUPABASE_URL: z.string().optional().or(z.literal('')),
  /**
   * Chiave di servizio: **scavalca RLS**. Sta solo sul server e non deve mai
   * finire in una variabile con prefisso NEXT_PUBLIC_.
   */
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal('')),
  SUPABASE_STORAGE_BUCKET: z.string().default('documenti'),

  /* --- Copia su Google Drive (D-011) ------------------------------------ */
  /**
   * Id del **Drive condiviso**. Un service account non ha spazio proprio: con
   * una cartella di un Drive personale ogni creazione fallisce per quota.
   * Se queste tre variabili mancano, la copia su Drive resta disattivata e il
   * resto funziona normalmente.
   */
  GOOGLE_DRIVE_ID: z.string().optional().or(z.literal('')),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional().or(z.literal('')),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional().or(z.literal('')),
  /**
   * Utente Workspace da impersonare (delegazione a livello di dominio).
   * Serve se la radice è una cartella di «Il mio Drive» e non un Drive
   * condiviso: senza, Google risponde `storageQuotaExceeded`.
   */
  GOOGLE_DRIVE_DELEGATED_USER: z.string().optional().or(z.literal('')),
  /**
   * Alternativa alla service account per Drive personale (Gmail): OAuth
   * dell’utente proprietario della cartella. Si ottiene con
   * `npm run drive:autorizza`.
   */
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional().or(z.literal('')),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional().or(z.literal('')),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().optional().or(z.literal('')),

  /* --- Google Maps / Solar (D-016, sezione Sviluppo) -------------------- */
  /**
   * Chiave API server-side (Geocoding + Solar). Se assente, /sviluppo spiega
   * che Solar non è configurato. Mai in NEXT_PUBLIC_*.
   */
  GOOGLE_MAPS_API_KEY: z.string().optional().or(z.literal('')),

  /* --- Telegram follow-up (D-015) --------------------------------------- */
  /**
   * Se assenti, i reminder Telegram restano disattivi e il resto dell’app
   * funziona normalmente.
   */
  TELEGRAM_BOT_TOKEN: z.string().optional().or(z.literal('')),
  /** Header X-Telegram-Bot-Api-Secret-Token sul webhook. */
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional().or(z.literal('')),
  /** Username del bot senza @ — per istruzioni «Apri @nome». */
  TELEGRAM_BOT_USERNAME: z.string().optional().or(z.literal('')),
  /** URL pubblico dell’app (link nelle notifiche). Es. https://staging.….vercel.app */
  APP_BASE_URL: z.union([z.literal(''), z.string().url()]).optional(),
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
