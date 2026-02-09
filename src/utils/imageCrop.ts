/**
 * Image Cropping Utilities
 * 
 * Provides functions for cropping images based on bounding boxes
 * to extract specific regions (e.g., selected person from group photo).
 */

/**
 * Crop an image to a specific bounding box region
 * @param imageSource - Image URL, data URL, or HTMLImageElement
 * @param bbox - Bounding box [x, y, width, height] in pixels
 * @param padding - Optional padding around the bounding box (in pixels)
 * @returns Promise resolving to a Blob of the cropped image
 */
export const cropImageToBbox = async (
  imageSource: string | HTMLImageElement,
  bbox: [number, number, number, number],
  padding: number = 20
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      // Load image if source is a string
      const img = typeof imageSource === 'string' 
        ? new Image() 
        : imageSource;

      const handleImageLoad = () => {
        try {
          const [x, y, width, height] = bbox;
          
          // Calculate crop coordinates with padding
          const paddingX = Math.min(padding, x);
          const paddingY = Math.min(padding, y);
          const cropX = Math.max(0, x - paddingX);
          const cropY = Math.max(0, y - paddingY);
          const cropWidth = Math.min(
            width + (paddingX * 2),
            img.width - cropX
          );
          const cropHeight = Math.min(
            height + (paddingY * 2),
            img.height - cropY
          );

          // Create canvas for cropping
          const canvas = document.createElement('canvas');
          canvas.width = cropWidth;
          canvas.height = cropHeight;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Draw cropped region to canvas
          ctx.drawImage(
            img,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
          );

          // Convert canvas to blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to create blob from canvas'));
              }
            },
            'image/jpeg',
            0.95 // Quality (0-1)
          );
        } catch (error) {
          reject(error);
        }
      };

      if (typeof imageSource === 'string') {
        img.crossOrigin = 'anonymous';
        img.onload = handleImageLoad;
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageSource;
      } else {
        if (img.complete) {
          handleImageLoad();
        } else {
          img.onload = handleImageLoad;
          img.onerror = () => reject(new Error('Failed to load image'));
        }
      }
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Convert a data URL to a Blob
 */
export const dataURLToBlob = (dataURL: string): Blob => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], { type: mime });
};

/**
 * Convert a Blob to a data URL
 */
export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

