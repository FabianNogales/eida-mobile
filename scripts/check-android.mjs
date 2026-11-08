// Manual, read-only inventory. Does not invoke Android tools or install anything.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
  (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : '')
console.log('Node:', process.version)
console.log('Android SDK:', sdk && existsSync(sdk) ? sdk : 'NO ENCONTRADO')
for (const part of ['platforms', 'build-tools', 'ndk', 'cmake']) {
  const path = sdk && join(sdk, part)
  console.log(part + ':', path && existsSync(path) ? readdirSync(path).join(', ') : 'no encontrado')
}
const java = process.env.JAVA_HOME && join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
console.log('JAVA_HOME:', process.env.JAVA_HOME || 'NO CONFIGURADO')
console.log('Ejecutable Java:', java && existsSync(java) ? 'encontrado; verificar versión manualmente' : 'no encontrado')
const adb = sdk && join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
console.log('ADB:', adb && existsSync(adb) ? 'encontrado; no ejecutado por este script' : 'no encontrado')
if (!sdk || !existsSync(sdk) || !java || !existsSync(java) || !adb || !existsSync(adb)) process.exitCode = 1
