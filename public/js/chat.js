'use strict';

const socket = io();
const mobile = localStorage.getItem('mobile');

window.addEventListener('load', () => {
  if (!mobile) location.href = '/login.html';
});

const CHAT_KEY = `chat_${mobile}`;
const LIVE_KEY = 'live_pdfs';

let mode = 'chat';
let livePDFs = [];

/* ──────────────────────────────
   DATE / TIME HELPERS
────────────────────────────── */
function toIST(d) {
  const date = d ? new Date(d) : new Date();
  return isNaN(date.getTime()) ? new Date() : date;
}

function fmtTime(d) {
  return toIST(d).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateLabel(d) {
  const date = toIST(d);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const dS = date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  const tS = today.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  const yS = yesterday.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
  if (dS === tS) return 'Today';
  if (dS === yS) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
}

/* ──────────────────────────────
   TEXTAREA AUTO-RESIZE
────────────────────────────── */
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

/* ──────────────────────────────
   PDF CARD HTML (with Share btn)
────────────────────────────── */
function pdfCardHTML(pdfLink, pdfName, truckNumber, from, to, weight, description) {
  const fullUrl = window.location.origin + pdfLink;
  const shareData = {
    title: `LR - ${truckNumber}`,
    text: `LR: ${truckNumber}\nFrom: ${from || '-'} → To: ${to || '-'}\nWeight: ${weight}\nGoods: ${description}`,
    url: fullUrl,
  };
  const canShare = navigator.share && navigator.canShare && navigator.canShare(shareData);

  return `
    <div class="pdf-card">
      <div class="lr-info">
        🚚 <b>${truckNumber}</b>${from ? ` | ${from} → ${to}` : ` → ${to}`}<br>
        ⚖️ ${weight} &nbsp;|&nbsp; 📦 ${description}
      </div>
      <div class="pdf-actions">
        <a class="pdf-btn download" href="${pdfLink}" target="_blank" download="${pdfName}">
          <svg viewBox="0 0 24 24" fill="white"><path d="M5 20h14v-2H5v2zm7-4l-5-5 1.4-1.4 2.6 2.6V4h2v8.2l2.6-2.6L17 11l-5 5z"/></svg>
          Download
        </a>
        ${canShare ? `
        <button class="pdf-btn share" onclick="sharePDF(${JSON.stringify(shareData).replace(/"/g,'&quot;')})">
          <svg viewBox="0 0 24 24" fill="white"><path d="M18 16c-.8 0-1.5.3-2 .8L8.9 12 16 7.2c.5.5 1.2.8 2 .8 1.7 0 3-1.3 3-3S19.7 2 18 2s-3 1.3-3 3c0 .2 0 .5.1.7L7.9 10.5C7.4 10 6.7 9.7 6 9.7c-1.7 0-3 1.3-3 3s1.3 3 3 3c.7 0 1.4-.3 1.9-.8l7.2 4.8c-.1.2-.1.4-.1.6 0 1.7 1.3 3 3 3s3-1.3 3-3-1.3-3-3-3z"/></svg>
          Share
        </button>` : `
        <button class="pdf-btn share" onclick="copyLink('${fullUrl}')">
          <svg viewBox="0 0 24 24" fill="white"><path d="M16 1H4C3 1 2 2 2 3v14h2V3h12V1zm3 4H8C7 5 6 6 6 7v14c0 1 1 2 2 2h11c1 0 2-1 2-2V7c0-1-1-2-2-2zm0 16H8V7h11v14z"/></svg>
          Copy Link
        </button>`}
      </div>
    </div>`;
}

/* ──────────────────────────────
   SHARE / COPY HELPERS
────────────────────────────── */
function sharePDF(shareData) {
  if (navigator.share) navigator.share(shareData).catch(() => {});
}

function copyLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('✅ Link copied!');
  }).catch(() => {
    prompt('Copy this link:', url);
  });
}

function showToast(text) {
  const t = document.createElement('div');
  t.textContent = text;
  Object.assign(t.style, {
    position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
    background: '#333', color: '#fff', padding: '8px 16px', borderRadius: '20px',
    fontSize: '13px', zIndex: '9999', pointerEvents: 'none',
  });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

/* ──────────────────────────────
   STORAGE
────────────────────────────── */
function saveMsg(type, html) {
  const saved = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
  saved.push({ type, html, time: new Date().toISOString() });
  // Keep last 200 messages
  if (saved.length > 200) saved.splice(0, saved.length - 200);
  localStorage.setItem(CHAT_KEY, JSON.stringify(saved));
}

/* ──────────────────────────────
   APPEND MESSAGE TO DOM
────────────────────────────── */
function appendMsg(type, html, time) {
  const chat = document.getElementById('chat');
  const label = fmtDateLabel(time);
  const lastLabel = chat.querySelector('.chat-date:last-of-type')?.textContent;
  if (label !== lastLabel) {
    const sep = document.createElement('div');
    sep.className = 'chat-date';
    sep.textContent = label;
    chat.appendChild(sep);
  }
  const div = document.createElement('div');
  div.className = `msg ${type}`;
  div.innerHTML = `${html}<div class="msg-time">${fmtTime(time)}</div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

/* ──────────────────────────────
   LOAD CHAT FROM STORAGE
────────────────────────────── */
function loadChat() {
  const chat = document.getElementById('chat');
  chat.innerHTML = '';
  const saved = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]');
  saved.forEach(m => appendMsg(m.type, m.html, m.time));
}

/* ──────────────────────────────
   MODES
────────────────────────────── */
function showChat() {
  mode = 'chat';
  document.getElementById('chatInput').style.display = 'flex';
  loadChat();
}

function showLive() {
  mode = 'live';
  document.getElementById('chatInput').style.display = 'none';
  renderLive();
}

function renderLive() {
  livePDFs = JSON.parse(localStorage.getItem(LIVE_KEY) || '[]');
  const chat = document.getElementById('chat');
  chat.innerHTML = '<div class="chat-date">⚡ Live PDFs</div>';
  livePDFs.forEach(p => {
    const div = document.createElement('div');
    div.className = 'msg bot';
    div.innerHTML = `
      <b>${p.userName || 'User'}</b> (${p.userMobile || '-'})<br>
      📝 ${p.message || '-'}<br>
      ${p.pdfLink ? pdfCardHTML(p.pdfLink, `LR_${p.truckNumber}.pdf`, p.truckNumber, p.from, p.to, p.weight, p.description) : ''}
      <div class="msg-time">${fmtTime(p.createdAt)}</div>`;
    chat.appendChild(div);
  });
  chat.scrollTop = chat.scrollHeight;
}

/* ──────────────────────────────
   SEND MESSAGE
────────────────────────────── */
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}

function send() {
  if (mode !== 'chat') return;
  const input = document.getElementById('msg');
  const msg = input.value.trim();
  if (!msg) return;

  const now = new Date().toISOString();
  const html = escapeHtml(msg);
  appendMsg('user', html, now);
  saveMsg('user', html);

  socket.emit('userMessage', { mobile, message: msg });

  input.value = '';
  input.style.height = 'auto';
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ──────────────────────────────
   SOCKET EVENTS
────────────────────────────── */
socket.on('botMessage', data => {
  if (mode !== 'chat') return;
  const now = new Date().toISOString();

  let html = '';
  if (data.text) {
    // Error / incomplete LR message
    html = escapeHtml(data.text);
  } else if (data.pdfLink) {
    // ✅ PDF ready — show card, NO "Generated Successfully" text
    html = pdfCardHTML(data.pdfLink, data.pdfName, data.truckNumber, data.from, data.to, data.weight, data.description);
  }

  if (!html) return;
  appendMsg('bot', html, now);
  saveMsg('bot', html);
});

socket.on('adminMessage', data => {
  // Update live list
  livePDFs = JSON.parse(localStorage.getItem(LIVE_KEY) || '[]');
  livePDFs.unshift(data);
  if (livePDFs.length > 100) livePDFs.pop();
  localStorage.setItem(LIVE_KEY, JSON.stringify(livePDFs));

  if (mode === 'live') renderLive();
});

/* ── Init ── */
loadChat();
