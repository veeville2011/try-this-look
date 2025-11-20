# Testing Subscription Flow on Development Store

Complete guide for testing subscription and billing functionality on a Shopify development store.

---

## 🎯 Prerequisites

1. **Development Store** - Create one at [Shopify Partners Dashboard](https://partners.shopify.com)
2. **App Installed** - Your app must be installed on the development store
3. **Test Mode Enabled** - Billing should be in test mode for development

---

## 📋 Step-by-Step Testing Guide

### Step 1: Set Up Development Store

1. **Create Development Store**
   - Go to [Shopify Partners Dashboard](https://partners.shopify.com)
   - Navigate to **Stores** → **Add store** → **Development store**
   - Choose **Development store** type
   - Fill in store details and create

2. **Note Your Store URL**
   - Example: `your-dev-store.myshopify.com`
   - Update `dev_store_url` in `shopify.app.toml` if needed

---

### Step 2: Install App on Development Store

#### Option A: Using Shopify CLI (Recommended)

```bash
# Make sure you're in the project directory
cd try-this-look

# Start development server
npm run dev

# Or use Shopify CLI
shopify app dev
```

The CLI will:
- Create a tunnel (if needed)
- Open your development store
- Install the app automatically

#### Option B: Manual Installation

1. **Get Installation URL**
   - Your app URL: `https://try-this-look.vercel.app`
   - Installation URL: `https://try-this-look.vercel.app/auth?shop=your-dev-store.myshopify.com`

2. **Install App**
   - Open the installation URL in browser
   - Approve the OAuth request
   - App will be installed on your development store

---

### Step 3: Access the App

1. **From Shopify Admin**
   - Go to your development store admin
   - Navigate to **Apps** → **Your App Name**
   - Or use direct URL: `https://admin.shopify.com/store/your-dev-store/apps/your-app-id`

2. **Direct URL** (if embedded)
   - `https://try-this-look.vercel.app/?shop=your-dev-store.myshopify.com&host=base64-encoded-host`

---

### Step 4: Test Subscription Flow

#### 4.1 Test Free Plan

1. **Navigate to Pricing Section**
   - You should see the pricing section on the "/" route
   - Free plan should show "0 €/mois"

2. **Select Free Plan**
   - Click "Get Started" on Free plan
   - Should activate immediately (no Shopify confirmation)
   - Should see success toast: "Free plan activated!"
   - Page should refresh and show "Current Plan" badge

3. **Verify Free Plan**
   - Check that "Current Plan" badge appears on Free plan card
   - SubscriptionManagement component should NOT appear (only for paid plans)

#### 4.2 Test Pro Monthly Plan

1. **Select Pro Monthly Plan**
   - Click "Select Plan" on Pro Monthly (€20/mois)
   - Should redirect to Shopify confirmation page
   - **In Test Mode:** You'll see a test billing page

2. **Approve Subscription (Test Mode)**
   - On Shopify's confirmation page, click "Approve"
   - **Note:** In test mode, no actual charge occurs
   - You'll be redirected back to your app

3. **Verify Subscription**
   - Should see success message
   - SubscriptionManagement component should appear
   - "Current Plan" badge should show on Pro Monthly card
   - Should see subscription details:
     - Plan name: "Plan Pro (Mensuel)"
     - Price: "20 €/mois"
     - Next billing date
     - Status: "Active"

#### 4.3 Test Pro Annual Plan

1. **Select Pro Annual Plan**
   - Click "Select Plan" on Pro Annual (€15/mois, billed €180/an)
   - Should redirect to Shopify confirmation page

2. **Approve Subscription**
   - Approve on Shopify's page
   - Redirected back to app

3. **Verify Annual Subscription**
   - SubscriptionManagement should show:
     - Price: "15 €/mois" (monthly equivalent)
     - Note: "Facturé 180 €/an"
     - Next billing date (should be 1 year from now)
   - "Current Plan" badge on Pro Annual card

#### 4.4 Test Plan Change (Upgrade/Downgrade)

1. **From SubscriptionManagement Component**
   - If on Pro Monthly, should see "Switch to Annual (Save 25%)" button
   - If on Pro Annual, should see "Switch to Monthly" button
   - Click the switch button
   - Should redirect to Shopify confirmation for new plan

2. **From Pricing Cards**
   - If subscribed to one plan, other plans should show "Upgrade" or "Downgrade"
   - Click to change plan
   - Should redirect to Shopify confirmation

3. **Verify Plan Change**
   - After approval, subscription should update
   - SubscriptionManagement should reflect new plan
   - Pricing cards should show correct "Current Plan" badge

#### 4.5 Test Subscription Cancellation

1. **Cancel Subscription**
   - In SubscriptionManagement component
   - Click "Cancel Subscription" button
   - Confirm in the dialog

2. **Verify Cancellation**
   - Should see success message
   - SubscriptionManagement component should disappear
   - Should revert to Free plan
   - "Current Plan" badge should show on Free plan

---

### Step 5: Test Edge Cases

#### 5.1 Test Declined Subscription

1. **Decline on Shopify Page**
   - When redirected to Shopify confirmation
   - Click "Decline" or close the page
   - Should return to app with error message

2. **Verify Error Handling**
   - Should see error toast
   - No subscription should be created
   - Pricing cards should remain unchanged

#### 5.2 Test Pending Subscription

1. **Check Pending Status**
   - If subscription is pending approval
   - SubscriptionManagement should show "Pending" badge
   - Should not have full access yet

#### 5.3 Test Multiple Plan Selections

1. **Rapid Clicks**
   - Try clicking multiple plans quickly
   - Should prevent duplicate subscriptions
   - Loading states should work correctly

---

### Step 6: Verify Backend Functionality

#### 6.1 Check API Endpoints

Test these endpoints directly (use browser DevTools Network tab):

1. **Get Plans**
   ```
   GET /api/billing/plans
   ```
   - Should return all 3 plans
   - Should include features, prices, intervals

2. **Get Subscription Status**
   ```
   GET /api/billing/subscription?shop=your-dev-store.myshopify.com
   ```
   - Should return current subscription
   - Should include plan details
   - Should show `hasActiveSubscription: true/false`

3. **Create Subscription** (via UI, not direct API)
   - Should create subscription via Shopify
   - Should return `confirmationUrl`

#### 6.2 Check Webhooks

1. **Verify Webhook Delivery**
   - Go to Partners Dashboard → Your App → Webhooks
   - Check webhook delivery logs
   - `app/subscriptions/update` should fire after subscription changes

2. **Test Webhook Endpoint**
   - Check server logs for webhook events
   - Should see logs when subscription status changes

---

## 🔍 What to Check

### Frontend Checks ✅

- [ ] Pricing section loads correctly
- [ ] All 3 plans display with correct prices (EUR)
- [ ] "Le plus populaire" badge on Pro Annual
- [ ] "Current Plan" badge shows on active plan
- [ ] Free plan activates immediately
- [ ] Paid plans redirect to Shopify confirmation
- [ ] After approval, subscription details appear
- [ ] SubscriptionManagement component shows for paid plans
- [ ] Plan change buttons work
- [ ] Cancel subscription works
- [ ] Upgrade/Downgrade buttons show correctly
- [ ] Loading states work
- [ ] Error messages display properly
- [ ] Auto-refresh after subscription approval

### Backend Checks ✅

- [ ] API endpoints return correct data
- [ ] Subscription creation works
- [ ] Subscription checking works
- [ ] Plan changes work
- [ ] Cancellation works
- [ ] Webhooks receive events
- [ ] Session tokens work (if using App Bridge)
- [ ] Error handling works

### Shopify Integration Checks ✅

- [ ] OAuth flow works
- [ ] App installs correctly
- [ ] Billing API calls succeed
- [ ] Confirmation URLs work
- [ ] Redirect after approval works
- [ ] Subscription status syncs correctly

---

## 🐛 Common Issues & Solutions

### Issue 1: "Shop parameter is required"

**Solution:**
- Make sure you're accessing app with `?shop=your-dev-store.myshopify.com` parameter
- Or ensure App Bridge is providing shop parameter

### Issue 2: "Session not found"

**Solution:**
- Reinstall the app on development store
- Clear browser cache
- Check OAuth callback URL is correct

### Issue 3: Subscription not showing after approval

**Solution:**
- Wait a few seconds for webhook to fire
- Refresh the page
- Check webhook delivery in Partners Dashboard
- Verify subscription in Shopify admin → Apps → Your App → Billing

### Issue 4: "Plan handle not found"

**Solution:**
- Verify plan handles in code match Partners Dashboard
- Check `server/utils/billing.js` for exact handles:
  - `free`
  - `pro`
  - `pro-annual`

### Issue 5: Billing not working in test mode

**Solution:**
- Ensure test mode is enabled in Partners Dashboard
- Check that pricing plans are created in Partners Dashboard
- Verify `applications_billing` scope is included

---

## 📝 Testing Checklist

### Basic Flow ✅
- [ ] Install app on development store
- [ ] Access pricing page
- [ ] View all plans
- [ ] Select Free plan → Verify activation
- [ ] Select Pro Monthly → Approve → Verify subscription
- [ ] Select Pro Annual → Approve → Verify subscription
- [ ] Change plan (upgrade/downgrade) → Verify change
- [ ] Cancel subscription → Verify cancellation

### Error Handling ✅
- [ ] Decline subscription → Verify error message
- [ ] Test with invalid shop parameter → Verify error
- [ ] Test network errors → Verify graceful handling

### UI/UX ✅
- [ ] Loading states work
- [ ] Success messages appear
- [ ] Error messages appear
- [ ] Badges display correctly
- [ ] SubscriptionManagement component shows/hides correctly
- [ ] Responsive design works

### Backend ✅
- [ ] API endpoints work
- [ ] Webhooks receive events
- [ ] Subscription status syncs
- [ ] Plan changes work
- [ ] Cancellation works

---

## 🚀 Quick Test Commands

### Start Development Server

```bash
# Option 1: Using npm
npm run dev

# Option 2: Using Shopify CLI
shopify app dev
```

### Check Subscription Status (via API)

```bash
# Replace with your dev store URL
curl "https://try-this-look.vercel.app/api/billing/subscription?shop=your-dev-store.myshopify.com"
```

### View Webhook Logs

1. Go to Partners Dashboard
2. Your App → Webhooks
3. Click on each webhook to see delivery logs

---

## 📊 Expected Results

### Free Plan
- ✅ Activates immediately
- ✅ No Shopify confirmation needed
- ✅ "Current Plan" badge appears
- ✅ SubscriptionManagement component does NOT appear

### Pro Monthly (€20/mois)
- ✅ Redirects to Shopify confirmation
- ✅ After approval, subscription active
- ✅ Shows "20 €/mois" in SubscriptionManagement
- ✅ Next billing date shows (30 days from now)
- ✅ Status: "Active"

### Pro Annual (€180/an)
- ✅ Redirects to Shopify confirmation
- ✅ After approval, subscription active
- ✅ Shows "15 €/mois" (monthly equivalent)
- ✅ Shows "Facturé 180 €/an"
- ✅ Next billing date shows (1 year from now)
- ✅ Status: "Active"

---

## 🎯 Success Criteria

Your subscription flow is working correctly if:

1. ✅ All plans display correctly
2. ✅ Free plan activates immediately
3. ✅ Paid plans redirect to Shopify confirmation
4. ✅ After approval, subscription details appear
5. ✅ Plan changes work
6. ✅ Cancellation works
7. ✅ Webhooks receive events
8. ✅ No console errors
9. ✅ All UI elements work correctly

---

## 📚 Additional Resources

- [Shopify Billing API Docs](https://shopify.dev/docs/apps/launch/billing)
- [Development Store Guide](https://shopify.dev/docs/apps/tools/development-stores)
- [Testing Apps](https://shopify.dev/docs/apps/tools/testing)

---

**Happy Testing! 🎉**

