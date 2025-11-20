# Backend Logging Improvements

## Overview
Comprehensive logging improvements have been implemented to help diagnose and fix the 504 timeout issues with the `/api/billing/subscribe` endpoint.

## Changes Made

### 1. Enhanced Logger Utility (`server/utils/logger.js`)
- **Added performance timers**: `createTimer()` function for tracking operation duration
- **Improved log formatting**: Better metadata serialization with truncation for long values
- **GraphQL logging**: New `logGraphQL()` function for detailed GraphQL operation tracking
- **Enhanced error logging**: Better error context including request details, headers, and error codes

### 2. Improved Billing Module (`server/utils/billing.js`)
- **Comprehensive step-by-step logging**: Every operation is now logged with timestamps
- **Session validation**: Added checks for valid session and access token before GraphQL calls
- **Better timeout handling**: Reduced timeout to 20 seconds (from 25s) to leave buffer for Vercel's 60s limit
- **GraphQL client error handling**: Proper error handling for client creation and query execution
- **Response parsing logging**: Detailed logging of GraphQL response structure
- **Error categorization**: Distinguishes between GraphQL API errors and user errors

### 3. Enhanced API Endpoint (`server/index.js`)
- **Request tracking**: Unique request IDs for tracing requests through the system
- **Performance breakdown**: Detailed timing breakdown for each operation phase
- **Better error context**: Comprehensive error logging with request details
- **Timeout detection**: Improved detection of timeout errors (504 vs 500)
- **Session retrieval logging**: Detailed logging of session retrieval process

## Key Improvements for Debugging

### Request Flow Tracking
Every request now has:
- Unique request ID (`req-{timestamp}-{random}`)
- Operation ID for billing operations (`billing-{timestamp}-{random}`)
- Step-by-step timing information

### Performance Metrics
The logging now tracks:
- Body parsing time
- Shop domain extraction time
- Session ID generation time
- Session retrieval time
- GraphQL client creation time
- GraphQL request duration
- Total request time

### Error Context
Errors now include:
- Full error stack traces (truncated for readability)
- Request context (method, path, headers, body)
- Operation context (shop, planHandle, session info)
- Timeout detection
- Error categorization

## Log Levels

The logger supports different log levels via `LOG_LEVEL` environment variable:
- `ERROR` (0): Only errors
- `WARN` (1): Warnings and errors
- `INFO` (2): Info, warnings, and errors (default)
- `DEBUG` (3): All logs including debug messages

## Timeout Configuration

- **GraphQL Request Timeout**: 20 seconds
- **Vercel Function Timeout**: 60 seconds (configured in `vercel.json`)
- **Buffer**: 20s timeout leaves 40s buffer for error handling and response

## How to Use

### Viewing Logs in Vercel
1. Go to your Vercel dashboard
2. Navigate to your project
3. Click on "Functions" tab
4. View function logs for `/api/billing/subscribe`

### Local Development
Logs will appear in your console with structured format:
```
[2024-01-01T12:00:00.000Z] [INFO] [API] [SUBSCRIBE] ===== REQUEST START =====
{
  "requestId": "req-1234567890-abc123",
  "method": "POST",
  "path": "/api/billing/subscribe",
  ...
}
```

### Debugging a Specific Request
1. Find the request ID in the logs
2. Search for all log entries with that request ID
3. Follow the flow from start to finish
4. Check timing breakdown to identify slow operations

## Common Issues to Look For

### 1. Session Issues
Look for logs like:
- `[BILLING] [CREATE] Invalid session - missing access token`
- `[API] [SUBSCRIBE] Session not found`

**Solution**: Ensure the app is properly installed and authenticated.

### 2. GraphQL Timeouts
Look for logs like:
- `[BILLING] [CREATE] GraphQL request timeout`
- `Gateway Timeout` (504 status)

**Solution**: Check Shopify API status, network connectivity, or increase timeout if needed.

### 3. Slow Operations
Check the timing breakdown in success logs:
```json
{
  "breakdown": {
    "bodyParsing": "2ms",
    "sessionIdGeneration": "1ms",
    "sessionRetrieval": "150ms",
    "billingCreation": "5000ms",
    "total": "5153ms"
  }
}
```

This helps identify which operation is slow.

## Next Steps

1. **Monitor logs** after deployment to identify patterns
2. **Check Vercel function logs** for the `/api/billing/subscribe` endpoint
3. **Look for timeout patterns** - if timeouts occur consistently at a specific step
4. **Optimize slow operations** based on timing breakdown data

## Additional Notes

- All sensitive data (access tokens, etc.) are logged as "present" or "missing" rather than actual values
- Long strings and objects are truncated in logs for readability
- Request IDs are included in error responses for easier debugging
- GraphQL responses are logged with full structure for debugging

