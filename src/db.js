import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';  

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'items.db');

const db = new Database(dbPath);

// 啟用 Foreign Key 約束
db.pragma('foreign_keys = ON');

// 建立 users 表（如果未存在）
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin','manager','staff','viewer')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_branches (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, branch_id)
);

`);

// 建立 items 表（如果未存在）
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_code TEXT UNIQUE NOT NULL,
    bill_id TEXT,
    item_name TEXT NOT NULL,
    author TEXT,
    start_date TEXT,
    expiry_date TEXT,
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

// ===== SEED ADMIN USER =====
try {
  const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (userCount === 0) {
    // 檢查 users 表有咩欄位（自動適應）
    const tableInfo = db.prepare('PRAGMA table_info(users)').all();
    const hasPasswordHash = tableInfo.some(col => col.name === 'password_hash');
    const hasPassword = tableInfo.some(col => col.name === 'password');
    const hasIsActive = tableInfo.some(col => col.name === 'is_active');

    const hash = bcrypt.hashSync('admin123', 10);
    const passwordField = hasPasswordHash ? 'password_hash' : 'password';

    let sql = `INSERT INTO users (username, ${passwordField}, display_name, role`;
    let values = `'admin', '${hash}', 'Administrator', 'admin'`;

    if (hasIsActive) {
      sql += `, is_active`;
      values += `, 1`;
    }
    sql += `) VALUES (${values})`;

    db.prepare(sql).run();
    console.log(`✅ Seeded admin user (admin / admin123) using field: ${passwordField}`);
  }
} catch (err) {
  console.warn('⚠️ Seed admin skipped (users table might not exist yet):', err.message);
}

console.log('✅ Database connected and tables ready');
export default db;