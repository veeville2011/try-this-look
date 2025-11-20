# Circular Reference Fix

## Problem
All subscription APIs were failing with:
```
Unhandled Rejection: TypeError: Converting circular structure to JSON
    --> starting at object with constructor 'Socket'
    |     property 'parser' -> object with constructor 'HTTPParser'
    --- property 'socket' closes the circle
```

## Root Cause
The Express `req` object contains circular references (Socket ↔ HTTPParser). When the logger tried to `JSON.stringify()` metadata containing the `req` object, it failed.

## Solution
Implemented comprehensive circular reference handling in the logger:

### 1. Safe JSON Stringify Function
- Added `safeStringify()` that handles:
  - Circular references (replaces with `[Circular Reference]`)
  - Functions (converts to `[Function: name]`)
  - Errors (extracts safe properties)
  - Dates (converts to ISO string)
  - Buffers (shows size)
  - Undefined values

### 2. Object Sanitization
- Added `sanitizeObject()` that recursively sanitizes objects:
  - Skips problematic properties (`socket`, `connection`, `parser`, `_httpMessage`)
  - Handles nested objects safely
  - Limits depth to prevent infinite recursion

### 3. Request Info Extraction
- Added `extractRequestInfo()` that safely extracts request data:
  - Only extracts safe, serializable properties
  - Handles body serialization safely
  - Never passes the full `req` object to JSON.stringify

### 4. Updated All Logging Functions
- `logError()` - Now uses `extractRequestInfo()` instead of passing `req` directly
- `logRequest()` - Safely extracts request properties
- `logResponse()` - Safely extracts response properties
- `logGraphQL()` - Uses `safeStringify()` for variables
- `formatLogMessage()` - Uses `sanitizeObject()` before stringifying

## Files Changed
- `server/utils/logger.js` - Complete rewrite of serialization logic

## Testing
The fix ensures:
1. ✅ No circular reference errors
2. ✅ All request data is still logged (safely extracted)
3. ✅ Error information is preserved
4. ✅ Performance is not significantly impacted

## What's Logged Now
Instead of the full `req` object, we now log:
```json
{
  "request": {
    "method": "POST",
    "path": "/api/billing/subscribe",
    "url": "/api/billing/subscribe?shop=...",
    "query": { "shop": "..." },
    "body": "{ ... }",
    "ip": "127.0.0.1",
    "userAgent": "...",
    "headers": {
      "authorization": "present",
      "contentType": "application/json"
    }
  }
}
```

All the important information is preserved, but without circular references!

