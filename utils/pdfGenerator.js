const puppeteer = require("puppeteer");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs");

/* ================================
   🔥 SAFE IMAGE → BASE64
   (file:// issue fixed here)
================================ */
function imageToBase64(imgPath) {
  try {
    // 🔧 remove file:// if present
    const cleanPath = imgPath.replace(/^file:\/\//, "");

    const absolutePath = path.resolve(cleanPath);

    if (!fs.existsSync(absolutePath)) {
      console.error("❌ LOGO FILE NOT FOUND:", absolutePath);
      return "";
    }

    const img = fs.readFileSync(absolutePath);
    const ext = path.extname(absolutePath).replace(".", "");

    return `data:image/${ext};base64,${img.toString("base64")}`;
  } catch (err) {
    console.error("❌ imageToBase64 failed:", err);
    return "";
  }
}

async function generatePdf(templateName, data) {
  try {
    console.log("🧾 PDF DATA RECEIVED:", data);

    /* 🔥 CONVERT LOGO TO BASE64 (NO FLOW CHANGE) */
    if (data.logoPath) {
      data.logoBase64 = imageToBase64(data.logoPath);
      console.log("🖼️ LOGO BASE64 STATUS:", data.logoBase64 ? "OK" : "EMPTY");
    }

    const templatePath = path.join(
      __dirname,
      "../views/templates",
      templateName
    );

    const html = await ejs.renderFile(templatePath, data);

    const pdfDir = path.join(__dirname, "../pdf/generated");
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    /* =====================================================
       🔥 ONLY CHANGE IS HERE (PDF NAME = VEHICLE NUMBER)
       ❌ OLD: LR_${Date.now()}.pdf
       ✅ NEW: <TRUCK_NUMBER>.pdf
    ===================================================== */
    const safeTruckNumber = (data.truckNumber || "LR")
      .replace(/\s+/g, "")
      .replace(/[^a-zA-Z0-9]/g, "");

    const fileName = `${safeTruckNumber}.pdf`;
    const outputPath = path.join(pdfDir, fileName);

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    console.log("✅ PDF GENERATED:", fileName);
    return fileName;
  } catch (err) {
    console.error("❌ PDF generation failed:", err);
    throw err;
  }
}

module.exports = { generatePdf };
