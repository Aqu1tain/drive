import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'

/** MCP over Streamable HTTP, stateless: each request gets its own server, bound to the access token's owner. */
export default defineEventHandler(async (event) => {
  const resource = mcpResource()
  if (!resource) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

  const viewer = await authenticateMcp(event, resource)
  if (!viewer) {
    setResponseStatus(event, 401)
    setResponseHeader(event, 'WWW-Authenticate', mcpChallenge(getRequestHeader(event, 'authorization') ? 'invalid_token' : undefined))
    return { jsonrpc: '2.0', error: { code: -32001, message: 'Authentication required' }, id: null }
  }
  if (event.method !== 'POST') {
    setResponseHeader(event, 'Allow', 'POST')
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  const server = createMcpServer(event, viewer)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    return await transport.handleRequest(toWebRequest(event))
  }
  finally {
    await server.close()
  }
})
