export interface ProductImage {
  id?: number | string;
  url: string;
}

export interface ProductInfo {
  id: string;
  name: string;
  price: number;
  image: string;
  url: string;
  description?: string;
  sizes?: string;
  colors?: string;
  brand?: string;
  category?: string;
  availability?: string;
  rating?: number;
  material?: string;
}

export interface CartItem extends ProductInfo {
  quantity: number;
  timestamp: number;
}

export interface TryOnSession {
  uploadedImage: string | null;
  selectedClothingUrl: string | null;
  generatedImage: string | null;
  timestamp: number;
}

export interface TryOnResponse {
  status: 'success' | 'error';
  image?: string;
  error_message?: {
    code: string;
    message: string;
  };
}

export interface VideoAdResponse {
  status: 'success' | 'error';
  image: string | null;
  error_message: {
    code: string | null;
    message: string | null;
    details?: Record<string, any>;
  };
  compression?: {
    images: Array<{
      index: number;
      originalSize: number;
      finalSize: number;
      compressionRatio: number;
    }>;
    totalCompressionRatio: string;
  };
  referenceImages?: {
    count: number;
    format: string;
    note: string;
  };
}

export interface GenerationState {
  isGenerating: boolean;
  currentStep: number;
  progress: number;
}

export type ErrorCode = 
  | 'MODEL_TIMEOUT'
  | 'MISSING_FILES_ERROR'
  | 'SERVER_ERROR'
  | 'CORS_ERROR'
  | 'NETWORK_ERROR';

export const LOADING_MESSAGES = [
  "🎯 Préparation de votre expérience d'essayage virtuel...",
  "📥 Récupération de l'image du vêtement depuis le site web...",
  "🎨 Préparation des images pour la génération...",
  "💫 Laissez-nous faire notre magie... Cela peut prendre un moment.",
  "✨ Finalisation de votre image personnalisée...",
  "🎉 Incroyable ! Votre essayage virtuel est prêt !"
];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  MODEL_TIMEOUT: "La génération prend plus de temps que prévu. Veuillez réessayer avec des images plus simples ou une meilleure connexion internet.",
  MISSING_FILES_ERROR: "Veuillez vous assurer d'avoir sélectionné à la fois votre photo et un article de vêtement.",
  SERVER_ERROR: "Une erreur technique s'est produite. Veuillez réessayer dans quelques instants.",
  CORS_ERROR: "Erreur de chargement d'image. Veuillez réessayer.",
  NETWORK_ERROR: "Erreur de connexion. Veuillez vérifier votre connexion internet."
};
