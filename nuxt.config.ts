// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase', '@pinia/nuxt'],
  // Poketbro handles the sign-in itself (the sign-in screen before the title), so the module must not redirect to a login page.
  supabase: { redirect: false },
  routeRules: {
    // The start page is the game.
    '/': { redirect: '/nudge' },
    // The game is a pure client-side SPA (canvas + localStorage), no SSR needed.
    '/nudge': { ssr: false },
    '/nudge/**': { ssr: false },
  },
})
