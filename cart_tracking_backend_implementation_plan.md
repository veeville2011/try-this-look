# Cart Tracking Backend Implementation Plan

## Overview
This document outlines the complete backend implementation plan for the cart tracking feature. The backend should be implemented in the **remote backend API** (accessed via `VITE_API_ENDPOINT`), not in the Shopify app server.

---

## 1. Database Setup

### 1.1 Create Database Table
- **Table Name**: `cart_tracking_events`
- **Database**: Same database where `image_generations` table exists
- **Schema**: Use the schema provided in `database-schema-cart-tracking.md`
- **Action**: Execute the CREATE TABLE statement (MySQL or PostgreSQL version)

### 1.2 Verify Indexes
- Ensure all recommended indexes are created:
  - `idx_store_name` - For filtering by store
  - `idx_created_at` - For date-based queries
  - `idx_customer_email` - For customer analysis
  - `idx_product_id` - For product analysis
  - `idx_session_id` - For session tracking
  - `idx_store_created` - Composite index for common queries

### 1.3 Database Connection
- Verify database connection pool is configured
- Ensure connection can handle concurrent writes
- Set appropriate connection limits

---

## 2. API Endpoint Implementation

### 2.1 Endpoint Details
- **Path**: `/api/cart-tracking/track`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Authentication**: Use same authentication mechanism as `/api/image-generations/all`

### 2.2 Request Validation

#### Required Fields
- `storeName` (string, required) - Must be present and non-empty

#### Optional Fields (all nullable)
- `productId` (string/number)
- `productTitle` (string, max 500 chars)
- `productUrl` (string, URL format)
- `variantId` (string/number)
- `customerEmail` (string, email format if provided)
- `customerFirstName` (string)
- `customerLastName` (string)
- `generatedImageUrl` (string, URL format)
- `personImageUrl` (string, URL format)
- `clothingImageUrl` (string, URL format)
- `userAgent` (string)
- `sessionId` (string)

#### Validation Rules
1. Validate `storeName` is present and non-empty
2. Validate email format if `customerEmail` is provided
3. Validate URL format for `productUrl`, `generatedImageUrl`, `personImageUrl`, `clothingImageUrl` if provided
4. Sanitize all string inputs to prevent SQL injection
5. Truncate strings that exceed max length (e.g., `productTitle` max 500 chars)

### 2.3 Data Processing

#### Extract IP Address
- Get IP from request headers:
  - Check `X-Forwarded-For` header (first IP if comma-separated list)
  - Fallback to `X-Real-IP` header
  - Fallback to `req.ip` or `req.connection.remoteAddress`
- Handle IPv4 and IPv6 formats
- Store in `ip_address` field

#### Generate Unique ID
- Format: `cart-event-{timestamp}-{random}`
- Example: `cart-event-1704067200000-a3f9k2m`
- Ensure uniqueness (check database if needed, or use UUID)

#### Normalize Store Name
- Ensure store name is normalized (lowercase, `.myshopify.com` format)
- Use same normalization logic as frontend

#### Timestamp Handling
- Set `created_at` to current timestamp (server time, UTC)
- Set `updated_at` to same as `created_at` initially

### 2.4 Database Insert

#### Insert Operation
1. Prepare INSERT statement with all fields
2. Use parameterized queries (prepared statements) to prevent SQL injection
3. Handle NULL values correctly for optional fields
4. Use database transaction if needed (for consistency)

#### Error Handling
- Catch database connection errors
- Catch constraint violations (duplicate IDs, etc.)
- Catch data type errors
- Log all errors with context

### 2.5 Response Format

#### Success Response (200 OK)
```json
{
  "status": "success",
  "message": "Cart event tracked successfully",
  "data": {
    "id": "cart-event-1704067200000-a3f9k2m",
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request** - Validation errors
```json
{
  "status": "error",
  "error": "Validation Error",
  "message": "storeName is required",
  "details": {
    "field": "storeName",
    "reason": "Field is required"
  }
}
```

**500 Internal Server Error** - Database/server errors
```json
{
  "status": "error",
  "error": "Server Error",
  "message": "Failed to track cart event",
  "code": "DATABASE_ERROR"
}
```

**503 Service Unavailable** - Database unavailable
```json
{
  "status": "error",
  "error": "Service Unavailable",
  "message": "Database service unavailable",
  "code": "DATABASE_UNAVAILABLE"
}
```

---

## 3. Security Considerations

### 3.1 Input Sanitization
- Sanitize all user inputs
- Use parameterized queries (prepared statements)
- Validate data types and formats
- Escape special characters

### 3.2 Rate Limiting
- Implement rate limiting per IP address
- Suggested limits:
  - 100 requests per minute per IP
  - 1000 requests per hour per IP
- Return `429 Too Many Requests` if exceeded

### 3.3 Authentication/Authorization
- Use same authentication mechanism as other API endpoints
- Verify request is from authenticated source
- Consider API key or token validation

### 3.4 Data Privacy
- Don't log sensitive customer data in error logs
- Mask email addresses in logs if needed
- Comply with GDPR/privacy regulations
- Consider data retention policies

---

## 4. Error Handling & Logging

### 4.1 Logging Requirements
- Log all tracking requests (with sanitized data)
- Log validation errors
- Log database errors with context
- Log rate limit violations
- Use structured logging format

### 4.2 Error Categories
1. **Validation Errors** - Invalid input data
2. **Database Errors** - Connection, query failures
3. **Rate Limit Errors** - Too many requests
4. **System Errors** - Unexpected server errors

### 4.3 Log Format
- Include timestamp
- Include request ID (for tracing)
- Include store name
- Include error type and message
- Exclude sensitive customer data

---

## 5. Performance Considerations

### 5.1 Database Optimization
- Use connection pooling
- Index all frequently queried fields
- Consider partitioning by date if table grows large
- Monitor query performance

### 5.2 Async Processing (Optional)
- Consider making insert operation async/non-blocking
- Use message queue (Redis, RabbitMQ) for high-volume scenarios
- Process inserts in background workers
- Return success immediately, process later

### 5.3 Caching (Optional)
- Cache store information if needed
- Don't cache tracking events (must be written immediately)

---

## 6. Monitoring & Analytics

### 6.1 Metrics to Track
- Number of cart events per store
- Number of cart events per day/hour
- Success/failure rates
- Average response time
- Database query performance

### 6.2 Alerts
- Alert on high error rates (>5%)
- Alert on database connection failures
- Alert on high response times (>500ms)
- Alert on rate limit violations

### 6.3 Analytics Queries
- Prepare common queries for analytics dashboard:
  - Events by store
  - Events by date range
  - Events by product
  - Conversion rate (image generation → cart)
  - Customer journey analysis

---

## 7. Testing Plan

### 7.1 Unit Tests
- Test validation logic
- Test data normalization
- Test IP extraction
- Test ID generation
- Test error handling

### 7.2 Integration Tests
- Test database insert operations
- Test with real database connection
- Test error scenarios (database down, etc.)
- Test rate limiting

### 7.3 End-to-End Tests
- Test full flow from frontend → backend → database
- Test with various data combinations
- Test edge cases (missing fields, invalid data)

### 7.4 Load Tests
- Test concurrent requests
- Test high-volume scenarios
- Test database performance under load
- Identify bottlenecks

---

## 8. Deployment Checklist

### 8.1 Pre-Deployment
- [ ] Database table created
- [ ] Indexes created
- [ ] API endpoint implemented
- [ ] Validation logic tested
- [ ] Error handling tested
- [ ] Security measures in place
- [ ] Rate limiting configured
- [ ] Logging configured
- [ ] Monitoring set up

### 8.2 Deployment Steps
1. Deploy database migration (CREATE TABLE)
2. Deploy API endpoint code
3. Verify endpoint is accessible
4. Test with sample request
5. Monitor logs for errors
6. Verify data is being inserted correctly

### 8.3 Post-Deployment
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Verify data integrity
- [ ] Check database growth
- [ ] Review logs for issues

---

## 9. API Documentation

### 9.1 Endpoint Documentation
- Document endpoint URL
- Document request format
- Document response format
- Document error codes
- Document rate limits
- Provide example requests/responses

### 9.2 Integration Guide
- Provide integration steps for frontend
- Document authentication requirements
- Document data format requirements
- Provide troubleshooting guide

---

## 10. Future Enhancements (Optional)

### 10.1 Additional Features
- Bulk insert endpoint (for multiple events)
- Query endpoint (GET `/api/cart-tracking/events`)
- Analytics endpoint (GET `/api/cart-tracking/analytics`)
- Export functionality (CSV/Excel)

### 10.2 Data Retention
- Implement data retention policies
- Archive old events (>1 year)
- Provide data deletion API

### 10.3 Advanced Analytics
- Real-time dashboard
- Conversion funnel analysis
- Product performance metrics
- Customer behavior insights

---

## 11. Rollback Plan

### 11.1 If Issues Occur
1. Disable endpoint (return 503)
2. Investigate errors
3. Fix issues
4. Re-enable endpoint
5. Monitor closely

### 11.2 Database Rollback
- Keep backup of database schema
- Document rollback SQL (DROP TABLE if needed)
- Ensure no data loss during rollback

---

## 12. Dependencies

### 12.1 Required
- Database connection (MySQL/PostgreSQL)
- Authentication middleware
- Logging system
- Error handling framework

### 12.2 Optional
- Rate limiting library
- Message queue (for async processing)
- Monitoring tools
- Analytics platform

---

## Summary

This implementation plan covers:
1. ✅ Database setup and schema
2. ✅ API endpoint implementation
3. ✅ Security and validation
4. ✅ Error handling and logging
5. ✅ Performance optimization
6. ✅ Monitoring and analytics
7. ✅ Testing strategy
8. ✅ Deployment process
9. ✅ Documentation requirements
10. ✅ Future enhancements

**Next Steps:**
1. Review this plan with the backend team
2. Set up database table
3. Implement API endpoint
4. Test thoroughly
5. Deploy to production
6. Monitor and iterate

---

## Notes

- This endpoint should be **non-blocking** - tracking failures should not affect user experience
- The frontend already handles errors gracefully, so backend errors won't break the cart flow
- Consider implementing async processing if volume is high
- Monitor database growth and plan for scaling if needed
- Keep implementation simple initially, add enhancements later based on usage patterns

