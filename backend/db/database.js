import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = join(__dirname, 'aeo.db');

// Open (or create) the SQLite database
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS queries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    query      TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    query       TEXT NOT NULL,
    best_model  TEXT,
    confidence  REAL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analytics (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    query      TEXT NOT NULL,
    intent     TEXT,
    model      TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Prepared statements ───────────────────────────────────────────────────────

const stmtSaveQuery    = db.prepare('INSERT INTO queries (query) VALUES (?)');
const stmtSaveResult   = db.prepare('INSERT INTO results (query, best_model, confidence) VALUES (?, ?, ?)');
const stmtLogAnalytics = db.prepare('INSERT INTO analytics (query, intent, model) VALUES (?, ?, ?)');

// ── Helper functions ──────────────────────────────────────────────────────────

export function saveQuery(query) {
  try { stmtSaveQuery.run(query); } catch (_) {}
}

export function saveResult(query, bestModel, confidence) {
  try { stmtSaveResult.run(query, bestModel, confidence ?? null); } catch (_) {}
}

export function logAnalytics(query, intent, model) {
  try { stmtLogAnalytics.run(query, intent, model); } catch (_) {}
}

// ── Analytics read queries ────────────────────────────────────────────────────

export function getAnalytics() {
  const totalQueries = db.prepare('SELECT COUNT(*) AS count FROM queries').get().count;

  const topQueries = db.prepare(`
    SELECT query, COUNT(*) AS count
    FROM queries
    GROUP BY query
    ORDER BY count DESC
    LIMIT 10
  `).all();

  const topIntents = db.prepare(`
    SELECT intent, COUNT(*) AS count
    FROM analytics
    WHERE intent IS NOT NULL
    GROUP BY intent
    ORDER BY count DESC
    LIMIT 5
  `).all();

  const topModels = db.prepare(`
    SELECT model, COUNT(*) AS count
    FROM analytics
    WHERE model IS NOT NULL
    GROUP BY model
    ORDER BY count DESC
    LIMIT 3
  `).all();

  return { totalQueries, topQueries, topIntents, topModels };
}

export default db;
