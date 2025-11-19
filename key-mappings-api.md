## Key Mappings API Integration Guide

### Overview
- **Purpose:** Surface existing outfit combinations stored in Google Sheets.
- **Endpoint:** `GET /api/key-mappings`
- **Requires:** Google Sheets connection (`sheetsConnected` true).

### Query Parameters
| Name         | Type   | Required | Description                                                     |
|--------------|--------|----------|-----------------------------------------------------------------|
| `clothingKey`| string | optional | Return every `personKey` tied to this clothing key.             |
| `personKey`  | string | optional | Return every `clothingKey` tied to this person key.             |

> At least one parameter must be provided. Strings are trimmed server-side.

### Response Shapes
```json
{
  "status": "success",
  "data": {
    "clothingKey": "ck-1001",             // only when requested
    "personKeys": ["pk-1", "pk-7"],      // optional array
    "personKey": "pk-1",                  // only when requested
    "clothingKeys": ["ck-1001"]           // optional array
  },
  "metadata": {
    "personKeysCount": 2,
    "clothingKeysCount": 1
  }
}
```

### Error Responses
| HTTP | Code (`error_message.code`) | Scenario                                           |
|------|----------------------------|----------------------------------------------------|
| 400  | `VALIDATION_ERROR`         | Neither parameter supplied.                        |
| 503  | `SERVER_ERROR`             | Google Sheets unavailable.                         |
| 500  | `SERVER_ERROR`             | Unexpected failure (details included).             |

Example validation error:
```json
{
  "status": "error",
  "image": null,
  "error_message": {
    "code": "VALIDATION_ERROR",
    "message": "At least one of 'clothingKey' or 'personKey' query parameter is required",
    "details": { "provided": { "clothingKey": false, "personKey": false } }
  },
  "timestamp": "2025-11-19T11:15:12.123Z"
}
```

### Sample Requests
**Person keys by clothing key**
```bash
curl "https://<host>/api/key-mappings?clothingKey=sku-2024-hoodie"
```

**Clothing keys by person key**
```bash
curl "https://<host>/api/key-mappings?personKey=model-a1"
```

**Combined lookup**
```bash
curl "https://<host>/api/key-mappings?clothingKey=sku-2024-hoodie&personKey=model-a1"
```

### Integration Notes
- Invoke before triggering expensive generation to determine if a pairing already exists.
- Perfect for populating UI dropdowns/autocomplete with historical keys.
- Handle empty arrays gracefully—means no combinations recorded yet.
- When the service reports sheets unavailable (503), skip caching logic and surface retry guidance.

### Testing
1. Hit `GET /health` to confirm the server is live.
2. Issue representative queries using curl or the provided Node test script.
3. Validate response metadata counts to ensure pagination isn’t required (API returns all matches).

