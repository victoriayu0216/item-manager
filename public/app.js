// ============================================================
//  1. API HELPER
// ============================================================
const api = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.json()).error || res.status);
    return res.json();
  },
  async send(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error((await res.json()).error || res.status);
    return res.json();
  },
};

// ============================================================
//  2. UTILITY FUNCTIONS
// ============================================================
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[c]));
}

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Hong_Kong',
  });
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ============================================================
//  3. MODAL CONTROL
// ============================================================
function openOvl() {
  document.getElementById('ovl').classList.add('show');
}
function closeOvl() {
  document.getElementById('ovl').classList.remove('show');
}
// 點擊 overlay 背景關閉
document.getElementById('ovl')?.addEventListener('click', (e) => {
  if (e.target.id === 'ovl') closeOvl();
});
// ESC 鍵關閉
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeOvl();
});

// ============================================================
//  4. STATE
// ============================================================
let currentItemId = null; // 用於 Detail 頁
let searchTimeout = null;

// ============================================================
//  5. LIST VIEW
// ============================================================
async function showItems() {
  // 更新導航高亮
  document.querySelectorAll('.nav button').forEach((b) => b.classList.remove('active'));
  document.getElementById('nav-items')?.classList.add('active');

  document.getElementById('title').textContent = 'Items';
  document.getElementById('searchWrap').style.display = 'flex';
  currentItemId = null;
  await renderList();
}

async function renderList() {
  const q = document.getElementById('search').value.trim();
  const v = document.getElementById('view');

  try {
    const list = await api.get(`/api/items?q=${encodeURIComponent(q)}`);

    let html = `
      <div class="toolbar">
        <div>
          <button class="btn primary" onclick="openItemModal(null)">➕ Add Item</button>
          <button class="btn" onclick="exportExcel()">↓ Export Excel</button>

        </div>
        <span class="muted">${list.length} items</span>
      </div>
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Bill ID</th>
              <th>Item Name</th>
              <th>Author</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (list.length === 0) {
      html += `<tr><td colspan="5" class="empty">No items found. Add one!</td></tr>`;
    } else {
      list.forEach((item) => {
        html += `
          <tr onclick="openDetail(${item.id})" style="cursor:pointer;">
            <td><strong>${esc(item.item_code)}</strong></td>
            <td>${esc(item.bill_id) || '—'}</td>
            <td>${esc(item.item_name)}</td>
            <td>${esc(item.author) || '—'}</td>
            <td>${fmt(item.item_date)}</td>
          </tr>
        `;
      });
    }

    html += `
          </tbody>
        </table>
      </div>
    `;

    v.innerHTML = html;
  } catch (err) {
    v.innerHTML = `<div class="card" style="padding:20px;color:red;">❌ Error: ${err.message}</div>`;
  }
}

// 搜尋 debounce
function searchItems() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(renderList, 300);
}

// ============================================================
//  6. DETAIL VIEW
// ============================================================
async function openDetail(id) {
  currentItemId = id;
  await renderDetail();
}

async function renderDetail() {
  const id = currentItemId;
  if (!id) { showItems(); return; }

  document.getElementById('searchWrap').style.display = 'none';
  document.getElementById('title').textContent = 'Item Detail';
  const v = document.getElementById('view');

  try {
    const item = await api.get(`/api/items/${id}`);

    const html = `
      <div class="detail-card">
        <div style="margin-bottom:12px;">
          <button class="btn" onclick="showItems()">← Back to list</button>
        </div>
        <div class="detail-header">
          <h2>${esc(item.item_name)}</h2>
          <div class="actions">
            <button class="btn primary" onclick="openItemModal(${item.id})">✎ Edit</button>
          </div>
        </div>
        <div class="detail-grid">
          <div class="field"><span class="label">Item Code</span><span class="value">${esc(item.item_code)}</span></div>
          <div class="field"><span class="label">Bill ID</span><span class="value">${esc(item.bill_id) || '—'}</span></div>
          <div class="field"><span class="label">Author</span><span class="value">${esc(item.author) || '—'}</span></div>
          <div class="field"><span class="label">Date</span><span class="value">${fmt(item.item_date)}</span></div>
          <div class="field" style="grid-column:1/-1;">
            <span class="label">Description</span>
            <span class="value">${esc(item.description) || '—'}</span>
          </div>
          <div class="field" style="grid-column:1/-1; color:#94a3b8; font-size:12px; border-top:1px solid #e2e8f0; padding-top:12px; margin-top:4px;">
            Created: ${fmt(item.created_at)} &middot; Updated: ${fmt(item.updated_at)}
          </div>
        </div>
      </div>
    `;

    v.innerHTML = html;
  } catch (err) {
    v.innerHTML = `<div class="card" style="padding:20px;color:red;">❌ Error: ${err.message}</div>`;
  }
}

// ============================================================
//  7. ADD / EDIT MODAL
// ============================================================
function openItemModal(id) {
  const isEdit = !!id;

  const done = (data) => {
    const item = data || {
      item_code: '',
      bill_id: '',
      item_name: '',
      author: '',
      item_date: new Date().toISOString().slice(0, 10),
      description: '',
    };

    const html = `
      <h3>${isEdit ? '✎ Edit Item' : '➕ Add Item'}</h3>
      <div class="grid2">
        <div class="field">
          <label>Item code *</label>
          <input id="f_item_code" value="${esc(item.item_code)}" placeholder="e.g. ITEM-001" />
        </div>
        <div class="field">
          <label>Bill ID</label>
          <input id="f_bill_id" value="${esc(item.bill_id)}"/>
        </div>
        <div class="field">
          <label>Item Name *</label>
          <input id="f_item_name" value="${esc(item.item_name)}"/>
        </div>
        <div class="field">
          <label>Author</label>
          <input id="f_author" value="${esc(item.author)}" placeholder="Your name" />
        </div>
        <div class="field">
          <label>Date</label>
          <input id="f_item_date" type="date" value="${item.item_date || ''}" />
        </div>
      </div>
      <div class="field" style="grid-column:1/-1;">
        <label>Description</label>
        <textarea id="f_description" rows="3" placeholder="Optional notes...">${esc(item.description)}</textarea>
      </div>
      <div class="row">
        ${isEdit ? `<button class="btn danger" onclick="deleteItem(${id})">Delete</button>` : ''}
        <div style="flex:1;"></div>
        <button class="btn" onclick="closeOvl()">Cancel</button>
        <button class="btn primary" onclick="saveItem(${id || 'null'})">Save</button>
      </div>
    `;

    document.getElementById('modal').innerHTML = html;
    openOvl();
  };

  if (isEdit) {
    api.get(`/api/items/${id}`).then(done).catch((err) => {
      toast('Error loading item: ' + err.message);
      closeOvl();
    });
  } else {
    done(null);
  }
}

// ============================================================
//  8. SAVE ITEM (Add / Edit)
// ============================================================
async function saveItem(id) {
  const isEdit = id !== null && id !== 'null';

  const body = {
    item_code: document.getElementById('f_item_code').value.trim(),
    bill_id: document.getElementById('f_bill_id').value.trim(),
    item_name: document.getElementById('f_item_name').value.trim(),
    author: document.getElementById('f_author').value.trim() || 'System',
    item_date: document.getElementById('f_item_date').value,
    description: document.getElementById('f_description').value.trim(),
  };

  // 驗證必填
  if (!body.item_code || !body.item_name) {
    toast('Uni Key and Item Name are required');
    return;
  }

  try {
    if (isEdit) {
      await api.send('PUT', `/api/items/${id}`, body);
      toast('Item updated!');
    } else {
      const newItem = await api.send('POST', '/api/items', body);
      toast('Item added!');
      // 如果係新增，跳去新 item 嘅 detail
      currentItemId = newItem.id;
      closeOvl();
      await renderDetail();
      return;
    }
    closeOvl();
    if (currentItemId) {
      await renderDetail();
    } else {
      await renderList();
    }
  } catch (err) {
    toast('Error: ' + err.message);
  }
}

// ============================================================
//  9. DELETE ITEM
// ============================================================
async function deleteItem(id) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  try {
    await api.send('DELETE', `/api/items/${id}`);
    toast('Deleted');
    closeOvl();
    currentItemId = null;
    await showItems();
  } catch (err) {
    toast('Error: ' + err.message);
  }
}

// ============================================================
//  10. INIT - Load items on page load
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  showItems();
});

// ============================================================
//  11. EXPORT EXCEL
// ==========================x==================================
function exportExcel() {
  const q = document.getElementById('search').value.trim();
  let url = '/api/items/export';
  if (q) {
    url += `?q=${encodeURIComponent(q)}`;
  }
  // 直接用瀏覽器下載
  window.location.href = url;
}