import pg from "pg";
import * as logger from "./logger.js";

const { Pool } = pg;

/**
 * PostgreSQL-based session storage for Shopify sessions
 * Production-ready implementation for Vercel and other serverless platforms
 */
class DatabaseSessionStorage {
  constructor(connectionString) {
    this.connectionString = connectionString || process.env.DATABASE_URL;
    this.pool = null;
    this.initialized = false;

    if (!this.connectionString) {
      throw new Error(
        "[SESSION_STORAGE] DATABASE_URL environment variable is required for database session storage"
      );
    }
  }

  /**
   * Initialize the database connection and create sessions table if needed
   */
  async initialize() {
    if (this.initialized) {
      logger.debug("[SESSION_STORAGE] Database already initialized", {
        initialized: true,
        hasPool: !!this.pool,
      });
      return;
    }

    const initStartTime = Date.now();
    logger.info("[SESSION_STORAGE] Initializing database connection...", {
      hasConnectionString: !!this.connectionString,
      connectionStringPreview: this.connectionString
        ? `${this.connectionString.substring(0, 30)}...`
        : "missing",
    });

    try {
      // Detect if using Neon PostgreSQL (requires SSL)
      const isNeon = this.connectionString.includes("neon.tech");
      
      // Use SSL for production/Vercel deployments or Neon (Neon requires SSL)
      const useSSL = process.env.NODE_ENV === "production" || 
                     this.connectionString.includes("sslmode=require") ||
                     isNeon;
      
      // Optimize pool settings for Vercel serverless functions with Neon
      // Neon uses connection pooling, so we can use a small pool
      // Single connection works well with Neon's pooler for serverless
      this.pool = new Pool({
        connectionString: this.connectionString,
        ssl: useSSL ? { rejectUnauthorized: false } : false,
        max: 1, // Single connection for serverless (Neon pooler handles the rest)
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000, // Increased for cold starts
        allowExitOnIdle: true, // Allow process to exit when idle (serverless-friendly)
      });

      // Test connection
      await this.pool.query("SELECT NOW()");

      // Create sessions table if it doesn't exist
      // Store complete session data as JSONB for simplicity and flexibility
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS shopify_sessions (
          id VARCHAR(255) PRIMARY KEY,
          shop VARCHAR(255) NOT NULL,
          session_data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create index on shop for faster lookups
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop 
        ON shopify_sessions(shop)
      `);

      const initDuration = Date.now() - initStartTime;
      this.initialized = true;
      logger.info("[SESSION_STORAGE] Database session storage initialized", {
        type: "postgresql",
        provider: isNeon ? "neon" : "postgresql",
        ssl: useSSL,
        duration: `${initDuration}ms`,
        initialized: true,
      });
    } catch (error) {
      logger.error("[SESSION_STORAGE] Failed to initialize database:", error);
      throw error;
    }
  }

  /**
   * Test database connection and return connection status
   * Returns connection info including pool stats and database version
   */
  async testConnection() {
    const startTime = Date.now();
    try {
      // Ensure database is initialized
      await this.initialize();

      // Test query to get database info
      const result = await this.pool.query(
        "SELECT NOW() as current_time, version() as pg_version, current_database() as database_name"
      );

      const duration = Date.now() - startTime;
      const connectionInfo = {
        connected: true,
        duration: `${duration}ms`,
        currentTime: result.rows[0]?.current_time,
        pgVersion: result.rows[0]?.pg_version?.substring(0, 100) || "unknown",
        databaseName: result.rows[0]?.database_name || "unknown",
        poolStats: {
          totalCount: this.pool?.totalCount || 0,
          idleCount: this.pool?.idleCount || 0,
          waitingCount: this.pool?.waitingCount || 0,
        },
        initialized: this.initialized,
      };

      logger.info("[SESSION_STORAGE] Database connection test successful", connectionInfo);
      return connectionInfo;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorInfo = {
        connected: false,
        duration: `${duration}ms`,
        error: error.message,
        errorCode: error.code,
        errorName: error.constructor.name,
        initialized: this.initialized,
      };

      logger.error("[SESSION_STORAGE] Database connection test failed", error, null, errorInfo);
      return errorInfo;
    }
  }

  /**
   * Store a session
   */
  async storeSession(session) {
    await this.initialize();

    try {
      if (!session || !session.id) {
        logger.error("[SESSION_STORAGE] Invalid session object", {
          hasSession: !!session,
          hasId: !!session?.id,
        });
        throw new Error("Invalid session: missing id");
      }

      await this.pool.query(
        `
        INSERT INTO shopify_sessions (id, shop, session_data, updated_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT (id) 
        DO UPDATE SET
          shop = EXCLUDED.shop,
          session_data = EXCLUDED.session_data,
          updated_at = CURRENT_TIMESTAMP
        `,
        [session.id, session.shop, JSON.stringify(session)]
      );

      logger.debug("[SESSION_STORAGE] Session stored successfully", {
        sessionId: session.id,
        shop: session.shop,
        isOnline: session.isOnline,
      });
    } catch (error) {
      logger.error("[SESSION_STORAGE] Failed to store session:", error, null, {
        sessionId: session?.id,
        shop: session?.shop,
      });
      throw error;
    }
  }

  /**
   * Load a session by ID
   */
  async loadSession(sessionId) {
    await this.initialize();

    try {
      const result = await this.pool.query(
        `SELECT session_data FROM shopify_sessions WHERE id = $1`,
        [sessionId]
      );

      if (result.rows.length === 0) {
        return undefined;
      }

      // Parse the stored session data
      const sessionData = result.rows[0].session_data;
      return typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
    } catch (error) {
      logger.error("[SESSION_STORAGE] Failed to load session:", error);
      throw error;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId) {
    await this.initialize();

    try {
      await this.pool.query(`DELETE FROM shopify_sessions WHERE id = $1`, [
        sessionId,
      ]);
    } catch (error) {
      logger.error("[SESSION_STORAGE] Failed to delete session:", error);
      throw error;
    }
  }

  /**
   * Delete all sessions for a shop
   */
  async deleteSessionsByShop(shop) {
    await this.initialize();

    try {
      const normalizedShop = shop.toLowerCase();
      await this.pool.query(
        `DELETE FROM shopify_sessions WHERE LOWER(shop) = $1`,
        [normalizedShop]
      );
    } catch (error) {
      logger.error("[SESSION_STORAGE] Failed to delete sessions by shop:", error);
      throw error;
    }
  }

  /**
   * Find all sessions for a shop
   */
  async findSessionsByShop(shop) {
    await this.initialize();

    try {
      const normalizedShop = shop.toLowerCase();
      const result = await this.pool.query(
        `SELECT session_data FROM shopify_sessions WHERE LOWER(shop) = $1`,
        [normalizedShop]
      );

      return result.rows.map((row) => {
        const sessionData = row.session_data;
        return typeof sessionData === "string"
          ? JSON.parse(sessionData)
          : sessionData;
      });
    } catch (error) {
      logger.error("[SESSION_STORAGE] Failed to find sessions by shop:", error);
      throw error;
    }
  }

  /**
   * Close the database connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.initialized = false;
    }
  }
}

export default DatabaseSessionStorage;

