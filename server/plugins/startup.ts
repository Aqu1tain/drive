export default defineNitroPlugin(() => {
  if (import.meta.prerender) return
  whenReady().catch((error) => {
    console.error(JSON.stringify({ level: 'error', job: 'startup', error: String(error) }))
    process.exit(1)
  })
})
