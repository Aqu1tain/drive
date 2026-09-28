import { createAuthClient } from 'better-auth/vue'
import { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins'
import { passkeyClient } from '@better-auth/passkey/client'

export const authClient = createAuthClient({
  plugins: [passkeyClient(), twoFactorClient(), emailOTPClient()],
})
