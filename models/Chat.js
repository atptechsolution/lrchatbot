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

    // Receipt logic
    receiptNo: { type: Number },
    status: { type: String, default: 'success' },
    rate: { type: Number },
    amount: { type: Number },

    // Edit tracking
    isEdited: { type: Boolean, default: false },
    editedBy: { type: String },
    editedAt: { type: Date },
  },
  {
    timestamps: true,
    strict: true,
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
