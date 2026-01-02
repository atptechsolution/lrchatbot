const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const path = require("path");
const XLSX = require("xlsx");

const User = require("./models/User");
const Chat = require("./models/Chat");
const { extractDetails } = require("./utils/lrExtractor");
const { generatePdf } = require("./utils/pdfGenerator");
const { ADMIN_MOBILE } = require("./config/admin");

/* ------------------ MongoDB ------------------ */
mongoose
  .connect("mongodb+srv://lr:Ram9616@cluster0.sunse44.mongodb.net/lrchat")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ Mongo error", err));

/* ------------------ App ------------------ */
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/pdf", express.static(path.join(__dirname, "pdf")));

/* ------------------ ROOT ------------------ */
app.get("/", (req, res) => res.redirect("/login.html"));

/* ------------------ SIGNUP ------------------ */
app.post("/signup", async (req, res) => {
  const { name, mobile } = req.body;
  if (!name || !mobile) return res.json({ msg: "All fields required" });

  const exists = await User.findOne({ mobile });
  if (exists) return res.json({ msg: "Already registered" });

  await User.create({ name, mobile });
  console.log("🆕 Signup:", name, mobile);

  res.json({ msg: "Signup done. Wait for admin approval" });
});

/* ------------------ LOGIN ------------------ */
app.post("/login", async (req, res) => {
  const { mobile } = req.body;

  if (mobile === ADMIN_MOBILE) {
    console.log("👑 Admin login");
    return res.json({ role: "admin" });
  }

  const user = await User.findOne({ mobile });
  if (!user) return res.json({ msg: "Signup first" });
  if (!user.approved) return res.json({ msg: "Waiting for approval" });

  console.log("👤 User login:", mobile);
  res.json({ role: "user" });
});

/* ------------------ SOCKET ------------------ */
io.on("connection", (socket) => {
  socket.on("userMessage", async ({ mobile, message }) => {
    try {
      const user = await User.findOne({ mobile });
      if (!user || !user.approved) return;

      /* 🔍 Extract LR using AI */
      const lr = await extractDetails(message);
      console.log("🧠 LR EXTRACTED:", lr);

      /* ✅ SMART VALIDATION */
      const missing = [];
      if (!lr.truckNumber) missing.push("Truck Number");
      if (!lr.to) missing.push("Destination (To)");
      if (!lr.weight) missing.push("Weight");
      if (!lr.description) missing.push("Goods / Description");

      if (missing.length > 0) {
        const errorText = `❌ LR incomplete\nMissing: ${missing.join(", ")}`;

        /* 👤 USER NOTIFY */
        socket.emit("botMessage", {
          text:
            errorText +
            "\n\nPlease resend message with missing details 🙏\n" +
            "Example:\nMH09HH4512 24 ton Plastic Dana Indore to Nagpur",
        });

        /* 👑 ADMIN LIVE ALERT */
        io.emit("adminMessage", {
          type: "LR_ERROR",
          userName: user.name,
          userMobile: user.mobile,
          originalMessage: message,
          extracted: lr,
          missing,
          time: new Date().toLocaleTimeString("en-IN"),
        });

        console.log("⚠️ LR INCOMPLETE:", missing);
        return;
      }

      /* 🖼️ LOGO SELECTION */
      let logoPath = "";

      if (user.assignedTemplate === "av-logistics.ejs") {
        logoPath =
          "file://" +
          path.join(__dirname, "public/assets/av-logistics-logo.png");
      }

      if (user.assignedTemplate === "namaskarm-road-lines.ejs") {
        logoPath =
          "file://" + path.join(__dirname, "public/assets/namaskarm-logo.png");
      }

      console.log("🖼️ LOGO USED:", logoPath);

      /* 🧾 Generate PDF */
      const pdfFile = await generatePdf(user.assignedTemplate, {
        truckNumber: lr.truckNumber,
        from: lr.from || "",
        to: lr.to || "",
        weight: lr.weight,
        description: lr.description,
        date: new Date().toLocaleDateString("en-IN"),
        time: new Date().toLocaleTimeString("en-IN"),
        logoPath,
      });

      /* 📦 SAVE CHAT */
      const payload = {
        userId: user._id.toString(),
        userName: user.name,
        userMobile: user.mobile,
        truckNumber: lr.truckNumber,
        from: lr.from || "",
        to: lr.to || "",
        weight: lr.weight,
        description: lr.description,
        message,
        pdfLink: `/pdf/generated/${pdfFile}`,
        time: new Date().toLocaleTimeString("en-IN"),
        templateName: user.assignedTemplate,
      };

      await Chat.create(payload);
      console.log("✅ LR SAVED:", payload.truckNumber);

      /* 👤 USER SUCCESS */
      socket.emit("botMessage", {
        text: "✅ LR Generated Successfully",
        pdfLink: payload.pdfLink,
        templateName: payload.templateName,
      });

      /* 👑 ADMIN LIVE */
      io.emit("adminMessage", payload);
    } catch (err) {
      console.error("❌ LR generation failed:", err);
      socket.emit("botMessage", {
        text: "❌ Server error. Please try again later.",
      });
    }
  });
});

/* ------------------ ADMIN APIs ------------------ */
app.get("/admin/users", async (req, res) => {
  const users = await User.find().sort({ approved: 1 });
  res.json(users);
});

app.post("/admin/approve/:id", async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { approved: true });
  res.json({ msg: "Approved" });
});

app.post("/admin/template/:id", async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, {
    assignedTemplate: req.body.template,
  });
  res.json({ msg: "Template changed" });
});

app.delete("/admin/user/:id", async (req, res) => {
  const userId = req.params.id;
  await User.findByIdAndDelete(userId);
  await Chat.deleteMany({ userId });
  res.json({ msg: "User deleted" });
});

/* ------------------ REPORT EXPORT (EXCEL) ------------------ */
app.get("/admin/report/export", async (req, res) => {
  const { template, from, to } = req.query;
  const query = {};

  if (template && template !== "all") query.templateName = template;

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to + "T23:59:59");
  }

  const chats = await Chat.find(query).sort({ createdAt: 1 });
  console.log("📊 Export rows:", chats.length);

  const rows = chats.map((c) => ({
    Template: c.templateName,
    User: c.userName,
    Mobile: c.userMobile,
    TruckNumber: c.truckNumber,
    From: c.from,
    To: c.to,
    Weight: c.weight,
    Description: c.description,
    Date: new Date(c.createdAt).toLocaleDateString("en-IN"),
    Time: c.time,
    PDF: c.pdfLink,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "LR_REPORT");

  const file = "LR_REPORT.xlsx";
  XLSX.writeFile(wb, file);

  res.download(file, () => require("fs").unlinkSync(file));
});

/* ------------------ REPORT PREVIEW (JSON) ------------------ */
app.get("/admin/report/preview", async (req, res) => {
  const { template, from, to } = req.query;
  const query = {};

  if (template && template !== "all") query.templateName = template;

  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to + "T23:59:59");
  }

  const chats = await Chat.find(query).sort({ createdAt: -1 });
  res.json(chats);
});
/* ------------------ START ------------------ */
server.listen(3000, () =>
  console.log("🚀 Server running on http://localhost:3000")
);
