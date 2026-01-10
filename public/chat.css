const socket = io();
const mobile = localStorage.getItem("mobile");

window.addEventListener("load", () => {
  if (!mobile) {
    window.location.href = "/login.html";
  }
});

const CHAT_KEY = `chat_history_${mobile}`;
const LIVE_KEY = "live_pdfs_all_users";

/* ================= STATE ================= */
let mode = "chat"; // chat | live
let livePDFs = [];

/* ================= SAFE DATE HELPERS ================= */
function toDateSafe(d) {
  const date = d ? new Date(d) : new Date();
  return isNaN(date.getTime()) ? new Date() : date;
}

function formatTime(d) {
  const date = toDateSafe(d);
  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(d) {
  const date = toDateSafe(d);

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const dIST = date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  const tIST = today.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  const yIST = yesterday.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  if (dIST === tIST) return "Today";
  if (dIST === yIST) return "Yesterday";

  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ================= LOAD CHAT ================= */
function loadChatFromStorage() {
  const chat = document.getElementById("chat");
  chat.innerHTML = "";

  const saved = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
  let lastDate = "";

  saved.forEach((m) => {
    const label = formatDateLabel(m.time);
    if (label !== lastDate) {
      chat.innerHTML += `<div class="chat-date">${label}</div>`;
      lastDate = label;
    }

    chat.innerHTML += `
      <div class="msg ${m.type}">
        ${m.text}
        <div class="msg-time">${formatTime(m.time)}</div>
      </div>
    `;
  });

  chat.scrollTop = chat.scrollHeight;
}

/* ================= SAVE MESSAGE ================= */
function saveMessage(type, text) {
  const saved = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
  saved.push({ type, text, time: new Date().toISOString() });
  localStorage.setItem(CHAT_KEY, JSON.stringify(saved));
}

/* ================= LOAD LIVE ================= */
function loadLiveFromStorage() {
  livePDFs = JSON.parse(localStorage.getItem(LIVE_KEY) || "[]");
}

/* ================= CHAT MODE ================= */
function showChat() {
  mode = "chat";
  document.getElementById("chatInput").style.display = "flex";
  loadChatFromStorage();
}

/* ================= LIVE MODE ================= */
function showLive() {
  mode = "live";
  document.getElementById("chatInput").style.display = "none";
  renderLive();
}

function renderLive() {
  const chat = document.getElementById("chat");
  chat.innerHTML = `<h3>⚡ Live PDFs</h3>`;

  let lastDate = "";

  livePDFs.forEach((p) => {
    const label = formatDateLabel(p.createdAt);
    if (label !== lastDate) {
      chat.innerHTML += `<div class="chat-date">${label}</div>`;
      lastDate = label;
    }

    chat.innerHTML += `
      <div class="msg bot">
        <strong>${p.userName || "User"}</strong> (${p.userMobile || "-"})<br>
        📝 ${p.message || "-"}<br>
        🚚 <b>${p.truckNumber || "-"}</b> | ${p.weight || "-"}<br>
        📄 <a href="${p.pdfLink}" target="_blank">Download PDF</a>
        <div class="msg-time">${formatTime(p.createdAt)}</div>
      </div>
    `;
  });

  chat.scrollTop = chat.scrollHeight;
}

/* ================= KEY HANDLER ================= */
function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

/* ================= SEND (FIXED) ================= */
function send() {
  if (mode !== "chat") return;

  const input = document.getElementById("msg");
  const msg = input.value.trim();
  if (!msg) return;

  const chat = document.getElementById("chat");
  const now = new Date();

  const label = formatDateLabel(now);
  const lastLabel = chat.querySelector(".chat-date:last-of-type")?.innerText;

  if (label !== lastLabel) {
    chat.innerHTML += `<div class="chat-date">${label}</div>`;
  }

  chat.innerHTML += `
    <div class="msg user">
      ${msg}
      <div class="msg-time">${formatTime(now)}</div>
    </div>
  `;

  saveMessage("user", msg);
  socket.emit("userMessage", { mobile, message: msg });

  input.value = "";
  chat.scrollTop = chat.scrollHeight;
}

/* ================= BOT MESSAGE ================= */
socket.on("botMessage", (data) => {
  if (mode !== "chat") return;

  const chat = document.getElementById("chat");

  chat.innerHTML += `
    <div class="msg bot">
      ${data.text}
      <div class="msg-time">${formatTime()}</div>
    </div>
  `;

  saveMessage("bot", data.text);
  chat.scrollTop = chat.scrollHeight;
});

/* ================= ADMIN MESSAGE ================= */
socket.on("adminMessage", (data) => {
  livePDFs.unshift(data);
  localStorage.setItem(LIVE_KEY, JSON.stringify(livePDFs));

  if (data.userMobile === mobile && mode === "chat") {
    const chat = document.getElementById("chat");

    const fullText = `
${data.message || ""}
🚚 ${data.truckNumber || "-"} | ${data.weight || "-"}
📄 <a href="${data.pdfLink}" target="_blank">Download PDF</a>
    `;

    chat.innerHTML += `
      <div class="msg bot">
        ${fullText}
        <div class="msg-time">${formatTime(data.createdAt)}</div>
      </div>
    `;

    saveMessage("bot", fullText);
    chat.scrollTop = chat.scrollHeight;
  }

  if (mode === "live") renderLive();
});

/* ================= INIT ================= */
loadLiveFromStorage();
showChat();
