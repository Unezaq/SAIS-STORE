import { vi } from 'vitest'

/**
 * In-memory mock of the Supabase admin client for testing customer auth flows.
 * Simulates insert, select, update, delete, maybeSingle, single operations.
 */

type Row = Record<string, any>

interface MockQueryBuilder {
  tableName: string
  operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert'
  filters: Array<{ column: string; operator: string; value: any }>
  data: Row | Row[]
  options: any
  orderByColumn?: string
  orderByAscending?: boolean
  limitCount?: number
}

export class SupabaseMock {
  private tables: Map<string, Row[]> = new Map()
  private queries: MockQueryBuilder[] = []

  constructor(initialData?: Record<string, Row[]>) {
    if (initialData) {
      for (const [table, rows] of Object.entries(initialData)) {
        this.tables.set(table, [...rows])
      }
    }
  }

  /** Get a reference to a table (like supabase.from('table')) */
  from(tableName: string) {
    return {
      select: (columns = '*') => this.selectBuilder(tableName, columns),
      insert: (data: Row | Row[]) => this.insertBuilder(tableName, data),
      update: (data: Row) => this.updateBuilder(tableName, data),
      upsert: (data: Row | Row[], opts?: any) => this.upsertBuilder(tableName, data, opts),
      delete: () => this.deleteBuilder(tableName),
    }
  }

  private getTable(tableName: string): Row[] {
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, [])
    }
    return this.tables.get(tableName)!
  }

  private selectBuilder(tableName: string, columns: string) {
    const rows = this.getTable(tableName)
    let filtered = [...rows]
    let limitCount: number | undefined
    let orderCol: string | undefined
    let orderAsc: boolean | undefined

    const builder = {
      eq: (column: string, value: any) => {
        filtered = filtered.filter((row) => row[column] === value)
        return builder
      },
      neq: (column: string, value: any) => {
        filtered = filtered.filter((row) => row[column] !== value)
        return builder
      },
      is: (column: string, value: any) => {
        if (value === null) {
          filtered = filtered.filter((row) => row[column] === null)
        }
        return builder
      },
      gt: (column: string, value: any) => {
        filtered = filtered.filter((row) => (row[column] ?? 0) > value)
        return builder
      },
      maybeSingle: () => {
        return { data: filtered.length > 0 ? filtered[0] : null, error: null }
      },
      single: () => {
        return { data: filtered.length > 0 ? filtered[0] : null, error: filtered.length === 0 ? new Error('No rows') : null }
      },
      limit: (n: number) => {
        limitCount = n
        return builder
      },
      order: (column: string, opts?: { ascending?: boolean }) => {
        orderCol = column
        orderAsc = opts?.ascending ?? true
        return builder
      },
      then: async (resolve: (val: { data: Row | Row[] | null; error: any }) => void) => {
        let result = [...filtered]
        if (orderCol) {
          result.sort((a, b) => {
            const av = a[orderCol as string]
            const bv = b[orderCol as string]
            if (av < bv) return orderAsc ? -1 : 1
            if (av > bv) return orderAsc ? 1 : -1
            return 0
          })
        }
        if (limitCount) result = result.slice(0, limitCount)
        resolve({ data: result, error: null })
      },
    }
    return builder
  }

  private insertBuilder(tableName: string, data: Row | Row[]) {
    const rows = Array.isArray(data) ? data : [data]
    const table = this.getTable(tableName)
    const inserted: Row[] = rows.map((row) => ({
      ...row,
      id: row.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }))
    table.push(...inserted)
    return {
      select: () => ({
        single: () => ({ data: inserted.length === 1 ? inserted[0] : inserted, error: null }),
      }),
      then: async (resolve: (val: { data: Row | Row[] | null; error: any }) => void) => {
        resolve({ data: inserted, error: null })
      },
    }
  }

  private updateBuilder(tableName: string, data: Row) {
    const table = this.getTable(tableName)
    let filtered = [...table]
    let eqFilters: Array<{ column: string; value: any }> = []
    let isNullFilters: Array<string> = []

    const builder = {
      eq: (column: string, value: any) => {
        eqFilters.push({ column, value })
        return builder
      },
      is: (column: string, value: any) => {
        if (value === null) isNullFilters.push(column)
        return builder
      },
      select: () => ({
        single: () => {
          const matching = table.filter((row) => {
            return (
              eqFilters.every((f) => row[f.column] === f.value) &&
              isNullFilters.every((col) => row[col] === null)
            )
          })
          return { data: matching.length > 0 ? matching[0] : null, error: null }
        },
      }),
      then: async (resolve: (val: { data: Row | Row[] | null; error: any }) => void) => {
        const matchingIndices = table
          .map((row, i) => ({ row, i }))
          .filter(({ row }) =>
            eqFilters.every((f) => row[f.column] === f.value) &&
            isNullFilters.every((col) => row[col] === null)
          )

        for (const { i } of matchingIndices) {
          table[i] = { ...table[i], ...data }
        }

        resolve({
          data: matchingIndices.map(({ i }) => table[i]),
          error: null,
        })
      },
    }
    return builder
  }

  private upsertBuilder(tableName: string, data: Row | Row[], opts?: any) {
    const rows = Array.isArray(data) ? data : [data]
    const table = this.getTable(tableName)
    const onConflict = opts?.onConflict

    const upserted: Row[] = rows.map((row) => {
      if (onConflict) {
        const existing = table.find((r) => r[onConflict] === row[onConflict])
        if (existing) {
          Object.assign(existing, row)
          return existing
        }
      }
      const newRow = { ...row, id: row.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2)}` }
      table.push(newRow)
      return newRow
    })

    return {
      select: () => ({
        single: () => ({ data: upserted.length === 1 ? upserted[0] : upserted, error: null }),
      }),
      then: async (resolve: (val: { data: Row | Row[] | null; error: any }) => void) => {
        resolve({ data: upserted, error: null })
      },
    }
  }

  private deleteBuilder(tableName: string) {
    const table = this.getTable(tableName)
    let eqFilters: Array<{ column: string; value: any }> = []
    let isNullFilters: Array<string> = []

    const builder = {
      eq: (column: string, value: any) => {
        eqFilters.push({ column, value })
        return builder
      },
      is: (column: string, value: any) => {
        if (value === null) isNullFilters.push(column)
        return builder
      },
      then: async (resolve: (val: { data?: any; error: any }) => void) => {
        const toKeep = table.filter((row) => {
          return !(
            eqFilters.every((f) => row[f.column] === f.value) &&
            isNullFilters.every((col) => row[col] === null)
          )
        })
        const deletedCount = table.length - toKeep.length
        this.tables.set(tableName, toKeep)
        resolve({ data: [{ count: deletedCount }], error: null })
      },
    }
    return builder
  }

  /** RPC call simulation */
  rpc(funcName: string, params: any) {
    return {
      then: async (resolve: (val: { data: any[] | null; error: any }) => void) => {
        if (funcName === 'place_order_rpc') {
          let p_items = params.p_items
          if (typeof p_items === 'string') {
            try { p_items = JSON.parse(p_items) } catch { p_items = [] }
          }

          // Look up product prices from seeded data
          const products = this.getTable('products')
          let subtotal = 0
          let totalItems = 0
          if (Array.isArray(p_items)) {
            for (const item of p_items) {
              const product = products.find((p: any) => p.slug === item.slug)
              const price = product ? product.price : (item?.price || 100)
              subtotal += price * item.quantity
              totalItems += item.quantity
            }
          }

          // Look up delivery settings
          const settings = this.getTable('settings')
          const setting = settings[0] || { delivery_fee: 22, free_delivery_min_items: 0 }
          const deliveryFee =
            setting.free_delivery_min_items > 0 && totalItems >= setting.free_delivery_min_items
              ? 0
              : setting.delivery_fee

          const total = subtotal + deliveryFee
          resolve({ data: [{ order_id: 'ord-test-' + Math.random().toString(36).slice(2), order_number: 'SAIS-TEST', tracking_token: 'tok-test', subtotal, discount_total: 0, delivery_fee: deliveryFee, total, status: 'en_attente' }], error: null })
        } else {
          resolve({ data: null, error: new Error(`Unknown RPC: ${funcName}`) })
        }
      },
    }
  }

  /** Reset all mock data */
  reset() {
    this.tables.clear()
  }

  /** Get raw table data for assertions */
  getTableData(tableName: string): Row[] {
    return this.getTable(tableName)
  }
}

export const supabaseMock = new SupabaseMock()
