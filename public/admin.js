const socket = io();
const ADMIN_MOBILE = "8085074606";

/* ---------------- AUTH ---------------- */
if (localStorage.getItem("mobile") !== ADMIN_MOBILE) {
  location.href = "/login.html";
}

/* ---------------- STATE ---------------- */
let users = {}; // userId → { name, mobile, pdfs[] }
let mode = "live"; // live | chat | report
let activeUser = null;

/* =================================================
   🕒 IST HELPERS (NEW – SAFE)
================================================= */
function formatISTTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const dIST = d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  const todayIST = today.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  const yesterdayIST = yesterday.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  if (dIST === todayIST) return "Today";
  if (dIST === yesterdayIST) return "Yesterday";

  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ---------------- LOAD OLD CHATS ---------------- */
async function loadOldChats() {
  const res = await fetch("/admin/chats");
  const data = await res.json();

  users = {}; // refresh safe

  data.forEach((m) => {
    if (!users[m.userId]) {
      users[m.userId] = {
        name: m.userName,
        mobile: m.userMobile,
        pdfs: [],
      };
    }
    users[m.userId].pdfs.push(m);
  });
}

/* ---------------- SOCKET ---------------- */
socket.on("adminMessage", (data) => {
  if (!data.userId) return;

  if (!users[data.userId]) {
    users[data.userId] = {
      name: data.userName,
      mobile: data.userMobile,
      pdfs: [],
    };
  }

  users[data.userId].pdfs.unshift(data); // latest on top

  if (mode === "live") renderLive();
  if (mode === "chat" && activeUser === data.userId) {
    renderUser(data.userId);
  }
});

/* =================================================
   📊 REPORT SCREEN (UNCHANGED)
================================================= */
function showReport() {
  mode = "report";
  activeUser = null;
  document.querySelector(".wa-sidebar").style.display = "none";

  document.getElementById("adminChat").innerHTML = `
    <h3>📊 LR Report</h3>

    <div class="report-filters">
      <select id="reportTemplate">
        <option value="all">All Templates</option>
        <option value="av-logistics.ejs">A.V Logistics</option>
        <option value="namaskarm-road-lines.ejs">Namaskarm</option>
      </select>

      <input type="date" id="fromDate">
      <input type="date" id="toDate">

      <button onclick="loadReport()">View</button>
      <button class="export-btn" onclick="exportReport()">⬇ Download Excel</button>
    </div>

    <div id="reportTable"></div>
  `;
}

async function loadReport() {
  const template = document.getElementById("reportTemplate").value;
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;

  let url = `/admin/report/preview?template=${template}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;

  const res = await fetch(url);
  const data = await res.json();

  const box = document.getElementById("reportTable");

  if (!data.length) {
    box.innerHTML = `<p style="margin-top:10px;">❌ No data found</p>`;
    return;
  }

  box.innerHTML = `
    <table class="report-table">
      <tr>
        <th>Date</th>
        <th>User</th>
        <th>Mobile</th>
        <th>Template</th>
        <th>Vehicle No</th>
        <th>From</th>
        <th>To</th>
        <th>Weight</th>
        <th>Description</th>
      </tr>

      ${data
        .map(
          (r) => `
        <tr>
  <td data-label="Date">
    ${new Date(r.createdAt).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
    })}
  </td>
  <td data-label="User">${r.userName}</td>
  <td data-label="Mobile">${r.userMobile}</td>
  <td data-label="Template">${r.templateName}</td>
  <td data-label="Vehicle">${r.truckNumber || "-"}</td>
  <td data-label="From">${r.from || "-"}</td>
  <td data-label="To">${r.to || "-"}</td>
  <td data-label="Weight">${r.weight || "-"}</td>
  <td data-label="Description">${r.description || "-"}</td>
</tr>

      `
        )
        .join("")}
    </table>
  `;
}

function exportReport() {
  const template = document.getElementById("reportTemplate").value;
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;

  let url = `/admin/report/export?template=${template}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;

  console.log("📤 EXPORT BUTTON CLICKED");
  console.log("➡️ EXPORT URL:", url);

  window.open(url, "_blank");
}

/* =================================================
   LIVE PDFs – WhatsApp Style
================================================= */
function showLive() {
  mode = "live";
  activeUser = null;
  document.querySelector(".wa-sidebar").style.display = "none";
  renderLive();
}

function renderLive() {
  const chat = document.getElementById("adminChat");
  chat.innerHTML = `<h3>⚡ Live PDFs</h3>`;

  let all = [];
  Object.values(users).forEach((u) => {
    u.pdfs.forEach((p) => {
      all.push({ ...p, userName: u.name, userMobile: u.mobile });
    });
  });

  all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  let lastDate = "";

  all.forEach((p) => {
    const label = formatDateLabel(p.createdAt);

    if (label !== lastDate) {
      chat.innerHTML += `<div class="date-separator">${label}</div>`;
      lastDate = label;
    }

    chat.innerHTML += `
      <div class="admin-msg">
        <strong>${p.userName}</strong> (${p.userMobile})<br>

        📝 <div class="full-msg">${p.message || "-"}</div>

        🚚 <b>${p.truckNumber || "-"}</b> | ${p.weight || "-"}<br>

        <div class="pdf-preview">
          <iframe src="${p.pdfLink}"></iframe>
        </div>

        <a href="${p.pdfLink}" target="_blank">⬇ Download PDF</a>
        <small>${formatISTTime(p.createdAt)}</small>
      </div>
    `;
  });
}

/* =================================================
   CHATS MODE – USER WISE
================================================= */
function showChats() {
  mode = "chat";
  activeUser = null;
  document.querySelector(".wa-sidebar").style.display = "block";
  loadUsers();

  document.getElementById("adminChat").innerHTML = `
    <div class="empty-state">
      <i class="fa-solid fa-comments"></i>
      <p>Select a user</p>
    </div>
  `;
}

/* ---------------- LOAD USERS ---------------- */
async function loadUsers() {
  const res = await fetch("/admin/users");
  const data = await res.json();
  const list = document.getElementById("usersList");

  list.innerHTML = "";

  data.forEach((u) => {
    list.innerHTML += `
      <div class="user-card">
        <div class="user-info" onclick="openUser('${u._id}')">
          <div class="avatar">${u.name[0]}</div>
          <div>
            <strong>${u.name}</strong><br>
            <small>${u.mobile}</small><br>
            <small>${u.approved ? "✅ Approved" : "⏳ Pending"}</small>
          </div>
        </div>
      </div>
    `;
  });
}

/* ---------------- USER CHAT ---------------- */
function openUser(id) {
  activeUser = id;
  document.querySelector(".wa-sidebar").style.display = "none";
  renderUser(id);
}

function renderUser(id) {
  const u = users[id];
  const chat = document.getElementById("adminChat");

  chat.innerHTML = `
    <button class="back-btn" onclick="showChats()">⬅ Back</button>
    <h3>${u.name}</h3>
  `;

  let lastDate = "";

  u.pdfs
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((p) => {
      const label = formatDateLabel(p.createdAt);

      if (label !== lastDate) {
        chat.innerHTML += `<div class="date-separator">${label}</div>`;
        lastDate = label;
      }

      chat.innerHTML += `
        <div class="admin-msg">
          📝 <div class="full-msg">${p.message || "-"}</div>
          🚚 <b>${p.truckNumber}</b> | ${p.weight}<br>
          <iframe src="${p.pdfLink}"></iframe><br>
          <a href="${p.pdfLink}" target="_blank">⬇ Download PDF</a>
          <small>${formatISTTime(p.createdAt)}</small>
        </div>
      `;
    });
}

/* ---------------- INIT ---------------- */
(async () => {
  await loadOldChats();
  showLive();
})();
