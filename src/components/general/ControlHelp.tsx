import { AppText } from '../AppText'
import { Card } from '../Card'

const sections = [
  { title: '1. Prepara tu lista con internet',
    text: 'En Mis exámenes, abre el examen asignado y entra en Preparar mi lista. Pulsa Preparar lista y espera hasta ver Lista preparada. Si colaboras en un examen, descarga solo tu lista asignada.' },
  { title: '2. Controla ingresos sin internet',
    text: 'Abre una lista preparada y pulsa Controlar ingreso. Escanea el QR o busca al estudiante. Comprueba su identidad y confirma una sola vez. El registro queda guardado en el celular hasta que lo envíes.' },
  { title: '3. Envía los pendientes',
    text: 'Cuando tengas internet, abre Pendientes y envía los ingresos y reportes. Espera el resultado y revisa los que necesiten atención. No borres los datos de la app ni cierres sesión para intentar sincronizar.' },
  { title: '4. Si cambió la distribución',
    text: 'La copia anterior ya no sirve para nuevos ingresos. Conéctate, abre el examen y pulsa Actualizar copia. Si eres colaborador y el cambio aún no está listo, avisa al docente responsable y vuelve a actualizar después. Tus registros pendientes se conservan.' },
  { title: '5. Problemas frecuentes',
    text: '¿No aparece el examen? Conéctate y actualiza Mis exámenes o Mis colaboraciones; pide al docente que compruebe tu asignación. ¿La descarga quedó incompleta o venció? Vuelve a prepararla con internet. ¿El QR no se lee? Busca al estudiante por nombre o código. ¿No está en tu lista? Consulta al responsable; no uses la lista de otra persona.' },
] as const

export function ControlHelp() {
  return <>{sections.map((section) => <Card key={section.title}>
    <AppText variant="subtitle" accessibilityRole="header">{section.title}</AppText>
    <AppText>{section.text}</AppText>
  </Card>)}</>
}
