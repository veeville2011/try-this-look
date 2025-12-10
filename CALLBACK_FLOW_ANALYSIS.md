# Callback Redirect Flow Analysis

## Current Implementation Issue

According to `frontendguide.md`:
- **Line 113**: "Shopify redirects to: `/api/customer-auth/callback?code=xxx&state=yyy`"
- **Line 115**: "Backend processes callback and returns JSON with sessionToken"

## Problem

If Shopify redirects to the backend endpoint `/api/customer-auth/callback`, the backend receives a **GET request** with query parameters. However:

1. **Backend can't return JSON for browser redirects** - When Shopify redirects the browser, the backend must respond with an HTTP redirect (3xx), not JSON.

2. **Frontend expects to handle callback** - The frontend has a callback page at `/auth/callback` that expects to receive `code` and `state` parameters.

## Correct Flow

The backend callback endpoint should handle **both**:

### Option 1: Backend Redirects to Frontend (Recommended)

```
1. Shopify redirects to: /api/customer-auth/callback?code=xxx&state=yyy (GET)
   ↓
2. Backend processes callback, validates, generates session token
   ↓
3. Backend redirects to: /auth/callback?code=xxx&state=yyy (HTTP 302/303)
   ↓
4. Frontend /auth/callback page receives code and state
   ↓
5. Frontend calls handleCallback() which makes POST to /api/customer-auth/callback
   ↓
6. Backend returns JSON: { success: true, data: { sessionToken, customer } }
   ↓
7. Frontend stores sessionToken in localStorage
```

**Issue**: This processes the callback twice (redundant).

### Option 2: Backend Returns Session Token in Redirect (More Efficient)

```
1. Shopify redirects to: /api/customer-auth/callback?code=xxx&state=yyy (GET)
   ↓
2. Backend processes callback, validates, generates session token
   ↓
3. Backend redirects to: /auth/callback?sessionToken=xxx&customer=yyy (HTTP 302/303)
   ↓
4. Frontend /auth/callback page extracts sessionToken from URL
   ↓
5. Frontend stores sessionToken in localStorage
```

**Issue**: Session token in URL is less secure (visible in browser history, logs).

### Option 3: Backend Uses Temporary Token (Most Secure)

```
1. Shopify redirects to: /api/customer-auth/callback?code=xxx&state=yyy (GET)
   ↓
2. Backend processes callback, validates, generates session token
   ↓
3. Backend creates temporary token (expires in 5 minutes), stores sessionToken server-side
   ↓
4. Backend redirects to: /auth/callback?tempToken=xxx (HTTP 302/303)
   ↓
5. Frontend /auth/callback page makes POST to /api/customer-auth/exchange-temp-token
   ↓
6. Backend validates tempToken, returns sessionToken
   ↓
7. Frontend stores sessionToken in localStorage
```

**Best Practice**: This is the most secure approach.

## Current Implementation Status

### Frontend Implementation ✅
- `AuthCallback.tsx` expects `code` and `state` in URL params
- `handleCallback()` makes POST to `/api/customer-auth/callback` with code and state
- Correctly stores sessionToken in localStorage

### Backend Implementation ❓
- **Need to verify**: Does the backend `/api/customer-auth/callback` endpoint:
  1. Handle GET requests from Shopify redirect?
  2. Redirect to frontend `/auth/callback` page?
  3. Handle POST requests from frontend `handleCallback()`?

## Required Backend Changes

The backend callback endpoint should:

1. **Handle GET requests** (from Shopify redirect):
   - Extract `code` and `state` from query parameters
   - Validate and process the callback
   - Generate session token
   - **Redirect to frontend**: `/auth/callback?code=xxx&state=yyy` (or use temp token approach)

2. **Handle POST requests** (from frontend `handleCallback()`):
   - Extract `code` and `state` from request body
   - Validate and process the callback
   - Generate session token
   - Return JSON: `{ success: true, data: { sessionToken, customer, expiresAt } }`

## Recommendation

**Use Option 1** (Backend redirects to frontend with code/state) because:
- It's simpler to implement
- The frontend already expects code/state in URL
- The backend can validate the callback before redirecting
- The frontend makes a secure POST request to exchange code for token

**Backend should redirect to frontend callback URL**:
```javascript
// Backend /api/customer-auth/callback (GET handler)
const frontendCallbackUrl = `${FRONTEND_URL}/auth/callback?code=${code}&state=${state}`;
res.redirect(302, frontendCallbackUrl);
```

Then the frontend callback page will call `handleCallback()` which makes a POST request to exchange the code for the session token.

