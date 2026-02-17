# 🚚 LR Chat System v2

WhatsApp-style chat app jisme user ek message bhejta hai aur automatically **LR (Lorry Receipt) PDF** generate ho jaata hai.

---

## 📁 Project Structure (MVC)

```
lrchatbot-v2/
├── server.js               ← Entry point (Express + Socket.io setup)
│
├── routes/
│   ├── auth.js             ← /login, /signup routes
│   └── admin.js            ← /admin/* routes
│
├── controllers/
│   ├── authController.js   ← Login/Signup logic
│   ├── adminController.js  ← User mgmt, report, export logic
│   └── chatController.js   ← LR extraction + PDF generation logic
│
├── models/
│   ├── User.js             ← User schema (name, mobile, approved, template)
│   ├── Chat.js             ← Chat/LR record schema
│   └── PdfTemplate.js      ← Template schema (optional)
│
├── utils/
│   ├── lrExtractor.js      ← OpenAI-based LR parser
│   └── pdfGenerator.js     ← Puppeteer PDF generator
│
├── views/templates/        ← EJS templates for PDF layout
│   ├── av-logistics.ejs
│   ├── namaskarm-road-lines.ejs
│   └── maruti.ejs
│
├── public/
│   ├── css/style.css       ← Single unified CSS file
│   ├── js/
│   │   ├── auth.js         ← Login/Signup frontend
│   │   ├── chat.js         ← User chat frontend
│   │   └── admin.js        ← Admin panel frontend
│   ├── login.html
│   ├── signup.html
│   ├── chat.html
│   ├── admin.html
│   └── assets/             ← Logos (namaskarm, av-logistics)
│
├── pdf/generated/          ← Generated PDFs (auto-created)
├── config/admin.js         ← Admin mobile number config
├── .env.example            ← Environment variables template
├── .gitignore
├── package.json
└── README.md
```

---

## ⚡ Quick Start

### 1. Clone & Install
```bash
git clone <repo-url>
cd lrchatbot-v2
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# .env file mein ye daalo:
# MONGO_URI=your_mongodb_connection_string
# OPENAI_API_KEY=your_openai_key
```

### 3. Run
```bash
npm start
# Server: http://localhost:3000
```

---

## 🔧 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB Atlas connection string |
| `OPENAI_API_KEY` | ✅ | OpenAI API key (GPT-4o used for LR parsing) |
| `LR_MODEL` | ❌ | Override AI model (default: `gpt-4o`) |
| `PORT` | ❌ | Server port (default: `3000`) |
| `PHONE_NUMBER_ID` | ❌ | WhatsApp Graph API - for error alerts |
| `WHATSAPP_TOKEN` | ❌ | WhatsApp Graph API token |

---

## 🎯 Features

### User Chat
- WhatsApp-style interface
- Type LR details in one message → PDF auto-generates
- **PDF card** with Download + Share buttons (no "Generated Successfully" popup)
- Textarea **auto-resizes** as you type
- Chat history stored in localStorage

### PDF Message Format
- PDF generate hone ke baad sirf PDF card dikhta hai:
  - Vehicle number, From → To, Weight, Goods
  - **Download** button (direct download)
  - **Share** button (Web Share API on mobile, Copy Link on desktop)

### Admin Panel
- **Chats tab**: All users list, approve/reject, assign PDF template
- **Live PDFs tab**: Real-time LR feed with PDF preview + Share button
- **Reports tab**: Filter by template/date, preview table, export Excel

---

## 🖊️ How LR Message Works

User kuch bhi type kare, AI extract karta hai:

```
MH09HH4512 24 ton Plastic Dana Indore to Nagpur
```

Extracted fields:
- `truckNumber`: MH09HH4512
- `weight`: 24000 (kg mein convert)
- `description`: Plastic Dana
- `from`: Indore
- `to`: Nagpur

Missing field hone pe user ko error message milta hai with specific missing fields.

---

## 🏗️ MVC Architecture

### Model (models/)
Database schemas define karte hain — User, Chat, PdfTemplate.

### View (public/, views/templates/)
- `public/` — HTML pages + CSS + frontend JS
- `views/templates/` — EJS templates for PDF rendering

### Controller (controllers/)
Business logic:
- `authController.js` → Login/Signup validate karta hai
- `adminController.js` → User management + reports
- `chatController.js` → LR extract → PDF generate → Chat save

### Routes (routes/)
HTTP routes ko controllers se connect karta hai.

---

## 🔌 Socket Events

| Event | Direction | Description |
|---|---|---|
| `userMessage` | Client → Server | User ka LR message |
| `botMessage` | Server → Client | PDF card ya error |
| `adminMessage` | Server → All | New LR broadcast to admin |

---

## 📝 PDF Templates

Teen templates available hain:
1. `av-logistics.ejs` — A.V Logistics format
2. `namaskarm-road-lines.ejs` — Namaskarm Road Lines format
3. `maruti.ejs` — Maruti format

Admin panel se har user ko specific template assign kar sakte ho.

---

## 💡 Changes from v1 → v2

| Issue | v1 | v2 ✅ |
|---|---|---|
| Architecture | Sab server.js mein | Proper MVC (controllers/routes) |
| "Generated Successfully" toast | Dikhta tha | Removed — sirf PDF card |
| Textarea resize | Fixed height | Auto-resize with message |
| PDF Share button | Missing | Added (Web Share API + Copy Link fallback) |
| CSS | Multiple files with duplicates | Single `style.css`, clean, no duplicates |
| Font Awesome CDN | Loaded (100KB+) | Removed — inline SVGs use kiye |
| Admin Share | Missing | Added in Live PDFs + User chats |

---

## 📦 Dependencies

```json
{
  "express": "HTTP server",
  "socket.io": "Real-time chat",
  "mongoose": "MongoDB ODM",
  "ejs": "PDF template rendering",
  "puppeteer": "PDF generation (headless Chrome)",
  "openai": "LR text extraction",
  "xlsx": "Excel report export",
  "axios": "HTTP client",
  "dotenv": "Environment variables"
}
```

---

## 🛡️ Admin Access

Admin mobile number `config/admin.js` mein set hai.  
Default: `8085074606`

Admin login karne par directly `/admin.html` redirect hota hai.
