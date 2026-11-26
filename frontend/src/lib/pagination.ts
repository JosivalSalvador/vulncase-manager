// Formato das listas paginadas do back.
export type Paginated<T> = {
  data: T[]
  meta: { page: number; pageSize: number; total: number; totalPages: number }
}
