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
        
        // Debug logging
        console.log("[Watermark] Image dimensions:", {
          width: originalWidth,
          height: originalHeight,
          aspectRatio: originalAspectRatio,
          isSquare: Math.abs(originalAspectRatio - 1) < 0.01
        });
        
        // Footer configuration
        // storeInfo.name should be the actual business name (e.g., "My Fashion Store")
        // NOT the domain (e.g., "myfashionstore.myshopify.com")
        const storeName = storeInfo?.name || null;
        const copyrightText = "© 2025 NUSENSE. Tous droits réservés.";
        
        // Font sizes and spacing
        const storeNameFontSize = Math.max(20, canvasWidth / 54); // Responsive: ~20px at 1080px width
        const copyrightFontSize = Math.max(14, canvasWidth / 77); // Responsive: ~14px at 1080px width
        const storeNameFont = `600 ${storeNameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
        const copyrightFont = `${copyrightFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
        
        const verticalPadding = Math.max(16, canvasWidth / 67.5); // Responsive padding
        const lineSpacing = Math.max(8, canvasWidth / 135); // Space between store name and copyright
        
        // Measure text accurately using a temporary canvas
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");
        let storeNameHeight = 0;
        let copyrightHeight = 20; // Default fallback
        
        if (tempCtx) {
          // Measure store name
          if (storeName) {
            tempCtx.font = storeNameFont;
            const storeNameMetrics = tempCtx.measureText(storeName);
            storeNameHeight = Math.ceil(
              (storeNameMetrics.actualBoundingBoxAscent || 16) + 
              (storeNameMetrics.actualBoundingBoxDescent || 4)
            ) || 24;
          }
          
          // Measure copyright
          tempCtx.font = copyrightFont;
          const copyrightMetrics = tempCtx.measureText(copyrightText);
          copyrightHeight = Math.ceil(
            (copyrightMetrics.actualBoundingBoxAscent || 12) + 
            (copyrightMetrics.actualBoundingBoxDescent || 4)
          ) || 18;
        }
        
        // Calculate total footer height
        const footerHeight = verticalPadding * 2 + 
          (storeName ? storeNameHeight + lineSpacing : 0) + 
          copyrightHeight;
        
        // Check if image is already square (Instagram format)
        // Increased tolerance to 2% to account for slight variations from Gemini
        const isSquare = Math.abs(originalAspectRatio - INSTAGRAM_ASPECT_RATIO) < 0.02;
        
        console.log("[Watermark] Square detection:", {
          isSquare,
          aspectRatioDiff: Math.abs(originalAspectRatio - INSTAGRAM_ASPECT_RATIO)
        });
        
        // Calculate canvas dimensions (Instagram 1:1 square)
        // Ensure minimum Instagram size (1080x1080)
        const canvasWidth = Math.max(originalWidth, 1080);
        const canvasHeight = canvasWidth; // Square: height = width (Instagram 1:1 aspect ratio)
        
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
        
        let imageDisplayWidth: number;
        let imageDisplayHeight: number;
        let imageX: number;
        let imageY: number;
        
        if (isSquare) {
          // Image is already square (1:1) - fill entire canvas, no white strips
          // Since both image and canvas are square, scale proportionally to fill canvas
          const scale = canvasWidth / originalWidth; // Both are square, so width/height ratio is same
          imageDisplayWidth = canvasWidth; // Fill entire canvas width
          imageDisplayHeight = canvasHeight; // Fill entire canvas height
          imageX = 0;
          imageY = 0;
          
          console.log("[Watermark] Square image - filling canvas:", {
            scale,
            imageDisplayWidth,
            imageDisplayHeight,
            canvasWidth,
            canvasHeight,
            originalWidth,
            originalHeight
          });
        } else {
          // Image is not square - fit proportionally within square canvas
          // This will create white strips, but image won't be cut or stretched
          const scaleX = canvasWidth / originalWidth;
          const scaleY = canvasHeight / originalHeight;
          const scale = Math.min(scaleX, scaleY); // Use smaller scale to ensure image fits
          
          imageDisplayWidth = originalWidth * scale;
          imageDisplayHeight = originalHeight * scale;
          
          // Center the image horizontally and vertically
          imageX = (canvasWidth - imageDisplayWidth) / 2;
          imageY = (canvasHeight - imageDisplayHeight) / 2;
          
          console.log("[Watermark] Non-square image - fitting with strips:", {
            scale,
            imageDisplayWidth,
            imageDisplayHeight,
            imageX,
            imageY,
            canvasWidth,
            canvasHeight
          });
        }
        
        // Draw original image (no cropping, no stretching)
        ctx.drawImage(img, imageX, imageY, imageDisplayWidth, imageDisplayHeight);
        
        // Draw footer overlay (centered, at the bottom, as overlay on top of image)
        const footerY = canvasHeight - footerHeight;
        
        // Draw gradient background for maximum contrast and visibility
        // Creates a smooth fade from transparent to semi-opaque at the bottom
        const gradient = ctx.createLinearGradient(0, footerY, 0, canvasHeight);
        gradient.addColorStop(0, "rgba(0, 0, 0, 0)"); // Fully transparent at top
        gradient.addColorStop(0.3, "rgba(0, 0, 0, 0.4)"); // Start fading
        gradient.addColorStop(0.7, "rgba(0, 0, 0, 0.75)"); // More opaque
        gradient.addColorStop(1, "rgba(0, 0, 0, 0.85)"); // Most opaque at bottom
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, footerY, canvasWidth, footerHeight);
        
        // Additional solid background for text area for extra contrast
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        const textAreaHeight = storeName ? storeNameHeight + copyrightHeight + lineSpacing + (verticalPadding * 2) : copyrightHeight + (verticalPadding * 2);
        ctx.fillRect(0, canvasHeight - textAreaHeight, canvasWidth, textAreaHeight);
        
        // Configure text rendering
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        
        // Draw store name (if available) - larger, bolder, more prominent
        if (storeName) {
          // White text with strong shadow for maximum contrast
          ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = "#FFFFFF"; // Pure white for maximum contrast
          ctx.font = storeNameFont;
          
          const storeNameY = canvasHeight - copyrightHeight - lineSpacing - verticalPadding;
          ctx.fillText(storeName, canvasWidth / 2, storeNameY);
        }
        
        // Draw copyright text - smaller, below store name
        ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)"; // Slightly transparent white
        ctx.font = copyrightFont;
        
        const copyrightY = canvasHeight - verticalPadding;
        ctx.fillText(copyrightText, canvasWidth / 2, copyrightY);
        
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
