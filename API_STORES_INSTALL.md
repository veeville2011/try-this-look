# API Integration Document: `/api/stores/install`

## Overview

The `/api/stores/install` endpoint is used to install or update a Shopify store in the system. It handles the storage of store credentials and metadata in Google Sheets, with automatic encryption of sensitive access tokens.

## Endpoint Details

- **URL**: `/api/stores/install`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Access**: Public (should be secured in production)

## Request Specification

### Request Headers

```
Content-Type: application/json
```

### Request Body

The request body should be a JSON object with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `shop` | string | Yes | Shopify store domain or handle (e.g., "example" or "example.myshopify.com") |
| `accessToken` | string | Yes | Shopify OAuth access token for the store |
| `scope` | string | No | Comma-separated list of OAuth scopes granted |
| `isOnline` | boolean | No | Whether the access token is an online token (default: `false`) |
| `expires` | string | No | Token expiration timestamp (ISO 8601 format) |
| `sessionId` | string | No | Session identifier from OAuth flow |
| `state` | string | No | State parameter from OAuth flow |
| `apiKey` | string | No | Shopify API key |
| `appUrl` | string | No | Application URL |
| `installedAt` | string | No | Installation timestamp (ISO 8601 format). If not provided, current timestamp is used |

### Request Example

```json
{
  "shop": "example.myshopify.com",
  "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxxx",
  "scope": "read_products,write_products",
  "isOnline": false,
  "expires": "2024-12-31T23:59:59.000Z",
  "sessionId": "session_123456",
  "state": "random_state_string",
  "apiKey": "your_api_key",
  "appUrl": "https://your-app.com",
  "installedAt": "2024-01-15T10:30:00.000Z"
}
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
  "message": "Store data saved successfully",
  "shop": "example.myshopify.com",
  "savedAt": "2024-01-15T10:30:00.000Z"
}
```

**Response Fields**:
- `success` (boolean): Always `true` for successful requests
- `message` (string): Success message
- `shop` (string): Normalized shop domain
- `savedAt` (string): ISO 8601 timestamp of when the data was saved

### Error Responses

#### 400 Bad Request - Validation Error

**Status Code**: `400`

**Response Body**:
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Missing required field: shop"
}
```

**Common Error Messages**:
- `"Missing required field: shop"` - Shop domain is missing
- `"Missing required field: accessToken"` - Access token is missing
- `"Missing required fields: shop, accessToken"` - Multiple required fields missing
- `"Invalid shop domain format"` - Shop domain format is invalid

#### 500 Internal Server Error

**Status Code**: `500`

**Response Body**:
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "Failed to save store data"
}
```

**Possible Causes**:
- Google Sheets API connection issues
- Missing or invalid Google Sheets configuration
- Database/storage service unavailable
- Encryption service failure

## Behavior Details

### Store Installation Logic

1. **Validation**: Validates required fields (`shop`, `accessToken`)
2. **Normalization**: Normalizes shop domain to standard format
3. **Encryption**: Encrypts access token before storage
4. **Store Lookup**: Checks if store already exists
5. **Create or Update**:
   - **New Store**: Creates a new record with all provided data
   - **Existing Store**: Updates existing record, preserving original `createdAt` and `installedAt` timestamps
6. **Storage**: Saves data to Google Sheets

### Data Storage

The endpoint stores data in a Google Sheet with the following columns:

| Column | Description | Notes |
|--------|-------------|-------|
| `shop` | Normalized shop domain | Primary identifier |
| `accessToken` | Encrypted access token | Stored encrypted |
| `scope` | OAuth scopes | Comma-separated string |
| `isOnline` | Online token flag | Boolean |
| `expires` | Token expiration | ISO 8601 timestamp |
| `sessionId` | OAuth session ID | String |
| `state` | OAuth state parameter | String |
| `apiKey` | Shopify API key | String |
| `appUrl` | Application URL | String |
| `installedAt` | Installation timestamp | ISO 8601 timestamp |
| `uninstalledAt` | Uninstallation timestamp | ISO 8601 timestamp (empty for active stores) |
| `isActive` | Active status | Boolean (always `true` for install) |
| `createdAt` | Record creation timestamp | ISO 8601 timestamp |
| `updatedAt` | Last update timestamp | ISO 8601 timestamp |

### Security Considerations

1. **Access Token Encryption**: Access tokens are encrypted before storage using the encryption utility
2. **Domain Validation**: Shop domains are validated and normalized to prevent injection attacks
3. **Error Handling**: Error messages don't expose sensitive information
4. **Production Security**: The endpoint is currently public but should be secured in production (authentication/authorization required)

## Integration Examples

### cURL Example

```bash
curl -X POST https://your-api-domain.com/api/stores/install \
  -H "Content-Type: application/json" \
  -d '{
    "shop": "example.myshopify.com",
    "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxxx",
    "scope": "read_products,write_products",
    "isOnline": false
  }'
```

### JavaScript/Node.js Example

```javascript
const response = await fetch('https://your-api-domain.com/api/stores/install', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    shop: 'example.myshopify.com',
    accessToken: 'shpat_xxxxxxxxxxxxxxxxxxxxx',
    scope: 'read_products,write_products',
    isOnline: false,
    expires: '2024-12-31T23:59:59.000Z',
    sessionId: 'session_123456',
    state: 'random_state_string',
    apiKey: 'your_api_key',
    appUrl: 'https://your-app.com',
    installedAt: new Date().toISOString()
  })
});

const data = await response.json();

if (data.success) {
  console.log('Store installed successfully:', data.shop);
} else {
  console.error('Error:', data.message);
}
```

### Python Example

```python
import requests
import json
from datetime import datetime

url = 'https://your-api-domain.com/api/stores/install'
payload = {
    'shop': 'example.myshopify.com',
    'accessToken': 'shpat_xxxxxxxxxxxxxxxxxxxxx',
    'scope': 'read_products,write_products',
    'isOnline': False,
    'expires': '2024-12-31T23:59:59.000Z',
    'sessionId': 'session_123456',
    'state': 'random_state_string',
    'apiKey': 'your_api_key',
    'appUrl': 'https://your-app.com',
    'installedAt': datetime.now().isoformat()
}

response = requests.post(url, json=payload)
data = response.json()

if data.get('success'):
    print(f"Store installed successfully: {data['shop']}")
else:
    print(f"Error: {data.get('message')}")
```

## Error Handling Best Practices

1. **Always check the `success` field** in the response before proceeding
2. **Handle validation errors** (400) by checking the `message` field for specific missing fields
3. **Implement retry logic** for 500 errors with exponential backoff
4. **Log errors** for debugging and monitoring
5. **Validate shop domain format** on the client side before sending the request

## Dependencies

### Required Environment Variables

The endpoint requires the following Google Sheets configuration:

- `GOOGLE_SHEETS_ID`: Google Spreadsheet ID
- `GOOGLE_PROJECT_ID`: Google Cloud Project ID
- `GOOGLE_PRIVATE_KEY_ID`: Google Service Account Private Key ID
- `GOOGLE_PRIVATE_KEY`: Google Service Account Private Key
- `GOOGLE_CLIENT_EMAIL`: Google Service Account Client Email
- `GOOGLE_CLIENT_ID`: Google Service Account Client ID

### Service Dependencies

- Google Sheets API (for data storage)
- Encryption service (for access token encryption)
- Shopify domain normalization utility

## Notes

1. **Idempotency**: The endpoint is idempotent - calling it multiple times with the same shop will update the existing record rather than creating duplicates
2. **Timestamp Handling**: If `installedAt` is not provided, the current timestamp is used. For existing stores, the original `installedAt` is preserved
3. **Token Encryption**: Access tokens are automatically encrypted before storage and must be decrypted when retrieved
4. **Store Updates**: When updating an existing store, only provided fields are updated; missing fields retain their existing values
5. **Active Status**: The `isActive` field is automatically set to `true` when installing/updating a store

## Version History

- **v1.0**: Initial implementation with Google Sheets storage and encryption support

