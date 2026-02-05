import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DATABASE_URL = process.env.DATABASE_URL || path.join(dataDir, 'claude-dashboard.db');

// Create SQLite database connection
const sqlite = new Database(DATABASE_URL);

// Enable WAL mode for better concurrent access
sqlite.pragma('journal_mode = WAL');

// Create Drizzle ORM instance
export const db = drizzle(sqlite, { schema });

// Run migrations
export function runMigrations() {
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  migrate(db, { migrationsFolder });
}

// Initialize database (run migrations if needed)
export function initializeDatabase() {
  try {
    runMigrations();
    console.log('✓ Database initialized successfully');
  } catch (error) {
    console.error('✗ Database initialization failed:', error);
    throw error;
  }
}

// Close database connection
export function closeDatabase() {
  sqlite.close();
}

export default db;
