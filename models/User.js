const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'subadmin', 'admin'], default: 'user' },
  approved: { type: Boolean, default: false },
  assignedTemplate: {
    type: String,
    default: "namaskarm-road-lines.ejs"
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
