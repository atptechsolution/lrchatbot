const socket = io();
const mobile = localStorage.getItem("mobile");

// auth check
if (!mobile) {
  window.location.href = "/login.html";
}

const CHAT_KEY = `chat_history_${mobile}`;

/* ================= DATE HELPERS (IST) ================= */
function getDateLabel(date) {
  const d = new Date(date);

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const dIST = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  const tIST = today.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  const yIST = yesterday.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  if (dIST === tIST) return "Today";
  if (dIST === yIST) return "Yesterday";

  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getTime(date) {
  return new Date(date).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ================= LOAD SAVED CHAT ================= */
function loadChatFromStorage() {
  const chat = document.getElementById("chat");
  const saved = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");

  let lastDate = "";

  saved.forEach((m) => {
    const label = getDateLabel(m.time);
    if (label !== lastDate) {
      chat.innerHTML += `<div class="chat-date">${label}</div>`;
      lastDate = label;
    }

    chat.innerHTML += `
      <div class="msg ${m.type}">
        ${m.text}
        <div class="msg-time">${getTime(m.time)}</div>
      </div>
    `;
  });

  chat.scrollTop = chat.scrollHeight;
}

/* ================= SAVE MESSAGE ================= */
function saveMessage(type, text) {
  const saved = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
  saved.push({
    type,
    text,
    time: new Date().toISOString(),
  });
  localStorage.setItem(CHAT_KEY, JSON.stringify(saved));
}

/* ---------------- SEND MESSAGE ---------------- */
function send() {
  const input = document.getElementById("msg");
  const msg = input.value.trim();
  if (!msg) return;

  const chat = document.getElementById("chat");
  const now = new Date();

  const label = getDateLabel(now);
  const last = chat.querySelector(".chat-date:last-of-type")?.innerText;

  if (label !== last) {
    chat.innerHTML += `<div class="chat-date">${label}</div>`;
  }

  chat.innerHTML += `
    <div class="msg user">
      ${msg}
      <div class="msg-time">${getTime(now)}</div>
    </div>
  `;

  saveMessage("user", msg);

  chat.scrollTop = chat.scrollHeight;

  socket.emit("userMessage", {
    mobile,
    message: msg,
  });

  input.value = "";
  autoGrow(input);
}

/* ---------------- ENTER TO SEND ---------------- */
document.getElementById("msg").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

/* ---------------- AUTO GROW ---------------- */
function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

document.getElementById("msg").addEventListener("input", function () {
  autoGrow(this);
});

/* ---------------- RECEIVE BOT MESSAGE ---------------- */
socket.on("botMessage", (data) => {
  const chat = document.getElementById("chat");
  const now = new Date();

  const label = getDateLabel(now);
  const last = chat.querySelector(".chat-date:last-of-type")?.innerText;

  if (label !== last) {
    chat.innerHTML += `<div class="chat-date">${label}</div>`;
  }

  chat.innerHTML += `
    <div class="msg bot">
      ${data.text}
      <div class="msg-time">${getTime(now)}</div>
    </div>
  `;

  saveMessage("bot", data.text);

  if (data.pdfLink) {
    const name = data.pdfName || "LR.pdf";

    chat.innerHTML += `
    <div class="msg bot">
      📄 <a href="${data.pdfLink}" target="_blank">${name}</a>
      <div class="msg-time">${getTime(now)}</div>
    </div>
  `;
  }

  chat.scrollTop = chat.scrollHeight;
});

/* ---------------- INIT ---------------- */
loadChatFromStorage();
