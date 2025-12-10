# Frontend Implementation Guide - Customer Account API OAuth

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Implementation Phases](#implementation-phases)
5. [Core Components](#core-components)
6. [UI Components](#ui-components)
7. [API Integration](#api-integration)
8. [Error Handling](#error-handling)
9. [State Management](#state-management)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Checklist](#deployment-checklist)

---

## Overview

This document outlines the complete frontend implementation plan for integrating Shopify Customer Account API OAuth 2.0 authentication into the try-on service frontend. This implementation will work seamlessly with the backend OAuth flow documented in `customerLogin.md`.

### Key Principles

- **Session Token Storage**: Store only session tokens in frontend (localStorage), never access tokens
- **Backend-Driven OAuth**: Backend handles all OAuth complexity; frontend manages UI and session
- **Storefront Domain**: Always use storefront domain (public-facing) for shop identification
- **Progressive Enhancement**: Graceful degradation if authentication fails
- **Security First**: Never expose sensitive tokens to frontend JavaScript

### Frontend Responsibilities

1. **OAuth Flow Initiation**: Trigger login by redirecting to backend login endpoint
2. **Callback Handling**: Process OAuth callback and store session token
3. **Session Management**: Store, validate, and refresh session tokens
4. **API Request Interception**: Attach session token to all API requests
5. **Authentication State**: Track and display customer authentication status
6. **Error Recovery**: Handle authentication errors and redirect to login when needed

### Backend Responsibilities (Already Implemented)

1. OAuth endpoint discovery
2. PKCE generation and validation
3. Token exchange and refresh
4. Customer information retrieval
5. Session token generation and validation
6. Database token storage

---

## Architecture

### Frontend Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND APPLICATION                          │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Authentication Client (customerAuth.js)                  │   │
│  │  - Session token management                              │   │
│  │  - OAuth flow initiation                                 │   │
│  │  - Callback handling                                      │   │
│  │  - Token validation                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  API Client Wrapper                                      │   │
│  │  - Request interception                                  │   │
│  │  - Session token injection                               │   │
│  │  - 401 error handling                                    │   │
│  │  - Automatic retry with login redirect                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  UI Components                                            │   │
│  │  - Login Button/Modal                                    │   │
│  │  - Customer Info Display                                 │   │
│  │  - Logout Button                                         │   │
│  │  - Protected Route Wrapper                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  State Management                                        │   │
│  │  - Authentication state                                 │   │
│  │  - Customer information                                 │   │
│  │  - Session validation status                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
          │                    │                    │
          │ 1. Initiate Login   │ 2. Handle Callback │ 3. API Requests
          │                    │                    │
┌─────────▼────────────────────▼────────────────────▼───────────────┐
│                    BACKEND API (customerLogin.md)                 │
│  - /api/customer-auth/login                                      │
│  - /api/customer-auth/callback                                   │
│  - /api/customer-auth/validate                                   │
│  - /api/customer-auth/logout                                     │
└───────────────────────────────────────────────────────────────────┘
```

### OAuth Flow Sequence (Frontend Perspective)

```
1. User clicks "Sign In" button
   ↓
2. Frontend → Backend: GET /api/customer-auth/login?shop={storefrontDomain}
   ↓
3. Backend redirects to Shopify login (handled by backend)
   ↓
4. Customer authenticates on Shopify
   ↓
5. Shopify redirects to: /api/customer-auth/callback?code=xxx&state=yyy
   ↓
6. Backend processes callback and returns JSON with sessionToken
   ↓
7. Frontend stores sessionToken in localStorage
   ↓
8. Frontend redirects to original page or success page
   ↓
9. All subsequent API requests include: X-Session-Token: {sessionToken}
   ↓
10. Backend validates session and attaches customer info to request
```

---

## Prerequisites

### 1. Backend Requirements

- ✅ Backend OAuth implementation complete (per `customerLogin.md`)
- ✅ Backend routes registered and accessible
- ✅ Database migrations run successfully
- ✅ Environment variables configured

### 2. Frontend Requirements

- ✅ Modern JavaScript environment (ES6+)
- ✅ Access to `localStorage` API
- ✅ Ability to make HTTP requests (fetch API or axios)
- ✅ URL parameter parsing capability
- ✅ State management solution (React Context, Redux, Vuex, or vanilla JS)

### 3. Configuration Requirements

- ✅ Backend API base URL configured
- ✅ Storefront domain available (for shop parameter)
- ✅ Callback page route defined
- ✅ Error handling strategy defined

### 4. Shopify Store Requirements

- ✅ Customer Accounts enabled (New Customer Accounts)
- ✅ Custom domain configured (for discovery endpoints)
- ✅ Protected Customer Data access approved (Level 2 for PII)

---

## Implementation Phases

### Phase 1: Core Authentication Client ✅

**Goal**: Create the foundational authentication client that handles all OAuth interactions.

**Components**:
- Session token storage/retrieval
- Login flow initiation
- Callback handling
- Session validation
- Logout functionality

**Deliverables**:
- `customerAuth.js` (or equivalent) - Core authentication client class/utility
- Session token management functions
- OAuth flow helper functions

### Phase 2: API Integration ✅

**Goal**: Integrate authentication into existing API calls.

**Components**:
- API request wrapper/interceptor
- Automatic session token injection
- 401 error handling
- Automatic login redirect on authentication failure

**Deliverables**:
- API client wrapper/utility
- Updated existing API calls to use authenticated requests
- Error handling middleware

### Phase 3: UI Components ✅

**Goal**: Create user-facing authentication components.

**Components**:
- Login button/modal
- Customer information display
- Logout button
- Loading states
- Error messages

**Deliverables**:
- Login UI component
- Customer info component
- Logout component
- Protected route wrapper (if using routing)

### Phase 4: State Management ✅

**Goal**: Manage authentication state across the application.

**Components**:
- Authentication state context/store
- Customer information state
- Session validation state
- State synchronization

**Deliverables**:
- State management setup (Context/Redux/Vuex)
- Authentication state hooks/selectors
- State update functions

### Phase 5: Integration & Testing ✅

**Goal**: Integrate all components and test end-to-end.

**Components**:
- End-to-end OAuth flow testing
- API request testing
- Error scenario testing
- Cross-browser testing

**Deliverables**:
- Complete integration
- Test documentation
- Bug fixes and refinements

---

## Core Components

### 1. Authentication Client (`customerAuth.js`)

**Purpose**: Centralized authentication logic that handles all OAuth interactions with the backend.

**Key Responsibilities**:
- Manage session token lifecycle (store, retrieve, clear)
- Initiate OAuth login flow
- Handle OAuth callback
- Validate session tokens
- Handle logout

**Required Methods**:

#### `constructor(apiBaseUrl)`
- Initialize client with backend API base URL
- Load existing session token from localStorage
- Set up internal state

#### `getStoredSessionToken()`
- Retrieve session token from localStorage
- Return `null` if not found
- Handle localStorage errors gracefully

#### `storeSessionToken(token)`
- Store session token in localStorage
- Update internal state
- Handle localStorage quota errors

#### `clearSessionToken()`
- Remove session token from localStorage
- Clear internal state
- Handle errors gracefully

#### `login(shopDomain)`
- Validate shopDomain (must be storefront domain)
- Build login URL: `${apiBaseUrl}/api/customer-auth/login?shop=${shopDomain}`
- Redirect browser to login URL
- Handle errors (network, invalid domain)

**Important**: `shopDomain` must be the **storefront domain** (public-facing domain where customers shop), NOT the admin domain. Examples:
- ✅ `store.myshopify.com` (storefront domain)
- ✅ `your-custom-domain.com` (custom domain)
- ❌ `admin.shopify.com` (admin domain - DO NOT USE)

#### `handleCallback()`
- Extract query parameters from current URL (`code`, `state`, `error`, `error_description`)
- Handle OAuth errors (if `error` parameter present)
- Make POST request to backend callback endpoint
- Extract `sessionToken` from response
- Store session token
- Return customer information
- Handle errors (network, invalid response, authentication failure)

**Implementation Notes**:
- Should be called on the callback page after OAuth redirect
- Backend returns JSON: `{ success: true, data: { sessionToken, customer, expiresAt } }`
- Should redirect to success page or original page after storing token
- Should handle errors by showing error message and providing retry option

#### `validateSession()`
- Check if session token exists
- Make POST request to `/api/customer-auth/validate` with session token
- Return validation result: `{ valid: boolean, customer?: object, error?: string }`
- Handle errors gracefully (network, invalid token)

**Use Cases**:
- Check authentication status on page load
- Verify session before making API requests
- Display customer information

#### `logout()`
- Check if session token exists
- Make POST request to `/api/customer-auth/logout` with session token
- Clear session token from localStorage
- Clear internal state
- Handle errors gracefully (continue even if API call fails)

#### `authenticatedFetch(url, options)`
- Check if session token exists (throw error if not)
- Add `X-Session-Token` header to request
- Make fetch request with session token
- Handle 401 responses (clear token, throw error with `requiresLogin: true`)
- Return response or throw error

**Implementation Notes**:
- Should support all fetch options (method, body, headers, etc.)
- Should merge custom headers with session token header
- Should handle 401 by clearing token and throwing specific error
- Should preserve original fetch behavior for non-401 errors

**Error Handling**:
- `401 Unauthorized`: Clear session token, throw error with `requiresLogin: true`
- Network errors: Throw with original error message
- Other errors: Preserve original error

### 2. API Client Wrapper

**Purpose**: Intercept all API requests and automatically add authentication.

**Key Responsibilities**:
- Wrap existing API calls
- Inject session token automatically
- Handle 401 errors globally
- Provide retry mechanism with login redirect

**Required Features**:

#### Automatic Token Injection
- Intercept all API requests to backend
- Automatically add `X-Session-Token` header if session token exists
- Support multiple header formats:
  - `X-Session-Token: {token}` (primary)
  - `Authorization: Bearer {token}` (fallback)
  - Request body: `{ sessionToken: {token}, ...otherData }` (fallback)

#### 401 Error Handling
- Detect 401 responses
- Clear invalid session token
- Trigger login flow automatically OR
- Return error with `requiresLogin: true` flag for component-level handling

#### Request Retry Logic
- Option to retry failed requests after successful login
- Store original request parameters
- Resume request after authentication completes

**Implementation Approaches**:

**Option A: Fetch Interceptor (Recommended)**
- Override global `fetch` function
- Intercept all requests to backend API
- Add session token automatically
- Handle 401 responses

**Option B: API Client Class**
- Create wrapper class around fetch/axios
- All API calls go through wrapper
- Automatic token injection
- Centralized error handling

**Option C: Request Middleware**
- Use framework-specific middleware (e.g., Axios interceptors)
- Add token to all requests
- Handle 401 in response interceptor

### 3. Callback Page Handler

**Purpose**: Handle OAuth callback after customer authenticates with Shopify.

**Key Responsibilities**:
- Extract OAuth parameters from URL
- Call authentication client's `handleCallback()` method
- Store session token
- Redirect to appropriate page
- Display errors if authentication fails

**Required Features**:

#### URL Parameter Extraction
- Extract `code`, `state`, `error`, `error_description` from query string
- Validate required parameters
- Handle missing parameters gracefully

#### Success Handling
- Call `authClient.handleCallback()`
- Store returned session token
- Extract customer information
- Determine redirect destination:
  - Original page (if `return_to` parameter exists)
  - Default success page
  - Current page (if no redirect specified)
- Redirect user to destination

#### Error Handling
- Display user-friendly error messages
- Provide retry option
- Log errors for debugging
- Handle network errors
- Handle invalid state errors
- Handle expired state errors

**Implementation Notes**:
- Should be a dedicated route/page (e.g., `/auth/callback`)
- Should handle both success and error cases
- Should provide loading state during processing
- Should redirect immediately after success (no manual user action)

---

## UI Components

### 1. Login Button/Modal Component

**Purpose**: Provide user interface for initiating login.

**Required Features**:
- Display "Sign In" button or link
- Show loading state when login is initiated
- Handle click event to trigger login
- Display error messages if login fails
- Support different styles/themes

**Props/Configuration**:
- `apiBaseUrl`: Backend API base URL
- `shopDomain`: Storefront domain (required)
- `onLoginStart`: Callback when login initiated
- `onLoginError`: Callback when login fails
- `className`: Custom styling
- `disabled`: Disable button state

**User Experience**:
- Click button → Show loading spinner → Redirect to Shopify login
- If error → Show error message with retry option
- Should be accessible (keyboard navigation, screen readers)

### 2. Customer Information Display Component

**Purpose**: Display authenticated customer information.

**Required Features**:
- Display customer email, name (if available)
- Show loading state while fetching customer info
- Handle unauthenticated state (show login prompt)
- Support different display formats (dropdown, sidebar, inline)

**Props/Configuration**:
- `customer`: Customer object from authentication
- `showEmail`: Boolean to show/hide email
- `showName`: Boolean to show/hide name
- `onLogout`: Callback for logout action
- `className`: Custom styling

**Data Source**:
- From `validateSession()` response
- From callback response
- From authentication state management

### 3. Logout Button Component

**Purpose**: Provide user interface for logging out.

**Required Features**:
- Display "Sign Out" or "Logout" button/link
- Show loading state during logout
- Handle logout click event
- Clear authentication state
- Redirect after logout (optional)

**Props/Configuration**:
- `onLogout`: Callback when logout initiated
- `onLogoutComplete`: Callback when logout succeeds
- `redirectAfterLogout`: URL to redirect to after logout
- `className`: Custom styling

**User Experience**:
- Click button → Show loading → Clear session → Redirect (if configured)
- Should work even if API call fails (clear local state)

### 4. Protected Route/Component Wrapper

**Purpose**: Protect routes/components that require authentication.

**Required Features**:
- Check authentication status before rendering
- Redirect to login if not authenticated
- Show loading state during authentication check
- Preserve original route for post-login redirect
- Support optional authentication (show different content if not logged in)

**Props/Configuration**:
- `requireAuth`: Boolean - require authentication (default: true)
- `fallbackComponent`: Component to show if not authenticated
- `redirectTo`: Login page URL
- `children`: Protected content

**Implementation Approaches**:

**Option A: Route Guard (React Router, Vue Router, etc.)**
- Intercept route navigation
- Check authentication before allowing access
- Redirect to login if not authenticated

**Option B: Component Wrapper**
- Wrap components that need protection
- Check authentication in component lifecycle
- Conditionally render content or login prompt

**Option C: Higher-Order Component (HOC)**
- Create HOC that wraps components
- Handles authentication check
- Passes authentication state as props

### 5. Authentication Status Indicator

**Purpose**: Show current authentication status to user.

**Required Features**:
- Display login status (logged in / not logged in)
- Show customer information when logged in
- Provide quick access to login/logout
- Update in real-time when status changes

**Implementation**:
- Can be part of header/navigation
- Can be a standalone component
- Should subscribe to authentication state changes

---

## API Integration

### 1. Updating Existing API Calls

**Goal**: Modify existing API calls to include authentication.

**Approach**: Wrap existing API calls with authenticated fetch.

**Before**:
```javascript
// Direct API call without authentication
const response = await fetch('/api/fashion-photo', {
  method: 'POST',
  body: formData,
});
```

**After**:
```javascript
// Using authentication client
const authClient = new CustomerAuthClient(apiBaseUrl);

// Check authentication first
const session = await authClient.validateSession();
if (!session.valid) {
  await authClient.login(shopDomain);
  return; // User will be redirected
}

// Make authenticated request
const response = await authClient.authenticatedFetch('/api/fashion-photo', {
  method: 'POST',
  body: formData,
});
```

**Files to Update**:
- All API call locations
- Form submission handlers
- File upload handlers
- AJAX request functions

### 2. Error Handling Strategy

**401 Unauthorized Responses**:
- Clear session token
- Redirect to login OR
- Show login modal/prompt
- Store original request for retry after login

**Network Errors**:
- Show user-friendly error message
- Provide retry option
- Log error for debugging

**Other API Errors**:
- Preserve existing error handling
- Don't interfere with business logic errors

### 3. Request Interception Patterns

**Pattern 1: Global Fetch Override**
- Override `window.fetch` globally
- Intercept all requests to backend API
- Add session token automatically
- Handle 401 responses

**Pattern 2: API Client Wrapper**
- Create centralized API client
- All backend requests go through client
- Automatic token injection
- Centralized error handling

**Pattern 3: Framework-Specific Interceptors**
- Use Axios interceptors (if using Axios)
- Use fetch wrapper library
- Use framework HTTP client interceptors

---

## Error Handling

### 1. Authentication Errors

**OAuth Errors**:
- `error` parameter in callback URL
- Display user-friendly error message
- Provide retry option
- Log error for debugging

**Session Validation Errors**:
- Invalid session token
- Expired session
- Network errors during validation
- Handle gracefully (redirect to login)

**Token Storage Errors**:
- localStorage quota exceeded
- localStorage disabled
- Handle gracefully (fallback to sessionStorage or memory)

### 2. API Request Errors

**401 Unauthorized**:
- Clear session token
- Trigger login flow
- Store original request for retry

**Network Errors**:
- Show retry option
- Log error
- Don't clear session (might be temporary network issue)

**Other HTTP Errors**:
- Preserve existing error handling
- Don't interfere with business logic

### 3. User Experience Considerations

**Loading States**:
- Show loading spinner during authentication
- Show loading during API requests
- Prevent multiple simultaneous login attempts

**Error Messages**:
- User-friendly error messages
- Actionable error messages (what user can do)
- Technical details in console only

**Recovery Options**:
- Retry button for failed operations
- Clear error state after successful retry
- Graceful degradation when possible

---

## State Management

### 1. Authentication State

**Required State**:
- `isAuthenticated`: Boolean - whether user is authenticated
- `isLoading`: Boolean - whether authentication check is in progress
- `customer`: Object - customer information (email, name, etc.)
- `sessionToken`: String - current session token (optional, can be in localStorage only)
- `error`: String - current error message (if any)

### 2. State Management Approaches

**Option A: React Context (React)**
- Create `AuthContext` with authentication state
- Provide `AuthProvider` component
- Use `useAuth` hook to access state
- Update state on authentication events

**Option B: Redux/Vuex Store**
- Create authentication slice/module
- Actions for login, logout, validate
- Selectors for authentication state
- Middleware for API request interception

**Option C: Vanilla JavaScript**
- Global state object
- Event system for state changes
- Subscribers for state updates

### 3. State Synchronization

**Initial Load**:
- Check localStorage for session token
- Validate token with backend
- Update state based on validation result

**After Login**:
- Store session token
- Update authentication state
- Fetch customer information
- Notify subscribers of state change

**After Logout**:
- Clear session token
- Clear authentication state
- Notify subscribers of state change

**Periodic Validation**:
- Optionally validate session periodically
- Update state if session expires
- Handle token refresh (if implemented)

---

## Testing Strategy

### 1. Unit Testing

**Authentication Client**:
- Test session token storage/retrieval
- Test login URL generation
- Test callback handling
- Test session validation
- Test logout functionality
- Test error handling

**API Client Wrapper**:
- Test token injection
- Test 401 error handling
- Test request retry logic
- Test error propagation

### 2. Integration Testing

**OAuth Flow**:
- Test complete login flow
- Test callback handling
- Test session persistence
- Test logout flow

**API Integration**:
- Test authenticated API requests
- Test 401 handling and redirect
- Test token refresh (if implemented)

### 3. End-to-End Testing

**User Scenarios**:
- User logs in successfully
- User tries to access protected resource without login
- User's session expires
- User logs out
- User encounters network error during login

**Browser Testing**:
- Test in multiple browsers
- Test localStorage availability
- Test cookie handling
- Test redirect behavior

### 4. Error Scenario Testing

**Test Cases**:
- Invalid session token
- Expired session token
- Network errors
- Backend API errors
- localStorage disabled
- localStorage quota exceeded

---

## Deployment Checklist

### Pre-Deployment

- [ ] Authentication client implemented and tested
- [ ] API integration complete
- [ ] UI components implemented
- [ ] State management configured
- [ ] Error handling implemented
- [ ] Callback page created and tested
- [ ] All existing API calls updated
- [ ] Cross-browser testing completed

### Configuration

- [ ] Backend API base URL configured
- [ ] Storefront domain configured
- [ ] Callback URL configured
- [ ] Error pages configured
- [ ] Loading states implemented

### Testing

- [ ] OAuth flow tested end-to-end
- [ ] Session persistence tested
- [ ] API requests tested with authentication
- [ ] Error scenarios tested
- [ ] Cross-browser testing completed
- [ ] Mobile device testing completed

### Documentation

- [ ] User-facing documentation updated
- [ ] Developer documentation updated
- [ ] Error message documentation
- [ ] Troubleshooting guide created

---

## Implementation Details

### 1. Session Token Storage

**Storage Location**: `localStorage`

**Key Name**: `customer_session_token` (or configurable)

**Storage Format**: Plain string (session token value)

**Security Considerations**:
- Session tokens are not sensitive (they're identifiers, not secrets)
- Backend validates tokens server-side
- Tokens expire and are invalidated server-side
- XSS protection: Ensure proper input sanitization

**Fallback Options**:
- If localStorage unavailable: Use sessionStorage
- If sessionStorage unavailable: Use in-memory storage (lost on page refresh)
- Warn user if storage unavailable

### 2. Shop Domain Handling

**Critical Requirement**: Always use **storefront domain**, not admin domain.

**Storefront Domain Examples**:
- `store.myshopify.com`
- `your-custom-domain.com`
- `shop.example.com`

**How to Obtain**:
- From Shopify theme Liquid: `{{ shop.permanent_domain }}`
- From Shopify Storefront API: `shop.domain`
- From URL: Extract from current page URL
- From configuration: Store in app config

**Validation**:
- Validate domain format before using
- Ensure domain is storefront domain (not admin)
- Handle custom domains correctly

### 3. Callback Page Implementation

**Route**: `/auth/callback` or `/api/customer-auth/callback` (must match backend)

**Responsibilities**:
1. Extract query parameters from URL
2. Call `authClient.handleCallback()`
3. Handle success: Store token, redirect
4. Handle error: Display error, provide retry

**Implementation Pattern**:
```javascript
// Pseudo-code structure (NOT actual code)
async function handleCallbackPage() {
  // 1. Extract URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');
  
  // 2. Handle OAuth errors
  if (error) {
    displayError(error);
    return;
  }
  
  // 3. Process callback
  try {
    const result = await authClient.handleCallback();
    // 4. Store token (handled by authClient)
    // 5. Redirect to success page
    redirectToSuccessPage();
  } catch (error) {
    displayError(error.message);
  }
}
```

### 4. API Request Interception

**Implementation Options**:

**Option A: Fetch Wrapper Function**
- Create `authenticatedFetch(url, options)` function
- Use instead of native `fetch()`
- Automatically adds session token
- Handles 401 errors

**Option B: Axios Interceptors** (if using Axios)
- Request interceptor: Add `X-Session-Token` header
- Response interceptor: Handle 401 errors
- Automatic token injection

**Option C: Framework-Specific**
- React: Custom hook `useAuthenticatedFetch()`
- Vue: Plugin or composable
- Angular: HTTP interceptor

### 5. Protected Route Implementation

**React Router Example** (conceptual):
- Create `ProtectedRoute` component
- Check authentication in `useEffect` or loader
- Redirect to login if not authenticated
- Pass `return_to` parameter for post-login redirect

**Vue Router Example** (conceptual):
- Create navigation guard
- Check authentication before route enter
- Redirect to login if not authenticated
- Store intended route for post-login redirect

**Vanilla JavaScript Example** (conceptual):
- Check authentication on page load
- Redirect to login if not authenticated
- Store current URL for post-login redirect

---

## Security Considerations

### 1. Token Storage Security

**Session Tokens**:
- ✅ Safe to store in localStorage (they're identifiers, not secrets)
- ✅ Backend validates all tokens server-side
- ✅ Tokens expire and are invalidated
- ⚠️ Protect against XSS (input sanitization)

**Never Store**:
- ❌ Access tokens (backend handles these)
- ❌ Refresh tokens (backend handles these)
- ❌ Customer PII (fetch from backend when needed)

### 2. XSS Protection

**Best Practices**:
- Sanitize all user input
- Use Content Security Policy (CSP)
- Avoid `innerHTML` with user data
- Use framework's built-in XSS protection

### 3. CSRF Protection

**Backend Handles**:
- State parameter validation
- Nonce validation
- One-time use of authorization codes

**Frontend Responsibilities**:
- Include state parameter in login request (backend generates)
- Validate state in callback (backend validates)
- Don't expose state generation logic

### 4. HTTPS Requirement

**Critical**: OAuth requires HTTPS in production.

**Development**:
- Use ngrok or similar tunnel
- Never use `localhost` for OAuth (Shopify requirement)
- Use HTTPS tunnel URL

**Production**:
- Ensure all API calls use HTTPS
- Ensure callback URL uses HTTPS
- Ensure login redirect uses HTTPS

---

## Performance Considerations

### 1. Session Validation

**Strategy**: Validate session on-demand, not on every page load.

**When to Validate**:
- Before making authenticated API requests
- On user-initiated actions (clicking protected link)
- Periodically (optional, e.g., every 5 minutes)
- Not on every page load (unless required)

**Caching**:
- Cache validation result temporarily
- Re-validate if cached result is stale
- Don't cache validation errors

### 2. Token Storage Access

**Optimization**:
- Read token once and cache in memory
- Only read from localStorage when needed
- Avoid frequent localStorage access

### 3. API Request Optimization

**Batching**:
- Batch multiple API requests when possible
- Use single session validation for multiple requests
- Avoid redundant authentication checks

---

## Accessibility Considerations

### 1. Keyboard Navigation

**Requirements**:
- All authentication buttons/keyboard accessible
- Tab order is logical
- Enter/Space keys trigger actions
- Focus indicators visible

### 2. Screen Readers

**Requirements**:
- Proper ARIA labels on buttons
- Status announcements for authentication state
- Error messages announced
- Loading states announced

### 3. Visual Indicators

**Requirements**:
- Clear visual feedback for authentication state
- Loading indicators during authentication
- Error messages clearly visible
- Success messages (if applicable)

---

## Browser Compatibility

### 1. Required Features

**Minimum Requirements**:
- `localStorage` API support
- `fetch` API support (or polyfill)
- `URLSearchParams` support (or polyfill)
- ES6+ JavaScript support

### 2. Polyfills

**If Needed**:
- `fetch` polyfill for older browsers
- `URLSearchParams` polyfill
- `Promise` polyfill (if needed)

### 3. Testing Matrix

**Recommended Browsers**:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Migration Strategy

### Phase 1: Parallel Implementation

**Goal**: Implement authentication alongside existing system.

**Approach**:
- Keep existing API calls working
- Add authentication as optional enhancement
- Test authentication flow thoroughly
- Monitor for issues

### Phase 2: Gradual Rollout

**Goal**: Gradually require authentication for more features.

**Approach**:
- Start with optional authentication
- Make authentication required for new features
- Gradually require for existing features
- Provide clear migration path for users

### Phase 3: Full Enforcement

**Goal**: Require authentication for all protected endpoints.

**Approach**:
- Update all API calls to require authentication
- Remove optional authentication code
- Monitor for issues
- Provide support for users

---

## Troubleshooting

### Common Issues

#### 1. "Session token not found"

**Possible Causes**:
- localStorage disabled
- Token was cleared
- Different domain/subdomain

**Solutions**:
- Check localStorage availability
- Verify token storage on login
- Check domain consistency

#### 2. "401 Unauthorized" errors

**Possible Causes**:
- Session expired
- Invalid session token
- Backend validation failure

**Solutions**:
- Clear token and re-login
- Check backend logs
- Verify session token format

#### 3. "Redirect loop" during login

**Possible Causes**:
- Callback URL mismatch
- State validation failure
- Backend error

**Solutions**:
- Verify callback URL matches backend config
- Check backend logs
- Clear all cookies/localStorage and retry

#### 4. "Shop domain invalid"

**Possible Causes**:
- Using admin domain instead of storefront domain
- Domain format incorrect
- Custom domain not configured

**Solutions**:
- Use storefront domain (public-facing)
- Verify domain format
- Check Shopify store configuration

---

## Next Steps

### After Frontend Implementation

1. **Integration Testing**: Test complete flow end-to-end
2. **User Acceptance Testing**: Get feedback from real users
3. **Performance Monitoring**: Monitor authentication performance
4. **Error Monitoring**: Set up error tracking
5. **Documentation**: Update user and developer documentation

### Future Enhancements

1. **Token Refresh**: Implement automatic token refresh (if needed)
2. **Remember Me**: Implement "remember me" functionality
3. **Multi-Device**: Handle multiple devices per customer
4. **Session Management**: Allow customers to manage active sessions
5. **Social Login**: Integrate social login options (if supported)

---

## References

### Documentation

- **Backend Implementation**: See `customerLogin.md` for complete backend implementation
- **Shopify Customer Account API**: https://shopify.dev/docs/api/customer
- **OAuth 2.0 Specification**: https://oauth.net/2/
- **PKCE Specification**: https://datatracker.ietf.org/doc/html/rfc7636

### Backend Endpoints

- `GET /api/customer-auth/login?shop={storefrontDomain}` - Initiate login
- `GET /api/customer-auth/callback?code={code}&state={state}` - Handle callback
- `POST /api/customer-auth/validate` - Validate session
- `POST /api/customer-auth/logout` - Logout

### Response Formats

**Login Callback Success**:
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

**Session Validation Success**:
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": "gid://shopify/Customer/123",
      "shopDomain": "store.myshopify.com"
    },
    "expiresAt": "2025-01-15T12:00:00Z"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "code": "AUTHENTICATION_REQUIRED",
  "message": "Please sign in to use this service",
  "details": {
    "requiresLogin": true
  }
}
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Author**: Development Team  
**Related Documents**: `customerLogin.md` (Backend Implementation)

