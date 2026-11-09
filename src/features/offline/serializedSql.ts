import type { SqlPort } from './repository'

type Value = string | number | null | Uint8Array
type Scalar = string | number | null
export type RawSqlPort = Pick<SqlPort, 'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'closeAsync'>

/**
 * All access on ONE keyed connection. Expo's withExclusiveTransactionAsync opens
 * another connection without the SQLCipher key / foreign_keys / temp_store.
 * A private queue prevents unrelated async queries from joining our transactions.
 */
export class SerializedSql implements SqlPort {
  private tail: Promise<unknown> = Promise.resolve()
  private closing = false
  private closed: Promise<void> | null = null
  constructor(private raw: RawSqlPort, private check: () => void = () => {}) {}
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new Error('El almacén local se está bloqueando.'))
    const result = this.tail.catch(() => {}).then(() => { this.check(); return task() })
    this.tail = result
    return result
  }
  execAsync(sql: string) { return this.enqueue(() => this.raw.execAsync(sql)) }
  runAsync(sql: string, ...params: Value[]) { return this.enqueue(() => this.raw.runAsync(sql, ...params)) }
  getFirstAsync<T>(sql: string, ...params: Scalar[]) { return this.enqueue(() => this.raw.getFirstAsync<T>(sql, ...params)) }
  getAllAsync<T>(sql: string, ...params: Scalar[]) { return this.enqueue(() => this.raw.getAllAsync<T>(sql, ...params)) }
  transactionAsync(action: (tx: SqlPort) => Promise<void>): Promise<void> {
    return this.enqueue(async () => {
      // Direct transaction view; enqueueing inside the current task would deadlock.
      const checked = <T>(task: () => Promise<T>) => { this.check(); return task() }
      const tx: SqlPort = {
        execAsync: (sql) => checked(() => this.raw.execAsync(sql)),
        runAsync: (sql, ...params) => checked(() => this.raw.runAsync(sql, ...params)),
        getFirstAsync: <T>(sql: string, ...params: Scalar[]) => checked(() => this.raw.getFirstAsync<T>(sql, ...params)),
        getAllAsync: <T>(sql: string, ...params: Scalar[]) => checked(() => this.raw.getAllAsync<T>(sql, ...params)),
        transactionAsync: async () => { throw new Error('No se permiten transacciones locales anidadas.') },
        closeAsync: async () => { throw new Error('La conexión se cierra fuera de la transacción.') },
      }
      await this.raw.execAsync('BEGIN IMMEDIATE')
      try {
        await action(tx)
        this.check() // A logout/background during the transaction forces rollback.
        await this.raw.execAsync('COMMIT')
      } catch (error) {
        await this.raw.execAsync('ROLLBACK')
        throw error
      }
    })
  }
  closeAsync(): Promise<void> {
    if (this.closed) return this.closed
    this.closing = true
    // Do not close a handle while native queries or rollback are still running.
    this.closed = this.tail.catch(() => {}).then(() => this.raw.closeAsync())
    return this.closed
  }
}
