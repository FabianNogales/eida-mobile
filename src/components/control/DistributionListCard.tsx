import type { DistributionContext } from '../../features/offline/contracts'
import { AppText } from '../AppText'
import { Card } from '../Card'
import { StatusBadge } from '../StatusBadge'

export function DistributionListCard({ list, own }: { list: DistributionContext['lists'][number]; own: boolean }) {
  return <Card>
    <StatusBadge label={own ? 'Mi lista asignada' : 'Supervisión · sin acceso a estudiantes'} tone={own ? 'info' : 'neutral'} />
    <AppText variant="subtitle" accessibilityRole="header">{list.responsible_name ?? 'Responsable no informado'}</AppText>
    <AppText>Lista {list.list_id} · {list.student_count} estudiantes</AppText>
    <AppText>Apellidos: {list.surname_range.from ?? 'Inicio no informado'} a {list.surname_range.to ?? 'Fin no informado'}</AppText>
  </Card>
}
