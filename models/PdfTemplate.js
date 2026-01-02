const mongoose = require("mongoose");

const pdfTemplateSchema = new mongoose.Schema({
  name: String,
  file: String,
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model("PdfTemplate", pdfTemplateSchema);
