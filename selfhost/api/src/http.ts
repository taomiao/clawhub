import { type H3Event, createApp, createRouter, defineEventHandler, getHeader, getQuery, readBody, readFormData, setHeader, setResponseStatus } from 'h3'
import { zipSync } from 'fflate'
import { ApiRoutes, ApiV1SkillListResponseSchema, ApiV1SkillResponseSchema, ApiV1WhoamiResponseSchema, CliPublishRequestSchema, WellKnownConfigSchema, parseArk } from 'clawhub-schema'
import { type } from 'arktype'
import { sha256Hex } from './crypto.js'
import { type Db } from './db.js'
import { getObject, getStorage, putObject } from './storage.js'

// For multipart/form-data publish, files are sent separately, not in payload.
const MultipartPublishPayloadSchema = type({
  slug: 'string',
  displayName: 'string',
  version: 'string',
  changelog: 'string',
  acceptLicenseTerms: 'boolean?',
  tags: 'string[]?',
  forkOf: type({
    slug: 'string',
    version: 'string?',
  }).optional(),
})

type AuthedUser = {
  id: number
  handle: string | null
  displayName: string | null
  role: 'admin' | 'moderator' | 'user'
}

function json(event: H3Event, status: number, body: unknown) {
  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  setResponseStatus(event, status)
  return body
}

function text(event: H3Event, status: number, body: string) {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setResponseStatus(event, status)
  return body
}

async function requireUser(db: Db, event: H3Event): Promise<AuthedUser> {
  const auth = getHeader(event, 'authorization') ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  const token = m[1]!.trim()
  if (!token.startsWith('clh_')) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  const tokenHash = sha256Hex(token)
  const r = await db.query<{
    id: number
    handle: string | null
    display_name: string | null
    role: 'admin' | 'moderator' | 'user'
  }>(
    `
      select u.id, u.handle, u.display_name, u.role
      from api_tokens t
      join users u on u.id = t.user_id
      where t.token_hash = $1 and t.revoked_at is null
      limit 1
    `,
    [tokenHash],
  )
  const row = r.rows[0]
  if (!row) throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    role: row.role,
  }
}

function getClientIp(event: H3Event) {
  const trustForwarded = process.env.TRUST_FORWARDED_IPS === 'true'
  if (trustForwarded) {
    const xff = getHeader(event, 'x-forwarded-for')
    if (xff) return xff.split(',')[0]!.trim()
    const xri = getHeader(event, 'x-real-ip')
    if (xri) return xri.trim()
  }
  return event.node.req.socket.remoteAddress ?? 'unknown'
}

async function getLatestVersionId(db: Db, skillId: number) {
  const r = await db.query<{ id: number; version: string; created_at: string; changelog: string }>(
    `
      select v.id, v.version, v.created_at, v.changelog
      from skill_versions v
      where v.skill_id = $1
      order by v.created_at desc
      limit 1
    `,
    [skillId],
  )
  return r.rows[0] ?? null
}

export function makeApp(db: Db) {
  const storage = getStorage()
  const app = createApp()
  
  // CORS middleware - restrict to specific origins in production
  app.use(defineEventHandler((event) => {
    const origin = getHeader(event, 'origin')
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      // Add your production domain here:
      // 'https://your-domain.com',
    ]
    
    if (origin && allowedOrigins.includes(origin)) {
      setHeader(event, 'Access-Control-Allow-Origin', origin)
      setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization')
      setHeader(event, 'Access-Control-Allow-Credentials', 'true')
    }
    
    // Handle preflight
    if (event.method === 'OPTIONS') {
      setResponseStatus(event, 204)
      return ''
    }
  }))
  
  const router = createRouter()

  router.get(
    '/.well-known/clawhub.json',
    defineEventHandler(async (event) => {
      const apiBase = process.env.WELL_KNOWN_API_BASE ?? `http://${getHeader(event, 'host') ?? 'localhost:8787'}`
      const raw = { apiBase, authBase: apiBase, minCliVersion: '0.0.0' }
      const config = parseArk(WellKnownConfigSchema, raw)
      return json(event, 200, config)
    }),
  )

  router.get(
    ApiRoutes.whoami,
    defineEventHandler(async (event) => {
      try {
        const user = await requireUser(db, event)
        const body = parseArk(ApiV1WhoamiResponseSchema, {
          user: { handle: user.handle, displayName: user.displayName, image: null },
        })
        return json(event, 200, body)
      } catch (e: any) {
        return text(event, e.statusCode ?? 500, e.message ?? 'error')
      }
    }),
  )

  router.get(
    ApiRoutes.skills,
    defineEventHandler(async (event) => {
      const q = getQuery(event)
      const limit = Math.max(1, Math.min(200, Number(q.limit ?? 25)))
      const r = await db.query<{
        id: number
        slug: string
        display_name: string
        summary: string | null
        created_at: string
        updated_at: string
      }>(
        `
        select id, slug, display_name, summary, created_at, updated_at
        from skills
        where deleted_at is null
        order by updated_at desc
        limit $1
      `,
        [limit],
      )

      const items = []
      for (const s of r.rows) {
        const latest = await getLatestVersionId(db, s.id)
        items.push({
          slug: s.slug,
          displayName: s.display_name,
          summary: s.summary,
          tags: latest ? { latest: latest.version } : {},
          stats: {},
          createdAt: new Date(s.created_at).getTime(),
          updatedAt: new Date(s.updated_at).getTime(),
          latestVersion: latest
            ? {
                version: latest.version,
                createdAt: new Date(latest.created_at).getTime(),
                changelog: latest.changelog,
              }
            : undefined,
        })
      }

      const body = parseArk(ApiV1SkillListResponseSchema, { items, nextCursor: null })
      return json(event, 200, body)
    }),
  )

  router.get(
    `${ApiRoutes.skills}/:slug`,
    defineEventHandler(async (event) => {
      const slug = event.context.params?.slug
      if (!slug) return text(event, 400, 'missing slug')
      const r = await db.query<{
        id: number
        slug: string
        display_name: string
        summary: string | null
        owner_user_id: number | null
        created_at: string
        updated_at: string
      }>(
        `
        select id, slug, display_name, summary, owner_user_id, created_at, updated_at
        from skills
        where slug = $1
        limit 1
      `,
        [slug],
      )
      const s = r.rows[0]
      if (!s) return text(event, 404, 'not found')
      if (s && (await db.query('select 1 from skills where slug=$1 and deleted_at is not null', [slug])).rowCount) {
        return text(event, 410, 'gone')
      }
      const latest = await getLatestVersionId(db, s.id)
      const owner =
        s.owner_user_id == null
          ? null
          : (
              await db.query<{ handle: string | null; display_name: string | null }>(
                `select handle, display_name from users where id = $1 limit 1`,
                [s.owner_user_id],
              )
            ).rows[0] ?? null
      const body = parseArk(ApiV1SkillResponseSchema, {
        skill: {
          slug: s.slug,
          displayName: s.display_name,
          summary: s.summary,
          tags: latest ? { latest: latest.version } : {},
          stats: {},
          createdAt: new Date(s.created_at).getTime(),
          updatedAt: new Date(s.updated_at).getTime(),
        },
        latestVersion: latest
          ? {
              version: latest.version,
              createdAt: new Date(latest.created_at).getTime(),
              changelog: latest.changelog,
            }
          : null,
        owner: owner
          ? { handle: owner.handle, displayName: owner.display_name, image: null }
          : null,
      })
      return json(event, 200, body)
    }),
  )

  router.get(
    `${ApiRoutes.skills}/:slug/file`,
    defineEventHandler(async (event) => {
      const slug = event.context.params?.slug
      if (!slug) return text(event, 400, 'missing slug')
      const q = getQuery(event)
      const path = String(q.path ?? '')
      if (!path) return text(event, 400, 'missing path')

      const rSkill = await db.query<{ id: number }>('select id from skills where slug=$1 and deleted_at is null limit 1', [
        slug,
      ])
      const skill = rSkill.rows[0]
      if (!skill) return text(event, 404, 'not found')

      let versionId: number | null = null
      if (q.version) {
        const rV = await db.query<{ id: number }>(
          'select id from skill_versions where skill_id=$1 and version=$2 limit 1',
          [skill.id, String(q.version)],
        )
        versionId = rV.rows[0]?.id ?? null
      } else {
        const latest = await getLatestVersionId(db, skill.id)
        versionId = latest?.id ?? null
      }
      if (!versionId) return text(event, 404, 'version not found')

      const rF = await db.query<{ storage_key: string; content_type: string | null; size: number }>(
        'select storage_key, content_type, size from skill_files where version_id=$1 and path=$2 limit 1',
        [versionId, path],
      )
      const f = rF.rows[0]
      if (!f) return text(event, 404, 'file not found')
      if (f.size > 200_000) return text(event, 413, 'file too large')

      const obj = await getObject(storage, f.storage_key)
      setHeader(event, 'content-type', f.content_type ?? 'text/plain; charset=utf-8')
      setResponseStatus(event, 200)
      return obj.bytes
    }),
  )

  router.get(
    ApiRoutes.resolve,
    defineEventHandler(async (event) => {
      const q = getQuery(event)
      const slug = String(q.slug ?? '')
      const hash = String(q.hash ?? '')
      if (!slug || !hash) return text(event, 400, 'missing slug/hash')

      const rSkill = await db.query<{ id: number }>('select id from skills where slug=$1 and deleted_at is null limit 1', [
        slug,
      ])
      const skill = rSkill.rows[0]
      if (!skill) return text(event, 404, 'not found')

      const match = await db.query<{ version: string }>(
        'select version from skill_versions where skill_id=$1 and bundle_hash=$2 limit 1',
        [skill.id, hash],
      )
      const latest = await getLatestVersionId(db, skill.id)
      return json(event, 200, {
        match: match.rows[0] ? { version: match.rows[0].version } : null,
        latestVersion: latest ? { version: latest.version } : null,
      })
    }),
  )

  router.get(
    ApiRoutes.download,
    defineEventHandler(async (event) => {
      const q = getQuery(event)
      const slug = String(q.slug ?? '')
      if (!slug) return text(event, 400, 'missing slug')

      const rSkill = await db.query<{ id: number; deleted_at: string | null }>(
        'select id, deleted_at from skills where slug=$1 limit 1',
        [slug],
      )
      const skill = rSkill.rows[0]
      if (!skill) return text(event, 404, 'not found')
      if (skill.deleted_at) return text(event, 410, 'gone')

      let versionId: number | null = null
      let versionStr: string | null = null
      if (q.version) {
        const rV = await db.query<{ id: number; version: string }>(
          'select id, version from skill_versions where skill_id=$1 and version=$2 limit 1',
          [skill.id, String(q.version)],
        )
        versionId = rV.rows[0]?.id ?? null
        versionStr = rV.rows[0]?.version ?? null
      } else {
        const latest = await getLatestVersionId(db, skill.id)
        versionId = latest?.id ?? null
        versionStr = latest?.version ?? null
      }
      if (!versionId || !versionStr) return text(event, 404, 'version not found')

      const rFiles = await db.query<{ path: string; storage_key: string }>(
        'select path, storage_key from skill_files where version_id=$1',
        [versionId],
      )

      const zipEntries: Record<string, Uint8Array> = {}
      for (const f of rFiles.rows) {
        const obj = await getObject(storage, f.storage_key)
        zipEntries[f.path] = obj.bytes
      }
      const zip = zipSync(zipEntries, { level: 6 })

      const ip = getClientIp(event)
      setHeader(event, 'content-type', 'application/zip')
      setHeader(event, 'content-disposition', `attachment; filename="${slug}-${versionStr}.zip"`)
      setHeader(event, 'x-clawhub-client-ip', ip)
      setResponseStatus(event, 200)
      return zip
    }),
  )

  // Get a single file from a skill version
  router.get(
    '/api/v1/skills/:slug/file',
    defineEventHandler(async (event) => {
      const slug = event.context.params?.slug ?? ''
      if (!slug) return text(event, 400, 'missing slug')
      
      const q = getQuery(event)
      const filePath = String(q.path ?? '')
      if (!filePath) return text(event, 400, 'missing path')

      const rSkill = await db.query<{ id: number; deleted_at: string | null }>(
        'select id, deleted_at from skills where slug=$1 limit 1',
        [slug],
      )
      const skill = rSkill.rows[0]
      if (!skill) return text(event, 404, 'skill not found')
      if (skill.deleted_at) return text(event, 410, 'gone')

      let versionId: number | null = null
      if (q.version) {
        const rV = await db.query<{ id: number }>(
          'select id from skill_versions where skill_id=$1 and version=$2 limit 1',
          [skill.id, String(q.version)],
        )
        versionId = rV.rows[0]?.id ?? null
      } else {
        const latest = await getLatestVersionId(db, skill.id)
        versionId = latest?.id ?? null
      }
      if (!versionId) return text(event, 404, 'version not found')

      const rFile = await db.query<{ storage_key: string; content_type: string | null }>(
        'select storage_key, content_type from skill_files where version_id=$1 and path=$2 limit 1',
        [versionId, filePath],
      )
      const file = rFile.rows[0]
      if (!file) return text(event, 404, 'file not found')

      const obj = await getObject(storage, file.storage_key)
      const contentType = file.content_type || 'text/plain; charset=utf-8'
      setHeader(event, 'content-type', contentType)
      setResponseStatus(event, 200)
      return obj.bytes
    }),
  )

  router.post(
    ApiRoutes.skills,
    defineEventHandler(async (event) => {
      try {
        const user = await requireUser(db, event)
        const contentType = getHeader(event, 'content-type') ?? ''
        let payloadRaw: any = null
        let files: { path: string; bytes: Uint8Array; contentType?: string }[] = []

        if (/multipart\/form-data/i.test(contentType)) {
          const fd = await readFormData(event)
          const payload = fd.get('payload')
          if (!payload) return text(event, 400, 'missing payload')
          const payloadJson = typeof payload === 'string' ? payload : await (payload as File).text()
          payloadRaw = JSON.parse(payloadJson)

          for (const [k, v] of fd.entries()) {
            if (k !== 'files' && k !== 'files[]') continue
            if (!(v instanceof File)) continue
            const path = v.name
            const bytes = new Uint8Array(await v.arrayBuffer())
            files.push({ path, bytes, contentType: v.type || undefined })
          }
        } else {
          const body = await readBody(event)
          payloadRaw = body?.payload ?? body
          // For MVP we only support multipart uploads.
        }

        const req = parseArk(MultipartPublishPayloadSchema, payloadRaw)
        if (!req.acceptLicenseTerms) {
          return text(event, 400, 'acceptLicenseTerms is required for self-host publish (MVP)')
        }
        if (!files.length) return text(event, 400, 'no files uploaded (use multipart with files[])')

        // Fingerprint is sha256 of sorted (path + sha256(file)).
        const fileMetas = files
          .map((f) => ({ path: f.path, sha256: sha256Hex(f.bytes), size: f.bytes.byteLength, contentType: f.contentType }))
          .sort((a, b) => a.path.localeCompare(b.path))
        const fingerprintInput = fileMetas.map((m) => `${m.path}\n${m.sha256}\n${m.size}\n`).join('')
        const bundleHash = sha256Hex(fingerprintInput)

        const now = new Date().toISOString()

        // Upsert skill.
        const rSkill = await db.query<{ id: number }>('select id from skills where slug=$1 limit 1', [req.slug])
        let skillId = rSkill.rows[0]?.id ?? null
        if (!skillId) {
          const ins = await db.query<{ id: number }>(
            `
            insert into skills (slug, display_name, summary, owner_user_id, created_at, updated_at)
            values ($1, $2, $3, $4, $5, $5)
            returning id
          `,
            [req.slug, req.displayName, null, user.id, now],
          )
          skillId = ins.rows[0]!.id
        } else {
          await db.query('update skills set display_name=$2, updated_at=$3, deleted_at=null where slug=$1', [
            req.slug,
            req.displayName,
            now,
          ])
        }

        // Insert version.
        const insV = await db.query<{ id: number }>(
          `
          insert into skill_versions (skill_id, version, changelog, bundle_hash, created_at)
          values ($1, $2, $3, $4, $5)
          returning id
        `,
          [skillId, req.version, req.changelog, bundleHash, now],
        )
        const versionId = insV.rows[0]!.id

        // Tags: default to ["latest"].
        const tags = req.tags?.length ? req.tags : ['latest']
        for (const tag of tags) {
          await db.query(
            `
            insert into skill_tags (skill_id, tag, version_id)
            values ($1, $2, $3)
            on conflict (skill_id, tag) do update set version_id = excluded.version_id, created_at = now()
          `,
            [skillId, tag, versionId],
          )
        }

        // Store files.
        for (const f of files) {
          const bytes = f.bytes
          const fileSha = sha256Hex(bytes)
          const key = `skills/${req.slug}/versions/${req.version}/files/${fileSha}-${encodeURIComponent(f.path)}`
          await putObject(storage, key, bytes)
          await db.query(
            `
            insert into skill_files (version_id, path, size, sha256, content_type, storage_key)
            values ($1, $2, $3, $4, $5, $6)
          `,
            [versionId, f.path, bytes.byteLength, fileSha, f.contentType ?? null, key],
          )
        }

        return json(event, 200, { ok: true, skillId: String(skillId), versionId: String(versionId) })
      } catch (e: any) {
        return text(event, e.statusCode ?? 500, e.message ?? 'error')
      }
    }),
  )

  // Compatibility: minimal /api/v1/search (keyword-only MVP).
  router.get(
    ApiRoutes.search,
    defineEventHandler(async (event) => {
      const q = getQuery(event)
      const query = String(q.q ?? '')
      if (!query) return json(event, 200, { results: [] })
      const limit = Math.max(1, Math.min(50, Number(q.limit ?? 20)))
      const r = await db.query<{ slug: string; display_name: string; updated_at: string }>(
        `
        select slug, display_name, updated_at
        from skills
        where deleted_at is null and (slug ilike $1 or display_name ilike $1)
        order by updated_at desc
        limit $2
      `,
        [`%${query}%`, limit],
      )
      const results = r.rows.map((s) => ({
        slug: s.slug,
        displayName: s.display_name,
        summary: null,
        version: null,
        score: 1,
        updatedAt: new Date(s.updated_at).getTime(),
      }))
      return json(event, 200, { results })
    }),
  )

  // h3's app.use expects a middleware function, not the router object.
  app.use(router.handler)

  app.use(
    defineEventHandler((event) => {
      return text(event, 404, 'not found')
    }),
  )

  return app
}

