# Shopify App Store Listing Requirements Checklist

This document outlines all the configurations you need to complete in the **Shopify Partners Dashboard** for app submission and listing.

---

## 📋 Required Configurations in Partners Dashboard

### 1. App Basic Information ✅

**Location:** Partners Dashboard → Your App → **App setup** → **Basic information**

#### 1.1 App Name
- ✅ **Unique name** (not generic)
- ✅ **No "Shopify" word** or misspellings
- ✅ **30 characters or less**
- ✅ **Current:** `nusense-tryon` (verify this meets requirements)

#### 1.2 App Icon
- ✅ **Size:** 1200 x 1200 pixels
- ✅ **Format:** JPEG or PNG
- ✅ **No text in icon** (icon only)
- ✅ **High quality, professional design**

#### 1.3 App Description
- ✅ **Clear and concise** description
- ✅ **Features and benefits** listed
- ✅ **No references to other apps**
- ✅ **Professional language**

---

### 2. App Listing Content ✅

**Location:** Partners Dashboard → Your App → **App listing**

#### 2.1 Feature Media
- ✅ **Feature image or video** in listing header
- ✅ **Shows app functionality** clearly
- ✅ **High quality** (recommended: 1200x800px for images)
- ✅ **Demonstrates key features**

#### 2.2 Screenshots
- ✅ **Minimum 3-5 screenshots**
- ✅ **High quality** (at least 1200px width)
- ✅ **Show different features** of your app
- ✅ **No sensitive information** (passwords, API keys, etc.)
- ✅ **Clear UI demonstration**

#### 2.3 App Description (Long Form)
- ✅ **Detailed description** of features
- ✅ **Use cases** and benefits
- ✅ **Setup instructions** (if applicable)
- ✅ **No misleading claims**

---

### 3. Pricing Configuration ✅ **CRITICAL**

**Location:** Partners Dashboard → Your App → **App setup** → **Pricing**

#### 3.1 Create Pricing Plans

You **MUST** create these plans in Partners Dashboard with **exact handles**:

**Plan 1: Free Plan**
- **Plan Handle:** `free` (exact match required)
- **Plan Name:** "Plan Gratuit" or "Free Plan"
- **Price:** €0.00 (or $0.00)
- **Billing Interval:** Every 30 days (or N/A if free doesn't require interval)
- **Description:** "Parfait pour tester notre technologie"
- **Features:**
  - Essayage virtuel par IA
  - Widget intégré facilement

**Plan 2: Pro Monthly**
- **Plan Handle:** `pro` (exact match required)
- **Plan Name:** "Plan Pro (Mensuel)" or "Pro Plan (Monthly)"
- **Price:** €20.00 (or $20.00)
- **Billing Interval:** Every 30 days
- **Currency:** EUR (or USD)
- **Description:** "Solution complète pour booster vos ventes"

**Plan 3: Pro Annual**
- **Plan Handle:** `pro-annual` (exact match required)
- **Plan Name:** "Plan Pro (Annuel)" or "Pro Plan (Annual)"
- **Price:** €180.00 (or $180.00)
- **Billing Interval:** Annual
- **Currency:** EUR (or USD)
- **Description:** "Solution complète avec économie de 25%"

#### 3.2 Important Notes:
- ⚠️ **Plan handles MUST match exactly** what's in your code (`server/utils/billing.js`)
- ⚠️ **Prices should match** your code (currently EUR: 20, 180)
- ⚠️ **Test mode:** Enable test mode for development
- ⚠️ **Production mode:** Switch to production before submission

---

### 4. Access Scopes Configuration ✅

**Location:** Partners Dashboard → Your App → **App setup** → **App access scopes**

#### 4.1 Required Scopes
Verify these scopes are configured:
- ✅ `read_products`
- ✅ `read_themes`
- ✅ `write_products`
- ✅ `write_themes`
- ✅ `applications_billing` **← CRITICAL for billing**

#### 4.2 Verification
- ✅ Check that `applications_billing` is listed
- ✅ All scopes match `shopify.app.toml` configuration
- ✅ No unnecessary scopes requested

---

### 5. Privacy & Compliance ✅

**Location:** Partners Dashboard → Your App → **App setup** → **Privacy & compliance**

#### 5.1 Privacy Policy
- ✅ **Valid URL** to privacy policy page
- ✅ **Accessible** (not behind login)
- ✅ **Comprehensive** (covers data collection, usage, storage)
- ✅ **GDPR compliant** (if targeting EU merchants)

#### 5.2 Data Handling
- ✅ **Customer data request** webhook configured
- ✅ **Customer redact** webhook configured
- ✅ **Shop redact** webhook configured
- ✅ **Data deletion** process documented

---

### 6. Support & Contact Information ✅

**Location:** Partners Dashboard → Your App → **App setup** → **Support**

#### 6.1 Support Email
- ✅ **Support email address** provided
- ✅ **Monitored regularly**
- ✅ **Response time** reasonable (24-48 hours)

#### 6.2 Emergency Contact
- ✅ **Emergency developer email** provided
- ✅ **Emergency phone number** (if required)
- ✅ **Available for critical issues**

#### 6.3 Support Resources
- ✅ **Setup instructions** provided
- ✅ **Documentation** available
- ✅ **FAQ or help center** (if applicable)

---

### 7. App Distribution Settings ✅

**Location:** Partners Dashboard → Your App → **App setup** → **Distribution**

#### 7.1 App Store Listing
- ✅ **App visibility** set to "Public" (for App Store)
- ✅ **Categories** selected appropriately
- ✅ **Tags/keywords** added for discoverability

#### 7.2 Test Stores
- ✅ **Development store** configured
- ✅ **Test store** for review process
- ✅ **Store URL** provided in submission

---

### 8. Webhooks Configuration ✅

**Location:** Partners Dashboard → Your App → **App setup** → **Webhooks**

#### 8.1 Required Webhooks
Verify these webhooks are registered:
- ✅ `app/uninstalled` → `/webhooks/app/uninstalled`
- ✅ `app/subscriptions/update` → `/webhooks/app/subscriptions/update`
- ✅ `customers/data_request` → `/webhooks/customers/data_request`
- ✅ `customers/redact` → `/webhooks/customers/redact`
- ✅ `shop/redact` → `/webhooks/shop/redact`

#### 8.2 Verification
- ✅ All webhook URIs match your `shopify.app.toml`
- ✅ Webhooks are **active** and **verified**
- ✅ Test webhook delivery works

---

### 9. API Configuration ✅

**Location:** Partners Dashboard → Your App → **API credentials**

#### 9.1 API Credentials
- ✅ **Client ID** matches `shopify.app.toml`
- ✅ **Client Secret** stored securely (not in code)
- ✅ **API version** set to latest (2024-01 or newer)

#### 9.2 Redirect URLs
- ✅ **OAuth redirect URLs** configured:
  - `https://try-this-look.vercel.app/auth/callback`
  - `https://try-this-look.vercel.app/auth/shopify/callback`
  - `https://try-this-look.vercel.app/api/auth/callback`
- ✅ **All URLs match** `shopify.app.toml`

---

### 10. App Review Submission ✅

**Location:** Partners Dashboard → Your App → **App review**

#### 10.1 Pre-Submission Checklist
- ✅ **App tested** thoroughly on development store
- ✅ **All features working** correctly
- ✅ **No console errors** in production build
- ✅ **Billing flow tested** end-to-end
- ✅ **Webhooks tested** and working
- ✅ **Privacy policy** accessible
- ✅ **Support contact** information provided

#### 10.2 Submission Requirements
- ✅ **App description** complete
- ✅ **Screenshots** uploaded (3-5 minimum)
- ✅ **Feature media** uploaded
- ✅ **Test store** URL provided
- ✅ **Test credentials** provided (if required)
- ✅ **Setup instructions** documented

#### 10.3 Review Notes
- ✅ **Clear instructions** for reviewers
- ✅ **Test account** credentials (if needed)
- ✅ **Special setup** requirements noted
- ✅ **Known limitations** disclosed

---

## 🚨 Critical Items for Your App

### Must Complete Before Submission:

1. **Pricing Plans** ⚠️ **CRITICAL**
   - Create `free`, `pro`, and `pro-annual` plans in Partners Dashboard
   - Plan handles MUST match code exactly
   - Prices should match (EUR: 0, 20, 180)

2. **Privacy Policy** ⚠️ **REQUIRED**
   - Create and host privacy policy page
   - Add URL to Partners Dashboard
   - Ensure GDPR compliance

3. **Support Contact** ⚠️ **REQUIRED**
   - Provide support email
   - Provide emergency contact
   - Ensure quick response time

4. **App Listing Content** ⚠️ **REQUIRED**
   - Upload app icon (1200x1200px)
   - Upload screenshots (3-5 minimum)
   - Upload feature media
   - Complete app description

5. **Webhooks** ⚠️ **REQUIRED**
   - Verify all webhooks are active
   - Test webhook delivery
   - Ensure URIs are correct

---

## 📝 Step-by-Step Action Items

### Immediate Actions:

1. **Go to Partners Dashboard**
   - Navigate to: https://partners.shopify.com
   - Select your app: `nusense-tryon`

2. **Configure Pricing Plans**
   - App setup → Pricing
   - Create 3 plans with exact handles: `free`, `pro`, `pro-annual`
   - Set prices: €0, €20, €180
   - Set billing intervals correctly

3. **Upload App Listing Content**
   - App listing → Screenshots (upload 3-5)
   - App listing → Feature media (upload image/video)
   - App listing → App icon (upload 1200x1200px)

4. **Add Privacy Policy**
   - Create privacy policy page on your website
   - App setup → Privacy & compliance
   - Add privacy policy URL

5. **Configure Support**
   - App setup → Support
   - Add support email
   - Add emergency contact

6. **Verify Webhooks**
   - App setup → Webhooks
   - Verify all 5 webhooks are active
   - Test webhook delivery

7. **Test Everything**
   - Install app on test store
   - Test subscription flow
   - Test all features
   - Verify no errors

8. **Submit for Review**
   - App review → Submit for review
   - Fill out all required fields
   - Provide test store URL
   - Add review notes

---

## ✅ Final Checklist Before Submission

- [ ] All pricing plans created in Partners Dashboard
- [ ] Plan handles match code exactly (`free`, `pro`, `pro-annual`)
- [ ] App icon uploaded (1200x1200px)
- [ ] Screenshots uploaded (3-5 minimum)
- [ ] Feature media uploaded
- [ ] App description complete
- [ ] Privacy policy URL added
- [ ] Support email provided
- [ ] Emergency contact provided
- [ ] All webhooks active and tested
- [ ] Access scopes verified
- [ ] OAuth redirect URLs configured
- [ ] App tested on development store
- [ ] Billing flow tested end-to-end
- [ ] No console errors in production
- [ ] All features working correctly

---

## 📚 Additional Resources

- [Shopify App Store Requirements](https://shopify.dev/docs/apps/store/requirements)
- [App Review Guidelines](https://shopify.dev/docs/apps/store/review)
- [Billing API Documentation](https://shopify.dev/docs/apps/launch/billing)
- [Partners Dashboard](https://partners.shopify.com)

---

## 🎯 Current Status

Based on your code configuration:

✅ **Code is ready** - All technical requirements met
⚠️ **Partners Dashboard** - Needs configuration (pricing plans, listing content, privacy policy)
⚠️ **Privacy Policy** - Needs to be created and hosted
⚠️ **App Listing** - Needs screenshots, icon, feature media

**Next Step:** Complete Partners Dashboard configuration, then submit for review.

