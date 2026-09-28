const mongoose = require("mongoose");

const StudyLogSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudyLog", StudyLogSchema);
