import { useEffect, useState } from 'react'
import { getSkill, getSkillFile, type SkillDetail } from '../lib/selfhost-api'

type Props = {
  slug: string
}

export function SelfHostSkillDetail({ slug }: Props) {
  const [detail, setDetail] = useState<SkillDetail | null>(null)
  const [readme, setReadme] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        
        const data = await getSkill(slug)
        if (cancelled) return
        setDetail(data)

        // Try to fetch SKILL.md
        try {
          const content = await getSkillFile(slug, 'SKILL.md')
          if (cancelled) return
          setReadme(content)
        } catch {
          // Fallback to skill.md
          try {
            const content = await getSkillFile(slug, 'skill.md')
            if (cancelled) return
            setReadme(content)
          } catch {
            // No README found
            setReadme(null)
          }
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load skill')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <main style={{ padding: '40px 20px', maxWidth: 900, margin: '0 auto' }}>
        <p>Loading...</p>
      </main>
    )
  }

  if (error || !detail) {
    return (
      <main style={{ padding: '40px 20px', maxWidth: 900, margin: '0 auto' }}>
        <h1>Error</h1>
        <p style={{ color: '#d32f2f' }}>{error || 'Skill not found'}</p>
        <p>
          <a href="/" style={{ color: '#0066cc' }}>← Back to home</a>
        </p>
      </main>
    )
  }

  const { skill, latestVersion, owner } = detail
  const ownerHandle = owner?.handle || owner?.displayName || 'unknown'

  return (
    <main style={{ padding: '40px 20px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <header style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>{skill.displayName}</h1>
          {latestVersion && (
            <span style={{ color: '#666', fontSize: '1rem' }}>v{latestVersion.version}</span>
          )}
        </div>
        <p style={{ color: '#666', margin: '8px 0' }}>
          by <span style={{ fontWeight: 500 }}>@{ownerHandle}</span>
        </p>
        {skill.summary && (
          <p style={{ fontSize: '1.1rem', color: '#333', marginTop: 16 }}>{skill.summary}</p>
        )}
      </header>

      {/* Install instructions */}
      <section style={{ background: '#f5f5f5', padding: 24, borderRadius: 8, marginBottom: 32 }}>
        <h2 style={{ marginTop: 0, fontSize: '1.3rem' }}>Install</h2>
        <pre style={{ 
          fontFamily: 'monospace', 
          background: '#fff', 
          padding: 16, 
          borderRadius: 4, 
          overflow: 'auto',
          margin: 0
        }}>
          {`clawhub install ${skill.slug} --registry http://localhost:3000`}
        </pre>
      </section>

      {/* README */}
      {readme && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>README</h2>
          <div style={{ 
            background: '#fff', 
            border: '1px solid #e0e0e0', 
            borderRadius: 8, 
            padding: 24,
            lineHeight: 1.6
          }}>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              wordWrap: 'break-word',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              margin: 0
            }}>
              {readme}
            </pre>
          </div>
        </section>
      )}

      {/* Changelog */}
      {latestVersion?.changelog && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>Latest Changes</h2>
          <div style={{ 
            background: '#f9f9f9', 
            border: '1px solid #e0e0e0', 
            borderRadius: 8, 
            padding: 16 
          }}>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              margin: 0,
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              {latestVersion.changelog}
            </pre>
          </div>
        </section>
      )}

      {/* Metadata */}
      <section style={{ fontSize: '0.9rem', color: '#666' }}>
        <p>
          <strong>Slug:</strong> {skill.slug}
        </p>
        {latestVersion && (
          <p>
            <strong>Published:</strong> {new Date(latestVersion.createdAt).toLocaleString()}
          </p>
        )}
      </section>

      <p style={{ marginTop: 32 }}>
        <a href="/" style={{ color: '#0066cc' }}>← Back to home</a>
      </p>
    </main>
  )
}
