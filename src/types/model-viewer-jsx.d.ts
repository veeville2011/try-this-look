// JSX type declarations for @google/model-viewer web component
// This extends the package's types for React/JSX usage
// DO NOT import the module here to avoid circular dependencies

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          'camera-controls'?: boolean | string;
          'auto-rotate'?: boolean | string;
          ar?: boolean | string;
          'ar-modes'?: string;
          'shadow-intensity'?: string;
          exposure?: string;
          'environment-image'?: string;
          'interaction-policy'?: string;
          'interaction-prompt'?: string;
          'interaction-prompt-threshold'?: string;
          'skybox-image'?: string;
          'poster'?: string;
          'reveal'?: string;
          'loading'?: string;
          'with-credentials'?: boolean | string;
          onLoad?: () => void;
          onError?: () => void;
          onModelLoad?: () => void;
          onProgress?: (event: CustomEvent) => void;
        },
        HTMLElement
      >;
    }
  }
}

