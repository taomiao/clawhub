import { createHash, randomBytes } from 'node:crypto'

export function sha256Hex(bytes: Uint8Array | string) {
  const h = createHash('sha256')
  h.update(bytes)
  return h.digest('hex')
}

export function newToken() {
  // prefix aligns with docs (`clh_...`).
  return `clh_${randomBytes(24).toString('hex')}`
}

