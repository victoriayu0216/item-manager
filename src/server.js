// src/server.js
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import session from 'express-session';
import bcrypt from 'bcrypt';
import db from './db.js';
import { getItems, getItem, createItem, updateItem, deleteItem, exportItems, takeItem, getItemLogs } from './items.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5174;

// ===== MIDDLEWARE =====
app.use(express.json());

// ===== SESSION (一定要放喺所有 route 之前) =====
app.use(session({
  secret: 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ===== AUTH ROUTES =====
// Login API
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.user = {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role
  };
  res.json({ ok: true });
});

// 檢查 Session
app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(req.session.user);
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// ===== PROTECTED ROUTE: 主頁 =====
app.get('/', (req, res) => {
  if (req.session.user) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  } else {
    res.redirect('login.html');
  }
});

// ===== STATIC FILES (放喺 route 後面, 做 fallback) =====
app.use(express.static(path.join(__dirname, '..', 'public')));

// ===== ITEMS API =====
app.get('/api/items', getItems);
app.get('/api/items/export', exportItems);
app.get('/api/items/:id', getItem);
app.post('/api/items', createItem);
app.put('/api/items/:id', updateItem);
app.delete('/api/items/:id', deleteItem);
app.post('/api/items/:id/take', takeItem);
app.get('/api/items/:id/logs', getItemLogs);

// ===== TEST API =====
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// ===== START SERVER =====
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});