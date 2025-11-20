# Pricing Configuration Manual Steps

This document provides step-by-step instructions for manually configuring the pricing plans in the Shopify Partners Dashboard and other required setup steps.

---

## Prerequisites

- Access to Shopify Partners Dashboard
- App created in Partners Dashboard
- App ID and API credentials
- Development store for testing

---

## Step 1: Configure Access Scopes

### 1.1 Verify Access Scopes in shopify.app.toml

**File:** `shopify.app.toml`

Ensure the following scope is included:

```toml
[access_scopes]
scopes = "read_products,read_themes,write_products,write_themes,applications_billing"
```

**Important:** The `applications_billing` scope is required for all billing operations.

### 1.2 Update App in Partners Dashboard

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com)
2. Navigate to **Apps** → Select your app
3. Go to **App setup** → **App access scopes**
4. Verify that `applications_billing` is listed
5. If not present, add it and save

---

## Step 2: Create Plan Handles in Partners Dashboard

### 2.1 Navigate to Pricing Section

1. In Partners Dashboard, go to your app
2. Navigate to **App setup** → **Pricing**
3. Click **Add pricing plan** or **Manage pricing plans**

### 2.2 Create Free Plan

**Plan Configuration:**
- **Plan Handle:** `free`
- **Plan Name:** Free Plan
- **Price:** $0.00
- **Billing Interval:** Every 30 days (or N/A if free plans don't require interval)
- **Description:** Free plan with basic features
- **Features:**
  - 10 try-ons per month
  - Standard processing
  - Basic widget
  - Community support

**Notes:**
- Free plans may not require billing setup in some cases
- Verify if Shopify requires a $0 subscription or if free is handled differently

### 2.3 Create Pro Monthly Plan

**Plan Configuration:**
- **Plan Handle:** `pro`
- **Plan Name:** Pro Plan (Monthly)
- **Price:** $20.00
- **Currency:** USD
- **Billing Interval:** Every 30 days
- **Description:** For serious e-commerce stores
- **Features:**
  - Unlimited try-ons
  - Priority processing
  - Customizable widget
  - API access
  - Custom branding
  - Priority support
  - Advanced analytics

**Steps:**
1. Click **Add pricing plan**
2. Enter plan handle: `pro`
3. Set price: $20.00
4. Select billing interval: Every 30 days
5. Add description and features
6. Save the plan

### 2.4 Create Pro Annual Plan

**Plan Configuration:**
- **Plan Handle:** `pro_annual`
- **Plan Name:** Pro Plan (Annual)
- **Price:** $180.00
- **Currency:** USD
- **Billing Interval:** Every 365 days (Annual)
- **Description:** For serious e-commerce stores - Save 25% with annual billing
- **Features:**
  - Unlimited try-ons
  - Priority processing
  - Customizable widget
  - API access
  - Custom branding
  - Priority support
  - Advanced analytics
  - Save 25% compared to monthly billing

**Steps:**
1. Click **Add pricing plan**
2. Enter plan handle: `pro_annual`
3. Set price: $180.00
4. Select billing interval: Every 365 days (Annual)
5. Add description and features
6. Save the plan

**Important:** 
- Plan handles must match exactly: `free`, `pro`, `pro_annual`
- Prices must match: $0, $20.00, $180.00
- Intervals must match: `EVERY_30_DAYS` for monthly, `ANNUAL` for annual

---

## Step 3: Configure Webhooks

### 3.1 Verify Webhook in shopify.app.toml

**File:** `shopify.app.toml`

Ensure the webhook is configured:

```toml
[[webhooks.subscriptions]]
topics = [ "app/subscriptions/update" ]
uri = "/webhooks/app/subscriptions/update"
```

### 3.2 Verify Webhook Registration

1. In Partners Dashboard, go to your app
2. Navigate to **App setup** → **Webhooks**
3. Verify that `app/subscriptions/update` webhook is listed
4. Verify the endpoint URL matches your deployment:
   - Development: `https://your-ngrok-url.ngrok.io/webhooks/app/subscriptions/update`
   - Production: `https://try-this-look.vercel.app/webhooks/app/subscriptions/update`

### 3.3 Test Webhook Delivery

1. Use Shopify CLI to test webhook:
   ```bash
   shopify app webhook trigger --topic app/subscriptions/update
   ```
2. Verify webhook is received in your server logs
3. Check that webhook signature verification passes

---

## Step 4: Test Environment Setup

### 4.1 Create Test Store

1. In Partners Dashboard, go to **Stores** → **Add store**
2. Create a development store
3. Note the store URL (e.g., `your-test-store.myshopify.com`)

### 4.2 Install App in Test Store

1. Go to your test store admin
2. Navigate to **Apps** → **App and sales channel settings**
3. Click **Develop apps** → Select your app
4. Click **Install app**
5. Complete OAuth flow

### 4.3 Test Subscription Creation

1. Access your app in the test store
2. Navigate to pricing page: `/pricing?shop=your-test-store.myshopify.com`
3. Click "Select Plan" for Pro Monthly
4. Verify redirect to Shopify confirmation page
5. Approve the subscription
6. Verify redirect back to your app
7. Check subscription status via API

---

## Step 5: Production Configuration

### 5.1 Update Production URLs

**File:** `shopify.app.toml` (production version)

Ensure production URLs are correct:
- `application_url`: Your production URL
- Webhook URIs: Production endpoints
- Redirect URLs: Production callback URLs

### 5.2 Deploy Code Changes

1. Commit all code changes
2. Deploy backend to production (Vercel/server)
3. Deploy frontend to production
4. Verify all endpoints are accessible

### 5.3 Verify Production Plans

1. In Partners Dashboard, verify production plans are configured
2. Test subscription creation in production
3. Monitor logs for any errors
4. Verify webhook delivery in production

---

## Step 6: Verification Checklist

### 6.1 Plan Configuration Verification

- [ ] All three plan handles exist: `free`, `pro`, `pro_annual`
- [ ] Prices match: $0, $20.00, $180.00
- [ ] Intervals match: Every 30 days, Every 365 days
- [ ] Plan handles match exactly (case-sensitive)
- [ ] Descriptions and features are set

### 6.2 API Verification

- [ ] `GET /api/billing/plans` returns all plans
- [ ] `GET /api/billing/subscription?shop=xxx` works
- [ ] `POST /api/billing/subscribe` creates subscriptions
- [ ] `POST /api/billing/cancel` cancels subscriptions
- [ ] `POST /api/billing/change-plan` changes plans

### 6.3 Webhook Verification

- [ ] Webhook registered in Partners Dashboard
- [ ] Webhook endpoint is accessible
- [ ] Webhook signature verification works
- [ ] Webhook receives subscription updates
- [ ] Webhook logs are working

### 6.4 Frontend Verification

- [ ] Pricing page loads correctly
- [ ] Plans display with correct pricing
- [ ] "Select Plan" buttons work
- [ ] Subscription management component works
- [ ] Cancel subscription flow works
- [ ] Plan change flow works

---

## Step 7: Common Issues & Troubleshooting

### Issue 1: Plan Handle Mismatch

**Symptom:** Subscription creation fails with "Invalid plan handle"

**Solution:**
1. Verify plan handles in Partners Dashboard match exactly
2. Check `server/utils/billing.js` - `PLAN_HANDLES` must match
3. Ensure case sensitivity matches (lowercase)

### Issue 2: Webhook Not Receiving Updates

**Symptom:** Webhook endpoint not called when subscription changes

**Solution:**
1. Verify webhook is registered in `shopify.app.toml`
2. Check webhook endpoint is publicly accessible
3. Verify webhook signature verification is working
4. Check server logs for webhook delivery attempts
5. Use Shopify CLI to test webhook manually

### Issue 3: Access Scope Error

**Symptom:** "Insufficient permissions" or "applications_billing scope required"

**Solution:**
1. Verify `applications_billing` scope in `shopify.app.toml`
2. Re-authenticate the app in test store
3. Check Partners Dashboard → App setup → App access scopes

### Issue 4: Subscription Status Not Updating

**Symptom:** Subscription status shows old plan after change

**Solution:**
1. Verify `checkSubscription` function matches by price AND interval
2. Check webhook is receiving updates
3. Verify plan matching logic in `billing.js`
4. Clear any caching if implemented

### Issue 5: Annual Plan Not Recognized

**Symptom:** Annual subscription shows as monthly or free

**Solution:**
1. Verify `checkSubscription` matches by both price AND interval
2. Check that `ANNUAL` interval is correctly set in plan config
3. Verify GraphQL query returns interval in response
4. Check plan matching logic includes interval comparison

---

## Step 8: Testing Procedures

### 8.1 Test Subscription Creation

1. **Free Plan:**
   - Navigate to pricing page
   - Click "Get Started" on Free plan
   - Verify no confirmation needed
   - Verify subscription status shows Free

2. **Pro Monthly:**
   - Click "Select Plan" on Pro Monthly
   - Verify redirect to Shopify confirmation
   - Approve subscription
   - Verify redirect back to app
   - Check subscription status shows Pro Monthly

3. **Pro Annual:**
   - Click "Select Plan" on Pro Annual
   - Verify redirect to Shopify confirmation
   - Verify price shows $180/year
   - Approve subscription
   - Verify redirect back to app
   - Check subscription status shows Pro Annual

### 8.2 Test Plan Changes

1. **Monthly to Annual:**
   - From Subscription Management, click "Switch to Annual"
   - Verify redirect to confirmation
   - Approve change
   - Verify proration handling
   - Check new subscription is Annual

2. **Annual to Monthly:**
   - From Subscription Management, click "Switch to Monthly"
   - Verify redirect to confirmation
   - Approve change
   - Verify proration handling
   - Check new subscription is Monthly

### 8.3 Test Cancellation

1. **With Proration:**
   - Click "Cancel Subscription"
   - Confirm cancellation
   - Verify prorated credit issued
   - Check subscription status is CANCELLED
   - Verify access restrictions

2. **Without Proration:**
   - (If option available) Cancel without proration
   - Verify no credit issued
   - Check subscription status

### 8.4 Test Webhooks

1. **Subscription Update:**
   - Create/update/cancel subscription
   - Verify webhook is received
   - Check webhook payload
   - Verify status update in logs

2. **Error Handling:**
   - Simulate webhook with invalid signature
   - Verify 401 response
   - Check error logging

---

## Step 9: Production Deployment Checklist

### Pre-Deployment

- [ ] All code changes committed
- [ ] All tests passing
- [ ] Manual testing completed
- [ ] Plan handles created in Partners Dashboard
- [ ] Webhooks registered
- [ ] Access scopes verified

### Deployment

- [ ] Deploy backend code
- [ ] Deploy frontend code
- [ ] Verify all endpoints accessible
- [ ] Test webhook endpoint
- [ ] Monitor logs for errors

### Post-Deployment

- [ ] Test subscription creation in production
- [ ] Verify webhook delivery
- [ ] Monitor error logs
- [ ] Test plan changes
- [ ] Test cancellation
- [ ] Verify billing in Partners Dashboard

---

## Step 10: Monitoring & Maintenance

### 10.1 Key Metrics to Monitor

- Subscription creation rate
- Plan distribution (Free vs Pro)
- Upgrade/downgrade rates
- Cancellation rate
- Webhook delivery success rate
- API error rates

### 10.2 Log Monitoring

Monitor these log patterns:
- `[BILLING]` - All billing operations
- `[WEBHOOK]` - Webhook processing
- `[BILLING ERROR]` - Billing errors
- `[WEBHOOK ERROR]` - Webhook errors

### 10.3 Regular Maintenance

- Weekly: Review subscription metrics
- Monthly: Review cancellation reasons
- Quarterly: Review pricing strategy
- As needed: Update plan features/pricing

---

## Additional Resources

- [Shopify Billing Documentation](https://shopify.dev/docs/apps/launch/billing)
- [GraphQL Admin API - App Subscriptions](https://shopify.dev/docs/api/admin-graphql/latest/objects/AppSubscription)
- [Webhook Configuration Guide](https://shopify.dev/docs/apps/build/webhooks)
- [Partners Dashboard](https://partners.shopify.com)

---

## Support & Troubleshooting

If you encounter issues:

1. Check server logs for detailed error messages
2. Verify all configuration matches this guide
3. Test in development environment first
4. Contact Shopify Partner Support if needed
5. Review `pricing.md` for implementation details

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Status:** Ready for Use

