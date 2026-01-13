# Cart Tracking Events Database Schema

## Overview
Cart tracking events should be stored in the **remote backend database** (the same database where `image_generations` table is stored). This is the database accessed via `VITE_API_ENDPOINT`.

## Recommended Table Structure

### Table Name: `cart_tracking_events`

This table stores all "Add to Cart" button click events with associated metadata.

```sql
CREATE TABLE cart_tracking_events (
  id VARCHAR(255) PRIMARY KEY,
  store_name VARCHAR(255) NOT NULL,
  action_type ENUM('add_to_cart', 'buy_now') NOT NULL DEFAULT 'add_to_cart',
  product_id VARCHAR(255),
  product_title VARCHAR(500),
  product_url TEXT,
  variant_id VARCHAR(255),
  customer_email VARCHAR(255),
  customer_first_name VARCHAR(255),
  customer_last_name VARCHAR(255),
  generated_image_url TEXT,
  person_image_url TEXT,
  clothing_image_url TEXT,
  user_agent TEXT,
  ip_address VARCHAR(45),
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for common queries
  INDEX idx_store_name (store_name),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at),
  INDEX idx_customer_email (customer_email),
  INDEX idx_product_id (product_id),
  INDEX idx_session_id (session_id),
  INDEX idx_store_created (store_name, created_at),
  INDEX idx_store_action (store_name, action_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | VARCHAR(255) | Primary key, unique identifier (e.g., `cart-event-{timestamp}-{random}`) |
| `store_name` | VARCHAR(255) | Normalized shop domain (e.g., `example.myshopify.com`) |
| `action_type` | ENUM('add_to_cart', 'buy_now') | Type of action: `add_to_cart` or `buy_now` (default: `add_to_cart`) |
| `product_id` | VARCHAR(255) | Shopify product ID (nullable) |
| `product_title` | VARCHAR(500) | Product title/name (nullable) |
| `product_url` | TEXT | Product URL (nullable) |
| `variant_id` | VARCHAR(255) | Product variant ID if applicable (nullable) |
| `customer_email` | VARCHAR(255) | Customer email address (nullable) |
| `customer_first_name` | VARCHAR(255) | Customer first name (nullable) |
| `customer_last_name` | VARCHAR(255) | Customer last name (nullable) |
| `generated_image_url` | TEXT | URL of the generated try-on image (nullable) |
| `person_image_url` | TEXT | URL of the person image used (nullable) |
| `clothing_image_url` | TEXT | URL of the clothing image used (nullable) |
| `user_agent` | TEXT | Browser user agent string (nullable) |
| `ip_address` | VARCHAR(45) | IP address (supports IPv4 and IPv6) (nullable) |
| `session_id` | VARCHAR(255) | Session identifier for tracking user sessions (nullable) |
| `created_at` | TIMESTAMP | When the event was created |
| `updated_at` | TIMESTAMP | When the record was last updated |

## Indexes

The following indexes are recommended for efficient querying:

1. **`idx_store_name`** - Filter by store
2. **`idx_action_type`** - Filter by action type (add_to_cart vs buy_now)
3. **`idx_created_at`** - Sort by date/time
4. **`idx_customer_email`** - Filter by customer
5. **`idx_product_id`** - Filter by product
6. **`idx_session_id`** - Track user sessions
7. **`idx_store_created`** - Composite index for common queries (store + date)
8. **`idx_store_action`** - Composite index for store + action type queries

## Alternative: PostgreSQL Schema

If using PostgreSQL instead of MySQL:

```sql
CREATE TABLE cart_tracking_events (
  id VARCHAR(255) PRIMARY KEY,
  store_name VARCHAR(255) NOT NULL,
  action_type VARCHAR(20) NOT NULL DEFAULT 'add_to_cart',
  product_id VARCHAR(255),
  product_title VARCHAR(500),
  product_url TEXT,
  variant_id VARCHAR(255),
  customer_email VARCHAR(255),
  customer_first_name VARCHAR(255),
  customer_last_name VARCHAR(255),
  generated_image_url TEXT,
  person_image_url TEXT,
  clothing_image_url TEXT,
  user_agent TEXT,
  ip_address VARCHAR(45),
  session_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_store_name ON cart_tracking_events(store_name);
CREATE INDEX idx_action_type ON cart_tracking_events(action_type);
CREATE INDEX idx_created_at ON cart_tracking_events(created_at);
CREATE INDEX idx_customer_email ON cart_tracking_events(customer_email);
CREATE INDEX idx_product_id ON cart_tracking_events(product_id);
CREATE INDEX idx_session_id ON cart_tracking_events(session_id);
CREATE INDEX idx_store_created ON cart_tracking_events(store_name, created_at);
CREATE INDEX idx_store_action ON cart_tracking_events(store_name, action_type);

-- Trigger for updated_at (PostgreSQL)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cart_tracking_events_updated_at 
    BEFORE UPDATE ON cart_tracking_events 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## Relationship to Image Generations Table

The `cart_tracking_events` table can be related to `image_generations` table through:
- `generated_image_url` → `image_generations.generated_image_url`
- `person_image_url` → `image_generations.person_image_url`
- `clothing_image_url` → `image_generations.clothing_image_url`
- `store_name` → `image_generations.store_name`
- `customer_email` → `image_generations.customer_email`

This allows you to:
- Track conversion rates (image generation → add to cart)
- Analyze which generated images lead to cart additions
- Understand customer journey from try-on to purchase intent

## Implementation Location

**This table should be created in the remote backend database** (the one accessed via `VITE_API_ENDPOINT`), not in the Shopify app server database.

The backend API endpoint `/api/cart-tracking/track` should:
1. Receive POST requests from the frontend
2. Validate the data
3. Insert records into this `cart_tracking_events` table
4. Return success/error response

## Example Queries

### Get all cart events for a store
```sql
SELECT * FROM cart_tracking_events 
WHERE store_name = 'example.myshopify.com' 
ORDER BY created_at DESC;
```

### Get cart events with date range
```sql
SELECT * FROM cart_tracking_events 
WHERE store_name = 'example.myshopify.com' 
  AND created_at BETWEEN '2024-01-01' AND '2024-01-31'
ORDER BY created_at DESC;
```

### Count cart events by product
```sql
SELECT product_id, product_title, COUNT(*) as event_count
FROM cart_tracking_events
WHERE store_name = 'example.myshopify.com'
GROUP BY product_id, product_title
ORDER BY event_count DESC;
```

### Conversion rate analysis (image generation → cart)
```sql
SELECT 
  ig.id as generation_id,
  ig.generated_image_url,
  COUNT(cte.id) as cart_clicks
FROM image_generations ig
LEFT JOIN cart_tracking_events cte 
  ON cte.generated_image_url = ig.generated_image_url
WHERE ig.store_name = 'example.myshopify.com'
GROUP BY ig.id, ig.generated_image_url;
```

