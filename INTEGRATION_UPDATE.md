# Fashion Photo API Integration Guide

## Overview

The `/fashion-photo` API has been updated to use an **asynchronous job-based architecture**. Instead of waiting for image generation to complete, the API now:

1. **Accepts job submission** → Returns immediately with `jobId`
2. **Processes job in background** → No blocking on client
3. **Provides status endpoint** → Poll to check job progress
4. **Optional webhook support** → Get notified when job completes

---

## API Endpoints

### 1. Submit Fashion Photo Job

**Endpoint:** `POST /api/fashion-photo`

**Description:** Submits a fashion photo generation job and returns immediately. Job is processed asynchronously in the background.

**Content-Type:** `multipart/form-data`

#### Request Parameters

##### Required Files
- `personImage` (file) - Person image file (JPEG, PNG, WebP, AVIF)
- `clothingImage` (file) - Clothing image file (JPEG, PNG, WebP, AVIF)

**OR**

- `personImage` (file) - Person image file
- `clothingImageUrl` (string) - URL to clothing image (HTTP/HTTPS)

##### Optional Form Fields
- `name` (string) - User name
- `email` (string) - User email
- `storeName` (string) - Store name
- `clothingKey` (string) - Clothing identifier for tracking
- `personKey` (string) - Person identifier for tracking
- `customerId` (string) - Customer ID
- `customerEmail` (string) - Customer email
- `customerFirstName` (string) - Customer first name
- `customerLastName` (string) - Customer last name
- `productId` (string) - Product ID
- `productTitle` (string) - Product title
- `productUrl` (string) - Product URL
- `variantId` (string) - Product variant ID
- `aspectRatio` (string) - Aspect ratio (e.g., "16:9", "1:1", "4:3")
- `webhookUrl` (string) - Webhook URL to call when job completes (optional)

##### Query Parameters
- `shop` (string) - Shop domain for credit tracking (optional)

#### Success Response

**Status Code:** `202 Accepted`

```json
{
  "status": "accepted",
  "jobId": "abc123xyz",
  "message": "Job submitted successfully. Use the status endpoint to check progress.",
  "statusUrl": "/api/fashion-photo/status/abc123xyz"
}
```

#### Error Responses

**Status Code:** `400 Bad Request`
- Invalid file format
- Missing required files
- Invalid webhook URL format
- Invalid shop domain

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid file format. Only JPEG, PNG, WebP and AVIF are allowed."
  }
}
```

**Status Code:** `403 Forbidden`
- Insufficient credits

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Insufficient credits. Please purchase credits or wait for your next billing period.",
    "details": {
      "reason": "insufficient_credits",
      "creditBalance": 0,
      "creditBreakdown": {
        "total": 0,
        "included": 0,
        "purchased": 0
      }
    }
  }
}
```

**Status Code:** `500 Internal Server Error`
- AI model not initialized
- Server error

```json
{
  "status": "error",
  "error": {
    "code": "SERVER_ERROR",
    "message": "AI model not initialized"
  }
}
```

**Status Code:** `503 Service Unavailable`
- Database service unavailable

```json
{
  "status": "error",
  "error": {
    "code": "SERVER_ERROR",
    "message": "Database service unavailable",
    "details": {
      "service": "database"
    }
  }
}
```

---

### 2. Check Job Status

**Endpoint:** `GET /api/fashion-photo/status/:jobId`

**Description:** Check the status of a submitted fashion photo generation job.

#### Path Parameters
- `jobId` (string, required) - Job ID returned from submission endpoint

#### Query Parameters
- `includeImage` (string, optional) - Set to `"1"` or `"true"` to include image data (currently not supported, returns message)

#### Success Response

**Status Code:** `200 OK`

##### Job Status: `pending`
```json
{
  "jobId": "abc123xyz",
  "status": "pending",
  "message": "Job is queued and waiting to be processed",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

##### Job Status: `processing`
```json
{
  "jobId": "abc123xyz",
  "status": "processing",
  "message": "Job is currently being processed",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:05.000Z"
}
```

##### Job Status: `completed`
```json
{
  "jobId": "abc123xyz",
  "status": "completed",
  "imageUrl": "https://s3.amazonaws.com/bucket/generated/abc123xyz.jpg",
  "processingTime": "15234ms",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:15.234Z"
}
```

**Note:** The `imageUrl` is an S3 URL. You must download the image from this URL to display it. Base64 image data is **not** returned in the status response to prevent timeouts.

##### Job Status: `failed`
```json
{
  "jobId": "abc123xyz",
  "status": "failed",
  "error": {
    "code": "PROCESSING_FAILURE",
    "message": "AI model request failed. Please try again."
  },
  "processingTime": "5000ms",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:05.000Z"
}
```

#### Error Responses

**Status Code:** `404 Not Found`
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Job not found",
    "details": {
      "jobId": "invalid-job-id"
    }
  }
}
```

**Status Code:** `503 Service Unavailable`
```json
{
  "status": "error",
  "error": {
    "code": "SERVER_ERROR",
    "message": "Database service unavailable",
    "details": {
      "service": "database"
    }
  }
}
```

---

## Webhook Integration (Optional)

If you provide a `webhookUrl` in the job submission, the API will call your webhook when the job completes or fails.

### Webhook Payload

**Event:** `fashion_photo.job.completed` or `fashion_photo.job.failed`

**Method:** `POST`

**Content-Type:** `application/json`

#### Completed Job Payload
```json
{
  "event": "fashion_photo.job.completed",
  "jobId": "abc123xyz",
  "status": "completed",
  "timestamp": "2025-01-15T10:30:15.234Z",
  "imageUrl": "https://s3.amazonaws.com/bucket/generated/abc123xyz.jpg",
  "cached": false,
  "metadata": {
    "processingTime": "15234ms",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:15.234Z"
  }
}
```

#### Failed Job Payload
```json
{
  "event": "fashion_photo.job.failed",
  "jobId": "abc123xyz",
  "status": "failed",
  "timestamp": "2025-01-15T10:30:05.000Z",
  "error": {
    "code": "PROCESSING_FAILURE",
    "message": "AI model request failed. Please try again."
  },
  "metadata": {
    "processingTime": "5000ms",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:05.000Z"
  }
}
```

**Important Notes:**
- Webhook calls are **fire-and-forget** (non-blocking)
- Webhook failures are logged but do not affect job status
- Webhook payload does **not** include base64 image data (only `imageUrl`)
- Your webhook endpoint should respond with `200 OK` to acknowledge receipt

---

## Frontend Integration Guide

### Step 1: Submit Job

```javascript
const formData = new FormData();
formData.append('personImage', personImageFile);
formData.append('clothingImage', clothingImageFile);
formData.append('webhookUrl', 'https://your-app.com/webhooks/fashion-photo'); // Optional
formData.append('productId', '12345');
formData.append('productTitle', 'Blue T-Shirt');

const response = await fetch('/api/fashion-photo?shop=your-shop.myshopify.com', {
  method: 'POST',
  body: formData
});

if (response.status === 202) {
  const data = await response.json();
  const jobId = data.jobId;
  // Store jobId and start polling
  pollJobStatus(jobId);
} else {
  const error = await response.json();
  // Handle error
  console.error('Job submission failed:', error);
}
```

### Step 2: Poll Job Status

```javascript
async function pollJobStatus(jobId) {
  const maxAttempts = 60; // 5 minutes max (5s interval)
  let attempts = 0;
  
  const poll = async () => {
    try {
      const response = await fetch(`/api/fashion-photo/status/${jobId}`);
      const data = await response.json();
      
      if (data.status === 'completed') {
        // Job completed - download and display image
        displayImage(data.imageUrl);
        return;
      } else if (data.status === 'failed') {
        // Job failed - show error
        showError(data.error.message);
        return;
      } else if (data.status === 'processing' || data.status === 'pending') {
        // Still processing - continue polling
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          showError('Job is taking longer than expected. Please check back later.');
        }
      }
    } catch (error) {
      console.error('Status check failed:', error);
      // Retry after delay
      setTimeout(poll, 5000);
    }
  };
  
  poll();
}
```

### Step 3: Display Image

```javascript
async function displayImage(imageUrl) {
  try {
    // Option 1: Use imageUrl directly in <img> tag
    const img = document.createElement('img');
    img.src = imageUrl;
    img.crossOrigin = 'anonymous';
    document.body.appendChild(img);
    
    // Option 2: Download and convert to base64 if needed
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result;
      // Use base64data
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error('Failed to load image:', error);
  }
}
```

### Step 4: Handle Webhook (Optional)

If you provided `webhookUrl`, implement a webhook endpoint:

```javascript
// Your webhook endpoint
app.post('/webhooks/fashion-photo', (req, res) => {
  const { event, jobId, status, imageUrl, error } = req.body;
  
  if (status === 'completed') {
    // Update UI with completed image
    updateJobStatus(jobId, 'completed', imageUrl);
  } else if (status === 'failed') {
    // Update UI with error
    updateJobStatus(jobId, 'failed', null, error);
  }
  
  res.status(200).json({ received: true });
});
```

---

## Migration from Old API

### Before (Synchronous)
```javascript
const response = await fetch('/api/fashion-photo', {
  method: 'POST',
  body: formData
});
const data = await response.json();
// Image is immediately available
const image = data.image; // base64 data URL
```

### After (Asynchronous)
```javascript
// 1. Submit job
const response = await fetch('/api/fashion-photo', {
  method: 'POST',
  body: formData
});
const { jobId } = await response.json();

// 2. Poll status
const statusResponse = await fetch(`/api/fashion-photo/status/${jobId}`);
const statusData = await statusResponse.json();

// 3. Get image from URL
if (statusData.status === 'completed') {
  const imageUrl = statusData.imageUrl; // S3 URL
  // Download and display
}
```

---

## Error Handling Best Practices

1. **Always check response status codes** before parsing JSON
2. **Handle 202 Accepted** - This is success for job submission
3. **Implement exponential backoff** for status polling
4. **Set maximum polling attempts** to prevent infinite loops
5. **Handle network errors** gracefully with retry logic
6. **Display appropriate loading states** during polling
7. **Handle webhook failures** - Don't rely solely on webhooks, always poll as backup

---

## Status Polling Recommendations

- **Polling Interval:** 3-5 seconds
- **Maximum Duration:** 5-10 minutes (depending on your use case)
- **Exponential Backoff:** Consider increasing interval after multiple attempts
- **User Feedback:** Show progress indicator and estimated time remaining

---

## Important Notes

1. **No Timeouts:** The API has no request timeouts. Jobs will process until completion or failure.
2. **Image URLs:** Status endpoint returns S3 URLs, not base64 data. You must download images separately.
3. **Webhook Reliability:** Webhooks are fire-and-forget. Always implement polling as a backup.
4. **Database Required:** Job submission requires database connection. Returns `503` if unavailable.
5. **Credit Tracking:** If `shop` parameter is provided, credits are checked and deducted before job submission.

---

## Example Complete Flow

```javascript
// Complete integration example
async function generateFashionPhoto(personImage, clothingImage, options = {}) {
  try {
    // 1. Submit job
    const formData = new FormData();
    formData.append('personImage', personImage);
    formData.append('clothingImage', clothingImage);
    if (options.webhookUrl) formData.append('webhookUrl', options.webhookUrl);
    if (options.productId) formData.append('productId', options.productId);
    
    const submitResponse = await fetch(
      `/api/fashion-photo${options.shop ? `?shop=${options.shop}` : ''}`,
      { method: 'POST', body: formData }
    );
    
    if (submitResponse.status !== 202) {
      const error = await submitResponse.json();
      throw new Error(error.error?.message || 'Job submission failed');
    }
    
    const { jobId } = await submitResponse.json();
    
    // 2. Poll for completion
    return await pollUntilComplete(jobId, options.onProgress);
    
  } catch (error) {
    console.error('Fashion photo generation failed:', error);
    throw error;
  }
}

async function pollUntilComplete(jobId, onProgress) {
  const maxAttempts = 120; // 10 minutes (5s intervals)
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const response = await fetch(`/api/fashion-photo/status/${jobId}`);
    const data = await response.json();
    
    if (onProgress) onProgress(data.status, data);
    
    if (data.status === 'completed') {
      return { success: true, imageUrl: data.imageUrl, jobId };
    } else if (data.status === 'failed') {
      throw new Error(data.error?.message || 'Job processing failed');
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }
  
  throw new Error('Job processing timeout');
}
```

---

## Support

For issues or questions, please refer to the API documentation or contact support.

