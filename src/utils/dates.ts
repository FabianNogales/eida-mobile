export function instant(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN
  // Carbon emits microseconds; truncate to JS milliseconds without losing TZ.
  return Date.parse(value.replace(/\.(\d{3})\d+(Z|[+-]\d{2}:\d{2})$/, '.$1$2'))
}

export function examDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

export function laPazInstant(value: string): string {
  const time = instant(value)
  return Number.isFinite(time) ? new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz', dateStyle: 'short', timeStyle: 'short',
  }).format(time) : 'Fecha no disponible'
}
