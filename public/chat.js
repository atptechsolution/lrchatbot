const socket = io();
const mobile = localStorage.getItem("mobile");

// auth check
if (!mobile) {
  window.location.href = "/login.html";
}

/* ---------------- SET HEADER ON LOAD ---------------- */
async function loadHeader() {
  const res = await fetch(`/me/${mobile}`);
  if (!res.ok) return;

  const data = await res.json();
  const header = document.getElementById("chatHeader");

  if (!header) return;

  if (data.assignedTemplate?.includes("av")) {
    header.innerText = "A.V. Logistics";
  } else if (data.assignedTemplate?.includes("namaskarm")) {
    header.innerText = "Namaskarm Road Lines";
  } else {
    header.innerText = "LR Support";
  }
}

loadHeader();

/* ---------------- SEND MESSAGE ---------------- */
function send() {
  const input = document.getElementById("msg");
  const msg = input.value.trim();
  if (!msg) return;

  const chat = document.getElementById("chat");

  // USER MESSAGE
  chat.innerHTML += `<div class="msg user">${msg}</div>`;
  chat.scrollTop = chat.scrollHeight;

  socket.emit("userMessage", {
    mobile,
    message: msg,
  });

  input.value = "";
}

/* ---------------- RECEIVE BOT MESSAGE ---------------- */
socket.on("botMessage", (data) => {
  const chat = document.getElementById("chat");

  // 🔥 UPDATE HEADER IF TEMPLATE COMES (after admin change)
  if (data.templateName) {
    const header = document.getElementById("chatHeader");
    if (header) {
      if (data.templateName.includes("av")) {
        header.innerText = "A.V. Logistics";
      } else if (data.templateName.includes("namaskarm")) {
        header.innerText = "Namaskarm Road Lines";
      }
    }
  }

  let html = `<div class="msg bot">${data.text}</div>`;

  if (data.pdfLink) {
    html += `
      <div class="msg bot">
        📄 <a href="${data.pdfLink}" target="_blank">Download LR PDF</a>
      </div>
    `;
  }

  chat.innerHTML += html;
  chat.scrollTop = chat.scrollHeight;
});
