import { ConfirmDialog } from '../ConfirmDialog'

export function FormExitDialog({ exit }: { exit: { visible: boolean; cancel(): void; confirm(): void } }) {
  return <ConfirmDialog visible={exit.visible} title="¿Descartar cambios sin guardar?"
    message="Puedes cancelar para seguir editando. Descartar solo cierra los cambios de este formulario; no elimina eventos, reportes ni borradores ya guardados."
    confirmLabel="Descartar y volver" destructive onCancel={exit.cancel} onConfirm={exit.confirm} />
}
