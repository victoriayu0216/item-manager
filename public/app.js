// ============================================================
//  AUTH
// ============================================================
let currentUser = null;

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      window.location.href = '/login.html';
      return;
    }
    currentUser = await res.json();
const userEl = document.getElementById('userDisplay');
if (userEl && currentUser) {
    userEl.textContent = currentUser.display_name || currentUser.username;
}  } catch {
    window.location.href = '/login.html';
  }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

// ============================================================
//  API HELPER
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
//  UTILITY
// ============================================================
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
//  MODAL
// ============================================================
function openOvl() {
  document.getElementById('ovl').classList.add('show');
}
function closeOvl() {
  document.getElementById('ovl').classList.remove('show');
}
document.getElementById('ovl')?.addEventListener('click', (e) => {
  if (e.target.id === 'ovl') closeOvl();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeOvl();
});

// ============================================================
//  STATE
// ============================================================
let currentItemId = null;
let searchTimeout = null;

// ============================================================
//  LIST VIEW
// ============================================================
async function showItems() {
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
              <th>Quantity</th>
              <th>Start Date</th>
              <th>Expiry Date</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (list.length === 0) {
      html += `<tr><td colspan="7" class="empty">No items found. Add one!</td></tr>`;
    } else {
      list.forEach((item) => {
        html += `
          <tr onclick="openDetail(${item.id})" style="cursor:pointer;">
            <td><strong>${esc(item.item_code)}</strong></td>
            <td>${esc(item.bill_id) || '—'}</td>
            <td>${esc(item.item_name)}</td>
            <td>${esc(item.author) || '—'}</td>
            <td>${item.quantity || 0}</td>
            <td>${fmt(item.start_date)}</td>
            <td>${fmt(item.expiry_date)}</td>
          </tr>
        `;
      });
    }

    html += `</tbody></table></div>`;
    v.innerHTML = html;
  } catch (err) {
    v.innerHTML = `<div class="card" style="padding:20px;color:red;">❌ Error: ${err.message}</div>`;
  }
}

function searchItems() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(renderList, 300);
}

// ============================================================
//  DETAIL VIEW
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
    const logs = await fetchLogs(id);

    // ===== ACTIVITY LOG (CRM 風格，只顯示自動記錄) =====
    let logsHtml = '';
    if (logs.length === 0) {
      logsHtml = `<div class="log-empty">No activity yet.</div>`;
    } else {
      logsHtml = `<ul class="log-list">`;
      logs.forEach(log => {
        const details = log.details ? JSON.parse(log.details) : {};
        let detailText = '';

        if (log.action === 'create') {
          detailText = `Created item: ${details.item_name || ''}`;
        } else if (log.action === 'edit') {
          const changes = Object.keys(details).map(key =>
            `${key}: ${details[key].old} → ${details[key].new}`
          ).join(', ');
          detailText = `Edited: ${changes}`;
        } else if (log.action === 'take') {
          let takeText = `Took ${details.taken || 0} pcs (remaining: ${details.remaining || 0})`;
          if (details.note) takeText += ` — ${details.note}`;
          detailText = takeText;
        } else if (log.action === 'delete') {
          detailText = `Deleted item: ${details.item_name || ''}`;
        }

        logsHtml += `
          <li class="log-item">
            <div class="log-meta">
              <span class="log-time">${fmt(log.created_at)}</span>
              <span class="log-author">· ${log.author || 'System'}</span>
            </div>
            <div class="log-text">${detailText}</div>
          </li>
        `;
      });
      logsHtml += `</ul>`;
    }

   const html = `
  <div class="detail-page">
    <!-- Back to list → Return -->
    <div class="detail-topbar">
      <button class="btn" onclick="showItems()">← Back to list</button>     
    </div>

     <!-- title and edit (same line) -->
    <div class="detail-header-row">
      <h2 class="detail-title">${esc(item.item_name)}</h2>
      <div class="detail-actions">
        <button class="btn" onclick="openTakeModal(${item.id})">Take</button>
        <button class="btn primary" onclick="openItemModal(${item.id})">✎ Edit</button>
      </div>
    </div>

    <!-- detail（Board） -->
    <div class="detail-board">
      <div class="detail-grid">
        <div class="field"><span class="label">Item Code</span><span class="value">${esc(item.item_code)}</span></div>
        <div class="field"><span class="label">Bill ID</span><span class="value">${esc(item.bill_id) || '—'}</span></div>
        <div class="field"><span class="label">Author</span><span class="value">${esc(item.author) || '—'}</span></div>
        <div class="field"><span class="label">Quantity</span><span class="value">${item.quantity || 0}</span></div>
        <div class="field"><span class="label">Start Date</span><span class="value">${fmt(item.start_date)}</span></div>
        <div class="field"><span class="label">Expiry Date</span><span class="value">${fmt(item.expiry_date)}</span></div>
        <div class="field full-width">
          <span class="label">Description</span>
          <span class="value">${esc(item.description) || '—'}</span>
        </div>
        <div class="field full-width meta">
          Created: ${fmt(item.created_at)} &middot; Updated: ${fmt(item.updated_at)}
        </div>
      </div>
    </div>

    <!-- Activity Log -->
    <div class="activity-log">
      <div class="log-header">
        <h3>📋 Activity History</h3>
        <span class="log-count">${logs.length} entries</span>
      </div>
      ${logsHtml}
    </div>
  </div>
`;

    v.innerHTML = html;
  } catch (err) {
    v.innerHTML = `<div class="card" style="padding:20px;color:red;">❌ Error: ${err.message}</div>`;
  }
}

// ============================================================
//  ADD / EDIT MODAL
// ============================================================
function openItemModal(id) {
  const isEdit = !!id;

  const done = (data) => {
    const item = data || {
      item_code: '',
      bill_id: '',
      item_name: '',
      author: '',
      quantity: 1,
      start_date: new Date().toISOString().slice(0, 10),
      expiry_date: '',
      description: '',
    };

    const html = `
      <h3>${isEdit ? '✎ Edit Item' : '➕ Add Item'}</h3>
      <div class="grid2">
        <div class="field">
          <label>Item Code *</label>
          <input id="f_item_code" value="${esc(item.item_code)}" placeholder="e.g. ITEM-001" />
        </div>
        <div class="field">
          <label>Bill ID</label>
          <input id="f_bill_id" value="${esc(item.bill_id)}" />
        </div>
        <div class="field">
          <label>Item Name *</label>
          <input id="f_item_name" value="${esc(item.item_name)}" />
        </div>
        <div class="field">
          <label>Author</label>
          <input id="f_author" value="${esc(item.author)}" placeholder="Your name" />
        </div>
        <div class="field">
          <label>Quantity</label>
          <input id="f_quantity" type="number" value="${item.quantity || 1}" min="1" />
        </div>
        <div class="field">
          <label>Start Date</label>
          <input id="f_start_date" type="date" value="${item.start_date || ''}" />
        </div>
        <div class="field">
          <label>Expiry Date</label>
          <input id="f_expiry_date" type="date" value="${item.expiry_date || ''}" />
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
//  SAVE ITEM
// ============================================================
async function saveItem(id) {
  const isEdit = id !== null && id !== 'null';

  const body = {
    item_code: document.getElementById('f_item_code').value.trim(),
    bill_id: document.getElementById('f_bill_id').value.trim(),
    item_name: document.getElementById('f_item_name').value.trim(),
    author: document.getElementById('f_author').value.trim() || 'System',
    quantity: parseInt(document.getElementById('f_quantity').value, 10) || 1,
    start_date: document.getElementById('f_start_date').value,
    expiry_date: document.getElementById('f_expiry_date').value,
    description: document.getElementById('f_description').value.trim(),
  };

  if (!body.item_code || !body.item_name) {
    toast('Item Code and Item Name are required');
    return;
  }

  try {
    if (isEdit) {
      await api.send('PUT', `/api/items/${id}`, body);
      toast('Item updated!');
    } else {
      const newItem = await api.send('POST', '/api/items', body);
      toast('Item added!');
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
//  DELETE ITEM
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
//  EXPORT EXCEL
// ============================================================
function exportExcel() {
  const q = document.getElementById('search').value.trim();
  let url = '/api/items/export';
  if (q) url += `?q=${encodeURIComponent(q)}`;
  window.location.href = url;
}

// ============================================================
//  FETCH LOGS
// ============================================================
async function fetchLogs(itemId) {
  try {
    return await api.get(`/api/items/${itemId}/logs`);
  } catch {
    return [];
  }
}

// ============================================================
//  TAKE ITEM
// ============================================================
function openTakeModal(id) {
  const html = `
    <h3>Take Item</h3>
    <div class="field">
      <label>Number of items to take</label>
      <input id="f_take_quantity" type="number" value="1" min="1" />
    </div>
    <div class="field">
      <label>Author</label>
      <input id="f_take_author" placeholder="Your name" value="${localStorage.getItem('crm_user') || ''}" />
    </div>
    <div class="field">
      <label>Note (optional)</label>
      <textarea id="f_take_note" rows="2" placeholder="Remarks"></textarea>
    </div>
    <div class="row" style="margin-top:16px;">
      <button class="btn" onclick="closeOvl()">Cancel</button>
      <button class="btn primary" onclick="confirmTake(${id})">Confirm Take</button>
    </div>
  `;
  document.getElementById('modal').innerHTML = html;
  openOvl();
}

async function confirmTake(id) {
  const quantity = parseInt(document.getElementById('f_take_quantity').value, 10) || 1;
  const author = document.getElementById('f_take_author').value.trim() || 'System';
  const note = document.getElementById('f_take_note').value.trim();

  if (quantity <= 0) {
    toast('Please enter a valid quantity');
    return;
  }

  try {
    const result = await api.send('POST', `/api/items/${id}/take`, { quantity, author, note });
    toast(`Took ${quantity} item(s). Remaining: ${result.quantity}`);
    closeOvl();
    await renderDetail();
  } catch (err) {
    toast('Error: ' + err.message);
  }
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await checkSession();
  showItems();
});