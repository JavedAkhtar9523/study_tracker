const express = require("express");
const router = express.Router();
const Subject = require("../models/Subject");
const Topic = require("../models/Topic");
const Task = require("../models/Task");
const { requireAuth, requireManager } = require("../middleware/auth");

router.use(requireAuth);

// GET all subjects
router.get("/", async (req, res) => {
  const subjects = await Subject.find().sort({ name: 1 });
  res.json(subjects);
});

// POST create a subject (manager only)
router.post("/", requireManager, async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ message: "Subject name is required" });
  const subject = await Subject.create({ name, color });
  res.status(201).json(subject);
});

// DELETE a subject and its topics (manager only)
router.delete("/:id", requireManager, async (req, res) => {
  const { id } = req.params;
  const topics = await Topic.find({ subject: id });
  const topicIds = topics.map((t) => t._id);
  await Task.deleteMany({ $or: [{ subject: id }, { topic: { $in: topicIds } }] });
  await Topic.deleteMany({ subject: id });
  await Subject.findByIdAndDelete(id);
  res.json({ message: "Subject deleted" });
});

module.exports = router;
