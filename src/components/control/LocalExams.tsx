import { useRouter } from 'expo-router'
import { useOffline } from '../../features/offline/OfflineProvider'
import { localExamDestination } from '../../ui/controlScreens'
import { examHeading } from '../../ui/examPresentation'
import { AppText } from '../AppText'
import { EmptyState } from '../FeedbackStates'
import { ExamActionRow } from '../general/ExamActionRow'

export function LocalExams() {
  const { usablePackages, runtime } = useOffline()
  const router = useRouter()
  if (!runtime) return null

  return <>
    <AppText variant="subtitle" accessibilityRole="header">Exámenes descargados</AppText>
    {usablePackages.length === 0 && <EmptyState title="Sin listas locales vigentes"
      message="Consulta tus exámenes con conexión para preparar una lista." />}
    {usablePackages.map((copy) => {
      const heading = examHeading(copy.manifest.exam)
      return <ExamActionRow key={copy.id} card icon="calendar" label={heading.title}
        hint={heading.subtitle ?? undefined} onPress={() => router.push(localExamDestination(copy.examId))} />
    })}
  </>
}
