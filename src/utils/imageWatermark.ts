/**
 * Adds footer (copyright text) to an image and wraps it in a Christmas frame
 * The final image maintains Instagram's post aspect ratio (1:1 square) for optimal sharing
 * 
 * Uses the reference frame image (9845950.jpg) to create a decorative Christmas frame around the image.
 * The image is placed in the center white area of the frame without cropping or stretching.
 * Copyright text is displayed at the bottom with a semi-transparent background to ensure visibility.
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
    // Load the reference frame image first
    const frameImg = new Image();
    frameImg.crossOrigin = "anonymous";
    
    frameImg.onload = () => {
      // Now load the original image
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        try {
          // Instagram post aspect ratio: 1:1 (square) for maximum compatibility
          const INSTAGRAM_ASPECT_RATIO = 1; // 1:1 square
          
          const originalWidth = img.naturalWidth;
          const originalHeight = img.naturalHeight;
          const originalAspectRatio = originalWidth / originalHeight;
          
          // Footer height: text height + padding (reserve space at bottom for copyright)
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
          
          // Calculate frame dimensions to cover the entire canvas
          // Scale frame image to cover the entire canvas (cover mode)
          const frameScale = Math.max(
            canvasWidth / frameImg.naturalWidth,
            canvasHeight / frameImg.naturalHeight
          );
          const frameDisplayWidth = frameImg.naturalWidth * frameScale;
          const frameDisplayHeight = frameImg.naturalHeight * frameScale;
          const frameX = (canvasWidth - frameDisplayWidth) / 2;
          const frameY = (canvasHeight - frameDisplayHeight) / 2;
          
          // Step 1: Draw the frame image as background (scaled to cover entire canvas)
          ctx.drawImage(frameImg, frameX, frameY, frameDisplayWidth, frameDisplayHeight);
          
          // Step 2: Calculate white area bounds (where the image will be placed)
          // Reserve space at bottom for footer, and add padding for frame decorations
          const contentAreaHeight = canvasHeight - footerHeight;
          const whiteAreaPadding = canvasWidth * 0.15; // 15% padding on each side to match frame design
          const whiteAreaX = whiteAreaPadding;
          const whiteAreaY = whiteAreaPadding;
          const whiteAreaWidth = canvasWidth - (whiteAreaPadding * 2);
          const whiteAreaHeight = contentAreaHeight - (whiteAreaPadding * 2);
          
          // Draw white background for the image area (matches the frame's white center)
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(whiteAreaX, whiteAreaY, whiteAreaWidth, whiteAreaHeight);
          
          // Step 3: Draw the original image centered in the white area (no cropping, no stretching)
          // Scale image to fit within white area while maintaining aspect ratio
          const imageScaleX = whiteAreaWidth / originalWidth;
          const imageScaleY = whiteAreaHeight / originalHeight;
          const imageScale = Math.min(imageScaleX, imageScaleY); // Use smaller scale to ensure image fits
          
          const finalImageWidth = originalWidth * imageScale;
          const finalImageHeight = originalHeight * imageScale;
          const finalImageX = whiteAreaX + (whiteAreaWidth - finalImageWidth) / 2;
          const finalImageY = whiteAreaY + (whiteAreaHeight - finalImageHeight) / 2;
          
          ctx.drawImage(img, finalImageX, finalImageY, finalImageWidth, finalImageHeight);
          
          // Step 4: Draw footer text overlay (centered, at the bottom, with semi-transparent background)
          const footerY = canvasHeight - footerHeight;
          
          // Draw semi-transparent white background for footer text (for better readability)
          // Ensure it doesn't overlap with decorations
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
    };
    
    frameImg.onerror = () => {
      reject(new Error("Failed to load frame image"));
    };
    
    // Load the reference frame image
    frameImg.src = "/assets/9845950.jpg";
  });
}
