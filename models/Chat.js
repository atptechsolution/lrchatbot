const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    userId: String,
    userName: String,
    userMobile: String,
    truckNumber: { type: String },
    from: { type: String },
    to: { type: String },
    weight: { type: String },
    description: { type: String },
    message: String,
    pdfLink: String,
    time: String,
    templateName: String,
    receiptNo: { type: Number },
    status: { type: String, default: 'success' },
    rate: { type: Number },
    amount: { type: Number },
    isFixedAmount: { type: Boolean, default: false },
    rateSetBy: { type: String },
    isEdited: { type: Boolean, default: false },
    editedBy: { type: String },
    editedAt: { type: Date },
    editHistory: [{
      field: { type: String },
      oldValue: { type: String },
      newValue: { type: String },
    }],
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model("Chat", chatSchema);
