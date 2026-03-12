import { ConvexReactClient } from 'convex/react'

// In self-hosted mode, skip Convex client initialization
const isSelfHosted = !import.meta.env.VITE_CONVEX_URL || import.meta.env.VITE_SELFHOST_MODE === 'true'

export const convex = isSelfHosted
  ? (null as any) // Placeholder; self-hosted mode doesn't use Convex
  : new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)
