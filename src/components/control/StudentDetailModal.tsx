import { Modal, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { theme } from '../../config/theme'
import type { OfflineStudent, ProvisionalEvent } from '../../features/offline/contracts'
import type { SyncItem } from '../../features/offline/sync/contracts'
import { manualAvailability, studentEntryLabel } from '../../ui/controlScreens'
import { ActionButton } from '../ActionButton'
import { AppText } from '../AppText'
import { Notice } from '../Notice'
import { Screen } from '../Screen'
import { StatusBadge } from '../StatusBadge'
import { TextAction } from '../general/TextAction'
import { AdditionalPhotos, EntryFacts, EntryResult, EntryReview, StudentIdentity, type StudentPhotos } from './EntryReview'

export type StudentStep = 'student' | 'review' | 'result'

export function StudentDetailModal({ student, exam, photos, event, item, step, busy, error, canRecord, method,
  onClose, onBack, onReview, onConfirm, onIncident }: {
  student: OfflineStudent; exam: string; photos: StudentPhotos; event: ProvisionalEvent | null; item?: SyncItem
  step: StudentStep; busy: boolean; error: string | null; canRecord: boolean; method: 'MANUAL' | 'QR'
  onClose(): void; onBack(): void; onReview(): void; onConfirm(): void; onIncident(): void
}) {
  const manual = manualAvailability(student, event !== null || !!item)
  const goBack = () => { if (!busy) onBack() }
  return <Modal visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={goBack}>
    <SafeAreaProvider><Screen header="none" bottomOwnedByNavigator={false}>
      <View accessibilityViewIsModal onAccessibilityEscape={goBack} style={s.content}>
        <AppText variant="subtitle" accessibilityRole="header">{step === 'review' ? 'Revisar ingreso' : step === 'result' ? 'Resultado del ingreso' : 'Ficha del estudiante'}</AppText>
        {step === 'result' && event ? <EntryResult event={event} item={item} error={error} onContinue={onClose} />
          : step === 'review' ? <EntryReview student={student} photos={photos} exam={exam} method={method}
            busy={busy} error={error} canConfirm={canRecord && manual.allowed} onConfirm={onConfirm} onCancel={onClose} />
          : <>
            <StudentIdentity student={student} photos={photos} />
            <EntryFacts exam={exam} document={student.identity_number} />
            {!event && <StatusBadge {...studentEntryLabel(student, item)} />}
            <AdditionalPhotos photos={photos} />
            {error && <Notice tone="error" message={error} />}
            {manual.allowed && canRecord ? <ActionButton label="Verificar ingreso" busy={busy} onPress={onReview} />
              : !event && !item && <Notice message={manual.reason ?? 'El control de ingreso todavía no está disponible.'} />}
            {event && <EntryResult event={event} item={item} duplicate onContinue={onClose} />}
            <TextAction label="Reportar incidencia" disabled={busy} onPress={onIncident} />
            {!event && <TextAction label="Volver a la lista" disabled={busy} onPress={onClose} />}
          </>}
      </View>
    </Screen></SafeAreaProvider>
  </Modal>
}

const s = StyleSheet.create({ content: { gap: theme.spacing.lg } })
