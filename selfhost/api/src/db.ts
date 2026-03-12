import pg from 'pg'

const { Pool } = pg

export type Db = pg.Pool

export function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  return new Pool({ connectionString: url })
}

export async function dbNow(db: Db) {
  const r = await db.query<{ now: string }>('select now() as now')
  return r.rows[0]?.now ?? new Date().toISOString()
}

