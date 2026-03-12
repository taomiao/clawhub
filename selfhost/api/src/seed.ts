import { getDb } from './db.js'
import { newToken, sha256Hex } from './crypto.js'

const db = getDb()

async function main() {
  const handle = process.env.SEED_ADMIN_HANDLE ?? 'admin'
  const displayName = process.env.SEED_ADMIN_DISPLAY_NAME ?? 'Admin'

  const token = newToken()
  const tokenHash = sha256Hex(token)

  const user = await db.query<{ id: number }>(
    `
    insert into users (handle, display_name, role)
    values ($1, $2, 'admin')
    on conflict (handle) do update set role='admin', display_name=excluded.display_name
    returning id
  `,
    [handle, displayName],
  )
  const userId = user.rows[0]!.id

  await db.query(
    `
    insert into api_tokens (token_hash, user_id)
    values ($1, $2)
  `,
    [tokenHash, userId],
  )

  // eslint-disable-next-line no-console
  console.log('Created admin token (store it securely):')
  // eslint-disable-next-line no-console
  console.log(token)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

