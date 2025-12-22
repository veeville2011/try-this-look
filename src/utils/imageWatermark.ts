/**
 * Adds watermark (store name and copyright text) to an image
 * The final image is cropped to fit Instagram's shareable aspect ratios (no white strips).
 * Instagram supports: Square (1:1), Portrait (4:5), and Landscape (1.91:1)
 * The image is cropped to the closest matching aspect ratio and scaled to meet minimum quality (1080px).
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
        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;
        const originalAspectRatio = originalWidth / originalHeight;
        
        // Instagram shareable aspect ratios
        const INSTAGRAM_SQUARE = 1; // 1:1 (1080x1080)
        const INSTAGRAM_PORTRAIT = 0.8; // 4:5 (1080x1350)
        const INSTAGRAM_LANDSCAPE = 1.91; // 1.91:1 (1080x566)
        
        // Determine which Instagram aspect ratio is closest to the original
        const squareDiff = Math.abs(originalAspectRatio - INSTAGRAM_SQUARE);
        const portraitDiff = Math.abs(originalAspectRatio - INSTAGRAM_PORTRAIT);
        const landscapeDiff = Math.abs(originalAspectRatio - INSTAGRAM_LANDSCAPE);
        
        let targetAspectRatio: number;
        let targetRatioName: string;
        
        if (squareDiff <= portraitDiff && squareDiff <= landscapeDiff) {
          targetAspectRatio = INSTAGRAM_SQUARE;
          targetRatioName = "square";
        } else if (portraitDiff <= landscapeDiff) {
          targetAspectRatio = INSTAGRAM_PORTRAIT;
          targetRatioName = "portrait";
        } else {
          targetAspectRatio = INSTAGRAM_LANDSCAPE;
          targetRatioName = "landscape";
        }
        
        // Debug logging
        console.log("[Watermark] Image dimensions:", {
          width: originalWidth,
          height: originalHeight,
          aspectRatio: originalAspectRatio,
          targetRatio: targetRatioName,
          targetAspectRatio
        });
        
        // Calculate crop area from original image to fit Instagram aspect ratio
        // Center crop: crop from center of the image
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = originalWidth;
        let sourceHeight = originalHeight;
        
        const sourceAspectRatio = originalWidth / originalHeight;
        
        if (sourceAspectRatio > targetAspectRatio) {
          // Original is wider than target - crop width (center horizontally)
          sourceWidth = Math.round(originalHeight * targetAspectRatio);
          sourceX = Math.round((originalWidth - sourceWidth) / 2);
        } else if (sourceAspectRatio < targetAspectRatio) {
          // Original is taller than target - crop height (center vertically)
          sourceHeight = Math.round(originalWidth / targetAspectRatio);
          sourceY = Math.round((originalHeight - sourceHeight) / 2);
        }
        // If aspect ratios match, no cropping needed
        
        // Calculate canvas dimensions for Instagram aspect ratio
        // Use cropped source dimensions and ensure minimum size (1080px on the appropriate dimension)
        const minSize = 1080;
        let canvasWidth: number;
        let canvasHeight: number;
        
        if (targetAspectRatio >= 1) {
          // Square or Landscape: use width as reference
          canvasWidth = Math.max(sourceWidth, minSize);
          canvasHeight = Math.round(canvasWidth / targetAspectRatio);
        } else {
          // Portrait: use height as reference
          canvasHeight = Math.max(sourceHeight, minSize);
          canvasWidth = Math.round(canvasHeight * targetAspectRatio);
        }
        
        // Watermark configuration
        const storeName = storeInfo?.name || null;
        const copyrightText = "© 2025 NUSENSE. Tous droits réservés.";
        
        // Font sizes and spacing (responsive to canvasWidth)
        const storeNameFontSize = Math.max(18, canvasWidth / 60); // Responsive: ~18px at 1080px width
        const copyrightFontSize = Math.max(14, canvasWidth / 77); // Responsive: ~14px at 1080px width
        const storeNameFont = `600 ${storeNameFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
        const copyrightFont = `${copyrightFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
        
        // Padding for top-right corner and footer
        const cornerPadding = Math.max(16, canvasWidth / 67.5); // Padding for top-right corner
        const verticalPadding = Math.max(16, canvasWidth / 67.5); // Responsive padding for footer
        
        // Measure text accurately using a temporary canvas
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");
        let storeNameWidth = 0;
        let storeNameHeight = 0;
        let storeNameAscent = 0;
        let copyrightHeight = 20; // Default fallback
        
        if (tempCtx) {
          // Measure store name (for top-right corner)
          if (storeName) {
            tempCtx.font = storeNameFont;
            const storeNameMetrics = tempCtx.measureText(storeName);
            storeNameWidth = Math.ceil(storeNameMetrics.width) || 100;
            storeNameAscent = Math.ceil(storeNameMetrics.actualBoundingBoxAscent || 16) || 16;
            const storeNameDescent = Math.ceil(storeNameMetrics.actualBoundingBoxDescent || 4) || 4;
            storeNameHeight = storeNameAscent + storeNameDescent;
          }
          
          // Measure copyright (for footer)
          tempCtx.font = copyrightFont;
          const copyrightMetrics = tempCtx.measureText(copyrightText);
          copyrightHeight = Math.ceil(
            (copyrightMetrics.actualBoundingBoxAscent || 12) + 
            (copyrightMetrics.actualBoundingBoxDescent || 4)
          ) || 18;
        }
        
        // Calculate footer height (only copyright text now)
        const footerHeight = verticalPadding * 2 + copyrightHeight;
        
        // Create canvas with Instagram aspect ratio dimensions
        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        
        // Draw cropped image to fill entire canvas (no white strips)
        // Crop from center of original image to match Instagram aspect ratio
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight, // Source rectangle (cropped area)
          0, 0, canvasWidth, canvasHeight // Destination rectangle (full canvas)
        );
        
        // Draw store name in top-right corner (if available)
        if (storeName) {
          // Draw background for store name (rounded rectangle with gradient for contrast)
          const backgroundPadding = Math.max(8, canvasWidth / 135); // Padding around text (equal on all sides)
          const backgroundWidth = storeNameWidth + (backgroundPadding * 2);
          const backgroundHeight = storeNameHeight + (backgroundPadding * 2);
          const backgroundX = canvasWidth - backgroundWidth - cornerPadding;
          const backgroundY = cornerPadding;
          const borderRadius = Math.max(4, canvasWidth / 270); // Rounded corners
          
          // Calculate text position - centered vertically within the background
          // Using top baseline, position text at top padding + ascent from top of background
          const storeNameX = canvasWidth - cornerPadding - backgroundPadding; // Right-aligned with padding
          const storeNameY = backgroundY + backgroundPadding; // Top padding from background top
          
          // Draw rounded rectangle background with light gradient for maximum contrast
          const cornerGradient = ctx.createLinearGradient(
            backgroundX, backgroundY,
            backgroundX, backgroundY + backgroundHeight
          );
          cornerGradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
          cornerGradient.addColorStop(1, "rgba(255, 255, 255, 0.98)");
          
          // Draw rounded rectangle background
          ctx.beginPath();
          // Top-left corner
          ctx.moveTo(backgroundX + borderRadius, backgroundY);
          // Top edge
          ctx.lineTo(backgroundX + backgroundWidth - borderRadius, backgroundY);
          // Top-right corner
          ctx.arc(backgroundX + backgroundWidth - borderRadius, backgroundY + borderRadius, borderRadius, -Math.PI / 2, 0);
          // Right edge
          ctx.lineTo(backgroundX + backgroundWidth, backgroundY + backgroundHeight - borderRadius);
          // Bottom-right corner
          ctx.arc(backgroundX + backgroundWidth - borderRadius, backgroundY + backgroundHeight - borderRadius, borderRadius, 0, Math.PI / 2);
          // Bottom edge
          ctx.lineTo(backgroundX + borderRadius, backgroundY + backgroundHeight);
          // Bottom-left corner
          ctx.arc(backgroundX + borderRadius, backgroundY + backgroundHeight - borderRadius, borderRadius, Math.PI / 2, Math.PI);
          // Left edge
          ctx.lineTo(backgroundX, backgroundY + borderRadius);
          // Top-left corner
          ctx.arc(backgroundX + borderRadius, backgroundY + borderRadius, borderRadius, Math.PI, -Math.PI / 2);
          ctx.closePath();
          
          ctx.fillStyle = cornerGradient;
          ctx.fill();
          
          // Configure text rendering for top-right corner
          ctx.textAlign = "right";
          ctx.textBaseline = "top"; // Use top baseline for consistent vertical positioning
          ctx.shadowColor = "rgba(0, 0, 0, 0.3)"; // Dark shadow for dark text on light background
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 1;
          ctx.fillStyle = "#1E293B"; // Dark slate for maximum contrast on light background
          ctx.font = storeNameFont;
          
          // Draw store name text - positioned with equal padding top and bottom
          // The text will be drawn from its top, so storeNameY is at top padding
          // Since backgroundHeight = storeNameHeight + (backgroundPadding * 2),
          // this ensures equal padding on top and bottom
          ctx.fillText(storeName, storeNameX, storeNameY);
        }
        
        // Draw footer overlay (centered, at the bottom, as overlay on top of image)
        const footerY = canvasHeight - footerHeight;
        
        // Draw gradient background for maximum contrast and visibility (light theme)
        // Creates a smooth fade from transparent to semi-opaque light at the bottom
        const footerGradient = ctx.createLinearGradient(0, footerY, 0, canvasHeight);
        footerGradient.addColorStop(0, "rgba(255, 255, 255, 0)"); // Fully transparent at top
        footerGradient.addColorStop(0.3, "rgba(255, 255, 255, 0.4)"); // Start fading
        footerGradient.addColorStop(0.7, "rgba(255, 255, 255, 0.75)"); // More opaque
        footerGradient.addColorStop(1, "rgba(255, 255, 255, 0.95)"); // Most opaque at bottom
        
        ctx.fillStyle = footerGradient;
        ctx.fillRect(0, footerY, canvasWidth, footerHeight);
        
        // Additional solid background for text area for extra contrast (light theme)
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        const textAreaHeight = copyrightHeight + (verticalPadding * 2);
        ctx.fillRect(0, canvasHeight - textAreaHeight, canvasWidth, textAreaHeight);
        
        // Configure text rendering for footer
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.shadowColor = "rgba(0, 0, 0, 0.25)"; // Dark shadow for dark text on light background
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = "#1E293B"; // Dark slate for maximum contrast on light background (fully opaque)
        ctx.font = copyrightFont;
        
        // Draw copyright text in footer
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
