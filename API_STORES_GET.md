# API Integration Document: `/api/stores`

## Overview

The `/api/stores` endpoint is used to retrieve store information by shop domain. It queries the Google Sheets database to fetch store metadata and configuration, excluding sensitive encrypted access tokens for security.

## Endpoint Details

- **URL**: `/api/stores`
- **Method**: `GET`
- **Content-Type**: `application/json`
- **Access**: Public (should be secured in production)

## Request Specification

### Request Headers

```
Content-Type: application/json
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shop` | string | Yes | Shopify store domain or handle (e.g., "example" or "example.myshopify.com") |

### Request Example

```bash
GET /api/stores?shop=example.myshopify.com
```

```bash
GET /api/stores?shop=example
```

### Shop Domain Normalization

The API automatically normalizes the shop domain:
- Accepts both formats: `"example"` or `"example.myshopify.com"`
- Converts to lowercase
- Validates format according to Shopify domain rules
- Returns normalized format: `"example.myshopify.com"`

**Valid formats:**
- `"example"` → `"example.myshopify.com"`
- `"example.myshopify.com"` → `"example.myshopify.com"`
- `"EXAMPLE"` → `"example.myshopify.com"` (case-insensitive)

**Invalid formats:**
- Empty strings
- Invalid characters
- Malformed domains

## Response Specification

### Success Response (200 OK)

**Status Code**: `200`

**Response Body**:
```json
{
  "success": true,
  "message": "Store information retrieved successfully",
  "data": {
    "shop": "example.myshopify.com",
    "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxxx",
    "scope": "read_products,write_products",
    "isOnline": false,
    "expires": "2024-12-31T23:59:59.000Z",
    "sessionId": "session_123456",
    "state": "random_state_string",
    "apiKey": "your_api_key",
    "appUrl": "https://your-app.com",
    "installedAt": "2024-01-15T10:30:00.000Z",
    "uninstalledAt": null,
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response Fields**:
- `success` (boolean): Always `true` for successful requests
- `message` (string): Success message
- `data` (object): Store information object containing:
  - `shop` (string): Normalized shop domain
  - `accessToken` (string|null): Decrypted Shopify OAuth access token or null if unavailable
  - `scope` (string): Comma-separated list of OAuth scopes
  - `isOnline` (boolean): Whether the access token is an online token
  - `expires` (string|null): Token expiration timestamp (ISO 8601 format) or null
  - `sessionId` (string): OAuth session identifier
  - `state` (string): OAuth state parameter
  - `apiKey` (string): Shopify API key
  - `appUrl` (string): Application URL
  - `installedAt` (string): Installation timestamp (ISO 8601 format)
  - `uninstalledAt` (string|null): Uninstallation timestamp (ISO 8601 format) or null for active stores
  - `isActive` (boolean): Active status of the store
  - `createdAt` (string): Record creation timestamp (ISO 8601 format)
  - `updatedAt` (string): Last update timestamp (ISO 8601 format)

**Note**: The `accessToken` is returned decrypted and ready to use. It will be `null` if the token cannot be decrypted or is unavailable.

### Error Responses

#### 400 Bad Request - Validation Error

**Status Code**: `400`

**Response Body**:
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Missing required query parameter: shop"
}
```

**Common Error Messages**:
- `"Missing required query parameter: shop"` - Shop domain query parameter is missing
- `"Invalid shop domain format"` - Shop domain format is invalid

#### 404 Not Found

**Status Code**: `404`

**Response Body**:
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Store not found: example.myshopify.com"
}
```

**Possible Causes**:
- Store has not been installed yet
- Store was uninstalled and removed
- Shop domain does not exist in the database

#### 500 Internal Server Error

**Status Code**: `500`

**Response Body**:
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "Failed to retrieve store information"
}
```

**Possible Causes**:
- Google Sheets API connection issues
- Missing or invalid Google Sheets configuration
- Database/storage service unavailable
- Internal service errors

## Behavior Details

### Store Retrieval Logic

1. **Validation**: Validates that the `shop` query parameter is provided
2. **Normalization**: Normalizes shop domain to standard format
3. **Lookup**: Queries Google Sheets for the store record
4. **Response**: Returns store information (excluding encrypted access token)

### Security Considerations

1. **Access Token Decryption**: Access tokens are stored encrypted and are decrypted before being returned in the response
2. **Domain Validation**: Shop domains are validated and normalized to prevent injection attacks
3. **Error Handling**: Error messages don't expose sensitive information
4. **Production Security**: The endpoint is currently public but should be secured in production (authentication/authorization required) since it returns sensitive access tokens

## Integration Examples

### cURL Example

```bash
curl -X GET "https://your-api-domain.com/api/stores?shop=example.myshopify.com" \
  -H "Content-Type: application/json"
```

### JavaScript/Node.js Example

```javascript
const shop = 'example.myshopify.com';
const response = await fetch(`https://your-api-domain.com/api/stores?shop=${encodeURIComponent(shop)}`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  }
});

const data = await response.json();

if (data.success) {
  console.log('Store information:', data.data);
  console.log('Shop:', data.data.shop);
  console.log('Is Active:', data.data.isActive);
  console.log('Scopes:', data.data.scope);
} else {
  console.error('Error:', data.message);
  
  if (data.error === 'Not Found') {
    console.log('Store not found. Install the store first.');
  }
}
```

### Python Example

```python
import requests
from urllib.parse import urlencode

shop = 'example.myshopify.com'
url = f'https://your-api-domain.com/api/stores?{urlencode({"shop": shop})}'

response = requests.get(url, headers={'Content-Type': 'application/json'})
data = response.json()

if data.get('success'):
    store_info = data['data']
    print(f"Store information retrieved:")
    print(f"Shop: {store_info['shop']}")
    print(f"Is Active: {store_info['isActive']}")
    print(f"Scopes: {store_info['scope']}")
    print(f"Installed At: {store_info['installedAt']}")
else:
    print(f"Error: {data.get('message')}")
    
    if data.get('error') == 'Not Found':
        print('Store not found. Install the store first.')
```

### React/Next.js Example

```typescript
const getStoreInfo = async (shop: string) => {
  try {
    const response = await fetch(`/api/stores?shop=${encodeURIComponent(shop)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Failed to retrieve store information:', error);
    throw error;
  }
};

// Usage
const storeInfo = await getStoreInfo('example.myshopify.com');
console.log('Store:', storeInfo.shop);
console.log('Active:', storeInfo.isActive);
```

## Error Handling Best Practices

1. **Always check the `success` field** in the response before proceeding
2. **Handle validation errors** (400) by checking the `message` field for specific issues
3. **Handle not found errors** (404) by checking if the store needs to be installed first
4. **Handle server errors** (500) with appropriate retry logic or user notification
5. **Validate shop domain** on the client side before making the request
6. **Use proper URL encoding** when passing shop domain as a query parameter

## Related Endpoints

- **POST `/api/stores/install`**: Install or update a Shopify store
- **POST `/api/stores/uninstall`**: Uninstall a Shopify store

## Notes

- The endpoint returns store metadata including the decrypted access token
- Access tokens are stored encrypted in Google Sheets and are automatically decrypted when retrieved
- Store information is retrieved from Google Sheets in real-time
- The endpoint supports both short (`"example"`) and full (`"example.myshopify.com"`) shop domain formats
- The `accessToken` field will be `null` if decryption fails or the token is unavailable

