export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  return { user, emailEnabled: canSendEmail() }
})
