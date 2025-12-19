/**
 * Adds footer (copyright text) to an image
 * The final image maintains Instagram's post aspect ratio (1:1 square) for optimal sharing
 * 
 * If the image is already square (1:1), it's used as-is without cropping or stretching.
 * If the image is not square, it's fitted within the square canvas without cropping/stretching,
 * and white strips fill the empty space areas to maintain the Instagram shareable aspect ratio.
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
        
        // Check if image is already square (Instagram format)
        // Allow small tolerance for floating point precision (within 1%)
        const isSquare = Math.abs(originalAspectRatio - INSTAGRAM_ASPECT_RATIO) < 0.01;
        
        // Calculate canvas dimensions (Instagram 1:1 square)
        // Ensure minimum Instagram size (1080x1080)
        const canvasWidth = Math.max(originalWidth, 1080);
        const canvasHeight = canvasWidth; // Square: height = width
        
        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        
        // Fill white background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Calculate image dimensions to fit within canvas without cropping/stretching
        // Reserve space at bottom for footer
        const contentAreaHeight = canvasHeight - footerHeight;
        const scaleX = canvasWidth / originalWidth;
        const scaleY = contentAreaHeight / originalHeight;
        const scale = Math.min(scaleX, scaleY); // Use smaller scale to ensure image fits
        
        const imageDisplayWidth = originalWidth * scale;
        const imageDisplayHeight = originalHeight * scale;
        
        // Center the image horizontally and vertically in the content area
        const imageX = (canvasWidth - imageDisplayWidth) / 2;
        const imageY = (contentAreaHeight - imageDisplayHeight) / 2;
        
        // Draw original image (no cropping, no stretching)
        ctx.drawImage(img, imageX, imageY, imageDisplayWidth, imageDisplayHeight);
        
        // Draw footer text overlay (centered, at the bottom, with semi-transparent background)
        const footerY = canvasHeight - footerHeight;
        
        // Draw semi-transparent white background for footer text (for better readability)
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fillRect(0, footerY, canvasWidth, footerHeight);
        
        // Draw footer text with shadow for better visibility
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = "#564646";
        ctx.font = "16px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        const footerTextY = footerY + footerPadding + footerTextHeight;
        ctx.fillText(footerText, canvasWidth / 2, footerTextY);
        
        // Reset shadow
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
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
