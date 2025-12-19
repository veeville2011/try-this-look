/**
 * Adds footer (copyright text) to an image
 * The final image maintains Instagram's post aspect ratio (1:1 square) for optimal sharing
 * 
 * If the image is already square (1:1), it's used as-is without cropping, stretching, or decorations.
 * If the image is not square, it's fitted within the square canvas without cropping/stretching,
 * and Christmas-themed decorations fill the empty space areas instead of white bars.
 */

/**
 * Draw Christmas decorations in empty space areas
 */
function drawChristmasDecorations(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  imageX: number,
  imageY: number,
  imageWidth: number,
  imageHeight: number
): void {
  // Calculate empty space areas
  const leftSpace = imageX;
  const rightSpace = canvasWidth - (imageX + imageWidth);
  const topSpace = imageY;
  const bottomSpace = canvasHeight - (imageY + imageHeight);
  
  // Draw decorations in side spaces (left and right)
  if (leftSpace > 0) {
    drawSideDecorations(ctx, 0, 0, leftSpace, canvasHeight);
  }
  if (rightSpace > 0) {
    drawSideDecorations(ctx, canvasWidth - rightSpace, 0, rightSpace, canvasHeight);
  }
  
  // Draw decorations in top/bottom spaces
  if (topSpace > 0) {
    drawTopBottomDecorations(ctx, imageX, 0, imageWidth, topSpace);
  }
  if (bottomSpace > 0) {
    drawTopBottomDecorations(ctx, imageX, canvasHeight - bottomSpace, imageWidth, bottomSpace);
  }
}

/**
 * Draw Christmas decorations for side spaces (left/right)
 */
function drawSideDecorations(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const spacing = 80; // Space between decorations
  const decorationSize = Math.min(width * 0.6, 40);
  
  for (let posY = spacing; posY < height - spacing; posY += spacing) {
    const centerX = x + width / 2;
    const centerY = posY + (Math.random() * 20 - 10); // Slight random offset
    
    // Randomly choose decoration type
    const decorationType = Math.random();
    if (decorationType < 0.3) {
      drawSnowflake(ctx, centerX, centerY, decorationSize);
    } else if (decorationType < 0.6) {
      drawChristmasOrnament(ctx, centerX, centerY, decorationSize);
    } else {
      drawStar(ctx, centerX, centerY, decorationSize);
    }
  }
}

/**
 * Draw Christmas decorations for top/bottom spaces
 */
function drawTopBottomDecorations(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const spacing = 100;
  const decorationSize = Math.min(height * 0.7, 35);
  
  for (let posX = spacing; posX < width - spacing; posX += spacing) {
    const centerX = x + posX + (Math.random() * 20 - 10);
    const centerY = y + height / 2;
    
    const decorationType = Math.random();
    if (decorationType < 0.4) {
      drawSnowflake(ctx, centerX, centerY, decorationSize);
    } else if (decorationType < 0.7) {
      drawStar(ctx, centerX, centerY, decorationSize);
    } else {
      drawSparkle(ctx, centerX, centerY, decorationSize * 0.8);
    }
  }
}

/**
 * Draw a snowflake
 */
function drawSnowflake(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#E3F2FD"; // Light blue
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  const branches = 6;
  for (let i = 0; i < branches; i++) {
    ctx.rotate((Math.PI * 2) / branches);
    ctx.moveTo(0, 0);
    ctx.lineTo(size / 2, 0);
    ctx.moveTo(size / 3, 0);
    ctx.lineTo(size / 3, -size / 6);
    ctx.lineTo(size / 3, size / 6);
  }
  
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a Christmas ornament/ball
 */
function drawChristmasOrnament(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  
  // Ornament colors (randomly choose)
  const colors = ["#E53935", "#1976D2", "#FDD835", "#43A047", "#FB8C00"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  // Draw ornament body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, size / 4, size / 2, size / 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw highlight
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.beginPath();
  ctx.ellipse(-size / 6, -size / 8, size / 6, size / 8, -0.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw top hook
  ctx.fillStyle = "#FFD700"; // Gold
  ctx.fillRect(-size / 12, -size / 2, size / 6, size / 4);
  
  ctx.restore();
}

/**
 * Draw a star
 */
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#FFD700"; // Gold
  ctx.strokeStyle = "#FFA000"; // Darker gold
  ctx.lineWidth = 1;
  
  const spikes = 5;
  const outerRadius = size / 2;
  const innerRadius = size / 4;
  
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Draw a sparkle/glitter
 */
function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#FFF9C4"; // Light yellow
  ctx.strokeStyle = "#FFD700"; // Gold
  
  // Draw cross shape
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-size / 2, 0);
  ctx.lineTo(size / 2, 0);
  ctx.moveTo(0, -size / 2);
  ctx.lineTo(0, size / 2);
  ctx.stroke();
  
  // Draw small circles at ends
  ctx.beginPath();
  ctx.arc(-size / 2, 0, size / 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(size / 2, 0, size / 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -size / 2, size / 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, size / 2, size / 8, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

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
        // If image is already square, use its dimensions; otherwise use minimum Instagram size
        let canvasWidth: number;
        let canvasHeight: number;
        
        if (isSquare) {
          // Image is already square - use its dimensions directly (no cropping/stretching needed)
          // Ensure minimum Instagram size (1080x1080)
          canvasWidth = Math.max(originalWidth, 1080); // Minimum 1080px for Instagram
          canvasHeight = canvasWidth; // Maintain square (1:1)
        } else {
          // Image is not square - use minimum Instagram size
          // Note: This should not happen if API generates square images, but handle gracefully
          canvasWidth = Math.max(originalWidth, 1080); // Minimum 1080px for Instagram
          canvasHeight = canvasWidth * INSTAGRAM_ASPECT_RATIO; // Square: height = width
        }
        
        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        
        // Calculate image dimensions first
        let imageDisplayWidth: number;
        let imageDisplayHeight: number;
        let imageX: number;
        let imageY: number;
        
        if (isSquare) {
          // Image is already square - scale to fit canvas while maintaining square aspect ratio
          // No cropping, no stretching, no decorations needed
          // Since both image and canvas are square, scale proportionally
          const scale = canvasWidth / originalWidth;
          imageDisplayWidth = originalWidth * scale;
          imageDisplayHeight = originalHeight * scale; // Same as width since it's square
          imageX = 0;
          imageY = 0;
        } else {
          // Image is not square - fit image within square without cropping/stretching
          // This will result in empty space that we'll fill with Christmas decorations
          const scaleX = canvasWidth / originalWidth;
          const scaleY = canvasHeight / originalHeight;
          const scale = Math.min(scaleX, scaleY); // Use smaller scale to ensure image fits
          
          imageDisplayWidth = originalWidth * scale;
          imageDisplayHeight = originalHeight * scale;
          
          // Center the image in the canvas
          imageX = (canvasWidth - imageDisplayWidth) / 2;
          imageY = (canvasHeight - imageDisplayHeight) / 2;
        }
        
        // Fill background with festive Christmas gradient
        const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
        gradient.addColorStop(0, "#E8F5E9"); // Light green
        gradient.addColorStop(0.5, "#FFF9C4"); // Light yellow/gold
        gradient.addColorStop(1, "#FFEBEE"); // Light pink/red
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Draw original image first (no cropping, no stretching)
        ctx.drawImage(img, imageX, imageY, imageDisplayWidth, imageDisplayHeight);
        
        // Draw Christmas decorations in empty space areas (after image so they're visible)
        if (!isSquare) {
          drawChristmasDecorations(ctx, canvasWidth, canvasHeight, imageX, imageY, imageDisplayWidth, imageDisplayHeight);
        }
        
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
