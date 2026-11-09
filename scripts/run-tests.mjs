// Manual execution only: npm test. Uses the existing local tsx; never installs it.
import { spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const testsRoot = join(projectRoot, 'tests')

/** @param {string} directory @returns {Promise<string[]>} */
async function discoverTests(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await discoverTests(path))
    else if (entry.isFile() && entry.name.endsWith('.test.ts')) files.push(path)
    // Do not follow symbolic links or junctions outside the tests directory.
  }
  return files.sort()
}

try {
  const files = await discoverTests(testsRoot)
  if (files.length === 0) throw new Error(`No se encontraron archivos .test.ts en ${testsRoot}. No se ejecutaron pruebas.`)
  const require = createRequire(import.meta.url)
  const cli = require.resolve('tsx/cli')
  console.log(`Archivos de prueba descubiertos: ${files.length}`)
  const result = spawnSync(process.execPath, [cli, '--test', ...process.argv.slice(2), ...files], {
    cwd: projectRoot, stdio: 'inherit', shell: false,
  })
  if (result.error) throw result.error
  if (result.signal) throw new Error(`La ejecución de pruebas fue interrumpida (${result.signal}).`)
  process.exitCode = result.status ?? 1
} catch (error) {
  console.error('No se pudo completar la ejecución de pruebas:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
