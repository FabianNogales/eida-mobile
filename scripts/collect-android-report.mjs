import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serial = process.argv[2]
if (!serial || !/^[A-Za-z0-9_.:-]+$/.test(serial)) throw new Error('Indica un dispositivo: node scripts/collect-android-report.mjs emulator-5554')
// Optional manual reader, never invoked by the application or lifecycle hooks.
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
if (!sdk) throw new Error('Configura ANDROID_HOME manualmente antes de recoger el informe.')
const adb = join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
if (!existsSync(adb)) throw new Error('No se encuentra ADB en el SDK indicado. No se instalará automáticamente.')
const run = (...args) => execFileSync(adb, ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 })
const logs = run('logcat', '-d', '-v', 'brief', 'ReactNativeJS:I', '*:S')
const groups = new Map()
for (const line of logs.split(/\r?\n/)) {
  const match = line.match(/EIDA_QR_DIAGNOSTIC_REPORT (\S+) (\d+)\/(\d+) (.*)$/)
  if (!match) continue
  const [, time, index, count, fragment] = match
  if (Number(count) < 1 || Number(count) > 100 || Number(index) < 1 || Number(index) > Number(count)) continue
  if (!groups.has(time)) groups.set(time, { count: Number(count), parts: new Map() })
  if (groups.get(time).count !== Number(count)) throw new Error('El informe contiene fragmentos inconsistentes.')
  groups.get(time).parts.set(Number(index), fragment)
}
const latest = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).at(-1)
if (!latest || latest[1].parts.size !== latest[1].count) throw new Error('El informe más reciente no está completo. Ejecuta los vectores dentro de la APK Android.')
const [, group] = latest
const report = JSON.parse(Array.from({ length: group.count }, (_, i) => group.parts.get(i + 1)).join(''))
const fixtures = ['php-vectors', 'supplemental-vectors'].map(name => JSON.parse(readFileSync(join(root, 'src/features/qr/fixtures', name + '.json'), 'utf8')))
const expected = fixtures.flatMap(f => f.cases.map(v => ({ name: v.name, expected: v.valid ? 'VALID' : v.reason })))
const fixtureHash = createHash('sha256').update(readFileSync(join(root, 'src/features/qr/fixtures/php-vectors.json'))).digest('hex').toUpperCase()
const api = run('shell', 'getprop', 'ro.build.version.sdk').trim()
const matches = report.platform === 'android' && report.androidApi === api && report.originalFixtureSha256 === fixtureHash &&
  typeof report.provider === 'string' && report.provider.includes('react-native-quick-crypto') &&
  Array.isArray(report.results) && report.results.length === expected.length && expected.every((v, i) =>
    report.results[i].name === v.name && report.results[i].expected === v.expected &&
    report.results[i].actual === v.expected && report.results[i].passed === true)
const evidence = {
  capturedAt: new Date().toISOString(), serial,
  device: run('shell', 'getprop', 'ro.product.model').trim(),
  api,
  allExpectedResults: matches, report,
}
const directory = join(root, '.artifacts/android')
mkdirSync(directory, { recursive: true })
const output = join(directory, 'qr-v3-report.json')
writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n')
console.log(output, matches ? 'TODOS LOS VECTORES CONFORMES' : 'RESULTADOS NO CONFORMES')
console.log('Fecha real de ejecución registrada por la app:', report.executedAt)
if (!matches) process.exitCode = 1
