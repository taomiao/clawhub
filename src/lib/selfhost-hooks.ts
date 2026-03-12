import { useQuery as useTanstackQuery } from '@tanstack/react-router'
import { getSkill, listSkills, searchSkills, type Skill, type SkillDetail } from './selfhost-api'

/**
 * React hooks for self-hosted ClawHub (replaces Convex useQuery).
 */

export function useSelfHostListSkills(params?: {
  limit?: number
  sort?: 'updated' | 'downloads' | 'stars' | 'installs' | 'installsAllTime' | 'trending'
}) {
  return useTanstackQuery({
    queryKey: ['skills', params],
    queryFn: () => listSkills(params),
  })
}

export function useSelfHostSkillDetail(slug: string) {
  return useTanstackQuery({
    queryKey: ['skill', slug],
    queryFn: () => getSkill(slug),
    enabled: !!slug,
  })
}

export function useSelfHostSearch(q: string, limit = 20) {
  return useTanstackQuery({
    queryKey: ['search', q, limit],
    queryFn: () => searchSkills(q, limit),
    enabled: !!q,
  })
}

// Legacy adapter: make hooks look like Convex useQuery for minimal changes
export function useSkillsList(opts: { limit?: number; sort?: string }) {
  const result = useSelfHostListSkills({
    limit: opts.limit,
    sort: opts.sort as any,
  })
  return result.data?.items ?? []
}

export function useSkillDetail(slug: string) {
  const result = useSelfHostSkillDetail(slug)
  return result.data
}
