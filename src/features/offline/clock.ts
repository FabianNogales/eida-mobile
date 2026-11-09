import type { ClockSample, TimeAnchor } from './contracts'

export interface OfflineClock { sample(): Promise<ClockSample> }
export function anchoredNow(anchor: TimeAnchor, sample: ClockSample): number {
  if (!Number.isFinite(anchor.serverMs) || !Number.isFinite(sample.elapsed) || !Number.isFinite(anchor.elapsed) ||
      anchor.elapsed < 0 || sample.elapsed < anchor.elapsed || sample.boot !== anchor.boot) {
    throw new Error('El teléfono se reinició o perdió la referencia horaria. Revalida el paquete con internet.')
  }
  return anchor.serverMs + sample.elapsed - anchor.elapsed
}
export const nativeClock: OfflineClock = {
  async sample() {
    let result: ClockSample
    try {
      const { requireNativeModule } = await import('expo')
      const native = requireNativeModule<{ sample(): Promise<ClockSample> }>('EidaOfflineClock')
      result = await native.sample()
    } catch {
      throw new Error('Reloj nativo no disponible. Necesitas una nueva development build con EidaOfflineClock.')
    }
    if (!result.boot || !Number.isFinite(result.elapsed) || result.elapsed < 0) throw new Error('Reloj nativo no disponible. Necesitas una nueva development build.')
    return result
  },
}
