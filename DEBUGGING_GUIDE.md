# Debugging Guide for 504 Timeout Issues

## Is the Current Logging Enough?

**Yes, the logging is comprehensive**, but here's how to use it effectively and what additional steps to take:

## Step-by-Step Debugging Process

### 1. **Identify the Failing Step**

Check your Vercel logs and look for the request ID. The logs will show exactly where it's failing:

```
[API] [SUBSCRIBE] ===== REQUEST START =====
  → Request ID: req-1234567890-abc123

[API] [SUBSCRIBE] Body Parsing
  → Should complete in < 5ms

[API] [SUBSCRIBE] Shop domain extraction
  → Should complete in < 1ms

[API] [SUBSCRIBE] Session ID Generation
  → Should complete in < 1ms

[API] [SUBSCRIBE] Session Retrieval
  → ⚠️ THIS IS WHERE IT MIGHT HANG
  → Should complete in < 100ms (if using in-memory storage)
  → Could take 1-5 seconds (if using database)

[BILLING] [CREATE] Starting subscription creation
  → ⚠️ THIS IS WHERE IT MIGHT HANG
  → GraphQL request to Shopify
  → Should complete in < 5 seconds normally
  → Timeout set to 20 seconds
```

### 2. **Common Failure Points**

#### A. Session Retrieval Timeout
**Symptoms:**
- Logs show "Session retrieval timeout" after 5 seconds
- No logs after "Attempting to retrieve session"

**Possible Causes:**
- Session storage is slow (database connection issues)
- Session doesn't exist (app not installed)
- Network issues with session storage

**Solutions:**
- Check if app is properly installed
- Verify session storage configuration
- Check database connectivity (if using database storage)

#### B. GraphQL Request Timeout
**Symptoms:**
- Logs show "GraphQL request timeout" after 20 seconds
- Logs show "Initiating GraphQL request" but no completion

**Possible Causes:**
- Shopify API is slow or down
- Network connectivity issues
- Invalid GraphQL mutation
- Shopify rate limiting

**Solutions:**
- Check Shopify API status: https://status.shopify.com/
- Verify GraphQL mutation syntax
- Check for rate limiting errors
- Verify access token is valid

#### C. Vercel Function Timeout
**Symptoms:**
- 504 Gateway Timeout from Vercel
- No error logs (function killed before logging)

**Possible Causes:**
- Function exceeded 60-second limit
- Cold start taking too long
- Memory issues

**Solutions:**
- Check Vercel function logs for memory warnings
- Consider upgrading Vercel plan for longer timeouts
- Optimize cold start performance

### 3. **What the Logs Will Tell You**

#### Success Case:
```
[API] [SUBSCRIBE] ===== REQUEST SUCCESS =====
{
  "requestId": "req-1234567890-abc123",
  "breakdown": {
    "bodyParsing": "2ms",
    "sessionIdGeneration": "1ms",
    "sessionRetrieval": "50ms",
    "billingCreation": "3000ms",
    "total": "3053ms"
  }
}
```

#### Failure Case:
```
[API] [SUBSCRIBE] ===== REQUEST FAILED =====
{
  "requestId": "req-1234567890-abc123",
  "error": "GraphQL request timed out after 20 seconds",
  "isTimeout": true,
  "totalDuration": "20000ms"
}
```

### 4. **Additional Debugging Tools**

#### A. Health Check Endpoint
Use `/health/detailed` to check system status:
```bash
curl https://try-this-look.vercel.app/health/detailed
```

This shows:
- Environment configuration
- Memory usage
- System uptime
- Missing environment variables

#### B. Test Session Retrieval
Add a test endpoint to check session retrieval:
```javascript
app.get("/api/debug/session/:shop", async (req, res) => {
  const shop = req.params.shop;
  const sessionId = shopify.session.getOfflineId(shop);
  const startTime = Date.now();
  
  try {
    const session = await shopify.session.getSessionById(sessionId);
    const duration = Date.now() - startTime;
    
    res.json({
      success: true,
      hasSession: !!session,
      duration: `${duration}ms`,
      sessionId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      duration: `${Date.now() - startTime}ms`,
    });
  }
});
```

### 5. **What to Check in Vercel Dashboard**

1. **Function Logs:**
   - Go to: Project → Functions → `/api/billing/subscribe`
   - Look for request IDs
   - Check for timeout errors
   - Check memory usage

2. **Function Metrics:**
   - Duration: Should be < 10 seconds normally
   - Memory: Should be < 128MB normally
   - Errors: Check error rate

3. **Real-time Monitoring:**
   - Use Vercel's real-time logs
   - Filter by request ID
   - Look for patterns

### 6. **Quick Fixes to Try**

#### If Session Retrieval is Slow:
```javascript
// Add caching for sessions
const sessionCache = new Map();
// Cache sessions for 5 minutes
```

#### If GraphQL is Slow:
```javascript
// Add retry logic with exponential backoff
// Reduce timeout to fail faster
// Add request queuing
```

#### If Vercel is Timing Out:
- Upgrade to Pro plan (60s → 300s timeout)
- Optimize cold starts
- Add connection pooling

### 7. **Monitoring Setup**

Consider adding:
- **Error tracking**: Sentry, Rollbar, or similar
- **Performance monitoring**: Vercel Analytics
- **Alerts**: Set up alerts for 504 errors

### 8. **Next Steps After Identifying the Issue**

Once you identify where it's failing:

1. **Session Issues:**
   - Implement session caching
   - Use faster session storage (Redis)
   - Add session validation earlier

2. **GraphQL Issues:**
   - Add retry logic
   - Implement request queuing
   - Add circuit breaker pattern

3. **Vercel Issues:**
   - Optimize function size
   - Reduce cold start time
   - Consider edge functions

## Summary

**The logging is comprehensive enough** to identify:
- ✅ Where the request is failing
- ✅ How long each step takes
- ✅ What error occurred
- ✅ Request context

**What you need to do:**
1. Deploy the changes
2. Monitor Vercel logs for a few requests
3. Identify the failing step from the logs
4. Apply the appropriate fix based on the failure point

The logs will give you all the information needed to fix the issue!

