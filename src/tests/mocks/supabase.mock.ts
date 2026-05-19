import { vi } from 'vitest'

type QueryResult = { data: unknown; error: unknown; count?: number | null }

/** Chainable Supabase query builder mock for server action tests. */
export function createSupabaseQueryMock(
  terminal: () => Promise<QueryResult> | QueryResult,
  overrides: Record<string, unknown> = {},
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    range: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    rpc: vi.fn(),
  }

  for (const key of Object.keys(chain)) {
    chain[key].mockReturnValue(chain)
  }

  const resolve = () => Promise.resolve(typeof terminal === 'function' ? terminal() : terminal)

  chain.single.mockImplementation(resolve)
  chain.maybeSingle.mockImplementation(resolve)
  ;(chain as { then?: unknown }).then = (resolve: (v: QueryResult) => void) => resolve(resolve())

  return { ...chain, ...overrides }
}

export function createAuthMock(user: { id: string } | null = null) {
  return {
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }
}
