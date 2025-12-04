/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ENDPOINT?: string;
  readonly VITE_SHOPIFY_API_KEY?: string;
  readonly VITE_SHOPIFY_API_SECRET?: string;
  readonly VITE_SHOPIFY_APP_URL?: string;
  readonly VITE_PORT?: string;
  readonly VITE_NODE_ENV?: string;
  readonly DEV?: boolean;
  readonly PROD?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}