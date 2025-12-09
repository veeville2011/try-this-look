import '@google/model-viewer';

declare global {
  namespace JSX {
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
        },
        HTMLElement
      >;
    }
  }
}

export {};

