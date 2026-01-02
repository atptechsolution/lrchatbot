const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  approved: { type: Boolean, default: false },
  assignedTemplate: {
    type: String,
    default: "namaskarm-road-lines.ejs"
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
