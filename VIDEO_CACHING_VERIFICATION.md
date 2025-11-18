# Video Generation Caching Indicator - Verification Guide

## How It Works (Caching Behavior)

The violet tick indicator works **exactly like the image generation tick** - it's a caching indicator that shows which clothing items have been previously used in video generations.

### Implementation Flow

```
1. Component Mount
   └─> Load all video generation records from API
       └─> Filter: status === "completed" AND clothingKey exists
           └─> Create Set of all clothingKeys: generatedVideoClothingKeys

2. Render Clothing Images
   └─> For each clothing image:
       ├─> Get clothingKey (ID) from availableImagesWithIds
       ├─> Check if clothingKey exists in generatedVideoClothingKeys
       └─> If YES → Show violet video icon 🟣
```

### Visual Indicators (Independent)

Each clothing image can show **0, 1, or 2** indicators:

| Indicator | Meaning | When it appears |
|-----------|---------|----------------|
| 🔵 Blue CheckCircle | Image generation | clothingKey exists in image generation records |
| 🟣 Violet Video Icon | Video generation | clothingKey exists in video generation records |

### Code Components

#### 1. Generate Video Keys Set (`TryOnWidget.tsx`)
```typescript
const generatedVideoClothingKeys = useMemo(() => {
  const videoKeys = new Set(
    videoRecords
      .filter((record) => {
        const hasClothingKey = record.clothingKey && 
                               String(record.clothingKey).trim() !== "";
        const isCompleted = record.status === "completed";
        return hasClothingKey && isCompleted;
      })
      .map((record) => String(record.clothingKey).trim())
  );
  return videoKeys;
}, [videoRecords]);
```

#### 2. Check if Clothing Has Video (`ClothingSelection.tsx`)
```typescript
const hasVideoGeneration = (imageUrl: string): boolean => {
  const clothingKey = availableImagesWithIds.get(imageUrl);
  if (!clothingKey) return false;
  
  const normalizedKey = String(clothingKey).trim();
  const hasVideo = generatedVideoClothingKeys.has(normalizedKey);
  return hasVideo;
};
```

#### 3. Render Video Indicator (`ClothingSelection.tsx`)
```typescript
{hasVideoGeneration(image) && (
  <div className="bg-purple-500 rounded-full p-0.5">
    <Video 
      className="h-3 w-3 sm:h-4 sm:w-4 text-white" 
      aria-hidden="true" 
    />
  </div>
)}
```

## Testing Steps

### Test 1: Verify Video Records are Loaded
1. Open browser console (F12)
2. Load the widget
3. Look for: `[TryOnWidget] Video records: X`
4. Expected: X > 0 if you have video generations

### Test 2: Verify clothingKeys are Extracted
1. In console, look for: `[TryOnWidget] Generated video clothing keys: [...]`
2. Expected: Array of clothing keys from completed video generations
3. Example: `["12345", "67890"]`

### Test 3: Verify Clothing Images Have IDs
1. Select a clothing image
2. In console, look for: `[TryOnWidget] Clothing ID: XXX`
3. Expected: The ID should match the format in video keys

### Test 4: Verify Matching Logic
1. In console, look for: `[ClothingSelection] Checking video generation:`
2. Check each log entry:
   ```
   - Clothing Key: "12345"
   - Available video keys: ["12345", "67890"]
   - Has video: true
   ```
3. Expected: `Has video: true` when keys match

### Test 5: Visual Verification
1. Find a clothing item that has been used in a video generation
2. Expected: You should see a **violet video icon** in the top-right corner
3. The icon should appear **immediately on page load** (not only after generating new video)

## Troubleshooting

### Issue: No violet tick appears

**Check 1: Are video records being loaded?**
```javascript
// Console log should show:
[TryOnWidget] Video records: 5
[TryOnWidget] Video records with clothingKey: 3
[TryOnWidget] Completed video generations: 3
[TryOnWidget] Generated video clothing keys: ["key1", "key2", "key3"]
```
✅ If you see keys listed → Records are loaded correctly
❌ If empty array → No video generations or missing clothingKey

**Check 2: Do clothing images have IDs?**
```javascript
// Console log should show:
[TryOnWidget] Images loaded from parent:
  - Total images: 10
  - Images with IDs: 10
  - Image IDs: [["url1", "key1"], ["url2", "key2"], ...]
```
✅ If Images with IDs > 0 → IDs are available
❌ If Images with IDs = 0 → Parent not sending IDs

**Check 3: Are keys matching?**
```javascript
// Console log should show for each image:
[ClothingSelection] Checking video generation:
  - Image URL: https://...
  - Clothing Key: "12345"
  - Available video keys: ["12345", "67890"]
  - Has video: true
```
✅ If Has video: true → Tick should appear
❌ If Has video: false → Check if key formats match exactly

### Common Issues

1. **Key Format Mismatch**
   - Problem: Video record has `clothingKey: "123"` but image has ID: `123` (number)
   - Solution: Code now converts both to trimmed strings for comparison

2. **Missing clothingKey in Video Records**
   - Problem: Video generations were created without sending clothingKey
   - Solution: Ensure clothingKey is sent when calling generateVideoAd()

3. **Missing IDs on Clothing Images**
   - Problem: Parent window not sending image IDs
   - Solution: Update Shopify integration to send ProductImage format with IDs

## Expected Behavior Summary

✅ **Correct behavior:**
- Violet tick appears on clothing images that have matching clothingKey in ANY completed video generation
- Tick appears immediately on page load (caching indicator)
- Tick persists across page refreshes
- Multiple clothing items can have violet ticks independently

❌ **Incorrect behavior:**
- Tick only appears after generating a new video
- Tick disappears on page refresh
- Tick only shows on currently selected clothing
- All clothing items show tick when only one has video

## Next Steps

1. Test with real video generations that have `clothingKey` values
2. Monitor console logs to verify data flow
3. Once confirmed working, reduce or remove console logging
4. Update documentation with example screenshots

