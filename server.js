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
  res.json({ msg: "Signup done. Wait for admin approval" });
});

/* ------------------ LOGIN ------------------ */
app.post("/login", async (req, res) => {
  const { mobile } = req.body;

  if (mobile === ADMIN_MOBILE) {
    return res.json({ role: "admin" });
  }

  const user = await User.findOne({ mobile });
  if (!user) return res.json({ msg: "Signup first" });
  if (!user.approved) return res.json({ msg: "Waiting for approval" });

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

      /* ✅ VALIDATION */
      const missing = [];
      if (!lr.truckNumber) missing.push("Truck Number");
      if (!lr.to) missing.push("Destination (To)");
      if (!lr.weight) missing.push("Weight");
      if (!lr.description) missing.push("Goods / Description");

      /* ❌ INCOMPLETE LR */
      if (missing.length > 0) {
        /* -------- USER CHAT -------- */
        const userMsg =
          `❌ LR Incomplete\n\nMissing Details:\n` +
          missing.map((m) => `• ${m}`).join("\n") +
          `\n\nPlease resend like:\n` +
          `MH09HH4512 24 ton Plastic Dana Indore to Nagpur`;

        socket.emit("botMessage", {
          text: userMsg,
        });

        /* -------- ADMIN CHAT / LIVE -------- */
        io.emit("adminMessage", {
          userId: user._id.toString(),
          userName: user.name,
          userMobile: user.mobile,
          message:
            `⚠️ LR INCOMPLETE\n\n` +
            `Original Message:\n"${message}"\n\n` +
            `Missing Details:\n` +
            missing.map((m) => `• ${m}`).join("\n"),
          truckNumber: "-",
          weight: "-",
          pdfLink: "",
          templateName: user.assignedTemplate,
          createdAt: new Date().toISOString(),
          isError: true,
        });

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

      /* 🧾 PDF GENERATION (IST for display only) */
      const now = new Date();
      const istDate = now.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
      });
      const istTime = now.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
      });

      const pdfFile = await generatePdf(user.assignedTemplate, {
        truckNumber: lr.truckNumber,
        from: lr.from || "",
        to: lr.to || "",
        weight: lr.weight,
        description: lr.description,
        date: istDate,
        time: istTime,
        logoPath,
      });

      /* 📦 SAVE CHAT (VALID LR ONLY) */
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
        templateName: user.assignedTemplate,
      };

      await Chat.create(payload);

      socket.emit("botMessage", {
        text: "✅ LR Generated Successfully",
        pdfLink: payload.pdfLink,
          pdfName: `LR_${lr.truckNumber}.pdf`, 
        templateName: payload.templateName,
      });

      io.emit("adminMessage", payload);
    } catch (err) {
      console.error("❌ LR error:", err);
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

/* 🔥 ADMIN CHATS (refresh / relogin safe) */
app.get("/admin/chats", async (req, res) => {
  const chats = await Chat.find().sort({ createdAt: 1 });
  res.json(chats);
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
  try {
    console.log("📥 EXCEL EXPORT HIT");
    console.log("➡️ QUERY:", req.query);

    const { template, from, to } = req.query;
    const query = {};

    if (template && template !== "all") {
      query.templateName = template;
    }

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to + "T23:59:59");
    }

    console.log("🧠 MONGO QUERY:", query);

    const chats = await Chat.find(query).sort({ createdAt: 1 });
    console.log("📊 TOTAL ROWS FOUND:", chats.length);

    const rows = chats.map((c) => ({
      Template: c.templateName,
      User: c.userName,
      Mobile: c.userMobile,
      TruckNumber: c.truckNumber,
      From: c.from,
      To: c.to,
      Weight: c.weight,
      Description: c.description,
      Date: new Date(c.createdAt).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
      Time: new Date(c.createdAt).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
      PDF: c.pdfLink,
    }));

    console.log("🧾 SAMPLE ROW:", rows[0] || "NO DATA");

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "LR_REPORT");

    const file = `LR_REPORT_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, file);

    console.log("✅ EXCEL FILE CREATED:", file);

    res.download(file, () => {
      require("fs").unlinkSync(file);
      console.log("🗑️ TEMP EXCEL DELETED");
    });
  } catch (err) {
    console.error("❌ EXCEL EXPORT FAILED:", err);
    res.status(500).json({ msg: "Excel export failed" });
  }
});
/* ------------------ REPORT PREVIEW (VIEW BUTTON) ------------------ */
/* ------------------ REPORT PREVIEW ------------------ */
app.get("/admin/report/preview", async (req, res) => {
  try {
    console.log("👀 REPORT PREVIEW HIT");
    console.log("➡️ QUERY:", req.query);

    const { template, from, to } = req.query;
    const query = {};

    if (template && template !== "all") {
      query.templateName = template;
    }

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to + "T23:59:59");
    }

    console.log("🧠 MONGO QUERY:", query);

    const chats = await Chat.find(query).sort({ createdAt: -1 });
    console.log("📊 PREVIEW ROWS:", chats.length);

    res.json(chats);
  } catch (err) {
    console.error("❌ REPORT PREVIEW FAILED:", err);
    res.status(500).json([]);
  }
});

/* ------------------ START ------------------ */
server.listen(3000, () =>
  console.log("🚀 Server running on http://localhost:3000")
);
