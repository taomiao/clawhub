/**
 * Self-hosted ClawHub API client (no Convex dependency).
 * Uses the HTTP API exposed by selfhost/api/src/http.ts
 */

// API is on port 3000, frontend dev server is on 5173
const API_BASE = typeof window !== 'undefined'
  ? (window.location.port === '5173' ? 'http://127.0.0.1:3000' : window.location.origin)
  : process.env.VITE_CONVEX_SITE_URL || 'http://localhost:3000'

export type Skill = {
  slug: string
  displayName: string
  summary: string | null
  tags: Record<string, string>
  stats: Record<string, number>
  createdAt: number
  updatedAt: number
  latestVersion?: {
    version: string
    createdAt: number
    changelog: string
  }
}

export type SkillDetail = {
  skill: Skill
  latestVersion: {
    version: string
    createdAt: number
    changelog: string
  } | null
  owner: {
    handle: string | null
    displayName: string | null
    image: string | null
  } | null
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function listSkills(params?: {
  limit?: number
  sort?: 'updated' | 'downloads' | 'stars' | 'installs' | 'installsAllTime' | 'trending'
}): Promise<{ items: Skill[]; nextCursor: string | null }> {
  const query = new URLSearchParams()
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.sort) query.set('sort', params.sort)
  return apiFetch(`/api/v1/skills?${query}`)
}

export async function getSkill(slug: string): Promise<SkillDetail> {
  return apiFetch(`/api/v1/skills/${encodeURIComponent(slug)}`)
}

export async function searchSkills(q: string, limit = 20): Promise<{
  results: Array<{
    slug: string
    displayName: string
    summary: string | null
    version: string | null
    score: number
    updatedAt: number
  }>
}> {
  const query = new URLSearchParams({ q, limit: String(limit) })
  return apiFetch(`/api/v1/search?${query}`)
}

export async function getSkillFile(slug: string, path: string, version?: string): Promise<string> {
  const query = new URLSearchParams({ path })
  if (version) query.set('version', version)
  const res = await fetch(`${API_BASE}/api/v1/skills/${encodeURIComponent(slug)}/file?${query}`)
  if (!res.ok) throw new Error(`File fetch failed: ${res.status}`)
  return res.text()
}
