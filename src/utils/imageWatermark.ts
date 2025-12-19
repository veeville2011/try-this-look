/**
 * Adds footer (copyright text) to an image
 * The final image maintains Instagram's post aspect ratio (1:1 square) for optimal sharing
 * The image fills the entire canvas without white bars (cover mode)
 */

export interface StoreWatermarkInfo {
  name?: string | null;
  logoUrl?: string | null;
  domain?: string | null;
}

export async function addWatermarkToImage(
  imageUrl: string,
  storeInfo?: StoreWatermarkInfo | null
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Load the original image
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        // Instagram post aspect ratio: 1:1 (square) for maximum compatibility
        const INSTAGRAM_ASPECT_RATIO = 1; // 1:1 square
        
        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;
        const originalAspectRatio = originalWidth / originalHeight;
        
        // Footer height: text height + padding
        const footerText = "© 2025 NUSENSE. Tous droits réservés.";
        const footerPadding = 20;
        
        // Measure text accurately using a temporary canvas
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");
        let footerTextHeight = 20; // Default fallback
        
        if (tempCtx) {
          tempCtx.font = "16px Arial, sans-serif";
          const textMetrics = tempCtx.measureText(footerText);
          footerTextHeight = Math.ceil(
            (textMetrics.actualBoundingBoxAscent || 12) + 
            (textMetrics.actualBoundingBoxDescent || 4)
          ) || 20;
        }
        
        const footerHeight = footerTextHeight + (footerPadding * 2);
        
        // Calculate canvas dimensions (Instagram 1:1 square)
        // Use original width as base, but ensure it's square
        const canvasWidth = Math.max(originalWidth, 1080); // Minimum 1080px for Instagram
        const canvasHeight = canvasWidth * INSTAGRAM_ASPECT_RATIO; // Square: height = width
        
        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        
        // Fill white background (will be covered by image)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Calculate image dimensions to fill the entire canvas (cover mode)
        // This will crop the image if needed to fill the square without white bars
        let imageDisplayWidth = canvasWidth;
        let imageDisplayHeight = canvasHeight;
        let imageX = 0;
        let imageY = 0;
        
        if (originalAspectRatio > INSTAGRAM_ASPECT_RATIO) {
          // Image is wider than square - fit to height, crop sides
          imageDisplayWidth = canvasHeight * originalAspectRatio;
          imageDisplayHeight = canvasHeight;
          imageX = (canvasWidth - imageDisplayWidth) / 2; // Center horizontally
          imageY = 0;
        } else {
          // Image is taller than square - fit to width, crop top/bottom
          imageDisplayWidth = canvasWidth;
          imageDisplayHeight = canvasWidth / originalAspectRatio;
          imageX = 0;
          imageY = (canvasHeight - imageDisplayHeight) / 2; // Center vertically
        }
        
        // Draw original image (filling the entire canvas, cropped if needed)
        ctx.drawImage(img, imageX, imageY, imageDisplayWidth, imageDisplayHeight);
        
        // Draw footer text overlay (centered, at the bottom, with semi-transparent background)
        const footerY = canvasHeight - footerHeight;
        
        // Draw semi-transparent background for footer text (for better readability)
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fillRect(0, footerY, canvasWidth, footerHeight);
        
        // Draw footer text
        ctx.fillStyle = "#564646";
        ctx.font = "16px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        const footerTextY = footerY + footerPadding + footerTextHeight;
        ctx.fillText(footerText, canvasWidth / 2, footerTextY);
        
        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert canvas to blob"));
          }
        }, "image/png");
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    
    // Handle different image URL types
    if (imageUrl.startsWith("data:")) {
      img.src = imageUrl;
    } else if (imageUrl.startsWith("blob:")) {
      img.src = imageUrl;
    } else {
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
    }
  });
}
