/**
 * ModelManager - Singleton for caching AI models
 * 
 * This singleton manages the lifecycle of TensorFlow.js models,
 * ensuring they're loaded once and reused across the application.
 * 
 * Benefits:
 * - Models loaded once per session (not per component mount)
 * - Reduced network bandwidth and loading times
 * - Better memory management
 * - Shared model instances across components
 */

import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
// Import backends
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';

type ModelType = 'coco-ssd';

interface ModelState {
  model: any | null;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  loadStartTime: number | null;
  loadEndTime: number | null;
}

interface LoadListener {
  onProgress?: (progress: number) => void;
  onComplete?: (model: any) => void;
  onError?: (error: string) => void;
}

class ModelManager {
  private static instance: ModelManager;
  private models: Map<ModelType, ModelState>;
  private listeners: Map<ModelType, Set<LoadListener>>;
  private tfBackendInitialized: boolean = false;

  private constructor() {
    this.models = new Map();
    this.listeners = new Map();
    
    // Initialize model states
    this.models.set('coco-ssd', {
      model: null,
      isLoading: false,
      isLoaded: false,
      error: null,
      loadStartTime: null,
      loadEndTime: null,
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  /**
   * Initialize TensorFlow.js backend (WebGL or CPU)
   * This only needs to happen once per session
   */
  private async initializeTensorFlowBackend(): Promise<void> {
    if (this.tfBackendInitialized) {
      console.log('[ModelManager] TensorFlow backend already initialized');
      return;
    }

    const backends = ['webgl', 'cpu'];
    let backendInitialized = false;

    for (const backend of backends) {
      try {
        await tf.setBackend(backend);
        await tf.ready();
        console.log(`[ModelManager] TensorFlow.js backend initialized: ${backend}`);
        this.tfBackendInitialized = true;
        backendInitialized = true;
        break;
      } catch (backendErr) {
        console.warn(`[ModelManager] Failed to initialize ${backend} backend:`, backendErr);
        continue;
      }
    }

    if (!backendInitialized) {
      throw new Error('No TensorFlow.js backend available');
    }
  }

  /**
   * Subscribe to model loading events
   */
  public subscribe(modelType: ModelType, listener: LoadListener): () => void {
    if (!this.listeners.has(modelType)) {
      this.listeners.set(modelType, new Set());
    }
    
    this.listeners.get(modelType)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(modelType);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * Notify all listeners of model loading progress
   */
  private notifyListeners(
    modelType: ModelType,
    event: 'progress' | 'complete' | 'error',
    data?: any
  ): void {
    const listeners = this.listeners.get(modelType);
    if (!listeners) return;

    listeners.forEach((listener) => {
      try {
        if (event === 'progress' && listener.onProgress) {
          listener.onProgress(data);
        } else if (event === 'complete' && listener.onComplete) {
          listener.onComplete(data);
        } else if (event === 'error' && listener.onError) {
          listener.onError(data);
        }
      } catch (err) {
        console.error('[ModelManager] Error notifying listener:', err);
      }
    });
  }

  /**
   * Load COCO-SSD model (cached after first load)
   */
  public async loadCocoSsdModel(): Promise<any> {
    const modelState = this.models.get('coco-ssd')!;

    // If model is already loaded, return it immediately
    if (modelState.isLoaded && modelState.model) {
      console.log('[ModelManager] COCO-SSD model already loaded (cached)');
      return modelState.model;
    }

    // If model is currently loading, wait for it
    if (modelState.isLoading) {
      console.log('[ModelManager] COCO-SSD model is already loading, waiting...');
      return this.waitForModelLoad('coco-ssd');
    }

    // Start loading the model
    console.log('[ModelManager] Starting COCO-SSD model load...');
    modelState.isLoading = true;
    modelState.loadStartTime = Date.now();
    this.notifyListeners('coco-ssd', 'progress', 0);

    try {
      // Initialize TensorFlow backend first
      await this.initializeTensorFlowBackend();
      this.notifyListeners('coco-ssd', 'progress', 30);

      // Load the COCO-SSD model
      console.log('[ModelManager] Loading COCO-SSD model with lite_mobilenet_v2...');
      const loadedModel = await cocoSsd.load({
        base: 'lite_mobilenet_v2',
      });

      this.notifyListeners('coco-ssd', 'progress', 90);

      // Update state
      modelState.model = loadedModel;
      modelState.isLoaded = true;
      modelState.isLoading = false;
      modelState.error = null;
      modelState.loadEndTime = Date.now();

      const loadTime = modelState.loadEndTime - modelState.loadStartTime!;
      console.log(`[ModelManager] COCO-SSD model loaded successfully in ${loadTime}ms`);

      this.notifyListeners('coco-ssd', 'progress', 100);
      this.notifyListeners('coco-ssd', 'complete', loadedModel);

      return loadedModel;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load COCO-SSD model';
      console.error('[ModelManager] Error loading COCO-SSD model:', err);

      // Update state - ensure model is cleared on error
      modelState.model = null;
      modelState.isLoading = false;
      modelState.isLoaded = false;
      modelState.error = errorMessage;
      modelState.loadEndTime = Date.now();

      this.notifyListeners('coco-ssd', 'error', errorMessage);

      throw new Error(errorMessage);
    }
  }

  /**
   * Wait for model to finish loading
   */
  private waitForModelLoad(modelType: ModelType): Promise<any> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      
      const checkInterval = setInterval(() => {
        const modelState = this.models.get(modelType)!;

        if (modelState.isLoaded && modelState.model) {
          clearInterval(checkInterval);
          if (timeoutId) clearTimeout(timeoutId); // Clean up timeout
          resolve(modelState.model);
        } else if (!modelState.isLoading && modelState.error) {
          clearInterval(checkInterval);
          if (timeoutId) clearTimeout(timeoutId); // Clean up timeout
          reject(new Error(modelState.error));
        }
      }, 100);

      // Timeout after 30 seconds
      timeoutId = setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Model loading timeout'));
      }, 30000);
    });
  }

  /**
   * Get model if already loaded (returns null if not loaded)
   */
  public getModel(modelType: ModelType): any | null {
    const modelState = this.models.get(modelType);
    return modelState?.model || null;
  }

  /**
   * Check if model is loaded
   */
  public isModelLoaded(modelType: ModelType): boolean {
    const modelState = this.models.get(modelType);
    return modelState?.isLoaded || false;
  }

  /**
   * Check if model is loading
   */
  public isModelLoading(modelType: ModelType): boolean {
    const modelState = this.models.get(modelType);
    return modelState?.isLoading || false;
  }

  /**
   * Get model loading error
   */
  public getModelError(modelType: ModelType): string | null {
    const modelState = this.models.get(modelType);
    return modelState?.error || null;
  }

  /**
   * Get model loading time in milliseconds
   */
  public getLoadTime(modelType: ModelType): number | null {
    const modelState = this.models.get(modelType);
    if (modelState?.loadStartTime && modelState?.loadEndTime) {
      return modelState.loadEndTime - modelState.loadStartTime;
    }
    return null;
  }

  /**
   * Clear cached model (useful for memory management or testing)
   */
  public clearModel(modelType: ModelType): void {
    const modelState = this.models.get(modelType);
    if (modelState) {
      // Dispose TensorFlow model to free memory
      if (modelState.model && typeof modelState.model.dispose === 'function') {
        try {
          modelState.model.dispose();
        } catch (err) {
          console.error('[ModelManager] Error disposing model:', err);
        }
      }

      modelState.model = null;
      modelState.isLoaded = false;
      modelState.error = null;
      console.log(`[ModelManager] Cleared ${modelType} model from cache`);
    }
  }

  /**
   * Preload all models (call on app initialization)
   */
  public async preloadModels(): Promise<void> {
    console.log('[ModelManager] Preloading all models...');
    try {
      await this.loadCocoSsdModel();
      console.log('[ModelManager] All models preloaded successfully');
    } catch (err) {
      console.error('[ModelManager] Error preloading models:', err);
    }
  }

  /**
   * Get debug info about all models
   */
  public getDebugInfo(): Record<string, any> {
    const info: Record<string, any> = {
      tfBackendInitialized: this.tfBackendInitialized,
      models: {},
    };

    this.models.forEach((state, type) => {
      info.models[type] = {
        isLoaded: state.isLoaded,
        isLoading: state.isLoading,
        error: state.error,
        loadTime: this.getLoadTime(type),
      };
    });

    return info;
  }
}

// Export singleton instance getter
export const modelManager = ModelManager.getInstance();

// Export types
export type { ModelType, LoadListener };

