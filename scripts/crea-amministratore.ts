/**
 * Crea il primo amministratore, o rigenera la password di uno esistente.
 *
 *   npm run amministratore
 *
 * Perché uno script e non una schermata: finché non esiste un amministratore
 * non esiste nessuno che possa creare utenti, e una schermata pubblica che crea
 * amministratori sarebbe una porta aperta anche dopo il primo utilizzo. Qui
 * l'unico requisito è l'accesso al terminale e alla stringa di connessione,
 * che è già il livello di fiducia più alto del sistema.
 *
 * **La password compare a schermo una volta sola.** Nel database resta solo
 * l'impronta: se va persa, si rilancia questo comando.
 */
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import postgres from 'postgres'
import { users } from '../src/db/schema'
import { calcolaImpronta, generaPasswordIniziale } from '../src/lib/auth/password'

const c = {
  oro: (s: string) => `[33m${s}[0m`,
  verde: (s: string) => `[32m${s}[0m`,
  rosso: (s: string) => `[31m${s}[0m`,
  fioco: (s: string) => `[90m${s}[0m`,
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(c.rosso('DATABASE_URL non impostata. Lancia prima: npm run configura'))
    process.exit(1)
  }

  // Email e nome si possono passare da riga di comando: serve a chi automatizza
  // la preparazione di un ambiente, dove non c'è nessuno a rispondere.
  //   npm run amministratore -- federico@ecosolare.it "Federico Leporati"
  const [emailArg, nomeArg] = process.argv.slice(2)

  let email = emailArg?.trim().toLowerCase() ?? ''
  let nome = nomeArg?.trim() ?? ''

  if (!emailArg) {
    const rl = createInterface({ input: stdin, output: stdout })
    email = (await rl.question('Email dell’amministratore\n> ')).trim().toLowerCase()
    nome = (await rl.question('Nome e cognome (facoltativo)\n> ')).trim()
    rl.close()
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(c.rosso('\nIndirizzo email non valido.'))
    process.exit(1)
  }

  const client = postgres(url, { max: 1, prepare: false })
  const db = drizzle(client)

  const password = generaPasswordIniziale()
  const impronta = await calcolaImpronta(password)

  const esistente = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (esistente.length > 0) {
    await db
      .update(users)
      .set({
        role: 'amministratore',
        canViewCosts: true,
        isActive: true,
        passwordHash: impronta,
        passwordUpdatedAt: new Date(),
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.email, email))
    console.log(c.verde('\n✓') + ' Utente esistente promosso e password rigenerata.')
  } else {
    await db.insert(users).values({
      email,
      name: nome || null,
      role: 'amministratore',
      canViewCosts: true,
      passwordHash: impronta,
      passwordUpdatedAt: new Date(),
      mustChangePassword: true,
    })
    console.log(c.verde('\n✓') + ' Amministratore creato.')
  }

  console.log(`
  Email     ${email}
  Password  ${c.oro(password)}

${c.fioco('Annotala adesso: non è recuperabile. Al primo accesso ti verrà chiesto di cambiarla.')}
`)

  await client.end()
}

main().catch(async (errore: unknown) => {
  console.error(c.rosso('\nOperazione non riuscita.'), errore)
  process.exit(1)
})
