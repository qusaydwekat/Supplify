import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { AUTH_HEADER_USER_ID, AUTH_HEADER_USER_ROLE } from '@/lib/auth/request-session'

export type MiddlewareSession = {
  response: NextResponse
  user: User | null
  role: string | null
}

/**
 * Refreshes the Supabase session cookie and loads the app role in a single pass
 * (one getUser + optional users lookup). Avoid calling getUser() again in layouts.
 */
export async function resolveMiddlewareSession(request: NextRequest): Promise<MiddlewareSession> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return { response: NextResponse.next({ request }), user: null, role: null }
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: string | null = null
  if (user) {
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
    role = userRow?.role ?? null
  }

  if (user) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(AUTH_HEADER_USER_ID, user.id)
    if (role) requestHeaders.set(AUTH_HEADER_USER_ROLE, role)

    const nextResponse = NextResponse.next({
      request: { headers: requestHeaders },
    })
    response.cookies.getAll().forEach((cookie) => {
      nextResponse.cookies.set(cookie)
    })
    response = nextResponse
  }

  return { response, user, role }
}

/** @deprecated Use resolveMiddlewareSession — kept for compatibility. */
export async function updateSupabaseSession(request: NextRequest) {
  const { response } = await resolveMiddlewareSession(request)
  return response
}
