// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  runtimeConfig: {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    userChatId: process.env.USER_CHAT_ID,
    pantheonApiKey: process.env.PANTHEON_API_KEY,
    vaultPath: process.env.VAULT_PATH,
    githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    groqApi: process.env.GROQ_API,
    googleApi: process.env.GOOGLE_AI_API_KEY,
    telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  },
  nitro: {
    esbuild: {
      options: {
        target: 'esnext'
      }
    },
    // Native modules must be externalized — they can't be bundled by Rollup
    // because they use `bindings` to find .node files and `dlopen` for native addons
    externals: {
      external: ['better-sqlite3', 'bindings', 'file-uri-to-path']
    }
  }
})

