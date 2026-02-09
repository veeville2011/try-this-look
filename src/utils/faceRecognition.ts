/**
 * Face Recognition Utilities
 * 
 * Provides functions for extracting face descriptors, matching faces,
 * and managing registered faces for person identification.
 */

export interface FaceDescriptor {
  name: string;
  descriptor: number[];
  imageData?: string;
  registeredAt: string;
}

/**
 * Extract face descriptor from a detected face
 * This creates a unique numerical representation of the face
 */
export const extractFaceDescriptor = async (
  faceModel: any, // BlazeFace model
  image: HTMLImageElement | HTMLCanvasElement,
  bbox: [number, number, number, number] // [x, y, width, height]
): Promise<number[]> => {
  try {
    // Create canvas to extract face region
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    const [x, y, width, height] = bbox;
    
    // Set canvas size to face bounding box
    canvas.width = width;
    canvas.height = height;

    // Draw face region to canvas
    ctx.drawImage(image, x, y, width, height, 0, 0, width, height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);
    
    // Convert to tensor and normalize
    const tf = await import('@tensorflow/tfjs');
    const tensor = tf.browser.fromPixels(imageData);
    const resized = tf.image.resizeBilinear(tensor, [128, 128]);
    const normalized = resized.div(255.0);
    const expanded = normalized.expandDims(0);

    // Use BlazeFace to get landmarks/descriptors
    // Note: BlazeFace doesn't directly provide descriptors, so we'll use a simple approach
    // Extract features from the face region
    const features = expanded.flatten().arraySync() as number[];
    
    // Cleanup
    tensor.dispose();
    resized.dispose();
    normalized.dispose();
    expanded.dispose();

    return features;
  } catch (error) {
    console.error('Error extracting face descriptor:', error);
    throw error;
  }
};

/**
 * Calculate cosine similarity between two vectors
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
};

/**
 * Match a face descriptor against registered faces
 * Returns the best match if similarity exceeds threshold
 */
export const matchFace = (
  descriptor: number[],
  registeredFaces: FaceDescriptor[],
  threshold: number = 0.6
): { name: string; confidence: number } | null => {
  if (registeredFaces.length === 0) return null;

  let bestMatch: { name: string; confidence: number } | null = null;
  let bestSimilarity = 0;

  for (const registeredFace of registeredFaces) {
    const similarity = cosineSimilarity(descriptor, registeredFace.descriptor);
    
    if (similarity > bestSimilarity && similarity >= threshold) {
      bestSimilarity = similarity;
      bestMatch = {
        name: registeredFace.name,
        confidence: similarity,
      };
    }
  }

  return bestMatch;
};

/**
 * Register a new face with a name
 */
export const registerFace = (
  name: string,
  descriptor: number[],
  imageData?: string
): FaceDescriptor => {
  const face: FaceDescriptor = {
    name,
    descriptor,
    imageData,
    registeredAt: new Date().toISOString(),
  };

  // Save to localStorage
  const registeredFaces = loadRegisteredFaces();
  registeredFaces.push(face);
  localStorage.setItem('registeredFaces', JSON.stringify(registeredFaces));

  return face;
};

/**
 * Load all registered faces from localStorage
 */
export const loadRegisteredFaces = (): FaceDescriptor[] => {
  try {
    const stored = localStorage.getItem('registeredFaces');
    if (!stored) return [];
    
    const faces = JSON.parse(stored) as FaceDescriptor[];
    return Array.isArray(faces) ? faces : [];
  } catch (error) {
    console.error('Error loading registered faces:', error);
    return [];
  }
};

/**
 * Delete a registered face by name
 */
export const deleteRegisteredFace = (name: string): void => {
  const faces = loadRegisteredFaces();
  const filtered = faces.filter((face) => face.name !== name);
  localStorage.setItem('registeredFaces', JSON.stringify(filtered));
};

/**
 * Clear all registered faces
 */
export const clearRegisteredFaces = (): void => {
  localStorage.removeItem('registeredFaces');
};

