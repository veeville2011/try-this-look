# NULIGHT API - Frontend Developer Guide

## Quick Reference

| Feature | Submit Job | Check Status | Processing Time |
|---------|-----------|--------------|-----------------|
| Image Relighting | `POST /nulight_webhook` | `GET /nulight/status/{image_id}` | 30-60s |
| Fashion Editorial | `POST /lookmaker_webhook` | `GET /lookmaker/status/{image_id}` | 30-60s |
| AI Prompt Generation | `POST /generate_prompt_webhook` | `GET /prompt/status/{image_id}` | 10-20s |
| **Object Mask Generation** | `POST /make_masks` | **N/A (Synchronous)** | **30-60s (blocking)** |
| Virtual Try-On | `POST /tryon_webhook` | `GET /tryon/status/{image_id}` | 30-60s |
| **3D Model Generation** | `POST /generate3d_webhook` | `GET /generate3d/status/{image_id}` | 60-120s |

---

## Authentication

All requests require Bearer token authentication:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_TOKEN_HERE'
}
```

---

## 1. Image Relighting (NULIGHT)

Transform product images with professional lighting variations.

### POST `/nulight_webhook`

**Request** (multipart/form-data):
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]); // OR use image_url
formData.append('prompt', 'studio product photography'); // Optional
formData.append('variation_types', 'studio,lifestyle'); // Optional

const response = await fetch('/nulight_webhook', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});

const data = await response.json();
// {
//   "message": "NULIGHT job(s) submitted successfully",
//   "image_id": 123,
//   "jobs": [{
//     "job_id": "abc123",
//     "variation_type": "studio",
//     "status_url": "/nulight/status/123"
//   }],
//   "status": "processing",
//   "estimated_time": "30-60 seconds"
// }
```

**Parameters**:
- `image` (file) OR `image_url` (string) - Required
- `prompt` (string) - Optional, auto-generated if omitted
- `variation_types` (string) - Optional, default: "studio"
  - Options: `studio`, `lifestyle`, `dramatic`, `minimal`, `outdoor`
  - Combine with commas: `studio,lifestyle,dramatic`

**Response**: Job submission confirmation with `image_id`

### GET `/nulight/status/{image_id}`

Poll to check job completion:

```javascript
async function pollNulightStatus(imageId) {
  const response = await fetch(`/nulight/status/${imageId}`, {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  });

  const data = await response.json();
  // {
  //   "status": "completed",  // or "processing", "failed"
  //   "result_image_urls": [
  //     "https://s3.../studio_image.jpg",
  //     "https://s3.../lifestyle_image.jpg"
  //   ],
  //   "original_image_url": "https://s3.../original.jpg"
  // }

  return data;
}

// Poll every 3 seconds
const intervalId = setInterval(async () => {
  const status = await pollNulightStatus(123);

  if (status.status === 'completed') {
    clearInterval(intervalId);
    displayImages(status.result_image_urls);
  }
}, 3000);
```

---

## 2. Lookmaker (Fashion Editorial)

Create fashion editorial images from outfit photos.

### POST `/lookmaker_webhook`

**Request** (multipart/form-data):
```javascript
const formData = new FormData();
formData.append('images', file1);
formData.append('images', file2);
// Add 1-6 images

const response = await fetch('/lookmaker_webhook', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});

const data = await response.json();
// {
//   "message": "Lookmaker job submitted successfully",
//   "image_id": 789,
//   "job_id": "def456",
//   "status": "processing",
//   "status_url": "/lookmaker/status/789",
//   "estimated_time": "30-60 seconds",
//   "input_image_count": 2
// }
```

**Parameters**:
- `images` (files) - Required, 1-6 image files

**Response**: Job submission confirmation with `image_id`

### GET `/lookmaker/status/{image_id}`

```javascript
async function pollLookmakerStatus(imageId) {
  const response = await fetch(`/lookmaker/status/${imageId}`, {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  });

  return await response.json();
  // {
  //   "status": "completed",
  //   "result_image_urls": ["https://s3.../editorial.jpg"],
  //   "original_image_url": "https://s3.../original.jpg"
  // }
}
```

---

## 3. AI Prompt Generation

Auto-generate optimized product prompts with category detection.

### POST `/generate_prompt_webhook`

**Request** (multipart/form-data):
```javascript
const formData = new FormData();
formData.append('image', productFile); // OR use image_url

const response = await fetch('/generate_prompt_webhook', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});

const data = await response.json();
// {
//   "message": "Prompt generation job submitted successfully",
//   "image_id": 555,
//   "job_id": "ghi789",
//   "status": "processing",
//   "status_url": "/prompt/status/555",
//   "estimated_time": "10-20 seconds"
// }
```

**Parameters**:
- `image` (file) OR `image_url` (string) - Required

**Response**: Job submission confirmation with `image_id`

### GET `/prompt/status/{image_id}`

```javascript
async function pollPromptStatus(imageId) {
  const response = await fetch(`/prompt/status/${imageId}`, {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  });

  return await response.json();
  // {
  //   "status": "completed",
  //   "prompt": "professional studio photography of luxury watch...",
  //   "category": "accessories",
  //   "original_image_url": "https://s3.../product.jpg"
  // }
}
```

---

## 4. Object Mask Generation (Synchronous)

**Note:** This is a **synchronous (blocking)** endpoint, NOT a webhook API. The request will block until processing completes (~30-60 seconds).

Generate segmentation masks for objects detected in an image.

### POST `/make_masks`

**Request** (multipart/form-data):
```javascript
// Auto-detect all objects
const formData = new FormData();
formData.append('image', fileInput.files[0]); // OR use image_url

const response = await fetch('/make_masks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});

const data = await response.json();
// {
//   "original_image_url": "https://s3.../image.jpg",
//   "object_masks": [
//     {
//       "object": ["baseball cap"],
//       "mask_url": "https://s3.../mask1.png",
//       "image_id": 123
//     },
//     {
//       "object": ["person"],
//       "mask_url": "https://s3.../mask2.png",
//       "image_id": 123
//     }
//   ]
// }
```

**Detect specific objects:**
```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('prompt', JSON.stringify(['chair', 'table', 'lamp']));

const response = await fetch('/make_masks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

**Use pre-computed bounding boxes:**
```javascript
const formData = new FormData();
formData.append('image_url', 'https://example.com/image.jpg');
formData.append('bboxes', JSON.stringify({
  "chair": [{"xmin": 100, "ymin": 200, "xmax": 300, "ymax": 400}]
}));

const response = await fetch('/make_masks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});
```

**Parameters**:
- `image` (file) OR `image_url` (string) - Required
- `prompt` (JSON array of strings) - Optional, auto-detects all objects if omitted
- `bboxes` (JSON object) - Optional, skips object detection if provided
- `point_prompt` (JSON array) - Optional, point-based prompts

**Response**:
```json
{
  "original_image_url": "https://...",
  "object_masks": [
    {
      "object": ["object_name"],
      "mask_url": "https://s3.../mask.png",
      "image_id": 123
    }
  ]
}
```

**Processing Time**: 30-60 seconds (blocking)

**Important Notes**:
- This is a **synchronous** endpoint - your request will wait until processing completes
- No polling required - result is returned directly
- Suitable for single image processing
- For batch processing, consider implementing client-side queuing

---

## 5. 3D Model Generation

Generate 3D models (Gaussian splat + GLB) from product images using SAM 3D.

### POST `/generate3d_webhook`

**Request** (multipart/form-data):
```javascript
const formData = new FormData();
formData.append('image', productFile); // OR use image_url
// REQUIRED: Must provide either 'prompt' or 'mask_urls'
formData.append('prompt', 'baseball cap');
// OR provide pre-computed mask URLs instead:
// formData.append('mask_urls', JSON.stringify(['https://s3.../mask1.png']));

const response = await fetch('/generate3d_webhook', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});

const data = await response.json();
// {
//   "message": "3D generation job submitted successfully",
//   "image_id": 999,
//   "job_id": "xyz789",
//   "status": "processing",
//   "status_url": "/generate3d/status/999",
//   "estimated_time": "60-120 seconds"
// }
```

**Parameters**:
- `image` (file) OR `image_url` (string) - Required
- `prompt` (string) - **REQUIRED** (if mask_urls not provided). Text prompt to specify objects to reconstruct
  - Examples: `'chair'`, `'product'`, `'person'`, `'baseball cap'`
- `mask_urls` (JSON array) - **REQUIRED** (if prompt not provided). Pre-computed mask URLs
  - Example: `'["https://s3.../mask1.png"]'`
- **Note**: You must provide at least one selection method (`prompt` or `mask_urls`)

**Response**: Job submission confirmation with `image_id`

### GET `/generate3d/status/{image_id}`

Poll to check job completion:

```javascript
async function poll3DStatus(imageId) {
  const response = await fetch(`/generate3d/status/${imageId}`, {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  });

  const data = await response.json();
  // {
  //   "status": "completed",  // or "processing", "failed"
  //   "gaussian_splat_url": "https://s3.../model.ply",  // Gaussian splat
  //   "model_glb_url": "https://s3.../model.glb",       // GLB 3D model
  //   "metadata": [{                                     // Per-object metadata
  //     "rotation": [0, 0, 0],
  //     "translation": [0, 0, 0],
  //     "scale": [1, 1, 1]
  //   }],
  //   "original_url": "https://s3.../original.jpg"
  // }

  return data;
}

// Poll every 5 seconds
const intervalId = setInterval(async () => {
  const status = await poll3DStatus(999);

  if (status.status === 'completed') {
    clearInterval(intervalId);
    // Load Gaussian splat in 3D viewer
    load3DModel(status.gaussian_splat_url, status.model_glb_url);
  }
}, 5000);
```

**Output Formats**:
- **Gaussian Splat (.ply)**: Optimized for web-based 3D viewers
- **GLB Model (.glb)**: Standard 3D format for AR/VR applications
- **Metadata**: Per-object rotation, translation, and scale values

**Use Cases**:
- AR try-on experiences
- Interactive 3D product viewers
- Virtual showrooms
- E-commerce 360° product views

---

## 6. Virtual Try-On

Apply garments to person images.

### POST `/tryon_webhook`

**Request**:
```javascript
const formData = new FormData();
formData.append('person_image', personFile);
formData.append('garment_image', garmentFile);

const response = await fetch('/tryon_webhook', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
});

const data = await response.json();
// {
//   "message": "Virtual try-on job submitted successfully",
//   "image_id": 456,
//   "job_id": "xyz789",
//   "status": "processing",
//   "status_url": "/tryon/status/456",
//   "estimated_time": "30-60 seconds"
// }
```

### GET `/tryon/status/{image_id}`

```javascript
async function pollTryonStatus(imageId) {
  const response = await fetch(`/tryon/status/${imageId}`, {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  });

  return await response.json();
  // {
  //   "status": "completed",
  //   "tryon_image_url": "https://s3.../tryon_result.jpg",
  //   "original_image_url": "https://s3.../person.jpg"
  // }
}
```

---

## Complete Examples

### Example 1: 3D Model Generation

```javascript
async function generate3DModel(imageFile, objectPrompt) {
  // REQUIRED: Must provide objectPrompt
  if (!objectPrompt) {
    throw new Error('Prompt is required. Examples: "chair", "product", "baseball cap"');
  }

  // 1. Submit job
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('prompt', objectPrompt);

  const submitResponse = await fetch('/generate3d_webhook', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    },
    body: formData
  });

  const { image_id, estimated_time } = await submitResponse.json();
  console.log(`Processing... (estimated: ${estimated_time})`);

  // 2. Poll for completion
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`/generate3d/status/${image_id}`, {
          headers: {
            'Authorization': `Bearer ${getToken()}`
          }
        });

        const status = await statusResponse.json();

        if (status.status === 'completed') {
          clearInterval(pollInterval);
          resolve({
            gaussianSplat: status.gaussian_splat_url,
            glbModel: status.model_glb_url,
            metadata: status.metadata
          });
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          reject(new Error('3D generation failed'));
        }
      } catch (error) {
        clearInterval(pollInterval);
        reject(error);
      }
    }, 5000); // Poll every 5 seconds

    // Timeout after 3 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      reject(new Error('Processing timeout'));
    }, 180000);
  });
}

// Usage: Generate 3D model for specific object
const productImage = document.getElementById('product-upload').files[0];
try {
  const { gaussianSplat, glbModel, metadata } = await generate3DModel(
    productImage,
    'baseball cap'  // REQUIRED - specify what to reconstruct
  );

  console.log('Gaussian splat:', gaussianSplat);
  console.log('GLB model:', glbModel);
  console.log('Metadata:', metadata);

  // Load in 3D viewer
  init3DViewer(gaussianSplat, glbModel);
} catch (error) {
  console.error('Error:', error);
}

// Example with generic prompt for general products
try {
  const models = await generate3DModel(productImage, 'product');
  init3DViewer(models.gaussianSplat, models.glbModel);
} catch (error) {
  console.error('Error:', error);
}
```

---

### Example 2: NULIGHT with Polling

```javascript
async function processImageWithNulight(imageFile) {
  // 1. Submit job
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('variation_types', 'studio,lifestyle');

  const submitResponse = await fetch('/nulight_webhook', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    },
    body: formData
  });

  const { image_id } = await submitResponse.json();

  // 2. Poll for completion
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`/nulight/status/${image_id}`, {
          headers: {
            'Authorization': `Bearer ${getToken()}`
          }
        });

        const status = await statusResponse.json();

        if (status.status === 'completed') {
          clearInterval(pollInterval);
          resolve(status.result_image_urls);
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          reject(new Error('Processing failed'));
        }
      } catch (error) {
        clearInterval(pollInterval);
        reject(error);
      }
    }, 3000); // Poll every 3 seconds

    // Timeout after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      reject(new Error('Processing timeout'));
    }, 120000);
  });
}

// Usage
const imageFile = document.getElementById('image-upload').files[0];
try {
  const resultUrls = await processImageWithNulight(imageFile);
  console.log('Generated images:', resultUrls);
  resultUrls.forEach(url => displayImage(url));
} catch (error) {
  console.error('Error:', error);
}
```

---

### Example 3: Lookmaker (Fashion Editorial)

```javascript
async function createFashionEditorial(imageFiles) {
  // 1. Validate image count
  if (imageFiles.length < 1 || imageFiles.length > 6) {
    throw new Error('Must provide 1-6 images');
  }

  // 2. Submit job
  const formData = new FormData();
  imageFiles.forEach(file => {
    formData.append('images', file);
  });

  const submitResponse = await fetch('/lookmaker_webhook', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    },
    body: formData
  });

  const { image_id } = await submitResponse.json();

  // 3. Poll for result
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      const statusResponse = await fetch(`/lookmaker/status/${image_id}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const status = await statusResponse.json();

      if (status.status === 'completed') {
        clearInterval(pollInterval);
        resolve(status.result_image_urls);
      } else if (status.status === 'failed') {
        clearInterval(pollInterval);
        reject(new Error('Lookmaker failed'));
      }
    }, 3000);

    setTimeout(() => {
      clearInterval(pollInterval);
      reject(new Error('Timeout'));
    }, 120000);
  });
}

// Usage
const files = Array.from(document.getElementById('outfit-images').files);
try {
  const editorialUrls = await createFashionEditorial(files);
  editorialUrls.forEach(url => displayImage(url));
} catch (error) {
  console.error('Error:', error);
}
```

---

### Example 4: Object Mask Generation (Synchronous)

```javascript
async function generateObjectMasks(imageFile, objectNames = null) {
  // Create form data
  const formData = new FormData();
  formData.append('image', imageFile);

  // Optional: specify which objects to detect
  if (objectNames) {
    formData.append('prompt', JSON.stringify(objectNames));
  }
  // If no prompt, auto-detects all objects

  // Make synchronous request (will block until complete)
  const response = await fetch('/make_masks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    },
    body: formData
  });

  // Result is returned directly - no polling needed
  const data = await response.json();

  return {
    originalImageUrl: data.original_image_url,
    masks: data.object_masks
  };
}

// Usage 1: Auto-detect all objects
const imageFile = document.getElementById('image-upload').files[0];
try {
  console.log('Processing... (this may take 30-60 seconds)');
  const { originalImageUrl, masks } = await generateObjectMasks(imageFile);

  console.log(`Found ${masks.length} objects`);
  masks.forEach(mask => {
    console.log(`- ${mask.object[0]}: ${mask.mask_url}`);
    displayMask(mask.mask_url, mask.object[0]);
  });
} catch (error) {
  console.error('Error:', error);
}

// Usage 2: Detect specific objects only
try {
  const { masks } = await generateObjectMasks(imageFile, ['chair', 'table']);
  console.log(`Generated ${masks.length} masks for requested objects`);
} catch (error) {
  console.error('Error:', error);
}
```

---

### Example 5: AI Prompt Generation

```javascript
async function generateProductPrompt(imageFile) {
  // 1. Submit job
  const formData = new FormData();
  formData.append('image', imageFile);

  const submitResponse = await fetch('/generate_prompt_webhook', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    },
    body: formData
  });

  const { image_id } = await submitResponse.json();

  // 2. Poll for result
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      const statusResponse = await fetch(`/prompt/status/${image_id}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const status = await statusResponse.json();

      if (status.status === 'completed') {
        clearInterval(pollInterval);
        resolve({
          prompt: status.prompt,
          category: status.category
        });
      } else if (status.status === 'failed') {
        clearInterval(pollInterval);
        reject(new Error('Prompt generation failed'));
      }
    }, 2000); // Faster polling for prompt generation

    setTimeout(() => {
      clearInterval(pollInterval);
      reject(new Error('Timeout'));
    }, 60000); // Shorter timeout
  });
}

// Usage
const productImage = document.getElementById('product-upload').files[0];
try {
  const { prompt, category } = await generateProductPrompt(productImage);
  console.log(`Category: ${category}`);
  console.log(`Prompt: ${prompt}`);
  document.getElementById('generated-prompt').value = prompt;
} catch (error) {
  console.error('Error:', error);
}
```

---

### Example 6: Virtual Try-On

```javascript
async function processVirtualTryon(personFile, garmentFile) {
  // 1. Submit job
  const formData = new FormData();
  formData.append('person_image', personFile);
  formData.append('garment_image', garmentFile);

  const submitResponse = await fetch('/tryon_webhook', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    },
    body: formData
  });

  const { image_id, estimated_time } = await submitResponse.json();
  console.log(`Processing... (estimated: ${estimated_time})`);

  // 2. Poll for result
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      const statusResponse = await fetch(`/tryon/status/${image_id}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      const status = await statusResponse.json();

      if (status.status === 'completed') {
        clearInterval(pollInterval);
        resolve(status.tryon_image_url);
      } else if (status.status === 'failed') {
        clearInterval(pollInterval);
        reject(new Error('Try-on failed'));
      }
    }, 3000);

    setTimeout(() => {
      clearInterval(pollInterval);
      reject(new Error('Timeout'));
    }, 120000);
  });
}

// Usage
const person = document.getElementById('person-image').files[0];
const garment = document.getElementById('garment-image').files[0];

try {
  const resultUrl = await processVirtualTryon(person, garment);
  displayImage(resultUrl);
} catch (error) {
  console.error('Error:', error);
}
```

---

## Response Status Values

All status endpoints return one of:
- `"processing"` - Job in progress, continue polling
- `"completed"` - Job finished successfully
- `"failed"` - Job failed, check error message

## Polling Best Practices

1. **Poll interval**: 3 seconds recommended
2. **Timeout**: Set max wait time (120 seconds recommended)
3. **Stop conditions**: Stop on `completed` or `failed` status
4. **Error handling**: Handle network errors gracefully

## Rate Limits

Check response headers for rate limit information.

## Support

For API issues, contact backend team with:
- Request timestamp
- `image_id` or `job_id`
- Error message (if any)
