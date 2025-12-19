/**
 * Adds header (logo) and footer (copyright text) to an image
 * The header and footer extend the image, not cutting it
 */

export async function addWatermarkToImage(imageUrl: string): Promise<Blob> {
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
        
        logoImg.onload = () => {
          try {
            // Calculate dimensions
            const originalWidth = img.naturalWidth;
            const originalHeight = img.naturalHeight;
            
            // Header height: logo height + padding (20px top, 20px bottom)
            const logoAspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
            const headerLogoHeight = Math.min(60, originalWidth * 0.08); // Max 60px or 8% of image width
            const headerLogoWidth = headerLogoHeight * logoAspectRatio;
            const headerPadding = 20;
            const headerHeight = headerLogoHeight + (headerPadding * 2);
            
            // Footer height: text height + padding (20px top, 20px bottom)
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
            
            // Total canvas dimensions
            const canvasWidth = originalWidth;
            const canvasHeight = originalHeight + headerHeight + footerHeight;
            
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
            
            // Draw header logo (centered)
            const logoX = (canvasWidth - headerLogoWidth) / 2;
            const logoY = headerPadding;
            ctx.drawImage(logoImg, logoX, logoY, headerLogoWidth, headerLogoHeight);
            
            // Draw original image (below header)
            ctx.drawImage(img, 0, headerHeight, originalWidth, originalHeight);
            
            // Draw footer text (centered, below image)
            ctx.fillStyle = "#564646"; // Match logo text color
            ctx.font = "16px Arial, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic"; // Use alphabetic baseline for more accurate positioning
            const footerTextY = headerHeight + originalHeight + footerPadding + footerTextHeight;
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

