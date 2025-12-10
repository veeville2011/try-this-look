# Frontend Implementation Verification Guide

## Overview

This document provides a comprehensive verification checklist for the Customer Account API OAuth frontend implementation. Use this guide to verify that the frontend correctly implements the popup authentication flow and integrates properly with the backend endpoints.

**Backend Status**: ✅ All backend endpoints are implemented and compatible (see `FIXES_IMPLEMENTED.md`)

---

## Prerequisites

### Backend Verification (Must Complete First)

- [ ] Backend endpoint `GET /api/customer-auth/login` is accessible
- [ ] Backend endpoint `GET /api/customer-auth/callback` redirects to frontend
- [ ] Backend endpoint `POST /api/customer-auth/callback` returns JSON with session token
- [ ] Backend endpoint `POST /api/customer-auth/validate` accepts `X-Session-Token` header
- [ ] Backend endpoint `POST /api/customer-auth/logout` is accessible
- [ ] Backend environment variable `VITE_SHOPIFY_APP_URL` is set correctly

### Frontend Environment Setup

- [ ] `VITE_API_ENDPOINT` is set to backend URL (e.g., `https://your-backend.com`)
- [ ] `VITE_SHOPIFY_APP_URL` is set to frontend URL (e.g., `https://try-this-look.vercel.app`)
- [ ] Application builds without errors
- [ ] No TypeScript/linter errors

---

## File Structure Verification

### Required Files

Verify these files exist and are implemented:

#### Core Service Files

- [ ] `src/services/customerAuth.ts` (or `.js`)
  - [ ] Contains `loginWithPopup()` method
  - [ ] Contains `validateSession()` method
  - [ ] Contains `logout()` method
  - [ ] Contains `getSessionToken()` method
  - [ ] Contains `isAuthenticated()` method

#### Page Components

- [ ] `src/pages/AuthCallback.tsx` (or `.jsx`)
  - [ ] Detects popup mode (`window.opener`)
  - [ ] Extracts `code` and `state` from URL
  - [ ] Makes POST request to backend callback
  - [ ] Sends `postMessage` to parent window
  - [ ] Handles errors and sends error messages

#### Hooks

- [ ] `src/hooks/useCustomerAuth.ts` (or `.js`)
  - [ ] Provides `loginWithPopup()` function
  - [ ] Provides `logout()` function
  - [ ] Provides `customer` state
  - [ ] Provides `isAuthenticated` state
  - [ ] Provides `isLoading` state
  - [ ] Automatically validates session on mount

#### UI Components

- [ ] `src/components/TryOnWidget.tsx` (or your main component)
  - [ ] Uses `useCustomerAuth` hook
  - [ ] Shows login button when not authenticated
  - [ ] Shows customer info when authenticated
  - [ ] Shows logout button when authenticated
  - [ ] Handles popup message events

#### API Client

- [ ] API client wrapper (e.g., `src/utils/api.ts` or axios interceptor)
  - [ ] Automatically adds `X-Session-Token` header to requests
  - [ ] Handles 401 errors by clearing session and redirecting to login
  - [ ] Retries failed requests after re-authentication

---

## Implementation Verification

### 1. Authentication Service (`customerAuth.ts`)

#### 1.1 `loginWithPopup()` Method

**Location**: `src/services/customerAuth.ts`

**Verification**:
- [ ] Method exists and is exported
- [ ] Accepts `shopDomain` parameter (storefront domain)
- [ ] Opens popup window with correct dimensions (500x600px)
- [ ] Centers popup on screen
- [ ] Popup URL is: `{VITE_API_ENDPOINT}/api/customer-auth/login?shop={shopDomain}`
- [ ] Stores popup reference for cleanup
- [ ] Returns promise that resolves/rejects appropriately

**Code Pattern Expected**:
```typescript
const loginWithPopup = async (shopDomain: string): Promise<void> => {
  const width = 500;
  const height = 600;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;
  
  const popup = window.open(
    `${API_ENDPOINT}/api/customer-auth/login?shop=${shopDomain}`,
    'Shopify Login',
    `width=${width},height=${height},left=${left},top=${top}`
  );
  
  // Store reference and handle cleanup
};
```

**Test**: Call method and verify popup opens correctly

---

#### 1.2 `validateSession()` Method

**Location**: `src/services/customerAuth.ts`

**Verification**:
- [ ] Method exists and is exported
- [ ] Retrieves session token from localStorage (`customer_session_token`)
- [ ] Makes POST request to: `{VITE_API_ENDPOINT}/api/customer-auth/validate`
- [ ] Sends token in `X-Session-Token` header
- [ ] Returns customer info on success
- [ ] Clears session token on 401 error
- [ ] Handles network errors gracefully

**Code Pattern Expected**:
```typescript
const validateSession = async (): Promise<CustomerInfo | null> => {
  const token = localStorage.getItem('customer_session_token');
  if (!token) return null;
  
  const response = await fetch(`${API_ENDPOINT}/api/customer-auth/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Token': token,
    },
  });
  
  if (response.status === 401) {
    localStorage.removeItem('customer_session_token');
    return null;
  }
  
  const data = await response.json();
  return data.success ? data.data.customer : null;
};
```

**Test**: Call method with valid/invalid tokens and verify behavior

---

#### 1.3 `logout()` Method

**Location**: `src/services/customerAuth.ts`

**Verification**:
- [ ] Method exists and is exported
- [ ] Retrieves session token from localStorage
- [ ] Makes POST request to: `{VITE_API_ENDPOINT}/api/customer-auth/logout`
- [ ] Sends token in request body or header
- [ ] Clears session token from localStorage
- [ ] Handles errors gracefully

**Test**: Call method and verify session is cleared

---

#### 1.4 Session Token Management

**Verification**:
- [ ] `getSessionToken()` retrieves from localStorage
- [ ] `setSessionToken()` stores in localStorage with key `customer_session_token`
- [ ] `clearSessionToken()` removes from localStorage
- [ ] Token is never exposed in URLs or console logs

**Test**: Verify localStorage operations work correctly

---

### 2. Callback Page (`AuthCallback.tsx`)

#### 2.1 Popup Detection

**Location**: `src/pages/AuthCallback.tsx`

**Verification**:
- [ ] Component detects if running in popup (`window.opener !== null`)
- [ ] Shows loading spinner when processing
- [ ] Handles both popup and non-popup modes

**Code Pattern Expected**:
```typescript
const isPopup = window.opener !== null;

useEffect(() => {
  if (!isPopup) {
    // Handle non-popup mode (redirect flow)
    return;
  }
  
  // Process OAuth callback
}, [isPopup]);
```

**Test**: Open callback page in popup and verify detection works

---

#### 2.2 OAuth Parameter Extraction

**Verification**:
- [ ] Extracts `code` from URL query parameters
- [ ] Extracts `state` from URL query parameters
- [ ] Extracts `error` and `error_description` if present
- [ ] Validates that required parameters exist

**Code Pattern Expected**:
```typescript
const searchParams = new URLSearchParams(window.location.search);
const code = searchParams.get('code');
const state = searchParams.get('state');
const error = searchParams.get('error');
const errorDescription = searchParams.get('error_description');
```

**Test**: Access callback page with/without parameters and verify extraction

---

#### 2.3 Backend POST Request

**Verification**:
- [ ] Makes POST request to: `{VITE_API_ENDPOINT}/api/customer-auth/callback`
- [ ] Sends `{code, state}` in request body
- [ ] Includes `Content-Type: application/json` header
- [ ] Handles loading state during request
- [ ] Handles success response
- [ ] Handles error response

**Code Pattern Expected**:
```typescript
const response = await fetch(`${API_ENDPOINT}/api/customer-auth/callback`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ code, state }),
});

const data = await response.json();

if (data.success) {
  // Store token and send message to parent
} else {
  // Handle error
}
```

**Test**: Verify POST request is made with correct payload

---

#### 2.4 Session Token Storage

**Verification**:
- [ ] Stores `sessionToken` from response in localStorage
- [ ] Uses key: `customer_session_token`
- [ ] Stores customer info if provided
- [ ] Handles storage errors (quota exceeded, etc.)

**Test**: Verify token is stored after successful authentication

---

#### 2.5 PostMessage to Parent

**Verification**:
- [ ] Sends `postMessage` to `window.opener` on success
- [ ] Message includes:
  - `type: "CUSTOMER_AUTH_SUCCESS"`
  - `sessionToken`
  - `customer` object
  - `message: "Authentication successful"`
- [ ] Validates message origin before sending
- [ ] Closes popup after sending message (with delay)
- [ ] Sends error message on failure

**Code Pattern Expected**:
```typescript
if (window.opener) {
  window.opener.postMessage({
    type: 'CUSTOMER_AUTH_SUCCESS',
    sessionToken: data.data.sessionToken,
    customer: data.data.customer,
    message: 'Authentication successful',
  }, window.location.origin);
  
  setTimeout(() => {
    window.close();
  }, 1500);
}
```

**Test**: Verify message is sent and popup closes

---

#### 2.6 Error Handling

**Verification**:
- [ ] Handles missing `code` or `state` parameters
- [ ] Handles OAuth errors from URL (`error` parameter)
- [ ] Handles backend errors (400, 500 responses)
- [ ] Handles network errors
- [ ] Sends error message to parent window
- [ ] Displays user-friendly error messages

**Test**: Test all error scenarios

---

### 3. Authentication Hook (`useCustomerAuth.ts`)

#### 3.1 Hook Structure

**Location**: `src/hooks/useCustomerAuth.ts`

**Verification**:
- [ ] Hook is exported and can be imported
- [ ] Returns object with:
  - `customer: CustomerInfo | null`
  - `isAuthenticated: boolean`
  - `isLoading: boolean`
  - `loginWithPopup: (shopDomain: string) => Promise<void>`
  - `logout: () => Promise<void>`
  - `validateSession: () => Promise<void>`

**Test**: Import and use hook in component

---

#### 3.2 Session Validation on Mount

**Verification**:
- [ ] Validates session automatically when hook is used
- [ ] Sets `isLoading: true` during validation
- [ ] Updates `customer` state on successful validation
- [ ] Sets `isAuthenticated: true` when customer exists
- [ ] Handles validation errors gracefully

**Code Pattern Expected**:
```typescript
useEffect(() => {
  const validate = async () => {
    setIsLoading(true);
    const customer = await customerAuth.validateSession();
    setCustomer(customer);
    setIsAuthenticated(!!customer);
    setIsLoading(false);
  };
  
  validate();
}, []);
```

**Test**: Verify session is validated on component mount

---

#### 3.3 Login Function

**Verification**:
- [ ] `loginWithPopup()` calls service method
- [ ] Handles popup blocking errors
- [ ] Updates state after successful authentication
- [ ] Handles authentication errors

**Test**: Call login function and verify state updates

---

#### 3.4 Logout Function

**Verification**:
- [ ] `logout()` calls service method
- [ ] Clears customer state
- [ ] Sets `isAuthenticated: false`
- [ ] Handles errors gracefully

**Test**: Call logout and verify state is cleared

---

### 4. UI Components

#### 4.1 TryOnWidget (or Main Component)

**Location**: `src/components/TryOnWidget.tsx` (or your main component)

**Verification**:
- [ ] Uses `useCustomerAuth` hook
- [ ] Shows login button when `!isAuthenticated`
- [ ] Shows customer info when `isAuthenticated`
- [ ] Shows logout button when `isAuthenticated`
- [ ] Handles loading state
- [ ] Listens for `postMessage` events from popup

**Code Pattern Expected**:
```typescript
const { customer, isAuthenticated, isLoading, loginWithPopup, logout } = useCustomerAuth();

useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    
    if (event.data.type === 'CUSTOMER_AUTH_SUCCESS') {
      // Store token and update state
      localStorage.setItem('customer_session_token', event.data.sessionToken);
      // Trigger session validation
    }
  };
  
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

**Test**: Verify UI updates based on authentication state

---

#### 4.2 Login Button

**Verification**:
- [ ] Button is visible when not authenticated
- [ ] Button text is clear (e.g., "Sign in with Shopify")
- [ ] Clicking button calls `loginWithPopup(shopDomain)`
- [ ] Shows loading state during popup opening
- [ ] Handles popup blocking with error message

**Test**: Click login button and verify popup opens

---

#### 4.3 Customer Info Display

**Verification**:
- [ ] Displays customer email when authenticated
- [ ] Displays customer name (firstName + lastName) when available
- [ ] Shows appropriate message if name not available
- [ ] Updates when customer info changes

**Test**: Verify customer info displays correctly

---

#### 4.4 Logout Button

**Verification**:
- [ ] Button is visible when authenticated
- [ ] Button text is clear (e.g., "Sign out")
- [ ] Clicking button calls `logout()`
- [ ] UI updates to logged-out state after logout

**Test**: Click logout and verify state updates

---

### 5. API Client Integration

#### 5.1 Request Interceptor

**Location**: API client file (e.g., `src/utils/api.ts` or axios config)

**Verification**:
- [ ] Automatically adds `X-Session-Token` header to all requests
- [ ] Retrieves token from localStorage
- [ ] Only adds header if token exists
- [ ] Header format: `X-Session-Token: {token}`

**Code Pattern Expected**:
```typescript
// Axios interceptor
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('customer_session_token');
  if (token) {
    config.headers['X-Session-Token'] = token;
  }
  return config;
});
```

**Test**: Make API request and verify header is added

---

#### 5.2 401 Error Handling

**Verification**:
- [ ] Intercepts 401 Unauthorized responses
- [ ] Clears session token from localStorage
- [ ] Redirects to login or shows login prompt
- [ ] Prevents infinite redirect loops
- [ ] Logs error appropriately

**Code Pattern Expected**:
```typescript
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('customer_session_token');
      // Trigger login or redirect
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

**Test**: Make request with invalid token and verify handling

---

### 6. Security Verification

#### 6.1 Origin Validation

**Verification**:
- [ ] PostMessage events validate `event.origin`
- [ ] Only processes messages from same origin
- [ ] Ignores messages from different origins
- [ ] Logs warnings for invalid origins

**Code Pattern Expected**:
```typescript
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) {
    console.warn('Ignoring postMessage from unexpected origin:', event.origin);
    return;
  }
  // Process message
});
```

**Test**: Send message from different origin and verify it's ignored

---

#### 6.2 Message Type Validation

**Verification**:
- [ ] Only processes specific message types
- [ ] Validates message structure
- [ ] Ignores unknown message types
- [ ] Handles malformed messages gracefully

**Test**: Send invalid message types and verify handling

---

#### 6.3 Token Security

**Verification**:
- [ ] Session token never exposed in URLs
- [ ] Session token never logged to console (in production)
- [ ] Session token only stored in localStorage
- [ ] Session token cleared on logout
- [ ] Session token cleared on 401 errors

**Test**: Verify token is never exposed inappropriately

---

### 7. Error Handling

#### 7.1 Popup Blocking

**Verification**:
- [ ] Detects when popup is blocked
- [ ] Shows user-friendly error message
- [ ] Provides instructions to allow popups
- [ ] Allows user to retry

**Test**: Block popups and verify error handling

---

#### 7.2 Network Errors

**Verification**:
- [ ] Handles network failures during callback
- [ ] Handles network failures during validation
- [ ] Shows appropriate error messages
- [ ] Allows user to retry

**Test**: Simulate network failures and verify handling

---

#### 7.3 OAuth Errors

**Verification**:
- [ ] Handles `access_denied` error
- [ ] Handles `invalid_request` error
- [ ] Handles `server_error` error
- [ ] Shows user-friendly error messages
- [ ] Allows user to retry

**Test**: Test various OAuth error scenarios

---

### 8. Complete Flow Verification

#### 8.1 Happy Path

**Test Steps**:
1. [ ] User clicks login button
2. [ ] Popup opens with backend login URL
3. [ ] User authenticates with Shopify
4. [ ] Shopify redirects to backend callback
5. [ ] Backend redirects to frontend callback page
6. [ ] Frontend callback page POSTs to backend
7. [ ] Backend returns session token
8. [ ] Frontend stores token and sends postMessage
9. [ ] Parent window receives message and validates session
10. [ ] UI updates to show customer info
11. [ ] Popup closes automatically

**Expected Result**: ✅ All steps complete successfully

---

#### 8.2 Error Scenarios

**Test Scenarios**:
- [ ] Popup blocked → Error message shown
- [ ] User denies access → Error message shown
- [ ] Network failure → Error message shown
- [ ] Invalid state → Error message shown
- [ ] Session expired → User prompted to login again

**Expected Result**: ✅ All errors handled gracefully

---

### 9. Integration Testing

#### 9.1 Backend Integration

**Test**: Verify frontend works with actual backend

- [ ] Login flow completes successfully
- [ ] Session validation works
- [ ] API requests include session token
- [ ] Logout works correctly
- [ ] 401 errors handled correctly

---

#### 9.2 Cross-Browser Testing

**Test in**:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

**Known Issues**:
- Some browsers may block popups by default
- Mobile browsers may handle popups differently

---

### 10. Performance Verification

- [ ] Popup opens within 500ms
- [ ] Callback processing completes within 2 seconds
- [ ] Session validation completes within 1 second
- [ ] No memory leaks (check popup references)
- [ ] Event listeners cleaned up properly
- [ ] No console errors or warnings

---

## Debugging Tips

### Enable Debug Logging

Add to browser console:
```javascript
localStorage.setItem('debug_customer_auth', 'true');
```

### Check Session Token

```javascript
// In browser console
console.log('Session token:', localStorage.getItem('customer_session_token'));
```

### Monitor PostMessage Events

```javascript
// In parent window
window.addEventListener('message', (e) => {
  console.log('PostMessage received:', e.data, 'from:', e.origin);
});
```

### Check Popup Reference

```javascript
// In parent window
console.log(window.__customerAuthPopup);
```

### Monitor Network Requests

- Open DevTools → Network tab
- Filter by `/api/customer-auth`
- Verify request headers include `X-Session-Token`
- Verify response formats match expected structure

---

## Common Issues & Solutions

### Issue: Popup doesn't open
**Solution**: Check browser popup blocker settings

### Issue: Callback page doesn't detect popup
**Solution**: Check `window.opener` exists and is not null

### Issue: PostMessage not received
**Solution**: 
- Verify message origin matches
- Check event listener is active
- Verify popup hasn't navigated to different origin

### Issue: Session token not stored
**Solution**: 
- Check localStorage is available
- Verify no quota exceeded errors
- Check token format is valid

### Issue: API requests return 401
**Solution**: 
- Verify session token is included in request header
- Check token hasn't expired
- Verify backend validates token correctly

### Issue: Backend returns 400 on callback
**Solution**:
- Verify `code` and `state` are sent in POST body
- Check state hasn't expired
- Verify state exists in database

---

## Sign-Off Checklist

Before marking as complete, verify:

- [ ] All test scenarios pass
- [ ] No console errors
- [ ] No network errors
- [ ] Security validations work
- [ ] Error handling works for all cases
- [ ] User experience is smooth
- [ ] Backend integration confirmed
- [ ] Cross-browser testing completed
- [ ] Performance is acceptable
- [ ] Documentation updated

---

## Next Steps After Verification

1. **If all tests pass**: ✅ Frontend implementation is ready for production
2. **If issues found**: 
   - Document issues in this file
   - Fix issues
   - Re-run verification
3. **Backend changes needed**:
   - Document required backend changes
   - Coordinate with backend team
   - Re-run verification after backend updates

---

**Last Updated**: 2025-01-XX  
**Version**: 1.0  
**Status**: Ready for Verification  
**Backend Compatibility**: ✅ Verified (see `FIXES_IMPLEMENTED.md`)

