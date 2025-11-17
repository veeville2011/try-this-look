# Video Ad Generation API Documentation

## Overview

The Video Ad Generation API creates professional UGC-style product advertisement videos using AI. It analyzes product images, extracts brand information, and generates photorealistic 8-second videos optimized for social media platforms.

**Base URL:** `https://your-api-domain.com`  
**Endpoint:** `/api/video-ad`  
**Method:** `POST`  
**Content-Type:** `multipart/form-data`

---

## Features

- ✅ **Multi-Image Support**: Upload 1-10 product images
- ✅ **AI Product Analysis**: Automatic extraction of product details, brand name, and features
- ✅ **French Voiceover**: Native French speech with lip-sync
- ✅ **9:16 Aspect Ratio**: Optimized for Instagram Stories, TikTok, and Reels
- ✅ **8-Second Duration**: Perfect for social media ads
- ✅ **Automatic Compression**: Images are automatically optimized
- ✅ **Cloud Storage**: Generated videos are stored on S3

---

## Authentication

Currently, no authentication is required. The API accepts requests from all origins (CORS enabled).

> **Note:** In production, you may need to implement API keys or authentication tokens.

---

## Request Format

### Endpoint

```
POST /api/video-ad
```

### Headers

```http
Content-Type: multipart/form-data
Accept: application/json
Accept-Language: fr (optional, defaults to French)
```

### Request Body Parameters

| Parameter | Type | Required | Max Size | Description |
|-----------|------|----------|----------|-------------|
| `productImages` | File[] | **Yes** | 10MB per file | Product images (JPEG, PNG, WebP, AVIF). **Minimum 1, Maximum 10 images** |
| `name` | String | No | - | User's name (for tracking) |
| `email` | String | No | - | User's email (for tracking) |
| `storeName` | String | No | - | Store/brand name (for tracking) |

### Supported Image Formats

- `image/jpeg` (.jpg, .jpeg)
- `image/png` (.png)
- `image/webp` (.webp)
- `image/avif` (.avif)

### File Size Limits

- **Per file:** 10 MB maximum
- **Total files:** 10 images maximum
- **Recommended:** 1-3 high-quality images for best results

---

## Response Format

### Success Response (200 OK)

```json
{
  "status": "success",
  "image": "https://s3.amazonaws.com/bucket/generated-videos/video-abc123.mp4",
  "error_message": {
    "code": null,
    "message": null
  },
  "compression": {
    "images": [
      {
        "index": 0,
        "originalSize": 5242880,
        "finalSize": 2097152,
        "compressionRatio": 40.0
      }
    ],
    "totalCompressionRatio": "40.00"
  },
  "referenceImages": {
    "count": 3,
    "format": "bytesBase64Encoded",
    "note": "Reference images used for video generation"
  }
}
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | String | Always `"success"` for successful generation |
| `image` | String | **Video URL** (S3 permanent storage or Google temporary URL) |
| `error_message.code` | String\|null | Error code (null on success) |
| `error_message.message` | String\|null | Error message (null on success) |
| `compression` | Object | Image compression details (if applied) |
| `referenceImages` | Object | Information about reference images used |

> **Important:** Despite the field name `image`, this contains the **video URL** for consistency with the image generation API.

### Error Response (4xx/5xx)

```json
{
  "status": "error",
  "image": null,
  "error_message": {
    "code": "GEMINI_QUOTA_EXCEEDED",
    "message": "API quota exceeded. Please check your plan and billing details.",
    "details": {
      "originalError": "Quota exceeded for quota metric 'Generate requests' and limit 'Generate requests per minute' of service 'generativelanguage.googleapis.com'"
    }
  }
}
```

---

## Error Codes

| Error Code | HTTP Status | Description | Solution |
|------------|-------------|-------------|----------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters | Check request format and parameters |
| `FILE_PROCESSING_ERROR` | 400 | Image upload/processing failed | Verify image format and size |
| `GEMINI_INVALID_REQUEST` | 400 | Invalid request to AI model | Review image quality and format |
| `GEMINI_PERMISSION_DENIED` | 403 | API key authentication failed | Contact API administrator |
| `GEMINI_NOT_FOUND` | 404 | Resource not found | Verify endpoint URL |
| `GEMINI_QUOTA_EXCEEDED` | 429 | API rate limit exceeded | Wait and retry, or upgrade plan |
| `GEMINI_RATE_LIMIT` | 429 | Too many requests | Implement exponential backoff |
| `MODEL_TIMEOUT` | 504 | Request timeout (>6 minutes) | Retry with fewer images |
| `GEMINI_API_ERROR` | 502 | AI service error | Retry request |
| `SERVER_ERROR` | 500 | Internal server error | Contact support |

---

## Code Examples

### JavaScript (Fetch API)

```javascript
async function generateVideoAd(productImages) {
  const formData = new FormData();
  
  // Add product images (required)
  productImages.forEach((file) => {
    formData.append('productImages', file);
  });
  
  // Add optional metadata
  formData.append('name', 'John Doe');
  formData.append('email', 'john@example.com');
  formData.append('storeName', 'My Fashion Store');
  
  try {
    const response = await fetch('https://your-api-domain.com/api/video-ad', {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'fr'
      }
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      console.log('Video generated successfully!');
      console.log('Video URL:', data.image);
      return data.image; // Video URL
    } else {
      console.error('Error:', data.error_message);
      throw new Error(data.error_message.message);
    }
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}

// Usage with file input
const fileInput = document.getElementById('productImages');
const files = Array.from(fileInput.files);
const videoUrl = await generateVideoAd(files);
```

### TypeScript (Fetch API)

```typescript
interface VideoAdResponse {
  status: 'success' | 'error';
  image: string | null;
  error_message: {
    code: string | null;
    message: string | null;
    details?: Record<string, any>;
  };
  compression?: {
    images: Array<{
      index: number;
      originalSize: number;
      finalSize: number;
      compressionRatio: number;
    }>;
    totalCompressionRatio: string;
  };
  referenceImages?: {
    count: number;
    format: string;
    note: string;
  };
}

async function generateVideoAd(
  productImages: File[],
  metadata?: {
    name?: string;
    email?: string;
    storeName?: string;
  }
): Promise<string> {
  const formData = new FormData();
  
  // Validate images
  if (productImages.length === 0) {
    throw new Error('At least one product image is required');
  }
  
  if (productImages.length > 10) {
    throw new Error('Maximum 10 images allowed');
  }
  
  // Add images
  productImages.forEach((file) => {
    formData.append('productImages', file);
  });
  
  // Add optional metadata
  if (metadata?.name) formData.append('name', metadata.name);
  if (metadata?.email) formData.append('email', metadata.email);
  if (metadata?.storeName) formData.append('storeName', metadata.storeName);
  
  const response = await fetch('https://your-api-domain.com/api/video-ad', {
    method: 'POST',
    body: formData,
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'fr'
    }
  });
  
  const data: VideoAdResponse = await response.json();
  
  if (data.status === 'success' && data.image) {
    return data.image; // Video URL
  } else {
    throw new Error(
      data.error_message?.message || 'Video generation failed'
    );
  }
}
```

### JavaScript (Axios)

```javascript
import axios from 'axios';

async function generateVideoAd(productImages) {
  const formData = new FormData();
  
  productImages.forEach((file) => {
    formData.append('productImages', file);
  });
  
  formData.append('name', 'John Doe');
  formData.append('email', 'john@example.com');
  formData.append('storeName', 'My Fashion Store');
  
  try {
    const response = await axios.post(
      'https://your-api-domain.com/api/video-ad',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json',
          'Accept-Language': 'fr'
        },
        timeout: 360000, // 6 minutes
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    if (response.data.status === 'success') {
      return response.data.image; // Video URL
    } else {
      throw new Error(response.data.error_message.message);
    }
  } catch (error) {
    if (error.response) {
      // Server responded with error
      console.error('API Error:', error.response.data);
      throw new Error(
        error.response.data.error_message?.message || 'Video generation failed'
      );
    } else if (error.request) {
      // Request made but no response
      throw new Error('No response from server. Please check your connection.');
    } else {
      // Request setup error
      throw error;
    }
  }
}
```

### React Hook Example

```typescript
import { useState } from 'react';
import axios from 'axios';

interface UseVideoAdGenerator {
  generateVideo: (files: File[]) => Promise<string>;
  loading: boolean;
  error: string | null;
  progress: number;
}

export const useVideoAdGenerator = (): UseVideoAdGenerator => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  const generateVideo = async (files: File[]): Promise<string> => {
    setLoading(true);
    setError(null);
    setProgress(0);
    
    try {
      // Validate files
      if (files.length === 0) {
        throw new Error('Please select at least one product image');
      }
      
      if (files.length > 10) {
        throw new Error('Maximum 10 images allowed');
      }
      
      // Check file sizes
      const maxSize = 10 * 1024 * 1024; // 10MB
      const oversizedFiles = files.filter(file => file.size > maxSize);
      if (oversizedFiles.length > 0) {
        throw new Error(
          `File too large: ${oversizedFiles[0].name}. Maximum size is 10MB.`
        );
      }
      
      // Create form data
      const formData = new FormData();
      files.forEach(file => {
        formData.append('productImages', file);
      });
      
      // Make request with progress tracking
      const response = await axios.post(
        'https://your-api-domain.com/api/video-ad',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json'
          },
          timeout: 360000, // 6 minutes
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setProgress(percentCompleted);
            }
          }
        }
      );
      
      if (response.data.status === 'success') {
        setProgress(100);
        return response.data.image; // Video URL
      } else {
        throw new Error(
          response.data.error_message?.message || 'Video generation failed'
        );
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error_message?.message
        || err.message
        || 'Failed to generate video';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  return { generateVideo, loading, error, progress };
};

// Usage in component
function VideoAdGenerator() {
  const { generateVideo, loading, error, progress } = useVideoAdGenerator();
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    try {
      const url = await generateVideo(files);
      setVideoUrl(url);
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };
  
  return (
    <div>
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={handleFileChange}
        disabled={loading}
      />
      
      {loading && (
        <div>
          <p>Generating video... {progress}%</p>
          <progress value={progress} max={100} />
        </div>
      )}
      
      {error && <p className="error">{error}</p>}
      
      {videoUrl && (
        <video src={videoUrl} controls autoPlay muted />
      )}
    </div>
  );
}
```

### Node.js Example (Server-Side)

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function generateVideoAd(imagePaths) {
  const formData = new FormData();
  
  // Add images from file system
  imagePaths.forEach((imagePath) => {
    const fileStream = fs.createReadStream(imagePath);
    const filename = path.basename(imagePath);
    const contentType = imagePath.toLowerCase().endsWith('.png')
      ? 'image/png'
      : imagePath.toLowerCase().endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';
    
    formData.append('productImages', fileStream, {
      filename: filename,
      contentType: contentType
    });
  });
  
  // Add metadata
  formData.append('name', 'Test User');
  formData.append('email', 'test@example.com');
  formData.append('storeName', 'Test Store');
  
  try {
    const response = await axios.post(
      'https://your-api-domain.com/api/video-ad',
      formData,
      {
        headers: {
          ...formData.getHeaders()
        },
        timeout: 360000, // 6 minutes
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    if (response.data.status === 'success') {
      console.log('Video URL:', response.data.image);
      return response.data.image;
    } else {
      throw new Error(response.data.error_message.message);
    }
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Usage
const imagePaths = [
  './test-images/product1.jpg',
  './test-images/product2.jpg'
];
generateVideoAd(imagePaths);
```

---

## Best Practices

### 1. Image Selection

✅ **Do:**
- Use high-quality product images (minimum 1080px width)
- Include full-body shots for clothing/fashion products
- Use multiple angles (front, side, detail shots)
- Ensure good lighting and clear backgrounds
- Include 1-3 images for optimal results

❌ **Don't:**
- Use low-resolution or blurry images
- Upload images with heavy watermarks
- Use cropped images missing important details
- Include inappropriate or explicit content

### 2. File Upload

✅ **Do:**
- Validate file types and sizes before upload
- Show upload progress to users
- Compress large images before upload (client-side)
- Handle network errors gracefully

❌ **Don't:**
- Upload files larger than 10MB without compression
- Upload more than 10 images
- Block UI during upload without progress indicator

### 3. Error Handling

```javascript
async function generateVideoWithRetry(files, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const videoUrl = await generateVideoAd(files);
      return videoUrl;
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      if (error.response?.status === 429) {
        // Rate limit - wait before retry
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      } else if (error.response?.status === 504) {
        // Timeout - retry
        console.log(`Timeout on attempt ${attempt}. Retrying...`);
        continue;
      } else {
        // Non-retryable error
        throw error;
      }
    }
  }
  
  throw lastError;
}
```

### 4. User Experience

✅ **Do:**
- Show clear loading states with progress
- Display estimated wait time (1-5 minutes)
- Allow users to cancel requests
- Provide preview of uploaded images
- Show error messages in user-friendly language

❌ **Don't:**
- Leave users waiting without feedback
- Show technical error messages to end users
- Allow multiple simultaneous requests per user

### 5. Performance Optimization

```javascript
// Client-side image compression before upload
async function compressImage(file, maxSizeMB = 5) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions (max 1920px width)
        const maxWidth = 1920;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            }));
          },
          'image/jpeg',
          0.85 // Quality
        );
      };
    };
    reader.onerror = reject;
  });
}
```

---

## Rate Limits & Quotas

| Limit Type | Value | Notes |
|------------|-------|-------|
| Request Timeout | 6 minutes 40 seconds | Requests longer than this will timeout |
| Max Images per Request | 10 images | Recommended: 1-3 images |
| Max File Size | 10 MB per file | Server compresses automatically if needed |
| Video Generation Time | 1-5 minutes | Depends on image count and server load |
| Concurrent Requests | No hard limit | Implement client-side queuing |

> **Note:** API quotas depend on your Google Cloud billing and Gemini API limits. Monitor your usage in Google Cloud Console.

---

## Video Output Specifications

| Property | Value |
|----------|-------|
| **Duration** | 8 seconds |
| **Frame Rate** | 30 fps |
| **Aspect Ratio** | 9:16 (vertical) |
| **Resolution** | 1080x1920 pixels |
| **Format** | MP4 (H.264 codec) |
| **Audio** | French voiceover with lip-sync |
| **File Size** | ~5-15 MB (varies) |
| **Storage** | Permanent (S3) or 2-day temporary (Google) |

---

## Testing

### Test with cURL

```bash
curl -X POST https://your-api-domain.com/api/video-ad \
  -F "productImages=@./product1.jpg" \
  -F "productImages=@./product2.jpg" \
  -F "name=Test User" \
  -F "email=test@example.com" \
  -F "storeName=Test Store" \
  -H "Accept: application/json" \
  -H "Accept-Language: fr"
```

### Test with Postman

1. **Method:** POST
2. **URL:** `https://your-api-domain.com/api/video-ad`
3. **Headers:**
   - `Accept: application/json`
   - `Accept-Language: fr`
4. **Body:** form-data
   - Key: `productImages`, Type: File (select 1-10 images)
   - Key: `name`, Type: Text, Value: "Your Name"
   - Key: `email`, Type: Text, Value: "your@email.com"
   - Key: `storeName`, Type: Text, Value: "Your Store"
5. **Click:** Send

---

## Troubleshooting

### Common Issues

#### 1. "File size too large" Error

**Solution:** Compress images before upload or use smaller images.

```javascript
// Client-side compression (see Performance Optimization section)
const compressedFile = await compressImage(originalFile, 5);
```

#### 2. Request Timeout (504)

**Solution:** Reduce number of images or retry with smaller images.

```javascript
// Use fewer images
const firstThreeImages = allImages.slice(0, 3);
const videoUrl = await generateVideoAd(firstThreeImages);
```

#### 3. Rate Limit Exceeded (429)

**Solution:** Implement exponential backoff retry logic.

```javascript
// See "Error Handling" section for retry logic
```

#### 4. CORS Error

**Solution:** Ensure your domain is whitelisted or API accepts all origins.

```javascript
// If running locally, use proxy or configure CORS
// Contact API administrator to whitelist your domain
```

#### 5. Video URL Not Accessible

**Solution:** Check if URL requires authentication or has expired.

```javascript
// For Google API URLs, add API key
const videoUrlWithKey = videoUrl.includes('generativelanguage.googleapis.com')
  ? `${videoUrl}?key=${apiKey}`
  : videoUrl;
```

---

## Support & Contact

For technical support, feature requests, or bug reports:

- **Email:** support@your-domain.com
- **Documentation:** https://docs.your-domain.com
- **Status Page:** https://status.your-domain.com

---

## Changelog

### Version 1.0.0 (Current)
- ✅ Multi-image support (1-10 images)
- ✅ Automatic product analysis with AI
- ✅ French voiceover with lip-sync
- ✅ 9:16 vertical video format
- ✅ S3 permanent storage
- ✅ Automatic image compression
- ✅ CORS enabled for all origins

---

## License

This API is proprietary. Unauthorized use is prohibited.

© 2024 Your Company Name. All rights reserved.

