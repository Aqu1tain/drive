export default defineTask({
  meta: { name: 'uploads:sweep', description: 'Abort multipart uploads left idle for a day' },
  async run() {
    await sweepSessions()
    return { result: 'ok' }
  },
})
