interface VideoAdResponse {
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

// Base URL - update this to match your actual API domain
const VIDEO_API_ENDPOINT = "https://try-on-server-v1.onrender.com/api/video-ad";

export async function generateVideoAd(
  productImages: File[],
  metadata?: {
    name?: string;
    email?: string;
    storeName?: string;
  }
): Promise<VideoAdResponse> {
  try {
    // Validate images
    if (productImages.length === 0) {
      return {
        status: 'error',
        image: null,
        error_message: {
          code: 'VALIDATION_ERROR',
          message: 'Au moins une image produit est requise',
        },
      };
    }

    if (productImages.length > 10) {
      return {
        status: 'error',
        image: null,
        error_message: {
          code: 'VALIDATION_ERROR',
          message: 'Maximum 10 images autorisées',
        },
      };
    }

    // Check file sizes (10MB per file)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = productImages.filter((file) => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      return {
        status: 'error',
        image: null,
        error_message: {
          code: 'FILE_PROCESSING_ERROR',
          message: `Fichier trop volumineux: ${oversizedFiles[0].name}. Taille maximale: 10MB.`,
        },
      };
    }

    // Create form data
    const formData = new FormData();
    productImages.forEach((file) => {
      formData.append('productImages', file);
    });

    // Add optional metadata
    if (metadata?.name) formData.append('name', metadata.name);
    if (metadata?.email) formData.append('email', metadata.email);
    if (metadata?.storeName) formData.append('storeName', metadata.storeName);

    const response = await fetch(VIDEO_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'fr',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        status: 'error',
        image: null,
        error_message: {
          code: errorData.error_message?.code || `HTTP_${response.status}`,
          message:
            errorData.error_message?.message ||
            `Erreur HTTP ${response.status}: ${response.statusText}`,
          details: errorData.error_message?.details,
        },
      };
    }

    const data: VideoAdResponse = await response.json();
    return data;
  } catch (error) {
    return {
      status: 'error',
      image: null,
      error_message: {
        code: 'NETWORK_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'Une erreur de connexion s\'est produite lors de la génération de la vidéo.',
      },
    };
  }
}

export async function dataURLToFile(
  url: string,
  filename: string = 'image.jpg'
): Promise<File> {
  try {
    // Handle data URLs
    if (url.startsWith('data:')) {
      const response = await fetch(url);
      const blob = await response.blob();
      return new File([blob], filename, { type: blob.type || 'image/jpeg' });
    }

    // Handle regular URLs (including blob URLs)
    const response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    const blob = await response.blob();
    // Determine file type from blob or URL
    const mimeType = blob.type || (url.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    return new File([blob], filename, { type: mimeType });
  } catch (error) {
    // Fallback: try to create from data URL if it's a regular URL
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      // For CORS-protected URLs, we might need to use a different approach
      // For now, throw the error so the caller can handle it
      throw new Error(`Failed to convert URL to File: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    throw error;
  }
}

