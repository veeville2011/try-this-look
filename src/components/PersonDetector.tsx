/**
 * PersonDetector Component
 * 
 * Detects all people in an image using TensorFlow.js COCO-SSD model.
 * Returns detection results with bounding boxes and labels.
 */

import { useState, useEffect, useRef } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
// Import backends
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';

export interface PersonDetection {
  class: string; // Always "person"
  score: number; // Confidence (0-1)
  bbox: [number, number, number, number]; // [x, y, width, height]
}

export interface DetectionResult {
  people: PersonDetection[];
  inferenceTime: number; // Detection time in ms
}

interface PersonDetectorProps {
  imageUrl: string;
  onDetectionComplete?: (result: DetectionResult) => void;
  minConfidence?: number; // Minimum confidence threshold (default: 0.5)
}

// PersonDetector component removed - use usePersonDetection hook instead

/**
 * Hook version for easier use in components
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

  // Load model
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Initialize TensorFlow.js backend
        // Try WebGL first (faster), fallback to CPU
        const backends = ['webgl', 'cpu'];
        let backendInitialized = false;
        
        for (const backend of backends) {
          try {
            await tf.setBackend(backend);
            await tf.ready();
            console.log(`TensorFlow.js backend initialized: ${backend}`);
            backendInitialized = true;
            break;
          } catch (backendErr) {
            console.warn(`Failed to initialize ${backend} backend:`, backendErr);
            continue;
          }
        }
        
        if (!backendInitialized) {
          throw new Error('No TensorFlow.js backend available');
        }
        
        // Load the COCO-SSD model
        const loadedModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2',
        });
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading model:', err);
        setError('Failed to load AI model. Please refresh the page.');
        setIsLoading(false);
      }
    };
    loadModel();
  }, []);

  // Run detection
  useEffect(() => {
    if (!model || !imageUrl) {
      console.log('[PersonDetector] Detection skipped:', { hasModel: !!model, hasImageUrl: !!imageUrl });
      return;
    }

    const detectPeople = async () => {
      const img = imageRef.current;
      if (!img) {
        console.log('[PersonDetector] No image ref available');
        return;
      }
      
      // Wait for image to load
      if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
        console.log('[PersonDetector] Image not loaded yet:', { complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
        return;
      }

      try {
        setIsProcessing(true);
        setError(null);

        console.log('[PersonDetector] Starting detection...', { imageUrl, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
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

        setDetectionResult({
          people,
          inferenceTime,
        });

        setIsProcessing(false);
      } catch (err) {
        console.error('[PersonDetector] Error detecting people:', err);
        setError('Failed to detect people.');
        setIsProcessing(false);
      }
    };

    const img = imageRef.current;
    if (!img) return;

    // Set up image loading handler
    if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      // Image already loaded
      detectPeople();
    } else {
      // Wait for image to load
      const handleLoad = () => {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          detectPeople();
        }
      };
      img.addEventListener('load', handleLoad);
      img.addEventListener('error', () => {
        setError('Failed to load image.');
        setIsProcessing(false);
      });
      
      return () => {
        img.removeEventListener('load', handleLoad);
      };
    }
  }, [model, imageUrl, minConfidence]);

  return {
    imageRef,
    isLoading,
    isProcessing,
    detectionResult,
    error,
  };
};

