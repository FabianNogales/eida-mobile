import { useMemo } from 'react'
import type { PackageRecord } from '../../features/offline/contracts'
import { manifestPhotoSummary, packageActions } from '../../ui/controlScreens'
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
  const photos = useMemo(() => manifestPhotoSummary(p.manifest), [p.manifest])
  return <Card>
    <AppText variant="subtitle" accessibilityRole="header">{p.manifest.exam.name}</AppText>
    <PreparationStatus state={p.state} active={p.active} />
    <AppText>{p.manifest.exam.room?.name ?? 'Ambiente no informado'} · Lista {p.manifest.list_id}</AppText>
    <AppText>{p.manifest.students.length} estudiantes {actions.open ? 'en la copia publicada' : 'en el manifiesto; preparación pendiente de validar'}</AppText>
    <AppText>Distribución v{p.manifest.version}</AppText>
    <AppText>Preparación conocida: {laPazInstant(p.manifest.prepared_at)}</AppText>
    <AppText>Vigencia: {laPazInstant(p.manifest.expires_at)}</AppText>
    <AppText>{photos.present} fotografías {actions.open ? 'verificadas al publicar' : 'previstas por descargar/verificar'} · {photos.absent} ausencias informadas</AppText>
    {p.error && <Notice tone="error" message={p.error} />}
    {actions.open && <ActionButton label="Abrir mi lista" disabled={busy} onPress={onOpen} />}
    {actions.resume && <ActionButton secondary label="Reanudar descarga con internet" busy={busy} onPress={onResume} />}
    {actions.revalidate && <ActionButton secondary label="Revalidar copia con internet" busy={busy} onPress={onRevalidate} />}
    {!online && <AppText>Descargar o revalidar requiere una sesión válida de la cuenta original con internet.</AppText>}
    <AppText variant="caption">La apertura comprueba vigencia, autorización y referencia horaria. El registro offline es provisional hasta recibir respuesta del servidor.</AppText>
  </Card>
}
