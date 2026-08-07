const { createClient } = require('@libsql/client');

// Support both Turso (production) and local SQLite (development)
const isProduction = process.env.TURSO_DATABASE_URL;

const db = createClient(
  isProduction
    ? {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : {
        url: 'file:leaves.db',
      }
);

async function initializeDatabase() {
  try {
    // Create users table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create leaves table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS leaves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('sick', 'vacation', 'casual', 'other')),
        reason TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, date)
      )
    `);

    console.log('Database tables initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err.message);
  }
}

// Wrapper to match the old API so server.js needs minimal changes
const dbQueries = {
  async run(sql, params = []) {
    const result = await db.execute({ sql, args: params });
    return { id: Number(result.lastInsertRowid), changes: result.rowsAffected };
  },

  async get(sql, params = []) {
    const result = await db.execute({ sql, args: params });
    return result.rows.length > 0 ? result.rows[0] : undefined;
  },

  async all(sql, params = []) {
    const result = await db.execute({ sql, args: params });
    return result.rows;
  },

  async initialize() {
    await initializeDatabase();
  }
};

module.exports = dbQueries;
