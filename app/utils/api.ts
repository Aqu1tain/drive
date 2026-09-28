interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
}

/** `$fetch` with plain string URLs: keeps Nuxt's route-type inference out of dynamic paths. */
export function api<T = unknown>(url: string, options: ApiOptions = {}) {
  return $fetch<T>(url, options as Parameters<typeof $fetch>[1])
}
