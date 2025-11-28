# Vercel Deployment Guide

This guide explains how to deploy the Shopify app to Vercel with proper session storage.

## Prerequisites

1. A PostgreSQL database (required for Vercel deployment)
2. Vercel account and project set up

## Database Setup

### Option 1: Neon PostgreSQL (Recommended for Vercel)

Neon is a serverless PostgreSQL database that works seamlessly with Vercel:

1. **Via Vercel Marketplace (Easiest)**:
   - In your Vercel project dashboard, go to **Integrations** tab
   - Search for "Neon" and install the Neon Postgres integration
   - The `DATABASE_URL` environment variable will be automatically added
   - Optional: Enable database branching for preview deployments

2. **Via Neon Console (Manual)**:
   - Create an account at [neon.tech](https://neon.tech)
   - Create a new project and database
   - Copy the connection string from the Neon dashboard
   - Add it as `DATABASE_URL` in your Vercel project settings
   - **Important**: Use the connection pooler endpoint (ends with `.pooler.neon.tech`) for better serverless performance

### Option 2: Vercel Postgres

1. In your Vercel project dashboard, go to **Storage** tab
2. Click **Create Database** and select **Postgres**
3. Choose a plan and region
4. The `DATABASE_URL` environment variable will be automatically added to your project

### Option 3: Other PostgreSQL Providers

You can use any PostgreSQL database provider:
- [Supabase](https://supabase.com) (PostgreSQL with additional features)
- [Railway](https://railway.app) (PostgreSQL hosting)
- [Render](https://render.com) (PostgreSQL hosting)
- [AWS RDS](https://aws.amazon.com/rds/postgresql/)
- [Google Cloud SQL](https://cloud.google.com/sql)

After setting up your database, add the connection string as the `DATABASE_URL` environment variable in Vercel.

## Environment Variables

Ensure the following environment variables are set in your Vercel project:

### Required Variables

- `DATABASE_URL` - PostgreSQL connection string (required for Vercel)
- `VITE_SHOPIFY_API_KEY` - Your Shopify app API key
- `VITE_SHOPIFY_API_SECRET` - Your Shopify app API secret
- `VITE_SHOPIFY_APP_URL` - Your app URL (e.g., `https://your-app.vercel.app`)
- `VITE_SCOPES` - Comma-separated list of Shopify scopes

### Example DATABASE_URL Format

**For Neon PostgreSQL (Recommended)**:
```
postgresql://username:password@ep-xxx-xxx.pooler.us-east-2.aws.neon.tech/dbname?sslmode=require
```

**For Vercel Postgres**:
```
postgres://default:password@host.vercel-storage.com:5432/verceldb
```

**For Other Providers**:
```
postgresql://username:password@host:port/database?sslmode=require
```

**Important Notes for Neon**:
- Always use the **pooler endpoint** (contains `.pooler.neon.tech`) for serverless functions
- The pooler endpoint provides better connection management for Vercel's serverless environment
- SSL is automatically enabled and required by Neon

## Database Schema

The session storage will automatically create the required table on first initialization:

```sql
CREATE TABLE shopify_sessions (
  id VARCHAR(255) PRIMARY KEY,
  shop VARCHAR(255) NOT NULL,
  state VARCHAR(255),
  is_online BOOLEAN DEFAULT false,
  scope TEXT,
  expires DATE,
  access_token TEXT,
  user_id BIGINT,
  session_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Indexes are automatically created for:
- `shop` (for fast lookups by shop domain)
- `is_online` (for filtering online/offline sessions)

## Deployment Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables in Vercel**
   - Go to your Vercel project settings
   - Navigate to **Environment Variables**
   - Add all required variables (especially `DATABASE_URL`)

3. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```
   Or push to your connected Git repository

4. **Verify Deployment**
   - The app will automatically create the database table on first request
   - Check Vercel function logs to ensure session storage initialized successfully
   - Test the OAuth flow to ensure sessions are being stored

## Local Development

For local development, you can either:

1. **Use a local PostgreSQL database** - Set `DATABASE_URL` to your local database
2. **Use file-based storage** - Don't set `DATABASE_URL` (only works locally, not on Vercel)

## Troubleshooting

### "Unable to load billing session for this shop"

This error occurs when:
- The database connection is not configured correctly
- The `DATABASE_URL` environment variable is missing
- The database table was not created

**Solution:**
1. Verify `DATABASE_URL` is set in Vercel environment variables
2. Check Vercel function logs for database connection errors
3. Ensure your database is accessible from Vercel (no IP restrictions)

### Database Connection Timeout

If you're using an external database:
- Ensure SSL is enabled (most cloud providers require it)
- Check firewall rules allow Vercel's IP ranges
- Consider using a connection pooler (like PgBouncer)

### Session Not Persisting

- Verify the database table exists: `SELECT * FROM shopify_sessions LIMIT 1;`
- Check Vercel logs for session storage errors
- Ensure the OAuth callback is storing sessions correctly

## Production Best Practices

1. **Use Connection Pooling**: The implementation uses `pg.Pool` for efficient connection management
2. **Monitor Database Connections**: Keep an eye on your database connection limits
3. **Backup Your Database**: Regularly backup your PostgreSQL database
4. **Use SSL**: Always use SSL connections in production (`sslmode=require`)
5. **Environment Separation**: Use different databases for staging and production

## Cost Considerations

- **Vercel Postgres**: Free tier available, paid plans for production
- **External Providers**: Varies by provider, typically $5-20/month for small apps
- **Connection Limits**: Most providers limit concurrent connections (typically 20-100)

## Support

If you encounter issues:
1. Check Vercel function logs
2. Verify database connectivity
3. Ensure all environment variables are set correctly
4. Review the session storage implementation in `server/utils/databaseSessionStorage.js`

