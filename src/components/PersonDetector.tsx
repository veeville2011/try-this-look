/**
 * PersonDetector Component
 * 
 * Detects all people in an image using TensorFlow.js COCO-SSD model.
 * Returns detection results with bounding boxes and labels.
 * 
 * Now uses ModelManager for efficient model caching across component lifecycles.
 */

import { useState, useEffect, useRef } from 'react';
import { modelManager } from '@/utils/modelManager';
import { 
  generateImageId, 
  validateImageReady, 
  waitForImageReady,
  clearCachedDimensions
} from '@/utils/imageValidation';

export interface PersonDetection {
  class: string; // Always "person"
  score: number; // Confidence (0-1)
  bbox: [number, number, number, number]; // [x, y, width, height]
}

export interface DetectionResult {
  people: PersonDetection[];
  inferenceTime: number; // Detection time in ms
  imageId?: string; // Image identifier for validation
  imageWidth?: number; // Image width when detection was run
  imageHeight?: number; // Image height when detection was run
}

interface PersonDetectorProps {
  imageUrl: string;
  onDetectionComplete?: (result: DetectionResult) => void;
  minConfidence?: number; // Minimum confidence threshold (default: 0.5)
}

// PersonDetector component removed - use usePersonDetection hook instead

/**
 * Hook version for easier use in components
 * 
 * Now uses ModelManager for efficient model caching.
 * The model is loaded once per session and reused across all component instances.
 */
export const usePersonDetection = (
  imageUrl: string,
  minConfidence: number = 0.5
) => {
  const [model, setModel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load model using ModelManager (cached after first load)
  useEffect(() => {
    let isMounted = true;

    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check if model is already loaded in cache
        const cachedModel = modelManager.getModel('coco-ssd');
        if (cachedModel) {
          console.log('[PersonDetector] Using cached COCO-SSD model');
          if (isMounted) {
            setModel(cachedModel);
            setIsLoading(false);
          }
          return;
        }

        // Load model through ModelManager (will cache for future use)
        console.log('[PersonDetector] Loading COCO-SSD model via ModelManager...');
        const loadedModel = await modelManager.loadCocoSsdModel();
        
        if (isMounted) {
          setModel(loadedModel);
          setIsLoading(false);
          console.log('[PersonDetector] Model loaded successfully');
        }
      } catch (err) {
        console.error('[PersonDetector] Error loading model:', err);
        if (isMounted) {
          setError('Failed to load AI model. Please refresh the page.');
          setIsLoading(false);
        }
      }
    };

    loadModel();

    return () => {
      isMounted = false;
    };
  }, []);

  // Run detection
  useEffect(() => {
    // CRITICAL: Clear detection result when imageUrl changes to prevent using stale results
    // This is especially important on refresh when image might be cached
    setDetectionResult(null);
    setError(null);
    
    if (!model || !imageUrl) {
      console.log('[PersonDetector] Detection skipped:', { hasModel: !!model, hasImageUrl: !!imageUrl });
      return;
    }

    const img = imageRef.current;
    if (!img) {
      console.log('[PersonDetector] No image ref available');
      return;
    }

    // Generate image ID for tracking
    const imageId = generateImageId(imageUrl);

    // CRITICAL: Ensure image src is set correctly
    // This is especially important on refresh when image might be cached
    // Check if src needs to be updated (handle both data URLs and regular URLs)
    const needsSrcUpdate = imageUrl.startsWith('data:') 
      ? img.src !== imageUrl 
      : imageUrl && (!img.src.includes(imageUrl.split('?')[0]) && !imageUrl.includes(img.src.split('?')[0]));
    
    if (needsSrcUpdate && imageUrl) {
      // Clear cached dimensions for old image before updating src
      const oldImageId = generateImageId(img.src);
      clearCachedDimensions(oldImageId);
      
      // CRITICAL: Set crossOrigin for cross-origin images to prevent canvas tainting
      // Only set for HTTP/HTTPS URLs, not for data URLs or blob URLs
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // Ensure crossOrigin is set before src to prevent CORS issues
        if (img.crossOrigin !== 'anonymous') {
          img.crossOrigin = 'anonymous';
        }
      } else if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
        // Data URLs and blob URLs don't need crossOrigin
        img.crossOrigin = null;
      }
      
      img.src = imageUrl;
      console.log('[PersonDetector] Set image src:', imageUrl.substring(0, 50) + '...');
      // When src changes, browser automatically resets complete to false
      // This ensures we wait for the new image to load
    }

    const detectPeople = async () => {
      // CRITICAL: Check if image failed to load (e.g., due to CORS)
      if (img.complete && img.naturalWidth === 0 && img.naturalHeight === 0) {
        console.error('[PersonDetector] Image failed to load - possible CORS issue:', imageUrl);
        setError('Image failed to load. This may be due to CORS restrictions. Please ensure the image server allows cross-origin requests.');
        setIsProcessing(false);
        return;
      }
      
      // CRITICAL: Use validation utility to ensure image is ready
      // This handles cached images, dimension validation, and prevents race conditions
      const validation = validateImageReady(img, imageId);
      
      if (!validation.ready) {
        console.log('[PersonDetector] Image not ready for detection:', {
          complete: img.complete,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          imageId: validation.imageId
        });
        return;
      }

      // Verify image ID matches (prevents detection on wrong image)
      if (validation.imageId !== imageId) {
        console.warn('[PersonDetector] Image ID mismatch - image may have changed:', {
          expectedId: imageId,
          actualId: validation.imageId
        });
        return;
      }

      const naturalWidth = validation.width;
      const naturalHeight = validation.height;

      try {
        setIsProcessing(true);
        setError(null);

        console.log('[PersonDetector] Starting detection...', { 
          imageUrl, 
          naturalWidth, 
          naturalHeight,
          imageId 
        });
        const startTime = Date.now();
        const predictions = await model.detect(img);

        console.log('[PersonDetector] Raw predictions:', predictions.length, predictions);

        const people = predictions
          .filter((pred: any) => pred.class === 'person' && pred.score >= minConfidence)
          .map((pred: any) => ({
            class: pred.class,
            score: pred.score,
            bbox: pred.bbox as [number, number, number, number],
          })) as PersonDetection[];

        console.log('[PersonDetector] Filtered people:', people.length, people);

        const inferenceTime = Date.now() - startTime;

        // Store detection result with image metadata for validation
        setDetectionResult({
          people,
          inferenceTime,
          imageId,
          imageWidth: naturalWidth,
          imageHeight: naturalHeight,
        });

        setIsProcessing(false);
      } catch (err: any) {
        console.error('[PersonDetector] Error detecting people:', err);
        
        // Check for CORS/tainted canvas errors
        const errorMessage = err?.message || String(err);
        if (errorMessage.includes('Tainted canvases') || 
            errorMessage.includes('texSubImage2D') || 
            errorMessage.includes('SecurityError') ||
            errorMessage.includes('cross-origin')) {
          setError('CORS error: Image cannot be processed due to cross-origin restrictions. Please ensure the image server allows CORS requests.');
        } else {
          setError('Failed to detect people.');
        }
        
        setIsProcessing(false);
      }
    };

    // Use new validation utility to wait for image to be ready
    // CRITICAL: This ensures detection only runs when image has valid dimensions
    const cleanup = waitForImageReady(
      img,
      (dimensions) => {
        // CRITICAL: Verify image ID matches current image before running detection
        // This prevents detection on wrong image
        if (dimensions.imageId !== imageId) {
          console.warn('[PersonDetector] Image ID mismatch during wait - image changed:', {
            expectedId: imageId,
            actualId: dimensions.imageId,
            expectedSrc: imageUrl.substring(0, 50),
            actualSrc: img.src.substring(0, 50)
          });
          return; // Don't run detection on wrong image
        }
        
        // CRITICAL: Verify dimensions are valid before running detection
        if (dimensions.width <= 0 || dimensions.height <= 0 || 
            !isFinite(dimensions.width) || !isFinite(dimensions.height)) {
          console.warn('[PersonDetector] Invalid dimensions during wait:', {
            width: dimensions.width,
            height: dimensions.height,
            imageId: dimensions.imageId
          });
          return; // Don't run detection with invalid dimensions
        }
        
        // All checks passed - run detection
        console.log('[PersonDetector] Image ready for detection:', {
          dimensions: `${dimensions.width}x${dimensions.height}`,
          imageId: dimensions.imageId
        });
        detectPeople();
      },
      200, // maxAttempts - increased for reliability
      imageId
    );

    return cleanup;
  }, [model, imageUrl, minConfidence]);

  return {
    imageRef,
    isLoading,
    isProcessing,
    detectionResult,
    error,
  };
};

