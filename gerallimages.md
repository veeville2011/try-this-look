# Get All Image Generations API Specification

**Endpoint:** `GET /api/image-generations/all`

**Description:** Get all image generations with pagination and filtering options.

---

## Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | `1` | Page number for pagination |
| `limit` | number | No | `50` | Number of records per page |
| `status` | string | No | - | Filter by status: `pending`, `processing`, `completed`, `failed` |
| `orderBy` | string | No | `created_at` | Field to sort by |
| `orderDirection` | string | No | `DESC` | Sort direction: `ASC` or `DESC` |
| `user` | string | No | - | Filter by IP address |
| `storeName` | string | No | - | Filter by store name |

---

## Response

### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "records": [
      {
        "id": "generation-id",
        "requestId": "request-id",
        "personImageUrl": "https://s3.amazonaws.com/bucket/person-image.jpg",
        "clothingImageUrl": "https://s3.amazonaws.com/bucket/clothing-image.jpg",
        "generatedImageUrl": "https://s3.amazonaws.com/bucket/generated-image.jpg",
        "generatedImageKey": "s3-key-path",
        "status": "completed",
        "errorMessage": null,
        "processingTime": "2.5s",
        "fileSize": "2.5 MB",
        "mimeType": "image/jpeg",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "ipAddress": "192.168.1.1",
        "name": "John Doe",
        "email": "john@example.com",
        "storeName": "my-shop",
        "clothingKey": "clothing-key-123",
        "personKey": "person-key-456",
        "createdAt": "2026-01-05T10:00:00.000Z",
        "updatedAt": "2026-01-05T10:00:05.000Z"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 50,
      "totalPages": 2,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

---

## Response Fields

### Record Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique generation ID |
| `requestId` | string | Request ID associated with the generation |
| `personImageUrl` | string | URL of the person image used |
| `clothingImageUrl` | string | URL of the clothing image used |
| `generatedImageUrl` | string | URL of the generated image |
| `generatedImageKey` | string | S3 key for the generated image |
| `status` | string | Generation status: `pending`, `processing`, `completed`, `failed` |
| `errorMessage` | string \| null | Error message if generation failed |
| `processingTime` | string | Time taken to process (e.g., "2.5s") |
| `fileSize` | string | File size formatted as MB (e.g., "2.5 MB") |
| `mimeType` | string | MIME type of the generated image |
| `userAgent` | string | User agent string from the request |
| `ipAddress` | string | IP address of the requester |
| `name` | string | Name of the user (if provided) |
| `email` | string | Email of the user (if provided) |
| `storeName` | string | Store name associated with the generation |
| `clothingKey` | string | Clothing image key |
| `personKey` | string | Person image key |
| `createdAt` | string | Creation timestamp in ISO 8601 format |
| `updatedAt` | string | Last update timestamp in ISO 8601 format |

### Pagination Object

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total number of records matching the query |
| `page` | number | Current page number |
| `limit` | number | Number of records per page |
| `totalPages` | number | Total number of pages |
| `hasNext` | boolean | Whether there's a next page available |
| `hasPrev` | boolean | Whether there's a previous page available |

---

## Example Requests

### 1. Get All Generations (Default)
```
GET /api/image-generations/all
```
Returns first 50 records, sorted by `created_at` DESC.

### 2. Filter by Store Name
```
GET /api/image-generations/all?storeName=my-shop
```
Returns all generations for the specified store.

### 3. Filter by Status and Store
```
GET /api/image-generations/all?status=completed&storeName=my-shop&page=1&limit=50
```
Returns completed generations for the specified store.

### 4. Filter by Multiple Criteria
```
GET /api/image-generations/all?page=1&limit=50&status=completed&orderBy=created_at&orderDirection=DESC&storeName=my-shop&user=192.168.1.1
```
Returns completed generations filtered by store name and IP address, sorted by creation date.

### 5. Pagination Example
```
GET /api/image-generations/all?page=2&limit=25
```
Returns second page with 25 records per page.

### 6. Sort Ascending
```
GET /api/image-generations/all?orderBy=created_at&orderDirection=ASC
```
Returns generations sorted by creation date in ascending order.

---

## Error Responses

### 503 Service Unavailable
Database service is unavailable.

```json
{
  "error": "Server Error",
  "message": "Database service unavailable",
  "code": "SERVER_ERROR",
  "details": {
    "service": "database"
  }
}
```

### 500 Internal Server Error
Failed to retrieve image generations.

```json
{
  "error": "Server Error",
  "message": "Failed to retrieve all image generations",
  "code": "SERVER_ERROR",
  "details": {
    "originalError": "Error message details"
  }
}
```

---

## Status Values

| Status | Description |
|--------|-------------|
| `pending` | Generation is queued and waiting to be processed |
| `processing` | Generation is currently being processed |
| `completed` | Generation completed successfully |
| `failed` | Generation failed with an error |

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- The `fileSize` field is automatically formatted as MB (e.g., "2.5 MB")
- The `storeName` filter performs an exact match
- The `user` parameter filters by IP address (exact match)
- Pagination starts at page 1
- Default sort order is by `created_at` in descending order (newest first)
- Empty or null query parameters are ignored (no filter applied)
- The `store_name` column is indexed for efficient filtering


