import { protocolError } from './errors'

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw protocolError()
  return value as Record<string, unknown>
}
export function text(value: unknown): string { if (typeof value !== 'string') throw protocolError(); return value }
export function integer(value: unknown, minimum = 1): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw protocolError()
  return value
}
export function boolean(value: unknown): boolean { if (typeof value !== 'boolean') throw protocolError(); return value }
export function nullableText(value: unknown): string | null { return value === null ? null : text(value) }
export function array<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw protocolError()
  return value.map(parse)
}
