import type { H3Event } from 'h3'

export function isUsercontentHost(event: H3Event) {
  const { appUrl, usercontentUrl } = useRuntimeConfig().public
  const host = getRequestHost(event)
  const usercontentHost = new URL(usercontentUrl).host
  return host === usercontentHost && usercontentHost !== new URL(appUrl).host
}

export function appUrl(path = '') {
  return new URL(path, useRuntimeConfig().public.appUrl).toString()
}

export function usercontentUrl(path = '') {
  return new URL(path, useRuntimeConfig().public.usercontentUrl).toString()
}

/** Mutations must come from the app itself: blocks CSRF from other sites and from user content pages. */
export function assertSameOrigin(event: H3Event) {
  const origin = getRequestHeader(event, 'origin')
  if (origin && origin === new URL(useRuntimeConfig().public.appUrl).origin) return

  const fetchSite = getRequestHeader(event, 'sec-fetch-site')
  if (!origin && (fetchSite === 'same-origin' || fetchSite === undefined)) return

  throw createError({ statusCode: 403, statusMessage: 'Cross-origin request refused' })
}
