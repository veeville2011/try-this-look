# Popup OAuth Implementation Verification Guide

## Overview

This document provides a comprehensive verification checklist for the Customer Account API OAuth popup implementation. Use this guide to verify that the popup authentication flow works correctly with your existing backend.

---

## Prerequisites

### Backend Requirements

- [ ] Backend endpoint `/api/customer-auth/login` is accessible
- [ ] Backend endpoint `/api/customer-auth/callback` handles:
  - [ ] **GET requests** (from Shopify redirect) → redirects to frontend `/auth/callback?code=xxx&state=yyy`
  - [ ] **POST requests** (from frontend callback page) → returns JSON: `{success: true, data: {sessionToken, customer, expiresAt}}`
- [ ] Backend endpoint `/api/customer-auth/validate` is accessible
- [ ] Backend endpoint `/api/customer-auth/logout` is accessible
- [ ] Environment variable `VITE_API_ENDPOINT` is set correctly

### Frontend Requirements

- [ ] All files are updated:
  - [x] `src/services/customerAuth.ts` - Added `loginWithPopup()` method
  - [x] `src/pages/AuthCallback.tsx` - Added popup detection and postMessage
  - [x] `src/hooks/useCustomerAuth.ts` - Added `loginWithPopup()` hook
  - [x] `src/components/TryOnWidget.tsx` - Updated to use popup login
- [ ] No TypeScript/linter errors
- [ ] Application builds successfully

---

## Verification Checklist

### 1. Popup Window Opening

**Test**: Click login button in TryOnWidget

**Expected Behavior**:
- [ ] Popup window opens (500x600px, centered)
- [ ] Popup URL is: `{API_BASE_URL}/api/customer-auth/login?shop={shopDomain}&callback_url={callbackUrl}`
- [ ] Main page (TryOnWidget) remains visible and functional
- [ ] No page redirect occurs

**If popup is blocked**:
- [ ] Error message displays: "La fenêtre popup a été bloquée..."
- [ ] User can retry after allowing popups

---

### 2. Backend Login Endpoint

**Test**: Verify backend receives and processes login request

**Expected Behavior**:
- [ ] Backend receives GET request to `/api/customer-auth/login`
- [ ] Backend redirects popup to Shopify OAuth login page
- [ ] Popup shows Shopify login interface

**Check Backend Logs**:
- [ ] Login request logged correctly
- [ ] Shop domain validated
- [ ] OAuth redirect URL generated correctly

---

### 3. Shopify OAuth Flow

**Test**: Complete authentication in popup

**Expected Behavior**:
- [ ] User can enter credentials in popup
- [ ] User can complete authentication
- [ ] Shopify redirects popup to: `/api/customer-auth/callback?code=xxx&state=yyy`

**Note**: This step is handled by Shopify, not your code

---

### 4. Backend Callback Endpoint (GET)

**Test**: Verify backend handles Shopify redirect

**Expected Behavior**:
- [ ] Backend receives GET request: `/api/customer-auth/callback?code=xxx&state=yyy`
- [ ] Backend validates `code` and `state`
- [ ] Backend redirects popup to: `/auth/callback?code=xxx&state=yyy`

**Critical**: Backend MUST redirect GET requests to frontend callback page, not return JSON

**Check Backend Logs**:
- [ ] Callback received and validated
- [ ] Redirect to frontend callback page

---

### 5. Frontend Callback Page (Popup Mode)

**Test**: Verify callback page detects popup and processes OAuth

**Expected Behavior**:
- [ ] Callback page loads in popup
- [ ] Page detects `window.opener` (popup mode)
- [ ] Page extracts `code` and `state` from URL
- [ ] Page makes POST request to: `/api/customer-auth/callback`
- [ ] Loading spinner displays: "Verifying your authentication..."

**Check Browser Console**:
- [ ] No errors during callback processing
- [ ] POST request to backend callback endpoint

---

### 6. Backend Callback Endpoint (POST)

**Test**: Verify backend processes POST request and returns session token

**Expected Behavior**:
- [ ] Backend receives POST request with: `{code, state}`
- [ ] Backend exchanges code for access token
- [ ] Backend generates session token
- [ ] Backend returns JSON:
  ```json
  {
    "success": true,
    "data": {
      "sessionToken": "abc123...",
      "customer": {
        "id": "gid://shopify/Customer/123",
        "email": "customer@example.com",
        "firstName": "John",
        "lastName": "Doe"
      },
      "expiresAt": "2025-01-15T12:00:00Z"
    }
  }
  ```

**Check Backend Logs**:
- [ ] POST request received
- [ ] Token exchange successful
- [ ] Session token generated
- [ ] Response sent successfully

---

### 7. Session Token Storage

**Test**: Verify session token is stored correctly

**Expected Behavior**:
- [ ] Session token stored in `localStorage` with key: `customer_session_token`
- [ ] Token persists after popup closes
- [ ] Token can be retrieved on page reload

**Check Browser DevTools**:
- [ ] Open Application → Local Storage
- [ ] Verify `customer_session_token` exists
- [ ] Token value is a valid string

---

### 8. PostMessage Communication

**Test**: Verify popup sends message to parent window

**Expected Behavior**:
- [ ] Callback page sends `postMessage` to parent:
  ```javascript
  {
    type: "CUSTOMER_AUTH_SUCCESS",
    message: "Authentication successful",
    customer: {...},
    sessionToken: "..."
  }
  ```
- [ ] Message origin is validated (same origin only)
- [ ] Popup closes automatically after 1.5 seconds

**Check Browser Console (Parent Window)**:
- [ ] Message received: `CUSTOMER_AUTH_SUCCESS`
- [ ] No origin validation errors

---

### 9. Parent Window Message Handling

**Test**: Verify TryOnWidget receives and processes message

**Expected Behavior**:
- [ ] TryOnWidget receives `postMessage` event
- [ ] Message origin is validated
- [ ] Session validation is triggered
- [ ] Success toast displays: "Connexion réussie!"
- [ ] Authentication state updates in Redux
- [ ] Customer info displays in UI

**Check Browser Console (Parent Window)**:
- [ ] Message listener active
- [ ] Origin validation passes
- [ ] Session validation successful
- [ ] No errors during state update

---

### 10. Session Validation

**Test**: Verify session is validated after popup auth

**Expected Behavior**:
- [ ] `validateSession()` is called after receiving success message
- [ ] POST request to `/api/customer-auth/validate` with `X-Session-Token` header
- [ ] Backend validates token and returns customer info
- [ ] Redux state updates with customer information

**Check Network Tab**:
- [ ] POST request to `/api/customer-auth/validate`
- [ ] Request includes header: `X-Session-Token: {token}`
- [ ] Response: `{success: true, data: {customer: {...}}}`

---

### 11. Authenticated API Requests

**Test**: Verify API requests include session token

**Expected Behavior**:
- [ ] All API requests to backend include header: `X-Session-Token: {token}`
- [ ] Try-on generation requests work with authentication
- [ ] Cart/outfit generation requests work with authentication

**Check Network Tab**:
- [ ] All requests include `X-Session-Token` header
- [ ] No 401 Unauthorized errors

---

### 12. Error Handling

#### 12.1 OAuth Errors

**Test**: Simulate OAuth error (e.g., user denies access)

**Expected Behavior**:
- [ ] Callback page receives `error` parameter in URL
- [ ] Error message displays in popup
- [ ] Error message sent to parent via `postMessage`:
  ```javascript
  {
    type: "CUSTOMER_AUTH_ERROR",
    error: "access_denied",
    errorCode: "access_denied"
  }
  ```
- [ ] Error toast displays in parent window
- [ ] Popup closes after 2 seconds

#### 12.2 Missing Parameters

**Test**: Access callback page without code/state

**Expected Behavior**:
- [ ] Error message: "Missing required OAuth parameters"
- [ ] Error sent to parent window
- [ ] Popup closes

#### 12.3 Network Errors

**Test**: Simulate network failure during callback

**Expected Behavior**:
- [ ] Error caught and displayed
- [ ] Error sent to parent window
- [ ] User can retry

#### 12.4 Popup Blocking

**Test**: Block popups in browser settings

**Expected Behavior**:
- [ ] Error message: "Popup window was blocked..."
- [ ] User-friendly error toast
- [ ] Instructions to allow popups

---

### 13. Security Verification

#### 13.1 Origin Validation

**Test**: Attempt to send message from different origin

**Expected Behavior**:
- [ ] Messages from different origins are ignored
- [ ] Console warning: "Ignoring postMessage from unexpected origin"
- [ ] No state changes occur

#### 13.2 Message Type Validation

**Test**: Send invalid message type

**Expected Behavior**:
- [ ] Only `CUSTOMER_AUTH_SUCCESS` and `CUSTOMER_AUTH_ERROR` are processed
- [ ] Other message types are ignored

#### 13.3 Session Token Security

**Test**: Verify token storage and usage

**Expected Behavior**:
- [ ] Token stored in `localStorage` (not in URL or cookies)
- [ ] Token only sent in `X-Session-Token` header
- [ ] Token cleared on logout
- [ ] Token cleared on 401 errors

---

### 14. User Experience

#### 14.1 Loading States

**Test**: Verify loading indicators

**Expected Behavior**:
- [ ] Loading spinner in popup during authentication
- [ ] Loading state in TryOnWidget during session validation
- [ ] Smooth transitions between states

#### 14.2 Success Feedback

**Test**: Verify success feedback

**Expected Behavior**:
- [ ] Success message in popup: "Authentication successful!"
- [ ] Success toast in parent: "Connexion réussie!"
- [ ] Customer info displays in UI
- [ ] Login button changes to logout button

#### 14.3 Error Feedback

**Test**: Verify error feedback

**Expected Behavior**:
- [ ] Clear error messages in popup
- [ ] Error toast in parent window
- [ ] Retry options available

---

### 15. Logout Flow

**Test**: Verify logout functionality

**Expected Behavior**:
- [ ] Logout button works correctly
- [ ] Session token cleared from `localStorage`
- [ ] Redux state cleared
- [ ] User redirected or UI updates to logged-out state

---

## Backend Compatibility Verification

### Critical Backend Requirements

The popup flow requires the backend callback endpoint to handle **both** GET and POST requests:

#### GET Request (from Shopify redirect)
```
GET /api/customer-auth/callback?code=xxx&state=yyy
```

**Backend should**:
1. Validate `code` and `state`
2. Redirect to frontend callback page:
   ```
   Redirect: /auth/callback?code=xxx&state=yyy
   ```

#### POST Request (from frontend callback page)
```
POST /api/customer-auth/callback
Content-Type: application/json
Body: {code: "xxx", state: "yyy"}
```

**Backend should**:
1. Validate `code` and `state`
2. Exchange code for access token
3. Generate session token
4. Return JSON:
   ```json
   {
     "success": true,
     "data": {
       "sessionToken": "...",
       "customer": {...},
       "expiresAt": "..."
     }
   }
   ```

### Backend Verification Steps

1. **Check Backend Code**:
   - [ ] Callback endpoint handles GET requests
   - [ ] Callback endpoint handles POST requests
   - [ ] GET requests redirect to frontend
   - [ ] POST requests return JSON

2. **Test Backend Endpoints**:
   ```bash
   # Test GET (should redirect)
   curl -L "http://localhost:3000/api/customer-auth/callback?code=test&state=test"
   
   # Test POST (should return JSON)
   curl -X POST "http://localhost:3000/api/customer-auth/callback" \
     -H "Content-Type: application/json" \
     -d '{"code":"test","state":"test"}'
   ```

3. **Verify Redirect URL**:
   - [ ] GET redirects to: `{FRONTEND_URL}/auth/callback?code=xxx&state=yyy`
   - [ ] Redirect URL matches frontend callback route

---

## Testing Scenarios

### Scenario 1: Happy Path
1. User clicks login button
2. Popup opens
3. User authenticates with Shopify
4. Popup closes automatically
5. User is authenticated in TryOnWidget
6. API requests work with authentication

**Expected Result**: ✅ All steps complete successfully

---

### Scenario 2: Popup Blocked
1. User blocks popups in browser
2. User clicks login button
3. Error message displays

**Expected Result**: ✅ Clear error message, user can allow popups and retry

---

### Scenario 3: OAuth Error
1. User clicks login button
2. Popup opens
3. User denies access or error occurs
4. Error message displays in popup
5. Error sent to parent window
6. Error toast displays

**Expected Result**: ✅ Error handled gracefully, user can retry

---

### Scenario 4: Network Error
1. User clicks login button
2. Popup opens
3. Network fails during callback
4. Error handled

**Expected Result**: ✅ Error caught, user can retry

---

### Scenario 5: Session Expiry
1. User authenticates successfully
2. Session expires
3. API request returns 401
4. Session token cleared
5. User prompted to login again

**Expected Result**: ✅ Graceful handling, user can re-authenticate

---

## Browser Compatibility

Test in the following browsers:

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

## Performance Verification

- [ ] Popup opens within 500ms
- [ ] Callback processing completes within 2 seconds
- [ ] Session validation completes within 1 second
- [ ] No memory leaks (check popup references)
- [ ] Event listeners cleaned up properly

---

## Debugging Tips

### Enable Debug Logging

Add to browser console:
```javascript
localStorage.setItem('debug_customer_auth', 'true');
```

### Check Popup Reference

```javascript
// In parent window
console.log(window.__customerAuthPopup);
```

### Monitor PostMessage Events

```javascript
// In parent window
window.addEventListener('message', (e) => {
  console.log('PostMessage received:', e.data, 'from:', e.origin);
});
```

### Check Session Token

```javascript
// In browser console
console.log('Session token:', localStorage.getItem('customer_session_token'));
```

---

## Common Issues & Solutions

### Issue: Popup doesn't open
**Solution**: Check browser popup blocker settings

### Issue: Popup opens but doesn't redirect
**Solution**: Verify backend login endpoint redirects correctly

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

### Issue: Backend returns 401
**Solution**: 
- Verify session token is included in request header
- Check token hasn't expired
- Verify backend validates token correctly

---

## Sign-Off Checklist

Before marking as complete, verify:

- [ ] All test scenarios pass
- [ ] No console errors
- [ ] No network errors
- [ ] Security validations work
- [ ] Error handling works for all cases
- [ ] User experience is smooth
- [ ] Backend compatibility confirmed
- [ ] Documentation updated

---

## Next Steps After Verification

1. **If all tests pass**: ✅ Implementation is ready for production
2. **If issues found**: 
   - Document issues in this file
   - Fix issues
   - Re-run verification
3. **Backend changes needed**:
   - Update backend to handle GET requests on callback endpoint
   - Test backend changes
   - Re-run frontend verification

---

**Last Updated**: 2025-01-XX  
**Version**: 1.0  
**Status**: Ready for Verification

