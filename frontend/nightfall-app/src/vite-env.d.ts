/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_AGORA_APP_ID: string;
  readonly VITE_MINI_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
