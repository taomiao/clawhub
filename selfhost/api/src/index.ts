import { toNodeListener } from 'h3'
import { createServer } from 'node:http'
import { getDb } from './db.js'
import { makeApp } from './http.js'

const host = process.env.HOST ?? '0.0.0.0'
const port = Number(process.env.PORT ?? 3000)

const db = getDb()
const app = makeApp(db)

const server = createServer(toNodeListener(app))

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[selfhost-api] listening on http://${host}:${port}`)
})

