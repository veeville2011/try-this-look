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

// Type declarations for @google/model-viewer
declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        'interaction-policy'?: string;
        ar?: boolean;
        'ar-modes'?: string;
        'environment-image'?: string;
        'shadow-intensity'?: string;
        exposure?: string;
        style?: React.CSSProperties;
        className?: string;
      },
      HTMLElement
    >;
  }
}