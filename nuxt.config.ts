// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase', '@pinia/nuxt'],
  // Poketbro handles the sign-in itself (the sign-in screen before the title), so the module must not redirect to a login page.
  supabase: { redirect: false },
  runtimeConfig: {
    // Keep the Supabase secret/service keys out of the build output: leave them empty at build time and let
    // Nitro fill them at runtime from NUXT_SUPABASE_SECRET_KEY / NUXT_SUPABASE_SERVICE_KEY.
    supabase: { secretKey: '', serviceKey: '' },
  },
  routeRules: {
    // The start page is the game.
    '/': { redirect: '/nudge' },
    // The game is a pure client-side SPA (canvas + localStorage), no SSR needed.
    '/nudge': { ssr: false },
    '/nudge/**': { ssr: false },
  },
})
