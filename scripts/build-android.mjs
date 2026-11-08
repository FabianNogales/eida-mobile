// Manual helper only. No lifecycle hook invokes this script.
// Uses the user's existing toolchain and the real project path.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({ options: {
  variant: { type: 'string', default: 'debug' },
  architectures: { type: 'string', default: 'arm64-v8a,x86_64' },
} })
const { variant, architectures } = values
if (!['debug', 'release'].includes(variant) || !/^(arm64-v8a|x86_64)(,(arm64-v8a|x86_64))*$/.test(architectures)) {
  throw new Error('Usa --variant debug|release y --architectures arm64-v8a,x86_64')
}
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
if (!sdk || !existsSync(sdk)) throw new Error('Configura ANDROID_HOME manualmente. Consulta docs/EIDA_CONTROL_FASE_2_EXPO_QR.md.')
const javaHome = process.env.JAVA_HOME
const java = javaHome && join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
if (!java || !existsSync(java)) throw new Error('Configura JAVA_HOME manualmente con un JDK compatible.')
const android = join(root, 'android')
const wrapper = join(android, 'gradle/wrapper/gradle-wrapper.jar')
if (!existsSync(wrapper)) throw new Error('Falta android/. El usuario debe ejecutar npm run prebuild manualmente.')
const task = variant === 'debug' ? ':app:assembleDebug' : ':app:assembleRelease'

console.log('Compilación solicitada manualmente:', task, architectures)
const built = spawnSync(java, ['-jar', wrapper, '-p', android, task,
  '-PreactNativeArchitectures=' + architectures, '--no-daemon', '--max-workers=2',
  '-Dorg.gradle.parallel=false', '-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=384m',
  // A missing SDK component is a manual setup task, not an automatic install.
  '-Pandroid.builder.sdkDownload=false',
  '-Pandroid.enableMinifyInReleaseBuilds=false', '--console=plain'], {
  cwd: root, stdio: 'inherit', windowsHide: true,
})
if (built.error) throw built.error
if (built.status !== 0) {
  console.error('Compilación fallida. No se copió un APK de esta ejecución.')
  process.exitCode = built.status || 1
} else {
  const source = join(android, 'app/build/outputs/apk', variant, 'app-' + variant + '.apk')
  if (!existsSync(source)) throw new Error('Gradle terminó sin el archivo APK esperado.')
  const directory = join(root, '.artifacts/apk')
  mkdirSync(directory, { recursive: true })
  const output = join(directory, 'eida-control-' + variant + '-' + architectures.replaceAll(',', '_') + '.apk')
  copyFileSync(source, output)
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  writeFileSync(output + '.json', JSON.stringify({ generatedAt: new Date().toISOString(),
    variant, architectures, applicationId: 'bo.eida.control.dev',
    signing: 'development test key, not production', dependencies: manifest.dependencies }, null, 2) + '\n')
  console.log('APK generado:', output)
}
