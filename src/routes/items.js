// src/routes/items.js
import db from '../db.js';
import xlsx from 'xlsx';

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
  const { item_code, bill_id, item_name, author, item_date, description } = req.body;

  if (!item_code || !item_name) {
    return res.status(400).json({ error: 'item_code and item_name are required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO items (item_code, bill_id, item_name, author, item_date, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(item_code, bill_id || null, item_name, author || null, item_date || null, description || null);

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
  const { item_code, bill_id, item_name, author, item_date, description } = req.body;


  if (!item_code || !item_name) {
    return res.status(400).json({ error: 'item_code and item_name are required' });
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
        description = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(item_code, bill_id || null, item_name, author || null, item_date || null, description || null, id);

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
    'Uni Key': item.item_code,
    'Bill ID': item.bill_id || '',
    'Item Name': item.item_name,
    'Author': item.author || '',
    'Date': item.item_date || '',
    'Description': item.description || '',
    'Created At': item.created_at ? new Date(item.created_at.replace(' ', 'T') + 'Z').toLocaleString('en-GB', { timeZone: 'Asia/Hong_Kong', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
'Updated At': item.updated_at ? new Date(item.updated_at.replace(' ', 'T') + 'Z').toLocaleString('en-GB', { timeZone: 'Asia/Hong_Kong', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
  }));

  // 如果冇數據，都出一個空嘅 workbook（避免 error）
  if (data.length === 0) {
    // 加一行提示
    data.push({
      'Uni Key': 'No data found',
      'Bill ID': '',
      'Item Name': '',
      'Author': '',
      'Date': '',
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