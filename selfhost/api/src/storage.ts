import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, normalize } from 'node:path'

export type Storage = {
  baseDir: string
}

export function getStorage(): Storage {
  const baseDir = process.env.STORAGE_DIR ?? join(process.cwd(), '.data', 'storage')
  return { baseDir }
}

function safeJoin(base: string, key: string) {
  const p = normalize(key).replace(/^(\.\.(\/|\\|$))+/, '')
  return join(base, p)
}

export async function putObject(storage: Storage, key: string, bytes: Uint8Array) {
  const p = safeJoin(storage.baseDir, key)
  await mkdir(dirname(p), { recursive: true })
  await writeFile(p, bytes)
}

export async function getObject(storage: Storage, key: string) {
  const p = safeJoin(storage.baseDir, key)
  const bytes = await readFile(p)
  return { bytes, path: p }
}

export async function getObjectStat(storage: Storage, key: string) {
  const p = safeJoin(storage.baseDir, key)
  return await stat(p)
}

