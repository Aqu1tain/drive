import { randomBytes } from 'node:crypto'

/** Strict CSP for app pages: every inline script Nuxt emits gets a per-response nonce, nothing else may run. */
export default defineNitroPlugin((nitro) => {
  if (import.meta.dev) return

  nitro.hooks.hook('render:response', (response, { event }) => {
    if (typeof response.body !== 'string' || !String(response.headers?.['content-type'] ?? 'text/html').includes('html')) return
    const nonce = randomBytes(16).toString('base64')
    response.body = response.body.replace(/<script(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`)
    const usercontent = new URL(useRuntimeConfig().public.usercontentUrl).origin
    response.headers = {
      ...response.headers,
      'content-security-policy': [
        `default-src 'self'`,
        `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: blob:`,
        `media-src 'self' blob:`,
        `font-src 'self' data:`,
        `connect-src 'self'`,
        `worker-src 'self' blob:`,
        `frame-src ${usercontent}`,
        `frame-ancestors 'none'`,
        `form-action 'self'`,
        `base-uri 'self'`,
        `object-src 'none'`,
      ].join('; '),
    }
    event.context.cspNonce = nonce
  })
})
