# Comprehensive Logging Guide for Subscription Flow

This document explains the comprehensive logging system implemented throughout the subscription flow to help with debugging.

## 📋 Logging Structure

All logs follow a consistent format with prefixes to identify the component and operation:

- `[FRONTEND] [SUBSCRIBE]` - Frontend subscription flow
- `[API] [SUBSCRIBE]` - Backend API endpoint
- `[BILLING] [CREATE]` - Billing utility functions

## 🔍 Frontend Logging (`src/pages/Index.tsx`)

### Log Points:

1. **Subscription Start**
   - Plan handle
   - Timestamp

2. **Shop Domain Extraction**
   - Shop from App Bridge hook
   - Shop from URL parameters
   - Final shop domain
   - Session token availability

3. **Request Preparation**
   - Request URL and method
   - Plan handle
   - Return URL
   - Session token inclusion

4. **Response Received**
   - HTTP status code
   - Status text
   - Response duration
   - Response headers

5. **Response Processing**
   - Has confirmation URL
   - Is free plan
   - Has subscription data
   - Total duration

6. **Success/Error Outcomes**
   - Redirect to confirmation URL
   - Free plan activation
   - Error details with stack traces

## 🔍 Backend API Logging (`server/index.js`)

### Log Points:

1. **Request Received**
   - Request ID (unique per request)
   - Method and path
   - IP address
   - User agent
   - Timestamp

2. **Request Body Parsing**
   - Plan handle
   - Return URL
   - Trial days
   - Request body presence

3. **Shop Domain Extraction (Multi-step)**
   - Step 1: From authenticated session
   - Step 2: From query parameters
   - Step 3: From request body
   - Final normalized shop domain

4. **Session Management**
   - Session ID generation
   - Session retrieval duration
   - Session availability
   - Session shop domain

5. **Return URL Determination**
   - Provided return URL
   - Default return URL
   - Final return URL

6. **Billing Service Call**
   - Parameters passed
   - Billing operation duration
   - Result details

7. **Response**
   - Success/error status
   - Total request duration
   - Response data

## 🔍 Billing Utility Logging (`server/utils/billing.js`)

### Log Points:

1. **Operation Start**
   - Operation ID (unique per operation)
   - Shop domain
   - Plan handle
   - Return URL
   - Trial days
   - Replacement behavior
   - Timestamp

2. **Plan Validation**
   - Plan handle lookup
   - Plan found status
   - Plan details (name, price)

3. **Free Plan Handling**
   - Free plan detection
   - Early return with plan details

4. **GraphQL Mutation Preparation**
   - Plan details
   - Price and currency
   - Billing interval

5. **GraphQL Variables**
   - Variable structure
   - Line items count
   - Price details

6. **GraphQL Client Creation**
   - Client initialization
   - Session availability

7. **GraphQL Request**
   - Request initiation
   - Timeout configuration
   - Request duration
   - Response received

8. **Response Parsing**
   - Response structure
   - Data extraction
   - User errors detection
   - Error count

9. **Subscription Data Extraction**
   - Subscription object
   - Subscription ID
   - Subscription name
   - Subscription status
   - Confirmation URL presence

10. **Validation**
    - Confirmation URL validation
    - Missing data detection

11. **Success/Error**
    - Total operation duration
    - Final result details
    - Error details with stack traces

## 📊 Log Format

All logs include:
- **Timestamp**: ISO 8601 format
- **Operation/Request ID**: Unique identifier for tracking
- **Duration**: Time taken for operations (in milliseconds)
- **Context**: Relevant data for debugging

## 🔍 Example Log Flow

### Successful Subscription:

```
[FRONTEND] [SUBSCRIBE] Starting subscription process
[FRONTEND] [SUBSCRIBE] Shop domain extraction
[FRONTEND] [SUBSCRIBE] Sending subscription request
[API] [SUBSCRIBE] Request received
[API] [SUBSCRIBE] Request body parsed
[API] [SUBSCRIBE] Shop domain extraction - step 1
[API] [SUBSCRIBE] Shop domain normalized
[API] [SUBSCRIBE] Session ID generated
[API] [SUBSCRIBE] Session retrieved
[API] [SUBSCRIBE] Return URL determined
[API] [SUBSCRIBE] Calling billing.createSubscription
[BILLING] [CREATE] Starting subscription creation
[BILLING] [CREATE] Plan lookup
[BILLING] [CREATE] Preparing GraphQL mutation
[BILLING] [CREATE] GraphQL variables prepared
[BILLING] [CREATE] Creating GraphQL client
[BILLING] [CREATE] Initiating GraphQL request
[BILLING] [CREATE] GraphQL request completed
[BILLING] [CREATE] Parsing GraphQL response
[BILLING] [CREATE] Response data extracted
[BILLING] [CREATE] Subscription data extracted
[BILLING] [CREATE] Subscription created successfully
[API] [SUBSCRIBE] Billing subscription created
[API] [SUBSCRIBE] Request completed successfully
[FRONTEND] [SUBSCRIBE] Response data parsed
[FRONTEND] [SUBSCRIBE] Redirecting to confirmation URL
```

### Timeout Error:

```
[FRONTEND] [SUBSCRIBE] Starting subscription process
[API] [SUBSCRIBE] Request received
[BILLING] [CREATE] Starting subscription creation
[BILLING] [CREATE] Initiating GraphQL request
[BILLING] [CREATE] GraphQL request timeout
[BILLING] [CREATE] Timeout error detected
[BILLING] [CREATE] Subscription creation failed
[API] [SUBSCRIBE] Request failed
[FRONTEND] [SUBSCRIBE] Error response received
```

## 🛠️ Debugging Tips

1. **Track by Request ID**: Each API request has a unique `requestId` that you can use to filter logs
2. **Track by Operation ID**: Each billing operation has a unique `operationId` for tracking
3. **Check Durations**: Look for operations taking longer than expected
4. **Follow the Flow**: Logs are sequential - follow the flow from frontend → API → billing
5. **Error Stack Traces**: All errors include stack traces for detailed debugging

## 📝 Log Levels

- **INFO**: Normal operation flow
- **WARN**: Potential issues (missing optional data)
- **ERROR**: Failures and exceptions

## 🔍 Where to Find Logs

- **Frontend**: Browser console (in development mode)
- **Backend**: Vercel function logs
- **Server**: Application logs (if using a logging service)

## 🚀 Benefits

1. **Easy Debugging**: Track every step of the subscription process
2. **Performance Monitoring**: See duration of each operation
3. **Error Tracking**: Detailed error information with context
4. **Request Tracing**: Follow a single request through the entire system
5. **Timeout Detection**: Identify where timeouts occur

---

**Note**: All sensitive data (like full session tokens) is not logged. Only metadata and identifiers are included in logs.

