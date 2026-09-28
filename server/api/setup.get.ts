export default defineEventHandler(async () => ({
  needed: !(await ownerExists()),
  tokenRequired: !!useRuntimeConfig().setupToken,
}))
