# Bounding Box Negative Value Fix

## Issue
Server was rejecting try-on requests with error:
```json
{
  "error": {
    "code": "PROCESSING_FAILURE",
    "message": "Failed to validate personBbox: personBbox values must be positive numbers"
  }
}
```

**Root Cause:** The TensorFlow.js COCO-SSD person detection model can return slightly negative coordinate values (e.g., `x: -4.04`) when a detected person is positioned very close to the image edge. This happens due to:
- Floating-point precision in the ML model
- Detection boxes that slightly extend beyond image boundaries
- Model's internal bounding box regression

## Problematic Payload
```json
{
  "x": -4.043233394622803,  // ❌ Negative value
  "y": 279.9389719963074,
  "width": 401.9621253013611,
  "height": 902.7064919471741
}
```

## Solution
Implemented **two-layer validation** to ensure all bounding box values are positive:

### 1. At Selection Time (`handlePersonSelect`)
Created `clampBoundingBox()` helper function that:
- Clamps `x` and `y` to minimum of 0 (prevents negative coordinates)
- Ensures `width` and `height` are positive
- Validates bbox doesn't exceed image boundaries if dimensions are available
- Logs original vs clamped values for debugging

```typescript
const clampBoundingBox = (bbox: [number, number, number, number], imageWidth?: number, imageHeight?: number): PersonBbox => {
  let [x, y, width, height] = bbox;
  
  x = Math.max(0, x);
  y = Math.max(0, y);
  width = Math.max(0, width);
  height = Math.max(0, height);
  
  // Ensure bbox doesn't exceed image boundaries
  if (imageWidth && imageHeight) {
    if (x + width > imageWidth) {
      width = Math.max(0, imageWidth - x);
    }
    if (y + height > imageHeight) {
      height = Math.max(0, imageHeight - y);
    }
  }
  
  return { x, y, width, height };
};
```

### 2. Before API Call (Safety Net)
Added final validation right before sending to API:
```typescript
const personBbox: PersonBbox | null = selectedPersonBbox ? {
  x: Math.max(0, selectedPersonBbox.x),
  y: Math.max(0, selectedPersonBbox.y),
  width: Math.max(0, selectedPersonBbox.width),
  height: Math.max(0, selectedPersonBbox.height),
} : null;
```

## Files Modified
- `src/components/VirtualTryOnModal.tsx`
  - Added `clampBoundingBox()` helper function (line ~2673)
  - Updated `handlePersonSelect()` to use clamping (line ~2697)
  - Added safety validation before API call (line ~1703)
  - Added console logging for debugging

## Testing Recommendations
1. Test with person photos positioned at image edges
2. Test with group photos where people are near boundaries
3. Verify console logs show clamping when it occurs
4. Confirm API accepts all bounding boxes without validation errors

## Impact
- ✅ Prevents server validation errors for edge-case detections
- ✅ Maintains accurate bounding boxes within valid image boundaries
- ✅ No impact on normal use cases (bbox values already positive)
- ✅ Adds debugging visibility with console logs
- ✅ Double-layer protection (selection + API call)

## Related Code
- Person detection: `src/components/PersonDetector.tsx`
- API service: `src/services/tryonApi.ts`
- Type definitions: `PersonBbox` interface

