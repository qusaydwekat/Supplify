import { http, HttpResponse } from 'msw'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://test.supabase.co'

/** Default REST stubs; override per test with server.use(). */
export const supabaseHandlers = [
  http.get(`${supabaseUrl}/rest/v1/*`, () => HttpResponse.json([])),
  http.post(`${supabaseUrl}/rest/v1/*`, () => HttpResponse.json({})),
  http.patch(`${supabaseUrl}/rest/v1/*`, () => HttpResponse.json({})),
  http.delete(`${supabaseUrl}/rest/v1/*`, () => HttpResponse.json({})),
]
