# 🎨 Canvas Positioning & Coordinate System Guide

## Overview

The `PersonDetector` component uses a **three-layer coordinate system** to handle image display, detection visualization, and click interactions:

1. **Original Image Coordinates** - The actual image dimensions (e.g., 3000×2000px)
2. **Canvas Coordinates** - Scaled display dimensions (max 1200×800px)
3. **Screen/Click Coordinates** - Browser viewport coordinates

---

## 📐 Coordinate Transformation Flow

```
Original Image (3000×2000px)
    ↓ [Scale Calculation]
Canvas Display (1200×800px)
    ↓ [CSS Scaling]
Screen Display (varies by viewport)
    ↓ [Click Event]
Click Coordinates (converted back)
```

---

## 🔍 Step-by-Step Breakdown

### Step 1: Scale Calculation (Lines 304-317)

```typescript
// Calculate scaling to fit canvas while maintaining aspect ratio
const maxWidth = 1200
const maxHeight = 800
let scale = 1
let displayWidth = img.width
let displayHeight = img.height

if (img.width > maxWidth || img.height > maxHeight) {
  const widthScale = maxWidth / img.width      // e.g., 1200 / 3000 = 0.4
  const heightScale = maxHeight / img.height   // e.g., 800 / 2000 = 0.4
  scale = Math.min(widthScale, heightScale)    // Use smaller scale to fit both dimensions
  displayWidth = img.width * scale             // 3000 * 0.4 = 1200
  displayHeight = img.height * scale            // 2000 * 0.4 = 800
}
```

**Example:**
- Original Image: 3000×2000px
- Max Canvas: 1200×800px
- Scale: `min(1200/3000, 800/2000) = min(0.4, 0.4) = 0.4`
- Canvas Size: 1200×800px (fits within max)

**If image is smaller:**
- Original Image: 800×600px
- Max Canvas: 1200×800px
- Scale: `1` (no scaling needed)
- Canvas Size: 800×600px (original size)

---

### Step 2: Canvas Setup (Lines 319-323)

```typescript
canvas.width = displayWidth   // Set canvas internal resolution
canvas.height = displayHeight

// Draw scaled image at (0, 0) filling entire canvas
ctx.drawImage(img, 0, 0, displayWidth, displayHeight)
```

**Key Points:**
- Canvas internal size = scaled image size
- Image drawn from (0,0) to fill entire canvas
- Aspect ratio preserved

---

### Step 3: Bounding Box Scaling (Lines 328-333, 368-372)

```typescript
// Person bounding boxes (in original image coordinates)
people.forEach((person, idx) => {
  const [x, y, width, height] = person.bbox  // Original coordinates
  const scaledX = x * scale                  // Scale to canvas coordinates
  const scaledY = y * scale
  const scaledWidth = width * scale
  const scaledHeight = height * scale
  
  // Draw on canvas using scaled coordinates
  ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight)
})
```

**Example:**
- Original bbox: `[1000, 500, 400, 600]` (x, y, width, height)
- Scale: `0.4`
- Scaled bbox: `[400, 200, 160, 240]`
- Drawn at canvas position (400, 200) with size 160×240

---

### Step 4: Click Coordinate Conversion (Lines 687-709)

The click handler converts screen coordinates through multiple transformations:

```typescript
onClick={(e) => {
  const canvas = canvasRef.current
  const rect = canvas.getBoundingClientRect()  // Screen position of canvas
  
  // Step 1: Convert screen click to canvas coordinates
  const scaleX = canvas.width / rect.width     // Canvas internal / CSS display width
  const scaleY = canvas.height / rect.height   // Canvas internal / CSS display height
  
  const x = (e.clientX - rect.left) * scaleX   // Click X in canvas coordinates
  const y = (e.clientY - rect.top) * scaleY    // Click Y in canvas coordinates
  
  // Step 2: Calculate image-to-canvas scale (same as drawBoxes)
  const maxWidth = 1200
  const maxHeight = 800
  const img = imageRef.current
  let scale = 1
  if (img.width > maxWidth || img.height > maxHeight) {
    const widthScale = maxWidth / img.width
    const heightScale = maxHeight / img.height
    scale = Math.min(widthScale, heightScale)
  }
  
  // Step 3: Compare click coordinates with scaled bounding boxes
  detectionResult.people.forEach((person, idx) => {
    const [px, py, pwidth, pheight] = person.bbox
    const scaledX = px * scale      // Same scale as drawing
    const scaledY = py * scale
    const scaledWidth = pwidth * scale
    const scaledHeight = pheight * scale
    
    // Check if click is within scaled bounding box
    if (x >= scaledX && x <= scaledX + scaledWidth &&
        y >= scaledY && y <= scaledY + scaledHeight) {
      // Click detected!
    }
  })
}}
```

---

## 🎯 Visual Example

### Scenario: 3000×2000px Image with Person at (1000, 500, 400, 600)

```
┌─────────────────────────────────────────────────────────┐
│                    ORIGINAL IMAGE                       │
│                    3000 × 2000px                        │
│                                                          │
│         ┌──────────┐                                    │
│         │  Person  │  ← Bbox: [1000, 500, 400, 600]    │
│         │          │                                    │
│         └──────────┘                                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
                    ↓ Scale: 0.4
┌──────────────────────────────────────┐
│         CANVAS (1200 × 800px)        │
│                                      │
│    ┌──────┐                          │
│    │Person│  ← Scaled: [400, 200, 160, 240]            │
│    │      │                          │
│    └──────┘                          │
│                                      │
└──────────────────────────────────────┘
                    ↓ CSS Display
┌──────────────────────────────────────┐
│    SCREEN (may be smaller/larger)     │
│    User clicks here →                 │
│                                      │
│    Click at screen (500, 300)        │
│    → Converted to canvas (400, 200)  │
│    → Matches person bbox! ✅         │
└──────────────────────────────────────┘
```

---

## 🔧 Key Functions

### 1. `drawBoxes()` - Drawing Function

**Purpose:** Draw image and bounding boxes on canvas

**Coordinate Flow:**
```
Original Image Coords → Scale Factor → Canvas Coords → Draw
```

**Code Location:** Lines 293-395

**Key Variables:**
- `scale`: Image-to-canvas scaling factor (0-1)
- `displayWidth/Height`: Canvas dimensions
- `scaledX/Y/Width/Height`: Bounding box coordinates on canvas

---

### 2. Click Handler - Interaction Function

**Purpose:** Convert screen clicks to canvas coordinates and detect hits

**Coordinate Flow:**
```
Screen Coords → Canvas Coords → Compare with Scaled Bboxes
```

**Code Location:** Lines 687-749

**Key Variables:**
- `rect`: Canvas bounding box in screen coordinates
- `scaleX/scaleY`: Screen-to-canvas conversion factors
- `x, y`: Click position in canvas coordinates
- `scale`: Image-to-canvas scale (must match drawBoxes)

---

## ⚠️ Important Considerations

### 1. Scale Consistency

**Critical:** The `scale` variable used in click handler **must match** the scale used in `drawBoxes()`.

```typescript
// ✅ CORRECT: Same scale calculation in both places
const scale = Math.min(maxWidth / img.width, maxHeight / img.height)

// ❌ WRONG: Different scales will cause misalignment
// In drawBoxes: scale = 0.4
// In click handler: scale = 0.5  // Bounding boxes won't match!
```

### 2. CSS Scaling

The canvas may be further scaled by CSS:

```typescript
// Canvas internal size: 1200×800px
canvas.width = 1200
canvas.height = 800

// CSS display size: 600×400px (50% scale)
<canvas style={{ width: '600px', height: '400px' }} />
```

The click handler accounts for this with:
```typescript
const scaleX = canvas.width / rect.width   // 1200 / 600 = 2.0
const scaleY = canvas.height / rect.height // 800 / 400 = 2.0
```

### 3. Aspect Ratio Preservation

The scale calculation uses `Math.min()` to preserve aspect ratio:

```typescript
// Wide image: 2000×1000px
widthScale = 1200 / 2000 = 0.6
heightScale = 800 / 1000 = 0.8
scale = min(0.6, 0.8) = 0.6  // Uses smaller value
// Result: 1200×600px (fits width, height scales proportionally)

// Tall image: 1000×2000px
widthScale = 1200 / 1000 = 1.2  // Would exceed max
heightScale = 800 / 2000 = 0.4
scale = min(1.2, 0.4) = 0.4  // Uses smaller value
// Result: 400×800px (fits height, width scales proportionally)
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Clicks Not Registering

**Symptom:** Clicking on bounding boxes doesn't select person

**Cause:** Scale mismatch between drawBoxes and click handler

**Solution:** Ensure both use identical scale calculation:
```typescript
// Extract to shared function
const calculateScale = (img: HTMLImageElement) => {
  const maxWidth = 1200
  const maxHeight = 800
  if (img.width > maxWidth || img.height > maxHeight) {
    return Math.min(maxWidth / img.width, maxHeight / img.height)
  }
  return 1
}
```

### Issue 2: Bounding Boxes Off-Position

**Symptom:** Boxes drawn in wrong location

**Cause:** Forgetting to scale coordinates

**Solution:** Always multiply original coordinates by scale:
```typescript
// ❌ WRONG
ctx.strokeRect(x, y, width, height)  // Uses original coords

// ✅ CORRECT
ctx.strokeRect(x * scale, y * scale, width * scale, height * scale)
```

### Issue 3: Click Detection Wrong on Resized Canvas

**Symptom:** Clicks work at one size but not when canvas is resized

**Cause:** Not accounting for CSS scaling

**Solution:** Always use `getBoundingClientRect()`:
```typescript
// ❌ WRONG: Assumes canvas.width === screen width
const x = e.clientX - canvas.offsetLeft

// ✅ CORRECT: Accounts for CSS scaling
const rect = canvas.getBoundingClientRect()
const scaleX = canvas.width / rect.width
const x = (e.clientX - rect.left) * scaleX
```

---

## 📊 Coordinate System Summary

| Coordinate System | Example Values | Description |
|------------------|----------------|-------------|
| **Original Image** | 3000×2000px | Actual image dimensions |
| **Detection Bbox** | [1000, 500, 400, 600] | Person position in original image |
| **Scale Factor** | 0.4 | Reduction factor (maxWidth/imgWidth) |
| **Canvas Size** | 1200×800px | Internal canvas resolution |
| **Scaled Bbox** | [400, 200, 160, 240] | Bbox position on canvas |
| **Screen Position** | (500, 300) | Click position in viewport |
| **Canvas Position** | (400, 200) | Click position in canvas coords |

---

## 🔄 Complete Transformation Chain

```
1. Original Image: 3000×2000px
   Person at: [1000, 500, 400, 600]

2. Calculate Scale:
   scale = min(1200/3000, 800/2000) = 0.4

3. Canvas Setup:
   canvas.width = 1200
   canvas.height = 800

4. Draw Image:
   ctx.drawImage(img, 0, 0, 1200, 800)

5. Draw Bounding Box:
   scaledX = 1000 * 0.4 = 400
   scaledY = 500 * 0.4 = 200
   scaledWidth = 400 * 0.4 = 160
   scaledHeight = 600 * 0.4 = 240
   ctx.strokeRect(400, 200, 160, 240)

6. Handle Click:
   Screen click: (500, 300)
   Canvas rect: {left: 100, top: 50, width: 600, height: 400}
   scaleX = 1200 / 600 = 2.0
   scaleY = 800 / 400 = 2.0
   Canvas click: ((500-100)*2, (300-50)*2) = (800, 500)
   
   But wait! Canvas click (800, 500) doesn't match scaled bbox (400, 200)...
   This is because we need to use the SAME scale from drawBoxes!
   
   Correct approach:
   scale = 0.4 (from drawBoxes)
   Scaled bbox: [400, 200, 160, 240]
   Canvas click: (800, 500) in canvas coords
   Need to convert canvas coords to original image coords first:
   originalX = 800 / 0.4 = 2000
   originalY = 500 / 0.4 = 1250
   
   Or better: Compare directly in canvas coordinates:
   Canvas click: (800, 500)
   Scaled bbox: [400, 200, 160, 240]
   Check: 800 >= 400 && 800 <= 560 && 500 >= 200 && 500 <= 440
   Result: ✅ Click is within bbox!
```

---

## 💡 Best Practices

1. **Extract Scale Calculation:** Create a shared function to avoid inconsistencies
2. **Use Canvas Coordinates:** Always work in canvas coordinate space for comparisons
3. **Account for CSS Scaling:** Use `getBoundingClientRect()` for accurate click detection
4. **Test with Different Image Sizes:** Verify scaling works for both large and small images
5. **Preserve Aspect Ratio:** Always use `Math.min()` when calculating scale
6. **Handle Visibility Changes:** Redraw canvas when component becomes visible again
7. **Verify Image Load:** Always check image.complete before drawing
8. **Persist State:** Store detection results for recovery after refresh

---

## 🔄 Handling Refresh & Popup Scenarios

### Problem: Bounding Boxes Disappear After Refresh/Popup Close

When a page refreshes or a popup closes and reopens, several issues can occur:

1. **Image URL Lost**: `imageUrl` state is lost, so canvas can't redraw
2. **Detection Results Lost**: `detectionResult` state is cleared
3. **Canvas Not Redrawn**: Even if state exists, canvas isn't redrawn automatically
4. **Image Not Loaded**: Canvas tries to draw before image is ready
5. **Scale Mismatch**: Canvas dimensions change but scale isn't recalculated

### Solution: Comprehensive State Management & Redraw Logic

#### 1. Extract Scale Calculation Function

```typescript
// Create a shared utility function
const calculateImageScale = (
  imgWidth: number,
  imgHeight: number,
  maxWidth: number = 1200,
  maxHeight: number = 800
): number => {
  if (imgWidth > maxWidth || imgHeight > maxHeight) {
    const widthScale = maxWidth / imgWidth
    const heightScale = maxHeight / imgHeight
    return Math.min(widthScale, heightScale)
  }
  return 1
}
```

#### 2. Enhanced drawBoxes with Validation

```typescript
const drawBoxes = (
  img: HTMLImageElement | null,
  people: Detection[],
  faces: DetectedFace[] = []
) => {
  const canvas = canvasRef.current
  if (!canvas) {
    console.warn('Canvas ref not available')
    return
  }

  // CRITICAL: Verify image is loaded and valid
  if (!img) {
    console.warn('Image not available for drawing')
    return
  }

  // CRITICAL: Check if image is fully loaded
  if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
    console.warn('Image not fully loaded, waiting...')
    // Wait for image to load
    img.onload = () => {
      drawBoxes(img, people, faces)
    }
    return
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.warn('Could not get canvas context')
    return
  }

  // Calculate scale using shared function
  const scale = calculateImageScale(img.width, img.height)
  const displayWidth = img.width * scale
  const displayHeight = img.height * scale

  // Set canvas size
  canvas.width = displayWidth
  canvas.height = displayHeight

  // Clear canvas before drawing
  ctx.clearRect(0, 0, displayWidth, displayHeight)

  // Draw scaled image
  ctx.drawImage(img, 0, 0, displayWidth, displayHeight)

  // Draw bounding boxes (existing code)...
  people.forEach((person, idx) => {
    const [x, y, width, height] = person.bbox
    const scaledX = x * scale
    const scaledY = y * scale
    const scaledWidth = width * scale
    const scaledHeight = height * scale
    
    // Draw boxes...
  })
}
```

#### 3. Add useEffect for Canvas Redraw

```typescript
// Redraw canvas when detection result changes
useEffect(() => {
  if (detectionResult && imageRef.current && imageUrl) {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (imageRef.current && detectionResult) {
        drawBoxes(
          imageRef.current,
          detectionResult.people,
          detectionResult.faces
        )
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }
}, [detectionResult, imageUrl])

// Redraw canvas when component becomes visible (popup reopen)
useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden && detectionResult && imageRef.current) {
      // Component is visible again, redraw canvas
      setTimeout(() => {
        if (imageRef.current && detectionResult) {
          drawBoxes(
            imageRef.current,
            detectionResult.people,
            detectionResult.faces
          )
        }
      }, 100)
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [detectionResult])

// Redraw canvas on window resize
useEffect(() => {
  const handleResize = () => {
    if (detectionResult && imageRef.current) {
      // Debounce resize events
      const timer = setTimeout(() => {
        if (imageRef.current && detectionResult) {
          drawBoxes(
            imageRef.current,
            detectionResult.people,
            detectionResult.faces
          )
        }
      }, 250)
      
      return () => clearTimeout(timer)
    }
  }

  window.addEventListener('resize', handleResize)
  return () => {
    window.removeEventListener('resize', handleResize)
  }
}, [detectionResult])
```

#### 4. State Persistence for Refresh Recovery

```typescript
// Save detection results to localStorage
useEffect(() => {
  if (detectionResult && imageUrl) {
    try {
      // Store detection results (without image data)
      const dataToStore = {
        people: detectionResult.people,
        faces: detectionResult.faces.map(face => ({
          bbox: face?.bbox,
          confidence: face?.confidence,
          identifiedName: face?.identifiedName,
          matchConfidence: face?.matchConfidence
          // Don't store descriptor (too large)
        })),
        inferenceTime: detectionResult.inferenceTime,
        faceRecognitionTime: detectionResult.faceRecognitionTime,
        imageUrl: imageUrl, // Store URL for recovery
        timestamp: Date.now()
      }
      localStorage.setItem('personDetectionResult', JSON.stringify(dataToStore))
    } catch (error) {
      console.warn('Failed to save detection results:', error)
    }
  }
}, [detectionResult, imageUrl])

// Restore detection results on mount
useEffect(() => {
  try {
    const stored = localStorage.getItem('personDetectionResult')
    if (stored) {
      const data = JSON.parse(stored)
      // Check if data is recent (less than 1 hour old)
      if (Date.now() - data.timestamp < 3600000) {
        // Restore image URL
        if (data.imageUrl) {
          setImageUrl(data.imageUrl)
          
          // Load image
          const img = new Image()
          img.src = data.imageUrl
          img.onload = () => {
            imageRef.current = img
            // Restore detection results
            setDetectionResult({
              people: data.people,
              faces: data.faces.map((face: any) => 
                face ? {
                  bbox: face.bbox,
                  confidence: face.confidence,
                  identifiedName: face.identifiedName,
                  matchConfidence: face.matchConfidence
                } : null
              ),
              inferenceTime: data.inferenceTime,
              faceRecognitionTime: data.faceRecognitionTime
            })
            
            // Redraw canvas after image loads
            setTimeout(() => {
              if (imageRef.current) {
                drawBoxes(
                  imageRef.current,
                  data.people,
                  data.faces.filter((f: any) => f !== null)
                )
              }
            }, 100)
          }
        }
      } else {
        // Data is too old, clear it
        localStorage.removeItem('personDetectionResult')
      }
    }
  } catch (error) {
    console.warn('Failed to restore detection results:', error)
    localStorage.removeItem('personDetectionResult')
  }
}, []) // Only run on mount
```

#### 5. Handle Popup Close/Reopen (Shopify App Context)

```typescript
// For Shopify app popups/modals
useEffect(() => {
  // Listen for popup close/reopen events
  const handlePopupClose = () => {
    // Popup is closing, canvas will be destroyed
    // State is preserved in React, so no action needed
  }

  const handlePopupReopen = () => {
    // Popup reopened, redraw canvas
    if (detectionResult && imageRef.current) {
      // Wait for DOM to be ready
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (imageRef.current && detectionResult && canvasRef.current) {
            drawBoxes(
              imageRef.current,
              detectionResult.people,
              detectionResult.faces
            )
          }
        }, 100)
      })
    }
  }

  // Shopify app bridge events (if using Shopify App Bridge)
  if (window.shopify?.app?.bridge) {
    window.shopify.app.bridge.subscribe('APP_CLOSED', handlePopupClose)
    window.shopify.app.bridge.subscribe('APP_OPENED', handlePopupReopen)
  }

  // Generic visibility API
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      handlePopupReopen()
    }
  })

  return () => {
    if (window.shopify?.app?.bridge) {
      window.shopify.app.bridge.unsubscribe('APP_CLOSED', handlePopupClose)
      window.shopify.app.bridge.unsubscribe('APP_OPENED', handlePopupReopen)
    }
  }
}, [detectionResult])
```

#### 6. Complete Redraw Function with Error Handling

```typescript
const redrawCanvas = useCallback(() => {
  if (!imageRef.current || !detectionResult || !canvasRef.current) {
    return false
  }

  const img = imageRef.current
  const canvas = canvasRef.current

  // Verify image is loaded
  if (!img.complete) {
    console.warn('Image not complete, waiting for load event')
    img.onload = () => redrawCanvas()
    return false
  }

  // Verify image has valid dimensions
  if (img.naturalWidth === 0 || img.naturalHeight === 0) {
    console.warn('Image has invalid dimensions')
    return false
  }

  // Verify canvas is available
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.warn('Could not get canvas context')
    return false
  }

  try {
    drawBoxes(img, detectionResult.people, detectionResult.faces)
    return true
  } catch (error) {
    console.error('Error redrawing canvas:', error)
    return false
  }
}, [detectionResult])

// Use redrawCanvas in all scenarios
useEffect(() => {
  if (detectionResult && imageUrl) {
    // Initial draw
    redrawCanvas()
  }
}, [detectionResult, imageUrl, redrawCanvas])
```

---

## 🛡️ Edge Cases & Solutions

### Edge Case 1: Page Refresh

**Problem:** All state is lost, canvas is blank

**Solution:**
- Store detection results in localStorage
- Restore on component mount
- Reload image from stored URL
- Redraw canvas after image loads

### Edge Case 2: Popup Close/Reopen

**Problem:** Canvas is destroyed, bounding boxes disappear

**Solution:**
- Listen for visibility change events
- Redraw canvas when component becomes visible
- Use `requestAnimationFrame` for smooth redraw

### Edge Case 3: Window Resize

**Problem:** Canvas dimensions change, bounding boxes misaligned

**Solution:**
- Listen for resize events
- Recalculate scale
- Redraw canvas with new dimensions
- Debounce resize events (250ms)

### Edge Case 4: Image Not Loaded

**Problem:** Canvas tries to draw before image is ready

**Solution:**
- Check `img.complete` before drawing
- Check `img.naturalWidth > 0` and `img.naturalHeight > 0`
- Wait for `img.onload` event if not ready

### Edge Case 5: Canvas Context Lost

**Problem:** Canvas context becomes null

**Solution:**
- Always check `ctx` before drawing
- Re-get context if null
- Handle errors gracefully

### Edge Case 6: Scale Mismatch

**Problem:** Different scales used in different functions

**Solution:**
- Use shared `calculateImageScale()` function
- Store scale in state if needed
- Always recalculate scale before drawing

### Edge Case 7: Multiple Rapid Redraws

**Problem:** Performance issues from too many redraws

**Solution:**
- Debounce redraw calls
- Use `requestAnimationFrame`
- Cancel pending redraws before new ones

---

## 📋 Complete Implementation Checklist

### ✅ Required for Refresh/Popup Support

- [ ] Extract scale calculation to shared function
- [ ] Add image loading verification (`img.complete`, `img.naturalWidth`)
- [ ] Add `useEffect` for detection result changes
- [ ] Add `useEffect` for visibility changes
- [ ] Add `useEffect` for window resize
- [ ] Add state persistence (localStorage)
- [ ] Add state restoration on mount
- [ ] Add error handling in drawBoxes
- [ ] Add canvas context verification
- [ ] Add debouncing for resize events
- [ ] Add cleanup for event listeners

### ✅ Testing Scenarios

- [ ] Test page refresh with detection results
- [ ] Test popup close and reopen
- [ ] Test window resize
- [ ] Test with slow image loading
- [ ] Test with invalid images
- [ ] Test with very large images (>3000px)
- [ ] Test with very small images (<500px)
- [ ] Test rapid open/close cycles
- [ ] Test multiple images in sequence
- [ ] Test browser back/forward navigation

---

## 📝 Code Reference

- **Scale Calculation:** Lines 304-317
- **Canvas Setup:** Lines 319-323
- **Bounding Box Drawing:** Lines 328-333, 368-372
- **Click Handler:** Lines 687-749
- **Coordinate Conversion:** Lines 690-709
- **Image Loading:** Lines 130-139
- **State Management:** Lines 272-277

---

## 🔧 Quick Fix Implementation

Add these to your `PersonDetector.tsx`:

```typescript
// 1. Add shared scale function (top of component)
const calculateImageScale = (imgWidth: number, imgHeight: number): number => {
  const maxWidth = 1200
  const maxHeight = 800
  if (imgWidth > maxWidth || imgHeight > maxHeight) {
    return Math.min(maxWidth / imgWidth, maxHeight / imgHeight)
  }
  return 1
}

// 2. Update drawBoxes to use shared function and verify image
const drawBoxes = (img: HTMLImageElement | null, people: Detection[], faces: DetectedFace[] = []) => {
  // Add image verification at start
  if (!img || !img.complete || img.naturalWidth === 0) {
    if (img && !img.complete) {
      img.onload = () => drawBoxes(img, people, faces)
    }
    return
  }
  
  // Use shared scale function
  const scale = calculateImageScale(img.width, img.height)
  // ... rest of function
}

// 3. Add redraw effects (after existing useEffects)
useEffect(() => {
  if (detectionResult && imageRef.current) {
    const timer = setTimeout(() => {
      if (imageRef.current && detectionResult) {
        drawBoxes(imageRef.current, detectionResult.people, detectionResult.faces)
      }
    }, 100)
    return () => clearTimeout(timer)
  }
}, [detectionResult, imageUrl])

useEffect(() => {
  const handleVisibility = () => {
    if (!document.hidden && detectionResult && imageRef.current) {
      setTimeout(() => {
        if (imageRef.current && detectionResult) {
          drawBoxes(imageRef.current, detectionResult.people, detectionResult.faces)
        }
      }, 100)
    }
  }
  document.addEventListener('visibilitychange', handleVisibility)
  return () => document.removeEventListener('visibilitychange', handleVisibility)
}, [detectionResult])
```

---

**Last Updated:** 2024  
**Component:** `PersonDetector.tsx`  
**Version:** 2.0 - Enhanced for Refresh & Popup Support

