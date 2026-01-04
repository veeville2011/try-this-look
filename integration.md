# Credit Allocation Integration Guide

## Overview

The credit allocation system has been migrated from webhook-driven to API-driven architecture. All credit operations (initialization, plan changes, renewals, cancellations) are now triggered via API endpoints instead of Shopify webhooks.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Endpoints](#api-endpoints)
3. [Integration Workflow](#integration-workflow)
4. [Request/Response Specifications](#requestresponse-specifications)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)
7. [Migration Notes](#migration-notes)

---

## Architecture Overview

### Key Changes

- **Webhook-driven → API-driven**: Credit allocation is now triggered explicitly via API calls
- **No webhook dependency**: The `APP_SUBSCRIPTIONS_UPDATE` webhook endpoint has been completely removed
- **Explicit control**: You control when and how credits are allocated by calling the appropriate endpoints

### Credit Allocation Flow

1. **Subscription Created**: Call sync endpoint after subscription approval
2. **Plan Changed**: Call sync endpoint after plan upgrade/downgrade
3. **Subscription Renewed**: Call sync endpoint on renewal (if needed)
4. **Subscription Cancelled**: Call cancel endpoint or rely on sync endpoint detection

---

## API Endpoints

### 1. Sync Credits from Subscription

**Endpoint**: `POST /api/credits/sync`

**Description**: Main endpoint for credit allocation. Fetches subscription from Shopify and syncs credits based on the current subscription state. Handles initialization, plan changes, renewals, and cancellation detection automatically.

**When to Use**:
- After subscription is approved/created
- After plan upgrade or downgrade
- After subscription renewal
- To manually sync credits (periodic sync, error recovery)
- After payment method update

**Query Parameters**:
- `shop` (required): Shop domain (e.g., `example.myshopify.com`) or shop handle

**Request Body** (optional):
- `shop` (optional): Alternative to query parameter

**Response Actions**:
The endpoint returns different `action` values based on what was performed:
- `initialized`: Credits were initialized for a new subscription
- `plan_changed`: Plan was changed and credits were updated
- `renewed`: Credits were updated on renewal
- `cancellation`: Subscription was cancelled and credits were cleared
- `no_action`: Credits are already synchronized (no changes needed)

**Success Response** (200):
- Contains `success: true`, `action`, `message`, `requestId`
- May include `planHandle`, `includedCredits`, `oldPlanHandle`, `newPlanHandle` based on action

**Error Responses**:
- `400`: Missing/invalid shop parameter
- `401`: Authentication error (failed to get access token)
- `404`: No active subscription found
- `500`: Server error (failed to fetch subscriptions, sync credits, etc.)

---

### 2. Cancel Subscription Credits

**Endpoint**: `POST /api/credits/cancel`

**Description**: Explicitly handles subscription cancellation. Clears plan credits while preserving coupon and purchased credits.

**When to Use**:
- After subscription is cancelled in Shopify
- To explicitly clear credits when subscription ends
- As an alternative to sync endpoint (sync endpoint also detects cancellation)

**Query Parameters**:
- `shop` (required): Shop domain (e.g., `example.myshopify.com`) or shop handle

**Request Body** (optional):
- `shop` (optional): Alternative to query parameter

**Success Response** (200):
- Contains `success: true`, `message`, `requestId`

**Error Responses**:
- `400`: Missing/invalid shop parameter
- `500`: Server error (failed to cancel credits)

**Note**: The sync endpoint also handles cancellation automatically when no active subscriptions are found. You can use either endpoint for cancellation.

---

## Integration Workflow

### Scenario 1: New Subscription Creation

**Flow**:
1. User selects a plan and initiates subscription
2. Shopify subscription is created (via billing API)
3. User is redirected to Shopify confirmation page
4. User approves subscription
5. User is redirected back to your app (payment-success page)
6. **Call sync endpoint** to initialize credits

**Integration Point**: After subscription approval, on payment-success page or subscription confirmation callback

**Recommended Approach**: Call sync endpoint immediately after detecting successful subscription approval

---

### Scenario 2: Plan Change (Upgrade/Downgrade)

**Flow**:
1. User selects a new plan
2. Shopify subscription is updated (existing subscription is cancelled, new one is created)
3. User approves new subscription
4. User is redirected back to your app
5. **Call sync endpoint** to update credits

**Integration Point**: After new subscription is approved

**Recommended Approach**: Call sync endpoint after detecting subscription change

---

### Scenario 3: Subscription Renewal

**Flow**:
1. Shopify automatically renews subscription (monthly/annual billing cycle)
2. Subscription status remains ACTIVE
3. Credits need to be refreshed/updated for new billing period
4. **Call sync endpoint** to ensure credits are allocated correctly

**Integration Point**: 
- On subscription renewal (if you track renewal events)
- Periodic sync (daily/weekly background job)
- When user accesses app and subscription period has changed

**Recommended Approach**: 
- Option 1: Call sync endpoint on user login/app access (checks if renewal occurred)
- Option 2: Set up a periodic background job to sync credits
- Option 3: Call sync endpoint when detecting subscription period has changed

---

### Scenario 4: Subscription Cancellation

**Flow**:
1. User cancels subscription in Shopify
2. Subscription status changes to CANCELLED
3. Credits need to be cleared
4. **Call sync endpoint OR cancel endpoint** to clear credits

**Integration Point**: After subscription cancellation

**Recommended Approaches**:
- **Option 1**: Call sync endpoint - it automatically detects cancellation when no active subscriptions are found
- **Option 2**: Call cancel endpoint explicitly when you know subscription was cancelled

**Note**: Sync endpoint handles cancellation automatically, so you may not need the cancel endpoint unless you want explicit control.

---

## Request/Response Specifications

### Sync Endpoint Request

**URL**: `POST /api/credits/sync?shop={shopDomain}`

**Headers**:
- `Content-Type: application/json` (if using request body)

**Query Parameters**:
- `shop` (required): Shop domain in format `example.myshopify.com` or shop handle

**Request Body** (optional):
```json
{
  "shop": "example.myshopify.com"
}
```

---

### Sync Endpoint Response - Initialized

**Status**: 200 OK

**Response Body**:
```json
{
  "success": true,
  "action": "initialized",
  "message": "Credits initialized successfully",
  "planHandle": "pro-monthly",
  "includedCredits": 500,
  "requestId": "req-1234567890-abc123"
}
```

---

### Sync Endpoint Response - Plan Changed

**Status**: 200 OK

**Response Body**:
```json
{
  "success": true,
  "action": "plan_changed",
  "message": "Plan changed - credits updated",
  "oldPlanHandle": "starter-monthly",
  "newPlanHandle": "pro-monthly",
  "includedCredits": 500,
  "requestId": "req-1234567890-abc123"
}
```

---

### Sync Endpoint Response - Renewed

**Status**: 200 OK

**Response Body**:
```json
{
  "success": true,
  "action": "renewed",
  "message": "Plan credits updated",
  "planHandle": "pro-monthly",
  "includedCredits": 500,
  "requestId": "req-1234567890-abc123"
}
```

---

### Sync Endpoint Response - Cancellation Detected

**Status**: 200 OK

**Response Body**:
```json
{
  "success": true,
  "action": "cancellation",
  "message": "Subscription cancelled - credits cleared",
  "requestId": "req-1234567890-abc123"
}
```

---

### Sync Endpoint Response - No Action Needed

**Status**: 200 OK

**Response Body**:
```json
{
  "success": true,
  "action": "no_action",
  "message": "Credits already synchronized",
  "planHandle": "pro-monthly",
  "includedCredits": 500,
  "requestId": "req-1234567890-abc123"
}
```

---

### Sync Endpoint Error Response - Missing Shop

**Status**: 400 Bad Request

**Response Body**:
```json
{
  "error": "Missing shop parameter",
  "message": "Shop parameter is required",
  "requestId": "req-1234567890-abc123"
}
```

---

### Sync Endpoint Error Response - Authentication Error

**Status**: 401 Unauthorized

**Response Body**:
```json
{
  "error": "Authentication error",
  "message": "Failed to get shop access token",
  "requestId": "req-1234567890-abc123"
}
```

---

### Sync Endpoint Error Response - No Subscription

**Status**: 404 Not Found

**Response Body**:
```json
{
  "error": "No active subscription found",
  "message": "No active subscription found for this shop",
  "requestId": "req-1234567890-abc123"
}
```

---

### Sync Endpoint Error Response - Server Error

**Status**: 500 Internal Server Error

**Response Body**:
```json
{
  "error": "Failed to sync credits",
  "message": "Error details here",
  "requestId": "req-1234567890-abc123"
}
```

---

### Cancel Endpoint Request

**URL**: `POST /api/credits/cancel?shop={shopDomain}`

**Headers**:
- `Content-Type: application/json` (if using request body)

**Query Parameters**:
- `shop` (required): Shop domain in format `example.myshopify.com` or shop handle

**Request Body** (optional):
```json
{
  "shop": "example.myshopify.com"
}
```

---

### Cancel Endpoint Response - Success

**Status**: 200 OK

**Response Body**:
```json
{
  "success": true,
  "message": "Subscription cancellation handled - credits cleared",
  "requestId": "req-1234567890-abc123"
}
```

---

### Cancel Endpoint Error Response

Same error format as sync endpoint (400, 500 status codes with error details and requestId).

---

## Error Handling

### Error Response Format

All error responses follow this format:
```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "requestId": "req-1234567890-abc123"
}
```

### Common Error Scenarios

#### 1. Missing Shop Parameter (400)
- **Cause**: Shop parameter not provided in query or body
- **Solution**: Ensure `shop` parameter is included in request
- **Retry**: Yes, after fixing the request

#### 2. Invalid Shop Domain (400)
- **Cause**: Shop parameter format is invalid
- **Solution**: Provide valid `.myshopify.com` domain or shop handle
- **Retry**: Yes, after fixing the shop parameter

#### 3. Authentication Error (401)
- **Cause**: Failed to get access token for shop (shop not installed, token expired, etc.)
- **Solution**: Ensure shop is properly installed and has valid access token
- **Retry**: No, requires shop re-authentication

#### 4. No Active Subscription (404)
- **Cause**: No active subscription found for shop
- **Solution**: Verify subscription status in Shopify
- **Retry**: Yes, if subscription should exist
- **Note**: This is also returned when subscription is cancelled (expected behavior)

#### 5. Plan Mapping Error (400)
- **Cause**: Cannot determine plan information from subscription
- **Solution**: Contact support - subscription may have unexpected pricing
- **Retry**: No, requires investigation

#### 6. Server Error (500)
- **Cause**: Internal server error (database, Shopify API, etc.)
- **Solution**: Check server logs, retry after delay
- **Retry**: Yes, with exponential backoff

### Request ID

Every response includes a `requestId` field. Use this for:
- Logging and debugging
- Support requests
- Error tracking
- Request correlation

---

## Best Practices

### 1. When to Call Sync Endpoint

**Call Immediately**:
- After subscription approval/confirmation
- After plan change approval
- After subscription cancellation (or use cancel endpoint)

**Call Periodically**:
- Daily/weekly background job to ensure credits stay in sync
- On user login/app access (optional - checks if sync needed)

**Call on Error Recovery**:
- If credit balance seems incorrect
- After subscription status changes
- After manual subscription updates in Shopify

### 2. Idempotency

- The sync endpoint is **idempotent** - safe to call multiple times
- Calling sync when credits are already synchronized returns `no_action`
- No negative side effects from multiple calls

### 3. Error Handling Strategy

- **Retry Logic**: Implement exponential backoff for 500 errors
- **Logging**: Always log `requestId` for error tracking
- **User Feedback**: Show appropriate error messages to users
- **Fallback**: Handle errors gracefully - don't block user workflow unnecessarily

### 4. Performance Considerations

- Sync endpoint fetches subscription from Shopify (may take 1-2 seconds)
- Cache results if needed (but sync is idempotent, so calling multiple times is safe)
- Consider async processing for non-critical sync operations

### 5. Integration Points

**Frontend Integration**:
- Call sync endpoint after subscription confirmation redirect
- Show loading state while sync is in progress
- Handle errors gracefully with user-friendly messages

**Backend Integration**:
- Call sync endpoint in webhook handlers (if you still have other webhooks)
- Call sync endpoint in background jobs
- Call sync endpoint on subscription status checks

### 6. Testing Recommendations

- Test with different plan types (Free, Starter, Growth, Pro)
- Test with monthly and annual plans
- Test plan changes (upgrade/downgrade)
- Test cancellation scenarios
- Test error scenarios (invalid shop, no subscription, etc.)
- Verify idempotency (multiple calls return same result)

---

## Migration Notes

### What Changed

1. **Webhook Removed**: The `APP_SUBSCRIPTIONS_UPDATE` webhook endpoint (`POST /api/webhooks/subscriptions`) has been completely removed
2. **API-Driven**: All credit allocation is now triggered via API calls
3. **Explicit Control**: You must call sync endpoint when subscription events occur

### Migration Steps

1. **Update Integration Points**:
   - Identify all places where subscription events occur
   - Add sync endpoint calls after subscription approval/change
   - Remove any webhook subscription handlers (if you had custom ones)

2. **Update Payment Success Flow**:
   - After user approves subscription and is redirected to payment-success page
   - Call sync endpoint to initialize credits

3. **Update Plan Change Flow**:
   - After new subscription is approved (plan change)
   - Call sync endpoint to update credits

4. **Update Cancellation Flow**:
   - After subscription cancellation
   - Call sync endpoint (it detects cancellation automatically) OR call cancel endpoint

5. **Add Periodic Sync** (Optional but Recommended):
   - Set up background job to periodically sync credits
   - Helps ensure credits stay in sync even if sync endpoint wasn't called immediately

### Breaking Changes

- **Webhook Endpoint Removed**: `/api/webhooks/subscriptions` no longer exists
- **No Automatic Credit Allocation**: Credits are no longer allocated automatically via webhooks
- **Manual Sync Required**: You must explicitly call sync endpoint after subscription events

### Backward Compatibility

- Credit service functions remain unchanged (internal implementation)
- Credit deduction remains unchanged (still works as before)
- Database schema remains unchanged
- Only the allocation trigger mechanism changed (webhook → API)

---

## Support and Troubleshooting

### Common Issues

**Issue**: Credits not allocated after subscription
- **Cause**: Sync endpoint not called after subscription approval
- **Solution**: Ensure sync endpoint is called in payment-success flow

**Issue**: Credits incorrect after plan change
- **Cause**: Sync endpoint not called after plan change
- **Solution**: Call sync endpoint after new subscription is approved

**Issue**: Credits not cleared after cancellation
- **Cause**: Sync/cancel endpoint not called after cancellation
- **Solution**: Call sync endpoint (detects cancellation) or cancel endpoint

**Issue**: 401 Authentication Error
- **Cause**: Shop not installed or access token invalid
- **Solution**: Ensure shop is properly installed and authenticated

### Getting Help

- Check error response `message` and `requestId`
- Review server logs for detailed error information
- Contact support with `requestId` for investigation

---

## Summary

The credit allocation system is now fully API-driven:

- **Sync Endpoint** (`POST /api/credits/sync`): Main endpoint for all credit operations
- **Cancel Endpoint** (`POST /api/credits/cancel`): Explicit cancellation (optional - sync handles it too)
- **No Webhooks**: Webhook endpoint removed - all operations are API-driven
- **Idempotent**: Safe to call sync endpoint multiple times
- **Flexible**: Call sync endpoint whenever you need to sync credits

Integrate the sync endpoint into your subscription workflow to ensure credits are allocated correctly.

