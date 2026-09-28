const express = require("express");
const router = express.Router();
const Topic = require("../models/Topic");
const Task = require("../models/Task");
const { requireAuth, requireManager } = require("../middleware/auth");

router.use(requireAuth);

// GET topics, optionally filtered by subject: /api/topics?subject=<id>
router.get("/", async (req, res) => {
  const filter = {};
  if (req.query.subject) filter.subject = req.query.subject;
  const topics = await Topic.find(filter).populate("subject").sort({ createdAt: -1 });
  res.json(topics);
});

// POST create a topic (manager only)
router.post("/", requireManager, async (req, res) => {
  const { subject, name } = req.body;
  if (!subject || !name) {
    return res.status(400).json({ message: "Subject and topic name are required" });
  }
  const topic = await Topic.create({ subject, name });
  res.status(201).json(topic);
});

// PATCH update a topic (manager only) - e.g. mark mastered manually
router.patch("/:id", requireManager, async (req, res) => {
  const topic = await Topic.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(topic);
});

// DELETE a topic (manager only)
router.delete("/:id", requireManager, async (req, res) => {
  await Task.deleteMany({ topic: req.params.id });
  await Topic.findByIdAndDelete(req.params.id);
  res.json({ message: "Topic deleted" });
});

module.exports = router;
