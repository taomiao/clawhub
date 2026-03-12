import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { convex } from '../convex/client'
import { UserBootstrap } from './UserBootstrap'

const isSelfHosted = !import.meta.env.VITE_CONVEX_URL || import.meta.env.VITE_SELFHOST_MODE === 'true'

export function AppProviders({ children }: { children: React.ReactNode }) {
  // In self-hosted mode, skip Convex providers
  if (isSelfHosted) {
    return <>{children}</>
  }

  return (
    <ConvexAuthProvider
      client={convex}
      replaceURL={(relativeUrl) => {
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', relativeUrl)
        }
      }}
    >
      <UserBootstrap />
      {children}
    </ConvexAuthProvider>
  )
}
