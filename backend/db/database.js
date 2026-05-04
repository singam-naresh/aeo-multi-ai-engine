import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = join(__dirname, 'aeo.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS queries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    query      TEXT NOT NULL,
    user_id    INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    query       TEXT NOT NULL,
    best_model  TEXT,
    confidence  REAL,
    user_id     INTEGER,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS analytics (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    query      TEXT NOT NULL,
    intent     TEXT,
    model      TEXT,
    user_id    INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Safe migration: add user_id column to existing tables if absent ───────────
// (handles databases created before auth was added)
for (const table of ['queries', 'results', 'analytics']) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes('user_id')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER`);
  }
}

// ── Prepared statements ───────────────────────────────────────────────────────

const stmtCreateUser   = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)');
const stmtFindByEmail  = db.prepare('SELECT * FROM users WHERE email = ?');
const stmtFindById     = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?');

const stmtSaveQuery    = db.prepare('INSERT INTO queries (query, user_id) VALUES (?, ?)');
const stmtSaveResult   = db.prepare('INSERT INTO results (query, best_model, confidence, user_id) VALUES (?, ?, ?, ?)');
const stmtLogAnalytics = db.prepare('INSERT INTO analytics (query, intent, model, user_id) VALUES (?, ?, ?, ?)');

// ── User helpers ──────────────────────────────────────────────────────────────

export function createUser(email, hashedPassword) {
  return stmtCreateUser.run(email, hashedPassword);
}

export function findUserByEmail(email) {
  return stmtFindByEmail.get(email);
}

export function findUserById(id) {
  return stmtFindById.get(id);
}

// ── Write helpers (user_id is optional — null = guest) ───────────────────────

export function saveQuery(query, userId = null) {
  try { stmtSaveQuery.run(query, userId); } catch (_) {}
}

export function saveResult(query, bestModel, confidence, userId = null) {
  try { stmtSaveResult.run(query, bestModel, confidence ?? null, userId); } catch (_) {}
}

export function logAnalytics(query, intent, model, userId = null) {
  try { stmtLogAnalytics.run(query, intent, model, userId); } catch (_) {}
}

// ── Analytics read queries ────────────────────────────────────────────────────

export function getAnalytics(userId = null) {
  // When userId is provided, scope to that user; otherwise return global stats
  const userFilter = userId ? 'WHERE user_id = ?' : '';
  const params     = userId ? [userId] : [];

  const totalQueries = db.prepare(
    `SELECT COUNT(*) AS count FROM queries ${userFilter}`
  ).get(...params).count;

  const topQueries = db.prepare(`
    SELECT query, COUNT(*) AS count
    FROM queries ${userFilter}
    GROUP BY query
    ORDER BY count DESC
    LIMIT 10
  `).all(...params);

  const analyticsFilter = userId ? 'WHERE user_id = ?' : '';
  const analyticsParams = userId ? [userId] : [];

  const topIntents = db.prepare(`
    SELECT intent, COUNT(*) AS count
    FROM analytics ${analyticsFilter}
    WHERE intent IS NOT NULL
    GROUP BY intent
    ORDER BY count DESC
    LIMIT 5
  `).all(...analyticsParams);

  const topModels = db.prepare(`
    SELECT model, COUNT(*) AS count
    FROM analytics ${analyticsFilter}
    WHERE model IS NOT NULL
    GROUP BY model
    ORDER BY count DESC
    LIMIT 3
  `).all(...analyticsParams);

  return { totalQueries, topQueries, topIntents, topModels };
}

export default db;
