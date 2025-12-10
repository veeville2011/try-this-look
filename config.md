# NUSENSE Cart & Outfit Try-On Configuration Guide

This guide will help you configure the **Cart & Outfit Try-On** widget on your Shopify demo store.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation Steps](#installation-steps)
4. [Configuration Options](#configuration-options)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)
7. [API Endpoints](#api-endpoints)

---

## 🎯 Overview

The **Cart & Outfit Try-On** widget allows customers to:
- **Cart Mode**: Generate individual try-on images for multiple items (1-6 items) from their cart
- **Outfit Mode**: Generate a single combined outfit image showing all selected items together (2-8 items)

This widget is separate from the single-item Try-On button and is designed for cart pages and multi-item scenarios.

---

## ✅ Prerequisites

Before you begin, ensure you have:

1. ✅ **Shopify Demo Store** with admin access
2. ✅ **Online Store 2.0 Theme** (e.g., Dawn, Horizon, Craft)
3. ✅ **App Installed** - The NUSENSE app must be installed and active
4. ✅ **Products with Images** - At least 2-3 products with high-quality images in your store
5. ✅ **Cart Items** - Add some products to your cart for testing

---

## 🚀 Installation Steps

### Step 1: Deploy the Theme App Extension

1. **Navigate to your app directory** in terminal:
   ```bash
   cd /path/to/your/app
   ```

2. **Deploy the theme app extension**:
   ```bash
   shopify app deploy
   ```

3. **Select your demo store** when prompted

4. **Wait for deployment** to complete (usually 1-2 minutes)

### Step 2: Add the Button to Your Cart Page

1. **Open Shopify Admin** → **Online Store** → **Themes**

2. **Click "Customize"** on your active theme

3. **Navigate to Cart Page**:
   - In the theme editor, use the page selector at the top
   - Select **"Cart"** template

4. **Add the App Block**:
   - In the left sidebar, scroll to **"Apps"** section
   - Find **"Cart & Outfit Try-On"** (under NUSENSE app)
   - Click **"Add block"** or drag it to your desired location
   - Recommended: Place it above or below the cart items list

5. **Configure the Button** (see [Configuration Options](#configuration-options) below)

6. **Save** your changes

### Step 3: (Optional) Add Button to Product Pages

You can also add the button to product pages for customers to try multiple products:

1. **Navigate to Product Page** in theme editor
2. **Add the App Block** from Apps section
3. **Configure** as needed
4. **Save** changes

---

## ⚙️ Configuration Options

### Button Settings

| Setting | Description | Default | Options |
|---------|-------------|---------|---------|
| **Button Text** | Text displayed on the button | "Try Multiple Items" | Any custom text |
| **Button Style** | Visual style of the button | Primary | Primary, Secondary, Outline, Minimal |
| **Show Icon** | Display icon on button | Yes | Yes/No |
| **Button Icon** | Emoji or icon to display | 👕 | Any emoji or icon |
| **Default Mode** | Default generation mode | Cart | Cart (Individual Images) or Outfit (Combined Look) |
| **Full Width Button** | Make button span full width | Yes | Yes/No |
| **Auto-extract Cart Items** | Automatically extract items from cart | Yes | Yes/No |

### Mode Selection

#### Cart Mode (Individual Images)
- **Items**: 1-6 items
- **Output**: Separate image for each selected item
- **Use Case**: When customers want to see how each item looks individually
- **Example**: Customer selects 3 shirts → Gets 3 separate try-on images

#### Outfit Mode (Combined Look)
- **Items**: 2-8 items
- **Output**: Single combined outfit image
- **Use Case**: When customers want to see how items look together as a complete outfit
- **Example**: Customer selects shirt + pants + shoes → Gets 1 combined outfit image

---

## 🧪 Testing

### Test Cart Mode

1. **Add 2-4 items** to your cart
2. **Go to Cart Page**
3. **Click "Try Multiple Items"** button
4. **Verify**:
   - Modal opens correctly
   - Cart items are auto-detected (if enabled)
   - You can upload a photo
   - You can select 1-6 items
   - Generation works correctly
   - Results display as individual images

### Test Outfit Mode

1. **Add 3-5 items** to your cart
2. **Go to Cart Page**
3. **Click "Try Multiple Items"** button
4. **Switch to "Outfit Mode"** in the modal
5. **Verify**:
   - Mode switches correctly
   - You can select 2-8 items
   - Generation works correctly
   - Result displays as single combined outfit image

### Test on Product Page

1. **Go to any Product Page**
2. **Click "Try Multiple Items"** button
3. **Verify**:
   - Modal opens correctly
   - Product images are available for selection
   - You can select multiple items
   - Generation works correctly

---

## 🔧 Troubleshooting

### Button Not Appearing

**Problem**: Button doesn't show on cart page

**Solutions**:
1. ✅ Verify app is installed and active
2. ✅ Check that theme supports app blocks (Online Store 2.0)
3. ✅ Ensure block is added to Cart template in theme editor
4. ✅ Check browser console for JavaScript errors

### Cart Items Not Auto-Detected

**Problem**: Cart items don't appear automatically in widget

**Solutions**:
1. ✅ Enable "Auto-extract Cart Items" in block settings
2. ✅ Verify you're on the cart page (`/cart`)
3. ✅ Check browser console for errors
4. ✅ Manually select items from available images

### Widget Not Loading

**Problem**: Modal opens but widget doesn't load

**Solutions**:
1. ✅ Check widget URL in app metafields: `shop.metafields.nusense.widget_url`
2. ✅ Verify URL is accessible: `https://try-this-look.vercel.app`
3. ✅ Check browser console for CORS or network errors
4. ✅ Verify iframe permissions (camera, microphone)

### Generation Fails

**Problem**: API calls fail or return errors

**Solutions**:
1. ✅ Verify shop domain is correctly set
2. ✅ Check API endpoint accessibility
3. ✅ Verify product images are valid URLs
4. ✅ Check browser console for detailed error messages
5. ✅ Ensure person image is uploaded correctly

### Images Not Extracting

**Problem**: Product/cart images don't appear in widget

**Solutions**:
1. ✅ Verify products have images uploaded
2. ✅ Check image URLs are accessible
3. ✅ Verify postMessage communication is working
4. ✅ Check browser console for extraction errors

---

## 🔌 API Endpoints

### Cart Fashion Photos Generation (Batch)

**Endpoint**: `POST /api/fashion-photo/cart`

**Query Parameters**:
- `shop` (required): Shop domain (e.g., `your-store.myshopify.com`)

**Form Data**:
- `personImage` (required): Person image file
- `garmentImages` (required): Array of garment image files (1-6 files)
- `garmentKeys` (optional): Comma-separated garment keys for caching
- `personKey` (optional): Person key for caching
- `storeName` (optional): Shop domain (fallback)

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "index": 0,
      "garmentKey": "garment-123",
      "status": "success",
      "image": "data:image/png;base64,...",
      "imageUrl": "https://...",
      "cached": false,
      "creditsDeducted": 1,
      "processingTime": 12345
    }
  ],
  "summary": {
    "totalGarments": 3,
    "successful": 3,
    "failed": 0,
    "cached": 0,
    "generated": 3,
    "totalCreditsDeducted": 3,
    "processingTime": 15000
  },
  "requestId": "cart-tryon-1234567890-abc123"
}
```

### Complete Outfit Look Generation

**Endpoint**: `POST /api/fashion-photo/outfit`

**Query Parameters**:
- `shop` (required): Shop domain

**Form Data**:
- `personImage` (required): Person image file
- `garmentImages` (required): Array of garment image files (2-8 files)
- `garmentTypes` (optional): Comma-separated garment types (e.g., `"shirt,pants,shoes"`)
- `garmentKeys` (optional): Comma-separated garment keys
- `personKey` (optional): Person key for caching
- `storeName` (optional): Shop domain (fallback)

**Response**:
```json
{
  "success": true,
  "data": {
    "image": "data:image/png;base64,...",
    "imageUrl": "https://...",
    "personImageUrl": "https://...",
    "garmentImageUrls": ["https://...", "https://..."],
    "garmentTypes": ["shirt", "pants", "shoes"],
    "cached": false,
    "creditsDeducted": 1,
    "requestId": "outfit-tryon-1234567890-abc123",
    "processingTime": 20000
  }
}
```

---

## 📝 Configuration Checklist

Use this checklist to ensure everything is configured correctly:

- [ ] App is installed and active
- [ ] Theme app extension is deployed
- [ ] Button block is added to Cart template
- [ ] Button settings are configured
- [ ] Cart items are visible in cart
- [ ] Widget URL is accessible
- [ ] Test Cart Mode generation
- [ ] Test Outfit Mode generation
- [ ] Verify image extraction works
- [ ] Check mobile responsiveness
- [ ] Test on different browsers

---

## 🎨 Customization

**Note**: The Cart & Outfit button block has been removed from the theme extension. The widget can be accessed directly via URL or through custom integration.

### Widget URL

To change the widget URL, update the app metafield:

1. Go to **Settings** → **Custom data** → **Shop**
2. Find `nusense.widget_url`
3. Update to your custom URL

---

## 📞 Support

If you encounter issues:

1. **Check Browser Console** for error messages
2. **Verify Configuration** using the checklist above
3. **Test API Endpoints** directly using Postman or curl
4. **Review Logs** in your app dashboard

---

## 🎉 Next Steps

After successful configuration:

1. ✅ **Test thoroughly** on different devices
2. ✅ **Add to multiple pages** (cart, product, collection)
3. ✅ **Customize button text** to match your brand
4. ✅ **Monitor usage** and gather customer feedback
5. ✅ **Optimize images** for better generation quality

---

## 📚 Additional Resources

- [Shopify Theme App Extensions Documentation](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions)
- [Cart API Documentation](fashion.md#2-cart-fashion-photos-generation-batch)
- [Outfit API Documentation](fashion.md#3-complete-outfit-look-generation)
- [Theme Editor Guide](https://help.shopify.com/en/manual/online-store/themes/theme-editor)

---

**Last Updated**: {{ date }}
**Version**: 1.0.0

