import { registerSW } from 'virtual:pwa-register'

// Service worker auto-update (тихо).
registerSW({
  immediate: true,
})

