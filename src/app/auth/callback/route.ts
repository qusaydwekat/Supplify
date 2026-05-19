import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

function safeNextPath(raw: string | null): string {
  if (!raw) return '/'
  try {
    const decoded = decodeURIComponent(raw.trim())
    if (!decoded.startsWith('/')) return '/'
    if (decoded.startsWith('//')) return '/'
    if (decoded.includes('://')) return '/'
    return decoded || '/'
  } catch {
    return '/'
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNextPath(url.searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(new URL('/login', url.origin))
  }

  const supabase = supabaseServer()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(new URL('/login', url.origin))
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
