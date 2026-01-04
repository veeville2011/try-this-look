# Referral System Integration Guide

## Overview

The referral system allows paid plan users to generate unique referral codes and share them with others. When a new user signs up using a referral code, both the referrer and the referred user receive credits as rewards.

## Key Features

- Only users on paid plans can generate referral codes
- Each paid user gets one unique referral code
- New users can use referral codes during signup
- Credits are awarded after successful signup confirmation:
  - Referred user receives: 20 credits (10 referral reward + 10 freemium credits)
  - Referrer receives: 20 credits as reward
- One referral per new user (enforced)
- Self-referrals are not allowed (enforced)
- Credits are only awarded after signup is confirmed

---

## API Endpoints

### 1. Get or Create Referral Code

**Endpoint:** `GET /api/referrals/code`

**Description:** Retrieves or creates a unique referral code for a paid user. If the user already has a referral code, it returns the existing one. Only users on paid plans (not free plan) can generate referral codes.

**Query Parameters:**
- `shop` (required): Shop domain in format `example.myshopify.com` or shop handle

**Authentication:** Not explicitly required, but shop parameter must be valid

**Success Response (200 OK):**
```json
{
  "success": true,
  "referralCode": "ABC123XY",
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "requestId": "req-1234567890-abc123"
}
```

**Error Responses:**

**400 Bad Request** - Missing or invalid shop parameter:
```json
{
  "error": "Missing shop parameter",
  "message": "Shop parameter is required",
  "requestId": "req-1234567890-abc123"
}
```

**403 Forbidden** - User is not on a paid plan:
```json
{
  "error": "Not eligible",
  "message": "Only users on paid plans can generate referral codes",
  "requestId": "req-1234567890-abc123"
}
```

**500 Internal Server Error** - Server error:
```json
{
  "error": "Failed to get referral code",
  "message": "Error details here",
  "requestId": "req-1234567890-abc123"
}
```

**When to Use:**
- When a paid user wants to view their referral code
- When displaying referral code in user dashboard
- When user wants to share their referral code

**Frontend Integration Notes:**
- Call this endpoint when user navigates to referral section
- Show appropriate message if user is not on paid plan (403 error)
- Display the referral code prominently for easy sharing
- Consider caching the referral code in frontend state

---

### 2. Validate Referral Code

**Endpoint:** `POST /api/referrals/validate`

**Description:** Validates a referral code and creates a referral relationship during signup. This should be called when a new user provides a referral code during the signup process. The referral is created with "pending" status until signup is completed.

**Request Body:**
```json
{
  "referralCode": "ABC123XY",
  "shopDomain": "newshop.myshopify.com"
}
```

**Request Body Fields:**
- `referralCode` (required, string): The referral code provided by the user
- `shopDomain` (required, string): Shop domain of the new user signing up

**Authentication:** Not required (public endpoint for signup)

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Referral code validated successfully",
  "referralId": 123,
  "status": "pending",
  "requestId": "req-1234567890-abc123"
}
```

**Error Responses:**

**400 Bad Request** - Missing required fields:
```json
{
  "error": "Missing referral code",
  "message": "Referral code is required",
  "requestId": "req-1234567890-abc123"
}
```

**400 Bad Request** - Invalid referral code:
```json
{
  "error": "Validation failed",
  "message": "Invalid or inactive referral code",
  "requestId": "req-1234567890-abc123"
}
```

**400 Bad Request** - Self-referral attempt:
```json
{
  "error": "Validation failed",
  "message": "Self-referrals are not allowed",
  "requestId": "req-1234567890-abc123"
}
```

**400 Bad Request** - Shop already referred:
```json
{
  "error": "Validation failed",
  "message": "This shop has already been referred",
  "requestId": "req-1234567890-abc123"
}
```

**500 Internal Server Error** - Server error:
```json
{
  "error": "Failed to validate referral code",
  "message": "Error details here",
  "requestId": "req-1234567890-abc123"
}
```

**When to Use:**
- During signup flow when user enters a referral code
- Before completing signup to validate the code
- As part of signup form validation

**Frontend Integration Notes:**
- Call this endpoint when user submits referral code during signup
- Show validation errors immediately if code is invalid
- Store referralId in signup state if validation succeeds
- Continue with signup even if referral code validation fails (referral is optional)
- Do not block signup process if referral validation fails

---

### 3. Award Referral Credits

**Endpoint:** `POST /api/referrals/award`

**Description:** Awards credits to both the referrer and referred user after successful signup completion. This should be called after the signup is fully confirmed (subscription approved, user authenticated, etc.). Credits are awarded as coupon credits (promotional credits).

**Query Parameters:**
- `shop` (required): Shop domain of the new user who completed signup

**Alternative:** Can also be provided in request body as `shop` field

**Authentication:** Not explicitly required, but shop parameter must be valid

**Success Response (200 OK) - Credits Awarded:**
```json
{
  "success": true,
  "message": "Credits awarded successfully",
  "creditsAwarded": true,
  "referrerCredits": 20,
  "referredCredits": 20,
  "requestId": "req-1234567890-abc123"
}
```

**Success Response (200 OK) - No Referral Found:**
```json
{
  "success": true,
  "message": "No referral to process",
  "creditsAwarded": false,
  "requestId": "req-1234567890-abc123"
}
```

**Error Responses:**

**400 Bad Request** - Missing shop parameter:
```json
{
  "error": "Missing shop parameter",
  "message": "Shop parameter is required",
  "requestId": "req-1234567890-abc123"
}
```

**500 Internal Server Error** - Server error:
```json
{
  "error": "Failed to award referral credits",
  "message": "Error details here",
  "requestId": "req-1234567890-abc123"
}
```

**When to Use:**
- After subscription approval in Shopify
- After user authentication is complete
- After initial credit allocation (if applicable)
- In payment-success callback/page
- After signup confirmation is fully processed

**Frontend Integration Notes:**
- Call this endpoint after signup is successfully completed
- This is an idempotent operation - safe to call multiple times
- If no referral exists, endpoint returns success with `creditsAwarded: false` (this is normal)
- Do not block user flow if this endpoint fails - log error but continue
- Consider showing a success message if credits were awarded
- This endpoint uses database transactions to ensure atomicity

---

### 4. Get Referral Statistics

**Endpoint:** `GET /api/referrals/stats`

**Description:** Retrieves referral statistics for a shop, including total referrals, completed referrals, pending referrals, and total credits earned.

**Query Parameters:**
- `shop` (required): Shop domain

**Authentication:** Not explicitly required, but shop parameter must be valid

**Success Response (200 OK):**
```json
{
  "success": true,
  "stats": {
    "hasReferralCode": true,
    "referralCode": "ABC123XY",
    "isActive": true,
    "totalReferrals": 5,
    "completedReferrals": 4,
    "pendingReferrals": 1,
    "totalCreditsEarned": 80
  },
  "requestId": "req-1234567890-abc123"
}
```

**Success Response (200 OK) - No Referral Code:**
```json
{
  "success": true,
  "stats": {
    "hasReferralCode": false,
    "referralCode": null,
    "totalReferrals": 0,
    "completedReferrals": 0,
    "pendingReferrals": 0,
    "totalCreditsEarned": 0
  },
  "requestId": "req-1234567890-abc123"
}
```

**Error Responses:**

**400 Bad Request** - Missing or invalid shop parameter:
```json
{
  "error": "Missing shop parameter",
  "message": "Shop parameter is required",
  "requestId": "req-1234567890-abc123"
}
```

**500 Internal Server Error** - Server error:
```json
{
  "error": "Failed to get referral statistics",
  "message": "Error details here",
  "requestId": "req-1234567890-abc123"
}
```

**When to Use:**
- Display referral dashboard/statistics page
- Show referral performance metrics
- Display total credits earned from referrals
- Show referral code and sharing options

**Frontend Integration Notes:**
- Call this endpoint when user navigates to referral dashboard
- Display statistics in a user-friendly format
- Show referral code prominently if user has one
- If user doesn't have referral code, show message that they need paid plan
- Consider refreshing stats periodically or after referral events

---

## Frontend Integration Workflow

### Scenario 1: Paid User Views Their Referral Code

**Step 1:** User navigates to referral section in dashboard

**Step 2:** Frontend calls `GET /api/referrals/code?shop={shopDomain}`

**Step 3:** Handle response:
- If success (200): Display referral code to user
- If 403 (Forbidden): Show message that user needs to upgrade to paid plan
- If error: Show error message and log for debugging

**Step 4:** Provide sharing options (copy to clipboard, share link, etc.)

**Step 5:** Optionally call `GET /api/referrals/stats?shop={shopDomain}` to show statistics

---

### Scenario 2: New User Signs Up with Referral Code

**Step 1:** User enters referral code during signup form

**Step 2:** Frontend validates referral code format (optional client-side validation)

**Step 3:** When user submits signup form, call `POST /api/referrals/validate` with referral code and shop domain

**Step 4:** Handle validation response:
- If success (200): Store referralId in signup state, continue with signup
- If 400 (Bad Request): Show validation error message to user, allow them to correct or remove referral code
- If error: Log error but do not block signup (referral is optional)

**Step 5:** Continue with normal signup flow (subscription creation, authentication, etc.)

**Step 6:** After signup is fully completed (subscription approved, user authenticated), call `POST /api/referrals/award?shop={shopDomain}`

**Step 7:** Handle award response:
- If success with `creditsAwarded: true`: Show success message about credits received
- If success with `creditsAwarded: false`: No action needed (user signed up without referral)
- If error: Log error but do not block user flow

---

### Scenario 3: New User Signs Up Without Referral Code

**Step 1:** User completes signup form without entering referral code

**Step 2:** Continue with normal signup flow

**Step 3:** After signup is fully completed, optionally call `POST /api/referrals/award?shop={shopDomain}`

**Step 4:** Handle response - will return success with `creditsAwarded: false` (this is expected and normal)

---

### Scenario 4: Display Referral Dashboard

**Step 1:** User navigates to referral dashboard/statistics page

**Step 2:** Frontend calls `GET /api/referrals/stats?shop={shopDomain}`

**Step 3:** Handle response:
- If user has referral code: Display code, statistics, and sharing options
- If user doesn't have referral code: Show message about upgrading to paid plan
- If error: Show error message

**Step 4:** Display statistics:
- Total referrals made
- Completed referrals
- Pending referrals
- Total credits earned (completedReferrals × 20)

**Step 5:** Provide action buttons:
- Copy referral code
- Share referral code
- View referral history (if applicable)

---

## Integration Points

### Critical Integration Points

1. **After Subscription Approval**
   - Location: Payment success page/callback
   - Action: Call `POST /api/referrals/award`
   - Purpose: Award credits after signup confirmation

2. **During Signup Form Submission**
   - Location: Signup form validation/submission
   - Action: Call `POST /api/referrals/validate`
   - Purpose: Validate and record referral relationship

3. **Referral Dashboard Load**
   - Location: Referral dashboard/statistics page
   - Action: Call `GET /api/referrals/code` and `GET /api/referrals/stats`
   - Purpose: Display referral code and statistics

### Optional Integration Points

1. **User Dashboard Load**
   - Action: Call `GET /api/referrals/stats` to show referral summary
   - Purpose: Display referral performance at a glance

2. **After Credit Award**
   - Action: Refresh credit balance display
   - Purpose: Show updated credit balance to user

---

## Error Handling Guidelines

### Client-Side Error Handling

1. **Network Errors**
   - Show user-friendly error message
   - Provide retry option
   - Log error for debugging

2. **400 Bad Request Errors**
   - Display specific error message from API
   - Allow user to correct input
   - Do not block user flow unnecessarily

3. **403 Forbidden Errors**
   - Show message about plan requirements
   - Provide upgrade/payment link if applicable
   - Explain why feature is not available

4. **500 Internal Server Error**
   - Show generic error message to user
   - Log detailed error for debugging
   - Provide support contact if persistent

### Best Practices

- Always include `requestId` in error logs for support
- Do not block critical user flows (like signup) for referral errors
- Provide clear, actionable error messages
- Log all errors for debugging and monitoring
- Consider implementing retry logic for transient errors

---

## Business Rules Summary

1. **Paid Plan Requirement**: Only users on paid plans (starter, growth, pro - monthly or annual) can generate referral codes. Free plan users cannot.

2. **One Code Per User**: Each paid user gets exactly one referral code. If they already have a code, the same code is returned.

3. **One Referral Per New User**: Each new user can only be referred once. If a shop has already been referred, subsequent referral code validations will fail.

4. **No Self-Referrals**: Users cannot refer themselves. The system prevents this at the database level.

5. **Post-Signup Credits**: Credits are only awarded after signup is successfully completed. This prevents abuse and ensures the referred user is a legitimate new signup.

6. **Idempotent Award**: The award endpoint is idempotent - calling it multiple times won't award credits multiple times. The system tracks whether credits have already been awarded.

7. **Credit Type**: All referral credits are awarded as coupon credits (promotional credits), which are deducted after plan credits but before purchased credits.

---

## Testing Recommendations

### Test Scenarios

1. **Paid User Gets Referral Code**
   - Test with paid plan user
   - Verify code is returned
   - Test with free plan user (should get 403)

2. **Referral Code Validation**
   - Test with valid referral code
   - Test with invalid referral code
   - Test with self-referral attempt
   - Test with already-referred shop

3. **Credit Award Flow**
   - Test after successful signup
   - Test with no referral (should return success with creditsAwarded: false)
   - Test idempotency (call multiple times)
   - Verify credits are added to both accounts

4. **Statistics Display**
   - Test with user who has referral code
   - Test with user who doesn't have referral code
   - Verify statistics are accurate

### Edge Cases

- User upgrades to paid plan after signup (should be able to get referral code)
- User downgrades from paid plan (existing referral code remains but may become inactive)
- Multiple signup attempts with same referral code
- Network failures during credit award
- Concurrent credit award requests

---

## Request/Response Format

### Standard Response Format

All successful responses follow this format:
```json
{
  "success": true,
  "data": { ... },
  "requestId": "req-1234567890-abc123"
}
```

### Standard Error Format

All error responses follow this format:
```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "requestId": "req-1234567890-abc123"
}
```

### Request ID

Every response includes a `requestId` field. This should be:
- Logged for debugging
- Included in support requests
- Used for error tracking
- Used for request correlation

---

## Support and Troubleshooting

### Common Issues

1. **Referral Code Not Generated**
   - Check if user is on paid plan
   - Verify shop domain is correct
   - Check server logs for errors

2. **Credits Not Awarded**
   - Verify signup was fully completed
   - Check if referral validation was successful
   - Review server logs for award endpoint errors
   - Verify credits were not already awarded (idempotent check)

3. **Invalid Referral Code Error**
   - Verify code format (8 characters, alphanumeric)
   - Check if code is active
   - Verify code hasn't been deactivated

4. **Statistics Not Showing**
   - Verify user has referral code
   - Check if user is on paid plan
   - Review server logs for errors

### Getting Help

- Check error response `message` and `requestId`
- Review server logs for detailed error information
- Contact support with `requestId` for investigation
- Verify database migration was completed successfully

---

## Summary

The referral system provides four main API endpoints:

1. **GET /api/referrals/code** - Get or create referral code for paid users
2. **POST /api/referrals/validate** - Validate referral code during signup
3. **POST /api/referrals/award** - Award credits after successful signup
4. **GET /api/referrals/stats** - Get referral statistics

Integration should follow the workflow patterns outlined above, with proper error handling and user feedback. The system is designed to be non-blocking - referral errors should not prevent signup or other critical user flows.

