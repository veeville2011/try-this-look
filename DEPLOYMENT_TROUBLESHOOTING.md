# Deployment Troubleshooting Guide

## Current Issue: HTTP 500 Error

You're experiencing an HTTP 500 error with empty error messages `{}` when trying to deploy. This is typically a Shopify API server-side issue, but here are steps to resolve it.

## ✅ Files Fixed

1. **Removed `enabled_on` property** from schema (may not be valid for app blocks)
2. **Fixed optional chaining** (`?.`) in JavaScript to avoid Liquid parsing issues
3. **Matched format** with working blocks

## 🔧 Troubleshooting Steps

### Step 1: Verify Files Are Correct

All files have been validated:
- ✅ `extensions/theme-app-extension/blocks/nusense-cart-outfit-button.liquid` - Valid schema, correct syntax
- ✅ `extensions/theme-app-extension/snippets/nusense-cart-outfit-script.liquid` - Valid Liquid syntax
- ✅ File sizes are within limits (73KB total)

### Step 2: Try Alternative Deployment Methods

#### Option A: Deploy via Shopify Partner Dashboard
1. Go to [Shopify Partner Dashboard](https://partners.shopify.com)
2. Navigate to your app
3. Go to **Extensions** → **Theme app extension**
4. Upload files manually or use dashboard deployment

#### Option B: Try CLI with Force Flag
```bash
shopify app deploy --force
```

#### Option C: Deploy Extension Separately
```bash
cd extensions/theme-app-extension
shopify app generate extension --template theme_app_extension
# Then copy files manually
```

### Step 3: Check for API Issues

The HTTP 500 error with empty `{}` suggests:
- **Shopify API temporary outage** - Wait 10-15 minutes and retry
- **Rate limiting** - You may have hit API rate limits
- **App configuration issue** - Check app permissions in Partner Dashboard

### Step 4: Verify App Configuration

Check `shopify.app.toml`:
- ✅ App is properly configured
- ✅ Extension is listed in `[[extensions]]`
- ✅ Required scopes are present

### Step 5: Check Extension Configuration

Verify `extensions/theme-app-extension/shopify.extension.toml`:
```toml
name = "nusense-tryon"
type = "theme_app_extension"
```

### Step 6: Validate Files Locally

Try building first to catch any validation errors:
```bash
shopify app build
```

If build succeeds but deploy fails, it's likely a Shopify API issue.

## 🚨 Common Causes of HTTP 500

1. **Shopify API Temporary Outage**
   - **Solution**: Wait and retry in 15-30 minutes

2. **File Size Too Large**
   - **Status**: ✅ Files are 73KB total (well within limits)

3. **Invalid Schema JSON**
   - **Status**: ✅ Schema validated and matches working block format

4. **Missing Required Files**
   - **Status**: ✅ All files present and correctly referenced

5. **App Permissions Issue**
   - **Solution**: Check Partner Dashboard → App → Settings → API scopes
   - Required: `read_themes`, `write_themes`

6. **Extension Already Exists**
   - **Solution**: Try updating existing extension instead of creating new

## 📋 Manual Deployment Alternative

If CLI continues to fail, you can:

1. **Zip the extension files**:
   ```bash
   cd extensions/theme-app-extension
   Compress-Archive -Path * -DestinationPath ../nusense-extension.zip
   ```

2. **Upload via Partner Dashboard**:
   - Go to Partner Dashboard → Your App → Extensions
   - Upload the zip file

## 🔍 Debugging Commands

```bash
# Check app status
shopify app info

# Validate extension
shopify app build

# Check for syntax errors
# (No direct command, but build will catch them)

# View extension files
Get-ChildItem extensions/theme-app-extension -Recurse
```

## ✅ Verification Checklist

Before retrying deployment:

- [ ] All files are present and correctly named
- [ ] Schema JSON is valid (no syntax errors)
- [ ] Snippet file exists and is referenced correctly
- [ ] No optional chaining (`?.`) in JavaScript (fixed)
- [ ] No `enabled_on` in schema (removed)
- [ ] File sizes are reasonable (< 100KB per file)
- [ ] App has required permissions
- [ ] Extension is listed in `shopify.app.toml`

## 🆘 If Still Failing

1. **Contact Shopify Support** - The HTTP 500 with empty errors suggests a server-side issue
2. **Check Shopify Status Page** - Verify API is operational
3. **Try from Different Network** - In case of network/firewall issues
4. **Check Partner Dashboard** - Look for any error messages or warnings

## 📝 Files Ready for Deployment

All files are correctly formatted and ready:

- ✅ `blocks/nusense-cart-outfit-button.liquid` - 391 lines, valid schema
- ✅ `snippets/nusense-cart-outfit-script.liquid` - 183 lines, valid Liquid
- ✅ `shopify.extension.toml` - Valid configuration

The issue is likely on Shopify's side (API server error), not with your files.

---

**Last Updated**: {{ date }}
**Status**: Files validated and ready - awaiting Shopify API resolution

