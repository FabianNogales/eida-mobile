import type { PackageRecord } from '../../features/offline/contracts'
import { packageActions } from '../../ui/controlScreens'
import { examHeading } from '../../ui/examPresentation'
import { laPazInstant } from '../../utils/dates'
import { ActionButton } from '../ActionButton'
import { AppText } from '../AppText'
import { Card } from '../Card'
import { Notice } from '../Notice'
import { PreparationStatus } from './PreparationStatus'

export function PackageCard({ record: p, online, busy, onOpen, onResume, onRevalidate }: {
  record: PackageRecord; online: boolean; busy: boolean; onOpen(): void; onResume(): void; onRevalidate(): void
}) {
  const actions = packageActions(p, true, online)
  const heading = examHeading(p.manifest.exam)
  return <Card>
    <AppText variant="subtitle" accessibilityRole="header">{heading.title}</AppText>
    {heading.subtitle && <AppText>{heading.subtitle}</AppText>}
    <PreparationStatus state={p.state} active={p.active} />
    <AppText>{p.manifest.exam.room?.name ?? 'Ambiente no informado'} · Lista {p.manifest.list_id}</AppText>
    <AppText>{p.manifest.students.length} estudiantes en esta copia</AppText>
    <AppText>Preparada: {laPazInstant(p.manifest.prepared_at)}</AppText>
    <AppText>Disponible hasta: {laPazInstant(p.manifest.expires_at)}</AppText>
    {p.error && <Notice tone="error" message={p.error} />}
    {actions.open && <ActionButton label="Abrir mi lista" disabled={busy} onPress={onOpen} />}
    {actions.resume && <ActionButton secondary label="Reanudar descarga con internet" busy={busy} onPress={onResume} />}
    {actions.revalidate && <ActionButton secondary label="Actualizar copia" busy={busy} onPress={onRevalidate} />}
    {!online && <AppText>Para descargar o actualizar, conéctate con la misma cuenta.</AppText>}
    <AppText variant="caption">Los ingresos quedan pendientes hasta que los envíes desde Pendientes.</AppText>
  </Card>
}
