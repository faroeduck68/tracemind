export type PageResult<T> = {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type PaginationOptions = {
  page: number
  pageSize: number
  offset: number
}

export function paginateIfRequested<T>(items: T[], query: Record<string, unknown>, defaultPageSize = 10) {
  const pagination = readPagination(query, defaultPageSize)
  if (!pagination) return items

  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize))
  const safePage = Math.min(pagination.page, totalPages)
  const offset = (safePage - 1) * pagination.pageSize

  return pageResult(items.slice(offset, offset + pagination.pageSize), total, {
    ...pagination,
    page: safePage,
    offset
  })
}

export function readPagination(query: Record<string, unknown>, defaultPageSize = 10): PaginationOptions | null {
  if (query.page == null && query.pageSize == null) return null
  const page = clampPositiveInteger(query.page, 1, 1, Number.MAX_SAFE_INTEGER)
  const pageSize = clampPositiveInteger(query.pageSize, defaultPageSize, 1, 100)
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  }
}

export function pageResult<T>(list: T[], total: number, pagination: PaginationOptions): PageResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize))
  const page = Math.min(pagination.page, totalPages)
  return {
    list,
    total,
    page,
    pageSize: pagination.pageSize,
    totalPages
  }
}

export function mapPageResult<T, U>(result: PageResult<T>, mapper: (item: T) => U): PageResult<U> {
  return {
    ...result,
    list: result.list.map(mapper)
  }
}

function clampPositiveInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}
