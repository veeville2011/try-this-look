/**
 * Image Validation Utilities
 * 
 * Provides utilities for validating image dimensions and ensuring
 * bounding boxes are drawn correctly by preventing race conditions.
 */

/**
 * Generate a simple hash/identifier for an image URL
 * Used to ensure detection results match the current image
 */
export const generateImageId = (imageUrl: string): string => {
  if (imageUrl.startsWith('data:')) {
    // For data URLs, use a hash of the first 1000 chars
    const hash = imageUrl.substring(0, 1000).split('').reduce((acc, char) => {
      const hash = ((acc << 5) - acc) + char.charCodeAt(0);
      return hash & hash;
    }, 0);
    return `data_${Math.abs(hash)}`;
  }
  // For regular URLs, use the URL itself (normalized)
  return imageUrl.split('?')[0];
};

/**
 * Image dimension cache entry
 */
interface ImageDimensions {
  width: number;
  height: number;
  imageId: string;
  timestamp: number;
}

const DIMENSION_CACHE_KEY = 'nusense_image_dimensions_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached image dimensions
 */
export const getCachedDimensions = (imageId: string): ImageDimensions | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = sessionStorage.getItem(DIMENSION_CACHE_KEY);
    if (!cached) return null;
    
    const cache: Record<string, ImageDimensions> = JSON.parse(cached);
    const entry = cache[imageId];
    
    if (!entry) return null;
    
    // Check if cache is still valid
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      // Remove expired entry
      delete cache[imageId];
      sessionStorage.setItem(DIMENSION_CACHE_KEY, JSON.stringify(cache));
      return null;
    }
    
    return entry;
  } catch {
    return null;
  }
};

/**
 * Cache image dimensions
 */
export const cacheDimensions = (imageId: string, width: number, height: number): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const cached = sessionStorage.getItem(DIMENSION_CACHE_KEY);
    const cache: Record<string, ImageDimensions> = cached ? JSON.parse(cached) : {};
    
    cache[imageId] = {
      width,
      height,
      imageId,
      timestamp: Date.now(),
    };
    
    // Clean up old entries (older than cache duration)
    const now = Date.now();
    Object.keys(cache).forEach(key => {
      if (now - cache[key].timestamp > CACHE_DURATION) {
        delete cache[key];
      }
    });
    
    sessionStorage.setItem(DIMENSION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Validate image is ready with proper dimensions
 * Returns true if image is ready, false otherwise
 */
export const validateImageReady = (
  img: HTMLImageElement,
  expectedImageId?: string
): { ready: boolean; width: number; height: number; imageId: string } => {
  const imageId = expectedImageId || generateImageId(img.src);
  
  // Check if image is complete
  if (!img.complete) {
    return { ready: false, width: 0, height: 0, imageId };
  }
  
  // CRITICAL: For cached images on refresh, complete might be true but dimensions might still be 0
  // We MUST verify dimensions are actually set, not just that complete is true
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  
  // Check cached dimensions first (but only if actual dimensions are also valid)
  const cached = getCachedDimensions(imageId);
  if (cached && cached.width > 0 && cached.height > 0) {
    // Verify cached dimensions match actual dimensions
    // This ensures we're not using stale cache when image hasn't loaded yet
    if (width === cached.width && height === cached.height && width > 0 && height > 0) {
      return { ready: true, width: cached.width, height: cached.height, imageId };
    }
  }
  
  // Validate actual dimensions (MUST be checked even if cached exists)
  if (width === 0 || height === 0 || !isFinite(width) || !isFinite(height)) {
    return { ready: false, width: 0, height: 0, imageId };
  }
  
  if (width < 1 || height < 1) {
    return { ready: false, width: 0, height: 0, imageId };
  }
  
  // Cache validated dimensions
  cacheDimensions(imageId, width, height);
  
  return { ready: true, width, height, imageId };
};

/**
 * Wait for image to be ready with validated dimensions
 * Uses exponential backoff for retries
 */
export const waitForImageReady = (
  img: HTMLImageElement,
  callback: (dimensions: { width: number; height: number; imageId: string }) => void,
  maxAttempts: number = 150,
  expectedImageId?: string
): (() => void) => {
  let attempts = 0;
  let cancelled = false;
  let timeoutId: number | null = null;
  
  const imageId = expectedImageId || generateImageId(img.src);
  
  const checkImage = () => {
    if (cancelled) return;
    
    attempts++;
    
    const validation = validateImageReady(img, imageId);
    
    if (validation.ready) {
      callback({ width: validation.width, height: validation.height, imageId: validation.imageId });
      return;
    }
    
    if (attempts >= maxAttempts) {
      console.warn('[ImageValidation] Image failed to load after maximum attempts:', {
        attempts,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        src: img.src.substring(0, 100),
        imageId
      });
      return;
    }
    
    // Exponential backoff: start with 50ms, max 200ms
    const delay = Math.min(50 * Math.pow(1.1, attempts), 200);
    
    timeoutId = window.setTimeout(() => {
      checkImage();
    }, delay);
  };
  
  // Start checking
  checkImage();
  
  // Also listen for load event
  const handleLoad = () => {
    if (cancelled) return;
    // Wait a bit for dimensions to be set
    timeoutId = window.setTimeout(() => {
      checkImage();
    }, 50);
  };
  
  img.addEventListener('load', handleLoad);
  
  // Return cleanup function
  return () => {
    cancelled = true;
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
    img.removeEventListener('load', handleLoad);
  };
};

/**
 * Clear dimension cache for a specific image
 */
export const clearCachedDimensions = (imageId: string): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const cached = sessionStorage.getItem(DIMENSION_CACHE_KEY);
    if (!cached) return;
    
    const cache: Record<string, ImageDimensions> = JSON.parse(cached);
    delete cache[imageId];
    
    sessionStorage.setItem(DIMENSION_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore errors
  }
};

/**
 * Clear all cached dimensions
 */
export const clearAllCachedDimensions = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.removeItem(DIMENSION_CACHE_KEY);
  } catch {
    // Ignore errors
  }
};

/**
 * Canvas Coordinate Utilities
 * Following CANVAS_POSITIONING_GUIDE.md for consistent coordinate transformation
 */

/**
 * Calculate image scale to fit within max dimensions while preserving aspect ratio
 * Following CANVAS_POSITIONING_GUIDE.md Step 1: Scale Calculation
 * 
 * @param imgWidth - Original image width
 * @param imgHeight - Original image height
 * @param maxWidth - Maximum display width (default: 1200)
 * @param maxHeight - Maximum display height (default: 800)
 * @returns Object with scale factor and display dimensions
 */
export const calculateImageScale = (
  imgWidth: number,
  imgHeight: number,
  maxWidth: number = 1200,
  maxHeight: number = 800
): { scale: number; displayWidth: number; displayHeight: number } => {
  // Validate inputs
  if (!isFinite(imgWidth) || !isFinite(imgHeight) || imgWidth <= 0 || imgHeight <= 0) {
    console.warn('[CanvasUtils] Invalid image dimensions:', { imgWidth, imgHeight });
    return { scale: 1, displayWidth: imgWidth || 1, displayHeight: imgHeight || 1 };
  }
  
  if (!isFinite(maxWidth) || !isFinite(maxHeight) || maxWidth <= 0 || maxHeight <= 0) {
    console.warn('[CanvasUtils] Invalid max dimensions:', { maxWidth, maxHeight });
    return { scale: 1, displayWidth: imgWidth, displayHeight: imgHeight };
  }
  
  let scale = 1;
  let displayWidth = imgWidth;
  let displayHeight = imgHeight;
  
  // If image exceeds max dimensions, calculate scale to fit
  // Following guide: scale = Math.min(maxWidth / img.width, maxHeight / img.height)
  if (imgWidth > maxWidth || imgHeight > maxHeight) {
    const widthScale = maxWidth / imgWidth;
    const heightScale = maxHeight / imgHeight;
    scale = Math.min(widthScale, heightScale); // Use smaller scale to fit both dimensions
    displayWidth = imgWidth * scale;
    displayHeight = imgHeight * scale;
  }
  
  // Validate output
  if (!isFinite(scale) || scale <= 0 || !isFinite(displayWidth) || !isFinite(displayHeight)) {
    console.error('[CanvasUtils] Invalid scale calculation result:', {
      scale,
      displayWidth,
      displayHeight,
      imgWidth,
      imgHeight,
      maxWidth,
      maxHeight
    });
    return { scale: 1, displayWidth: imgWidth, displayHeight: imgHeight };
  }
  
  return { scale, displayWidth, displayHeight };
};

