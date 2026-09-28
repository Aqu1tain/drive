import { randomUUID } from 'node:crypto'

/** Public pages are server-rendered: the pseudonymous visitor id must exist before the page fetches its data. */
export default defineEventHandler((event) => {
  if (!event.path.startsWith('/s/') || getCookie(event, 'drive_vid')) return
  const id = randomUUID()
  setCookie(event, 'drive_vid', id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: useRuntimeConfig().public.appUrl.startsWith('https://'),
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  const cookie = event.node.req.headers.cookie
  event.node.req.headers.cookie = cookie ? `${cookie}; drive_vid=${id}` : `drive_vid=${id}`
})
