// src/routes/items.js
import db from './db.js';
import xlsx from 'xlsx';

// ===== ACTIVITY LOG =====
function addLog(itemId, action, author, details) {
  const stmt = db.prepare(`
    INSERT INTO activity_log (item_id, action, author, details, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);
  stmt.run(itemId, action, author || 'System', details || '{}');
}

export function getItems(req, res) {
  const { q } = req.query;
  let sql = 'SELECT * FROM items';
  const params = [];

  if (q) {
    sql += ' WHERE item_code LIKE ? OR item_name LIKE ? OR bill_id LIKE ?';
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  sql += ' ORDER BY id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
}

// 2. GET /api/items/:id 
export function getItem(req, res) {
  const id = req.params.id;
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(row);
}

// 3. POST /api/items
export function createItem(req, res) {
  const { item_code, bill_id, item_name, author, item_date,quantity, description } = req.body;

  if (!item_code || !item_name) {
    return res.status(400).json({ error: 'item_code and item_name are required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO items (item_code, bill_id, item_name, author, item_date, quantity, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(item_code, bill_id || null, item_name, author || null, item_date || null, quantity || 1, description || null);

    // 新增後記錄
addLog(result.lastInsertRowid, 'create', author || 'System', JSON.stringify({
  item_code, bill_id, item_name, quantity: quantity || 1
}));

    const newItem = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newItem);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Item code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
}

// 4. PUT /api/items/:id
export function updateItem(req, res) {
  const id = req.params.id;
  const { item_code, bill_id, item_name, author, item_date,quantity, description } = req.body;

  if (!item_code || !item_name) {
    return res.status(400).json({ error: 'item_code and item_name are required' });
  }

  const old = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!old) {
  return res.status(404).json({ error: 'Item not found' });
}

  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Item not found' });
  }

  try {
    db.prepare(`
      UPDATE items SET
        item_code = ?,
        bill_id = ?,
        item_name = ?,
        author = ?,
        item_date = ?,
        quantity = ?,
        description = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(item_code, bill_id || null, item_name, author || null, item_date || null, quantity || 1, description || null, id);

    // 記錄改動
    const changes = {};
    if (old.item_name !== item_name) changes.item_name = { old: old.item_name, new: item_name };
    if (old.quantity !== quantity) changes.quantity = { old: old.quantity, new: quantity || 1 };
    if (old.bill_id !== bill_id) changes.bill_id = { old: old.bill_id, new: bill_id };
    if (old.item_code !== item_code) changes.item_code = { old: old.item_code, new: item_code };
    if (Object.keys(changes).length > 0) {
      addLog(id, 'edit', author || 'System', JSON.stringify(changes));
    }

    const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Item code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
}

// 5. DELETE /api/items/:id 
export function deleteItem(req, res) {
  const id = req.params.id;

  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Item not found' });
  }

  addLog(id, 'delete', 'System', JSON.stringify({
    item_code: existing.item_code,
    item_name: existing.item_name,
    quantity: existing.quantity
  }));


  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  res.json({ ok: true, message: 'Item deleted successfully' });
}

// 6. GET /api/items/export - 匯出 Excel
export function exportItems(req, res) {
  const { q } = req.query;
  let sql = 'SELECT * FROM items';
  const params = [];

  if (q) {
    sql += ' WHERE item_code LIKE ? OR item_name LIKE ? OR bill_id LIKE ?';
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  sql += ' ORDER BY id DESC';
  const rows = db.prepare(sql).all(...params);

  // 準備 Excel 數據（轉做中文欄位名）
  const data = rows.map((item) => ({
    'Item Code': item.item_code,
    'Bill ID': item.bill_id || '',
    'Item Name': item.item_name,
    'Author': item.author || '',
    'Date': item.item_date || '',
    'quantity': item.quantity || 0,
    'Description': item.description || '',
    'Created At': item.created_at ? new Date(item.created_at.replace(' ', 'T') + 'Z').toLocaleString('en-GB', { timeZone: 'Asia/Hong_Kong', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
'Updated At': item.updated_at ? new Date(item.updated_at.replace(' ', 'T') + 'Z').toLocaleString('en-GB', { timeZone: 'Asia/Hong_Kong', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
  }));

  // 如果冇數據，都出一個空嘅 workbook（避免 error）
  if (data.length === 0) {
    // 加一行提示
    data.push({
      'Item Code': 'No data found',
      'Bill ID': '',
      'Item Name': '',
      'Author': '',
      'Date': '',
      'quantity': '',
      'Description': '',
      'Created At': '',
      'Updated At': '',
    });
  }

  // 建立 Workbook
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(data);
  xlsx.utils.book_append_sheet(wb, ws, 'Items');

  // 生成 Buffer
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // 設定 Response Header
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="items_${new Date().toISOString().slice(0,10)}.xlsx"`);
  res.send(buffer);
}

// 7. POST /api/items/:id/take - 取走物品（減少數量）
export function takeItem(req, res) {
  const id = req.params.id;
  const { quantity, author, note } = req.body;  // ← 加入 note
  const takeQty = parseInt(quantity) || 1;

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const newQty = (item.quantity || 0) - takeQty;
  if (newQty < 0) {
    return res.status(400).json({ error: 'Not enough quantity' });
  }

  db.prepare('UPDATE items SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(newQty, id);

  // 記錄取走（包括 note）
  const details = {
    taken: takeQty,
    previous: item.quantity,
    remaining: newQty
  };
  if (note) {
    details.note = note;
  }
  addLog(id, 'take', author || 'System', JSON.stringify(details));

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json(updated);
}

// 8. GET /api/items/:id/logs - 攞活動記錄
export function getItemLogs(req, res) {
  const id = req.params.id;
  const logs = db.prepare(`
    SELECT * FROM activity_log WHERE item_id = ? ORDER BY created_at DESC
  `).all(id);
  res.json(logs);
}