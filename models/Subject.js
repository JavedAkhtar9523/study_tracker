const mongoose = require("mongoose");

const SubjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "#3F8F6C" }, // hex color used in UI
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subject", SubjectSchema);
