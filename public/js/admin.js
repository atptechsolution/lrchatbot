'use strict';

const socket = io();
const ADMIN_MOBILE = '8085074606';

window.addEventListener('load', () => {
  if (localStorage.getItem('mobile') !== ADMIN_MOBILE) location.href = '/login.html';
});

let users = {};
let mode = 'live';
let activeUser = null;

/* ──────────────────────────────
   IST HELPERS
────────────────────────────── */
function fmtTime(d) {
  const date = d ? new Date(d) : new Date();
  return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
}
function fmtDateLabel(d) {
  const date = d ? new Date(d) : new Date();
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const dS = date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  const tS = today.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  const yS = yest.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  if (dS === tS) return 'Today';
  if (dS === yS) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
}

/* ──────────────────────────────
   LOAD OLD CHATS
────────────────────────────── */
async function loadOldChats() {
  const data = await fetch('/admin/chats').then(r => r.json());
  users = {};
  data.forEach(m => {
    if (!users[m.userId]) users[m.userId] = { name: m.userName, mobile: m.userMobile, pdfs: [] };
    users[m.userId].pdfs.push(m);
  });
}

/* ──────────────────────────────
   SOCKET
────────────────────────────── */
socket.on('adminMessage', data => {
  if (!data.userId) return;
  if (!users[data.userId]) users[data.userId] = { name: data.userName, mobile: data.userMobile, pdfs: [] };
  users[data.userId].pdfs.unshift(data);
  if (mode === 'live') renderLive();
  if (mode === 'chat' && activeUser === data.userId) renderUser(data.userId);
});

/* ──────────────────────────────
   ACTIVE TAB HIGHLIGHT
────────────────────────────── */
function setActiveTab(name) {
  document.querySelectorAll('.admin-top .tab-btn').forEach((b, i) => {
    b.classList.toggle('active', ['chats','live','report'][i] === name);
  });
}

/* ──────────────────────────────
   REPORTS TAB
────────────────────────────── */
function showReport() {
  mode = 'report';
  activeUser = null;
  setActiveTab('report');
  document.getElementById('sidebar').style.display = 'none';

  document.getElementById('adminChat').innerHTML = `
    <h3>📊 LR Report</h3>
    <div class="report-filters">
      <select id="rTemplate">
        <option value="all">All Templates</option>
        <option value="av-logistics.ejs">A.V Logistics</option>
        <option value="namaskarm-road-lines.ejs">Namaskarm</option>
        <option value="maruti.ejs">Maruti</option>
      </select>
      <input type="date" id="rFrom">
      <input type="date" id="rTo">
      <button onclick="loadReport()">View</button>
      <button class="export-btn" onclick="exportReport()">⬇ Download Excel</button>
    </div>
    <div id="reportTable"></div>`;
}

async function loadReport() {
  const template = document.getElementById('rTemplate').value;
  const from = document.getElementById('rFrom').value;
  const to = document.getElementById('rTo').value;

  let url = `/admin/report/preview?template=${template}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;

  const data = await fetch(url).then(r => r.json());
  const box = document.getElementById('reportTable');

  if (!data.length) { box.innerHTML = '<p>❌ No data found</p>'; return; }

  box.innerHTML = `
    <table class="report-table">
      <thead><tr>
        <th>Date</th><th>User</th><th>Mobile</th><th>Template</th>
        <th>Vehicle</th><th>From</th><th>To</th><th>Weight</th><th>Description</th><th>PDF</th>
      </tr></thead>
      <tbody>
        ${data.map(r => `
          <tr>
            <td data-label="Date">${new Date(r.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
            <td data-label="User">${r.userName}</td>
            <td data-label="Mobile">${r.userMobile}</td>
            <td data-label="Template">${r.templateName || '-'}</td>
            <td data-label="Vehicle">${r.truckNumber || '-'}</td>
            <td data-label="From">${r.from || '-'}</td>
            <td data-label="To">${r.to || '-'}</td>
            <td data-label="Weight">${r.weight || '-'}</td>
            <td data-label="Description">${r.description || '-'}</td>
            <td data-label="PDF">${r.pdfLink ? `<a href="${r.pdfLink}" target="_blank">⬇ PDF</a>` : '-'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function exportReport() {
  const template = document.getElementById('rTemplate').value;
  const from = document.getElementById('rFrom').value;
  const to = document.getElementById('rTo').value;
  let url = `/admin/report/export?template=${template}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;
  window.open(url, '_blank');
}

/* ──────────────────────────────
   LIVE PDFs
────────────────────────────── */
function showLive() {
  mode = 'live';
  activeUser = null;
  setActiveTab('live');
  document.getElementById('sidebar').style.display = 'none';
  renderLive();
}

function renderLive() {
  const chat = document.getElementById('adminChat');
  chat.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'chat-date';
  title.textContent = '⚡ Live PDFs';
  chat.appendChild(title);

  const all = [];
  Object.values(users).forEach(u => u.pdfs.forEach(p => all.push({ ...p, userName: u.name, userMobile: u.mobile })));
  all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  let lastDate = '';
  all.forEach(p => {
    const label = fmtDateLabel(p.createdAt);
    if (label !== lastDate) {
      const sep = document.createElement('div');
      sep.className = 'chat-date';
      sep.textContent = label;
      chat.appendChild(sep);
      lastDate = label;
    }
    const div = document.createElement('div');
    div.className = 'admin-msg';
    div.innerHTML = `
      <strong>${p.userName}</strong> (${p.userMobile})<br>
      📝 ${p.message || '-'}<br>
      🚚 <b>${p.truckNumber || '-'}</b> | ⚖️ ${p.weight || '-'} | ${p.to ? `→ ${p.to}` : ''}<br>
      ${p.pdfLink ? `
        <iframe src="${p.pdfLink}" loading="lazy"></iframe>
        <div class="msg-actions">
          <a class="dl-btn" href="${p.pdfLink}" target="_blank" download>⬇ Download</a>
          <button class="dl-btn" style="border:none;cursor:pointer" onclick="adminSharePDF('${p.pdfLink}','${p.truckNumber}')">
            ↗ Share
          </button>
        </div>` : ''}
      <small>${fmtTime(p.createdAt)}</small>`;
    chat.appendChild(div);
  });
}

function adminSharePDF(pdfLink, truck) {
  const url = window.location.origin + pdfLink;
  if (navigator.share) {
    navigator.share({ title: `LR - ${truck}`, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => alert('✅ Link copied!'));
  }
}

/* ──────────────────────────────
   CHATS (USERS)
────────────────────────────── */
function showChats() {
  mode = 'chat';
  activeUser = null;
  setActiveTab('chats');
  document.getElementById('sidebar').style.display = 'block';
  loadUsers();
  document.getElementById('adminChat').innerHTML = `
    <div class="empty-state"><p>👈 Select a user</p></div>`;
}

async function loadUsers() {
  const data = await fetch('/admin/users').then(r => r.json());
  const list = document.getElementById('usersList');
  list.innerHTML = '';
  data.forEach(u => {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.onclick = () => openUser(u._id);
    card.innerHTML = `
      <div class="user-info">
        <div class="avatar">${u.name[0].toUpperCase()}</div>
        <div class="details">
          <strong>${u.name}</strong>
          <small>${u.mobile}</small>
          <small>${u.approved ? '✅ Approved' : '⏳ Pending'}</small>
        </div>
      </div>
      <div class="user-actions">
        <select class="template-dd" onclick="event.stopPropagation()" onchange="changeTemplate('${u._id}',this.value)">
          <option value="">Template</option>
          <option value="av-logistics.ejs" ${u.assignedTemplate === 'av-logistics.ejs' ? 'selected' : ''}>A.V Logistics</option>
          <option value="namaskarm-road-lines.ejs" ${u.assignedTemplate === 'namaskarm-road-lines.ejs' ? 'selected' : ''}>Namaskarm</option>
          <option value="maruti.ejs" ${u.assignedTemplate === 'maruti.ejs' ? 'selected' : ''}>Maruti</option>
        </select>
        ${!u.approved ? `<button class="icon-btn approve" onclick="approveUser('${u._id}',event)" title="Approve">✅</button>` : ''}
        <button class="icon-btn danger" onclick="deleteUser('${u._id}',event)" title="Delete">🗑</button>
      </div>`;
    list.appendChild(card);
  });
}

async function approveUser(id, e) {
  e.stopPropagation();
  await fetch(`/admin/approve/${id}`, { method: 'POST' });
  loadUsers();
}

async function deleteUser(id, e) {
  e.stopPropagation();
  if (!confirm('Delete user and all their data?')) return;
  await fetch(`/admin/user/${id}`, { method: 'DELETE' });
  loadUsers();
}

async function changeTemplate(userId, template) {
  if (!template) return;
  await fetch(`/admin/template/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template }),
  });
  showToastAdmin('✅ Template changed');
}

function showToastAdmin(text) {
  const t = document.createElement('div');
  t.textContent = text;
  Object.assign(t.style, {
    position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
    background: '#075e54', color: '#fff', padding: '8px 16px', borderRadius: '20px',
    fontSize: '13px', zIndex: '9999',
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

/* ──────────────────────────────
   OPEN USER CHAT
────────────────────────────── */
function openUser(id) {
  activeUser = id;
  document.getElementById('sidebar').style.display = 'none';
  renderUser(id);
}

function renderUser(id) {
  const u = users[id];
  if (!u) return;
  const chat = document.getElementById('adminChat');
  chat.innerHTML = '';

  const backBtn = document.createElement('button');
  backBtn.className = 'back-btn';
  backBtn.textContent = '← Back';
  backBtn.onclick = showChats;
  chat.appendChild(backBtn);

  const h = document.createElement('h3');
  h.style.cssText = 'margin:0 8px 8px;font-size:16px';
  h.textContent = `${u.name} (${u.mobile})`;
  chat.appendChild(h);

  let lastDate = '';
  u.pdfs.forEach(p => {
    const label = fmtDateLabel(p.createdAt);
    if (label !== lastDate) {
      const sep = document.createElement('div');
      sep.className = 'chat-date';
      sep.textContent = label;
      chat.appendChild(sep);
      lastDate = label;
    }
    const div = document.createElement('div');
    div.className = 'admin-msg';
    div.innerHTML = `
      📝 ${p.message || '-'}<br>
      🚚 <b>${p.truckNumber || '-'}</b> | ⚖️ ${p.weight || '-'}
      ${p.from ? ` | ${p.from} → ${p.to}` : ''}<br>
      ${p.pdfLink ? `
        <iframe src="${p.pdfLink}" loading="lazy"></iframe>
        <div class="msg-actions">
          <a class="dl-btn" href="${p.pdfLink}" target="_blank" download>⬇ Download</a>
          <button class="dl-btn" style="border:none;cursor:pointer" onclick="adminSharePDF('${p.pdfLink}','${p.truckNumber}')">↗ Share</button>
        </div>` : ''}
      <small>${fmtTime(p.createdAt)}</small>`;
    chat.appendChild(div);
  });
}

/* ── Init ── */
(async () => {
  await loadOldChats();
  showLive();
})();
