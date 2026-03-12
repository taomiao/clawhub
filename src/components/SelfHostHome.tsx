import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { Skill } from '../lib/selfhost-api'
import { listSkills } from '../lib/selfhost-api'

/**
 * Minimal self-hosted home page (no Convex dependency).
 * Shows latest skills list.
 */
export function SelfHostHome() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listSkills({ limit: 20, sort: 'updated' })
      .then((data) => setSkills(data.items))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <main style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto' }}>
        <h1>Loading...</h1>
      </main>
    )
  }

  return (
    <main style={{ padding: '40px 20px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: 16 }}>ClawHub (Self-Hosted)</h1>
        <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: 24 }}>
          Your private skill registry. Upload, version, and share AgentSkills.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/upload" search={{ updateSlug: undefined }} className="btn btn-primary">
            Publish a skill
          </Link>
          <Link to="/skills" search={{}} className="btn">
            Browse all skills
          </Link>
        </div>
      </div>

      <h2 style={{ fontSize: '1.8rem', marginBottom: 20 }}>Latest Skills</h2>
      {skills.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#f5f5f5', borderRadius: 8 }}>
          <p style={{ fontSize: '1.1rem', color: '#666' }}>
            No skills published yet. Be the first to{' '}
            <Link to="/upload" search={{ updateSlug: undefined }} style={{ color: '#0066cc' }}>
              publish a skill
            </Link>
            !
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {skills.map((skill) => (
            <div
              key={skill.slug}
              style={{
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: 20,
                background: '#fff',
              }}
            >
              <h3 style={{ margin: 0, marginBottom: 8 }}>
                <Link
                  to="/$owner/$slug"
                  params={{ owner: 'skill', slug: skill.slug }}
                  style={{ color: '#0066cc', textDecoration: 'none' }}
                >
                  {skill.displayName}
                </Link>
              </h3>
              {skill.summary && (
                <p style={{ margin: 0, marginBottom: 12, color: '#666', fontSize: '0.95rem' }}>
                  {skill.summary}
                </p>
              )}
              {skill.latestVersion && (
                <div style={{ fontSize: '0.85rem', color: '#999' }}>
                  v{skill.latestVersion.version} • {new Date(skill.updatedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
