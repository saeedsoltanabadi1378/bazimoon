/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_AGORA_APP_ID: string;
  /** Public address of the app for share links; defaults to the page origin. */
  readonly VITE_APP_URL?: string;
  /** OAuth client id for Sign in with Google. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
