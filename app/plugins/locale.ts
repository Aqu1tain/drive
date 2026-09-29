export default defineNuxtPlugin(() => {
  useHead({ htmlAttrs: { lang: useLocale() } })
})
