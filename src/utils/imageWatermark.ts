/**
 * Adds header (logo) and footer (copyright text) to an image
 * The final image maintains Instagram's post aspect ratio (1:1 square) for optimal sharing
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

    img.onload = async () => {
      try {
        // Load the logo SVG
        let logoSvgUrl: string;
        try {
          const logoResponse = await fetch("/assets/NUSENSE_LOGO.svg");
          if (!logoResponse.ok) {
            throw new Error("Failed to fetch logo");
          }
          const logoSvgText = await logoResponse.text();
          
          // Create a blob URL for the SVG
          const logoSvgBlob = new Blob([logoSvgText], { type: "image/svg+xml;charset=utf-8" });
          logoSvgUrl = URL.createObjectURL(logoSvgBlob);
        } catch (fetchError) {
          // Fallback: try direct path (may have CORS issues but worth trying)
          logoSvgUrl = "/assets/NUSENSE_LOGO.svg";
        }
        
        // Load logo as image
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        
        logoImg.onload = async () => {
          try {
            // Instagram post aspect ratio: 1:1 (square) for maximum compatibility
            const INSTAGRAM_ASPECT_RATIO = 1; // 1:1 square
            
            // Target dimensions for Instagram (use a standard size, e.g., 1080x1080)
            // We'll scale proportionally based on the original image width
            const originalWidth = img.naturalWidth;
            const originalHeight = img.naturalHeight;
            
            // Calculate header and footer heights first
            const logoAspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
            const headerLogoHeight = Math.min(60, originalWidth * 0.08); // Max 60px or 8% of image width
            const headerLogoWidth = headerLogoHeight * logoAspectRatio;
            const headerPadding = 20;
            
            // Load store logo if available, otherwise prepare store name text
            let storeLogoImg: HTMLImageElement | null = null;
            let storeNameText: string | null = null;
            let storeLogoWidth = 0;
            let storeLogoHeight = 0;
            
            if (storeInfo?.logoUrl) {
              // Try to load store logo
              storeLogoImg = new Image();
              storeLogoImg.crossOrigin = "anonymous";
              try {
                await new Promise<void>((resolve) => {
                  storeLogoImg!.onload = () => {
                    const storeLogoAspectRatio = storeLogoImg!.naturalWidth / storeLogoImg!.naturalHeight;
                    storeLogoHeight = headerLogoHeight; // Match NUSENSE logo height
                    storeLogoWidth = storeLogoHeight * storeLogoAspectRatio;
                    resolve();
                  };
                  storeLogoImg!.onerror = () => {
                    // Fallback to store name if logo fails to load
                    storeLogoImg = null;
                    storeNameText = storeInfo?.name || storeInfo?.domain || null;
                    resolve();
                  };
                  storeLogoImg!.src = storeInfo.logoUrl;
                });
              } catch (error) {
                // Fallback to store name if logo fails to load
                storeLogoImg = null;
                storeNameText = storeInfo?.name || storeInfo?.domain || null;
              }
            } else if (storeInfo?.name || storeInfo?.domain) {
              // Use store name as text fallback
              storeNameText = storeInfo.name || storeInfo.domain || null;
            }
            
            // Calculate spacing between logos (if both exist)
            const logoSpacing = storeLogoImg || storeNameText ? 15 : 0;
            
            // Calculate store name text width if using text fallback
            let storeNameTextWidth = 0;
            if (storeNameText && !storeLogoImg) {
              const tempCanvas = document.createElement("canvas");
              const tempCtx = tempCanvas.getContext("2d");
              if (tempCtx) {
                tempCtx.font = "bold 14px Arial, sans-serif";
                const textMetrics = tempCtx.measureText(storeNameText);
                storeNameTextWidth = textMetrics.width;
              }
            }
            
            const totalHeaderContentWidth = headerLogoWidth + logoSpacing + (storeLogoImg ? storeLogoWidth : storeNameTextWidth);
            
            // Header height: logo height + padding (20px top, 20px bottom)
            const headerHeight = headerLogoHeight + (headerPadding * 2);
            
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
            
            // Calculate final canvas dimensions (maintain Instagram 1:1 aspect ratio)
            // Use original width as base, ensure minimum size for header/footer
            const minCanvasSize = Math.max(originalWidth, headerHeight + footerHeight + 200); // Ensure enough space
            const canvasWidth = Math.max(originalWidth, minCanvasSize);
            const canvasHeight = canvasWidth * INSTAGRAM_ASPECT_RATIO; // Square: height = width
            
            // Calculate content area height (space available for the image between header and footer)
            const contentAreaHeight = canvasHeight - headerHeight - footerHeight;
            
            // Create canvas
            const canvas = document.createElement("canvas");
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext("2d");
            
            if (!ctx) {
              // Clean up blob URL if we created one
              if (logoSvgUrl.startsWith("blob:")) {
                URL.revokeObjectURL(logoSvgUrl);
              }
              reject(new Error("Could not get canvas context"));
              return;
            }
            
            // Fill white background
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            
            // Draw header logos (NUSENSE logo + Store logo/name side by side, centered)
            const headerStartX = (canvasWidth - totalHeaderContentWidth) / 2;
            const logoY = headerPadding;
            
            // Draw NUSENSE logo (left side)
            const nusenseLogoX = headerStartX;
            ctx.drawImage(logoImg, nusenseLogoX, logoY, headerLogoWidth, headerLogoHeight);
            
            // Draw store logo or name (right side of NUSENSE logo)
            if (storeLogoImg) {
              const storeLogoX = nusenseLogoX + headerLogoWidth + logoSpacing;
              ctx.drawImage(storeLogoImg, storeLogoX, logoY, storeLogoWidth, storeLogoHeight);
            } else if (storeNameText) {
              // Draw store name as text
              ctx.fillStyle = "#564646"; // Match logo text color
              ctx.font = "bold 14px Arial, sans-serif";
              ctx.textAlign = "left";
              ctx.textBaseline = "middle";
              const storeNameX = nusenseLogoX + headerLogoWidth + logoSpacing;
              const storeNameY = logoY + (headerLogoHeight / 2);
              ctx.fillText(storeNameText, storeNameX, storeNameY);
            }
            
            // Calculate image dimensions to fit in content area while maintaining aspect ratio
            const originalAspectRatio = originalWidth / originalHeight;
            let imageDisplayWidth = canvasWidth;
            let imageDisplayHeight = contentAreaHeight;
            
            // Fit image to content area while maintaining aspect ratio
            if (originalAspectRatio > (imageDisplayWidth / imageDisplayHeight)) {
              // Image is wider - fit to width, center vertically
              imageDisplayHeight = imageDisplayWidth / originalAspectRatio;
            } else {
              // Image is taller - fit to height, center horizontally
              imageDisplayWidth = imageDisplayHeight * originalAspectRatio;
            }
            
            // Center the image in the content area
            const imageX = (canvasWidth - imageDisplayWidth) / 2;
            const imageY = headerHeight + (contentAreaHeight - imageDisplayHeight) / 2;
            
            // Draw original image (centered in content area, below header)
            ctx.drawImage(img, imageX, imageY, imageDisplayWidth, imageDisplayHeight);
            
            // Draw footer text (centered, at the bottom)
            ctx.fillStyle = "#564646"; // Match logo text color
            ctx.font = "16px Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            const footerTextY = headerHeight + contentAreaHeight + footerPadding + footerTextHeight;
            ctx.fillText(footerText, canvasWidth / 2, footerTextY);
            
            // Convert to blob
            canvas.toBlob((blob) => {
              // Clean up blob URL if we created one
              if (logoSvgUrl.startsWith("blob:")) {
                URL.revokeObjectURL(logoSvgUrl);
              }
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Failed to convert canvas to blob"));
              }
            }, "image/png");
          } catch (error) {
            // Clean up blob URL if we created one
            if (logoSvgUrl.startsWith("blob:")) {
              URL.revokeObjectURL(logoSvgUrl);
            }
            reject(error);
          }
        };
        
        logoImg.onerror = () => {
          // Clean up blob URL if we created one
          if (logoSvgUrl.startsWith("blob:")) {
            URL.revokeObjectURL(logoSvgUrl);
          }
          reject(new Error("Failed to load logo"));
        };
        
        logoImg.src = logoSvgUrl;
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

