const mongoose = require("mongoose");

const rateSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
  itemKeyword: { type: String, required: true },
  ratePerTon: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Rate", rateSchema);
