/** The authorization server sends people here to sign in: the usual login page then takes them to the consent step. */
export default defineEventHandler((event) => {
  const consent = `/oauth/consent${getRequestURL(event).search}`
  return sendRedirect(event, `/login?redirect=${encodeURIComponent(consent)}`)
})
