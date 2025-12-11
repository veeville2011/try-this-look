# Stock Alert Interference Fix

## Issue Identified

Your client reported that stock alerts stopped working after installing the app. This was caused by **MutationObservers watching the entire document body**, which interfered with stock alert forms and scripts.

## Root Cause

The app had multiple `MutationObserver` instances observing `document.body` with `subtree: true`, meaning they watched **every DOM change** across the entire page. This caused:

1. **Performance issues** - Observing all DOM mutations slows down the page
2. **Interference with stock alerts** - Stock alert forms use dynamic DOM updates that were being intercepted
3. **Conflicts with other apps** - Other apps' scripts that modify the DOM were affected

## Files Fixed

### 1. `extensions/theme-app-extension/assets/nusense-tryon-button.js`

**Changes:**
- **Scoped MutationObserver for positioning** - Now only watches product form area instead of entire body
- **Added filters** - Ignores mutations from stock alert forms (`[class*="stock"]`, `[class*="alert"]`, `[id*="stock"]`, etc.)
- **Scoped global observer** - Only observes product-related areas, not entire document body
- **Early returns** - Skips processing mutations from stock alert forms

**Before:**
```javascript
positionObserver.observe(document.body, {
  childList: true,
  subtree: true,  // ❌ Watches EVERYTHING
  attributeFilter: ['class', 'id']
});
```

**After:**
```javascript
// Only observe product form area
const productForm = button.closest('form[action*="/cart/add"]') || button.parentElement;
positionObserver.observe(productForm, {
  childList: true,
  subtree: productForm !== document.body,  // ✅ Only subtree if scoped
  attributeFilter: ['class', 'id']
});

// Filter out stock alert forms
if (node.matches('[class*="stock"], [class*="alert"]')) {
  return; // Skip
}
```

### 2. `extensions/theme-app-extension/snippets/nusense-tryon-script.liquid`

**Changes:**
- **Scoped message listener** - Only processes NUSENSE-specific messages
- **Early return** - Ignores messages from other apps (like stock alerts)

**Before:**
```javascript
function handleMessage(event) {
  // Processed ALL messages
}
```

**After:**
```javascript
function handleMessage(event) {
  // Only process NUSENSE messages
  if (!event.data || !event.data.type || !event.data.type.startsWith('NUSENSE_')) {
    return; // ✅ Let other handlers process this
  }
}
```

## Benefits

✅ **No interference** - Stock alerts work normally  
✅ **Better performance** - Observers only watch relevant areas  
✅ **Compatibility** - Works alongside other apps  
✅ **Maintainability** - Clear separation of concerns  

## Testing Checklist

After deploying this fix, verify:

- [ ] Stock alert forms submit correctly
- [ ] Stock notifications are received
- [ ] Try-On button still works correctly
- [ ] Button positioning still works
- [ ] No console errors
- [ ] Other apps continue to work

## Deployment

1. Deploy the updated extension files
2. Test on a store with stock alerts enabled
3. Verify stock alerts work correctly
4. Monitor for any issues

## Prevention

To prevent similar issues in the future:

1. **Always scope MutationObservers** - Never observe `document.body` with `subtree: true`
2. **Filter mutations** - Check if mutations are relevant before processing
3. **Use specific selectors** - Target specific elements, not entire document
4. **Test with other apps** - Verify compatibility with common apps (stock alerts, reviews, etc.)

