/// <reference types="react" />

declare namespace JSX {
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
        style?: React.CSSProperties;
      },
      HTMLElement
    >;
  }
}

