// src/db.js
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'items.db');

const db = new Database(dbPath);

// 啟用 Foreign Key 約束
db.pragma('foreign_keys = ON');

// 建立 items 表（如果未存在）
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT UNIQUE NOT NULL,
    bill_id TEXT,
    item_name TEXT NOT NULL,
    author TEXT,
    item_date TEXT,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

// 如果 items 表已存在但冇 quantity 欄位，就加返
try {
  db.exec(`ALTER TABLE items ADD COLUMN quantity INTEGER DEFAULT 1`);
} catch (e) {
  // 如果欄位已存在，會出 error，ignore
  if (!e.message.includes('duplicate column name')) {
    console.warn('⚠️ 加 quantity 欄位時出錯:', e.message);
  }
}

// 建立 activity_log 表
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    author TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  )
`);

console.log('✅ Database connected and tables ready');
export default db;