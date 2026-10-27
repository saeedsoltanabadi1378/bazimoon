import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.bazimoon.app',
  appName: 'Bazimoon',
  webDir: 'dist',
  // Keep the installed app on the production origin so authentication, API
  // credentials, deep links and the existing PWA service worker behave exactly
  // as they do at bazimoon.com.
  server: {
    url: 'https://bazimoon.com',
    cleartext: false,
  },
}

export default config
