const mongoose = require("mongoose");

const TopicSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    name: { type: String, required: true, trim: true },
    // revisionStage tracks spaced repetition progress: 0 = never revised,
    // 1 = revised once, 2 = twice, 3 = considered mastered
    revisionStage: { type: Number, default: 0 },
    lastStudiedAt: { type: Date, default: null },
    mastered: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Topic", TopicSchema);
