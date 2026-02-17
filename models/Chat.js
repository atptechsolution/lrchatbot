const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    userId: String,
    userName: String,
    userMobile: String,

    // 🔥 LR EXTRACTED FIELDS
    truckNumber: { type: String },
    from: { type: String },
    to: { type: String },
    weight: { type: String },
    description: { type: String },

    // meta
    message: String,
    pdfLink: String,
    time: String,
    templateName: String,
  },
  {
    timestamps: true,
    strict: true, // 🔥 important (debug ke liye)
  }
);

chatSchema.pre("save", function (next) {
  console.log("🧾 CHAT SAVING →", {
    truckNumber: this.truckNumber,
    weight: this.weight,
    description: this.description,
  });
  next();
});

module.exports = mongoose.model("Chat", chatSchema);
