type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export function deepMergeMessages(base: Json, overlay: Json): Json {
  if (overlay === undefined || overlay === null) return base
  if (typeof overlay !== 'object' || Array.isArray(overlay)) return overlay
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return overlay

  const out: { [key: string]: Json } = { ...(base as Record<string, Json>) }
  for (const key of Object.keys(overlay)) {
    const b = (base as Record<string, Json>)[key]
    const o = (overlay as Record<string, Json>)[key]
    out[key] = deepMergeMessages(b, o)
  }
  return out
}
