/** Joins truthy class fragments. Intentionally minimal — no dedupe/merge,
 *  since these primitives compose their own classes deterministically. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
