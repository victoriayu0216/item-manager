// src/server.js
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { getItems, getItem, createItem, updateItem, deleteItem, exportItems, takeItem, getItemLogs } from './items.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5174;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ========== ITEMS API ==========
app.get('/api/items', getItems);
app.get('/api/items/export', exportItems);
app.get('/api/items/:id', getItem);
app.post('/api/items', createItem);
app.put('/api/items/:id', updateItem);
app.delete('/api/items/:id', deleteItem); 
app.post('/api/items/:id/take', takeItem);
app.get('/api/items/:id/logs', getItemLogs);

// ========== TEST API ==========
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// ========== START SERVER ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});